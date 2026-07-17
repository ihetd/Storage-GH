"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";

const tabs = [
  { href: "/dashboard", label: "Overview", exact: true },
  { href: "/dashboard/products", label: "Products" },
  { href: "/dashboard/categories", label: "Categories" },
  { href: "/dashboard/variant-templates", label: "Variant templates" },
  { href: "/dashboard/employees", label: "Employees" },
];

export function DashboardTabs() {
  const pathname = usePathname();

  return (
    <nav className="mb-6 flex flex-wrap gap-1 border-b border-edge">
      {tabs.map((tab) => {
        const active = tab.exact
          ? pathname === tab.href
          : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={clsx(
              "-mb-px border-b-2 px-3 py-2 text-sm font-medium transition",
              active
                ? "border-gold text-gold"
                : "border-transparent text-cream/55 hover:text-cream",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
