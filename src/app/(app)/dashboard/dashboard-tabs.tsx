"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";

const tabs = [
  { href: "/dashboard", label: "Overview", exact: true },
  { href: "/dashboard/products", label: "Products" },
  { href: "/dashboard/categories", label: "Categories" },
  { href: "/dashboard/variant-templates", label: "Variant templates" },
  { href: "/dashboard/scheduled", label: "Scheduled" },
  { href: "/dashboard/employees", label: "Employees" },
  { href: "/dashboard/shopify", label: "Shopify" },
];

export function DashboardTabs() {
  const pathname = usePathname();

  // On a phone the seven tabs wrapped to three rows and pushed the page
  // content below the fold. A single row that scrolls sideways is what every
  // native tab bar does; it bleeds to the screen edges (-mx-4) so the cut-off
  // last tab is itself the scroll hint.
  return (
    <nav className="-mx-4 mb-6 flex gap-1 overflow-x-auto border-b border-edge px-4 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0 [&::-webkit-scrollbar]:hidden">
      {tabs.map((tab) => {
        const active = tab.exact
          ? pathname === tab.href
          : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={clsx(
              "-mb-px inline-flex min-h-11 shrink-0 items-center whitespace-nowrap border-b-2 px-3 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/50 motion-reduce:transition-none sm:min-h-0 sm:py-2",
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
