import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Card, EmptyState, PageHeader, btnPrimary } from "@/components/ui";
import { DeleteButton } from "@/components/delete-button";
import { deleteProduct } from "@/lib/actions/products";

export const metadata = { title: "Products · Dashboard" };

export default async function ProductsPage() {
  const products = await prisma.product.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      category: true,
      variants: { select: { quantity: true } },
    },
  });

  return (
    <div>
      <PageHeader
        title="Products"
        description="Your catalog. Variants and stock counts live inside each product."
        actions={
          <Link href="/dashboard/products/new" className={btnPrimary}>
            + New product
          </Link>
        }
      />

      {products.length === 0 ? (
        <EmptyState>
          No products yet.{" "}
          <Link
            href="/dashboard/products/new"
            className="font-medium text-indigo-600 hover:underline dark:text-indigo-400"
          >
            Create your first product
          </Link>
          .
        </EmptyState>
      ) : (
        <Card className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="px-4 py-2 font-medium">Product</th>
                <th className="px-4 py-2 font-medium">Category</th>
                <th className="px-4 py-2 font-medium">Variants</th>
                <th className="px-4 py-2 font-medium">Total stock</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {products.map((p) => {
                const total = p.variants.reduce((s, v) => s + v.quantity, 0);
                return (
                  <tr
                    key={p.id}
                    className="border-t border-slate-100 dark:border-slate-800"
                  >
                    <td className="px-4 py-3 font-medium">{p.name}</td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                      {p.category.name}
                    </td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                      {p.variants.length}
                    </td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                      {total}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="inline-flex items-center gap-3">
                        <Link
                          href={`/dashboard/products/${p.id}/edit`}
                          className="text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                        >
                          Edit
                        </Link>
                        <DeleteButton
                          action={deleteProduct.bind(null, p.id)}
                          confirmLabel="Delete product?"
                        />
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
