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

// Run on everything except Next internals, the auth API, static assets, the
// public PWA manifest (the OS fetches it unauthenticated to install the app),
// the Shopify webhook, and the nightly reconcile cron.
//
// The webhook has to be excluded because Shopify cannot hold a session cookie —
// this gate would 401 every delivery before the handler ever ran. It is not
// left unprotected: the route verifies Shopify's HMAC over the raw body, which
// is a stronger check than a cookie. The reconcile job is exempt for the same
// reason — Vercel's cron has no session either — and carries CRON_SECRET as a
// bearer token instead. Those two are the only exemptions on /api.
export const config = {
  matcher: [
    "/((?!api/auth|api/shopify/webhook|api/shopify/reconcile|manifest.webmanifest|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
