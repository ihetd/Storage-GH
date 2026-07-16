import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/auth.config";
import { canAccessDashboard } from "@/lib/roles";

// Coarse, edge-safe gate (Next 16 "proxy" convention, formerly middleware).
// Authoritative checks still happen per-route via lib/rbac.ts — this layer just
// keeps unauthenticated users out and bounces non-admins away from the
// dashboard early.
const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const { nextUrl } = req;
  const isLoggedIn = !!req.auth;
  const role = req.auth?.user?.role;

  const isLoginPage = nextUrl.pathname === "/login";
  const isDashboard = nextUrl.pathname.startsWith("/dashboard");

  // Already signed in and visiting /login → send home.
  if (isLoginPage) {
    if (isLoggedIn) {
      return NextResponse.redirect(new URL("/", nextUrl));
    }
    return NextResponse.next();
  }

  // Everything else requires auth.
  if (!isLoggedIn) {
    const loginUrl = new URL("/login", nextUrl);
    loginUrl.searchParams.set("callbackUrl", nextUrl.pathname + nextUrl.search);
    return NextResponse.redirect(loginUrl);
  }

  // Dashboard is ADMIN-only.
  if (isDashboard && !canAccessDashboard(role)) {
    return NextResponse.redirect(new URL("/", nextUrl));
  }

  return NextResponse.next();
});

// Run on everything except Next internals, the auth API, and static assets.
export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\.svg$).*)"],
};
