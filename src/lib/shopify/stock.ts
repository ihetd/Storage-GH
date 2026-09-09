import { Prisma } from "@prisma/client";
import type { AdjustmentSource } from "@prisma/client";
import { prisma } from "@/lib/prisma";

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
