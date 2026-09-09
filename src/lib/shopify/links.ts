import { sizeKey } from "./sizes";
import type { ShopifySize } from "./products";

// Pairing the sizes inside one linked group. Kept free of Prisma and fetch so
// it can be exercised directly — this is the logic that decides whether an
// order finds the right row, and it should not need a database to check.

export type LocalVariant = { id: string; label: string };

export type SizeMatch =
  | { status: "linked"; label: string; shopify: ShopifySize; local: LocalVariant }
  /** Shopify sells it, nothing here counts it. Customers can outrun the stock. */
  | { status: "missing-local"; label: string; shopify: ShopifySize }
  /** Counted here, not sold on Shopify. Harmless, worth mentioning. */
  | { status: "missing-shopify"; label: string; local: LocalVariant };

export function matchSizes(
  shopifySizes: ShopifySize[],
  localVariants: LocalVariant[],
): SizeMatch[] {
  // A product with no option axis on either side is one unnamed thing on each.
  // Its labels cannot agree — Shopify calls it nothing at all, this app calls it
  // whatever the merchant typed — so identity comes from there being exactly
  // one of each rather than from the text.
  if (
    shopifySizes.length === 1 &&
    shopifySizes[0].label === "" &&
    localVariants.length === 1
  ) {
    return [
      {
        status: "linked",
        label: localVariants[0].label,
        shopify: shopifySizes[0],
        local: localVariants[0],
      },
    ];
  }

  const byKey = new Map<string, LocalVariant>();
  for (const v of localVariants) {
    // First writer wins: if two rows normalise the same, later ones surface as
    // missing-shopify rather than silently overwriting the link.
    if (!byKey.has(sizeKey(v.label))) byKey.set(sizeKey(v.label), v);
  }

  const matches: SizeMatch[] = [];
  const claimed = new Set<string>();

  for (const size of shopifySizes) {
    const local = byKey.get(sizeKey(size.label));
    if (local) {
      claimed.add(local.id);
      matches.push({ status: "linked", label: size.label, shopify: size, local });
    } else {
      matches.push({ status: "missing-local", label: size.label, shopify: size });
    }
  }

  for (const v of localVariants) {
    if (!claimed.has(v.id)) {
      matches.push({ status: "missing-shopify", label: v.label, local: v });
    }
  }

  return matches;
}

/** Sizes a customer could buy that no local row counts — the case worth warning about. */
export function unsellableSizes(matches: SizeMatch[]): SizeMatch[] {
  return matches.filter((m) => m.status === "missing-local");
}

/**
 * Best guess at which local product a Shopify group belongs to, used only to
 * preselect the dropdown. Deliberately conservative: a wrong suggestion that a
 * human confirms is worse than no suggestion, so this requires a real word in
 * common rather than fuzzy closeness.
 */
export function suggestProduct(
  groupTitle: string,
  colour: string | null,
  products: { id: string; name: string }[],
): string | null {
  const words = (s: string) =>
    new Set(
      s
        .toLowerCase()
        .replace(/[^a-z0-9؀-ۿ ]+/g, " ")
        .split(/\s+/)
        .filter((w) => w.length > 2),
    );

  const target = words(`${groupTitle} ${colour ?? ""}`);
  if (target.size === 0) return null;

  let best: { id: string; score: number } | null = null;
  for (const p of products) {
    let score = 0;
    for (const w of words(p.name)) if (target.has(w)) score++;
    if (score > 0 && (!best || score > best.score)) best = { id: p.id, score };
  }
  return best?.id ?? null;
}
