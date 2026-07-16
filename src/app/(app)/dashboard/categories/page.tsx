import { prisma } from "@/lib/prisma";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { CategoryCreateForm, CategoryRow } from "./category-forms";

export const metadata = { title: "Categories · Dashboard" };

export default async function CategoriesPage() {
  const categories = await prisma.category.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { _count: { select: { products: true } } },
  });

  return (
    <div>
      <PageHeader
        title="Categories"
        description="Used to group and sort products on the main stock screen."
      />

      <Card className="mb-6">
        <CategoryCreateForm />
      </Card>

      {categories.length === 0 ? (
        <EmptyState>No categories yet. Add your first one above.</EmptyState>
      ) : (
        <Card className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="px-3 py-2 font-medium">Name</th>
                <th className="px-3 py-2 font-medium">Sort</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {categories.map((c) => (
                <CategoryRow
                  key={c.id}
                  category={{
                    id: c.id,
                    name: c.name,
                    sortOrder: c.sortOrder,
                  }}
                />
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
