import { describe, expect, it } from "vitest";
import { addDays, parseDateOnly, weekStartOf, formatDateOnly } from "@/lib/dates";
import {
  SEED_ANCHOR,
  applications,
  branches,
  collections,
  contactMessage,
  contentEntries,
  demoLogins,
  events,
  members,
  reports,
  seedId,
  teams,
  users,
} from "@/prisma/seed/data";

const countBy = <T>(items: T[], key: (item: T) => string) =>
  items.reduce<Record<string, number>>((counts, item) => {
    counts[key(item)] = (counts[key(item)] ?? 0) + 1;
    return counts;
  }, {});

describe("seed data matches docs/SPEC.md section 10", () => {
  it("has 6 branches: 4 ACTIVE, 1 FORMING, 1 PAUSED", () => {
    expect(countBy(branches, (b) => b.status)).toEqual({ ACTIVE: 4, FORMING: 1, PAUSED: 1 });
    for (const branch of branches) expect(branch.code).toMatch(/^BR-[A-Z]{3}-\d{3}$/);
  });

  it("has one user per staff role and one BRANCH_LEAD per branch", () => {
    expect(countBy(users, (u) => u.role)).toEqual({
      SUPER_ADMIN: 1,
      FINANCE_REVIEWER: 1,
      CONTENT_EDITOR: 1,
      HR_LEAD: 1,
      BRANCH_LEAD: 6,
    });
    const leadBranches = users.filter((u) => u.role === "BRANCH_LEAD").map((u) => u.branchId);
    expect(new Set(leadBranches)).toEqual(new Set(branches.map((b) => b.id)));
    for (const user of users) expect(user.email).toBe(user.email.toLowerCase());
  });

  it("documents one demo login per role, with the Branch Lead on an ACTIVE branch", () => {
    expect(Object.keys(demoLogins).sort()).toEqual(
      ["BRANCH_LEAD", "CONTENT_EDITOR", "FINANCE_REVIEWER", "HR_LEAD", "SUPER_ADMIN"].sort(),
    );
    const lead = users.find((u) => u.email === demoLogins.BRANCH_LEAD)!;
    expect(branches.find((b) => b.id === lead.branchId)?.status).toBe("ACTIVE");
  });

  it("has 40 members, all in teams of their own branch", () => {
    expect(members).toHaveLength(40);
    for (const member of members) {
      expect(member.teamIds.length).toBeGreaterThan(0);
      for (const { teamId } of member.teamIds) {
        expect(teams.find((t) => t.id === teamId)?.branchId).toBe(member.branchId);
      }
    }
  });

  it("has 20 applications in mixed statuses, accepted ones linked to members", () => {
    expect(applications).toHaveLength(20);
    expect(countBy(applications, (a) => a.status)).toEqual({ ACCEPTED: 8, DECLINED: 4, NEW: 8 });
    for (const application of applications) {
      expect(application.motivation.length).toBeGreaterThanOrEqual(50);
      if (application.status === "ACCEPTED") {
        expect(members.some((m) => m.id === application.memberId)).toBe(true);
      }
      if (application.status === "DECLINED") expect(application.declineReason).toBeTruthy();
    }
    const openEmails = applications.filter((a) => a.status === "NEW").map((a) => a.email);
    expect(new Set(openEmails).size).toBe(openEmails.length);
  });

  it("has 120 positive collections across the 12 months ending at the anchor", () => {
    expect(collections).toHaveLength(120);
    const anchor = parseDateOnly(SEED_ANCHOR);
    const firstDay = addDays(anchor, -366);
    const months = new Set(collections.map((c) => c.collectedOn.slice(0, 7)));
    expect(months.size).toBe(12);
    for (const collection of collections) {
      const day = parseDateOnly(collection.collectedOn);
      expect(day <= anchor && day > firstDay).toBe(true);
      expect(Number(collection.amount)).toBeGreaterThan(0);
      const branch = branches.find((b) => b.id === collection.branchId)!;
      expect(branch.status).not.toBe("FORMING");
    }
  });

  it("has 8 weekly reports in mixed states, each on a Monday with collections", () => {
    expect(reports).toHaveLength(8);
    expect(countBy(reports, (r) => r.status)).toEqual({
      APPROVED: 3,
      SUBMITTED: 2,
      RETURNED: 1,
      DRAFT: 2,
    });
    for (const report of reports) {
      const weekStart = parseDateOnly(report.weekStart);
      expect(formatDateOnly(weekStartOf(weekStart))).toBe(report.weekStart);
      const weekEnd = addDays(weekStart, 6);
      const inWeek = collections.filter((c) => {
        const day = parseDateOnly(c.collectedOn);
        return c.branchId === report.branchId && day >= weekStart && day <= weekEnd;
      });
      expect(inWeek.length, `${report.branchId} ${report.weekStart}`).toBeGreaterThan(0);
    }
  });

  it("has 6 published content entries, 2 events and 1 contact message", () => {
    expect(contentEntries).toHaveLength(6);
    expect(events).toHaveLength(2);
    expect(contactMessage.message.length).toBeGreaterThan(0);
  });

  it("uses stable, unique ids", () => {
    expect(seedId("branch", "BR-KAR-001")).toBe(seedId("branch", "BR-KAR-001"));
    const ids = [
      ...branches,
      ...users,
      ...teams,
      ...members,
      ...applications,
      ...collections,
      ...reports,
      ...contentEntries,
      ...events,
    ].map((row) => row.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    }
  });
});
