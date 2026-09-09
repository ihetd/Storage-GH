import { prisma } from "@/lib/prisma";
import { fetchShopifyGroups } from "./products";

// Comparing both systems and recording where they disagree.
//
// Everything else in this integration is event-driven, and events go missing:
// Shopify retries a failed webhook for two days and then stops, and an outbound
// push can fail while the local change stands. Neither path notices. Without
// this, the two counts drift apart silently and the first sign is a customer
// buying something that is not on the shelf.
//
// It only looks and records. Correcting automatically would mean choosing a
// winner, and neither side deserves that by default — a drift usually means a
// lost event, but which side lost it is exactly what nobody knows yet.

export type Drift = {
  product: string;
  label: string;
  local: number;
  shopify: number;
};

export type ReconcileResult = {
  checked: number;
  drifted: number;
  missing: number;
  details: Drift[];
};

export async function reconcileStock(): Promise<ReconcileResult> {
  const [linked, groups] = await Promise.all([
    prisma.productVariant.findMany({
      where: { shopifyInventoryItemId: { not: null } },
      select: {
        label: true,
        quantity: true,
        shopifyInventoryItemId: true,
        product: { select: { name: true } },
      },
    }),
    fetchShopifyGroups(),
  ]);

  const shopifyByItem = new Map<string, number>();
  for (const group of groups) {
    for (const size of group.sizes) {
      shopifyByItem.set(size.inventoryItemId, size.quantity);
    }
  }

  const details: Drift[] = [];
  let missing = 0;

  for (const variant of linked) {
    const shopifyQty = shopifyByItem.get(variant.shopifyInventoryItemId!);

    // Linked here, gone there. Deleting a product's options destroys its
    // variants and mints new ids, so this is what a re-made product looks
    // like: the link points at something that no longer exists.
    if (shopifyQty === undefined) {
      missing += 1;
      continue;
    }

    if (shopifyQty !== variant.quantity) {
      details.push({
        product: variant.product.name,
        label: variant.label,
        local: variant.quantity,
        shopify: shopifyQty,
      });
    }
  }

  return { checked: linked.length, drifted: details.length, missing, details };
}

/** Run the comparison and record it, so the dashboard can report without calling Shopify. */
export async function recordReconcileRun() {
  try {
    const result = await reconcileStock();
    await prisma.reconcileRun.create({
      data: {
        checked: result.checked,
        drifted: result.drifted,
        missing: result.missing,
        details: result.details,
      },
    });
    return result;
  } catch (e) {
    // A failed run is itself worth recording. An empty absence looks identical
    // to "nothing was wrong", which is the opposite of what it means.
    const message = e instanceof Error ? e.message : "unknown error";
    await prisma.reconcileRun.create({
      data: { checked: 0, drifted: 0, missing: 0, error: message },
    });
    throw e;
  }
}
