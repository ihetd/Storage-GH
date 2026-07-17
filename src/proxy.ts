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
  const isApi = nextUrl.pathname.startsWith("/api");

  const isDashboard = nextUrl.pathname.startsWith("/dashboard");

  // /login is public. (The page itself redirects users whose account is still
  // active — deciding that requires a DB read, which can't happen here at the
  // edge. Redirecting on the JWT alone would loop for deactivated accounts.)
  if (isLoginPage) {
    return NextResponse.next();
  }

  // Everything else requires auth. API calls get a JSON 401 (redirecting a
  // fetch() to the login page just hands it HTML); pages get the redirect.
  if (!isLoggedIn) {
    if (isApi) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
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

// Run on everything except Next internals, the auth API, static assets, and the
// public PWA manifest (the OS fetches it unauthenticated to install the app).
export const config = {
  matcher: [
    "/((?!api/auth|manifest.webmanifest|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
