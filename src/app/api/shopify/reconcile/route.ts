import { NextResponse } from "next/server";
import { isShopifyConfigured } from "@/lib/shopify/config";
import { recordReconcileRun } from "@/lib/shopify/reconcile";

// Nightly drift check, invoked by the Vercel cron in vercel.json.
//
// Vercel sends CRON_SECRET as a bearer token, which is what authorises this —
// src/proxy.ts lets the path through because a cron has no session cookie, the
// same reason the webhook is exempt.
//
// Read-only, so the fact that cron delivery may fire twice or not at all costs
// nothing: a duplicate run records a second identical comparison, and a missed
// one is caught by the next.

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isShopifyConfigured()) {
    return NextResponse.json({ error: "Shopify is not configured" }, { status: 503 });
  }

  try {
    const result = await recordReconcileRun();
    if (result.drifted > 0 || result.missing > 0) {
      console.warn(
        `[shopify] reconcile: ${result.drifted} drifted, ${result.missing} missing of ${result.checked} checked`,
        result.details,
      );
    }
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "unknown error";
    console.error(`[shopify] reconcile failed: ${message}`);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
