import { clsx } from "clsx";
import type { Role } from "@/lib/roles";

const styles: Record<Role, string> = {
  ADMIN:
    "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300",
  EDITOR:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  VIEWER: "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
};

export function RoleBadge({ role }: { role: Role }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold",
        styles[role],
      )}
    >
      {role}
    </span>
  );
}
