import "server-only";
import type { Prisma, ReportStatus } from "@/lib/generated/prisma/client";
import { addDays, businessToday, formatDateOnly } from "@/lib/dates";
import { databaseErrorCode } from "@/lib/db-errors";
import { AppError } from "@/lib/errors";
import { authorize } from "@/lib/permissions";
import {
  nextReportStatus,
  notesEditable,
  submissionFor,
  totalsAreLive,
  weekCanBeOpened,
  weekIsComplete,
  type ReportTransition,
} from "@/lib/rules/report";
import { recordAudit, type Db } from "@/lib/services/audit";
import { computeWeeklyTotals, type WeeklyTotals } from "@/lib/services/reporting";
import {
  found,
  listScope,
  pageArgs,
  toPage,
  withRuleErrors,
  type Page,
  type ServiceContext,
} from "@/lib/services/shared";

/**
 * Weekly reports (section 6.4). Every transition is a conditional update on the version the
 * user saw and the status it expects, so a stale request fails with a conflict instead of
 * overwriting someone else's change; each one is audited with actor, from-state, to-state,
 * comment and version.
 */

const UNIQUE_VIOLATION = "23505";
const STALE = "This report was changed by someone else. Reload it to see the latest version.";

/** Totals read in one snapshot, so the four figures always describe the same moment. */
async function snapshotTotals(
  db: ServiceContext["db"],
  branchId: string,
  weekStart: Date,
): Promise<WeeklyTotals> {
  return db.$transaction((tx) => computeWeeklyTotals(tx, branchId, weekStart), {
    isolationLevel: "RepeatableRead",
  });
}

const listSelect = {
  id: true,
  branchId: true,
  branch: { select: { code: true, name: true } },
  weekStart: true,
  status: true,
  submittedAt: true,
  reviewedAt: true,
  version: true,
} satisfies Prisma.WeeklyReportSelect;

export type ReportListItem = Prisma.WeeklyReportGetPayload<{ select: typeof listSelect }>;

export type ReportFilters = { status?: ReportStatus | null; branchId?: string | null };

/** The list filters as a query inside the actor's branch scope; shared with the CSV export. */
export function reportWhere(
  scope: { branchId?: string },
  filters: ReportFilters,
): Prisma.WeeklyReportWhereInput {
  return {
    ...(filters.branchId ? { branchId: filters.branchId } : {}),
    ...scope,
    ...(filters.status ? { status: filters.status } : {}),
  };
}

/** Reports waiting for review first (oldest submission first), then newest weeks. */
export const REPORT_LIST_ORDER = [
  { submittedAt: { sort: "asc", nulls: "last" } },
  { weekStart: "desc" },
] satisfies Prisma.WeeklyReportOrderByWithRelationInput[];

export async function listReports(
  { db, actor }: ServiceContext,
  filters: ReportFilters & { page?: number } = {},
): Promise<Page<ReportListItem>> {
  const where = reportWhere(listScope(actor, "report.read"), filters);
  const page = filters.page ?? 1;
  const [items, total] = await Promise.all([
    db.weeklyReport.findMany({
      where,
      select: listSelect,
      orderBy: REPORT_LIST_ORDER,
      ...pageArgs(page),
    }),
    db.weeklyReport.count({ where }),
  ]);
  return toPage(items, total, page);
}

const detailSelect = {
  ...listSelect,
  branch: { select: { code: true, name: true, status: true } },
  totalsSnapshot: true,
  leadNotes: true,
  submittedBy: { select: { name: true } },
  reviewedBy: { select: { name: true } },
  reviewComment: true,
  approvedAt: true,
} satisfies Prisma.WeeklyReportSelect;

export type ReportHistoryEntry = {
  at: Date;
  action: string;
  actor: string | null;
  from: string | null;
  to: string | null;
  comment: string | null;
  version: number | null;
};

export type ReportDetail = Prisma.WeeklyReportGetPayload<{ select: typeof detailSelect }> & {
  /** Live totals while DRAFT or RETURNED; the frozen snapshot afterwards. */
  totals: WeeklyTotals;
  totalsLive: boolean;
  collections: {
    id: string;
    collectedOn: Date;
    amount: Prisma.Decimal;
    purpose: string;
    description: string | null;
    correctsCollectionId: string | null;
    routedAt: Date | null;
  }[];
  /** Transitions from the audit log (section 7.2), oldest first. */
  history: ReportHistoryEntry[];
};

function json(value: Prisma.JsonValue | null): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export async function getReport({ db, actor }: ServiceContext, id: string): Promise<ReportDetail> {
  authorize(actor, "report.read");
  const report = found(await db.weeklyReport.findUnique({ where: { id }, select: detailSelect }));
  authorize(actor, "report.read", { branchId: report.branchId });

  const totalsLive = totalsAreLive(report.status);
  const totals = totalsLive
    ? await snapshotTotals(db, report.branchId, report.weekStart)
    : (report.totalsSnapshot as WeeklyTotals);
  const [collections, audits] = await Promise.all([
    db.collection.findMany({
      where: {
        branchId: report.branchId,
        collectedOn: { gte: report.weekStart, lte: addDays(report.weekStart, 6) },
      },
      select: {
        id: true,
        collectedOn: true,
        amount: true,
        purpose: true,
        description: true,
        correctsCollectionId: true,
        routedAt: true,
      },
      orderBy: [{ collectedOn: "asc" }, { createdAt: "asc" }],
    }),
    db.auditLog.findMany({
      where: { entityType: "WeeklyReport", entityId: id },
      select: {
        createdAt: true,
        action: true,
        before: true,
        after: true,
        actor: { select: { name: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
  ]);
  const history = audits.map((entry) => {
    const before = json(entry.before);
    const after = json(entry.after);
    return {
      at: entry.createdAt,
      action: entry.action,
      actor: entry.actor?.name ?? null,
      from: typeof before["status"] === "string" ? before["status"] : null,
      to: typeof after["status"] === "string" ? after["status"] : null,
      comment: typeof after["comment"] === "string" ? after["comment"] : null,
      version: typeof after["version"] === "number" ? after["version"] : null,
    };
  });
  return { ...report, totals, totalsLive, collections, history };
}

/**
 * Opens a branch's report for a week (section 6.4): the row is created as DRAFT the first
 * time the Branch Lead opens that week, and returned as it is afterwards.
 */
export async function openReport(
  { db, actor, request, now = new Date() }: ServiceContext,
  weekStart: Date,
): Promise<{ id: string }> {
  authorize(actor, "report.draft");
  const branchId = actor.branchId!;
  if (!weekCanBeOpened(weekStart, businessToday(now))) {
    throw new AppError("VALIDATION", "Reports can only be opened for the current or a past week.");
  }
  const existing = await db.weeklyReport.findUnique({
    where: { branchId_weekStart: { branchId, weekStart } },
    select: { id: true },
  });
  if (existing) return existing;
  try {
    return await db.$transaction(async (tx) => {
      const branch = found(
        await tx.branch.findUnique({ where: { id: branchId }, select: { status: true } }),
      );
      if (branch.status === "CLOSED") {
        throw new AppError("RULE_VIOLATION", "This branch is closed and starts no new reports.");
      }
      const report = await tx.weeklyReport.create({
        data: { branchId, weekStart },
        select: { id: true },
      });
      await recordAudit(tx, actor, request, {
        action: "report.create",
        entityType: "WeeklyReport",
        entityId: report.id,
        branchId,
        after: { status: "DRAFT", version: 1, weekStart: formatDateOnly(weekStart) },
      });
      return report;
    });
  } catch (error) {
    // Opened at the same moment in another tab: return the row that won.
    if (databaseErrorCode(error) === UNIQUE_VIOLATION) {
      return found(
        await db.weeklyReport.findUnique({
          where: { branchId_weekStart: { branchId, weekStart } },
          select: { id: true },
        }),
      );
    }
    throw error;
  }
}

/** Loads the report's branch, status and version, and checks the action on its branch. */
async function loadForChange(
  tx: Db,
  ctx: ServiceContext,
  id: string,
  action: "report.draft" | "report.submit" | "report.approve" | "report.return",
) {
  authorize(ctx.actor, action);
  const report = found(
    await tx.weeklyReport.findUnique({
      where: { id },
      select: { branchId: true, status: true, version: true, weekStart: true, leadNotes: true },
    }),
  );
  authorize(ctx.actor, action, { branchId: report.branchId });
  return report;
}

/** Applies a guarded update: only when the row still has the version and status read. */
async function guardedUpdate(
  tx: Db,
  id: string,
  expected: { version: number; status: ReportStatus },
  data: Prisma.WeeklyReportUncheckedUpdateManyInput,
): Promise<void> {
  const { count } = await tx.weeklyReport.updateMany({
    where: { id, version: expected.version, status: expected.status },
    data: { ...data, version: { increment: 1 } },
  });
  if (count === 0) throw new AppError("CONFLICT", STALE);
}

function assertVersion(current: number, seen: number): void {
  if (current !== seen) throw new AppError("CONFLICT", STALE);
}

/** Saves the Branch Lead's notes while the report is DRAFT or RETURNED. */
export async function updateReportNotes(
  ctx: ServiceContext,
  id: string,
  input: { version: number; leadNotes: string | null },
): Promise<void> {
  await withRuleErrors(() =>
    ctx.db.$transaction(async (tx) => {
      const report = await loadForChange(tx, ctx, id, "report.draft");
      assertVersion(report.version, input.version);
      if (!notesEditable(report.status)) {
        throw new AppError(
          "RULE_VIOLATION",
          "Notes can only be changed before the report is submitted.",
        );
      }
      await guardedUpdate(tx, id, report, { leadNotes: input.leadNotes });
      await recordAudit(tx, ctx.actor, ctx.request, {
        action: "report.updateNotes",
        entityType: "WeeklyReport",
        entityId: id,
        branchId: report.branchId,
        before: { leadNotes: report.leadNotes, version: report.version },
        after: { leadNotes: input.leadNotes, version: report.version + 1 },
      });
    }),
  );
}

async function transition(
  ctx: ServiceContext,
  id: string,
  kind: ReportTransition | "submission",
  input: { version: number; comment?: string | null },
): Promise<void> {
  const now = ctx.now ?? new Date();
  const action =
    kind === "submission"
      ? "report.submit"
      : kind === "approve"
        ? "report.approve"
        : "report.return";
  await withRuleErrors(() =>
    ctx.db.$transaction(
      async (tx) => {
        const report = await loadForChange(tx, ctx, id, action);
        assertVersion(report.version, input.version);
        const resolved = kind === "submission" ? submissionFor(report.status) : kind;
        const to = resolved ? nextReportStatus(report.status, resolved) : null;
        if (!resolved || !to) {
          throw new AppError(
            "RULE_VIOLATION",
            `A ${report.status.toLowerCase()} report cannot be ${
              kind === "submission" ? "submitted" : kind === "approve" ? "approved" : "returned"
            }.`,
          );
        }

        let data: Prisma.WeeklyReportUncheckedUpdateManyInput;
        let totals: WeeklyTotals | undefined;
        if (resolved === "submit" || resolved === "resubmit") {
          if (!weekIsComplete(report.weekStart, businessToday(now))) {
            throw new AppError(
              "RULE_VIOLATION",
              "A week can be submitted once it has ended (after Sunday).",
            );
          }
          // Section 6.4: totals are frozen into the snapshot on submission.
          totals = await computeWeeklyTotals(tx, report.branchId, report.weekStart);
          data = {
            status: to,
            totalsSnapshot: totals,
            submittedAt: now,
            submittedById: ctx.actor.id,
          };
        } else if (resolved === "approve") {
          data = {
            status: to,
            reviewedAt: now,
            reviewedById: ctx.actor.id,
            reviewComment: input.comment ?? null,
            approvedAt: now,
          };
        } else {
          data = {
            status: to,
            reviewedAt: now,
            reviewedById: ctx.actor.id,
            reviewComment: input.comment ?? null,
          };
        }
        await guardedUpdate(tx, id, report, data);
        await recordAudit(tx, ctx.actor, ctx.request, {
          action: `report.${resolved}`,
          entityType: "WeeklyReport",
          entityId: id,
          branchId: report.branchId,
          before: { status: report.status, version: report.version },
          after: {
            status: to,
            version: report.version + 1,
            ...(input.comment ? { comment: input.comment } : {}),
            ...(totals ? { totals } : {}),
          },
        });
      },
      // The snapshot and the status change are read and written in one consistent view.
      { isolationLevel: "RepeatableRead" },
    ),
  );
}

/** Branch Lead submits a DRAFT or resubmits a RETURNED report; totals are frozen. */
export async function submitReport(
  ctx: ServiceContext,
  id: string,
  version: number,
): Promise<void> {
  await transition(ctx, id, "submission", { version });
}

/** Finance Reviewer approves a SUBMITTED report; it and its week's collections become locked. */
export async function approveReport(
  ctx: ServiceContext,
  id: string,
  input: { version: number; comment: string | null },
): Promise<void> {
  await transition(ctx, id, "approve", input);
}

/** Finance Reviewer returns a SUBMITTED report with a required comment. */
export async function returnReport(
  ctx: ServiceContext,
  id: string,
  input: { version: number; comment: string },
): Promise<void> {
  if (!input.comment.trim()) throw new AppError("VALIDATION", "A returned report needs a comment.");
  await transition(ctx, id, "return", input);
}
