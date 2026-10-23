import "server-only";
import type { Prisma } from "@/lib/generated/prisma/client";
import { businessToday, formatDateOnly, parseDateOnly } from "@/lib/dates";
import { fromPaisa, toPaisa } from "@/lib/money";
import { authorize, can, scopeFor } from "@/lib/permissions";
import { overdueWeeks } from "@/lib/rules/report";
import type { ServiceContext } from "@/lib/services/shared";

/**
 * Dashboard (section 7.2) with the exact KPI definitions from the spec. Finance figures go
 * to SUPER_ADMIN, FINANCE_REVIEWER and BRANCH_LEAD; membership figures to those and HR_LEAD.
 * A Branch Lead's figures cover its own branch only. `now` is injectable so the sample-data
 * test (docs/sample-data-expected.md) can pin the date.
 */

export type MonthPoint = { month: string; value: string };

export type OverdueBranch = {
  branchId: string;
  code: string;
  name: string;
  count: number;
  oldestWeek: string;
};

export type UnroutedRow = {
  id: string;
  branchCode: string;
  amount: string;
  collectedOn: string;
};

export type Dashboard = {
  /** The business date the figures describe (Asia/Karachi). */
  asOf: string;
  /** Null when the actor sees all branches. */
  branchScope: { id: string; code: string } | null;
  finance: {
    collectionsThisMonth: { total: string; count: number };
    unrouted: { total: string; count: number };
    reportsAwaitingReview: { count: number; oldestSubmittedAt: Date | null };
    collectionTrend: MonthPoint[];
    unroutedList: UnroutedRow[];
    overdueReports: OverdueBranch[];
  } | null;
  membership: {
    activeMembers: number;
    pendingApplications: number;
    newMemberTrend: MonthPoint[];
  } | null;
  /** Count of ACTIVE branches; only for roles that see every branch. */
  activeBranches: number | null;
};

/** Number of rows in the dashboard's unrouted table (oldest first). */
export const UNROUTED_LIST_SIZE = 25;

/** The first day of the month `offset` months from the month of `date` (UTC date-only). */
function monthStart(date: Date, offset = 0): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + offset, 1));
}

/** The 12 months ending with the current one, as YYYY-MM, oldest first. */
function lastTwelveMonths(today: Date): string[] {
  return Array.from({ length: 12 }, (_, index) =>
    formatDateOnly(monthStart(today, index - 11)).slice(0, 7),
  );
}

export async function getDashboard(ctx: ServiceContext): Promise<Dashboard> {
  const { db, actor } = ctx;
  authorize(actor, "dashboard.view");
  const today = businessToday(ctx.now ?? new Date());
  const ownBranch = scopeFor(actor.role, "dashboard.view") === "ownBranch";
  const branchWhere = ownBranch ? { branchId: actor.branchId! } : {};
  const months = lastTwelveMonths(today);
  const trendStart = parseDateOnly(`${months[0]}-01`);

  const branchScope = ownBranch
    ? await db.branch.findUniqueOrThrow({
        where: { id: actor.branchId! },
        select: { id: true, code: true },
      })
    : null;

  let finance: Dashboard["finance"] = null;
  if (can(actor, "dashboard.viewFinance")) {
    const thisMonth = { gte: monthStart(today), lt: monthStart(today, 1) };
    const unroutedWhere: Prisma.CollectionWhereInput = { ...branchWhere, routedAt: null };
    const [month, unrouted, awaiting, oldest, trendRows, unroutedRows, overdueReports] =
      await Promise.all([
        db.collection.aggregate({
          where: { ...branchWhere, collectedOn: thisMonth },
          _sum: { amount: true },
          _count: { _all: true },
        }),
        db.collection.aggregate({
          where: unroutedWhere,
          _sum: { amount: true },
          _count: { _all: true },
        }),
        db.weeklyReport.count({ where: { ...branchWhere, status: "SUBMITTED" } }),
        db.weeklyReport.findFirst({
          where: { ...branchWhere, status: "SUBMITTED" },
          orderBy: { submittedAt: "asc" },
          select: { submittedAt: true },
        }),
        db.collection.groupBy({
          by: ["collectedOn"],
          where: { ...branchWhere, collectedOn: { gte: trendStart, lt: monthStart(today, 1) } },
          _sum: { amount: true },
        }),
        db.collection.findMany({
          where: unroutedWhere,
          select: { id: true, amount: true, collectedOn: true, branch: { select: { code: true } } },
          orderBy: [{ collectedOn: "asc" }, { createdAt: "asc" }],
          take: UNROUTED_LIST_SIZE,
        }),
        overdue(ctx, today, ownBranch),
      ]);

    const byMonth = new Map(months.map((key) => [key, 0n]));
    for (const row of trendRows) {
      const key = formatDateOnly(row.collectedOn).slice(0, 7);
      byMonth.set(key, (byMonth.get(key) ?? 0n) + toPaisa(row._sum.amount?.toString() ?? "0"));
    }

    finance = {
      collectionsThisMonth: {
        total: month._sum.amount?.toFixed(2) ?? "0.00",
        count: month._count._all,
      },
      unrouted: { total: unrouted._sum.amount?.toFixed(2) ?? "0.00", count: unrouted._count._all },
      reportsAwaitingReview: { count: awaiting, oldestSubmittedAt: oldest?.submittedAt ?? null },
      collectionTrend: months.map((key) => ({ month: key, value: fromPaisa(byMonth.get(key)!) })),
      unroutedList: unroutedRows.map((row) => ({
        id: row.id,
        branchCode: row.branch.code,
        amount: row.amount.toFixed(2),
        collectedOn: formatDateOnly(row.collectedOn),
      })),
      overdueReports,
    };
  }

  let membership: Dashboard["membership"] = null;
  if (can(actor, "dashboard.viewMembership")) {
    const [activeMembers, pendingApplications, joined] = await Promise.all([
      db.member.count({ where: { ...branchWhere, status: "ACTIVE" } }),
      db.application.count({
        where: {
          status: "NEW",
          ...(ownBranch ? { preferredBranchId: actor.branchId! } : {}),
        },
      }),
      db.member.groupBy({
        by: ["joinedAt"],
        where: { ...branchWhere, joinedAt: { gte: trendStart, lt: monthStart(today, 1) } },
        _count: { _all: true },
      }),
    ]);
    const byMonth = new Map(months.map((key) => [key, 0]));
    for (const row of joined) {
      const key = formatDateOnly(row.joinedAt).slice(0, 7);
      byMonth.set(key, (byMonth.get(key) ?? 0) + row._count._all);
    }
    membership = {
      activeMembers,
      pendingApplications,
      newMemberTrend: months.map((key) => ({ month: key, value: String(byMonth.get(key)!) })),
    };
  }

  const activeBranches = ownBranch ? null : await db.branch.count({ where: { status: "ACTIVE" } });

  return { asOf: formatDateOnly(today), branchScope, finance, membership, activeBranches };
}

/**
 * Decision 9: for each ACTIVE branch, the completed weeks since it opened with no SUBMITTED
 * or APPROVED report. Calculated on request; no tables or columns are added.
 */
async function overdue(
  { db, actor }: ServiceContext,
  today: Date,
  ownBranch: boolean,
): Promise<OverdueBranch[]> {
  const branches = await db.branch.findMany({
    where: {
      status: "ACTIVE",
      openedAt: { not: null },
      ...(ownBranch ? { id: actor.branchId! } : {}),
    },
    select: { id: true, code: true, name: true, openedAt: true },
    orderBy: { code: "asc" },
  });
  if (branches.length === 0) return [];
  const filed = await db.weeklyReport.findMany({
    where: {
      branchId: { in: branches.map((branch) => branch.id) },
      status: { in: ["SUBMITTED", "APPROVED"] },
    },
    select: { branchId: true, weekStart: true },
  });
  const filedByBranch = new Map<string, Set<string>>();
  for (const report of filed) {
    const set = filedByBranch.get(report.branchId) ?? new Set<string>();
    set.add(formatDateOnly(report.weekStart));
    filedByBranch.set(report.branchId, set);
  }
  return branches.flatMap((branch) => {
    const weeks = overdueWeeks(branch.openedAt!, today, filedByBranch.get(branch.id) ?? new Set());
    if (weeks.length === 0) return [];
    return [
      {
        branchId: branch.id,
        code: branch.code,
        name: branch.name,
        count: weeks.length,
        oldestWeek: formatDateOnly(weeks[0]!),
      },
    ];
  });
}
