import type { NextAuthConfig } from "next-auth";

/** Section 7.2: sessions expire after 8 hours of inactivity. */
export const SESSION_IDLE_SECONDS = 8 * 60 * 60;

export const LOGIN_PATH = "/admin/login";

/**
 * Settings shared by the proxy and the full Auth.js instance. It has no providers and no
 * database access, so the proxy stays light. The JWT carries only the user id; role,
 * branch and account status are read from the database on every server-side check.
 */
export const authConfig = {
  pages: { signIn: LOGIN_PATH },
  session: {
    strategy: "jwt",
    // Every authenticated request through the proxy re-issues the token, so this is an
    // idle timeout rather than an absolute one.
    maxAge: SESSION_IDLE_SECONDS,
  },
  trustHost: process.env["AUTH_TRUST_HOST"] === "true",
  providers: [],
  callbacks: {
    authorized({ auth, request }) {
      if (request.nextUrl.pathname === LOGIN_PATH) return true;
      return Boolean(auth?.user);
    },
    jwt({ token, user }) {
      // On sign-in, start a fresh token with only the user id (no name, email or picture).
      if (user?.id) return { sub: user.id };
      return token;
    },
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      return session;
    },
  },
} satisfies NextAuthConfig;
