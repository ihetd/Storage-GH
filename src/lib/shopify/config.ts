// Shopify Admin API configuration. Mirrors src/lib/r2.ts: everything tolerates
// missing credentials so the app runs unchanged before the sync is set up.
// Callers check isShopifyConfigured() and degrade rather than throw.

export type ShopifyConfig = {
  shopDomain: string;
  clientId: string;
  clientSecret: string;
  /** Numeric Shopify location id that inventory is counted at. */
  locationId: string;
  apiVersion: string;
};

export function getShopifyConfig(): ShopifyConfig | null {
  const shopDomain = process.env.SHOPIFY_SHOP_DOMAIN;
  const clientId = process.env.SHOPIFY_CLIENT_ID;
  const clientSecret = process.env.SHOPIFY_CLIENT_SECRET;
  const locationId = process.env.SHOPIFY_LOCATION_ID;

  if (!shopDomain || !clientId || !clientSecret || !locationId) return null;

  return {
    shopDomain,
    clientId,
    clientSecret,
    locationId,
    // Pinned rather than "latest": Shopify ships breaking changes quarterly and
    // an inventory sync should not start behaving differently on their calendar.
    apiVersion: process.env.SHOPIFY_API_VERSION || "2026-07",
  };
}

export function isShopifyConfigured(): boolean {
  return getShopifyConfig() !== null;
}

/** Shopify ids travel as GIDs ("gid://shopify/Product/123"); we store the number. */
export function gidToId(gid: string): string {
  return gid.split("/").pop() ?? gid;
}

export function productGid(id: string): string {
  return id.startsWith("gid://") ? id : `gid://shopify/Product/${id}`;
}

export function inventoryItemGid(id: string): string {
  return id.startsWith("gid://") ? id : `gid://shopify/InventoryItem/${id}`;
}

export function locationGid(id: string): string {
  return id.startsWith("gid://") ? id : `gid://shopify/Location/${id}`;
}
