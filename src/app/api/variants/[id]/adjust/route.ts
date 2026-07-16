import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireApiRole } from "@/lib/rbac";

const bodySchema = z.object({
  delta: z.union([z.literal(1), z.literal(-1)]),
});

// POST /api/variants/:id/adjust  { delta: 1 | -1 }
// ADMIN/EDITOR only. Atomic, guarded so stock never goes below 0 and concurrent
// clicks can't lose updates. Records a StockAdjustment audit row.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const gate = await requireApiRole(["ADMIN", "EDITOR"]);
  if (gate instanceof NextResponse) return gate;
  const { user } = gate;

  const { id } = await params;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Body must be { delta: 1 | -1 }" },
      { status: 400 },
    );
  }
  const { delta } = parsed.data;

  // Does the variant exist at all? (distinguishes 404 from a floor violation)
  const exists = await prisma.productVariant.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!exists) {
    return NextResponse.json({ error: "Variant not found" }, { status: 404 });
  }

  // The WHERE clause is the atomic gate: quantity + delta >= 0  <=>  quantity >= max(0, -delta).
  // Two concurrent "-1" on quantity=1 → exactly one satisfies the guard.
  const resultingQty = await prisma.$transaction(async (tx) => {
    const res = await tx.productVariant.updateMany({
      where: { id, quantity: { gte: Math.max(0, -delta) } },
      data: { quantity: { increment: delta } },
    });
    if (res.count === 0) return null;

    const updated = await tx.productVariant.findUniqueOrThrow({
      where: { id },
      select: { quantity: true },
    });
    await tx.stockAdjustment.create({
      data: {
        productVariantId: id,
        userId: user.id,
        delta,
        resultingQty: updated.quantity,
      },
    });
    return updated.quantity;
  });

  if (resultingQty === null) {
    return NextResponse.json(
      { error: "Stock can't go below zero." },
      { status: 409 },
    );
  }

  return NextResponse.json({ id, quantity: resultingQty });
}
