import NextAuth from "next-auth";
import createMiddleware from "next-intl/middleware";
import type { NextFetchEvent, NextRequest } from "next/server";
import { routing } from "@/i18n/routing";
import { authConfig } from "@/lib/auth/config";

// /admin: coarse gate that redirects visitors without a session to the login page and
// refreshes the session cookie on each request (idle timeout). Pages, server actions and
// route handlers still check the user and permissions on the server themselves.
const { auth } = NextAuth(authConfig);
const adminProxy = auth as unknown as (
  request: NextRequest,
  event: NextFetchEvent,
) => Promise<Response>;

// Everything else is the public site: adds the locale prefix (/ -> /en) and keeps links in
// the visitor's language (section 7.4).
const localeProxy = createMiddleware(routing);

export default function proxy(request: NextRequest, event: NextFetchEvent) {
  const { pathname } = request.nextUrl;
  if (pathname === "/admin" || pathname.startsWith("/admin/")) return adminProxy(request, event);
  return localeProxy(request);
}

export const config = {
  // Not API routes, Next.js internals or files with an extension.
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
