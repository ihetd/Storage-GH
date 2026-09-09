import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { Card, PageHeader } from "@/components/ui";
import { ProductForm } from "../../products/product-form";

export const metadata = { title: "New scheduled product · Dashboard" };

// The same form as a normal product — a scheduled product differs only in being
// hidden until it arrives, so filling one in should feel identical. The hidden
// field is what the create action reads.
export default async function NewScheduledProductPage() {
  await requireRole(["ADMIN"]);

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

  if (categories.length === 0) {
    return (
      <div>
        <PageHeader title="New scheduled product" />
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
      <PageHeader
        title="New scheduled product"
        description="Enter it as you would any product. It stays here, visible only to you, until you move it into stock."
      />
      <Card>
        <ProductForm categories={categories} templates={templates} scheduled />
      </Card>
    </div>
  );
}
