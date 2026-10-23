import "server-only";
import type { MemberStatus, Prisma } from "@/lib/generated/prisma/client";
import { AppError } from "@/lib/errors";
import { authorize } from "@/lib/permissions";
import { recordAudit } from "@/lib/services/audit";
import {
  found,
  listScope,
  pageArgs,
  toPage,
  withRuleErrors,
  type Page,
  type ServiceContext,
} from "@/lib/services/shared";
import type { MemberContactInput, MemberFilters } from "@/lib/validation/members";

const listSelect = {
  id: true,
  memberCode: true,
  fullName: true,
  email: true,
  phone: true,
  status: true,
  joinedAt: true,
  branchId: true,
  branch: { select: { code: true } },
  teams: { select: { team: { select: { id: true, name: true } } } },
} satisfies Prisma.MemberSelect;

export type MemberListItem = Prisma.MemberGetPayload<{ select: typeof listSelect }>;

/**
 * Members the actor may read (section 7.2): search by name, code, email or phone; filters by
 * branch, team, status and joining date; paging. A Branch Lead's branch filter is forced
 * into the query, whatever branch the request asks for.
 */
export async function listMembers(
  { db, actor }: ServiceContext,
  filters: Partial<MemberFilters> & { page?: number } = {},
): Promise<Page<MemberListItem>> {
  const scope = listScope(actor, "member.read");
  const where: Prisma.MemberWhereInput = {};
  if (filters.branchId) where.branchId = filters.branchId;
  Object.assign(where, scope);
  if (filters.status) where.status = filters.status;
  if (filters.teamId) where.teams = { some: { teamId: filters.teamId } };
  if (filters.joinedFrom || filters.joinedTo) {
    where.joinedAt = {
      ...(filters.joinedFrom ? { gte: filters.joinedFrom } : {}),
      ...(filters.joinedTo ? { lte: filters.joinedTo } : {}),
    };
  }
  if (filters.q) {
    const digits = filters.q.replace(/\D/g, "");
    where.OR = [
      { fullName: { contains: filters.q, mode: "insensitive" } },
      { memberCode: { contains: filters.q, mode: "insensitive" } },
      { email: { contains: filters.q, mode: "insensitive" } },
      // Phones are stored as +92XXXXXXXXXX; match the digits after the country or trunk prefix.
      ...(digits.length >= 4
        ? [{ phone: { contains: digits.replace(/^(?:0092|92|0)/, "") } }]
        : []),
    ];
  }
  const page = filters.page ?? 1;
  const [items, total] = await Promise.all([
    db.member.findMany({
      where,
      select: listSelect,
      orderBy: { memberCode: "asc" },
      ...pageArgs(page),
    }),
    db.member.count({ where }),
  ]);
  return toPage(items, total, page);
}

const detailSelect = {
  ...listSelect,
  applicationId: true,
  createdAt: true,
  branch: { select: { code: true, name: true, status: true } },
  teams: {
    select: { roleInTeam: true, team: { select: { id: true, name: true } } },
    orderBy: { team: { name: "asc" } },
  },
} satisfies Prisma.MemberSelect;

export type MemberDetail = Prisma.MemberGetPayload<{ select: typeof detailSelect }>;

export async function getMember({ db, actor }: ServiceContext, id: string): Promise<MemberDetail> {
  authorize(actor, "member.read");
  const member = found(await db.member.findUnique({ where: { id }, select: detailSelect }));
  authorize(actor, "member.read", { branchId: member.branchId });
  return member;
}

/** Loads the member's branch and checks the action on it (404 for another branch). */
async function authorizeOnMember(
  { db, actor }: ServiceContext,
  id: string,
  action: "member.updateContact" | "member.changeStatus" | "member.changeBranch",
) {
  authorize(actor, action);
  const member = found(
    await db.member.findUnique({
      where: { id },
      select: { branchId: true, fullName: true, email: true, phone: true, status: true },
    }),
  );
  authorize(actor, action, { branchId: member.branchId });
  return member;
}

/** Decision 3: name, email and phone, by a Branch Lead of the member's branch or Super Admin. */
export async function updateMemberContact(
  ctx: ServiceContext,
  id: string,
  input: MemberContactInput,
): Promise<void> {
  const before = await authorizeOnMember(ctx, id, "member.updateContact");
  await withRuleErrors(() =>
    ctx.db.$transaction(async (tx) => {
      await tx.member.update({ where: { id }, data: input });
      await recordAudit(tx, ctx.actor, ctx.request, {
        action: "member.updateContact",
        entityType: "Member",
        entityId: id,
        branchId: before.branchId,
        before: { fullName: before.fullName, email: before.email, phone: before.phone },
        after: input,
      });
    }),
  );
}

/** Decision 3: HR Lead or Super Admin change a member's status. */
export async function changeMemberStatus(
  ctx: ServiceContext,
  id: string,
  status: MemberStatus,
): Promise<void> {
  const before = await authorizeOnMember(ctx, id, "member.changeStatus");
  if (before.status === status) return;
  await withRuleErrors(() =>
    ctx.db.$transaction(async (tx) => {
      await tx.member.update({ where: { id }, data: { status } });
      await recordAudit(tx, ctx.actor, ctx.request, {
        action: "member.changeStatus",
        entityType: "Member",
        entityId: id,
        branchId: before.branchId,
        before: { status: before.status },
        after: { status },
      });
    }),
  );
}

/**
 * Decision 3: only Super Admin moves a member to another branch. Teams belong to a branch,
 * so the member leaves its old branch's teams. A closed branch accepts no members (the
 * database trigger enforces this too).
 */
export async function changeMemberBranch(
  ctx: ServiceContext,
  id: string,
  branchId: string,
): Promise<void> {
  const before = await authorizeOnMember(ctx, id, "member.changeBranch");
  if (before.branchId === branchId) return;
  await withRuleErrors(() =>
    ctx.db.$transaction(async (tx) => {
      const branch = await tx.branch.findUnique({
        where: { id: branchId },
        select: { status: true },
      });
      if (!branch) throw new AppError("VALIDATION", "Choose an existing branch.");
      if (branch.status === "CLOSED") {
        throw new AppError("RULE_VIOLATION", "A closed branch accepts no new members.");
      }
      const assignments = await tx.memberTeam.findMany({
        where: { memberId: id },
        select: { teamId: true },
      });
      await tx.memberTeam.deleteMany({ where: { memberId: id } });
      await tx.member.update({ where: { id }, data: { branchId } });
      await recordAudit(tx, ctx.actor, ctx.request, {
        action: "member.changeBranch",
        entityType: "Member",
        entityId: id,
        branchId,
        before: { branchId: before.branchId, teamIds: assignments.map((row) => row.teamId) },
        after: { branchId, teamIds: [] },
      });
    }),
  );
}
