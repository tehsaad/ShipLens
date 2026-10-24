import "server-only";
import { toCsv, type CsvValue } from "@/lib/csv";
import { addDays, businessToday, formatBusinessDateTime, formatDateOnly } from "@/lib/dates";
import { AppError } from "@/lib/errors";
import { logEvent } from "@/lib/log";
import {
  APPLICATION_STATUS_LABELS,
  AVAILABILITY_LABELS,
  MEMBER_STATUS_LABELS,
  PURPOSE_LABELS,
  REPORT_STATUS_LABELS,
} from "@/lib/labels";
import { authorize, type Action } from "@/lib/permissions";
import { applicationWhere, type ApplicationFilters } from "@/lib/services/applications";
import { recordAudit } from "@/lib/services/audit";
import { collectionWhere } from "@/lib/services/collections";
import { memberWhere } from "@/lib/services/members";
import type { WeeklyTotals } from "@/lib/services/reporting";
import { REPORT_LIST_ORDER, reportWhere, type ReportFilters } from "@/lib/services/reports";
import { listScope, type ServiceContext } from "@/lib/services/shared";
import type { CollectionFilters } from "@/lib/validation/collections";
import type { MemberFilters } from "@/lib/validation/members";

/**
 * Exports (section 7.3). Each one covers the rows the actor may read with the list's own
 * filters (a Branch Lead stays inside its own branch whatever the request asks for), and
 * writes an EXPORT audit entry naming the filters and the row count, never the rows.
 */

export type ExportFile = {
  filename: string;
  contentType: string;
  body: string | Uint8Array<ArrayBuffer>;
};

/** Larger exports are refused rather than built in memory; the filters can narrow them. */
export const MAX_EXPORT_ROWS = 10_000;

const take = MAX_EXPORT_ROWS + 1;

function capped<T>(rows: T[]): T[] {
  if (rows.length > MAX_EXPORT_ROWS) {
    throw new AppError(
      "VALIDATION",
      `More than ${MAX_EXPORT_ROWS.toLocaleString("en")} rows match. Narrow the filters and export again.`,
    );
  }
  return rows;
}

/** The filters that were set, for the audit entry. */
function setFilters(filters: object): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(filters).filter(([, value]) => value !== null && value !== undefined),
  );
}

export type ExportAudit = {
  action: Action;
  entityType: string;
  entityId?: string | null;
  branchId?: string | null;
  details: Record<string, unknown>;
};

/** Writes the EXPORT audit entry; an export that cannot be audited is not served (A09). */
export async function auditExport(ctx: ServiceContext, entry: ExportAudit): Promise<void> {
  await recordAudit(ctx.db, ctx.actor, ctx.request, {
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId ?? null,
    branchId: entry.branchId ?? null,
    after: entry.details,
  });
  logEvent("info", "export", {
    action: entry.action,
    actorId: ctx.actor.id,
    entityId: entry.entityId ?? null,
    requestId: ctx.request.requestId,
  });
}

/** `<name>-<business date>.csv` */
function filename(ctx: ServiceContext, name: string, extension = "csv"): string {
  return `${name}-${formatDateOnly(businessToday(ctx.now ?? new Date()))}.${extension}`;
}

async function csvExport(
  ctx: ServiceContext,
  name: string,
  header: readonly string[],
  rows: CsvValue[][],
  audit: Omit<ExportAudit, "details"> & { filters: object },
): Promise<ExportFile> {
  await auditExport(ctx, {
    ...audit,
    details: { format: "csv", rows: rows.length, filters: setFilters(audit.filters) },
  });
  return {
    filename: filename(ctx, name),
    contentType: "text/csv; charset=utf-8",
    body: toCsv(header, rows),
  };
}

const dateTime = (value: Date | null) => (value ? formatBusinessDateTime(value) : null);

export async function exportCollections(
  ctx: ServiceContext,
  filters: Partial<CollectionFilters>,
): Promise<ExportFile> {
  const scope = listScope(ctx.actor, "collection.export");
  const rows = capped(
    await ctx.db.collection.findMany({
      where: collectionWhere(scope, filters),
      select: {
        id: true,
        collectedOn: true,
        branch: { select: { code: true } },
        amount: true,
        purpose: true,
        description: true,
        correctsCollectionId: true,
        correctionNote: true,
        lockedAt: true,
        routedAt: true,
        routingReference: true,
        createdAt: true,
      },
      orderBy: [{ collectedOn: "asc" }, { createdAt: "asc" }],
      take,
    }),
  );
  return csvExport(
    ctx,
    "collections",
    [
      "Collection ID",
      "Date",
      "Branch",
      "Amount (PKR)",
      "Purpose",
      "Description",
      "Correction of",
      "Correction reason",
      "Editable until (PKT)",
      "Routed at (PKT)",
      "Routing reference",
      "Entered at (PKT)",
    ],
    rows.map((row) => [
      row.id,
      formatDateOnly(row.collectedOn),
      row.branch.code,
      row.amount.toFixed(2),
      PURPOSE_LABELS[row.purpose],
      row.description,
      row.correctsCollectionId,
      row.correctionNote,
      dateTime(row.lockedAt),
      dateTime(row.routedAt),
      row.routingReference,
      dateTime(row.createdAt),
    ]),
    {
      action: "collection.export",
      entityType: "Collection",
      branchId: scope.branchId ?? filters.branchId,
      filters,
    },
  );
}

export async function exportMembers(
  ctx: ServiceContext,
  filters: Partial<MemberFilters>,
): Promise<ExportFile> {
  const scope = listScope(ctx.actor, "member.export");
  const rows = capped(
    await ctx.db.member.findMany({
      where: memberWhere(scope, filters),
      select: {
        memberCode: true,
        fullName: true,
        email: true,
        phone: true,
        status: true,
        joinedAt: true,
        branch: { select: { code: true } },
        teams: { select: { team: { select: { name: true } } } },
      },
      orderBy: { memberCode: "asc" },
      take,
    }),
  );
  return csvExport(
    ctx,
    "members",
    ["Member code", "Full name", "Email", "Phone", "Branch", "Status", "Joined on", "Teams"],
    rows.map((row) => [
      row.memberCode,
      row.fullName,
      row.email,
      row.phone,
      row.branch.code,
      MEMBER_STATUS_LABELS[row.status],
      formatDateOnly(row.joinedAt),
      row.teams
        .map(({ team }) => team.name)
        .sort()
        .join("; "),
    ]),
    {
      action: "member.export",
      entityType: "Member",
      branchId: scope.branchId ?? filters.branchId,
      filters,
    },
  );
}

/**
 * Applications without their free text (skills, motivation): the export is for following up
 * applicants, and the full answers stay on the detail screen (data minimisation, section 8).
 */
export async function exportApplications(
  ctx: ServiceContext,
  filters: ApplicationFilters,
): Promise<ExportFile> {
  authorize(ctx.actor, "application.export");
  const rows = capped(
    await ctx.db.application.findMany({
      where: applicationWhere(filters),
      select: {
        createdAt: true,
        fullName: true,
        email: true,
        phone: true,
        availability: true,
        status: true,
        decidedAt: true,
        preferredBranch: { select: { code: true } },
        member: { select: { memberCode: true } },
      },
      orderBy: { createdAt: "asc" },
      take,
    }),
  );
  return csvExport(
    ctx,
    "applications",
    [
      "Submitted at (PKT)",
      "Full name",
      "Email",
      "Phone",
      "Preferred branch",
      "Availability",
      "Status",
      "Decided at (PKT)",
      "Member code",
    ],
    rows.map((row) => [
      dateTime(row.createdAt),
      row.fullName,
      row.email,
      row.phone,
      row.preferredBranch.code,
      AVAILABILITY_LABELS[row.availability],
      APPLICATION_STATUS_LABELS[row.status],
      dateTime(row.decidedAt),
      row.member?.memberCode ?? null,
    ]),
    { action: "application.export", entityType: "Application", filters },
  );
}

/** Weekly reports with the totals frozen at submission (blank while a report is a draft). */
export async function exportReports(
  ctx: ServiceContext,
  filters: ReportFilters,
): Promise<ExportFile> {
  const scope = listScope(ctx.actor, "report.export");
  const rows = capped(
    await ctx.db.weeklyReport.findMany({
      where: reportWhere(scope, filters),
      select: {
        branch: { select: { code: true, name: true } },
        weekStart: true,
        status: true,
        submittedAt: true,
        reviewedAt: true,
        approvedAt: true,
        totalsSnapshot: true,
        version: true,
      },
      orderBy: REPORT_LIST_ORDER,
      take,
    }),
  );
  return csvExport(
    ctx,
    "weekly-reports",
    [
      "Branch",
      "Branch name",
      "Week start",
      "Week end",
      "Status",
      "Submitted at (PKT)",
      "Reviewed at (PKT)",
      "Approved at (PKT)",
      "Collections total (PKR)",
      "Collections",
      "New members",
      "Active members",
      "Version",
    ],
    rows.map((row) => {
      const totals = row.totalsSnapshot as WeeklyTotals | null;
      return [
        row.branch.code,
        row.branch.name,
        formatDateOnly(row.weekStart),
        formatDateOnly(addDays(row.weekStart, 6)),
        REPORT_STATUS_LABELS[row.status],
        dateTime(row.submittedAt),
        dateTime(row.reviewedAt),
        dateTime(row.approvedAt),
        totals?.collectionsTotal,
        totals?.collectionsCount,
        totals?.newMembers,
        totals?.activeMembers,
        row.version,
      ];
    }),
    {
      action: "report.export",
      entityType: "WeeklyReport",
      branchId: scope.branchId ?? filters.branchId,
      filters,
    },
  );
}

/**
 * The dashboard's unrouted list (section 7.3): every collection not yet routed to the main
 * account, oldest first, for the branches the actor's dashboard covers. The dashboard itself
 * shows the oldest 25; the export has them all.
 */
export async function exportUnrouted(ctx: ServiceContext): Promise<ExportFile> {
  const scope = listScope(ctx.actor, "dashboard.exportUnrouted");
  const rows = capped(
    await ctx.db.collection.findMany({
      where: { ...scope, routedAt: null },
      select: {
        id: true,
        collectedOn: true,
        amount: true,
        purpose: true,
        description: true,
        createdAt: true,
        branch: { select: { code: true } },
      },
      orderBy: [{ collectedOn: "asc" }, { createdAt: "asc" }],
      take,
    }),
  );
  return csvExport(
    ctx,
    "unrouted-collections",
    [
      "Collection ID",
      "Branch",
      "Date",
      "Amount (PKR)",
      "Purpose",
      "Description",
      "Entered at (PKT)",
    ],
    rows.map((row) => [
      row.id,
      row.branch.code,
      formatDateOnly(row.collectedOn),
      row.amount.toFixed(2),
      PURPOSE_LABELS[row.purpose],
      row.description,
      dateTime(row.createdAt),
    ]),
    {
      action: "dashboard.exportUnrouted",
      entityType: "Collection",
      branchId: scope.branchId,
      filters: {},
    },
  );
}
