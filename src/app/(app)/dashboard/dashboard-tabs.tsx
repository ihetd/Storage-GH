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
    <nav className="mb-6 flex flex-wrap gap-1 border-b border-slate-200 dark:border-slate-800">
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
                ? "border-indigo-600 text-indigo-700 dark:border-indigo-400 dark:text-indigo-300"
                : "border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
