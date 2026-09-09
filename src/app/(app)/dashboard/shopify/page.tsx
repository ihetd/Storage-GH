import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { isShopifyConfigured } from "@/lib/shopify/config";
import { fetchShopifyGroups, type ShopifyGroup } from "@/lib/shopify/products";
import { matchSizes, suggestProduct, type SizeMatch } from "@/lib/shopify/links";
import { ShopifyLinkForm, type GroupView, type SizeView } from "./link-form";

export const metadata = { title: "Shopify · Dashboard" };

export default async function ShopifyPage() {
  await requireRole(["ADMIN"]);

  if (!isShopifyConfigured()) {
    return (
      <div>
        <PageHeader
          title="Shopify"
          description="Link each Shopify product to the stock it is counted against."
        />
        <EmptyState>
          Shopify isn&apos;t configured yet. Set SHOPIFY_SHOP_DOMAIN,
          SHOPIFY_CLIENT_ID, SHOPIFY_CLIENT_SECRET and SHOPIFY_LOCATION_ID, then
          reload.
        </EmptyState>
      </div>
    );
  }

  const products = await prisma.product.findMany({
    orderBy: [{ name: "asc" }],
    select: {
      id: true,
      name: true,
      shopifyProductId: true,
      shopifyOptionValue: true,
      variants: { orderBy: { sortOrder: "asc" }, select: { id: true, label: true } },
    },
  });

  let groups: ShopifyGroup[];
  try {
    groups = await fetchShopifyGroups();
  } catch (e) {
    // Shopify being unreachable must not take the page down — an admin needs to
    // see why rather than an error boundary.
    return (
      <div>
        <PageHeader title="Shopify" description="Link each Shopify product to its stock." />
        <EmptyState>
          Couldn&apos;t reach Shopify: {e instanceof Error ? e.message : "unknown error"}
        </EmptyState>
      </div>
    );
  }

  const linkedProductFor = (g: ShopifyGroup) =>
    products.find(
      (p) => p.shopifyProductId === g.productId && p.shopifyOptionValue === g.optionValue,
    ) ?? null;

  const views: GroupView[] = groups.map((g) => {
    const linked = linkedProductFor(g);
    const matches: SizeMatch[] = linked ? matchSizes(g.sizes, linked.variants) : [];
    return {
      key: g.key,
      title: g.productTitle,
      colour: g.optionValue,
      shopifySizeCount: g.sizes.length,
      selectedProductId: linked?.id ?? "",
      suggestedProductId: linked
        ? null
        : suggestProduct(g.productTitle, g.optionValue, products),
      sizes: matches.map((m) => ({
        status: m.status,
        label: m.label,
        localLabel: m.status === "linked" ? m.local.label : null,
      })),
    };
  });

  const unsellable = views.reduce(
    (n, v) => n + v.sizes.filter((s: SizeView) => s.status === "missing-local").length,
    0,
  );
  const unlinked = views.filter((v) => !v.selectedProductId).length;

  return (
    <div>
      <PageHeader
        title="Shopify"
        description="Link each Shopify product to the stock it is counted against. Sizes match themselves once a product is linked."
      />

      {(unlinked > 0 || unsellable > 0) && (
        <Card className="mb-6 border-red-900/60">
          <h2 className="text-sm font-semibold text-red-400">Needs attention</h2>
          <ul className="mt-2 space-y-1 text-sm text-cream/75">
            {unlinked > 0 && (
              <li>
                {unlinked} Shopify {unlinked === 1 ? "product is" : "products are"} not
                linked. Orders for {unlinked === 1 ? "it" : "them"} won&apos;t change any
                stock count.
              </li>
            )}
            {unsellable > 0 && (
              <li>
                {unsellable} {unsellable === 1 ? "size is" : "sizes are"} sold on Shopify
                with nothing here to count. Customers can buy past the stock you have.
              </li>
            )}
          </ul>
        </Card>
      )}

      {views.length === 0 ? (
        <EmptyState>No products found in Shopify.</EmptyState>
      ) : (
        <ShopifyLinkForm
          groups={views}
          products={products.map((p) => ({ id: p.id, name: p.name }))}
        />
      )}
    </div>
  );
}
