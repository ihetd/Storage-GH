"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import type { ActionResult, FormState } from "./types";

const baseSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, "Username must be at least 3 characters")
    .max(40)
    .regex(/^[a-zA-Z0-9._-]+$/, "Letters, numbers, . _ - only"),
  name: z.string().trim().min(1, "Name is required").max(80),
  role: z.enum(["ADMIN", "EDITOR", "VIEWER"]),
  active: z.boolean(),
});

function revalidate() {
  revalidatePath("/dashboard/employees");
}

// Guard against removing the last usable admin (would lock everyone out).
async function wouldRemoveLastAdmin(
  userId: string,
  nextRole: string,
  nextActive: boolean,
): Promise<boolean> {
  const activeAdmins = await prisma.user.findMany({
    where: { role: "ADMIN", active: true },
    select: { id: true },
  });
  const stillAdmin = nextRole === "ADMIN" && nextActive;
  if (stillAdmin) return false;
  // This user is being demoted/deactivated. Are there other active admins left?
  const others = activeAdmins.filter((a) => a.id !== userId);
  return others.length === 0;
}

export async function createEmployee(
  formData: FormData,
): Promise<FormState> {
  await requireRole(["ADMIN"]);

  const parsed = baseSchema
    .extend({
      password: z.string().min(6, "Password must be at least 6 characters"),
    })
    .safeParse({
      username: formData.get("username"),
      name: formData.get("name"),
      role: formData.get("role"),
      active: formData.get("active") === "on" || formData.get("active") === "true",
      password: formData.get("password"),
    });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { password, ...rest } = parsed.data;
  const passwordHash = await bcrypt.hash(password, 10);

  try {
    await prisma.user.create({ data: { ...rest, passwordHash } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { error: "That username is already taken." };
    }
    throw e;
  }

  revalidate();
  return { ok: true };
}

export async function updateEmployee(
  formData: FormData,
): Promise<FormState> {
  await requireRole(["ADMIN"]);

  const id = String(formData.get("id") || "");
  if (!id) return { error: "Missing id" };

  const parsed = baseSchema
    .extend({
      // Optional on update: blank means "leave unchanged".
      password: z
        .string()
        .optional()
        .refine((v) => !v || v.length >= 6, "Password must be at least 6 characters"),
    })
    .safeParse({
      username: formData.get("username"),
      name: formData.get("name"),
      role: formData.get("role"),
      active: formData.get("active") === "on" || formData.get("active") === "true",
      password: formData.get("password") || undefined,
    });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  if (await wouldRemoveLastAdmin(id, parsed.data.role, parsed.data.active)) {
    return {
      error: "You can't demote or deactivate the last active admin.",
    };
  }

  const { password, ...rest } = parsed.data;
  const data: Prisma.UserUpdateInput = { ...rest };
  if (password) data.passwordHash = await bcrypt.hash(password, 10);

  try {
    await prisma.user.update({ where: { id }, data });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { error: "That username is already taken." };
    }
    throw e;
  }

  revalidate();
  return { ok: true };
}

export async function deleteEmployee(id: string): Promise<ActionResult> {
  const me = await requireRole(["ADMIN"]);

  if (id === me.id) {
    return { error: "You can't delete your own account." };
  }
  if (await wouldRemoveLastAdmin(id, "VIEWER", false)) {
    return { error: "You can't delete the last active admin." };
  }

  await prisma.user.delete({ where: { id } });
  revalidate();
  return {};
}
