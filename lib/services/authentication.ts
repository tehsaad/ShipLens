import "server-only";
import type { PrismaClient, Role } from "@/lib/generated/prisma/client";
import { AppError } from "@/lib/errors";
import { hashPassword, verifyAgainstDummy, verifyPassword } from "@/lib/auth/password";
import type { RequestContext } from "@/lib/request-context";
import { recordAudit } from "@/lib/services/audit";

/** Section 7.2: lock the account for 15 minutes after 5 failed attempts. */
export const LOCKOUT_THRESHOLD = 5;
export const LOCKOUT_MINUTES = 15;

export type AuthenticatedUser = {
  id: string;
  role: Role;
  branchId: string | null;
  mustChangePassword: boolean;
};

export function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

type FailureReason = "unknown_account" | "inactive" | "locked" | "invalid_password";

/**
 * Checks an email and password. Returns the user on success and null on any failure; callers
 * show one generic message whatever the reason. Every attempt is audit-logged.
 */
export async function authenticate(
  db: PrismaClient,
  rawEmail: string,
  password: string,
  context: RequestContext,
  now: Date = new Date(),
): Promise<AuthenticatedUser | null> {
  const email = normaliseEmail(rawEmail);
  const user = await db.user.findUnique({
    where: { email },
    select: {
      id: true,
      role: true,
      branchId: true,
      passwordHash: true,
      isActive: true,
      lockedUntil: true,
      mustChangePassword: true,
    },
  });

  const fail = async (reason: FailureReason) => {
    await recordAudit(db, null, context, {
      action: "auth.login.failed",
      entityType: "User",
      entityId: user?.id ?? null,
      branchId: user?.branchId ?? null,
      // The typed email is kept only when it matched an account. Unmatched input may be a
      // password typed into the wrong field, and the audit log is permanent (section 8, A09).
      after: user ? { email, reason } : { reason },
    });
    return null;
  };

  if (!user) {
    await verifyAgainstDummy(password);
    return fail("unknown_account");
  }
  if (!user.isActive) {
    await verifyAgainstDummy(password);
    return fail("inactive");
  }
  if (user.lockedUntil && user.lockedUntil > now) {
    await verifyAgainstDummy(password);
    return fail("locked");
  }

  if (!(await verifyPassword(user.passwordHash, password))) {
    const updated = await db.user.update({
      where: { id: user.id },
      data: { failedLoginCount: { increment: 1 } },
      select: { failedLoginCount: true },
    });
    if (updated.failedLoginCount >= LOCKOUT_THRESHOLD) {
      const lockedUntil = new Date(now.getTime() + LOCKOUT_MINUTES * 60_000);
      const { count } = await db.user.updateMany({
        where: { id: user.id, failedLoginCount: { gte: LOCKOUT_THRESHOLD } },
        data: { failedLoginCount: 0, lockedUntil },
      });
      if (count > 0) {
        await recordAudit(db, null, context, {
          action: "auth.lockout",
          entityType: "User",
          entityId: user.id,
          branchId: user.branchId,
          after: { lockedUntil },
        });
      }
    }
    return fail("invalid_password");
  }

  await db.user.update({
    where: { id: user.id },
    data: { failedLoginCount: 0, lockedUntil: null },
  });
  await recordAudit(db, { id: user.id, role: user.role }, context, {
    action: "auth.login.succeeded",
    entityType: "User",
    entityId: user.id,
    branchId: user.branchId,
  });

  return {
    id: user.id,
    role: user.role,
    branchId: user.branchId,
    mustChangePassword: user.mustChangePassword,
  };
}

/**
 * Changes the signed-in user's own password and clears the first-login requirement
 * (decision 5). Throws a VALIDATION error when the current password is wrong or the new
 * one is reused.
 */
export async function changeOwnPassword(
  db: PrismaClient,
  actor: { id: string; role: Role },
  currentPassword: string,
  newPassword: string,
  context: RequestContext,
): Promise<void> {
  const user = await db.user.findUniqueOrThrow({
    where: { id: actor.id },
    select: { passwordHash: true, branchId: true, mustChangePassword: true },
  });
  if (!(await verifyPassword(user.passwordHash, currentPassword))) {
    throw new AppError("VALIDATION", "The current password is not correct.");
  }
  if (await verifyPassword(user.passwordHash, newPassword)) {
    throw new AppError("VALIDATION", "Choose a password you have not used for this account.");
  }

  const passwordHash = await hashPassword(newPassword);
  await db.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: actor.id },
      data: { passwordHash, mustChangePassword: false },
    });
    await recordAudit(tx, actor, context, {
      action: "auth.password.changed",
      entityType: "User",
      entityId: actor.id,
      branchId: user.branchId,
      before: { mustChangePassword: user.mustChangePassword },
      after: { mustChangePassword: false },
    });
  });
}
