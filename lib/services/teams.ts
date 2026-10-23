import "server-only";
import type { Prisma } from "@/lib/generated/prisma/client";
import { databaseErrorCode, toRuleViolation } from "@/lib/db-errors";
import { AppError } from "@/lib/errors";
import { authorize } from "@/lib/permissions";
import { recordAudit } from "@/lib/services/audit";
import { found, listScope, withRuleErrors, type ServiceContext } from "@/lib/services/shared";

const UNIQUE_VIOLATION = "23505";

const listSelect = {
  id: true,
  name: true,
  branchId: true,
  branch: { select: { code: true, name: true } },
  _count: { select: { members: true } },
} satisfies Prisma.TeamSelect;

export type TeamListItem = Prisma.TeamGetPayload<{ select: typeof listSelect }>;

export async function listTeams(
  { db, actor }: ServiceContext,
  filters: { branchId?: string | null } = {},
): Promise<TeamListItem[]> {
  const scope = listScope(actor, "team.read");
  const where: Prisma.TeamWhereInput = {
    ...(filters.branchId ? { branchId: filters.branchId } : {}),
    ...scope,
  };
  return db.team.findMany({
    where,
    select: listSelect,
    orderBy: [{ branch: { code: "asc" } }, { name: "asc" }],
  });
}

const detailSelect = {
  id: true,
  name: true,
  branchId: true,
  branch: { select: { code: true, name: true } },
  members: {
    select: {
      roleInTeam: true,
      member: { select: { id: true, memberCode: true, fullName: true, status: true } },
    },
    orderBy: { member: { fullName: "asc" } },
  },
} satisfies Prisma.TeamSelect;

export type TeamDetail = Prisma.TeamGetPayload<{ select: typeof detailSelect }>;

export async function getTeam({ db, actor }: ServiceContext, id: string): Promise<TeamDetail> {
  authorize(actor, "team.read");
  const team = found(await db.team.findUnique({ where: { id }, select: detailSelect }));
  authorize(actor, "team.read", { branchId: team.branchId });
  return team;
}

function duplicateName(error: unknown): never {
  if (databaseErrorCode(error) === UNIQUE_VIOLATION) {
    throw new AppError("CONFLICT", "This branch already has a team with that name.");
  }
  if (error instanceof AppError) throw error;
  throw toRuleViolation(error) ?? error;
}

/** Creates a team in a branch: the Branch Lead's own branch, or any branch for Super Admin. */
export async function createTeam(
  { db, actor, request }: ServiceContext,
  input: { branchId: string; name: string },
): Promise<{ id: string }> {
  authorize(actor, "team.create", { branchId: input.branchId });
  try {
    return await db.$transaction(async (tx) => {
      const branch = found(
        await tx.branch.findUnique({ where: { id: input.branchId }, select: { status: true } }),
      );
      if (branch.status === "CLOSED") {
        throw new AppError("RULE_VIOLATION", "A closed branch cannot get new teams.");
      }
      const team = await tx.team.create({ data: input, select: { id: true } });
      await recordAudit(tx, actor, request, {
        action: "team.create",
        entityType: "Team",
        entityId: team.id,
        branchId: input.branchId,
        after: { name: input.name },
      });
      return team;
    });
  } catch (error) {
    duplicateName(error);
  }
}

/** Loads the team's branch and checks the action on it (404 for another branch). */
async function authorizeOnTeam(
  { db, actor }: ServiceContext,
  id: string,
  action: "team.update" | "team.assignMembers",
) {
  authorize(actor, action);
  const team = found(
    await db.team.findUnique({ where: { id }, select: { branchId: true, name: true } }),
  );
  authorize(actor, action, { branchId: team.branchId });
  return team;
}

export async function renameTeam(ctx: ServiceContext, id: string, name: string): Promise<void> {
  const before = await authorizeOnTeam(ctx, id, "team.update");
  try {
    await ctx.db.$transaction(async (tx) => {
      await tx.team.update({ where: { id }, data: { name } });
      await recordAudit(tx, ctx.actor, ctx.request, {
        action: "team.update",
        entityType: "Team",
        entityId: id,
        branchId: before.branchId,
        before: { name: before.name },
        after: { name },
      });
    });
  } catch (error) {
    duplicateName(error);
  }
}

/**
 * Adds a member to a team, or updates the member's role in it. The member must belong to the
 * team's branch; a member of another branch reads as not found to a Branch Lead.
 */
export async function setTeamAssignment(
  ctx: ServiceContext,
  teamId: string,
  input: { memberId: string; roleInTeam: string | null },
): Promise<void> {
  const team = await authorizeOnTeam(ctx, teamId, "team.assignMembers");
  await withRuleErrors(() =>
    ctx.db.$transaction(async (tx) => {
      const member = found(
        await tx.member.findUnique({ where: { id: input.memberId }, select: { branchId: true } }),
      );
      if (member.branchId !== team.branchId) {
        authorize(ctx.actor, "member.read", { branchId: member.branchId });
        throw new AppError("VALIDATION", "Only members of the team's branch can join it.");
      }
      const before = await tx.memberTeam.findUnique({
        where: { memberId_teamId: { memberId: input.memberId, teamId } },
        select: { roleInTeam: true },
      });
      await tx.memberTeam.upsert({
        where: { memberId_teamId: { memberId: input.memberId, teamId } },
        create: { memberId: input.memberId, teamId, roleInTeam: input.roleInTeam },
        update: { roleInTeam: input.roleInTeam },
      });
      await recordAudit(tx, ctx.actor, ctx.request, {
        action: before ? "team.updateMember" : "team.addMember",
        entityType: "Team",
        entityId: teamId,
        branchId: team.branchId,
        before: before ? { memberId: input.memberId, roleInTeam: before.roleInTeam } : null,
        after: { memberId: input.memberId, roleInTeam: input.roleInTeam },
      });
    }),
  );
}

export async function removeTeamMember(
  ctx: ServiceContext,
  teamId: string,
  memberId: string,
): Promise<void> {
  const team = await authorizeOnTeam(ctx, teamId, "team.assignMembers");
  await withRuleErrors(() =>
    ctx.db.$transaction(async (tx) => {
      const { count } = await tx.memberTeam.deleteMany({ where: { teamId, memberId } });
      if (count === 0) return;
      await recordAudit(tx, ctx.actor, ctx.request, {
        action: "team.removeMember",
        entityType: "Team",
        entityId: teamId,
        branchId: team.branchId,
        before: { memberId },
      });
    }),
  );
}

/** Members of a branch who are not in the team yet, for the "add member" form. */
export async function listTeamCandidates(ctx: ServiceContext, teamId: string) {
  const team = await authorizeOnTeam(ctx, teamId, "team.assignMembers");
  return ctx.db.member.findMany({
    where: { branchId: team.branchId, teams: { none: { teamId } } },
    select: { id: true, memberCode: true, fullName: true },
    orderBy: { fullName: "asc" },
  });
}
