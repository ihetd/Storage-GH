import Link from "next/link";
import { logout } from "@/lib/actions/auth";
import { canAccessDashboard } from "@/lib/roles";
import type { SessionUser } from "@/lib/rbac";
import { RoleBadge } from "@/components/role-badge";

export function Nav({ user }: { user: SessionUser }) {
  return (
    <header className="sticky top-0 z-20 border-b border-edge bg-ink/85 backdrop-blur">
      <div className="h-0.5 bg-gradient-to-r from-maroon via-gold/70 to-maroon" />
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4">
        <nav className="flex items-center gap-1">
          <Link
            href="/"
            className="rounded-md px-3 py-1.5 font-display text-sm font-semibold tracking-wide text-gold hover:bg-raised"
          >
            Stock
          </Link>
          {canAccessDashboard(user.role) ? (
            <Link
              href="/dashboard"
              className="rounded-md px-3 py-1.5 text-sm font-medium text-cream/70 hover:bg-raised hover:text-cream"
            >
              Dashboard
            </Link>
          ) : null}
        </nav>

        <div className="flex items-center gap-3">
          <div className="hidden items-center gap-2 sm:flex">
            <span className="text-sm text-cream/70">
              {user.name || user.username}
            </span>
            <RoleBadge role={user.role} />
          </div>
          <form action={logout}>
            <button
              type="submit"
              className="rounded-md border border-edge px-3 py-1.5 text-sm font-medium text-cream/80 transition hover:border-gold/40 hover:text-cream"
            >
              Sign out
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
