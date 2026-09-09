"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { pushAdjustmentToShopify } from "@/lib/shopify/push";
import type { ActionResult, FormState } from "./types";

// Stock on order but not yet arrived.
//
// Scheduled items are never part of a count. Receiving is what turns one into
// stock, and it goes through the same adjustment path as the +/- buttons so it
// is audited and pushed to Shopify like any other change.

const schema = z.object({
  productVariantId: z.string().min(1, "Pick a product and size"),
  quantity: z.coerce.number().int().min(1, "How many are coming?").max(1_000_000),
  expectedAt: z.string().optional(),
  note: z.string().trim().max(200).optional(),
});

function revalidate() {
  revalidatePath("/dashboard/scheduled");
  revalidatePath("/dashboard");
  revalidatePath("/");
}

export async function createScheduledItem(formData: FormData): Promise<FormState> {
  const admin = await requireRole(["ADMIN"]);

  const parsed = schema.safeParse({
    productVariantId: formData.get("productVariantId"),
    quantity: formData.get("quantity"),
    expectedAt: formData.get("expectedAt") || undefined,
    note: formData.get("note") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { productVariantId, quantity, expectedAt, note } = parsed.data;

  const variant = await prisma.productVariant.findUnique({
    where: { id: productVariantId },
    select: { id: true },
  });
  if (!variant) return { error: "That product size no longer exists." };

  // A date-only input has no timezone; anchoring it to midday avoids a
  // delivery due "tomorrow" displaying as today in a westward offset.
  let due: Date | null = null;
  if (expectedAt) {
    const parsedDate = new Date(`${expectedAt}T12:00:00`);
    if (Number.isNaN(parsedDate.getTime())) return { error: "That date could not be read." };
    due = parsedDate;
  }

  await prisma.scheduledItem.create({
    data: {
      productVariantId,
      quantity,
      expectedAt: due,
      note: note || null,
      createdById: admin.id,
    },
  });

  revalidate();
  return { ok: true };
}

export async function deleteScheduledItem(id: string): Promise<ActionResult> {
  await requireRole(["ADMIN"]);
  // Deleting a scheduled item touches no stock — it never counted for
  // anything, so a cancelled order from a supplier just goes away.
  await prisma.scheduledItem.deleteMany({ where: { id, receivedAt: null } });
  revalidate();
  return {};
}

/**
 * Take delivery: add the quantity to the count and mark the item received.
 *
 * The update is conditional on it still being unreceived, so two people
 * pressing Receive at the same moment add the stock once. That guard is the
 * whole reason this is a transaction.
 */
export async function receiveScheduledItem(id: string): Promise<ActionResult> {
  const admin = await requireRole(["ADMIN"]);

  const adjustmentId = await prisma.$transaction(async (tx) => {
    const claimed = await tx.scheduledItem.updateMany({
      where: { id, receivedAt: null },
      data: { receivedAt: new Date() },
    });
    // Someone else got there first.
    if (claimed.count === 0) return null;

    const item = await tx.scheduledItem.findUniqueOrThrow({
      where: { id },
      select: { productVariantId: true, quantity: true },
    });

    const [variant] = await tx.productVariant.updateManyAndReturn({
      where: { id: item.productVariantId },
      data: { quantity: { increment: item.quantity } },
      select: { quantity: true },
    });

    const adjustment = await tx.stockAdjustment.create({
      data: {
        productVariantId: item.productVariantId,
        userId: admin.id,
        delta: item.quantity,
        resultingQty: variant.quantity,
        source: "ADMIN_EDIT",
      },
      select: { id: true },
    });
    return adjustment.id;
  });

  if (adjustmentId) {
    after(() => pushAdjustmentToShopify(adjustmentId));
  }

  revalidate();
  return {};
}
