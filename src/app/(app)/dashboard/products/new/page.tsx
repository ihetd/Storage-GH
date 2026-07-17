import { prisma } from "@/lib/prisma";
import { Card, PageHeader } from "@/components/ui";
import { ProductForm } from "../product-form";

export const metadata = { title: "New product · Dashboard" };

export default async function NewProductPage() {
  const [categories, templates] = await Promise.all([
    prisma.category.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true },
    }),
    prisma.variantTemplate.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, attributeLabel: true, options: true },
    }),
  ]);

  // Products need a category; guide the admin to create one first.
  if (categories.length === 0) {
    return (
      <div>
        <PageHeader title="New product" />
        <Card>
          <p className="text-sm text-cream/70">
            Create a category first, then come back to add products.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="New product" />
      <Card>
        <ProductForm categories={categories} templates={templates} />
      </Card>
    </div>
  );
}
