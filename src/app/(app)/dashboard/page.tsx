import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Card, PageHeader } from "@/components/ui";

export const metadata = { title: "Dashboard" };

export default async function DashboardOverview() {
  const [products, categories, templates, employees] = await Promise.all([
    prisma.product.count(),
    prisma.category.count(),
    prisma.variantTemplate.count(),
    prisma.user.count(),
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
    </div>
  );
}
