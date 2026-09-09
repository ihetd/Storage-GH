import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { applyShopifyStockChanges, type StockChange } from "@/lib/shopify/stock";
import { isHandledTopic, verifyWebhookSignature } from "@/lib/shopify/webhook";

// Shopify order webhooks.
//
// Unauthenticated by design — Shopify has no session — so src/proxy.ts lets
// this path through and the HMAC signature is the gate instead.
//
// The work is done before responding rather than in after(). Shopify allows
// five seconds and a cold start can eat into that, but a timeout is the safe
// failure: Shopify retries, and the unique index on (externalRef,
// productVariantId) means a retry of work that did land counts nothing twice.
// Deferring to after() would trade a retry we recover from for a silent loss
// we do not.

type LineItem = { variant_id: number | null; quantity: number };
type OrderPayload = { id: number; line_items?: LineItem[] };
type RefundPayload = {
  id: number;
  order_id?: number;
  refund_line_items?: { quantity: number; line_item?: { variant_id: number | null } }[];
};

/** Merge repeated variants: an order can list the same size on two lines. */
function collapse(entries: { variantId: number | null | undefined; quantity: number }[], sign: 1 | -1): StockChange[] {
  const totals = new Map<string, number>();
  for (const e of entries) {
    if (!e.variantId || !e.quantity) continue;
    const key = String(e.variantId);
    totals.set(key, (totals.get(key) ?? 0) + e.quantity * sign);
  }
  return [...totals].map(([shopifyVariantId, delta]) => ({ shopifyVariantId, delta }));
}

export async function POST(req: Request) {
  // Raw bytes, before anything parses them: re-serialised JSON has different
  // whitespace and key order, and would never match the signature.
  const rawBody = await req.text();

  if (!verifyWebhookSignature(rawBody, req.headers.get("x-shopify-hmac-sha256"))) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const topic = req.headers.get("x-shopify-topic");
  if (!isHandledTopic(topic)) {
    // 200, not 4xx. A topic we don't handle is not a delivery failure, and
    // failing it would have Shopify retrying for two days over nothing.
    return NextResponse.json({ ignored: topic });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  let changes: StockChange[];
  let externalRef: string;
  let source: "SHOPIFY_ORDER" | "SHOPIFY_CANCEL" | "SHOPIFY_REFUND";

  if (topic === "refunds/create") {
    const refund = payload as RefundPayload;
    source = "SHOPIFY_REFUND";
    externalRef = `refund:${refund.id}`;
    changes = collapse(
      (refund.refund_line_items ?? []).map((r) => ({
        variantId: r.line_item?.variant_id,
        quantity: r.quantity,
      })),
      1,
    );
  } else {
    const order = payload as OrderPayload;
    const sold = (order.line_items ?? []).map((l) => ({
      variantId: l.variant_id,
      quantity: l.quantity,
    }));
    if (topic === "orders/create") {
      source = "SHOPIFY_ORDER";
      externalRef = `order:${order.id}`;
      changes = collapse(sold, -1);
    } else {
      source = "SHOPIFY_CANCEL";
      externalRef = `cancel:${order.id}`;
      changes = collapse(sold, 1);
    }
  }

  if (changes.length === 0) {
    return NextResponse.json({ ok: true, applied: 0 });
  }

  const outcome = await applyShopifyStockChanges(changes, source, externalRef);

  if (outcome.unknown.length > 0) {
    // Not an error to Shopify — retrying will not create the missing link — but
    // it is the one failure that silently drifts stock, so it must be visible.
    console.warn(
      `[shopify] ${externalRef}: ${outcome.unknown.length} variant(s) sold with no linked stock row:`,
      outcome.unknown.join(", "),
    );
  }

  if (outcome.applied.length > 0) {
    // staleTimes in next.config.ts caches these pages, so without this the
    // stock screen keeps showing the old number.
    revalidatePath("/");
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/products");
  }

  return NextResponse.json({
    ok: true,
    applied: outcome.applied.length,
    duplicates: outcome.duplicates.length,
    unknown: outcome.unknown.length,
  });
}
