import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "@/lib/generated/prisma/client";
import { parseDateOnly } from "@/lib/dates";
import type { Actor } from "@/lib/permissions";
import {
  createCollection,
  createCorrection,
  getCollection,
  listCollections,
  routeCollection,
  updateCollection,
} from "@/lib/services/collections";
import { contextFor, createActor } from "./helpers/context";
import { createTestPrisma } from "./helpers/prisma";
import {
  addDays,
  businessDate,
  createBranch,
  createCollection as insertCollection,
  mondayWeeksAgo,
  pool,
  setBranchStatus,
} from "./helpers/sql";

let prisma: PrismaClient;
let branchId: string;
let lead: Actor;
let finance: Actor;
let today: string;

const date = (iso: string) => parseDateOnly(iso);

async function approveWeek(branch: string, weekStart: string): Promise<void> {
  await pool.query(
    `INSERT INTO weekly_reports (branch_id, week_start, status, approved_at)
     VALUES ($1, $2::date, 'APPROVED', now())`,
    [branch, weekStart],
  );
}

/** A collection created 8 days ago, so its 7-day lock has passed. */
async function lockedCollection(
  branch: string,
  enteredById: string,
  amount = 100,
): Promise<string> {
  return insertCollection({
    branchId: branch,
    enteredById,
    amount,
    collectedOn: await businessDate(-8),
    createdAt: new Date(Date.now() - 8 * 24 * 3600 * 1000).toISOString(),
  });
}

beforeAll(async () => {
  prisma = createTestPrisma();
  branchId = await createBranch();
  lead = await createActor("BRANCH_LEAD", branchId);
  finance = await createActor("FINANCE_REVIEWER");
  today = await businessDate();
});

afterAll(async () => {
  await prisma.$disconnect();
  await pool.end();
});

describe("createCollection (section 6.3)", () => {
  it("records an entry for the lead's own branch, locked 7 days after creation", async () => {
    const { id } = await createCollection(contextFor(prisma, lead), {
      amount: "1500.00",
      collectedOn: date(today),
      purpose: "DONATION",
      description: "Friday collection",
    });
    const row = await prisma.collection.findUniqueOrThrow({ where: { id } });
    expect(row.branchId).toBe(branchId);
    expect(row.lockedAt.getTime() - row.createdAt.getTime()).toBe(7 * 24 * 3600 * 1000);
    expect(
      await prisma.auditLog.count({ where: { action: "collection.create", entityId: id } }),
    ).toBe(1);
  });

  it("rejects zero amounts and future dates with clear messages", async () => {
    const ctx = contextFor(prisma, lead);
    await expect(
      createCollection(ctx, {
        amount: "0",
        collectedOn: date(today),
        purpose: "GENERAL",
        description: null,
      }),
    ).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(
      createCollection(ctx, {
        amount: "10",
        collectedOn: date(addDays(today, 1)),
        purpose: "GENERAL",
        description: null,
      }),
    ).rejects.toMatchObject({ code: "VALIDATION", message: expect.stringContaining("future") });
  });

  it("rejects a date in an approved week (decision 8)", async () => {
    const branch = await createBranch();
    const branchLead = await createActor("BRANCH_LEAD", branch);
    const monday = await mondayWeeksAgo(2);
    await approveWeek(branch, monday);
    await expect(
      createCollection(contextFor(prisma, branchLead), {
        amount: "10",
        collectedOn: date(addDays(monday, 2)),
        purpose: "GENERAL",
        description: null,
      }),
    ).rejects.toMatchObject({
      code: "RULE_VIOLATION",
      message: expect.stringContaining("approved"),
    });
  });

  it("rejects entries for a closed branch", async () => {
    const branch = await createBranch();
    const branchLead = await createActor("BRANCH_LEAD", branch);
    await setBranchStatus(branch, "CLOSED");
    await expect(
      createCollection(contextFor(prisma, branchLead), {
        amount: "10",
        collectedOn: date(today),
        purpose: "GENERAL",
        description: null,
      }),
    ).rejects.toMatchObject({ code: "RULE_VIOLATION" });
  });

  it("is refused to every role but Branch Lead", async () => {
    for (const role of ["SUPER_ADMIN", "FINANCE_REVIEWER", "HR_LEAD"] as const) {
      await expect(
        createCollection(contextFor(prisma, await createActor(role)), {
          amount: "10",
          collectedOn: date(today),
          purpose: "GENERAL",
          description: null,
        }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    }
  });
});

describe("updateCollection and the 7-day lock", () => {
  it("edits an unlocked entry and audits before and after", async () => {
    const id = await insertCollection({
      branchId,
      enteredById: lead.id,
      amount: 100,
      collectedOn: today,
    });
    await updateCollection(contextFor(prisma, lead), id, {
      amount: "120.50",
      collectedOn: date(today),
      purpose: "EVENT",
      description: "Corrected count",
      correctionNote: null,
    });
    const row = await prisma.collection.findUniqueOrThrow({ where: { id } });
    expect(row.amount.toFixed(2)).toBe("120.50");
    const audit = await prisma.auditLog.findFirstOrThrow({
      where: { action: "collection.update", entityId: id },
    });
    expect(audit.before).toMatchObject({ amount: "100" });
    expect(audit.after).toMatchObject({ amount: "120.50" });
  });

  it("refuses to edit a locked entry in the service, before the trigger", async () => {
    const id = await lockedCollection(branchId, lead.id);
    const detail = await getCollection(contextFor(prisma, lead), id);
    expect(detail.lockReason).toBe("LOCKED");
    await expect(
      updateCollection(contextFor(prisma, lead), id, {
        amount: "90",
        collectedOn: detail.collectedOn,
        purpose: "GENERAL",
        description: null,
        correctionNote: null,
      }),
    ).rejects.toMatchObject({ code: "RULE_VIOLATION", message: expect.stringContaining("7 days") });
  });

  it("refuses to edit an entry whose week is approved", async () => {
    const branch = await createBranch();
    const branchLead = await createActor("BRANCH_LEAD", branch);
    const id = await insertCollection({
      branchId: branch,
      enteredById: branchLead.id,
      amount: 50,
      collectedOn: today,
    });
    const row = await prisma.collection.findUniqueOrThrow({ where: { id } });
    await approveWeek(branch, await mondayWeeksAgo(0));
    expect((await getCollection(contextFor(prisma, branchLead), id)).lockReason).toBe(
      "WEEK_APPROVED",
    );
    await expect(
      updateCollection(contextFor(prisma, branchLead), id, {
        amount: "60",
        collectedOn: row.collectedOn,
        purpose: "GENERAL",
        description: null,
        correctionNote: null,
      }),
    ).rejects.toMatchObject({ code: "RULE_VIOLATION" });
  });

  it("hides another branch's collection as not found", async () => {
    const other = await createBranch();
    const otherLead = await createActor("BRANCH_LEAD", other);
    const id = await insertCollection({
      branchId: other,
      enteredById: otherLead.id,
      amount: 10,
      collectedOn: today,
    });
    const ctx = contextFor(prisma, lead);
    await expect(getCollection(ctx, id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      updateCollection(ctx, id, {
        amount: "1",
        collectedOn: date(today),
        purpose: "GENERAL",
        description: null,
        correctionNote: null,
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      createCorrection(ctx, id, { amount: "-1", correctionNote: "Wrong branch" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    const page = await listCollections(ctx, { branchId: other });
    expect(page.items.map((row) => row.id)).not.toContain(id);
  });
});

describe("corrections (amendment A1)", () => {
  it("corrects a locked original downwards, dated today, and audits both ids", async () => {
    const originalId = await lockedCollection(branchId, lead.id, 200);
    const { id } = await createCorrection(contextFor(prisma, lead), originalId, {
      amount: "-50",
      correctionNote: "Counted one bundle twice",
    });
    const correction = await prisma.collection.findUniqueOrThrow({ where: { id } });
    expect(correction).toMatchObject({ correctsCollectionId: originalId, branchId });
    expect(correction.collectedOn.toISOString().slice(0, 10)).toBe(today);

    const audit = await prisma.auditLog.findFirstOrThrow({
      where: { action: "collection.correct", entityId: id },
    });
    expect(audit.after).toMatchObject({
      originalId,
      correctionId: id,
      amount: "-50.00",
      reason: "Counted one bundle twice",
    });
    expect((await getCollection(contextFor(prisma, lead), originalId)).netAmount).toBe("150.00");
  });

  it("never takes the original below zero, and never corrects a correction", async () => {
    const originalId = await lockedCollection(branchId, lead.id, 100);
    const ctx = contextFor(prisma, lead);
    const { id } = await createCorrection(ctx, originalId, {
      amount: "-60",
      correctionNote: "Partial refund",
    });
    await expect(
      createCorrection(ctx, originalId, { amount: "-40.01", correctionNote: "Too much" }),
    ).rejects.toMatchObject({ code: "RULE_VIOLATION" });
    await expect(
      createCorrection(ctx, id, { amount: "5", correctionNote: "Chained" }),
    ).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(
      createCorrection(ctx, originalId, { amount: "0", correctionNote: "Zero" }),
    ).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("stops concurrent corrections in the database when both pass the service check", async () => {
    const originalId = await lockedCollection(branchId, lead.id, 100);
    const results = await Promise.allSettled([
      createCorrection(contextFor(prisma, lead), originalId, {
        amount: "-70",
        correctionNote: "First",
      }),
      createCorrection(contextFor(prisma, lead), originalId, {
        amount: "-70",
        correctionNote: "Second",
      }),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find(
      (result) => result.status === "rejected",
    ) as PromiseRejectedResult;
    expect(rejected.reason).toMatchObject({ code: "RULE_VIOLATION" });
  });

  it("does not let an original be lowered below its corrections", async () => {
    const originalId = await insertCollection({
      branchId,
      enteredById: lead.id,
      amount: 100,
      collectedOn: today,
    });
    await createCorrection(contextFor(prisma, lead), originalId, {
      amount: "-80",
      correctionNote: "Refund",
    });
    await expect(
      updateCollection(contextFor(prisma, lead), originalId, {
        amount: "50",
        collectedOn: date(today),
        purpose: "GENERAL",
        description: null,
        correctionNote: null,
      }),
    ).rejects.toMatchObject({ code: "RULE_VIOLATION" });
  });
});

describe("routing", () => {
  it("lets Finance route a locked collection once", async () => {
    const id = await lockedCollection(branchId, lead.id);
    await routeCollection(contextFor(prisma, finance), id, "TRX-2026-0042");
    const row = await prisma.collection.findUniqueOrThrow({ where: { id } });
    expect(row).toMatchObject({ routedById: finance.id, routingReference: "TRX-2026-0042" });
    await expect(routeCollection(contextFor(prisma, finance), id, "AGAIN")).rejects.toMatchObject({
      code: "CONFLICT",
    });
  });

  it("is refused to Branch Leads and Super Admin", async () => {
    const id = await insertCollection({
      branchId,
      enteredById: lead.id,
      amount: 10,
      collectedOn: today,
    });
    for (const actor of [lead, await createActor("SUPER_ADMIN")]) {
      await expect(routeCollection(contextFor(prisma, actor), id, "X")).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
    }
  });

  it("filters routed and unrouted entries", async () => {
    const branch = await createBranch();
    const branchLead = await createActor("BRANCH_LEAD", branch);
    const routed = await insertCollection({
      branchId: branch,
      enteredById: branchLead.id,
      amount: 10,
      collectedOn: today,
    });
    const unrouted = await insertCollection({
      branchId: branch,
      enteredById: branchLead.id,
      amount: 15,
      collectedOn: today,
    });
    await routeCollection(contextFor(prisma, finance), routed, "REF-1");
    const ctx = contextFor(prisma, finance);
    const open = await listCollections(ctx, { branchId: branch, routed: "no" });
    expect(open.items.map((row) => row.id)).toEqual([unrouted]);
    expect(open.totalAmount).toBe("15.00");
    const done = await listCollections(ctx, { branchId: branch, routed: "yes" });
    expect(done.items.map((row) => row.id)).toEqual([routed]);
  });
});
