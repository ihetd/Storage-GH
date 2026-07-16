"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import type { ActionResult, FormState } from "./types";

// Parse a textarea / comma list into a clean, de-duplicated option list.
function parseOptions(raw: FormDataEntryValue | null): string[] {
  const text = String(raw ?? "");
  const seen = new Set<string>();
  const out: string[] = [];
  for (const piece of text.split(/[\n,]/)) {
    const v = piece.trim();
    if (v && !seen.has(v.toLowerCase())) {
      seen.add(v.toLowerCase());
      out.push(v);
    }
  }
  return out;
}

const schema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  attributeLabel: z.string().trim().min(1, "Attribute label is required").max(40),
  options: z.array(z.string().min(1)).min(1, "Add at least one option"),
});

function revalidate() {
  revalidatePath("/dashboard/variant-templates");
  revalidatePath("/dashboard/products");
}

export async function createVariantTemplate(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireRole(["ADMIN"]);

  const parsed = schema.safeParse({
    name: formData.get("name"),
    attributeLabel: formData.get("attributeLabel"),
    options: parseOptions(formData.get("options")),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  try {
    await prisma.variantTemplate.create({ data: parsed.data });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { error: "A template with that name already exists." };
    }
    throw e;
  }

  revalidate();
  return { ok: true };
}

export async function updateVariantTemplate(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireRole(["ADMIN"]);

  const id = String(formData.get("id") || "");
  if (!id) return { error: "Missing id" };

  const parsed = schema.safeParse({
    name: formData.get("name"),
    attributeLabel: formData.get("attributeLabel"),
    options: parseOptions(formData.get("options")),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  try {
    await prisma.variantTemplate.update({ where: { id }, data: parsed.data });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { error: "A template with that name already exists." };
    }
    throw e;
  }

  revalidate();
  return { ok: true };
}

export async function deleteVariantTemplate(id: string): Promise<ActionResult> {
  await requireRole(["ADMIN"]);
  // Products reference templates with onDelete: SetNull, so this is always safe.
  await prisma.variantTemplate.delete({ where: { id } });
  revalidate();
  return {};
}
