import "server-only";
import type {
  ContentType,
  Locale,
  Prisma,
  PrismaClient,
  PublishStatus,
} from "@/lib/generated/prisma/client";
import { databaseErrorCode } from "@/lib/db-errors";
import { AppError } from "@/lib/errors";
import { authorize } from "@/lib/permissions";
import { recordAudit } from "@/lib/services/audit";
import { found, withRuleErrors, type ServiceContext } from "@/lib/services/shared";
import type { CreateContentInput, UpdateContentInput } from "@/lib/validation/content";

/**
 * Site content (sections 7.1, 7.2 and 7.4). Staff side: CONTENT_EDITOR and SUPER_ADMIN create,
 * edit, preview, publish and unpublish entries; edits to a PUBLISHED entry are kept as a
 * pending draft until republished. Public side: published entries per locale, falling back to
 * English when the Urdu version is missing.
 */

const UNIQUE_VIOLATION = "23505";
const SLUG_TAKEN = "That slug is already used for this type and language.";

const entrySelect = {
  id: true,
  type: true,
  slug: true,
  locale: true,
  title: true,
  body: true,
  draftTitle: true,
  draftBody: true,
  status: true,
  publishedAt: true,
  updatedAt: true,
  updatedBy: { select: { name: true } },
} satisfies Prisma.ContentEntrySelect;

export type ContentEntryView = Prisma.ContentEntryGetPayload<{ select: typeof entrySelect }>;

export async function listContent(
  { db, actor }: ServiceContext,
  filters: {
    type?: ContentType | null;
    locale?: Locale | null;
    status?: PublishStatus | null;
  } = {},
): Promise<ContentEntryView[]> {
  authorize(actor, "content.read");
  return db.contentEntry.findMany({
    where: {
      ...(filters.type ? { type: filters.type } : {}),
      ...(filters.locale ? { locale: filters.locale } : {}),
      ...(filters.status ? { status: filters.status } : {}),
    },
    select: entrySelect,
    orderBy: [{ type: "asc" }, { slug: "asc" }, { locale: "asc" }],
  });
}

export async function getContent(
  { db, actor }: ServiceContext,
  id: string,
): Promise<ContentEntryView> {
  authorize(actor, "content.read");
  return found(await db.contentEntry.findUnique({ where: { id }, select: entrySelect }));
}

function slugConflict(error: unknown): never {
  if (databaseErrorCode(error) === UNIQUE_VIOLATION) throw new AppError("CONFLICT", SLUG_TAKEN);
  throw error;
}

/** New entries start as DRAFT and stay hidden until published. */
export async function createContent(
  { db, actor, request }: ServiceContext,
  input: CreateContentInput,
): Promise<{ id: string }> {
  authorize(actor, "content.create");
  try {
    return await db.$transaction(async (tx) => {
      const entry = await tx.contentEntry.create({
        data: { ...input, status: "DRAFT", updatedById: actor.id },
        select: { id: true },
      });
      await recordAudit(tx, actor, request, {
        action: "content.create",
        entityType: "ContentEntry",
        entityId: entry.id,
        after: { type: input.type, slug: input.slug, locale: input.locale, title: input.title },
      });
      return entry;
    });
  } catch (error) {
    slugConflict(error);
  }
}

/**
 * Saves an edit. A DRAFT entry is changed directly. A PUBLISHED entry keeps its live title and
 * body; the edit is stored as its pending draft until it is republished (section 7.2).
 */
export async function updateContent(
  { db, actor, request }: ServiceContext,
  id: string,
  input: UpdateContentInput,
): Promise<{ pending: boolean }> {
  authorize(actor, "content.update");
  try {
    return await db.$transaction(async (tx) => {
      const before = found(
        await tx.contentEntry.findUnique({
          where: { id },
          select: { status: true, slug: true, title: true, draftTitle: true, publishedAt: true },
        }),
      );
      const slugChanged = input.slug !== undefined && input.slug !== before.slug;
      if (slugChanged && before.publishedAt) {
        throw new AppError(
          "RULE_VIOLATION",
          "The slug of a page that has been published cannot change.",
        );
      }
      const pending = before.status === "PUBLISHED";
      await tx.contentEntry.update({
        where: { id },
        data: pending
          ? { draftTitle: input.title, draftBody: input.body, updatedById: actor.id }
          : {
              title: input.title,
              body: input.body,
              ...(slugChanged ? { slug: input.slug } : {}),
              updatedById: actor.id,
            },
      });
      await recordAudit(tx, actor, request, {
        action: pending ? "content.saveDraft" : "content.update",
        entityType: "ContentEntry",
        entityId: id,
        before: { title: before.draftTitle ?? before.title, slug: before.slug },
        after: { title: input.title, slug: slugChanged ? input.slug : before.slug, pending },
      });
      return { pending };
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    slugConflict(error);
  }
}

/** Publishes an entry, applying any pending draft. */
export async function publishContent(
  { db, actor, request, now = new Date() }: ServiceContext,
  id: string,
) {
  authorize(actor, "content.publish");
  await withRuleErrors(() =>
    db.$transaction(async (tx) => {
      const entry = found(
        await tx.contentEntry.findUnique({
          where: { id },
          select: { status: true, title: true, body: true, draftTitle: true, draftBody: true },
        }),
      );
      if (entry.status === "PUBLISHED" && entry.draftTitle === null) {
        throw new AppError(
          "RULE_VIOLATION",
          "This entry is already published with no pending changes.",
        );
      }
      await tx.contentEntry.update({
        where: { id },
        data: {
          status: "PUBLISHED",
          publishedAt: now,
          title: entry.draftTitle ?? entry.title,
          body: entry.draftBody ?? entry.body,
          draftTitle: null,
          draftBody: null,
          updatedById: actor.id,
        },
      });
      await recordAudit(tx, actor, request, {
        action: "content.publish",
        entityType: "ContentEntry",
        entityId: id,
        before: { status: entry.status, title: entry.title },
        after: { status: "PUBLISHED", title: entry.draftTitle ?? entry.title },
      });
    }),
  );
}

/** Takes an entry off the public site. A pending draft becomes the entry's content. */
export async function unpublishContent({ db, actor, request }: ServiceContext, id: string) {
  authorize(actor, "content.publish");
  await withRuleErrors(() =>
    db.$transaction(async (tx) => {
      const entry = found(
        await tx.contentEntry.findUnique({
          where: { id },
          select: { status: true, title: true, body: true, draftTitle: true, draftBody: true },
        }),
      );
      if (entry.status !== "PUBLISHED")
        throw new AppError("RULE_VIOLATION", "This entry is not published.");
      await tx.contentEntry.update({
        where: { id },
        data: {
          status: "DRAFT",
          title: entry.draftTitle ?? entry.title,
          body: entry.draftBody ?? entry.body,
          draftTitle: null,
          draftBody: null,
          updatedById: actor.id,
        },
      });
      await recordAudit(tx, actor, request, {
        action: "content.unpublish",
        entityType: "ContentEntry",
        entityId: id,
        before: { status: "PUBLISHED" },
        after: { status: "DRAFT" },
      });
    }),
  );
}

/** Drops the pending draft of a published entry. */
export async function discardContentDraft({ db, actor, request }: ServiceContext, id: string) {
  authorize(actor, "content.update");
  await withRuleErrors(() =>
    db.$transaction(async (tx) => {
      const entry = found(
        await tx.contentEntry.findUnique({ where: { id }, select: { draftTitle: true } }),
      );
      if (entry.draftTitle === null) return;
      await tx.contentEntry.update({ where: { id }, data: { draftTitle: null, draftBody: null } });
      await recordAudit(tx, actor, request, {
        action: "content.discardDraft",
        entityType: "ContentEntry",
        entityId: id,
        before: { draftTitle: entry.draftTitle },
      });
    }),
  );
}

// ---------------------------------------------------------------------------
// Public reads (no session; content.readPublished is allowed for everyone)
// ---------------------------------------------------------------------------

export type PublishedEntry = {
  slug: string;
  title: string;
  body: string;
  publishedAt: Date | null;
  /** True when the Urdu version is missing and English is shown instead (section 7.4). */
  fallback: boolean;
};

const publicSelect = {
  slug: true,
  locale: true,
  title: true,
  body: true,
  publishedAt: true,
} as const;

/** One published entry in the locale, or its English version with the fallback flag. */
export async function getPublishedEntry(
  db: PrismaClient,
  type: ContentType,
  slug: string,
  locale: Locale,
): Promise<PublishedEntry | null> {
  authorize(null, "content.readPublished");
  const rows = await db.contentEntry.findMany({
    where: {
      type,
      slug,
      status: "PUBLISHED",
      locale: { in: locale === "en" ? ["en"] : [locale, "en"] },
    },
    select: publicSelect,
  });
  const exact = rows.find((row) => row.locale === locale);
  const row = exact ?? rows.find((candidate) => candidate.locale === "en");
  return row ? { ...row, fallback: !exact } : null;
}

/** Every published entry of a type, one per slug, in the locale or falling back to English. */
export async function listPublishedEntries(
  db: PrismaClient,
  type: ContentType,
  locale: Locale,
): Promise<PublishedEntry[]> {
  authorize(null, "content.readPublished");
  // Announcements read newest-first; programs and pages read in a stable slug order so the
  // list matches the way an editor names and thinks of them. (Ordering by publishedAt made
  // "program-two" — published after "program-one" — appear first, so the two swapped places.)
  const rows = await db.contentEntry.findMany({
    where: { type, status: "PUBLISHED", locale: { in: locale === "en" ? ["en"] : [locale, "en"] } },
    select: publicSelect,
    orderBy:
      type === "ANNOUNCEMENT"
        ? [{ publishedAt: "desc" }, { slug: "asc" }]
        : [{ slug: "asc" }, { publishedAt: "desc" }],
  });
  const bySlug = new Map<string, PublishedEntry>();
  for (const row of rows) {
    const current = bySlug.get(row.slug);
    if (!current || (current.fallback && row.locale === locale)) {
      bySlug.set(row.slug, { ...row, fallback: row.locale !== locale });
    }
  }
  return [...bySlug.values()];
}
