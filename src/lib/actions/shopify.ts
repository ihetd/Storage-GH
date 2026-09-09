"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { fetchShopifyGroups } from "@/lib/shopify/products";
import { matchSizes } from "@/lib/shopify/links";
import { ShopifyError } from "@/lib/shopify/client";
import type { FormState } from "./types";

const FIELD_PREFIX = "link:";

function revalidate() {
  revalidatePath("/dashboard/shopify");
  revalidatePath("/dashboard");
  revalidatePath("/");
}

/**
 * Save the whole product-to-Shopify mapping in one go.
 *
 * The form always submits every group, so this is a full replacement rather
 * than a patch: links are cleared and rewritten inside one transaction. That
 * avoids fighting the unique indexes when two groups swap products, and means
 * a half-applied save is impossible.
 */
export async function saveShopifyLinks(formData: FormData): Promise<FormState> {
  await requireRole(["ADMIN"]);

  // groupKey -> local product id. Empty value means "not linked".
  const mapping = new Map<string, string>();
  for (const [field, raw] of formData.entries()) {
    if (!field.startsWith(FIELD_PREFIX)) continue;
    const productId = String(raw);
    if (productId) mapping.set(field.slice(FIELD_PREFIX.length), productId);
  }

  // One local product cannot count stock for two different Shopify colours;
  // the database would reject the second write anyway, but a named error beats
  // a constraint violation.
  const seen = new Map<string, string>();
  for (const [groupKey, productId] of mapping) {
    const other = seen.get(productId);
    if (other) {
      return {
        error: `The same product is linked to two Shopify groups (${other} and ${groupKey}). Each product can only be linked once.`,
      };
    }
    seen.set(productId, groupKey);
  }

  let groups;
  try {
    groups = await fetchShopifyGroups();
  } catch (e) {
    if (e instanceof ShopifyError) return { error: e.message };
    throw e;
  }
  const groupByKey = new Map(groups.map((g) => [g.key, g]));

  for (const groupKey of mapping.keys()) {
    if (!groupByKey.has(groupKey)) {
      return {
        error: `"${groupKey}" no longer exists in Shopify. Reload the page and try again.`,
      };
    }
  }

  const products = await prisma.product.findMany({
    where: { id: { in: [...mapping.values()] } },
    select: { id: true, variants: { select: { id: true, label: true } } },
  });
  const productById = new Map(products.map((p) => [p.id, p]));

  for (const productId of mapping.values()) {
    if (!productById.has(productId)) return { error: "A selected product no longer exists." };
  }

  await prisma.$transaction(async (tx) => {
    // Wipe first. The form carries the complete state, so anything not
    // resubmitted is deliberately unlinked.
    await tx.product.updateMany({
      where: { shopifyProductId: { not: null } },
      data: { shopifyProductId: null, shopifyOptionValue: null },
    });
    await tx.productVariant.updateMany({
      where: { shopifyVariantId: { not: null } },
      data: { shopifyVariantId: null, shopifyInventoryItemId: null },
    });

    for (const [groupKey, productId] of mapping) {
      const group = groupByKey.get(groupKey)!;
      const product = productById.get(productId)!;

      await tx.product.update({
        where: { id: productId },
        data: {
          shopifyProductId: group.productId,
          shopifyOptionValue: group.optionValue,
        },
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
      }
    }
  });

  revalidate();
  return { ok: true };
}
