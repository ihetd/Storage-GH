// Size labels are free text on both sides, so they are compared through a
// canonical form rather than literally.
//
// The base rule is deliberately the same one the stock screen already uses —
// sizeKey() in src/app/(app)/product-grid.tsx uppercases labels so "2xl" and
// "2xL" group into one chip. Two different notions of "same size" in one
// codebase would be a bug waiting to happen.
//
// On top of that, separators are dropped and the two conventional spellings of
// the extended sizes are folded together. That last part is not hypothetical:
// this store's Shopify products use "2XL" while stock labels may say "XXL", and
// without folding them that size would silently never sync.

const REPEATED_X = /^(X{2,})(S|L)$/;

export function sizeKey(label: string): string {
  const bare = label.trim().toUpperCase().replace(/[\s\-_.]/g, "");
  const repeated = REPEATED_X.exec(bare);
  // XXL -> 2XL, XXXL -> 3XL, XXS -> 2XS. A single X (XL, XS) is left alone.
  if (repeated) return `${repeated[1].length}X${repeated[2]}`;
  return bare;
}

export function sizesMatch(a: string, b: string): boolean {
  return sizeKey(a) === sizeKey(b);
}
