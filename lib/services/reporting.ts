import type { Prisma, PrismaClient } from "@/lib/generated/prisma/client";
import { addDays } from "@/lib/dates";

type Db = PrismaClient | Prisma.TransactionClient;

/** The totals stored in WeeklyReport.totalsSnapshot (section 5). */
export type WeeklyTotals = {
  /** PKR with two decimals; net of correction entries (amendment A1). */
  collectionsTotal: string;
  /** Collection rows dated in the week, including correction entries. */
  collectionsCount: number;
  /** Members of the branch who joined during the week. */
  newMembers: number;
  /** Members of the branch with status ACTIVE who had joined by the end of the week. */
  activeMembers: number;
};

/** Computes a branch's totals for the week starting on `weekStart` (a Monday). */
export async function computeWeeklyTotals(
  db: Db,
  branchId: string,
  weekStart: Date,
): Promise<WeeklyTotals> {
  const weekEnd = addDays(weekStart, 6);
  const collections = await db.collection.aggregate({
    where: { branchId, collectedOn: { gte: weekStart, lte: weekEnd } },
    _sum: { amount: true },
    _count: { _all: true },
  });
  const newMembers = await db.member.count({
    where: { branchId, joinedAt: { gte: weekStart, lte: weekEnd } },
  });
  const activeMembers = await db.member.count({
    where: { branchId, status: "ACTIVE", joinedAt: { lte: weekEnd } },
  });
  return {
    collectionsTotal: (collections._sum.amount?.toFixed(2) ?? "0.00").toString(),
    collectionsCount: collections._count._all,
    newMembers,
    activeMembers,
  };
}
