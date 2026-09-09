"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/rbac";
import { fetchShopifyGroups } from "@/lib/shopify/products";
import { applyShopifyLinks, type LinkMapping } from "@/lib/shopify/apply";
import { ShopifyError } from "@/lib/shopify/client";
import { prisma } from "@/lib/prisma";
import { reconcileStock, recordReconcileRun } from "@/lib/shopify/reconcile";
import { setShopifyQuantity } from "@/lib/shopify/push";
import type { ActionResult, FormState } from "./types";

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

/**
 * Make Shopify agree with the counts held here, for every size that disagrees.
 *
 * The counterpart to the drift check. Telling someone to "set the right number
 * here" does not fix a drift on its own: a local edit pushes a delta, which
 * moves Shopify by the same amount and leaves the two exactly as far apart as
 * they were. Closing a gap needs an absolute write, and this is the only thing
 * that does one.
 *
 * This app wins by definition — it is where stock is counted, and the person
 * pressing the button has decided. Shopify's own figure is the one that drifted.
 */
export async function matchShopifyToStock(): Promise<ActionResult> {
  await requireRole(["ADMIN"]);

  try {
    const { details } = await reconcileStock();
    if (details.length === 0) return {};

    // Re-read the ids now rather than trusting anything the browser sent: the
    // client says "fix the drift", never which rows or what to set them to.
    const variants = await prisma.productVariant.findMany({
      where: { shopifyInventoryItemId: { not: null } },
      select: {
        quantity: true,
        label: true,
        shopifyInventoryItemId: true,
        product: { select: { name: true } },
      },
    });

    const drifted = new Set(details.map((d) => `${d.product}\u0000${d.label}`));
    const failures: string[] = [];

    for (const v of variants) {
      if (!drifted.has(`${v.product.name}\u0000${v.label}`)) continue;
      const result = await setShopifyQuantity(v.shopifyInventoryItemId!, v.quantity);
      if (result.status === "failed") {
        failures.push(`${v.product.name} ${v.label}: ${result.reason}`);
      }
    }

    // Record the corrected state so the dashboard stops warning immediately
    // rather than waiting for tonight's run.
    const after = await reconcileStock();
    await prisma.reconcileRun.create({
      data: {
        checked: after.checked,
        drifted: after.drifted,
        missing: after.missing,
        details: after.details,
      },
    });

    if (failures.length > 0) return { error: failures.join("; ") };
  } catch (e) {
    if (e instanceof ShopifyError) return { error: e.message };
    throw e;
  }

  revalidate();
  return {};
}

/**
 * Re-run the drift check now instead of waiting for tonight.
 *
 * The dashboard reports the last recorded run, so a warning outlives whatever
 * caused it until the next nightly pass — including when the cause was fixed
 * somewhere else entirely, like directly in the Shopify admin. Without a way to
 * ask again, a stale warning is indistinguishable from a live one, and a
 * warning nobody believes is worse than none.
 */
export async function recheckShopifyDrift(): Promise<ActionResult> {
  await requireRole(["ADMIN"]);

  try {
    await recordReconcileRun();
  } catch (e) {
    if (e instanceof ShopifyError) return { error: e.message };
    throw e;
  }

  revalidate();
  return {};
}
