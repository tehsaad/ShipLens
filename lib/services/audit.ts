import "server-only";
import type { Prisma, PrismaClient, Role } from "@/lib/generated/prisma/client";
import type { RequestContext } from "@/lib/request-context";

/** A Prisma client or an open transaction. */
export type Db = PrismaClient | Prisma.TransactionClient;

export type AuditActor = { id: string; role: Role } | null;

export type AuditEntry = {
  /** Dotted action name, for example "auth.login.succeeded" or "collection.update". */
  action: string;
  entityType: string;
  entityId?: string | null;
  branchId?: string | null;
  before?: unknown;
  after?: unknown;
};

/** Keys whose values never reach the audit log. */
const REDACTED_KEYS = new Set(["password", "passwordHash", "currentPassword", "newPassword"]);

/**
 * Converts a value into plain JSON for the audit log: dates become ISO strings, Prisma
 * decimals become strings, and secret fields are replaced with "[redacted]".
 */
export function toAuditJson(value: unknown): Prisma.InputJsonValue | null {
  if (value === undefined || value === null) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "bigint") return value.toString();
  if (typeof value !== "object") return value as Prisma.InputJsonValue;
  if (Array.isArray(value)) return value.map((item) => toAuditJson(item));
  // Prisma.Decimal and similar value objects serialise through toJSON.
  if (typeof (value as { toJSON?: unknown }).toJSON === "function") {
    return toAuditJson((value as { toJSON: () => unknown }).toJSON());
  }
  const result: Record<string, Prisma.InputJsonValue | null> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (entry === undefined) continue;
    result[key] = REDACTED_KEYS.has(key) ? "[redacted]" : toAuditJson(entry);
  }
  return result;
}

/**
 * Appends one entry to the audit log. Pass the transaction that made the change so the
 * entry is written if and only if the change commits.
 */
export async function recordAudit(
  db: Db,
  actor: AuditActor,
  context: RequestContext,
  entry: AuditEntry,
): Promise<void> {
  const before = toAuditJson(entry.before);
  const after = toAuditJson(entry.after);
  await db.auditLog.create({
    data: {
      actorId: actor?.id ?? null,
      actorRole: actor?.role ?? null,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId ?? null,
      branchId: entry.branchId ?? null,
      ...(before === null ? {} : { before }),
      ...(after === null ? {} : { after }),
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    },
  });
}
