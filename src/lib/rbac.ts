import { cache } from "react";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { Role } from "@/lib/roles";

export type SessionUser = {
  id: string;
  username: string;
  name?: string | null;
  role: Role;
};

// --- Page helpers (redirect on failure) -----------------------------------

// Authoritative current-user lookup. The JWT only proves identity; role and
// active status are re-read from the DB so that deactivating an employee or
// changing their role takes effect immediately instead of when the token
// expires. (The edge proxy still uses the JWT alone — it's just the coarse
// first gate.)
//
// Wrapped in React `cache()` so that a single request/render that touches this
// through the layout, the page, and nested requireRole calls pays for the
// auth() + DB round trip once, not three times.
export const getCurrentUser = cache(async function getCurrentUser(): Promise<SessionUser | null> {
  const session = await auth();
  const id = (session?.user as SessionUser | undefined)?.id;
  if (!id) return null;

  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, username: true, name: true, role: true, active: true },
  });
  if (!user || !user.active) return null;

  return {
    id: user.id,
    username: user.username,
    name: user.name,
    role: user.role as Role,
  };
});

// Require any authenticated user; redirect to /login otherwise.
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

// Require one of the given roles; redirect home if authenticated but wrong role.
export async function requireRole(roles: Role[]): Promise<SessionUser> {
  const user = await requireUser();
  if (!roles.includes(user.role)) redirect("/");
  return user;
}

// --- API helpers (return a Response on failure) ---------------------------
//
// Usage:
//   const gate = await requireApiRole(["ADMIN"]);
//   if (gate instanceof NextResponse) return gate;
//   const { user } = gate;

export async function requireApiUser(): Promise<
  { user: SessionUser } | NextResponse
> {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return { user };
}

export async function requireApiRole(
  roles: Role[],
): Promise<{ user: SessionUser } | NextResponse> {
  const gate = await requireApiUser();
  if (gate instanceof NextResponse) return gate;
  if (!roles.includes(gate.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return gate;
}
