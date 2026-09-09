"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { requireRole } from "@/lib/rbac";
import { pushAdjustmentsToShopify } from "@/lib/shopify/push";
import { parseStockSheet, groupRows, type ProductGroup } from "@/lib/import/parse-sheet";
import { applyImport, planImport, type ImportPlan, type QuantityMode } from "@/lib/import/apply-sheet";
import { fetchImageToR2 } from "@/lib/import/fetch-image";

// A spreadsheet is read twice: once to show what it would do, and again to do
// it. Holding the parsed rows on the server between those two steps would mean
// state to expire and clean up, so the file is re-uploaded on confirm instead.
// It is a few kilobytes, and it removes a whole class of "your session expired"
// problems.

const MAX_FILE_BYTES = 5 * 1024 * 1024;

export type ImportPreview = {
  status: "preview";
  rows: number;
  plan: ImportPlan;
  warnings: string[];
  sample: { product: string; label: string; quantity: number }[];
};

export type ImportDone = {
  status: "done";
  plan: ImportPlan;
  imageFailures: string[];
};

export type ImportFailed = { status: "error"; errors: string[] };

export type ImportOutcome = ImportPreview | ImportDone | ImportFailed;

async function readGroups(
  formData: FormData,
): Promise<{ groups?: ProductGroup[]; rows?: number; errors?: string[] }> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { errors: ["Choose a spreadsheet first."] };
  }
  if (file.size > MAX_FILE_BYTES) {
    return { errors: ["That file is larger than 5 MB. Split it into a few smaller sheets."] };
  }

  const parsed = await parseStockSheet(await file.arrayBuffer(), file.name);
  // Any bad row stops the whole import. A partial import of a stock sheet
  // leaves counts that are neither the old ones nor the new ones, and no way
  // to tell which rows landed.
  if (parsed.errors.length > 0) return { errors: parsed.errors };

  return { groups: groupRows(parsed.rows), rows: parsed.rows.length };
}

export async function previewStockSheet(formData: FormData): Promise<ImportOutcome> {
  await requireRole(["ADMIN"]);

  const { groups, rows, errors } = await readGroups(formData);
  if (errors || !groups) return { status: "error", errors: errors ?? ["Could not read the file."] };

  const plan = await planImport(groups);
  const warnings: string[] = [];

  if (plan.missingCategory.length > 0) {
    warnings.push(
      `These are new products with no category, so they would be skipped: ${plan.missingCategory.join(", ")}. Add a Category column for them.`,
    );
  }
  if (plan.newCategories.length > 0) {
    warnings.push(`New categories would be created: ${plan.newCategories.join(", ")}.`);
  }

  return {
    status: "preview",
    rows: rows ?? 0,
    plan,
    warnings,
    sample: groups
      .flatMap((g) => g.variants.map((v) => ({ product: g.name, label: v.label, quantity: v.quantity })))
      .slice(0, 12),
  };
}

export async function importStockSheet(formData: FormData): Promise<ImportOutcome> {
  const admin = await requireRole(["ADMIN"]);

  const mode: QuantityMode = formData.get("mode") === "add" ? "add" : "replace";
  const { groups, errors } = await readGroups(formData);
  if (errors || !groups) return { status: "error", errors: errors ?? ["Could not read the file."] };

  const result = await applyImport(groups, mode, admin.id, fetchImageToR2);

  // Same reasoning as the +/- buttons: the person waits for the database, not
  // for Shopify.
  if (result.adjustmentIds.length > 0) {
    after(() => pushAdjustmentsToShopify(result.adjustmentIds));
  }

  revalidatePath("/");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/products");
  revalidatePath("/dashboard/categories");

  return { status: "done", plan: result, imageFailures: result.imageFailures };
}
