import "server-only";
import type { Prisma, Role } from "@/lib/generated/prisma/client";
import { hashPassword } from "@/lib/auth/password";
import { AppError } from "@/lib/errors";
import { authorize } from "@/lib/permissions";
import { recordAudit, type Db } from "@/lib/services/audit";
import {
  found,
  pageArgs,
  toPage,
  withRuleErrors,
  type Page,
  type ServiceContext,
} from "@/lib/services/shared";
import type { CreateUserInput, UpdateUserInput } from "@/lib/validation/users";

const userSelect = {
  id: true,
  email: true,
  name: true,
  role: true,
  branchId: true,
  branch: { select: { code: true, name: true } },
  isActive: true,
  locale: true,
  mustChangePassword: true,
  lockedUntil: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

export type UserView = Prisma.UserGetPayload<{ select: typeof userSelect }>;

export type UserFilters = {
  q?: string | null;
  role?: Role | null;
  active?: boolean | null;
  page?: number;
};

export async function listUsers(
  { db, actor }: ServiceContext,
  filters: UserFilters = {},
): Promise<Page<UserView>> {
  authorize(actor, "user.read");
  const where: Prisma.UserWhereInput = {};
  if (filters.q) {
    where.OR = [
      { name: { contains: filters.q, mode: "insensitive" } },
      { email: { contains: filters.q, mode: "insensitive" } },
    ];
  }
  if (filters.role) where.role = filters.role;
  if (filters.active !== null && filters.active !== undefined) where.isActive = filters.active;
  const page = filters.page ?? 1;
  const [items, total] = await Promise.all([
    db.user.findMany({ where, select: userSelect, orderBy: { email: "asc" }, ...pageArgs(page) }),
    db.user.count({ where }),
  ]);
  return toPage(items, total, page);
}

export async function getUser({ db, actor }: ServiceContext, id: string): Promise<UserView> {
  authorize(actor, "user.read");
  return found(await db.user.findUnique({ where: { id }, select: userSelect }));
}

/** A Branch Lead's branch must exist and still be open. */
async function assertAssignableBranch(db: Db, branchId: string | null): Promise<void> {
  if (!branchId) return;
  const branch = await db.branch.findUnique({ where: { id: branchId }, select: { status: true } });
  if (!branch) throw new AppError("VALIDATION", "Choose an existing branch.");
  if (branch.status === "CLOSED") {
    throw new AppError("RULE_VIOLATION", "A closed branch cannot get new Branch Leads.");
  }
}

/** Removes the user as lead of any branch it no longer leads by role, branch or status. */
async function releaseLeadership(
  db: Db,
  user: { id: string; role: Role; branchId: string | null; isActive: boolean },
): Promise<string[]> {
  const stale = await db.branch.findMany({
    where: {
      leadUserId: user.id,
      ...(user.role === "BRANCH_LEAD" && user.isActive && user.branchId
        ? { id: { not: user.branchId } }
        : {}),
    },
    select: { id: true },
  });
  if (stale.length > 0) {
    await db.branch.updateMany({
      where: { id: { in: stale.map((branch) => branch.id) } },
      data: { leadUserId: null },
    });
  }
  return stale.map((branch) => branch.id);
}

/**
 * Creates a staff account with a password set by the admin. The user must change it on
 * first sign-in (decision 5); only the seed script creates accounts without that flag.
 */
export async function createUser(
  { db, actor, request }: ServiceContext,
  input: CreateUserInput,
): Promise<UserView> {
  authorize(actor, "user.create");
  const passwordHash = await hashPassword(input.password);
  return withRuleErrors(() =>
    db.$transaction(async (tx) => {
      await assertAssignableBranch(tx, input.branchId);
      const user = await tx.user.create({
        data: {
          email: input.email,
          name: input.name,
          role: input.role,
          branchId: input.branchId,
          passwordHash,
          mustChangePassword: true,
        },
        select: userSelect,
      });
      await recordAudit(tx, actor, request, {
        action: "user.create",
        entityType: "User",
        entityId: user.id,
        branchId: user.branchId,
        after: {
          email: user.email,
          name: user.name,
          role: user.role,
          branchId: user.branchId,
          mustChangePassword: true,
        },
      });
      return user;
    }),
  );
}

/** Changes name, role, branch and language. Admins cannot change their own role. */
export async function updateUser(
  { db, actor, request }: ServiceContext,
  id: string,
  input: UpdateUserInput,
): Promise<UserView> {
  authorize(actor, "user.update");
  return withRuleErrors(() =>
    db.$transaction(async (tx) => {
      const before = found(await tx.user.findUnique({ where: { id }, select: userSelect }));
      if (id === actor.id && input.role !== before.role) {
        throw new AppError("RULE_VIOLATION", "You cannot change your own role.");
      }
      if (input.branchId !== before.branchId) await assertAssignableBranch(tx, input.branchId);
      const after = await tx.user.update({
        where: { id },
        data: {
          name: input.name,
          role: input.role,
          branchId: input.branchId,
          locale: input.locale,
        },
        select: userSelect,
      });
      const releasedBranches = await releaseLeadership(tx, after);
      await recordAudit(tx, actor, request, {
        action: "user.update",
        entityType: "User",
        entityId: id,
        branchId: after.branchId,
        before: {
          name: before.name,
          role: before.role,
          branchId: before.branchId,
          locale: before.locale,
        },
        after: {
          name: after.name,
          role: after.role,
          branchId: after.branchId,
          locale: after.locale,
          ...(releasedBranches.length > 0 ? { removedAsLeadOf: releasedBranches } : {}),
        },
      });
      return after;
    }),
  );
}

/**
 * Deactivates or reactivates an account (section 7.2). A deactivated user loses access on
 * the next request, because every request re-reads the account. Admins cannot deactivate
 * themselves.
 */
export async function setUserActive(
  { db, actor, request }: ServiceContext,
  id: string,
  isActive: boolean,
): Promise<UserView> {
  authorize(actor, "user.deactivate");
  if (id === actor.id && !isActive) {
    throw new AppError("RULE_VIOLATION", "You cannot deactivate your own account.");
  }
  return withRuleErrors(() =>
    db.$transaction(async (tx) => {
      const before = found(await tx.user.findUnique({ where: { id }, select: userSelect }));
      if (before.isActive === isActive) return before;
      const after = await tx.user.update({ where: { id }, data: { isActive }, select: userSelect });
      const releasedBranches = await releaseLeadership(tx, after);
      await recordAudit(tx, actor, request, {
        action: isActive ? "user.reactivate" : "user.deactivate",
        entityType: "User",
        entityId: id,
        branchId: after.branchId,
        before: { isActive: before.isActive },
        after: {
          isActive,
          ...(releasedBranches.length > 0 ? { removedAsLeadOf: releasedBranches } : {}),
        },
      });
      return after;
    }),
  );
}

/**
 * Sets a new password chosen by the admin, clears any lockout, and requires the user to
 * change it on next sign-in (decision 5). The password itself is never audited.
 */
export async function resetUserPassword(
  { db, actor, request }: ServiceContext,
  id: string,
  password: string,
): Promise<void> {
  authorize(actor, "user.resetPassword");
  const passwordHash = await hashPassword(password);
  await withRuleErrors(() =>
    db.$transaction(async (tx) => {
      const before = found(
        await tx.user.findUnique({
          where: { id },
          select: { branchId: true, mustChangePassword: true },
        }),
      );
      await tx.user.update({
        where: { id },
        data: { passwordHash, mustChangePassword: true, failedLoginCount: 0, lockedUntil: null },
      });
      await recordAudit(tx, actor, request, {
        action: "user.resetPassword",
        entityType: "User",
        entityId: id,
        branchId: before.branchId,
        before: { mustChangePassword: before.mustChangePassword },
        after: { mustChangePassword: true },
      });
    }),
  );
}

/** Branches a Branch Lead can be assigned to (all but CLOSED), for the user forms. */
export async function listAssignableBranches({ db, actor }: ServiceContext) {
  authorize(actor, "user.update");
  return db.branch.findMany({
    where: { status: { not: "CLOSED" } },
    select: { id: true, code: true, name: true },
    orderBy: { code: "asc" },
  });
}
