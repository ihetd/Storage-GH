// Role constants + helpers shared by client and server. Kept dependency-free
// (no Prisma/Node imports) so it is safe to import from edge middleware and
// client components alike.

export type Role = "ADMIN" | "EDITOR" | "VIEWER";

export const ROLES: Role[] = ["ADMIN", "EDITOR", "VIEWER"];

// Can this role change stock quantities (use the +/- buttons)?
export function canAdjustStock(role: Role | undefined | null): boolean {
  return role === "ADMIN" || role === "EDITOR";
}

// Can this role reach the admin dashboard?
export function canAccessDashboard(role: Role | undefined | null): boolean {
  return role === "ADMIN";
}
