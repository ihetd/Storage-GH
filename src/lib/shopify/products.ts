import { gidToId } from "./config";
import { shopifyGraphQL } from "./client";

// Reading Shopify's catalogue in the shape this app links against.
//
// The two systems disagree on structure. Shopify keeps colours as one product
// with a Colour option, so "Light Pant" is a single product with 4 colours x 5
// sizes. This app keeps one attribute axis per product, so the same thing is
// four products of five sizes each.
//
// So a Shopify product is split into one *group* per colour, and a group is
// what gets linked to a Storage-GH product. Sizes are then matched inside it.

/** Option names that mean "colour" rather than "size". */
const COLOUR_OPTION_NAMES = new Set(["color", "colour", "اللون", "لون"]);

export type ShopifySize = {
  variantId: string;
  inventoryItemId: string;
  /** The size option's value. Empty for a product with no real options. */
  label: string;
  quantity: number;
  tracked: boolean;
};

export type ShopifyGroup = {
  /** Stable identity for the group, used as the form field name. */
  key: string;
  productId: string;
  productTitle: string;
  /** The colour this group represents, or null when the product has no colour axis. */
  optionValue: string | null;
  sizes: ShopifySize[];
};

type ProductNode = {
  id: string;
  title: string;
  options: { name: string }[];
  variants: {
    nodes: {
      id: string;
      selectedOptions: { name: string; value: string }[];
      inventoryQuantity: number | null;
      inventoryItem: { id: string; tracked: boolean } | null;
    }[];
  };
};

type ProductsQuery = {
  products: {
    nodes: ProductNode[];
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
  };
};

const PRODUCTS_QUERY = `
  query Products($cursor: String) {
    products(first: 50, after: $cursor, sortKey: TITLE) {
      nodes {
        id
        title
        options { name }
        variants(first: 100) {
          nodes {
            id
            selectedOptions { name value }
            inventoryQuantity
            inventoryItem { id tracked }
          }
        }
      }
      pageInfo { hasNextPage endCursor }
    }
  }
`;

function isColourOption(name: string): boolean {
  return COLOUR_OPTION_NAMES.has(name.trim().toLowerCase());
}

/**
 * Decide which option groups a product and which one names the size.
 *
 * One option means no colour axis at all. With two or more, an option actually
 * called Colour wins; failing that the first option groups and the second
 * sizes, which is Shopify's own convention for how merchants order them.
 */
function axesOf(product: ProductNode): { groupBy: string | null; sizeBy: string | null } {
  const names = product.options.map((o) => o.name);
  if (names.length === 0) return { groupBy: null, sizeBy: null };
  if (names.length === 1) return { groupBy: null, sizeBy: names[0] };

  const colour = names.find(isColourOption);
  if (colour) {
    const size = names.find((n) => n !== colour) ?? null;
    return { groupBy: colour, sizeBy: size };
  }
  return { groupBy: names[0], sizeBy: names[1] };
}

function valueOf(
  selected: { name: string; value: string }[],
  optionName: string | null,
): string {
  if (!optionName) return "";
  return selected.find((o) => o.name === optionName)?.value ?? "";
}

export async function fetchShopifyGroups(): Promise<ShopifyGroup[]> {
  const groups: ShopifyGroup[] = [];
  let cursor: string | null = null;

  do {
    const data: ProductsQuery = await shopifyGraphQL<ProductsQuery>(PRODUCTS_QUERY, { cursor });

    for (const product of data.products.nodes) {
      const { groupBy, sizeBy } = axesOf(product);
      const productId = gidToId(product.id);
      const byColour = new Map<string, ShopifySize[]>();

      for (const variant of product.variants.nodes) {
        // A variant with no inventory item cannot be synced at all; skipping it
        // here keeps it out of the picker rather than offering a dead link.
        if (!variant.inventoryItem) continue;

        const colour = valueOf(variant.selectedOptions, groupBy);
        const label = valueOf(variant.selectedOptions, sizeBy);

        const sizes = byColour.get(colour) ?? [];
        sizes.push({
          variantId: gidToId(variant.id),
          inventoryItemId: gidToId(variant.inventoryItem.id),
          // Shopify names the sole variant of an option-less product
          // "Default Title"; that is machinery, not a size anyone typed.
          label: label === "Default Title" ? "" : label,
          quantity: variant.inventoryQuantity ?? 0,
          tracked: variant.inventoryItem.tracked,
        });
        byColour.set(colour, sizes);
      }

      for (const [colour, sizes] of byColour) {
        groups.push({
          key: colour ? `${productId}:${colour}` : productId,
          productId,
          productTitle: product.title,
          optionValue: colour || null,
          sizes,
        });
      }
    }

    cursor = data.products.pageInfo.hasNextPage ? data.products.pageInfo.endCursor : null;
  } while (cursor);

  return groups;
}
