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

// Colour names, both languages. This store's Shopify options are written in
// English while its stock rows are named in Arabic, so a colour group and the
// product that counts it rarely share a single character. Small closed
// vocabulary, so a table beats anything cleverer.
const COLOUR_SYNONYMS: string[][] = [
  ["black", "أسود", "اسود"],
  ["white", "أبيض", "ابيض"],
  ["red", "أحمر", "احمر"],
  ["pink", "وردي", "زهري"],
  ["grey", "gray", "رمادي"],
  ["blue", "أزرق", "ازرق"],
  ["navy", "كحلي"],
  ["green", "أخضر", "اخضر"],
  ["beige", "بيج"],
  ["brown", "بني"],
  ["yellow", "أصفر", "اصفر"],
  ["orange", "برتقالي"],
  ["purple", "بنفسجي"],
];

function words(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\u0600-\u06ff ]+/g, " ")
      .split(/\s+/)
      .filter(Boolean),
  );
}

/** Every spelling of a colour, in either language, including the one given. */
function colourForms(colour: string): string[] {
  const given = colour.trim().toLowerCase();
  const row = COLOUR_SYNONYMS.find((forms) => forms.includes(given));
  return row ? [...new Set([given, ...row])] : [given];
}

function namesColour(productName: string, colour: string): boolean {
  const inName = words(productName);
  return colourForms(colour).some((form) => inName.has(form));
}

/**
 * Best guess at which local product a Shopify group belongs to, used only to
 * preselect the dropdown. It never links anything by itself — a human still
 * presses save.
 *
 * Deliberately conservative. For a colour group the colour must be named, in
 * either language: without that every colour of one Shopify product suggests
 * the same stock row, which is a mapping the database refuses, so four
 * dropdowns arrive pre-filled with something that cannot be saved. And when
 * two products name the same colour the suggestion is withheld rather than
 * guessed, because at that point there is genuinely nothing to choose between
 * them.
 */
export function suggestProduct(
  groupTitle: string,
  colour: string | null,
  products: { id: string; name: string }[],
): string | null {
  if (colour) {
    const candidates = products.filter((p) => namesColour(p.name, colour));
    if (candidates.length === 1) return candidates[0].id;
    if (candidates.length === 0) return null;
    // Several products claim the colour, so fall back to the title to separate
    // them — "Light Pant Black" beats "Zip Hoodie Black" for a Light Pant group.
    return bestByTitle(groupTitle, candidates);
  }
  return bestByTitle(groupTitle, products);
}

function bestByTitle(
  groupTitle: string,
  products: { id: string; name: string }[],
): string | null {
  const target = new Set([...words(groupTitle)].filter((w) => w.length > 2));
  if (target.size === 0) return null;

  let best: { id: string; score: number } | null = null;
  let tied = false;
  for (const p of products) {
    let score = 0;
    for (const w of words(p.name)) if (target.has(w)) score++;
    if (score === 0) continue;
    if (!best || score > best.score) {
      best = { id: p.id, score };
      tied = false;
    } else if (score === best.score) {
      tied = true;
    }
  }
  return best && !tied ? best.id : null;
}
