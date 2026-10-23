import { execFileSync } from "node:child_process";
import { PrismaPg } from "@prisma/adapter-pg";
import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@/lib/generated/prisma/client";
import type { Actor } from "@/lib/permissions";
import { getDashboard } from "@/lib/services/dashboard";
import { demoLogins } from "@/prisma/seed/data";
import { runSeed } from "@/prisma/seed/run";
import { TEST_REQUEST } from "./helpers/context";
import { getTestDatabaseUrl } from "./test-database";

/**
 * docs/sample-data-expected.md (section 10, acceptance): every value listed there, asserted
 * against the seed loaded into a database of its own, so rows written by other test files
 * cannot change the figures. The date is pinned to the seed's last day.
 */

const AS_OF = new Date("2026-10-18T07:00:00Z"); // 12:00 on 18 October 2026, Asia/Karachi

let prisma: PrismaClient;
let sampleUrl: string;

function sampleDatabaseUrl(): string {
  const url = new URL(getTestDatabaseUrl());
  const name = url.pathname.replace(/^\//, "").replace(/_test$/, "_sample_test");
  url.pathname = `/${name}`;
  return url.toString();
}

async function adminQuery(sql: string): Promise<void> {
  const client = new Client({ connectionString: getTestDatabaseUrl() });
  await client.connect();
  try {
    await client.query(sql);
  } finally {
    await client.end();
  }
}

async function actorFor(email: string): Promise<Actor> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { email },
    select: { id: true, role: true, branchId: true },
  });
  return user;
}

async function dashboardFor(email: string) {
  return getDashboard({
    db: prisma,
    actor: await actorFor(email),
    request: TEST_REQUEST,
    now: AS_OF,
  });
}

beforeAll(async () => {
  sampleUrl = sampleDatabaseUrl();
  const name = new URL(sampleUrl).pathname.slice(1);
  await adminQuery(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
  await adminQuery(`CREATE DATABASE "${name}"`);
  execFileSync("npx", ["prisma", "migrate", "deploy"], {
    stdio: "ignore",
    env: { ...process.env, DATABASE_URL: sampleUrl, DATABASE_MIGRATION_URL: sampleUrl },
  });
  prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: sampleUrl }) });
  await runSeed(prisma, "sample-data-demo-password");
});

afterAll(async () => {
  await prisma?.$disconnect();
});

describe("expected dashboard values (docs/sample-data-expected.md)", () => {
  it("matches the head-office figures (Super Admin and Finance Reviewer)", async () => {
    for (const email of [demoLogins.SUPER_ADMIN, demoLogins.FINANCE_REVIEWER]) {
      const dashboard = await dashboardFor(email);
      expect(dashboard.asOf).toBe("2026-10-18");
      expect(dashboard.activeBranches).toBe(4);
      expect(dashboard.finance!.collectionsThisMonth).toEqual({ total: "55000.00", count: 10 });
      expect(dashboard.finance!.unrouted).toEqual({ total: "186000.00", count: 34 });
      expect(dashboard.finance!.reportsAwaitingReview).toEqual({
        count: 2,
        oldestSubmittedAt: new Date("2026-09-21T07:00:00Z"),
      });
      expect(dashboard.membership).toMatchObject({ activeMembers: 32, pendingApplications: 8 });
    }
  });

  it("matches the 12-month trends", async () => {
    const dashboard = await dashboardFor(demoLogins.SUPER_ADMIN);
    expect(dashboard.finance!.collectionTrend.map((point) => [point.month, point.value])).toEqual([
      ["2025-11", "73000.00"],
      ["2025-12", "32500.00"],
      ["2026-01", "77500.00"],
      ["2026-02", "37000.00"],
      ["2026-03", "72500.00"],
      ["2026-04", "41500.00"],
      ["2026-05", "67500.00"],
      ["2026-06", "46000.00"],
      ["2026-07", "62500.00"],
      ["2026-08", "50500.00"],
      ["2026-09", "57500.00"],
      ["2026-10", "55000.00"],
    ]);
    expect(dashboard.membership!.newMemberTrend.map((point) => Number(point.value))).toEqual([
      3, 4, 3, 3, 4, 3, 4, 3, 3, 4, 3, 2,
    ]);
  });

  it("lists unrouted collections oldest first and the overdue weeks per active branch", async () => {
    const dashboard = await dashboardFor(demoLogins.FINANCE_REVIEWER);
    expect(dashboard.finance!.unroutedList.slice(0, 3).map((row) => row.collectedOn)).toEqual([
      "2025-11-04",
      "2025-12-04",
      "2025-12-17",
    ]);
    expect(
      dashboard.finance!.overdueReports.map((row) => [row.code, row.count, row.oldestWeek]),
    ).toEqual([
      ["BR-ISL-001", 89, "2025-01-20"],
      ["BR-KAR-001", 135, "2024-02-26"],
      ["BR-KAR-002", 108, "2024-09-09"],
      ["BR-LAH-001", 126, "2024-05-06"],
    ]);
  });

  it("shows HR membership figures only", async () => {
    const dashboard = await dashboardFor(demoLogins.HR_LEAD);
    expect(dashboard.finance).toBeNull();
    expect(dashboard.membership).toMatchObject({ activeMembers: 32, pendingApplications: 8 });
    expect(dashboard.activeBranches).toBe(4);
  });

  it("shows the Branch Lead its own branch (BR-KAR-001) only", async () => {
    const dashboard = await dashboardFor(demoLogins.BRANCH_LEAD);
    expect(dashboard.branchScope?.code).toBe("BR-KAR-001");
    expect(dashboard.activeBranches).toBeNull();
    expect(dashboard.finance!.collectionsThisMonth).toEqual({ total: "12500.00", count: 3 });
    expect(dashboard.finance!.unrouted).toEqual({ total: "53000.00", count: 10 });
    expect(dashboard.finance!.reportsAwaitingReview.count).toBe(1);
    expect(dashboard.finance!.overdueReports.map((row) => [row.code, row.count])).toEqual([
      ["BR-KAR-001", 135],
    ]);
    expect(dashboard.membership).toMatchObject({ activeMembers: 7, pendingApplications: 2 });
  });

  it("gives the Content Editor no dashboard", async () => {
    await expect(dashboardFor(demoLogins.CONTENT_EDITOR)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});
