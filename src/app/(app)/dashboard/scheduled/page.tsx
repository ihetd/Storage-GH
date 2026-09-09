import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { btnPrimary, Card, EmptyState, PageHeader } from "@/components/ui";
import { DeleteButton } from "@/components/delete-button";
import { deleteProduct } from "@/lib/actions/products";
import { ReceiveProductButton } from "./receive-button";

export const metadata = { title: "Scheduled · Dashboard" };

export default async function ScheduledPage() {
  // Admin only, and not merely hidden from the tab bar: this is the whole point
  // of the section. Staff should not see stock that cannot be sold yet.
  await requireRole(["ADMIN"]);

  const products = await prisma.product.findMany({
    where: { scheduled: true },
    orderBy: { createdAt: "desc" },
    include: {
      category: { select: { name: true } },
      variants: { orderBy: { sortOrder: "asc" }, select: { label: true, quantity: true } },
    },
  });

  const pieces = products.reduce(
    (n, p) => n + p.variants.reduce((m, v) => m + v.quantity, 0),
    0,
  );

  return (
    <div>
      <PageHeader
        title="Scheduled"
        description="Products you have ordered but not received. Only you can see them — they stay out of the stock screens, and out of Shopify, until you move them in."
        actions={
          <Link href="/dashboard/scheduled/new" className={btnPrimary}>
            + New scheduled product
          </Link>
        }
      />

      {products.length === 0 ? (
        <EmptyState>
          Nothing scheduled. Add a product here when you order it, with the sizes and
          quantities you are expecting, and move it into stock when it arrives.
        </EmptyState>
      ) : (
        <>
          <p className="mb-3 text-xs text-cream/45">
            {products.length} {products.length === 1 ? "product" : "products"} ·{" "}
            {pieces} {pieces === 1 ? "piece" : "pieces"} expected
          </p>

          <div className="space-y-4">
            {products.map((product) => (
              <Card key={product.id}>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h2 className="text-sm font-semibold text-cream">{product.name}</h2>
                    <p className="mt-1 text-xs text-cream/50">
                      {product.category.name} · {product.variants.length}{" "}
                      {product.variants.length === 1 ? "size" : "sizes"}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <ReceiveProductButton id={product.id} name={product.name} />
                    <Link
                      href={`/dashboard/products/${product.id}/edit`}
                      className="rounded-md px-2.5 py-1 text-xs font-medium text-cream/70 transition hover:bg-raised"
                    >
                      Edit
                    </Link>
                    <DeleteButton
                      action={deleteProduct.bind(null, product.id)}
                      confirmLabel="Delete this scheduled product?"
                    />
                  </div>
                </div>

                {product.variants.length > 0 && (
                  <ul className="mt-4 flex flex-wrap gap-2 border-t border-edge/60 pt-3">
                    {product.variants.map((v) => (
                      <li
                        key={v.label}
                        className="rounded-md border border-edge px-2 py-1 text-xs text-cream/70"
                      >
                        {v.label}
                        <span className="text-cream/40"> · {v.quantity}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
