import { prisma } from "@/lib/prisma";
import { getShopifyConfig, inventoryItemGid, locationGid } from "./config";
import { shopifyGraphQL } from "./client";

// Sending a local stock change up to Shopify — the mirror of the webhook.
//
// A delta rather than an absolute quantity, so "we received two more" means the
// same thing whatever Shopify's count happens to be. But Shopify also demands
// changeFromQuantity: the count we believe is there before the delta lands. If
// a customer buys in the same moment, the push is rejected instead of quietly
// interleaving, and we read the new figure and try again. Louder and more
// correct than either a blind delta or an absolute overwrite.
//
// Nothing here throws. It runs from after(), where a rejected promise helps
// nobody and would never reach the person who clicked the button.

const READ_QUERY = `
  query CurrentStock($item: ID!, $location: ID!) {
    inventoryItem(id: $item) {
      inventoryLevel(locationId: $location) {
        quantities(names: ["available"]) { quantity }
      }
    }
  }
`;

const PUSH_MUTATION = `
  mutation PushStock($input: InventoryAdjustQuantitiesInput!, $key: String!) {
    inventoryAdjustQuantities(input: $input) @idempotent(key: $key) {
      inventoryAdjustmentGroup { createdAt }
      userErrors { field message }
    }
  }
`;

type ReadResponse = {
  inventoryItem: {
    inventoryLevel: { quantities: { quantity: number }[] } | null;
  } | null;
};

/**
 * What Shopify currently believes is available at the configured location.
 * Null when it has no stock level there at all.
 */
export async function readShopifyQuantity(inventoryItemId: string): Promise<number | null> {
  const config = getShopifyConfig();
  if (!config) return null;
  const data = await shopifyGraphQL<ReadResponse>(READ_QUERY, {
    item: inventoryItemGid(inventoryItemId),
    location: locationGid(config.locationId),
  });
  return data.inventoryItem?.inventoryLevel?.quantities?.[0]?.quantity ?? null;
}

/** How many times to re-read and retry when a concurrent sale moves the count. */
const COMPARE_ATTEMPTS = 3;

type PushResponse = {
  inventoryAdjustQuantities: {
    inventoryAdjustmentGroup: { createdAt: string } | null;
    userErrors: { field: string[] | null; message: string }[];
  };
};

export type PushOutcome =
  | { status: "pushed" }
  | { status: "skipped"; reason: string }
  | { status: "failed"; reason: string };

/**
 * Push the change recorded by one StockAdjustment up to Shopify.
 *
 * Takes an id rather than a delta so the caller cannot accidentally push
 * something that was never written locally, and so the adjustment's own id
 * becomes the idempotency key: if this runs twice — a retried request, a
 * double-invoked after() — Shopify applies it once.
 */
export async function pushAdjustmentToShopify(adjustmentId: string): Promise<PushOutcome> {
  const config = getShopifyConfig();
  if (!config) return { status: "skipped", reason: "Shopify not configured" };

  try {
    const adjustment = await prisma.stockAdjustment.findUnique({
      where: { id: adjustmentId },
      select: {
        delta: true,
        source: true,
        productVariant: { select: { shopifyInventoryItemId: true, label: true } },
      },
    });

    if (!adjustment) return { status: "skipped", reason: "adjustment not found" };

    // The echo guard. A change that arrived from Shopify has already been
    // applied there — Shopify decrements its own stock on a sale — so pushing
    // it back would double-count it and, worse, start the two systems chasing
    // each other. Callers only pass local changes, but this is the check that
    // makes that a fact rather than a convention.
    if (adjustment.source !== "MANUAL" && adjustment.source !== "ADMIN_EDIT") {
      return { status: "skipped", reason: `source is ${adjustment.source}` };
    }

    const inventoryItemId = adjustment.productVariant.shopifyInventoryItemId;
    if (!inventoryItemId) {
      // Not an error: plenty of stock is not sold online at all.
      return { status: "skipped", reason: "variant is not linked to Shopify" };
    }

    if (adjustment.delta === 0) return { status: "skipped", reason: "no change" };

    const item = inventoryItemGid(inventoryItemId);
    const location = locationGid(config.locationId);
    let lastReason = "";

    for (let attempt = 1; attempt <= COMPARE_ATTEMPTS; attempt += 1) {
      const current = await shopifyGraphQL<ReadResponse>(READ_QUERY, { item, location });
      const available = current.inventoryItem?.inventoryLevel?.quantities?.[0]?.quantity;
      if (available === undefined) {
        return { status: "failed", reason: "Shopify reports no stock level at this location" };
      }

      const data = await shopifyGraphQL<PushResponse>(PUSH_MUTATION, {
        // The adjustment's own id, held constant across attempts: a compare
        // failure applied nothing, so retrying under the same key is still one
        // logical change, and a genuine second push of the same adjustment is
        // still refused.
        key: adjustmentId,
        input: {
          name: "available",
          reason: "correction",
          referenceDocumentUri: `https://storage-gh.vercel.app/adjustments/${adjustmentId}`,
          changes: [
            {
              delta: adjustment.delta,
              changeFromQuantity: available,
              inventoryItemId: item,
              locationId: location,
            },
          ],
        },
      });

      const errors = data.inventoryAdjustQuantities.userErrors;
      if (errors.length === 0) return { status: "pushed" };

      lastReason = errors.map((e) => e.message).join("; ");

      // Shopify refusing a reused idempotency key means this adjustment has
      // already been applied — the desired outcome, not a failure. It surfaces
      // as an error about mismatched parameters because the compare quantity
      // has moved on since the original call. Reporting it as failed would put
      // an error in the log for every retry and bury the real ones.
      if (/idempotency key/i.test(lastReason)) {
        return { status: "skipped", reason: "already pushed" };
      }

      // A stale compare means someone changed the count between our read and
      // our write — almost always a sale. Read again and reapply; the delta is
      // still the right change to make.
      const stale = /quantity|changed|stale|conflict/i.test(lastReason);
      if (!stale || attempt === COMPARE_ATTEMPTS) break;
    }

    console.error(`[shopify] push ${adjustmentId} rejected: ${lastReason}`);
    return { status: "failed", reason: lastReason };
  } catch (e) {
    const reason = e instanceof Error ? e.message : "unknown error";
    console.error(`[shopify] push ${adjustmentId} failed: ${reason}`);
    return { status: "failed", reason };
  }
}

/** Push several adjustments, one product edit's worth. Sequential: small batches. */
export async function pushAdjustmentsToShopify(ids: string[]): Promise<void> {
  for (const id of ids) await pushAdjustmentToShopify(id);
}

const SET_MUTATION = `
  mutation SetStock($input: InventorySetQuantitiesInput!, $key: String!) {
    inventorySetQuantities(input: $input) @idempotent(key: $key) {
      inventoryAdjustmentGroup { createdAt }
      userErrors { field message }
    }
  }
`;

type SetResponse = {
  inventorySetQuantities: {
    inventoryAdjustmentGroup: { createdAt: string } | null;
    userErrors: { field: string[] | null; message: string }[];
  };
};

/**
 * Set Shopify's count to an exact number, rather than moving it by a delta.
 *
 * This exists only to close a gap the deltas cannot. A delta keeps the two
 * systems in step but preserves any difference already between them: take one
 * off each and they are still one apart. Something has to be able to say "make
 * it this number", and that is a different Shopify operation.
 *
 * Reserved for a human deciding a drift, never used by the automatic sync,
 * because an absolute write is exactly what loses a sale that lands in the same
 * moment. changeFromQuantity guards against that as far as it can — if the
 * count moved since we read it, this is refused rather than overwriting.
 */
export async function setShopifyQuantity(
  inventoryItemId: string,
  quantity: number,
): Promise<PushOutcome> {
  const config = getShopifyConfig();
  if (!config) return { status: "skipped", reason: "Shopify not configured" };

  try {
    const item = inventoryItemGid(inventoryItemId);
    const location = locationGid(config.locationId);

    const current = await shopifyGraphQL<ReadResponse>(READ_QUERY, { item, location });
    const available = current.inventoryItem?.inventoryLevel?.quantities?.[0]?.quantity;
    if (available === undefined) {
      return { status: "failed", reason: "Shopify reports no stock level at this location" };
    }
    if (available === quantity) return { status: "skipped", reason: "already matches" };

    const data = await shopifyGraphQL<SetResponse>(SET_MUTATION, {
      // Derived from the state rather than the clock: the same correction
      // attempted twice from the same starting point is one logical change and
      // is applied once, while a genuine second correction — different before
      // or after — gets its own key and goes through.
      key: `fix:${inventoryItemId}:${available}:${quantity}`,
      input: {
        name: "available",
        reason: "correction",
        quantities: [
          {
            inventoryItemId: item,
            locationId: location,
            quantity,
            changeFromQuantity: available,
          },
        ],
      },
    });

    const errors = data.inventorySetQuantities.userErrors;
    if (errors.length > 0) {
      const reason = errors.map((e) => e.message).join("; ");
      console.error(`[shopify] set ${inventoryItemId} to ${quantity} rejected: ${reason}`);
      return { status: "failed", reason };
    }
    return { status: "pushed" };
  } catch (e) {
    const reason = e instanceof Error ? e.message : "unknown error";
    console.error(`[shopify] set ${inventoryItemId} failed: ${reason}`);
    return { status: "failed", reason };
  }
}
