import "server-only";
import { createHash } from "node:crypto";

/** Seeded demo accounts all live on this address, so the one-click sign-in is limited to them. */
export const DEMO_EMAIL_SUFFIX = "@demo.hamqadam.test";

/**
 * A server-only token that authorizes a one-click demo sign-in. It is derived from AUTH_SECRET,
 * so it never reaches the browser and a visitor cannot forge it. The demo sign-in server action
 * passes it to the credentials provider, which accepts it ONLY for a seeded demo account — real
 * accounts always need their real password, and demo accounts exist only when sample data is
 * seeded. This lets reviewers sign in with one click without exposing any password.
 */
export function demoLoginToken(): string {
  return createHash("sha256")
    .update(`${process.env.AUTH_SECRET ?? ""}:hamqadam-demo-login`)
    .digest("hex");
}

/** True when a sign-in is a valid one-click demo sign-in (demo address + the server token). */
export function isDemoLogin(email: string, password: unknown): boolean {
  return (
    typeof password === "string" &&
    password.length > 0 &&
    email.endsWith(DEMO_EMAIL_SUFFIX) &&
    password === demoLoginToken()
  );
}
