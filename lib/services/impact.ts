import "server-only";
import type { PrismaClient } from "@/lib/generated/prisma/client";
import { authorize } from "@/lib/permissions";

/**
 * Aggregate, network-wide figures shown to the public on the home page so visitors and
 * would-be supporters can see the movement's reach at a glance.
 *
 * Aggregate only: counts and one network total. No member names, no per-branch breakdown and
 * no per-person amounts are read or returned here (SPEC section 3 keeps the PUBLIC role to
 * published content and active branches; these roll-ups add nothing a visitor could trace to
 * a person). See the `impact.readPublic` grant in lib/permissions.ts.
 */
export type PublicImpact = {
  activeBranches: number;
  cities: number;
  activeMembers: number;
  collections: number;
  totalRaisedPkr: number;
};

export async function getPublicImpact(db: PrismaClient): Promise<PublicImpact> {
  authorize(null, "impact.readPublic");

  const [activeBranches, activeCities, activeMembers, collections, raised] = await Promise.all([
    db.branch.count({ where: { status: "ACTIVE" } }),
    db.branch.findMany({ where: { status: "ACTIVE" }, select: { city: true }, distinct: ["city"] }),
    db.member.count({ where: { status: "ACTIVE" } }),
    db.collection.count(),
    db.collection.aggregate({ _sum: { amount: true } }),
  ]);

  return {
    activeBranches,
    cities: activeCities.length,
    activeMembers,
    collections,
    // Decimal(14,2) → whole PKR. Rounded down to a whole rupee for display.
    totalRaisedPkr: Math.floor(Number(raised._sum.amount ?? 0)),
  };
}
