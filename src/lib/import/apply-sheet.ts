import { prisma } from "@/lib/prisma";
import type { ProductGroup } from "./parse-sheet";

// Turning parsed rows into products, categories and stock.
//
// Separate from parsing so a sheet is fully understood before anything is
// written, and separate from the action so it can be exercised without a
// session.

/**
 * What a sheet's quantity column means.
 *
 * "replace" treats the sheet as a stocktake — this is what we have now.
 * "add" treats it as a delivery note — this is what arrived today.
 *
 * The distinction has to be a choice rather than a guess: importing a delivery
 * as a stocktake quietly throws away everything already on the shelf.
 */
export type QuantityMode = "replace" | "add";

export type ImportPlan = {
  newProducts: number;
  updatedProducts: number;
  newVariants: number;
  updatedVariants: number;
  newCategories: string[];
  /** Products that would be created but name no category. */
  missingCategory: string[];
};

export type ImportResult = ImportPlan & {
  adjustmentIds: string[];
  imageFailures: string[];
};

const DEFAULT_ATTRIBUTE = "Size";

function sameName(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/**
 * Work out what an import would do, without doing it.
 *
 * The preview and the import read the same function, so what someone approves
 * is what runs — a preview computed by different code is a preview that can
 * disagree with reality.
 */
export async function planImport(groups: ProductGroup[]): Promise<ImportPlan> {
  const [products, categories] = await Promise.all([
    prisma.product.findMany({
      select: { id: true, name: true, variants: { select: { label: true } } },
    }),
    prisma.category.findMany({ select: { name: true } }),
  ]);

  const plan: ImportPlan = {
    newProducts: 0,
    updatedProducts: 0,
    newVariants: 0,
    updatedVariants: 0,
    newCategories: [],
    missingCategory: [],
  };

  const knownCategories = new Set(categories.map((c) => c.name.trim().toLowerCase()));
  const pendingCategories = new Set<string>();

  for (const group of groups) {
    const existing = products.find((p) => sameName(p.name, group.name));

    if (existing) {
      plan.updatedProducts += 1;
      const labels = new Set(existing.variants.map((v) => v.label.trim().toLowerCase()));
      for (const v of group.variants) {
        if (labels.has(v.label.trim().toLowerCase())) plan.updatedVariants += 1;
        else plan.newVariants += 1;
      }
    } else {
      plan.newProducts += 1;
      plan.newVariants += group.variants.length;
      if (!group.category) {
        plan.missingCategory.push(group.name);
        continue;
      }
    }

    const cat = group.category.trim().toLowerCase();
    if (cat && !knownCategories.has(cat) && !pendingCategories.has(cat)) {
      pendingCategories.add(cat);
      plan.newCategories.push(group.category.trim());
    }
  }

  return plan;
}

async function categoryIdFor(name: string): Promise<string> {
  const existing = await prisma.category.findFirst({
    where: { name: { equals: name.trim(), mode: "insensitive" } },
    select: { id: true },
  });
  if (existing) return existing.id;
  const created = await prisma.category.create({
    data: { name: name.trim() },
    select: { id: true },
  });
  return created.id;
}

/**
 * Apply the sheet.
 *
 * Every quantity change writes a StockAdjustment, for two reasons: an import is
 * as much a stock movement as pressing +, and only an adjustment gives the
 * Shopify push something to send. Their ids come back so the caller can push
 * them after responding.
 */
export async function applyImport(
  groups: ProductGroup[],
  mode: QuantityMode,
  userId: string,
  uploadImage: (url: string) => Promise<{ imageUrl: string; imageKey: string } | null>,
): Promise<ImportResult> {
  const result: ImportResult = {
    ...(await planImport(groups)),
    adjustmentIds: [],
    imageFailures: [],
  };

  for (const group of groups) {
    let product = await prisma.product.findFirst({
      where: { name: { equals: group.name.trim(), mode: "insensitive" } },
      select: { id: true, imageUrl: true },
    });

    // A photo is a nicety; failing to fetch one must not cost the import.
    let image: { imageUrl: string; imageKey: string } | null = null;
    if (group.imageUrl && !product?.imageUrl) {
      try {
        image = await uploadImage(group.imageUrl);
        if (!image) result.imageFailures.push(`${group.name}: image could not be fetched`);
      } catch {
        result.imageFailures.push(`${group.name}: image could not be fetched`);
      }
    }

    if (!product) {
      if (!group.category) continue; // reported by the plan as missingCategory
      const categoryId = await categoryIdFor(group.category);
      product = await prisma.product.create({
        data: {
          name: group.name.trim(),
          categoryId,
          attributeLabel: DEFAULT_ATTRIBUTE,
          imageUrl: image?.imageUrl ?? null,
          imageKey: image?.imageKey ?? null,
        },
        select: { id: true, imageUrl: true },
      });
    } else if (image) {
      await prisma.product.update({
        where: { id: product.id },
        data: { imageUrl: image.imageUrl, imageKey: image.imageKey },
      });
    }

    for (const [i, v] of group.variants.entries()) {
      const existing = await prisma.productVariant.findFirst({
        where: { productId: product.id, label: { equals: v.label.trim(), mode: "insensitive" } },
        select: { id: true, quantity: true },
      });

      if (!existing) {
        const created = await prisma.productVariant.create({
          data: {
            productId: product.id,
            label: v.label.trim(),
            quantity: v.quantity,
            sortOrder: i,
          },
          select: { id: true },
        });
        // A new row starting above zero is stock arriving, and the Shopify side
        // needs to hear about it like any other change.
        if (v.quantity > 0) {
          const adjustment = await prisma.stockAdjustment.create({
            data: {
              productVariantId: created.id,
              userId,
              delta: v.quantity,
              resultingQty: v.quantity,
              source: "ADMIN_EDIT",
            },
            select: { id: true },
          });
          result.adjustmentIds.push(adjustment.id);
        }
        continue;
      }

      const target = mode === "add" ? existing.quantity + v.quantity : v.quantity;
      const delta = target - existing.quantity;
      if (delta === 0) continue;

      await prisma.$transaction(async (tx) => {
        await tx.productVariant.update({
          where: { id: existing.id },
          data: { quantity: target },
        });
        const adjustment = await tx.stockAdjustment.create({
          data: {
            productVariantId: existing.id,
            userId,
            delta,
            resultingQty: target,
            source: "ADMIN_EDIT",
          },
          select: { id: true },
        });
        result.adjustmentIds.push(adjustment.id);
      });
    }
  }

  return result;
}
