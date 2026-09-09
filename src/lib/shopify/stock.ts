import { Prisma } from "@prisma/client";
import type { AdjustmentSource } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { readShopifyQuantity } from "./push";

// Applying a stock change that came from Shopify.
//
// Two things make this different from the +/- buttons. There is no human
// author, so the audit row records a source instead of a user. And Shopify
// redelivers webhooks freely, so the same order can arrive several times and
// must only count once.

export type StockChange = { shopifyVariantId: string; delta: number };

export type ApplyOutcome = {
  applied: { label: string; delta: number; quantity: number; clamped: boolean }[];
  /** Already counted — a redelivery of a webhook we have seen. */
  duplicates: string[];
  /** Sold on Shopify with no local row linked. Silent stock drift lives here. */
  unknown: string[];
};

type UpdatedRow = { id: string; label: string; before: number; after: number };

/**
 * Apply each change atomically and idempotently.
 *
 * One transaction per line rather than one for the whole order, so a
 * redelivered order that partly overlaps a previous one still counts the new
 * lines. Inside a transaction the quantity update and the audit insert stand or
 * fall together: if the unique index on (externalRef, productVariantId)
 * rejects the insert, the update rolls back with it and the quantity is
 * untouched. That is the whole double-count defence, and it lives in the
 * database rather than in this code.
 */
export async function applyShopifyStockChanges(
  changes: StockChange[],
  source: AdjustmentSource,
  externalRef: string,
): Promise<ApplyOutcome> {
  const outcome: ApplyOutcome = { applied: [], duplicates: [], unknown: [] };

  for (const change of changes) {
    if (change.delta === 0) continue;

    try {
      const row = await prisma.$transaction(async (tx) => {
        // GREATEST floors at zero: Shopify has already sold the item, so
        // refusing the change would only make this app disagree with reality
        // and make Shopify retry for two days. The subquery takes the row lock
        // and gives us the previous value, so a clamp is visible rather than
        // silent.
        const rows = await tx.$queryRaw<UpdatedRow[]>`
          UPDATE "ProductVariant" AS v
          SET quantity = GREATEST(0, v.quantity + ${change.delta}),
              "updatedAt" = NOW()
          FROM (
            SELECT id, quantity FROM "ProductVariant"
            WHERE "shopifyVariantId" = ${change.shopifyVariantId}
            FOR UPDATE
          ) AS old
          WHERE v.id = old.id
          RETURNING v.id, v.label, old.quantity AS "before", v.quantity AS "after"
        `;

        if (rows.length === 0) return null;
        const updated = rows[0];

        await tx.stockAdjustment.create({
          data: {
            productVariantId: updated.id,
            userId: null,
            delta: change.delta,
            resultingQty: updated.after,
            source,
            externalRef,
          },
        });

        return updated;
      });

      if (!row) {
        outcome.unknown.push(change.shopifyVariantId);
        continue;
      }

      outcome.applied.push({
        label: row.label,
        delta: change.delta,
        quantity: row.after,
        clamped: row.after - row.before !== change.delta,
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        outcome.duplicates.push(change.shopifyVariantId);
        continue;
      }
      throw e;
    }
  }

  return outcome;
}

/**
 * Set the given variants to whatever Shopify says they hold now.
 *
 * Used for cancellations and refunds rather than adding the quantity back.
 *
 * Cancelling one order makes Shopify send *two* webhooks — orders/cancelled and
 * refunds/create — describing the same physical restock. Adding a delta for
 * each put two items back for one cancelled item. They carry different ids, so
 * they do not look like duplicates to the retry guard; they are different
 * events about one event in the world.
 *
 * Following Shopify's own count instead makes that harmless: applying it twice
 * lands on the same number. It also fixes a second bug for free — cancelling
 * with "restock inventory" unticked leaves Shopify's count down, and adding
 * stock back here would have invented items that were never returned. Shopify
 * decides whether a cancellation restocks, so Shopify is what to follow.
 */
export async function syncVariantsFromShopify(
  shopifyVariantIds: string[],
  source: AdjustmentSource,
  externalRef: string,
): Promise<ApplyOutcome> {
  const outcome: ApplyOutcome = { applied: [], duplicates: [], unknown: [] };

  for (const shopifyVariantId of shopifyVariantIds) {
    const variant = await prisma.productVariant.findUnique({
      where: { shopifyVariantId },
      select: { id: true, label: true, quantity: true, shopifyInventoryItemId: true },
    });

    if (!variant?.shopifyInventoryItemId) {
      outcome.unknown.push(shopifyVariantId);
      continue;
    }

    const target = await readShopifyQuantity(variant.shopifyInventoryItemId);
    if (target === null) {
      outcome.unknown.push(shopifyVariantId);
      continue;
    }

    const delta = target - variant.quantity;
    // Already agrees — the usual case for the second of the two webhooks.
    if (delta === 0) {
      outcome.duplicates.push(shopifyVariantId);
      continue;
    }

    try {
      await prisma.$transaction(async (tx) => {
        await tx.productVariant.update({
          where: { id: variant.id },
          data: { quantity: target },
        });
        await tx.stockAdjustment.create({
          data: {
            productVariantId: variant.id,
            userId: null,
            delta,
            resultingQty: target,
            source,
            externalRef,
          },
        });
      });
      outcome.applied.push({ label: variant.label, delta, quantity: target, clamped: false });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        outcome.duplicates.push(shopifyVariantId);
        continue;
      }
      throw e;
    }
  }

  return outcome;
}
