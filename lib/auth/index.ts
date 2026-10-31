import "server-only";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authConfig } from "@/lib/auth/config";
import { isDemoLogin } from "@/lib/auth/demo";
import { getPrisma } from "@/lib/db";
import { logEvent } from "@/lib/log";
import { limitFailures } from "@/lib/rate-limit";
import { requestContextFrom } from "@/lib/request-context";
import { authenticate } from "@/lib/services/authentication";
import { loginSchema } from "@/lib/validation/auth";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      // Every sign-in, through the login form or a direct POST to the Auth.js callback,
      // passes here, so the per-IP limit on failed attempts (section 8, A07) is checked
      // first. A limited attempt gets the same generic failure as a wrong password.
      async authorize(credentials, request) {
        const context = requestContextFrom(request.headers);

        // One-click demo sign-in: a server action signs in a seeded demo account using a token
        // derived from AUTH_SECRET (never sent to the browser). Only demo-address accounts can
        // use it, and only when that account was seeded; real accounts always need a password.
        const email =
          typeof credentials?.email === "string" ? credentials.email.trim().toLowerCase() : "";
        if (isDemoLogin(email, credentials?.password)) {
          const demo = await getPrisma().user.findFirst({
            where: { email, isActive: true },
            select: { id: true },
          });
          if (demo) logEvent("info", "auth.demoLogin", { requestId: context.requestId });
          return demo ? { id: demo.id } : null;
        }

        const { result, limited } = await limitFailures("login", context.ipAddress, async () => {
          const parsed = loginSchema.safeParse(credentials);
          if (!parsed.success) return null;
          const user = await authenticate(
            getPrisma(),
            parsed.data.email,
            parsed.data.password,
            context,
          );
          return user ? { id: user.id } : null;
        });
        if (limited) {
          logEvent("warn", "rateLimit.exceeded", {
            bucket: "login",
            ip: context.ipAddress,
            requestId: context.requestId,
          });
        }
        return result;
      },
    }),
  ],
});
