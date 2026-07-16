"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import type { ActionResult, FormState } from "./types";

const schema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  sortOrder: z.coerce.number().int().min(0).max(9999).default(0),
});

function revalidate() {
  revalidatePath("/dashboard/categories");
  revalidatePath("/dashboard/products");
  revalidatePath("/");
}

export async function createCategory(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireRole(["ADMIN"]);

  const parsed = schema.safeParse({
    name: formData.get("name"),
    sortOrder: formData.get("sortOrder") || 0,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  try {
    await prisma.category.create({ data: parsed.data });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { error: "A category with that name already exists." };
    }
    throw e;
  }

  revalidate();
  return { ok: true };
}

export async function updateCategory(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireRole(["ADMIN"]);

  const id = String(formData.get("id") || "");
  if (!id) return { error: "Missing id" };

  const parsed = schema.safeParse({
    name: formData.get("name"),
    sortOrder: formData.get("sortOrder") || 0,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  try {
    await prisma.category.update({ where: { id }, data: parsed.data });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { error: "A category with that name already exists." };
    }
    throw e;
  }

  revalidate();
  return { ok: true };
}

export async function deleteCategory(id: string): Promise<ActionResult> {
  await requireRole(["ADMIN"]);

  try {
    await prisma.category.delete({ where: { id } });
  } catch (e) {
    // FK restrict: category still has products.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2003") {
      return {
        error: "Can't delete a category that still has products.",
      };
    }
    throw e;
  }

  revalidate();
  return {};
}
