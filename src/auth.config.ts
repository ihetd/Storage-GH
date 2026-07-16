import type { NextAuthConfig } from "next-auth";
import type { Role } from "@/lib/roles";

// Edge-safe base config: NO Node-only imports (no Prisma, no bcrypt) so it can
// be bundled into middleware. The Credentials provider (which needs Prisma +
// bcrypt) is added only in the full `auth.ts` used by the Node runtime.
export const authConfig = {
  pages: {
    signIn: "/login",
  },
  session: { strategy: "jwt" },
  providers: [],
  callbacks: {
    // Persist our custom fields into the JWT at sign-in.
    jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.username = user.username;
        token.role = user.role;
      }
      return token;
    },
    // Expose them on the session object (available in RSC, route handlers, and
    // as `req.auth` inside middleware).
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.username = token.username as string;
        session.user.role = token.role as Role;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
