import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "@/lib/generated/prisma/client";
import type { Actor } from "@/lib/permissions";
import {
  changeMemberBranch,
  changeMemberStatus,
  getMember,
  listMembers,
  updateMemberContact,
} from "@/lib/services/members";
import {
  createTeam,
  getTeam,
  removeTeamMember,
  renameTeam,
  setTeamAssignment,
} from "@/lib/services/teams";
import { contextFor, createActor } from "./helpers/context";
import { createTestPrisma } from "./helpers/prisma";
import { createBranch, pool, setBranchStatus } from "./helpers/sql";

let prisma: PrismaClient;
let branchId: string;
let otherBranchId: string;
let admin: Actor;
let hr: Actor;
let lead: Actor;
let otherLead: Actor;

async function createMember(branch: string, fullName = "Bilal Ahmed"): Promise<string> {
  const member = await prisma.member.create({
    data: {
      fullName,
      email: `${fullName.replace(/\s/g, ".").toLowerCase()}@example.test`,
      phone: "+923001112233",
      branchId: branch,
      joinedAt: new Date("2026-01-15T00:00:00Z"),
    },
    select: { id: true },
  });
  return member.id;
}

beforeAll(async () => {
  prisma = createTestPrisma();
  branchId = await createBranch();
  otherBranchId = await createBranch();
  admin = await createActor("SUPER_ADMIN");
  hr = await createActor("HR_LEAD");
  lead = await createActor("BRANCH_LEAD", branchId);
  otherLead = await createActor("BRANCH_LEAD", otherBranchId);
});

afterAll(async () => {
  await prisma.$disconnect();
  await pool.end();
});

describe("member scope and IDOR (sections 4 and 7.2)", () => {
  it("lists only the Branch Lead's branch, whatever branch is requested", async () => {
    const own = await createMember(branchId, "Own Member");
    const foreign = await createMember(otherBranchId, "Foreign Member");
    const page = await listMembers(contextFor(prisma, lead), { branchId: otherBranchId });
    const ids = page.items.map((member) => member.id);
    expect(ids).toContain(own);
    expect(ids).not.toContain(foreign);
  });

  it("answers another branch's member id with not found, for reads and writes", async () => {
    const foreign = await createMember(otherBranchId, "Hidden Member");
    const ctx = contextFor(prisma, lead);
    await expect(getMember(ctx, foreign)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      updateMemberContact(ctx, foreign, {
        fullName: "Changed",
        email: "changed@example.test",
        phone: "+923000000000",
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("searches by code, name, email and phone", async () => {
    const id = await createMember(branchId, "Zainab Searchable");
    const member = await prisma.member.findUniqueOrThrow({ where: { id } });
    const ctx = contextFor(prisma, admin);
    for (const q of [member.memberCode, "searchable", "zainab.searchable@", "0300 1112233"]) {
      const page = await listMembers(ctx, { q });
      expect(page.items.map((row) => row.id)).toContain(id);
    }
  });
});

describe("member edits (decision 3)", () => {
  it("lets the Branch Lead edit contact details but not status", async () => {
    const id = await createMember(branchId, "Editable Member");
    await updateMemberContact(contextFor(prisma, lead), id, {
      fullName: "Edited Member",
      email: "edited@example.test",
      phone: "+923009998877",
    });
    expect((await prisma.member.findUniqueOrThrow({ where: { id } })).fullName).toBe(
      "Edited Member",
    );
    await expect(
      changeMemberStatus(contextFor(prisma, lead), id, "INACTIVE"),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("lets HR change status but not contact details", async () => {
    const id = await createMember(branchId, "Status Member");
    await changeMemberStatus(contextFor(prisma, hr), id, "ON_LEAVE");
    expect((await prisma.member.findUniqueOrThrow({ where: { id } })).status).toBe("ON_LEAVE");
    await expect(
      updateMemberContact(contextFor(prisma, hr), id, {
        fullName: "Nope",
        email: "nope@example.test",
        phone: "+923000000000",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("moves a member to another branch and drops its old teams (Super Admin only)", async () => {
    const id = await createMember(branchId, "Moving Member");
    const team = await createTeam(contextFor(prisma, lead), {
      branchId,
      name: `Movers ${Date.now()}`,
    });
    await setTeamAssignment(contextFor(prisma, lead), team.id, { memberId: id, roleInTeam: null });

    await expect(
      changeMemberBranch(contextFor(prisma, hr), id, otherBranchId),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await changeMemberBranch(contextFor(prisma, admin), id, otherBranchId);
    const member = await prisma.member.findUniqueOrThrow({
      where: { id },
      include: { teams: true },
    });
    expect(member.branchId).toBe(otherBranchId);
    expect(member.teams).toHaveLength(0);
  });

  it("refuses to move a member into a closed branch", async () => {
    const closed = await createBranch();
    await setBranchStatus(closed, "CLOSED");
    const id = await createMember(branchId, "Stuck Member");
    await expect(changeMemberBranch(contextFor(prisma, admin), id, closed)).rejects.toMatchObject({
      code: "RULE_VIOLATION",
    });
  });
});

describe("teams", () => {
  it("creates, renames and staffs a team in the lead's own branch", async () => {
    const ctx = contextFor(prisma, lead);
    const name = `Relief ${Date.now()}`;
    const { id } = await createTeam(ctx, { branchId, name });
    await expect(createTeam(ctx, { branchId, name })).rejects.toMatchObject({ code: "CONFLICT" });
    await renameTeam(ctx, id, `${name} North`);

    const memberId = await createMember(branchId, "Team Player");
    await setTeamAssignment(ctx, id, { memberId, roleInTeam: "Coordinator" });
    await setTeamAssignment(ctx, id, { memberId, roleInTeam: "Lead" });
    let team = await getTeam(ctx, id);
    expect(team.name).toBe(`${name} North`);
    expect(team.members).toEqual([expect.objectContaining({ roleInTeam: "Lead" })]);

    await removeTeamMember(ctx, id, memberId);
    team = await getTeam(ctx, id);
    expect(team.members).toHaveLength(0);
  });

  it("keeps Branch Leads out of other branches' teams", async () => {
    const { id } = await createTeam(contextFor(prisma, otherLead), {
      branchId: otherBranchId,
      name: `Other ${Date.now()}`,
    });
    const ctx = contextFor(prisma, lead);
    await expect(getTeam(ctx, id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      createTeam(ctx, { branchId: otherBranchId, name: "Sneaky" }),
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("only takes members of the team's branch", async () => {
    const { id } = await createTeam(contextFor(prisma, admin), {
      branchId,
      name: `Mixed ${Date.now()}`,
    });
    const outsider = await createMember(otherBranchId, "Out Sider");
    await expect(
      setTeamAssignment(contextFor(prisma, admin), id, { memberId: outsider, roleInTeam: null }),
    ).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(
      setTeamAssignment(contextFor(prisma, lead), id, { memberId: outsider, roleInTeam: null }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
