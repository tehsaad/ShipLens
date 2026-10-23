import "server-only";
import type { ApplicationStatus, PrismaClient, Prisma } from "@/lib/generated/prisma/client";
import { addDays, businessToday } from "@/lib/dates";
import { databaseErrorCode } from "@/lib/db-errors";
import { AppError } from "@/lib/errors";
import { authorize } from "@/lib/permissions";
import type { RequestContext } from "@/lib/request-context";
import { recordAudit } from "@/lib/services/audit";
import {
  found,
  pageArgs,
  toPage,
  withRuleErrors,
  type Page,
  type ServiceContext,
} from "@/lib/services/shared";
import type { AcceptApplicationInput, ApplicationInput } from "@/lib/validation/applications";

const UNIQUE_VIOLATION = "23505";

/** Section 6.2: one generic message, so the form does not reveal who has applied. */
export const APPLICATION_NOT_ACCEPTED =
  "We could not accept this application. If you have already applied, we will be in touch.";

/** Branches shown in the public form: ACTIVE only (section 7.1). */
export async function listApplicationBranches(db: PrismaClient) {
  return db.branch.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, code: true, name: true, city: true },
    orderBy: [{ city: "asc" }, { name: "asc" }],
  });
}

/**
 * Stores a public application with status NEW (section 6.2). The audit entry records only
 * the ids, not the applicant's personal details.
 */
export async function submitApplication(
  db: PrismaClient,
  input: ApplicationInput,
  request: RequestContext,
): Promise<{ id: string }> {
  authorize(null, "application.submit");
  try {
    return await db.$transaction(async (tx) => {
      const branch = await tx.branch.findUnique({
        where: { id: input.preferredBranchId },
        select: { status: true },
      });
      if (branch?.status !== "ACTIVE") {
        throw new AppError("VALIDATION", "Choose one of the listed branches.");
      }
      const application = await tx.application.create({
        data: {
          fullName: input.fullName,
          email: input.email,
          phone: input.phone,
          preferredBranchId: input.preferredBranchId,
          skills: input.skills,
          availability: input.availability,
          motivation: input.motivation,
          consentGiven: input.consentGiven,
        },
        select: { id: true },
      });
      await recordAudit(tx, null, request, {
        action: "application.submit",
        entityType: "Application",
        entityId: application.id,
        branchId: input.preferredBranchId,
      });
      return application;
    });
  } catch (error) {
    // The partial unique index allows one NEW application per email address.
    if (databaseErrorCode(error) === UNIQUE_VIOLATION) {
      throw new AppError("CONFLICT", APPLICATION_NOT_ACCEPTED);
    }
    throw error;
  }
}

const listSelect = {
  id: true,
  fullName: true,
  email: true,
  status: true,
  availability: true,
  createdAt: true,
  preferredBranch: { select: { code: true, name: true } },
} satisfies Prisma.ApplicationSelect;

export type ApplicationListItem = Prisma.ApplicationGetPayload<{ select: typeof listSelect }>;

export type ApplicationFilters = {
  status?: ApplicationStatus | null;
  branchId?: string | null;
  /** Submitted on or after this business date. */
  from?: Date | null;
  /** Submitted on or before this business date. */
  to?: Date | null;
  page?: number;
};

/** Karachi is UTC+5 all year (no daylight saving), so a business day starts at 19:00 UTC. */
function startOfBusinessDay(date: Date): Date {
  return new Date(date.getTime() - 5 * 60 * 60 * 1000);
}

export async function listApplications(
  { db, actor }: ServiceContext,
  filters: ApplicationFilters = {},
): Promise<Page<ApplicationListItem>> {
  authorize(actor, "application.read");
  const where: Prisma.ApplicationWhereInput = {};
  if (filters.status) where.status = filters.status;
  if (filters.branchId) where.preferredBranchId = filters.branchId;
  if (filters.from || filters.to) {
    where.createdAt = {
      ...(filters.from ? { gte: startOfBusinessDay(filters.from) } : {}),
      ...(filters.to ? { lt: startOfBusinessDay(addDays(filters.to, 1)) } : {}),
    };
  }
  const page = filters.page ?? 1;
  const [items, total] = await Promise.all([
    db.application.findMany({
      where,
      select: listSelect,
      orderBy: { createdAt: "desc" },
      ...pageArgs(page),
    }),
    db.application.count({ where }),
  ]);
  return toPage(items, total, page);
}

const detailSelect = {
  id: true,
  fullName: true,
  email: true,
  phone: true,
  skills: true,
  availability: true,
  motivation: true,
  consentGiven: true,
  status: true,
  decidedAt: true,
  declineReason: true,
  createdAt: true,
  preferredBranchId: true,
  preferredBranch: { select: { code: true, name: true, status: true } },
  decidedBy: { select: { name: true } },
  member: { select: { id: true, memberCode: true } },
} satisfies Prisma.ApplicationSelect;

export type ApplicationDetail = Prisma.ApplicationGetPayload<{ select: typeof detailSelect }>;

export async function getApplication(
  { db, actor }: ServiceContext,
  id: string,
): Promise<ApplicationDetail> {
  authorize(actor, "application.read");
  return found(await db.application.findUnique({ where: { id }, select: detailSelect }));
}

const ALREADY_DECIDED = "This application has already been decided. Reload to see the outcome.";

/**
 * Accepts an application in one transaction (section 6.2): creates the member (with a
 * database-generated MEM-###### code) in the preferred or chosen branch, links both records,
 * marks the application ACCEPTED and writes the audit entries. Claiming the NEW status
 * first makes a concurrent second decision fail instead of creating a second member.
 */
export async function acceptApplication(
  { db, actor, request, now = new Date() }: ServiceContext,
  id: string,
  input: AcceptApplicationInput,
): Promise<{ memberId: string; memberCode: string }> {
  authorize(actor, "application.decide");
  return withRuleErrors(() =>
    db.$transaction(async (tx) => {
      const application = found(
        await tx.application.findUnique({
          where: { id },
          select: {
            status: true,
            fullName: true,
            email: true,
            phone: true,
            preferredBranchId: true,
          },
        }),
      );
      const { count } = await tx.application.updateMany({
        where: { id, status: "NEW" },
        data: { status: "ACCEPTED", decidedById: actor.id, decidedAt: now },
      });
      if (count === 0) throw new AppError("CONFLICT", ALREADY_DECIDED);

      const branchId = input.branchId ?? application.preferredBranchId;
      const branch = await tx.branch.findUnique({
        where: { id: branchId },
        select: { status: true },
      });
      if (!branch) throw new AppError("VALIDATION", "Choose an existing branch.");
      if (branch.status === "CLOSED") {
        throw new AppError(
          "RULE_VIOLATION",
          "A closed branch accepts no new members. Choose another branch.",
        );
      }
      const joinedAt = input.joinedAt ?? businessToday(now);
      if (joinedAt > businessToday(now)) {
        throw new AppError("VALIDATION", "The joining date cannot be in the future.");
      }

      const member = await tx.member.create({
        data: {
          fullName: application.fullName,
          email: application.email,
          phone: application.phone,
          branchId,
          joinedAt,
          applicationId: id,
        },
        select: { id: true, memberCode: true },
      });
      await tx.application.update({ where: { id }, data: { memberId: member.id } });

      await recordAudit(tx, actor, request, {
        action: "application.accept",
        entityType: "Application",
        entityId: id,
        branchId,
        before: { status: "NEW" },
        after: { status: "ACCEPTED", memberId: member.id },
      });
      await recordAudit(tx, actor, request, {
        action: "member.create",
        entityType: "Member",
        entityId: member.id,
        branchId,
        after: { memberCode: member.memberCode, branchId, joinedAt, applicationId: id },
      });
      return { memberId: member.id, memberCode: member.memberCode };
    }),
  );
}

/** Declines an application with an internal reason that the applicant never sees. */
export async function declineApplication(
  { db, actor, request, now = new Date() }: ServiceContext,
  id: string,
  reason: string,
): Promise<void> {
  authorize(actor, "application.decide");
  await withRuleErrors(() =>
    db.$transaction(async (tx) => {
      const application = found(
        await tx.application.findUnique({ where: { id }, select: { preferredBranchId: true } }),
      );
      const { count } = await tx.application.updateMany({
        where: { id, status: "NEW" },
        data: { status: "DECLINED", declineReason: reason, decidedById: actor.id, decidedAt: now },
      });
      if (count === 0) throw new AppError("CONFLICT", ALREADY_DECIDED);
      await recordAudit(tx, actor, request, {
        action: "application.decline",
        entityType: "Application",
        entityId: id,
        branchId: application.preferredBranchId,
        before: { status: "NEW" },
        after: { status: "DECLINED", declineReason: reason },
      });
    }),
  );
}

/** Branches HR can place a new member in: every branch except CLOSED ones. */
export async function listMemberBranches({ db, actor }: ServiceContext) {
  authorize(actor, "application.decide");
  return db.branch.findMany({
    where: { status: { not: "CLOSED" } },
    select: { id: true, code: true, name: true, status: true },
    orderBy: { code: "asc" },
  });
}
