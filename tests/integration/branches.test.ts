import { randomInt } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "@/lib/generated/prisma/client";
import type { Actor } from "@/lib/permissions";
import {
  changeBranchStatus,
  createBranch,
  getBranch,
  listBranches,
  updateBranch,
} from "@/lib/services/branches";
import { contextFor, createActor } from "./helpers/context";
import { createTestPrisma } from "./helpers/prisma";
import { createBranch as insertBranch, pool } from "./helpers/sql";

let prisma: PrismaClient;
let admin: Actor;

/** A city name no other test uses, so code numbering starts from 001. */
function uniqueCity(): string {
  const letters = Array.from({ length: 6 }, () => String.fromCharCode(97 + randomInt(26)));
  return `Q${letters.join("")}`;
}

beforeAll(async () => {
  prisma = createTestPrisma();
  admin = await createActor("SUPER_ADMIN");
});

afterAll(async () => {
  await prisma.$disconnect();
  await pool.end();
});

describe("createBranch", () => {
  it("generates sequential codes per city and audits the creation", async () => {
    const city = uniqueCity();
    const prefix = city.slice(0, 3).toUpperCase();
    const first = await createBranch(contextFor(prisma, admin), {
      name: "One",
      city,
      contactEmail: null,
    });
    const second = await createBranch(contextFor(prisma, admin), {
      name: "Two",
      city,
      contactEmail: "two@example.test",
    });
    expect(first.code).toBe(`BR-${prefix}-001`);
    expect(second.code).toBe(`BR-${prefix}-002`);
    expect(first.status).toBe("FORMING");

    const audit = await prisma.auditLog.findFirstOrThrow({
      where: { action: "branch.create", entityId: first.id },
    });
    expect(audit.actorId).toBe(admin.id);
    expect(audit.after).toMatchObject({ code: first.code });
  });

  it("gives concurrent creations for one city distinct codes", async () => {
    const city = uniqueCity();
    const created = await Promise.all(
      Array.from({ length: 4 }, (_, index) =>
        createBranch(contextFor(prisma, admin), { name: `B${index}`, city, contactEmail: null }),
      ),
    );
    const codes = created.map((branch) => branch.code).sort();
    expect(new Set(codes).size).toBe(4);
    expect(codes.at(-1)).toMatch(/-004$/);
  });

  it("refuses roles other than SUPER_ADMIN", async () => {
    const hr = await createActor("HR_LEAD");
    await expect(
      createBranch(contextFor(prisma, hr), { name: "X", city: uniqueCity(), contactEmail: null }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("changeBranchStatus", () => {
  it("follows the lifecycle and sets openedAt on first activation", async () => {
    const branch = await createBranch(contextFor(prisma, admin), {
      name: "Lifecycle",
      city: uniqueCity(),
      contactEmail: null,
    });
    const now = new Date("2026-10-21T20:00:00Z"); // 22 October in Asia/Karachi
    const active = await changeBranchStatus(contextFor(prisma, admin, now), branch.id, "ACTIVE");
    expect(active.openedAt?.toISOString().slice(0, 10)).toBe("2026-10-22");

    await changeBranchStatus(contextFor(prisma, admin), branch.id, "PAUSED");
    const reopened = await changeBranchStatus(contextFor(prisma, admin), branch.id, "ACTIVE");
    expect(reopened.openedAt?.toISOString().slice(0, 10)).toBe("2026-10-22");

    await changeBranchStatus(contextFor(prisma, admin), branch.id, "CLOSED");
    await expect(
      changeBranchStatus(contextFor(prisma, admin), branch.id, "ACTIVE"),
    ).rejects.toMatchObject({ code: "RULE_VIOLATION" });

    const audits = await prisma.auditLog.count({
      where: { action: "branch.changeStatus", entityId: branch.id },
    });
    expect(audits).toBe(4);
  });

  it("does not let a forming branch close", async () => {
    const branch = await createBranch(contextFor(prisma, admin), {
      name: "Never opened",
      city: uniqueCity(),
      contactEmail: null,
    });
    await expect(
      changeBranchStatus(contextFor(prisma, admin), branch.id, "CLOSED"),
    ).rejects.toMatchObject({ code: "RULE_VIOLATION" });
  });
});

describe("updateBranch", () => {
  it("accepts only an active Branch Lead of the same branch as lead", async () => {
    const branchId = await insertBranch();
    const otherBranchId = await insertBranch();
    const lead = await createActor("BRANCH_LEAD", branchId);
    const outsider = await createActor("BRANCH_LEAD", otherBranchId);
    const ctx = contextFor(prisma, admin);

    await expect(
      updateBranch(ctx, branchId, { name: "Renamed", contactEmail: null, leadUserId: outsider.id }),
    ).rejects.toMatchObject({ code: "VALIDATION" });

    const updated = await updateBranch(ctx, branchId, {
      name: "Renamed",
      contactEmail: "branch@example.test",
      leadUserId: lead.id,
    });
    expect(updated).toMatchObject({ name: "Renamed", leadUserId: lead.id });
  });
});

describe("branch scope", () => {
  it("shows a Branch Lead only its own branch and hides others as not found", async () => {
    const branchId = await insertBranch();
    const otherBranchId = await insertBranch();
    const lead = await createActor("BRANCH_LEAD", branchId);
    const ctx = contextFor(prisma, lead);

    const visible = await listBranches(ctx);
    expect(visible.map((branch) => branch.id)).toEqual([branchId]);
    await expect(getBranch(ctx, otherBranchId)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
