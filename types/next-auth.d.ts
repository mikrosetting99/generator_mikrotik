import type { DefaultSession, DefaultUser } from "next-auth";
import type { DefaultJWT } from "next-auth/jwt";

type Role = "ADMIN" | "USER";

declare module "next-auth" {
  interface User extends DefaultUser {
    username: string;
    role: Role;
    /** "Remember me" dicentang saat login — sesi pendek bila tidak. */
    rememberMe: boolean;
  }

  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      username: string;
      role: Role;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    id: string;
    username: string;
    role: Role;
    rememberMe: boolean;
  }
}
