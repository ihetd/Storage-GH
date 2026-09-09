"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { pushAdjustmentsToShopify } from "@/lib/shopify/push";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { deleteFromR2 } from "@/lib/r2";
import type { ActionResult, FormState } from "./types";

const variantSchema = z.object({
  id: z.string().optional(),
  label: z.string().trim().min(1, "Variant label required").max(40),
  quantity: z.coerce.number().int().min(0).max(1_000_000),
});

const productSchema = z.object({
  name: z.string().trim().min(1, "Product name is required").max(120),
  categoryId: z.string().min(1, "Pick a category"),
  attributeLabel: z.string().trim().min(1).max(40),
  variantTemplateId: z.string().optional().nullable(),
  imageUrl: z.string().url().optional().nullable(),
  imageKey: z.string().optional().nullable(),
});

type ParsedInput = z.infer<typeof productSchema> & {
  variants: z.infer<typeof variantSchema>[];
};

function parse(formData: FormData): { data?: ParsedInput; error?: string } {
  const base = productSchema.safeParse({
    name: formData.get("name"),
    categoryId: formData.get("categoryId"),
    attributeLabel: formData.get("attributeLabel") || "Size",
    variantTemplateId: formData.get("variantTemplateId") || null,
    imageUrl: formData.get("imageUrl") || null,
    imageKey: formData.get("imageKey") || null,
  });
  if (!base.success) {
    return { error: base.error.issues[0]?.message ?? "Invalid input" };
  }

  let rawVariants: unknown;
  try {
    rawVariants = JSON.parse(String(formData.get("variants") || "[]"));
  } catch {
    return { error: "Could not read variants." };
  }
  const variants = z.array(variantSchema).safeParse(rawVariants);
  if (!variants.success) {
    return { error: variants.error.issues[0]?.message ?? "Invalid variants" };
  }
  if (variants.data.length === 0) {
    return { error: "Add at least one variant." };
  }
  // Reject duplicate labels within the submission.
  const labels = variants.data.map((v) => v.label.toLowerCase());
  if (new Set(labels).size !== labels.length) {
    return { error: "Variant labels must be unique." };
  }

  return { data: { ...base.data, variants: variants.data } };
}

function revalidate() {
  revalidatePath("/dashboard/scheduled");
  revalidatePath("/dashboard/products");
  revalidatePath("/");
}

export async function createProduct(
  formData: FormData,
): Promise<FormState> {
  await requireRole(["ADMIN"]);

  const { data, error } = parse(formData);
  if (!data) return { error };

  // Set by the Scheduled tab's form. A scheduled product is ordinary in every
  // way except that it stays out of the stock screens until it arrives.
  const scheduled = formData.get("scheduled") === "true";

  try {
    await prisma.product.create({
      data: {
        name: data.name,
        categoryId: data.categoryId,
        attributeLabel: data.attributeLabel,
        variantTemplateId: data.variantTemplateId || null,
        imageUrl: data.imageUrl || null,
        imageKey: data.imageKey || null,
        scheduled,
        variants: {
          create: data.variants.map((v, i) => ({
            label: v.label,
            quantity: v.quantity,
            sortOrder: i,
          })),
        },
      },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { error: "Variant labels must be unique." };
    }
    throw e;
  }

  revalidate();
  redirect(scheduled ? "/dashboard/scheduled" : "/dashboard/products");
}

export async function updateProduct(
  formData: FormData,
): Promise<FormState> {
  const admin = await requireRole(["ADMIN"]);

  const productId = String(formData.get("id") || "");
  if (!productId) return { error: "Missing id" };

  const { data, error } = parse(formData);
  if (!data) return { error };

  // These two reads are independent — fetch them concurrently.
  const [before, existing] = await Promise.all([
    // For image cleanup: the old R2 key, if the image was replaced or removed.
    prisma.product.findUnique({
      where: { id: productId },
      select: { imageKey: true },
    }),
    prisma.productVariant.findMany({
      where: { productId },
      select: { id: true, quantity: true },
    }),
  ]);
  if (!before) return { error: "Product not found" };
  const oldImageKey =
    before.imageKey && before.imageKey !== (data.imageKey || null)
      ? before.imageKey
      : null;

  const submittedIds = new Set(
    data.variants.filter((v) => v.id).map((v) => v.id as string),
  );
  const toDelete = existing
    .filter((e) => !submittedIds.has(e.id))
    .map((e) => e.id);

  // Quantities the form is about to overwrite, so a change here can be
  // described as a delta rather than a silent replacement.
  const quantityBefore = new Map(existing.map((v) => [v.id, v.quantity]));

  let adjustmentIds: string[] = [];

  try {
    adjustmentIds = await prisma.$transaction(async (tx) => {
      // Remove variants the admin deleted (cascades their adjustments).
      await tx.productVariant.deleteMany({ where: { id: { in: toDelete } } });

      await tx.product.update({
        where: { id: productId },
        data: {
          name: data.name,
          categoryId: data.categoryId,
          attributeLabel: data.attributeLabel,
          variantTemplateId: data.variantTemplateId || null,
          imageUrl: data.imageUrl || null,
          imageKey: data.imageKey || null,
        },
      });

      const created: string[] = [];

      for (const [i, v] of data.variants.entries()) {
        if (!v.id) {
          await tx.productVariant.create({
            data: { productId, label: v.label, quantity: v.quantity, sortOrder: i },
          });
          continue;
        }

        await tx.productVariant.update({
          where: { id: v.id },
          data: { label: v.label, quantity: v.quantity, sortOrder: i },
        });

        // This form used to overwrite quantities silently and unaudited, which
        // made an edit indistinguishable from a sale and invisible to the
        // Shopify push. Recording the difference costs one row and makes both
        // work.
        const previous = quantityBefore.get(v.id);
        if (previous === undefined || previous === v.quantity) continue;

        const adjustment = await tx.stockAdjustment.create({
          data: {
            productVariantId: v.id,
            userId: admin.id,
            delta: v.quantity - previous,
            resultingQty: v.quantity,
            source: "ADMIN_EDIT",
          },
          select: { id: true },
        });
        created.push(adjustment.id);
      }

      return created;
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { error: "Variant labels must be unique." };
    }
    throw e;
  }

  // Same reasoning as the +/- buttons: mirror to Shopify after the response,
  // never blocking the redirect on an external call.
  if (adjustmentIds.length > 0) {
    after(() => pushAdjustmentsToShopify(adjustmentIds));
  }

  // Only after the DB update succeeded — never delete the object out from
  // under a product that failed to save. Best-effort cleanup: run it after the
  // response so the external R2 call doesn't delay the redirect.
  after(() => deleteFromR2(oldImageKey));

  revalidate();
  redirect("/dashboard/products");
}

export async function deleteProduct(id: string): Promise<ActionResult> {
  await requireRole(["ADMIN"]);
  // Cascade removes variants and their stock adjustments.
  const deleted = await prisma.product.delete({
    where: { id },
    select: { imageKey: true },
  });
  // Best-effort R2 cleanup after the response — don't make the UI wait on it.
  after(() => deleteFromR2(deleted.imageKey));
  revalidate();
  return {};
}

/**
 * Move a scheduled product into stock.
 *
 * The delivery has arrived, so the product stops being hidden and starts
 * counting. Its quantities were entered when it was scheduled and are already
 * right, so nothing about the numbers changes here — which is why this writes
 * no adjustment. The stock did not move; it became visible.
 *
 * Nothing is pushed to Shopify either: an unlinked product has nowhere to push
 * to, and linking it is the deliberate next step on the Shopify tab.
 */
export async function receiveScheduledProduct(id: string): Promise<ActionResult> {
  await requireRole(["ADMIN"]);

  const updated = await prisma.product.updateMany({
    where: { id, scheduled: true },
    data: { scheduled: false },
  });
  if (updated.count === 0) return { error: "That product is already in stock." };

  revalidate();
  return {};
}

/** Put a product back on the scheduled list, out of the stock screens. */
export async function unreceiveProduct(id: string): Promise<ActionResult> {
  await requireRole(["ADMIN"]);
  await prisma.product.updateMany({ where: { id, scheduled: false }, data: { scheduled: true } });
  revalidate();
  return {};
}
