import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/rbac";
import { canAccessDashboard, canAdjustStock } from "@/lib/roles";
import { ProductGrid } from "./product-grid";

export const metadata = { title: "Stock · GymHood Storage" };

export default async function HomePage() {
  const user = await requireUser();

  const [products, categories] = await Promise.all([
    prisma.product.findMany({
      // Scheduled products have been ordered, not received. Showing them here
      // would put stock on the screen that is not in the room.
      where: { scheduled: false },
      orderBy: [{ category: { sortOrder: "asc" } }, { name: "asc" }],
      include: {
        category: { select: { id: true, name: true } },
        variants: { orderBy: { sortOrder: "asc" } },
      },
    }),
    prisma.category.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true },
    }),
  ]);

  // A viewer cannot adjust anything, so empty sizes are dropped before the page
  // is built rather than merely hidden in the browser — otherwise the counts are
  // still sitting in the page source for anyone who looks. Editors keep them:
  // they are stripped in the grid instead, so selling the last piece leaves a
  // way to put it back. Admins see everything.
  const canSeeEverything = canAccessDashboard(user.role);
  const canRestock = canAdjustStock(user.role);

  const visible = products
    .map((p) => ({
      ...p,
      variants:
        canSeeEverything || canRestock
          ? p.variants
          : p.variants.filter((v) => v.quantity > 0),
    }))
    .filter((p) => canSeeEverything || p.variants.length > 0);

  return (
    <ProductGrid
      canAdjust={canAdjustStock(user.role)}
      // Staff see only what is on the shelf. The admin sees everything,
      // including the empties, and can filter down to just those.
      isAdmin={canAccessDashboard(user.role)}
      categories={categories}
      products={visible.map((p) => ({
        id: p.id,
        name: p.name,
        imageUrl: p.imageUrl,
        attributeLabel: p.attributeLabel,
        category: p.category,
        variants: p.variants.map((v) => ({
          id: v.id,
          label: v.label,
          quantity: v.quantity,
        })),
      }))}
    />
  );
}
