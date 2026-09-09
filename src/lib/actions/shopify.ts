"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/rbac";
import { fetchShopifyGroups } from "@/lib/shopify/products";
import { applyShopifyLinks, type LinkMapping } from "@/lib/shopify/apply";
import { ShopifyError } from "@/lib/shopify/client";
import type { FormState } from "./types";

const FIELD_PREFIX = "link:";

function revalidate() {
  revalidatePath("/dashboard/shopify");
  revalidatePath("/dashboard");
  revalidatePath("/");
}

/**
 * Save the whole product-to-Shopify mapping. The form submits every group, so
 * this is a full replacement rather than a patch — see applyShopifyLinks.
 */
export async function saveShopifyLinks(formData: FormData): Promise<FormState> {
  await requireRole(["ADMIN"]);

  const mapping: LinkMapping = new Map();
  for (const [field, raw] of formData.entries()) {
    if (!field.startsWith(FIELD_PREFIX)) continue;
    mapping.set(field.slice(FIELD_PREFIX.length), String(raw));
  }

  try {
    const groups = await fetchShopifyGroups();
    const result = await applyShopifyLinks(mapping, groups);
    if (!result.ok) return { error: result.error };
  } catch (e) {
    if (e instanceof ShopifyError) return { error: e.message };
    throw e;
  }

  revalidate();
  return { ok: true };
}
