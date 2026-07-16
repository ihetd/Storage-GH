import Link from "next/link";
import { logout } from "@/lib/actions/auth";
import { canAccessDashboard } from "@/lib/roles";
import type { SessionUser } from "@/lib/rbac";
import { RoleBadge } from "@/components/role-badge";

export function Nav({ user }: { user: SessionUser }) {
  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/80 backdrop-blur dark:border-slate-800 dark:bg-slate-900/80">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4">
        <nav className="flex items-center gap-1">
          <Link
            href="/"
            className="rounded-md px-3 py-1.5 text-sm font-semibold text-slate-900 hover:bg-slate-100 dark:text-white dark:hover:bg-slate-800"
          >
            Stock
          </Link>
          {canAccessDashboard(user.role) ? (
            <Link
              href="/dashboard"
              className="rounded-md px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
            >
              Dashboard
            </Link>
          ) : null}
        </nav>

        <div className="flex items-center gap-3">
          <div className="hidden items-center gap-2 sm:flex">
            <span className="text-sm text-slate-600 dark:text-slate-300">
              {user.name || user.username}
            </span>
            <RoleBadge role={user.role} />
          </div>
          <form action={logout}>
            <button
              type="submit"
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Sign out
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
