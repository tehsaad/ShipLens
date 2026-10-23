import { randomInt } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { verifyPassword } from "@/lib/auth/password";
import type { PrismaClient } from "@/lib/generated/prisma/client";
import type { Actor } from "@/lib/permissions";
import { createUser, resetUserPassword, setUserActive, updateUser } from "@/lib/services/users";
import { createUserSchema } from "@/lib/validation/users";
import { contextFor, createActor } from "./helpers/context";
import { createTestPrisma } from "./helpers/prisma";
import { createBranch, pool } from "./helpers/sql";

let prisma: PrismaClient;
let admin: Actor;
const PASSWORD = "temporary-password-1";

const email = () => `staff-${Date.now()}-${randomInt(1_000_000)}@example.test`;

beforeAll(async () => {
  prisma = createTestPrisma();
  admin = await createActor("SUPER_ADMIN");
});

afterAll(async () => {
  await prisma.$disconnect();
  await pool.end();
});

describe("createUser", () => {
  it("hashes the password, forces a change on first login and never audits the password", async () => {
    const user = await createUser(contextFor(prisma, admin), {
      name: "New Reviewer",
      email: email(),
      role: "FINANCE_REVIEWER",
      branchId: null,
      password: PASSWORD,
    });
    expect(user.mustChangePassword).toBe(true);

    const stored = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(stored.passwordHash).not.toContain(PASSWORD);
    expect(await verifyPassword(stored.passwordHash, PASSWORD)).toBe(true);

    const audit = await prisma.auditLog.findFirstOrThrow({
      where: { action: "user.create", entityId: user.id },
    });
    expect(JSON.stringify(audit)).not.toContain(PASSWORD);
  });

  it("rejects a duplicate email as a conflict", async () => {
    const address = email();
    const input = {
      name: "Twin",
      email: address,
      role: "HR_LEAD" as const,
      branchId: null,
      password: PASSWORD,
    };
    await createUser(contextFor(prisma, admin), input);
    await expect(createUser(contextFor(prisma, admin), input)).rejects.toMatchObject({
      code: "CONFLICT",
    });
  });

  it("requires a branch for a Branch Lead and drops it for other roles", () => {
    const base = { name: "Lead", email: email(), password: PASSWORD };
    expect(createUserSchema.safeParse({ ...base, role: "BRANCH_LEAD", branchId: "" }).success).toBe(
      false,
    );
    const parsed = createUserSchema.parse({
      ...base,
      role: "HR_LEAD",
      branchId: "7b0e3f0e-3c1a-4a7e-9a55-0f2b1c3d4e5f",
    });
    expect(parsed.branchId).toBeNull();
  });

  it("refuses a closed branch", async () => {
    const closed = await createBranch("CLOSED");
    await expect(
      createUser(contextFor(prisma, admin), {
        name: "Late Lead",
        email: email(),
        role: "BRANCH_LEAD",
        branchId: closed,
        password: PASSWORD,
      }),
    ).rejects.toMatchObject({ code: "RULE_VIOLATION" });
  });

  it("is refused to every role but SUPER_ADMIN", async () => {
    const hr = await createActor("HR_LEAD");
    await expect(
      createUser(contextFor(prisma, hr), {
        name: "Sneaky",
        email: email(),
        role: "SUPER_ADMIN",
        branchId: null,
        password: PASSWORD,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("account changes", () => {
  it("does not let an admin deactivate themselves or change their own role", async () => {
    await expect(setUserActive(contextFor(prisma, admin), admin.id, false)).rejects.toMatchObject({
      code: "RULE_VIOLATION",
    });
    await expect(
      updateUser(contextFor(prisma, admin), admin.id, {
        name: "Me",
        role: "HR_LEAD",
        branchId: null,
        locale: "en",
      }),
    ).rejects.toMatchObject({ code: "RULE_VIOLATION" });
  });

  it("removes a deactivated or reassigned lead from its branch", async () => {
    const branchId = await createBranch();
    const lead = await createActor("BRANCH_LEAD", branchId);
    await prisma.branch.update({ where: { id: branchId }, data: { leadUserId: lead.id } });

    await setUserActive(contextFor(prisma, admin), lead.id, false);
    expect(
      (await prisma.branch.findUniqueOrThrow({ where: { id: branchId } })).leadUserId,
    ).toBeNull();

    await setUserActive(contextFor(prisma, admin), lead.id, true);
    await prisma.branch.update({ where: { id: branchId }, data: { leadUserId: lead.id } });
    await updateUser(contextFor(prisma, admin), lead.id, {
      name: "Former lead",
      role: "HR_LEAD",
      branchId: null,
      locale: "en",
    });
    expect(
      (await prisma.branch.findUniqueOrThrow({ where: { id: branchId } })).leadUserId,
    ).toBeNull();
  });

  it("resets a password, clears the lockout and forces a change", async () => {
    const user = await createActor("CONTENT_EDITOR");
    await prisma.user.update({
      where: { id: user.id },
      data: {
        mustChangePassword: false,
        failedLoginCount: 4,
        lockedUntil: new Date(Date.now() + 60_000),
      },
    });
    await resetUserPassword(contextFor(prisma, admin), user.id, PASSWORD);
    const stored = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(stored).toMatchObject({
      mustChangePassword: true,
      failedLoginCount: 0,
      lockedUntil: null,
    });
    expect(await verifyPassword(stored.passwordHash, PASSWORD)).toBe(true);
  });
});
