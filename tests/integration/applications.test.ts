import { randomInt } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "@/lib/generated/prisma/client";
import type { Actor } from "@/lib/permissions";
import {
  acceptApplication,
  declineApplication,
  submitApplication,
} from "@/lib/services/applications";
import { applicationSchema, type ApplicationInput } from "@/lib/validation/applications";
import { TEST_REQUEST, contextFor, createActor } from "./helpers/context";
import { createTestPrisma } from "./helpers/prisma";
import { createBranch, pool, setBranchStatus } from "./helpers/sql";

let prisma: PrismaClient;
let hr: Actor;
let branchId: string;

function input(overrides: Partial<ApplicationInput> = {}): ApplicationInput {
  return {
    fullName: "Sana Malik",
    email: `applicant-${Date.now()}-${randomInt(1_000_000)}@example.test`,
    phone: "+923001234567",
    preferredBranchId: branchId,
    skills: "First aid, logistics",
    availability: "WEEKENDS",
    motivation: "I want to help my community and learn how relief work is organised in my city.",
    consentGiven: true,
    ...overrides,
  };
}

beforeAll(async () => {
  prisma = createTestPrisma();
  hr = await createActor("HR_LEAD");
  branchId = await createBranch("ACTIVE");
});

afterAll(async () => {
  await prisma.$disconnect();
  await pool.end();
});

describe("application form schema (section 7.1)", () => {
  it("accepts Pakistani phone formats and stores them as +92", () => {
    for (const phone of ["+92 300 1234567", "0300-1234567", "0092 300 1234567"]) {
      expect(applicationSchema.parse({ ...input(), phone }).phone).toBe("+923001234567");
    }
  });

  it("rejects bad phones, short motivation and missing consent", () => {
    const result = applicationSchema.safeParse({
      ...input(),
      phone: "+44 20 7946 0958",
      motivation: "Too short",
      consentGiven: false,
    });
    expect(result.success).toBe(false);
    const paths = result.error!.issues.map((issue) => issue.path[0]);
    expect(paths).toEqual(expect.arrayContaining(["phone", "motivation", "consentGiven"]));
  });
});

describe("submitApplication", () => {
  it("stores a NEW application and audits ids only", async () => {
    const data = input();
    const { id } = await submitApplication(prisma, data, TEST_REQUEST);
    const stored = await prisma.application.findUniqueOrThrow({ where: { id } });
    expect(stored.status).toBe("NEW");
    const audit = await prisma.auditLog.findFirstOrThrow({
      where: { action: "application.submit", entityId: id },
    });
    expect(audit.actorId).toBeNull();
    expect(JSON.stringify(audit)).not.toContain(data.email);
  });

  // The unique index is on lower(email), so case does not matter even if the schema is bypassed.
  it("rejects a second open application for the same email with a generic message", async () => {
    const data = input();
    await submitApplication(prisma, data, TEST_REQUEST);
    await expect(
      submitApplication(prisma, { ...data, email: data.email.toUpperCase() }, TEST_REQUEST),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("only accepts ACTIVE branches", async () => {
    const forming = await createBranch("FORMING");
    await expect(
      submitApplication(prisma, input({ preferredBranchId: forming }), TEST_REQUEST),
    ).rejects.toMatchObject({ code: "VALIDATION" });
  });
});

describe("acceptApplication (section 6.2)", () => {
  it("creates the member, links both records and audits both steps in one transaction", async () => {
    const { id } = await submitApplication(prisma, input(), TEST_REQUEST);
    const result = await acceptApplication(contextFor(prisma, hr), id, {
      branchId: null,
      joinedAt: null,
    });
    expect(result.memberCode).toMatch(/^MEM-\d{6}$/);

    const application = await prisma.application.findUniqueOrThrow({ where: { id } });
    const member = await prisma.member.findUniqueOrThrow({ where: { id: result.memberId } });
    expect(application).toMatchObject({
      status: "ACCEPTED",
      memberId: member.id,
      decidedById: hr.id,
    });
    expect(member).toMatchObject({ applicationId: id, branchId, status: "ACTIVE" });

    const actions = await prisma.auditLog.findMany({
      where: {
        entityId: { in: [id, member.id] },
        action: { in: ["application.accept", "member.create"] },
      },
      select: { action: true },
    });
    expect(actions.map((row) => row.action).sort()).toEqual([
      "application.accept",
      "member.create",
    ]);
  });

  it("places the member in the branch HR chooses", async () => {
    const other = await createBranch("PAUSED");
    const { id } = await submitApplication(prisma, input(), TEST_REQUEST);
    const { memberId } = await acceptApplication(contextFor(prisma, hr), id, {
      branchId: other,
      joinedAt: null,
    });
    expect((await prisma.member.findUniqueOrThrow({ where: { id: memberId } })).branchId).toBe(
      other,
    );
  });

  it("rolls everything back when the branch is closed", async () => {
    const closing = await createBranch("ACTIVE");
    const { id } = await submitApplication(
      prisma,
      input({ preferredBranchId: closing }),
      TEST_REQUEST,
    );
    await setBranchStatus(closing, "CLOSED");
    await expect(
      acceptApplication(contextFor(prisma, hr), id, { branchId: null, joinedAt: null }),
    ).rejects.toMatchObject({ code: "RULE_VIOLATION" });
    const application = await prisma.application.findUniqueOrThrow({ where: { id } });
    expect(application).toMatchObject({ status: "NEW", memberId: null, decidedById: null });
    expect(await prisma.member.count({ where: { applicationId: id } })).toBe(0);
  });

  it("lets only one of two concurrent decisions win", async () => {
    const { id } = await submitApplication(prisma, input(), TEST_REQUEST);
    const results = await Promise.allSettled([
      acceptApplication(contextFor(prisma, hr), id, { branchId: null, joinedAt: null }),
      acceptApplication(contextFor(prisma, hr), id, { branchId: null, joinedAt: null }),
      declineApplication(contextFor(prisma, hr), id, "Duplicate of another application"),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(await prisma.member.count({ where: { applicationId: id } })).toBeLessThanOrEqual(1);
  });

  it("is refused to Branch Leads and Finance Reviewers", async () => {
    const { id } = await submitApplication(prisma, input(), TEST_REQUEST);
    for (const actor of [
      await createActor("BRANCH_LEAD", branchId),
      await createActor("FINANCE_REVIEWER"),
    ]) {
      await expect(
        acceptApplication(contextFor(prisma, actor), id, { branchId: null, joinedAt: null }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    }
  });
});

describe("declineApplication", () => {
  it("stores the internal reason and frees the email for a new application", async () => {
    const data = input();
    const { id } = await submitApplication(prisma, data, TEST_REQUEST);
    await declineApplication(contextFor(prisma, hr), id, "Not enough availability this term");
    const stored = await prisma.application.findUniqueOrThrow({ where: { id } });
    expect(stored).toMatchObject({
      status: "DECLINED",
      declineReason: "Not enough availability this term",
    });
    await expect(submitApplication(prisma, data, TEST_REQUEST)).resolves.toHaveProperty("id");
  });
});
