import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card, PageHeader } from "@/components/ui";
import { ProductForm } from "../../product-form";

export const metadata = { title: "Edit product · Dashboard" };

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [product, categories, templates] = await Promise.all([
    prisma.product.findUnique({
      where: { id },
      include: { variants: { orderBy: { sortOrder: "asc" } } },
    }),
    prisma.category.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true },
    }),
    prisma.variantTemplate.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, attributeLabel: true, options: true },
    }),
  ]);

  if (!product) notFound();

  return (
    <div>
      <PageHeader title={`Edit · ${product.name}`} />
      <Card>
        <ProductForm
          categories={categories}
          templates={templates}
          product={{
            id: product.id,
            name: product.name,
            categoryId: product.categoryId,
            attributeLabel: product.attributeLabel,
            variantTemplateId: product.variantTemplateId,
            variants: product.variants.map((v) => ({
              id: v.id,
              label: v.label,
              quantity: v.quantity,
            })),
          }}
        />
      </Card>
    </div>
  );
}
