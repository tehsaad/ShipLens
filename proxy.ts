import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth/config";

// Coarse gate for /admin: redirects visitors without a session to the login page and
// refreshes the session cookie on each request (idle timeout). Pages, server actions and
// route handlers still check the user and permissions on the server themselves.
const { auth } = NextAuth(authConfig);

export default auth;

export const config = {
  matcher: ["/admin/:path*"],
};
