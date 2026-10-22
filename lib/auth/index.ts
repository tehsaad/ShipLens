import "server-only";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authConfig } from "@/lib/auth/config";
import { getPrisma } from "@/lib/db";
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
      async authorize(credentials, request) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;
        const user = await authenticate(
          getPrisma(),
          parsed.data.email,
          parsed.data.password,
          requestContextFrom(request.headers),
        );
        return user ? { id: user.id } : null;
      },
    }),
  ],
});
