/**
 * Writes the section 10 sample data (prisma/seed/data.ts). Only missing records are created,
 * so running it again changes nothing; existing rows, including passwords, are never
 * overwritten.
 */
import { hashPassword } from "../../lib/auth/password";
import { parseDateOnly } from "../../lib/dates";
import type { Prisma, PrismaClient } from "../../lib/generated/prisma/client";
import { computeWeeklyTotals } from "../../lib/services/reporting";
import {
  DEMO_DOMAIN,
  LEGACY_DEMO_DOMAIN,
  applications,
  branches,
  collections,
  contactMessage,
  contentEntries,
  events,
  members,
  reportReviewerId,
  reports,
  reportSubmitterId,
  teams,
  users,
} from "./data";

type Tx = Prisma.TransactionClient;

/** Creates the rows whose ids are not in the table yet; returns how many were created. */
async function createMissing<T extends { id: string }>(
  rows: T[],
  findExisting: (ids: string[]) => Promise<{ id: string }[]>,
  create: (row: T) => Promise<unknown>,
): Promise<number> {
  const existing = new Set((await findExisting(rows.map((row) => row.id))).map((row) => row.id));
  let created = 0;
  for (const row of rows) {
    if (existing.has(row.id)) continue;
    await create(row);
    created += 1;
  }
  return created;
}

/**
 * Moves demo accounts created under the project's competition name to the current demo
 * domain, with the current demo password, so the published logins work on databases seeded
 * before the rename. Only a seeded account whose email is still exactly the old address is
 * changed; one an admin has edited, or whose new address is taken, is left alone. Afterwards
 * no account matches, so later runs change nothing.
 */
async function moveLegacyDemoLogins(tx: Tx, passwordHash: string): Promise<number> {
  let moved = 0;
  for (const user of users) {
    const legacyEmail = user.email.replace(`@${DEMO_DOMAIN}`, `@${LEGACY_DEMO_DOMAIN}`);
    const [legacy, taken] = await Promise.all([
      tx.user.findFirst({ where: { id: user.id, email: legacyEmail }, select: { id: true } }),
      tx.user.findUnique({ where: { email: user.email }, select: { id: true } }),
    ]);
    if (!legacy || taken) continue;
    await tx.user.update({
      where: { id: user.id },
      data: {
        email: user.email,
        passwordHash,
        mustChangePassword: false,
        failedLoginCount: 0,
        lockedUntil: null,
      },
    });
    moved += 1;
  }
  if (moved > 0) {
    // Counts and domains only: no addresses or password material in the append-only log.
    await tx.auditLog.create({
      data: {
        action: "seed.demoLoginsMoved",
        entityType: "Seed",
        before: { domain: LEGACY_DEMO_DOMAIN },
        after: { domain: DEMO_DOMAIN, accounts: moved },
      },
    });
  }
  return moved;
}

async function seed(tx: Tx, passwordHash: string): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};

  // Branches first (without leads), then users, then the lead links.
  counts["branches"] = await createMissing(
    branches,
    (ids) => tx.branch.findMany({ where: { id: { in: ids } }, select: { id: true } }),
    (branch) =>
      tx.branch.create({
        data: {
          id: branch.id,
          code: branch.code,
          name: branch.name,
          city: branch.city,
          status: branch.status,
          openedAt: branch.openedAt ? parseDateOnly(branch.openedAt) : null,
          contactEmail: branch.contactEmail,
        },
      }),
  );

  // Before creating users: a moved account must not be created a second time.
  counts["demoLoginsMoved"] = await moveLegacyDemoLogins(tx, passwordHash);
  counts["users"] = await createMissing(
    users,
    (ids) => tx.user.findMany({ where: { id: { in: ids } }, select: { id: true } }),
    (user) =>
      tx.user.create({
        data: {
          ...user,
          passwordHash,
          // Decision 5a: demo accounts keep their published password usable.
          mustChangePassword: false,
        },
      }),
  );
  for (const user of users) {
    if (user.role === "BRANCH_LEAD" && user.branchId) {
      await tx.branch.updateMany({
        where: { id: user.branchId, leadUserId: null },
        data: { leadUserId: user.id },
      });
    }
  }

  counts["teams"] = await createMissing(
    teams,
    (ids) => tx.team.findMany({ where: { id: { in: ids } }, select: { id: true } }),
    (team) => tx.team.create({ data: team }),
  );

  // Applications before members: accepted members point back to their application.
  counts["applications"] = await createMissing(
    applications,
    (ids) => tx.application.findMany({ where: { id: { in: ids } }, select: { id: true } }),
    // memberId is linked once the member exists (below).
    (application) =>
      tx.application.create({ data: { ...application, memberId: null, consentGiven: true } }),
  );

  const applicationByMember = new Map(
    applications.filter((a) => a.memberId).map((a) => [a.memberId!, a.id]),
  );
  counts["members"] = await createMissing(
    members,
    (ids) => tx.member.findMany({ where: { id: { in: ids } }, select: { id: true } }),
    async ({ teamIds, joinedAt, ...member }) => {
      const applicationId = applicationByMember.get(member.id) ?? null;
      await tx.member.create({
        data: { ...member, joinedAt: parseDateOnly(joinedAt), applicationId },
      });
      for (const team of teamIds) {
        await tx.memberTeam.create({
          data: { memberId: member.id, teamId: team.teamId, roleInTeam: team.roleInTeam },
        });
      }
      if (applicationId) {
        await tx.application.update({
          where: { id: applicationId },
          data: { memberId: member.id },
        });
      }
    },
  );

  // Collections before reports: once a week's report is approved, the database rejects new
  // collections dated in that week (decision 8).
  counts["collections"] = await createMissing(
    collections,
    (ids) => tx.collection.findMany({ where: { id: { in: ids } }, select: { id: true } }),
    ({ collectedOn, ...collection }) =>
      tx.collection.create({ data: { ...collection, collectedOn: parseDateOnly(collectedOn) } }),
  );

  counts["weeklyReports"] = await createMissing(
    reports,
    (ids) => tx.weeklyReport.findMany({ where: { id: { in: ids } }, select: { id: true } }),
    async (report) => {
      const weekStart = parseDateOnly(report.weekStart);
      const totals =
        report.status === "DRAFT"
          ? undefined
          : await computeWeeklyTotals(tx, report.branchId, weekStart);
      await tx.weeklyReport.create({
        data: {
          ...report,
          weekStart,
          ...(totals ? { totalsSnapshot: totals } : {}),
          submittedById: reportSubmitterId(report),
          reviewedById: reportReviewerId(report),
        },
      });
    },
  );

  counts["contentEntries"] = await createMissing(
    contentEntries,
    (ids) => tx.contentEntry.findMany({ where: { id: { in: ids } }, select: { id: true } }),
    (entry) => tx.contentEntry.create({ data: { ...entry, status: "PUBLISHED" } }),
  );

  counts["events"] = await createMissing(
    events,
    (ids) => tx.event.findMany({ where: { id: { in: ids } }, select: { id: true } }),
    (event) => tx.event.create({ data: { ...event, status: "PUBLISHED" } }),
  );

  counts["contactMessages"] = await createMissing(
    [contactMessage],
    (ids) => tx.contactMessage.findMany({ where: { id: { in: ids } }, select: { id: true } }),
    (message) => tx.contactMessage.create({ data: message }),
  );

  const createdTotal = Object.entries(counts)
    .filter(([kind]) => kind !== "demoLoginsMoved")
    .reduce((sum, [, count]) => sum + count, 0);
  if (createdTotal > 0) {
    await tx.auditLog.create({
      data: { action: "seed.applied", entityType: "Seed", after: counts },
    });
  }
  return counts;
}

/** Seeds inside one transaction and returns how many records of each kind were created. */
export async function runSeed(
  prisma: PrismaClient,
  demoPassword: string,
): Promise<Record<string, number>> {
  const passwordHash = await hashPassword(demoPassword);
  return prisma.$transaction((tx) => seed(tx, passwordHash), { timeout: 120_000, maxWait: 10_000 });
}
