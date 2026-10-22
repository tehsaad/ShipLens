import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { hashPassword } from "@/lib/auth/password";
import { AppError } from "@/lib/errors";
import {
  LOCKOUT_MINUTES,
  LOCKOUT_THRESHOLD,
  authenticate,
  changeOwnPassword,
} from "@/lib/services/authentication";
import { createTestPrisma } from "./helpers/prisma";

const prisma = createTestPrisma();
const context = { ipAddress: "203.0.113.7", userAgent: "vitest" };
const PASSWORD = "correct horse battery";
let passwordHash: string;

beforeAll(async () => {
  passwordHash = await hashPassword(PASSWORD);
});

afterAll(async () => {
  await prisma.$disconnect();
});

async function createUser(overrides: { isActive?: boolean } = {}) {
  const email = `auth-${randomUUID()}@example.test`;
  return prisma.user.create({
    data: {
      email,
      name: "Auth Test",
      passwordHash,
      role: "HR_LEAD",
      ...overrides,
    },
  });
}

async function auditActions(entityId: string) {
  const rows = await prisma.auditLog.findMany({
    where: { entityId },
    orderBy: { createdAt: "asc" },
    select: { action: true, after: true, ipAddress: true },
  });
  return rows;
}

describe("authenticate", () => {
  it("signs in with the right password, ignoring email case and spaces", async () => {
    const user = await createUser();
    const result = await authenticate(prisma, `  ${user.email.toUpperCase()} `, PASSWORD, context);
    expect(result).toEqual({
      id: user.id,
      role: "HR_LEAD",
      branchId: null,
      mustChangePassword: true,
    });
    const audit = await auditActions(user.id);
    expect(audit.map((entry) => entry.action)).toEqual(["auth.login.succeeded"]);
    expect(audit[0]!.ipAddress).toBe("203.0.113.7");
  });

  it(`locks the account for ${LOCKOUT_MINUTES} minutes after ${LOCKOUT_THRESHOLD} failures`, async () => {
    const user = await createUser();
    const start = new Date();

    for (let attempt = 1; attempt < LOCKOUT_THRESHOLD; attempt += 1) {
      expect(await authenticate(prisma, user.email, "wrong password", context, start)).toBe(null);
    }
    let row = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(row.failedLoginCount).toBe(LOCKOUT_THRESHOLD - 1);
    expect(row.lockedUntil).toBe(null);

    expect(await authenticate(prisma, user.email, "wrong password", context, start)).toBe(null);
    row = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(row.failedLoginCount).toBe(0);
    expect(row.lockedUntil?.getTime()).toBe(start.getTime() + LOCKOUT_MINUTES * 60_000);

    // While locked, even the right password fails.
    const duringLock = new Date(start.getTime() + (LOCKOUT_MINUTES - 1) * 60_000);
    expect(await authenticate(prisma, user.email, PASSWORD, context, duringLock)).toBe(null);

    // After the lock expires, the right password works and clears the lock.
    const afterLock = new Date(start.getTime() + (LOCKOUT_MINUTES + 1) * 60_000);
    expect(await authenticate(prisma, user.email, PASSWORD, context, afterLock)).not.toBe(null);
    row = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(row.lockedUntil).toBe(null);

    const actions = (await auditActions(user.id)).map((entry) => entry.action);
    expect(actions.filter((action) => action === "auth.login.failed")).toHaveLength(
      LOCKOUT_THRESHOLD + 1,
    );
    expect(actions).toContain("auth.lockout");
    expect(actions.at(-1)).toBe("auth.login.succeeded");
  });

  it("resets the failure count after a successful sign-in", async () => {
    const user = await createUser();
    await authenticate(prisma, user.email, "wrong password", context);
    await authenticate(prisma, user.email, "wrong password", context);
    await authenticate(prisma, user.email, PASSWORD, context);
    const row = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(row.failedLoginCount).toBe(0);
  });

  it("rejects inactive accounts and unknown emails, recording the reason", async () => {
    const inactive = await createUser({ isActive: false });
    expect(await authenticate(prisma, inactive.email, PASSWORD, context)).toBe(null);
    const [entry] = await auditActions(inactive.id);
    expect(entry).toMatchObject({ action: "auth.login.failed", after: { reason: "inactive" } });

    const email = `nobody-${randomUUID()}@example.test`;
    expect(await authenticate(prisma, email, PASSWORD, context)).toBe(null);
    const unknown = await prisma.auditLog.findFirst({
      where: { action: "auth.login.failed", after: { path: ["email"], equals: email } },
    });
    expect(unknown?.after).toMatchObject({ reason: "unknown_account" });
    expect(unknown?.entityId).toBe(null);
  });

  it("never writes the password to the audit log", async () => {
    const user = await createUser();
    await authenticate(prisma, user.email, "a secret attempt value", context);
    const entries = await prisma.auditLog.findMany({ where: { entityId: user.id } });
    expect(JSON.stringify(entries)).not.toContain("a secret attempt value");
  });
});

describe("changeOwnPassword", () => {
  it("checks the current password, refuses reuse, and clears mustChangePassword", async () => {
    const user = await createUser();
    const actor = { id: user.id, role: user.role };

    await expect(
      changeOwnPassword(prisma, actor, "not the password", "a brand new password", context),
    ).rejects.toBeInstanceOf(AppError);
    await expect(changeOwnPassword(prisma, actor, PASSWORD, PASSWORD, context)).rejects.toThrow(
      /not used/,
    );

    await changeOwnPassword(prisma, actor, PASSWORD, "a brand new password", context);
    const row = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(row.mustChangePassword).toBe(false);
    expect(row.passwordHash).not.toBe(passwordHash);
    expect(row.passwordHash.startsWith("$argon2id$")).toBe(true);

    expect(await authenticate(prisma, user.email, PASSWORD, context)).toBe(null);
    expect(await authenticate(prisma, user.email, "a brand new password", context)).not.toBe(null);

    const changed = await prisma.auditLog.findFirstOrThrow({
      where: { entityId: user.id, action: "auth.password.changed" },
    });
    expect(changed.actorId).toBe(user.id);
    expect(changed.after).toEqual({ mustChangePassword: false });
  });
});
