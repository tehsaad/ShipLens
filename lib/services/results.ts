import "server-only";
import type { Prisma, PrismaClient, PublishStatus } from "@/lib/generated/prisma/client";
import { authorize, scopeFor } from "@/lib/permissions";
import { recordAudit } from "@/lib/services/audit";
import { found, listScope, withRuleErrors, type ServiceContext } from "@/lib/services/shared";
import type { ResultInput } from "@/lib/validation/results";

/**
 * Public results / achievements (sections 3 and 7). Staff side: SUPER_ADMIN, CONTENT_EDITOR
 * and HR_LEAD manage results network-wide; a BRANCH_LEAD manages only its own branch's
 * results. Public side: published results, shown with an image when one is attached. Image
 * bytes live in result_images and are never pulled into a list query.
 */

const adminSelect = {
  id: true,
  branchId: true,
  titleEn: true,
  titleUr: true,
  bodyEn: true,
  bodyUr: true,
  happenedOn: true,
  status: true,
  publishedAt: true,
  imageAltEn: true,
  imageAltUr: true,
  imageUpdatedAt: true,
  createdAt: true,
  updatedAt: true,
  branch: { select: { id: true, code: true, name: true, city: true } },
} satisfies Prisma.ResultSelect;

export type ResultView = Prisma.ResultGetPayload<{ select: typeof adminSelect }>;

const publicSelect = {
  id: true,
  branchId: true,
  titleEn: true,
  titleUr: true,
  bodyEn: true,
  bodyUr: true,
  happenedOn: true,
  publishedAt: true,
  imageAltEn: true,
  imageAltUr: true,
  imageUpdatedAt: true,
  branch: { select: { code: true, city: true, name: true } },
} satisfies Prisma.ResultSelect;

export type PublicResult = Prisma.ResultGetPayload<{ select: typeof publicSelect }>;

/** Staff list, scoped to the actor's branch for a BRANCH_LEAD. */
export async function listResults({ db, actor }: ServiceContext): Promise<ResultView[]> {
  const scope = listScope(actor, "result.read");
  return db.result.findMany({
    where: scope,
    select: adminSelect,
    orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
  });
}

export async function getResult({ db, actor }: ServiceContext, id: string): Promise<ResultView> {
  authorize(actor, "result.read");
  const row = found(await db.result.findUnique({ where: { id }, select: adminSelect }));
  // A branch lead may not open another branch's result (reported as not found).
  authorize(actor, "result.read", { branchId: row.branchId });
  return row;
}

export async function createResult(
  { db, actor, request }: ServiceContext,
  input: ResultInput,
): Promise<{ id: string }> {
  // Branch leads can only create for their own branch; network roles choose the branch (or none).
  const branchId =
    scopeFor(actor.role, "result.create") === "ownBranch" ? actor.branchId : input.branchId;
  authorize(actor, "result.create", { branchId });
  return withRuleErrors(() =>
    db.$transaction(async (tx) => {
      const row = await tx.result.create({
        data: {
          branchId,
          titleEn: input.titleEn,
          titleUr: input.titleUr,
          bodyEn: input.bodyEn,
          bodyUr: input.bodyUr,
          happenedOn: input.happenedOn,
        },
        select: { id: true },
      });
      await recordAudit(tx, actor, request, {
        action: "result.create",
        entityType: "Result",
        entityId: row.id,
        branchId,
        after: { titleEn: input.titleEn, branchId },
      });
      return row;
    }),
  );
}

/** Updates the text fields. Ownership (branchId) is fixed at creation and never moves. */
export async function updateResult(
  { db, actor, request }: ServiceContext,
  id: string,
  input: ResultInput,
): Promise<void> {
  const existing = found(
    await db.result.findUnique({ where: { id }, select: { id: true, branchId: true } }),
  );
  authorize(actor, "result.update", { branchId: existing.branchId });
  await withRuleErrors(() =>
    db.$transaction(async (tx) => {
      await tx.result.update({
        where: { id },
        data: {
          titleEn: input.titleEn,
          titleUr: input.titleUr,
          bodyEn: input.bodyEn,
          bodyUr: input.bodyUr,
          happenedOn: input.happenedOn,
        },
      });
      await recordAudit(tx, actor, request, {
        action: "result.update",
        entityType: "Result",
        entityId: id,
        branchId: existing.branchId,
        after: { titleEn: input.titleEn },
      });
    }),
  );
}

export async function setResultStatus(
  { db, actor, request, now }: ServiceContext,
  id: string,
  publish: boolean,
): Promise<void> {
  const existing = found(
    await db.result.findUnique({ where: { id }, select: { id: true, branchId: true } }),
  );
  authorize(actor, "result.publish", { branchId: existing.branchId });
  await withRuleErrors(() =>
    db.$transaction(async (tx) => {
      await tx.result.update({
        where: { id },
        data: {
          status: publish ? "PUBLISHED" : "DRAFT",
          publishedAt: publish ? (now ?? new Date()) : null,
        },
      });
      await recordAudit(tx, actor, request, {
        action: publish ? "result.publish" : "result.unpublish",
        entityType: "Result",
        entityId: id,
        branchId: existing.branchId,
      });
    }),
  );
}

/**
 * Stores (or replaces) the result's image together with its alt text, so an image is never
 * stored without a description. The caller has already validated the bytes and the alt text.
 */
export async function setResultImage(
  { db, actor, request, now }: ServiceContext,
  id: string,
  image: {
    data: Uint8Array<ArrayBuffer>;
    contentType: string;
    byteSize: number;
    altEn: string;
    altUr: string | null;
  },
): Promise<void> {
  const existing = found(
    await db.result.findUnique({ where: { id }, select: { id: true, branchId: true } }),
  );
  authorize(actor, "result.update", { branchId: existing.branchId });
  await withRuleErrors(() =>
    db.$transaction(async (tx) => {
      await tx.resultImage.upsert({
        where: { resultId: id },
        create: {
          resultId: id,
          data: image.data,
          contentType: image.contentType,
          byteSize: image.byteSize,
        },
        update: { data: image.data, contentType: image.contentType, byteSize: image.byteSize },
      });
      await tx.result.update({
        where: { id },
        data: {
          imageUpdatedAt: now ?? new Date(),
          imageAltEn: image.altEn,
          imageAltUr: image.altUr,
        },
      });
      await recordAudit(tx, actor, request, {
        action: "result.setImage",
        entityType: "Result",
        entityId: id,
        branchId: existing.branchId,
        after: { contentType: image.contentType, byteSize: image.byteSize },
      });
    }),
  );
}

/** Branches for the result's branch picker. Authorized for result creators; minimal fields. */
export async function listBranchOptions({
  db,
  actor,
}: ServiceContext): Promise<{ id: string; code: string; name: string }[]> {
  authorize(actor, "result.create");
  return db.branch.findMany({
    select: { id: true, code: true, name: true },
    orderBy: [{ code: "asc" }],
  });
}

/** Published results for the public site, newest first. No image bytes are read here. */
export async function listPublishedResults(db: PrismaClient): Promise<PublicResult[]> {
  authorize(null, "result.readPublished");
  return db.result.findMany({
    where: { status: "PUBLISHED" },
    select: publicSelect,
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
  });
}

export type ResultImageBytes = {
  data: Uint8Array;
  contentType: string;
  status: PublishStatus;
  branchId: string | null;
  imageUpdatedAt: Date | null;
};

/**
 * The image bytes for one result, or null when it has none. No authorization here: the media
 * route serves a published result's image to anyone, and a draft's only to staff who may read it.
 */
export async function getResultImage(
  db: PrismaClient,
  id: string,
): Promise<ResultImageBytes | null> {
  const row = await db.result.findUnique({
    where: { id },
    select: {
      status: true,
      branchId: true,
      imageUpdatedAt: true,
      image: { select: { data: true, contentType: true } },
    },
  });
  if (!row || !row.image) return null;
  return {
    data: row.image.data,
    contentType: row.image.contentType,
    status: row.status,
    branchId: row.branchId,
    imageUpdatedAt: row.imageUpdatedAt,
  };
}
