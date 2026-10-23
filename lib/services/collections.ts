import "server-only";
import type { Prisma } from "@/lib/generated/prisma/client";
import { businessToday, formatDateOnly, weekStartOf } from "@/lib/dates";
import { AppError } from "@/lib/errors";
import { fromPaisa, normaliseAmount, toPaisa } from "@/lib/money";
import { authorize } from "@/lib/permissions";
import {
  amountError,
  collectionLockReason,
  correctedTotalIsValid,
  type LockReason,
} from "@/lib/rules/collection";
import { recordAudit, type Db } from "@/lib/services/audit";
import {
  found,
  listScope,
  pageArgs,
  toPage,
  withRuleErrors,
  type Page,
  type ServiceContext,
} from "@/lib/services/shared";
import type {
  CollectionFilters,
  CollectionInput,
  CorrectionInput,
  UpdateCollectionInput,
} from "@/lib/validation/collections";

/**
 * Collections (sections 6.3 and 7.2, amendment A1, decision 8). Every rule is checked here
 * first so the user gets a clear message; the PostgreSQL triggers enforce the same rules
 * (lib/db-errors.ts maps their errors) for anything that gets past this layer.
 */

export const LOCK_MESSAGES: Record<LockReason, string> = {
  LOCKED: "This collection is locked: entries can only be edited for 7 days.",
  WEEK_APPROVED: "The weekly report for this week is approved, so its collections are read-only.",
};

const APPROVED_WEEK_MESSAGE =
  "The weekly report for that date is approved. Record the entry in the current week and " +
  "mention the original date in the description.";

/** Whether the branch's report for the week containing `day` is APPROVED. */
async function weekIsApproved(db: Db, branchId: string, day: Date): Promise<boolean> {
  const report = await db.weeklyReport.findUnique({
    where: { branchId_weekStart: { branchId, weekStart: weekStartOf(day) } },
    select: { status: true },
  });
  return report?.status === "APPROVED";
}

function assertNotFuture(collectedOn: Date, now: Date): void {
  if (collectedOn > businessToday(now)) {
    throw new AppError("VALIDATION", "The collection date cannot be in the future.");
  }
}

/** Checks the sign rule and returns the amount with two decimals, e.g. "-50" -> "-50.00". */
function checkedAmount(amount: string, isCorrection: boolean): string {
  const error = amountError(amount, isCorrection);
  if (error) throw new AppError("VALIDATION", error);
  return normaliseAmount(amount);
}

/** Amounts of the original and its corrections, optionally leaving one correction out. */
async function correctionAmounts(
  db: Db,
  originalId: string,
  excludeId?: string,
): Promise<string[]> {
  const rows = await db.collection.findMany({
    where: {
      OR: [{ id: originalId }, { correctsCollectionId: originalId }],
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: { amount: true },
  });
  return rows.map((row) => row.amount.toString());
}

const BELOW_ZERO = "A correction cannot reduce the original collection below zero.";

const listSelect = {
  id: true,
  branchId: true,
  branch: { select: { code: true } },
  amount: true,
  collectedOn: true,
  purpose: true,
  description: true,
  lockedAt: true,
  routedAt: true,
  routingReference: true,
  correctsCollectionId: true,
  createdAt: true,
} satisfies Prisma.CollectionSelect;

export type CollectionListItem = Prisma.CollectionGetPayload<{ select: typeof listSelect }>;

export async function listCollections(
  { db, actor }: ServiceContext,
  filters: Partial<CollectionFilters> & { page?: number } = {},
): Promise<Page<CollectionListItem> & { totalAmount: string }> {
  const scope = listScope(actor, "collection.read");
  const where: Prisma.CollectionWhereInput = {};
  if (filters.branchId) where.branchId = filters.branchId;
  Object.assign(where, scope);
  if (filters.purpose) where.purpose = filters.purpose;
  if (filters.routed === "yes") where.routedAt = { not: null };
  if (filters.routed === "no") where.routedAt = null;
  if (filters.from || filters.to) {
    where.collectedOn = {
      ...(filters.from ? { gte: filters.from } : {}),
      ...(filters.to ? { lte: filters.to } : {}),
    };
  }
  const page = filters.page ?? 1;
  const [items, total, sum] = await Promise.all([
    db.collection.findMany({
      where,
      select: listSelect,
      orderBy: [{ collectedOn: "desc" }, { createdAt: "desc" }],
      ...pageArgs(page),
    }),
    db.collection.count({ where }),
    db.collection.aggregate({ where, _sum: { amount: true } }),
  ]);
  return { ...toPage(items, total, page), totalAmount: sum._sum.amount?.toFixed(2) ?? "0.00" };
}

const detailSelect = {
  ...listSelect,
  correctionNote: true,
  enteredBy: { select: { name: true } },
  routedBy: { select: { name: true } },
  corrects: { select: { id: true, amount: true, collectedOn: true } },
  corrections: {
    select: { id: true, amount: true, collectedOn: true, correctionNote: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  },
} satisfies Prisma.CollectionSelect;

export type CollectionDetail = Prisma.CollectionGetPayload<{ select: typeof detailSelect }> & {
  /** Why it cannot be edited, or null while it can (section 6.3). */
  lockReason: LockReason | null;
  /** Original plus corrections, for an original entry. */
  netAmount: string | null;
};

export async function getCollection(
  { db, actor, now = new Date() }: ServiceContext,
  id: string,
): Promise<CollectionDetail> {
  authorize(actor, "collection.read");
  const row = found(await db.collection.findUnique({ where: { id }, select: detailSelect }));
  authorize(actor, "collection.read", { branchId: row.branchId });
  const approved = await weekIsApproved(db, row.branchId, row.collectedOn);
  const netAmount = row.correctsCollectionId
    ? null
    : fromPaisa(
        [row.amount, ...row.corrections.map((c) => c.amount)].reduce(
          (sum, amount) => sum + toPaisa(amount.toString()),
          0n,
        ),
      );
  return { ...row, lockReason: collectionLockReason(row.lockedAt, approved, now), netAmount };
}

/** A Branch Lead records a collection for its own branch (section 6.3). */
export async function createCollection(
  { db, actor, request, now = new Date() }: ServiceContext,
  input: CollectionInput,
): Promise<{ id: string }> {
  authorize(actor, "collection.create");
  const branchId = actor.branchId;
  if (!branchId) throw new AppError("FORBIDDEN", "You do not have permission to do that.");
  const amount = checkedAmount(input.amount, false);
  assertNotFuture(input.collectedOn, now);
  return withRuleErrors(() =>
    db.$transaction(async (tx) => {
      const branch = found(
        await tx.branch.findUnique({ where: { id: branchId }, select: { status: true } }),
      );
      if (branch.status === "CLOSED") {
        throw new AppError("RULE_VIOLATION", "This branch is closed and accepts no new entries.");
      }
      if (await weekIsApproved(tx, branchId, input.collectedOn)) {
        throw new AppError("RULE_VIOLATION", APPROVED_WEEK_MESSAGE);
      }
      const collection = await tx.collection.create({
        data: { ...input, amount, branchId, enteredById: actor.id },
        select: { id: true, lockedAt: true },
      });
      await recordAudit(tx, actor, request, {
        action: "collection.create",
        entityType: "Collection",
        entityId: collection.id,
        branchId,
        after: {
          ...input,
          collectedOn: formatDateOnly(input.collectedOn),
          lockedAt: collection.lockedAt,
        },
      });
      return { id: collection.id };
    }),
  );
}

/**
 * Edits an entry while it is unlocked: before lockedAt and with neither its old nor its new
 * week approved. A correction keeps its never-below-zero check; an original being lowered
 * must still cover its corrections (amendment A1).
 */
export async function updateCollection(
  { db, actor, request, now = new Date() }: ServiceContext,
  id: string,
  input: UpdateCollectionInput,
): Promise<void> {
  authorize(actor, "collection.update");
  await withRuleErrors(() =>
    db.$transaction(async (tx) => {
      const before = found(
        await tx.collection.findUnique({
          where: { id },
          select: {
            branchId: true,
            amount: true,
            collectedOn: true,
            purpose: true,
            description: true,
            correctionNote: true,
            correctsCollectionId: true,
            lockedAt: true,
          },
        }),
      );
      authorize(actor, "collection.update", { branchId: before.branchId });

      const approved =
        (await weekIsApproved(tx, before.branchId, before.collectedOn)) ||
        (await weekIsApproved(tx, before.branchId, input.collectedOn));
      const lock = collectionLockReason(before.lockedAt, approved, now);
      if (lock) throw new AppError("RULE_VIOLATION", LOCK_MESSAGES[lock]);

      const isCorrection = before.correctsCollectionId !== null;
      const amount = checkedAmount(input.amount, isCorrection);
      assertNotFuture(input.collectedOn, now);
      if (isCorrection && !input.correctionNote) {
        throw new AppError("VALIDATION", "A correction needs its reason.");
      }

      if (toPaisa(amount) !== toPaisa(before.amount.toString())) {
        const originalId = before.correctsCollectionId ?? id;
        const others = await correctionAmounts(tx, originalId, id);
        if (!correctedTotalIsValid([...others, amount])) {
          throw new AppError("RULE_VIOLATION", BELOW_ZERO);
        }
      }

      const data = {
        amount,
        collectedOn: input.collectedOn,
        purpose: input.purpose,
        description: input.description,
        ...(isCorrection ? { correctionNote: input.correctionNote } : {}),
      };
      await tx.collection.update({ where: { id }, data });
      await recordAudit(tx, actor, request, {
        action: "collection.update",
        entityType: "Collection",
        entityId: id,
        branchId: before.branchId,
        before: {
          amount: before.amount,
          collectedOn: formatDateOnly(before.collectedOn),
          purpose: before.purpose,
          description: before.description,
          ...(isCorrection ? { correctionNote: before.correctionNote } : {}),
        },
        after: { ...data, collectedOn: formatDateOnly(input.collectedOn) },
      });
    }),
  );
}

/**
 * Records a correction of an original entry (amendment A1, decision 7a): dated today, in the
 * same branch, positive or negative but never zero, and never taking the original plus its
 * corrections below zero. It works after the original is locked; that is its purpose.
 */
export async function createCorrection(
  { db, actor, request, now = new Date() }: ServiceContext,
  originalId: string,
  input: CorrectionInput,
): Promise<{ id: string }> {
  authorize(actor, "collection.correct");
  const amount = checkedAmount(input.amount, true);
  return withRuleErrors(() =>
    db.$transaction(async (tx) => {
      const original = found(
        await tx.collection.findUnique({
          where: { id: originalId },
          select: { branchId: true, purpose: true, correctsCollectionId: true },
        }),
      );
      authorize(actor, "collection.correct", { branchId: original.branchId });
      if (original.correctsCollectionId) {
        throw new AppError("VALIDATION", "Correct the original entry, not another correction.");
      }
      const today = businessToday(now);
      if (await weekIsApproved(tx, original.branchId, today)) {
        throw new AppError(
          "RULE_VIOLATION",
          "This week's report is approved; no new entries can be added.",
        );
      }
      if (!correctedTotalIsValid([...(await correctionAmounts(tx, originalId)), amount])) {
        throw new AppError("RULE_VIOLATION", BELOW_ZERO);
      }
      const correction = await tx.collection.create({
        data: {
          branchId: original.branchId,
          amount,
          collectedOn: today,
          purpose: original.purpose,
          enteredById: actor.id,
          correctsCollectionId: originalId,
          correctionNote: input.correctionNote,
        },
        select: { id: true },
      });
      await recordAudit(tx, actor, request, {
        action: "collection.correct",
        entityType: "Collection",
        entityId: correction.id,
        branchId: original.branchId,
        after: {
          originalId,
          correctionId: correction.id,
          amount,
          reason: input.correctionNote,
          collectedOn: formatDateOnly(today),
        },
      });
      return correction;
    }),
  );
}

/**
 * Finance marks a collection as routed to the main account (section 6.3). Only the routing
 * fields change, which the database allows even on locked rows. Routing happens once.
 */
export async function routeCollection(
  { db, actor, request, now = new Date() }: ServiceContext,
  id: string,
  routingReference: string,
): Promise<void> {
  authorize(actor, "collection.route");
  await withRuleErrors(() =>
    db.$transaction(async (tx) => {
      const row = found(
        await tx.collection.findUnique({ where: { id }, select: { branchId: true } }),
      );
      authorize(actor, "collection.route", { branchId: row.branchId });
      const { count } = await tx.collection.updateMany({
        where: { id, routedAt: null },
        data: { routedAt: now, routedById: actor.id, routingReference },
      });
      if (count === 0) throw new AppError("CONFLICT", "This collection is already routed.");
      await recordAudit(tx, actor, request, {
        action: "collection.route",
        entityType: "Collection",
        entityId: id,
        branchId: row.branchId,
        before: { routedAt: null },
        after: { routedAt: now, routingReference },
      });
    }),
  );
}
