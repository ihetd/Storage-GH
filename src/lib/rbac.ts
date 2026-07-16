import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import type { Role } from "@/lib/roles";

export type SessionUser = {
  id: string;
  username: string;
  name?: string | null;
  role: Role;
};

// --- Page helpers (redirect on failure) -----------------------------------

export async function getCurrentUser(): Promise<SessionUser | null> {
  const session = await auth();
  return (session?.user as SessionUser) ?? null;
}

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
