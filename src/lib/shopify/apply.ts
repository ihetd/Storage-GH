import { prisma } from "@/lib/prisma";
import { matchSizes } from "./links";
import type { ShopifyGroup } from "./products";

// The mapping write, separated from the server action wrapping it.
//
// Keeping this free of auth, FormData and revalidation means the part that
// actually moves ids into the database can be exercised directly, without a
// browser session. The action stays a thin shell: authorise, parse, fetch,
// call this, revalidate.

export type ApplyResult = { ok: true; linkedSizes: number } | { ok: false; error: string };

/** groupKey -> local product id. Absent or empty means "not linked". */
export type LinkMapping = Map<string, string>;

export async function applyShopifyLinks(
  mapping: LinkMapping,
  groups: ShopifyGroup[],
): Promise<ApplyResult> {
  const groupByKey = new Map(groups.map((g) => [g.key, g]));

  // One local product cannot count stock for two Shopify colours. The unique
  // index would reject the second write anyway, but a named error beats a
  // constraint violation surfacing as a 500.
  const seen = new Map<string, string>();
  for (const [groupKey, productId] of mapping) {
    if (!productId) continue;
    const other = seen.get(productId);
    if (other) {
      return {
        ok: false,
        error: `That product is already linked to another Shopify item (${other}). Each product can only be linked once.`,
      };
    }
    seen.set(productId, groupKey);
  }

  for (const [groupKey, productId] of mapping) {
    if (productId && !groupByKey.has(groupKey)) {
      return {
        ok: false,
        error: `"${groupKey}" no longer exists in Shopify. Reload the page and try again.`,
      };
    }
  }

  const wanted = [...mapping.values()].filter(Boolean);
  const products = await prisma.product.findMany({
    where: { id: { in: wanted } },
    select: { id: true, variants: { select: { id: true, label: true } } },
  });
  const productById = new Map(products.map((p) => [p.id, p]));
  for (const id of wanted) {
    if (!productById.has(id)) return { ok: false, error: "A selected product no longer exists." };
  }

  let linkedSizes = 0;

  await prisma.$transaction(async (tx) => {
    // Wipe then rewrite. The form carries the complete state, so anything not
    // resubmitted is deliberately unlinked — and clearing first is what lets
    // two products swap Shopify items without tripping the unique indexes.
    await tx.product.updateMany({
      where: { shopifyProductId: { not: null } },
      data: { shopifyProductId: null, shopifyOptionValue: null },
    });
    await tx.productVariant.updateMany({
      where: { shopifyVariantId: { not: null } },
      data: { shopifyVariantId: null, shopifyInventoryItemId: null },
    });

    for (const [groupKey, productId] of mapping) {
      if (!productId) continue;
      const group = groupByKey.get(groupKey)!;
      const product = productById.get(productId)!;

      await tx.product.update({
        where: { id: productId },
        data: { shopifyProductId: group.productId, shopifyOptionValue: group.optionValue },
      });

      for (const match of matchSizes(group.sizes, product.variants)) {
        if (match.status !== "linked") continue;
        await tx.productVariant.update({
          where: { id: match.local.id },
          data: {
            shopifyVariantId: match.shopify.variantId,
            shopifyInventoryItemId: match.shopify.inventoryItemId,
          },
        });
        linkedSizes += 1;
      }
    }
  });

  return { ok: true, linkedSizes };
}
