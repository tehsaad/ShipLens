import "server-only";
import type { PrismaClient } from "@/lib/generated/prisma/client";
import type { ContentSource, PublicPage } from "./pages";

/** When the published records of each kind last changed. Missing: no published records. */
export type SourceDates = Partial<Record<ContentSource, Date>>;

/**
 * Reads the latest change of each kind of published record, with one aggregate query per kind.
 * Content entries count from their last publication (edits to a published entry stay drafts
 * until republished, so they do not change the page); events and branches from their last
 * update. Only published events and active branches count: nothing else reaches public pages.
 */
export async function loadSourceDates(db: PrismaClient): Promise<SourceDates> {
  const lastPublished = (type: "PAGE" | "PROGRAM" | "ANNOUNCEMENT", slug?: string) =>
    db.contentEntry.aggregate({
      _max: { publishedAt: true },
      where: { type, status: "PUBLISHED", ...(slug ? { slug } : {}) },
    });
  const [about, programs, announcements, events, branches] = await Promise.all([
    lastPublished("PAGE", "about"),
    lastPublished("PROGRAM"),
    lastPublished("ANNOUNCEMENT"),
    db.event.aggregate({ _max: { updatedAt: true }, where: { status: "PUBLISHED" } }),
    db.branch.aggregate({ _max: { updatedAt: true }, where: { status: "ACTIVE" } }),
  ]);
  const dates: SourceDates = {};
  const set = (source: ContentSource, value: Date | null) => {
    if (value) dates[source] = value;
  };
  set("about", about._max.publishedAt);
  set("programs", programs._max.publishedAt);
  set("announcements", announcements._max.publishedAt);
  set("events", events._max.updatedAt);
  set("branches", branches._max.updatedAt);
  return dates;
}

/**
 * A page's last-modified date: the latest change among the records it shows. Undefined for
 * pages built only from messages, or when none of their records exist; the sitemap then leaves
 * the date out rather than guessing.
 */
export function lastModifiedOf(page: Pick<PublicPage, "sources">, dates: SourceDates) {
  const known = page.sources.flatMap((source) => dates[source] ?? []);
  if (known.length === 0) return undefined;
  return new Date(Math.max(...known.map((date) => date.getTime())));
}
