import { afterAll, describe, expect, it } from "vitest";
import { verifyPassword } from "@/lib/auth/password";
import { authenticate } from "@/lib/services/authentication";
import { DEMO_DOMAIN, LEGACY_DEMO_DOMAIN, demoLogins } from "@/prisma/seed/data";
import { runSeed } from "@/prisma/seed/run";
import { createTestPrisma } from "./helpers/prisma";

const prisma = createTestPrisma();
const DEMO_PASSWORD = "integration-demo-password";

afterAll(async () => {
  await prisma.$disconnect();
});

describe("seed script (sections 9 and 10)", () => {
  it("loads the sample data once and changes nothing when re-run", async () => {
    const first = await runSeed(prisma, DEMO_PASSWORD);
    expect(first).toEqual({
      demoLoginsMoved: 0,
      branches: 6,
      users: 10,
      teams: 10,
      applications: 20,
      members: 40,
      collections: 120,
      weeklyReports: 8,
      contentEntries: 6,
      events: 2,
      contactMessages: 1,
    });

    const second = await runSeed(prisma, "a-different-password-on-rerun");
    expect(Object.values(second).every((count) => count === 0)).toBe(true);
    expect(await prisma.auditLog.count({ where: { action: "seed.applied" } })).toBe(1);

    // The re-run did not overwrite existing passwords.
    const admin = await prisma.user.findUniqueOrThrow({
      where: { email: demoLogins.SUPER_ADMIN },
    });
    expect(await verifyPassword(admin.passwordHash, DEMO_PASSWORD)).toBe(true);
  });

  it("lets every demo login sign in without a forced password change (decision 5a)", async () => {
    const context = { ipAddress: null, userAgent: "vitest" };
    for (const [role, email] of Object.entries(demoLogins)) {
      const user = await authenticate(prisma, email, DEMO_PASSWORD, context);
      expect(user, role).toMatchObject({ role, mustChangePassword: false });
    }
  });

  it("links accepted applications and members both ways", async () => {
    const accepted = await prisma.application.findMany({
      where: { status: "ACCEPTED", email: { endsWith: "@example.org" } },
      include: { member: true },
    });
    expect(accepted).toHaveLength(8);
    for (const application of accepted) {
      expect(application.member?.applicationId).toBe(application.id);
      expect(application.member?.memberCode).toMatch(/^MEM-\d{6}$/);
    }
  });

  it("freezes totals on submitted, returned and approved reports only", async () => {
    const seeded = await prisma.weeklyReport.findMany({
      where: { branch: { code: { in: ["BR-KAR-001", "BR-KAR-002", "BR-LAH-001", "BR-ISL-001"] } } },
    });
    expect(seeded).toHaveLength(8);
    for (const report of seeded) {
      if (report.status === "DRAFT") expect(report.totalsSnapshot).toBe(null);
      else expect(report.totalsSnapshot).toMatchObject({ collectionsCount: expect.any(Number) });
    }
  });

  it("moves demo logins from the competition-name domain once, with the current password", async () => {
    const legacy = (email: string) => email.replace(`@${DEMO_DOMAIN}`, `@${LEGACY_DEMO_DOMAIN}`);
    // As on a database seeded before the rename: two accounts still on the old domain, one of
    // them locked out, and one account an admin has given another address.
    await prisma.user.update({
      where: { email: demoLogins.SUPER_ADMIN },
      data: { email: legacy(demoLogins.SUPER_ADMIN), failedLoginCount: 5 },
    });
    await prisma.user.update({
      where: { email: demoLogins.HR_LEAD },
      data: { email: legacy(demoLogins.HR_LEAD) },
    });
    await prisma.user.update({
      where: { email: demoLogins.FINANCE_REVIEWER },
      data: { email: "finance.lead@example.org" },
    });

    const counts = await runSeed(prisma, "the-new-demo-password");
    expect(counts["demoLoginsMoved"]).toBe(2);
    expect(counts["users"]).toBe(0);

    const context = { ipAddress: null, userAgent: "vitest" };
    for (const email of [demoLogins.SUPER_ADMIN, demoLogins.HR_LEAD]) {
      expect(await prisma.user.findUnique({ where: { email } }), email).not.toBe(null);
      const user = await authenticate(prisma, email, "the-new-demo-password", context);
      expect(user, email).toMatchObject({ mustChangePassword: false });
    }
    // Untouched: the account an admin changed, and the accounts already on the new domain.
    expect(await prisma.user.findUnique({ where: { email: "finance.lead@example.org" } })).not.toBe(
      null,
    );
    expect(await authenticate(prisma, demoLogins.BRANCH_LEAD, DEMO_PASSWORD, context)).not.toBe(
      null,
    );

    const audit = await prisma.auditLog.findMany({ where: { action: "seed.demoLoginsMoved" } });
    expect(audit).toHaveLength(1);
    expect(audit[0]!.after).toEqual({ domain: DEMO_DOMAIN, accounts: 2 });
    expect(JSON.stringify(audit[0])).not.toContain("@");

    // Once moved, nothing matches any more.
    expect((await runSeed(prisma, "yet-another-password"))["demoLoginsMoved"]).toBe(0);
  });
});
