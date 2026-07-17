import { clsx } from "clsx";
import type { Role } from "@/lib/roles";

const styles: Record<Role, string> = {
  ADMIN: "bg-gold/15 text-gold ring-1 ring-inset ring-gold/40",
  EDITOR: "bg-maroon/30 text-cream ring-1 ring-inset ring-maroon/70",
  VIEWER: "bg-raised text-cream/60 ring-1 ring-inset ring-edge",
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
