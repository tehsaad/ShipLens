import "server-only";
import type { Prisma } from "@/lib/generated/prisma/client";
import { addDays, startOfBusinessDay } from "@/lib/dates";
import { authorize } from "@/lib/permissions";
import { pageArgs, toPage, type Page, type ServiceContext } from "@/lib/services/shared";
import type { AuditFilters } from "@/lib/validation/audit";

/**
 * The audit log viewer (section 7.2): Super Admin only and read-only. There is no write path
 * here; the table itself is append-only in the database.
 */

const entrySelect = {
  id: true,
  createdAt: true,
  action: true,
  entityType: true,
  entityId: true,
  branchId: true,
  actorRole: true,
  before: true,
  after: true,
  ipAddress: true,
  userAgent: true,
  actor: { select: { name: true, email: true } },
} satisfies Prisma.AuditLogSelect;

export type AuditLogEntry = Prisma.AuditLogGetPayload<{ select: typeof entrySelect }>;

export function auditWhere(filters: Partial<AuditFilters>): Prisma.AuditLogWhereInput {
  const where: Prisma.AuditLogWhereInput = {};
  if (filters.actorId) where.actorId = filters.actorId;
  if (filters.entityType) where.entityType = filters.entityType;
  if (filters.entityId) where.entityId = filters.entityId;
  if (filters.action) where.action = { contains: filters.action, mode: "insensitive" };
  if (filters.from || filters.to) {
    where.createdAt = {
      ...(filters.from ? { gte: startOfBusinessDay(filters.from) } : {}),
      ...(filters.to ? { lt: startOfBusinessDay(addDays(filters.to, 1)) } : {}),
    };
  }
  return where;
}

/** Newest first, paged. */
export async function listAuditLog(
  { db, actor }: ServiceContext,
  filters: Partial<AuditFilters> & { page?: number } = {},
): Promise<Page<AuditLogEntry>> {
  authorize(actor, "audit.read");
  const where = auditWhere(filters);
  const page = filters.page ?? 1;
  const [items, total] = await Promise.all([
    db.auditLog.findMany({
      where,
      select: entrySelect,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      ...pageArgs(page),
    }),
    db.auditLog.count({ where }),
  ]);
  return toPage(items, total, page);
}

/** Choices for the viewer's filters: every user (active or not) and the entity types in use. */
export async function auditFilterOptions({ db, actor }: ServiceContext) {
  authorize(actor, "audit.read");
  const [users, entityTypes] = await Promise.all([
    db.user.findMany({
      select: { id: true, name: true, role: true },
      orderBy: [{ name: "asc" }, { id: "asc" }],
    }),
    db.auditLog.findMany({
      distinct: ["entityType"],
      select: { entityType: true },
      orderBy: { entityType: "asc" },
    }),
  ]);
  return { users, entityTypes: entityTypes.map((row) => row.entityType) };
}
