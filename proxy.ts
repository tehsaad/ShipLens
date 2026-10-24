import NextAuth from "next-auth";
import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";
import { routing } from "@/i18n/routing";
import { LOGIN_PATH, authConfig } from "@/lib/auth/config";
import { adminContentSecurityPolicy, createNonce } from "@/lib/security-headers";

const isDev = process.env.NODE_ENV === "development";

const { auth } = NextAuth(authConfig);

// /admin: coarse gate that redirects visitors without a session to the login page and
// refreshes the session cookie on each request (idle timeout). Pages, server actions and
// route handlers still check the user and permissions on the server themselves.
// Every admin response also gets a content security policy with a fresh nonce; Next.js reads
// it from the request header and puts the nonce on its scripts (section 8, A05).
const adminProxy = auth((request) => {
  if (!request.auth?.user && request.nextUrl.pathname !== LOGIN_PATH) {
    const signIn = request.nextUrl.clone();
    signIn.pathname = LOGIN_PATH;
    signIn.searchParams.set("callbackUrl", request.nextUrl.href);
    return NextResponse.redirect(signIn);
  }
  const policy = adminContentSecurityPolicy(createNonce(), isDev);
  const headers = new Headers(request.headers);
  headers.set("Content-Security-Policy", policy);
  const response = NextResponse.next({ request: { headers } });
  response.headers.set("Content-Security-Policy", policy);
  return response;
}) as unknown as (request: NextRequest, event: NextFetchEvent) => Promise<Response>;

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
