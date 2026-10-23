import "server-only";
import type { BranchStatus, Prisma, PrismaClient } from "@/lib/generated/prisma/client";
import { businessToday } from "@/lib/dates";
import { databaseErrorCode, toRuleViolation } from "@/lib/db-errors";
import { AppError } from "@/lib/errors";
import { authorize } from "@/lib/permissions";
import {
  canChangeBranchStatus,
  cityCodePrefix,
  formatBranchCode,
  nextBranchNumber,
} from "@/lib/rules/branch";
import { recordAudit } from "@/lib/services/audit";
import { found, listScope, withRuleErrors, type ServiceContext } from "@/lib/services/shared";
import type { CreateBranchInput, UpdateBranchInput } from "@/lib/validation/branches";

const UNIQUE_VIOLATION = "23505";
const CODE_ATTEMPTS = 5;

const branchSelect = {
  id: true,
  code: true,
  name: true,
  city: true,
  status: true,
  openedAt: true,
  contactEmail: true,
  leadUserId: true,
  leadUser: { select: { id: true, name: true, email: true } },
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.BranchSelect;

export type BranchView = Prisma.BranchGetPayload<{ select: typeof branchSelect }>;

/** Branches the actor may see: all for staff roles, only its own for a BRANCH_LEAD. */
export async function listBranches(
  { db, actor }: ServiceContext,
  filters: { status?: BranchStatus | null } = {},
): Promise<BranchView[]> {
  // A branch's own id is its branchId for scoping.
  const { branchId } = listScope(actor, "branch.read");
  const where: Prisma.BranchWhereInput = {};
  if (branchId) where.id = branchId;
  if (filters.status) where.status = filters.status;
  return db.branch.findMany({ where, select: branchSelect, orderBy: { code: "asc" } });
}

export async function getBranch({ db, actor }: ServiceContext, id: string): Promise<BranchView> {
  const branch = found(await db.branch.findUnique({ where: { id }, select: branchSelect }));
  authorize(actor, "branch.read", { branchId: branch.id });
  return branch;
}

/**
 * Creates a branch with the next code for its city (section 6.1). The number is read and
 * used inside one transaction; two concurrent creations for the same city collide on the
 * unique code, and the loser retries with the next number.
 */
export async function createBranch(
  { db, actor, request }: ServiceContext,
  input: CreateBranchInput,
): Promise<BranchView> {
  authorize(actor, "branch.create");
  const prefix = cityCodePrefix(input.city);
  if (!prefix) throw new AppError("VALIDATION", "The city needs at least three Latin letters.");

  for (let attempt = 1; ; attempt += 1) {
    try {
      return await db.$transaction(async (tx) => {
        const existing = await tx.branch.findMany({
          where: { code: { startsWith: `BR-${prefix}-` } },
          select: { code: true },
        });
        const number = nextBranchNumber(
          prefix,
          existing.map((row) => row.code),
        );
        if (number === null) {
          throw new AppError("CONFLICT", `No branch codes are left for cities starting ${prefix}.`);
        }
        const branch = await tx.branch.create({
          data: {
            code: formatBranchCode(prefix, number),
            name: input.name,
            city: input.city,
            contactEmail: input.contactEmail,
          },
          select: branchSelect,
        });
        await recordAudit(tx, actor, request, {
          action: "branch.create",
          entityType: "Branch",
          entityId: branch.id,
          branchId: branch.id,
          after: { code: branch.code, name: branch.name, city: branch.city, status: branch.status },
        });
        return branch;
      });
    } catch (error) {
      if (databaseErrorCode(error) === UNIQUE_VIOLATION && attempt < CODE_ATTEMPTS) continue;
      if (error instanceof AppError) throw error;
      throw toRuleViolation(error) ?? error;
    }
  }
}

/** Edits a branch's name, public contact email and lead. Code and city never change. */
export async function updateBranch(
  { db, actor, request }: ServiceContext,
  id: string,
  input: UpdateBranchInput,
): Promise<BranchView> {
  authorize(actor, "branch.update");
  return withRuleErrors(() =>
    db.$transaction(async (tx) => {
      const before = found(await tx.branch.findUnique({ where: { id }, select: branchSelect }));
      if (input.leadUserId) {
        const lead = await tx.user.findUnique({
          where: { id: input.leadUserId },
          select: { role: true, branchId: true, isActive: true },
        });
        if (!lead || lead.role !== "BRANCH_LEAD" || lead.branchId !== id || !lead.isActive) {
          throw new AppError(
            "VALIDATION",
            "The branch lead must be an active Branch Lead assigned to this branch.",
          );
        }
      }
      const after = await tx.branch.update({
        where: { id },
        data: {
          name: input.name,
          contactEmail: input.contactEmail,
          leadUserId: input.leadUserId,
        },
        select: branchSelect,
      });
      await recordAudit(tx, actor, request, {
        action: "branch.update",
        entityType: "Branch",
        entityId: id,
        branchId: id,
        before: {
          name: before.name,
          contactEmail: before.contactEmail,
          leadUserId: before.leadUserId,
        },
        after: { name: after.name, contactEmail: after.contactEmail, leadUserId: after.leadUserId },
      });
      return after;
    }),
  );
}

/**
 * Moves a branch through its lifecycle (section 6.1). The first activation sets openedAt to
 * today's business date. The update is conditional on the status read, so a concurrent change
 * makes this one fail instead of skipping a step.
 */
export async function changeBranchStatus(
  { db, actor, request, now = new Date() }: ServiceContext,
  id: string,
  status: BranchStatus,
): Promise<BranchView> {
  authorize(actor, "branch.changeStatus");
  return withRuleErrors(() =>
    db.$transaction(async (tx) => {
      const before = found(
        await tx.branch.findUnique({ where: { id }, select: { status: true, openedAt: true } }),
      );
      if (!canChangeBranchStatus(before.status, status)) {
        throw new AppError(
          "RULE_VIOLATION",
          `A ${before.status.toLowerCase()} branch cannot become ${status.toLowerCase()}.`,
        );
      }
      const openedAt =
        status === "ACTIVE" && before.openedAt === null ? businessToday(now) : undefined;
      const { count } = await tx.branch.updateMany({
        where: { id, status: before.status },
        data: { status, ...(openedAt ? { openedAt } : {}) },
      });
      if (count === 0) {
        throw new AppError("CONFLICT", "The branch was changed by someone else. Reload and retry.");
      }
      await recordAudit(tx, actor, request, {
        action: "branch.changeStatus",
        entityType: "Branch",
        entityId: id,
        branchId: id,
        before: { status: before.status },
        after: { status, ...(openedAt ? { openedAt } : {}) },
      });
      return tx.branch.findUniqueOrThrow({ where: { id }, select: branchSelect });
    }),
  );
}

/** Active Branch Leads assigned to the branch: the choices for its lead. */
export async function listLeadCandidates({ db, actor }: ServiceContext, branchId: string) {
  authorize(actor, "branch.update");
  return db.user.findMany({
    where: { branchId, role: "BRANCH_LEAD", isActive: true },
    select: { id: true, name: true, email: true },
    orderBy: { name: "asc" },
  });
}

export type PublicBranch = {
  id: string;
  code: string;
  name: string;
  city: string;
  contactEmail: string | null;
};

/** Section 7.1: only ACTIVE branches appear on the public site, with code, city and email. */
export async function listPublicBranches(db: PrismaClient): Promise<PublicBranch[]> {
  authorize(null, "branch.readPublic");
  return db.branch.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, code: true, name: true, city: true, contactEmail: true },
    orderBy: [{ city: "asc" }, { code: "asc" }],
  });
}
