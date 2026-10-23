import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "@/lib/generated/prisma/client";
import { parseDateOnly } from "@/lib/dates";
import type { Actor } from "@/lib/permissions";
import {
  approveReport,
  getReport,
  listReports,
  openReport,
  returnReport,
  submitReport,
  updateReportNotes,
} from "@/lib/services/reports";
import { contextFor, createActor } from "./helpers/context";
import { createTestPrisma } from "./helpers/prisma";
import {
  addDays,
  createBranch,
  createCollection,
  insertCollectionSql,
  mondayWeeksAgo,
  pool,
  sqlState,
} from "./helpers/sql";

let prisma: PrismaClient;
let finance: Actor;

/** A branch with its lead, and a collection of 1000 in the week two weeks ago. */
async function setup(amount = 1000) {
  const branchId = await createBranch();
  const lead = await createActor("BRANCH_LEAD", branchId);
  const monday = await mondayWeeksAgo(2);
  await createCollection({
    branchId,
    enteredById: lead.id,
    amount,
    collectedOn: addDays(monday, 1),
  });
  return { branchId, lead, monday, weekStart: parseDateOnly(monday) };
}

async function version(id: string): Promise<number> {
  return (await prisma.weeklyReport.findUniqueOrThrow({ where: { id } })).version;
}

beforeAll(async () => {
  prisma = createTestPrisma();
  finance = await createActor("FINANCE_REVIEWER");
});

afterAll(async () => {
  await prisma.$disconnect();
  await pool.end();
});

describe("report cycle (section 6.4)", () => {
  it("drafts, submits, returns, resubmits and approves, then locks; every step audited", async () => {
    const { branchId, lead, monday, weekStart } = await setup();
    const leadCtx = contextFor(prisma, lead);
    const financeCtx = contextFor(prisma, finance);

    const { id } = await openReport(leadCtx, weekStart);
    expect((await openReport(leadCtx, weekStart)).id).toBe(id);
    let report = await getReport(leadCtx, id);
    expect(report).toMatchObject({ status: "DRAFT", version: 1, totalsLive: true });
    expect(report.totals).toMatchObject({ collectionsTotal: "1000.00", collectionsCount: 1 });

    await updateReportNotes(leadCtx, id, { version: 1, leadNotes: "Receipts attached." });
    await submitReport(leadCtx, id, 2);
    report = await getReport(leadCtx, id);
    expect(report).toMatchObject({ status: "SUBMITTED", version: 3, totalsLive: false });

    // The snapshot is frozen: a later collection in the week does not change it.
    await createCollection({
      branchId,
      enteredById: lead.id,
      amount: 250,
      collectedOn: addDays(monday, 2),
    });
    expect((await getReport(leadCtx, id)).totals.collectionsTotal).toBe("1000.00");

    await returnReport(financeCtx, id, { version: 3, comment: "Add the receipt numbers." });
    report = await getReport(leadCtx, id);
    expect(report).toMatchObject({ status: "RETURNED", reviewComment: "Add the receipt numbers." });
    expect(report.totals.collectionsTotal).toBe("1250.00"); // live again while RETURNED

    await submitReport(leadCtx, id, 4);
    await approveReport(financeCtx, id, { version: 5, comment: null });
    report = await getReport(financeCtx, id);
    expect(report).toMatchObject({ status: "APPROVED", version: 6 });
    expect(report.approvedAt).not.toBeNull();
    expect(report.totals.collectionsTotal).toBe("1250.00");

    // Locked: no more changes to the report, and its week takes no new collections.
    await expect(
      updateReportNotes(leadCtx, id, { version: 6, leadNotes: "Too late" }),
    ).rejects.toMatchObject({ code: "RULE_VIOLATION" });
    await expect(submitReport(leadCtx, id, 6)).rejects.toMatchObject({ code: "RULE_VIOLATION" });
    expect(
      await sqlState(pool, `UPDATE weekly_reports SET lead_notes = 'x' WHERE id = $1`, [id]),
    ).toBe("SL010");
    const [text, values] = insertCollectionSql({
      branchId,
      enteredById: lead.id,
      amount: 10,
      collectedOn: addDays(monday, 3),
    });
    expect(await sqlState(pool, text, values)).toBe("SL002");

    expect(
      report.history.map((entry) => `${entry.action}:${entry.from ?? "-"}>${entry.to ?? "-"}`),
    ).toEqual([
      "report.create:->DRAFT",
      "report.updateNotes:->-",
      "report.submit:DRAFT>SUBMITTED",
      "report.return:SUBMITTED>RETURNED",
      "report.resubmit:RETURNED>SUBMITTED",
      "report.approve:SUBMITTED>APPROVED",
    ]);
    const returned = report.history.find((entry) => entry.action === "report.return");
    expect(returned).toMatchObject({ comment: "Add the receipt numbers.", version: 4 });
  });
});

describe("optimistic locking", () => {
  it("rejects a request made with a stale version", async () => {
    const { lead, weekStart } = await setup();
    const { id } = await openReport(contextFor(prisma, lead), weekStart);
    await updateReportNotes(contextFor(prisma, lead), id, { version: 1, leadNotes: "First" });
    await expect(
      updateReportNotes(contextFor(prisma, lead), id, { version: 1, leadNotes: "Stale tab" }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(submitReport(contextFor(prisma, lead), id, 1)).rejects.toMatchObject({
      code: "CONFLICT",
    });
    expect(await version(id)).toBe(2);
  });

  it("lets only one of two concurrent reviews win", async () => {
    const { lead, weekStart } = await setup();
    const { id } = await openReport(contextFor(prisma, lead), weekStart);
    await submitReport(contextFor(prisma, lead), id, 1);
    const results = await Promise.allSettled([
      approveReport(contextFor(prisma, finance), id, { version: 2, comment: null }),
      returnReport(contextFor(prisma, finance), id, { version: 2, comment: "Check the totals" }),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find(
      (result) => result.status === "rejected",
    ) as PromiseRejectedResult;
    expect(rejected.reason).toMatchObject({ code: "CONFLICT" });
    expect(await version(id)).toBe(3);
  });
});

describe("rules and permissions", () => {
  it("needs a comment to return, and only submits completed weeks", async () => {
    const { lead, weekStart } = await setup();
    const { id } = await openReport(contextFor(prisma, lead), weekStart);
    await submitReport(contextFor(prisma, lead), id, 1);
    await expect(
      returnReport(contextFor(prisma, finance), id, { version: 2, comment: "  " }),
    ).rejects.toMatchObject({ code: "VALIDATION" });

    const current = await openReport(
      contextFor(prisma, lead),
      parseDateOnly(await mondayWeeksAgo(0)),
    );
    await expect(submitReport(contextFor(prisma, lead), current.id, 1)).rejects.toMatchObject({
      code: "RULE_VIOLATION",
    });
    await expect(
      openReport(contextFor(prisma, lead), parseDateOnly(await mondayWeeksAgo(-1))),
    ).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("keeps each role to its own steps", async () => {
    const { lead, weekStart } = await setup();
    const { id } = await openReport(contextFor(prisma, lead), weekStart);
    await expect(submitReport(contextFor(prisma, finance), id, 1)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await submitReport(contextFor(prisma, lead), id, 1);
    await expect(
      approveReport(contextFor(prisma, lead), id, { version: 2, comment: null }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    const admin = await createActor("SUPER_ADMIN");
    await expect(
      approveReport(contextFor(prisma, admin), id, { version: 2, comment: null }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(getReport(contextFor(prisma, admin), id)).resolves.toHaveProperty("id", id);
  });

  it("hides another branch's report from a Branch Lead (IDOR)", async () => {
    const own = await setup();
    const other = await setup();
    const { id } = await openReport(contextFor(prisma, other.lead), other.weekStart);
    const ctx = contextFor(prisma, own.lead);
    await expect(getReport(ctx, id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(submitReport(ctx, id, 1)).rejects.toMatchObject({ code: "NOT_FOUND" });
    const page = await listReports(ctx, { branchId: other.branchId });
    expect(page.items.map((report) => report.id)).not.toContain(id);
  });
});
