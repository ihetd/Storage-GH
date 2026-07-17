import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/rbac";
import { canAdjustStock } from "@/lib/roles";
import { ProductGrid } from "./product-grid";

export const metadata = { title: "Stock · GymHood Storage" };

export default async function HomePage() {
  const user = await requireUser();

  const [products, categories] = await Promise.all([
    prisma.product.findMany({
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

  return (
    <ProductGrid
      canAdjust={canAdjustStock(user.role)}
      categories={categories}
      products={products.map((p) => ({
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
