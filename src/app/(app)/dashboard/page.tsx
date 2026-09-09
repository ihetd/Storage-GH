import Link from "next/link";
import { prisma } from "@/lib/prisma";
import type { Drift } from "@/lib/shopify/reconcile";
import { Card, PageHeader } from "@/components/ui";

export const metadata = { title: "Dashboard" };

const LOW_STOCK_AT = 3;

const timeFormat = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});


// Who to credit for a stock change. Shopify-driven adjustments have no human
// author — userId is null for them — so the source names itself instead of the
// row rendering a blank.
const SOURCE_ACTORS: Record<string, string> = {
  SHOPIFY_ORDER: "Shopify order",
  SHOPIFY_CANCEL: "Shopify cancellation",
  SHOPIFY_REFUND: "Shopify refund",
  RECONCILE: "Stock reconcile",
};

function actorOf(a: {
  user: { name: string | null; username: string } | null;
  source: string;
}): string {
  if (a.user) return a.user.name || a.user.username;
  return SOURCE_ACTORS[a.source] ?? "System";
}

export default async function DashboardOverview() {
  const [products, categories, templates, employees, recent, lowStock, lastCheck] =
    await Promise.all([
      prisma.product.count(),
      prisma.category.count(),
      prisma.variantTemplate.count(),
      prisma.user.count(),
      prisma.stockAdjustment.findMany({
        take: 8,
        orderBy: { createdAt: "desc" },
        include: {
          user: { select: { name: true, username: true } },
          productVariant: {
            select: { label: true, product: { select: { name: true } } },
          },
        },
      }),
      prisma.productVariant.findMany({
        where: { quantity: { lte: LOW_STOCK_AT } },
        orderBy: [{ quantity: "asc" }, { label: "asc" }],
        take: 8,
        select: {
          id: true,
          label: true,
          quantity: true,
          product: { select: { id: true, name: true } },
        },
      }),
      prisma.reconcileRun.findFirst({ orderBy: { ranAt: "desc" } }),
    ]);

  const cards = [
    { href: "/dashboard/products", label: "Products", value: products },
    { href: "/dashboard/categories", label: "Categories", value: categories },
    {
      href: "/dashboard/variant-templates",
      label: "Variant templates",
      value: templates,
    },
    { href: "/dashboard/employees", label: "Employees", value: employees },
  ];

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Manage the product catalog and employee accounts."
      />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {cards.map((c) => (
          <Link key={c.href} href={c.href} className="block">
            <Card className="transition hover:border-gold/40">
              <div className="font-display text-3xl font-semibold text-gold">
                {c.value}
              </div>
              <div className="mt-1 text-sm text-cream/55">{c.label}</div>
            </Card>
          </Link>
        ))}
      </div>

      {lastCheck && (lastCheck.drifted > 0 || lastCheck.missing > 0 || lastCheck.error) && (
        <Card className="mt-6 border-red-900/60">
          <h2 className="text-sm font-semibold text-red-400">
            Shopify and stock disagree
          </h2>
          {lastCheck.error ? (
            <p className="mt-2 text-sm text-cream/75">
              The nightly check could not run: {lastCheck.error}
            </p>
          ) : (
            <>
              <p className="mt-2 text-sm text-cream/75">
                {lastCheck.drifted > 0
                  ? `${lastCheck.drifted} of ${lastCheck.checked} linked sizes hold a different number here than on Shopify. A sync message was probably lost — decide which count is right and set it here.`
                  : `${lastCheck.missing} linked ${lastCheck.missing === 1 ? "size no longer exists" : "sizes no longer exist"} on Shopify. Re-link them on the Shopify tab.`}
              </p>
              {Array.isArray(lastCheck.details) && lastCheck.details.length > 0 && (
                <ul className="mt-3 space-y-1 text-sm text-cream/60">
                  {(lastCheck.details as unknown as Drift[]).slice(0, 8).map((d, i) => (
                    <li key={i}>
                      {d.product} · {d.label} — here {d.local}, Shopify {d.shopify}
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
          <p className="mt-3 text-xs text-cream/40">
            Checked {lastCheck.ranAt.toLocaleString()}
          </p>
        </Card>
      )}

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="font-display text-sm font-semibold tracking-wide text-gold">
            Recent activity
          </h2>
          {recent.length === 0 ? (
            <p className="mt-3 text-sm text-cream/50">
              No stock changes yet. Adjustments made with the +/− buttons will
              show up here.
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-edge/60">
              {recent.map((a) => (
                <li
                  key={a.id}
                  className="flex items-center justify-between gap-3 py-2 text-sm"
                >
                  <div className="min-w-0">
                    <span className="text-cream/85">
                      {actorOf(a)}
                    </span>{" "}
                    <span
                      className={
                        a.delta > 0 ? "text-emerald-400" : "text-red-400"
                      }
                    >
                      {a.delta > 0 ? `+${a.delta}` : a.delta}
                    </span>{" "}
                    <span className="text-cream/60">
                      {a.productVariant.product.name} · {a.productVariant.label}
                    </span>{" "}
                    <span className="text-cream/40">
                      → {a.resultingQty}
                    </span>
                  </div>
                  <span className="shrink-0 text-xs text-cream/40">
                    {timeFormat.format(a.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <h2 className="font-display text-sm font-semibold tracking-wide text-gold">
            Low stock
          </h2>
          {lowStock.length === 0 ? (
            <p className="mt-3 text-sm text-cream/50">
              Nothing running low — every variant is above {LOW_STOCK_AT}.
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-edge/60">
              {lowStock.map((v) => (
                <li
                  key={v.id}
                  className="flex items-center justify-between gap-3 py-2 text-sm"
                >
                  <Link
                    href={`/dashboard/products/${v.product.id}/edit`}
                    className="min-w-0 truncate text-cream/85 hover:text-gold"
                  >
                    {v.product.name}{" "}
                    <span className="text-cream/50">· {v.label}</span>
                  </Link>
                  <span
                    className={
                      v.quantity === 0
                        ? "shrink-0 rounded-full bg-red-950/60 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-400 ring-1 ring-inset ring-red-900"
                        : "shrink-0 rounded-full bg-amber-950/50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-400 ring-1 ring-inset ring-amber-900"
                    }
                  >
                    {v.quantity === 0 ? "Out" : `${v.quantity} left`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
