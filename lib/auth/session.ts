import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import type { Locale, Role } from "@/lib/generated/prisma/client";
import { auth } from "@/lib/auth";
import { LOGIN_PATH } from "@/lib/auth/config";
import { getPrisma } from "@/lib/db";
import { authorize, type Action, type ScopedResource } from "@/lib/permissions";

export const CHANGE_PASSWORD_PATH = "/admin/change-password";

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
  branchId: string | null;
  locale: Locale;
  mustChangePassword: boolean;
};

/**
 * The signed-in user, read fresh from the database once per request. A deactivated or
 * deleted account has no session, whatever its token says.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) return null;
  const user = await getPrisma().user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      branchId: true,
      locale: true,
      mustChangePassword: true,
      isActive: true,
    },
  });
  if (!user || !user.isActive) return null;
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    branchId: user.branchId,
    locale: user.locale,
    mustChangePassword: user.mustChangePassword,
  };
});

/**
 * Requires a signed-in user for an admin page or server action. Until the first-login
 * password change is done (decision 5), every admin route except the change-password page
 * redirects there.
 */
export async function requireUser(
  options: { allowPendingPasswordChange?: boolean } = {},
): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect(LOGIN_PATH);
  if (user.mustChangePassword && !options.allowPendingPasswordChange) {
    redirect(CHANGE_PASSWORD_PATH);
  }
  return user;
}

/** Requires a signed-in user who may perform the action on the resource. */
export async function requirePermission(
  action: Action,
  resource?: ScopedResource,
): Promise<SessionUser> {
  const user = await requireUser();
  authorize(user, action, resource);
  return user;
}
