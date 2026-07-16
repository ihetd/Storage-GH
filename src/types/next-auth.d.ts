import type { Role } from "@/lib/roles";
import type { DefaultSession } from "next-auth";

// Augment the session/user/JWT to carry our custom fields (id, username, role).
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      username: string;
      role: Role;
    } & DefaultSession["user"];
  }

  interface User {
    username: string;
    role: Role;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    username: string;
    role: Role;
  }
}
