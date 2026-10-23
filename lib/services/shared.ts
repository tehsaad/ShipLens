import "server-only";
import type { PrismaClient } from "@/lib/generated/prisma/client";
import { toRuleViolation } from "@/lib/db-errors";
import { AppError, notFound } from "@/lib/errors";
import { authorize, scopeFor, type Action, type Actor } from "@/lib/permissions";
import type { RequestContext } from "@/lib/request-context";

/**
 * Everything a service call needs besides its input: the shared client (services open their
 * own transactions), the signed-in user, and the client details for the audit log.
 */
export type ServiceContext = {
  db: PrismaClient;
  actor: Actor;
  request: RequestContext;
  /** Injected in tests; defaults to the current time. */
  now?: Date;
};

export const PAGE_SIZE = 25;

export type Page<T> = {
  items: T[];
  total: number;
  page: number;
  pageCount: number;
};

export function pageArgs(page: number, pageSize = PAGE_SIZE) {
  return { skip: (Math.max(page, 1) - 1) * pageSize, take: pageSize };
}

export function toPage<T>(items: T[], total: number, page: number, pageSize = PAGE_SIZE): Page<T> {
  return { items, total, page, pageCount: Math.max(1, Math.ceil(total / pageSize)) };
}

/**
 * Runs database work and turns a rule violation raised by PostgreSQL (lib/db-errors.ts)
 * into a safe AppError. Anything else is rethrown unchanged and handled as internal.
 */
export async function withRuleErrors<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw toRuleViolation(error) ?? error;
  }
}

/** Returns the row, or throws NOT_FOUND when it is missing. */
export function found<T>(row: T | null | undefined): T {
  if (row === null || row === undefined) throw notFound();
  return row;
}

/**
 * Authorizes a list query and returns its branch filter: none for a role with "all" scope,
 * the actor's own branch for "ownBranch". The filter goes into the WHERE clause, so rows of
 * other branches are never read. `authorize` has already refused a BRANCH_LEAD without a
 * branch, so the non-null assertion holds.
 */
export function listScope(actor: Actor, action: Action): { branchId?: string } {
  authorize(actor, action);
  return scopeFor(actor.role, action) === "all" ? {} : { branchId: actor.branchId! };
}
