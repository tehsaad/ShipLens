import "server-only";
import {
  addDays,
  businessToday,
  formatBusinessDateTime,
  formatDateOnly,
  parseDateOnly,
} from "@/lib/dates";
import { AppError } from "@/lib/errors";
import {
  BRANCH_STATUS_LABELS,
  PURPOSE_LABELS,
  REPORT_ACTION_LABELS,
  REPORT_STATUS_LABELS,
} from "@/lib/labels";
import { formatAmount } from "@/lib/money";
import { renderMonthlySummaryPdf } from "@/lib/pdf/monthly-summary";
import { renderWeeklyReportPdf } from "@/lib/pdf/weekly-report";
import { authorize } from "@/lib/permissions";
import { auditExport, type ExportFile } from "@/lib/services/exports";
import type { WeeklyTotals } from "@/lib/services/reporting";
import { getReport } from "@/lib/services/reports";
import { found, type ServiceContext } from "@/lib/services/shared";
import type { MonthlySummaryInput } from "@/lib/validation/reports";

/**
 * Server-generated PDFs (section 7.3): the approved weekly report and the monthly branch
 * summary. Both use the report.export permission with branch scope (another branch's
 * report or summary is "not found" for a Branch Lead) and write an EXPORT audit entry.
 */

const PDF = "application/pdf";

const statusLabel = (status: string | null) =>
  status ? (REPORT_STATUS_LABELS[status as keyof typeof REPORT_STATUS_LABELS] ?? status) : null;

const dateTime = (value: Date | null) => (value ? formatBusinessDateTime(value) : null);

/** Who generated the document and when, for the page footers. */
async function generated(ctx: ServiceContext) {
  const now = ctx.now ?? new Date();
  const user = await ctx.db.user.findUniqueOrThrow({
    where: { id: ctx.actor.id },
    select: { name: true },
  });
  return { by: user.name, at: formatBusinessDateTime(now), createdAt: now };
}

/** The PDF of an approved weekly report. Reports in any other state are not final. */
export async function exportReportPdf(ctx: ServiceContext, id: string): Promise<ExportFile> {
  authorize(ctx.actor, "report.export");
  const report = await getReport(ctx, id);
  authorize(ctx.actor, "report.export", { branchId: report.branchId });
  if (report.status !== "APPROVED") {
    throw new AppError("RULE_VIOLATION", "Only approved reports can be downloaded as PDF.");
  }
  const totals = report.totals as WeeklyTotals;
  const weekStart = formatDateOnly(report.weekStart);
  const body = await renderWeeklyReportPdf({
    branch: report.branch,
    weekStart,
    weekEnd: formatDateOnly(addDays(report.weekStart, 6)),
    status: REPORT_STATUS_LABELS[report.status],
    version: report.version,
    submitted: { by: report.submittedBy?.name ?? null, at: dateTime(report.submittedAt) },
    approved: { by: report.reviewedBy?.name ?? null, at: dateTime(report.approvedAt) },
    leadNotes: report.leadNotes,
    reviewComment: report.reviewComment,
    totals: {
      collections: formatAmount(totals.collectionsTotal),
      entries: totals.collectionsCount,
      newMembers: totals.newMembers,
      activeMembers: totals.activeMembers,
    },
    collections: report.collections.map((row) => ({
      date: formatDateOnly(row.collectedOn),
      purpose: PURPOSE_LABELS[row.purpose as keyof typeof PURPOSE_LABELS] ?? row.purpose,
      description: row.description,
      amount: formatAmount(row.amount),
      correction: row.correctsCollectionId !== null,
      routed: dateTime(row.routedAt),
    })),
    history: report.history.map((entry) => ({
      at: formatBusinessDateTime(entry.at),
      action: REPORT_ACTION_LABELS[entry.action] ?? entry.action,
      actor: entry.actor,
      from: statusLabel(entry.from),
      to: statusLabel(entry.to),
      comment: entry.comment,
    })),
    generated: await generated(ctx),
  });
  await auditExport(ctx, {
    action: "report.export",
    entityType: "WeeklyReport",
    entityId: report.id,
    branchId: report.branchId,
    details: { format: "pdf", document: "weeklyReport" },
  });
  return {
    filename: `weekly-report-${report.branch.code}-${weekStart}.pdf`,
    contentType: PDF,
    body: new Uint8Array(body),
  };
}

/**
 * The monthly branch summary. Figures are read in one snapshot. Weekly reports are listed for
 * the weeks that start in the month; "active at the end of the period" counts members with
 * status ACTIVE today who had joined by the end of the month (or today, if earlier), as the
 * weekly totals do.
 */
export async function exportMonthlySummary(
  ctx: ServiceContext,
  input: MonthlySummaryInput,
): Promise<ExportFile> {
  authorize(ctx.actor, "report.export");
  // A Branch Lead may leave the branch out; naming another branch is "not found".
  const branchId = input.branchId ?? ctx.actor.branchId;
  if (!branchId) throw new AppError("VALIDATION", "Choose a branch.");
  authorize(ctx.actor, "report.export", { branchId });

  const today = businessToday(ctx.now ?? new Date());
  const from = parseDateOnly(`${input.month}-01`);
  if (from > today) throw new AppError("VALIDATION", "Choose a month that has started.");
  const monthEnd = addDays(new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + 1)), -1);
  const until = monthEnd < today ? monthEnd : today;

  const branch = found(
    await ctx.db.branch.findUnique({
      where: { id: branchId },
      select: { code: true, name: true, city: true, status: true },
    }),
  );
  const inMonth = { branchId, collectedOn: { gte: from, lte: monthEnd } };
  const sum = { _sum: { amount: true }, _count: { _all: true } } as const;
  const [all, routed, unrouted, corrections, byPurpose, joined, active, reports] =
    await ctx.db.$transaction(
      (tx) =>
        Promise.all([
          tx.collection.aggregate({ where: inMonth, ...sum }),
          tx.collection.aggregate({ where: { ...inMonth, routedAt: { not: null } }, ...sum }),
          tx.collection.aggregate({ where: { ...inMonth, routedAt: null }, ...sum }),
          tx.collection.count({ where: { ...inMonth, correctsCollectionId: { not: null } } }),
          tx.collection.groupBy({
            by: ["purpose"],
            where: inMonth,
            ...sum,
            orderBy: { purpose: "asc" },
          }),
          tx.member.count({ where: { branchId, joinedAt: { gte: from, lte: monthEnd } } }),
          tx.member.count({ where: { branchId, status: "ACTIVE", joinedAt: { lte: until } } }),
          tx.weeklyReport.findMany({
            where: { branchId, weekStart: { gte: from, lte: monthEnd } },
            select: { weekStart: true, status: true, totalsSnapshot: true },
            orderBy: { weekStart: "asc" },
          }),
        ]),
      { isolationLevel: "RepeatableRead" },
    );
  const total = (aggregate: { _sum: { amount: { toString(): string } | null } }) =>
    formatAmount(aggregate._sum.amount ?? "0");

  const body = await renderMonthlySummaryPdf({
    branch: { ...branch, status: BRANCH_STATUS_LABELS[branch.status] },
    month: {
      label: new Intl.DateTimeFormat("en-GB", {
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      }).format(from),
      from: formatDateOnly(from),
      to: formatDateOnly(monthEnd),
      partial: monthEnd > today,
    },
    collections: {
      total: total(all),
      count: all._count._all,
      corrections,
      routed: { total: total(routed), count: routed._count._all },
      unrouted: { total: total(unrouted), count: unrouted._count._all },
    },
    byPurpose: byPurpose.map((row) => ({
      purpose: PURPOSE_LABELS[row.purpose],
      count: row._count._all,
      total: total(row),
    })),
    members: { joined, activeAtEnd: active },
    reports: reports.map((row) => {
      const totals = row.totalsSnapshot as WeeklyTotals | null;
      return {
        weekStart: formatDateOnly(row.weekStart),
        weekEnd: formatDateOnly(addDays(row.weekStart, 6)),
        status: REPORT_STATUS_LABELS[row.status],
        collections: totals ? formatAmount(totals.collectionsTotal) : null,
      };
    }),
    generated: await generated(ctx),
  });
  await auditExport(ctx, {
    action: "report.export",
    entityType: "Branch",
    entityId: branchId,
    branchId,
    details: { format: "pdf", document: "monthlySummary", month: input.month },
  });
  return {
    filename: `monthly-summary-${branch.code}-${input.month}.pdf`,
    contentType: PDF,
    body: new Uint8Array(body),
  };
}
