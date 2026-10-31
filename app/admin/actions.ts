"use server";

import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { z } from "zod";
import { signIn, signOut } from "@/lib/auth";
import { LOGIN_PATH } from "@/lib/auth/config";
import { DEMO_EMAIL_SUFFIX, demoLoginToken } from "@/lib/auth/demo";
import { getSessionUser, requireUser } from "@/lib/auth/session";
import { getPrisma } from "@/lib/db";
import { isAppError } from "@/lib/errors";
import { getRequestContext } from "@/lib/request-context";
import { recordAudit } from "@/lib/services/audit";
import { changeOwnPassword } from "@/lib/services/authentication";
import { changePasswordSchema, loginSchema } from "@/lib/validation/auth";

export type LoginState = { error: string | null };

// One message for every failure (unknown email, wrong password, locked or inactive account).
const LOGIN_FAILED = "The email or password is not correct, or the account cannot sign in now.";

export async function login(_previous: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: LOGIN_FAILED };

  try {
    // On success this throws a redirect, which Next.js handles.
    await signIn("credentials", { ...parsed.data, redirectTo: "/admin" });
  } catch (error) {
    if (error instanceof AuthError) return { error: LOGIN_FAILED };
    throw error;
  }
  return { error: null };
}

/**
 * One-click demo sign-in for reviewers: signs in a seeded demo account by email, with no
 * password typed. The token comes from the server (lib/auth/demo.ts), so it never reaches the
 * browser; the credentials provider accepts it only for demo-address accounts that were seeded.
 */
export async function demoSignIn(_previous: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("demoEmail") ?? "")
    .trim()
    .toLowerCase();
  if (!email.endsWith(DEMO_EMAIL_SUFFIX)) return { error: LOGIN_FAILED };
  try {
    await signIn("credentials", { email, password: demoLoginToken(), redirectTo: "/admin" });
  } catch (error) {
    if (error instanceof AuthError) return { error: LOGIN_FAILED };
    throw error;
  }
  return { error: null };
}

export async function logout(): Promise<void> {
  const user = await getSessionUser();
  if (user) {
    await recordAudit(getPrisma(), user, await getRequestContext(), {
      action: "auth.logout",
      entityType: "User",
      entityId: user.id,
      branchId: user.branchId,
    });
  }
  await signOut({ redirectTo: LOGIN_PATH });
}

export type ChangePasswordState = {
  error: string | null;
  fieldErrors?: Partial<Record<"currentPassword" | "newPassword" | "confirmPassword", string[]>>;
};

export async function changePassword(
  _previous: ChangePasswordState,
  formData: FormData,
): Promise<ChangePasswordState> {
  const user = await requireUser({ allowPendingPasswordChange: true });
  const parsed = changePasswordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) {
    return { error: null, fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }

  try {
    await changeOwnPassword(
      getPrisma(),
      user,
      parsed.data.currentPassword,
      parsed.data.newPassword,
      await getRequestContext(),
    );
  } catch (error) {
    if (isAppError(error)) return { error: error.message };
    throw error;
  }
  redirect("/admin");
}
