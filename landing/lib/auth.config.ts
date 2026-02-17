import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";

/**
 * Auth config WITHOUT PrismaAdapter.
 * Used by middleware (Edge Runtime) where Prisma cannot run.
 * The full auth.ts extends this with PrismaAdapter for server-side use.
 */
export const authConfig: NextAuthConfig = {
  session: { strategy: "jwt" },
  trustHost: true,
  secret: process.env.AUTH_SECRET,
  pages: {
    signIn: "/signin",
    error: "/auth/error",
  },
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    }),
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      // authorize runs server-side only, not in middleware
      // The actual authorize logic is in auth.ts which overrides this
      async authorize() {
        return null;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as "USER" | "ADMIN" | "BLOCKED";
      }
      return session;
    },
    authorized({ auth, request: { nextUrl } }) {
      return true; // Let middleware.ts handle authorization logic
    },
  },
};
