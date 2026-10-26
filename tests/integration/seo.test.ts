import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "@/lib/generated/prisma/client";
import type { Actor } from "@/lib/permissions";
import { loadSourceDates } from "@/lib/seo/last-modified";
import { createContent, publishContent } from "@/lib/services/content";
import { createEvent, setEventPublished } from "@/lib/services/events";
import { contextFor, createActor } from "./helpers/context";
import { createTestPrisma } from "./helpers/prisma";
import { createBranch, pool, setBranchStatus } from "./helpers/sql";

/**
 * The sitemap's last-modified dates come only from records the public sees: published content
 * and events, and active branches. A newer draft, unpublished event or inactive branch must
 * not move them.
 */

let prisma: PrismaClient;
let editor: Actor;
const LATER = new Date("2099-01-01T00:00:00Z");
const LATEST = new Date("2099-06-01T00:00:00Z");

const setUpdatedAt = (table: "events" | "branches", id: string, at: Date) =>
  pool.query(`UPDATE ${table} SET updated_at = $2 WHERE id = $1`, [id, at]);

beforeAll(async () => {
  prisma = createTestPrisma();
  editor = await createActor("CONTENT_EDITOR");
});

afterAll(async () => {
  await prisma.$disconnect();
  await pool.end();
});

describe("sitemap last-modified dates", () => {
  it("count a content entry from its publication, not while it is a draft", async () => {
    const ctx = contextFor(prisma, editor);
    const before = await loadSourceDates(prisma);
    const { id } = await createContent(ctx, {
      type: "PROGRAM",
      slug: `seo-program-${Date.now()}`,
      locale: "en",
      title: "Draft program",
      body: "Not public yet.",
    });
    expect((await loadSourceDates(prisma)).programs).toEqual(before.programs);

    await publishContent(ctx, id);
    const published = await prisma.contentEntry.findUniqueOrThrow({ where: { id } });
    expect((await loadSourceDates(prisma)).programs).toEqual(published.publishedAt);
  });

  it("count published events only", async () => {
    const ctx = contextFor(prisma, editor);
    const { id } = await createEvent(ctx, {
      titleEn: "SEO test event",
      titleUr: null,
      startsAt: new Date("2099-01-10T05:00:00Z"),
      endsAt: new Date("2099-01-10T08:00:00Z"),
      location: "Test hall",
      branchId: null,
    });
    await setUpdatedAt("events", id, LATER);
    expect((await loadSourceDates(prisma)).events?.getTime() ?? 0).toBeLessThan(LATER.getTime());

    await setEventPublished(ctx, id, true);
    await setUpdatedAt("events", id, LATER);
    expect((await loadSourceDates(prisma)).events).toEqual(LATER);
    await setEventPublished(ctx, id, false);
  });

  it("count active branches only", async () => {
    const forming = await createBranch("FORMING");
    await setUpdatedAt("branches", forming, LATEST);
    expect((await loadSourceDates(prisma)).branches?.getTime() ?? 0).toBeLessThan(LATEST.getTime());

    const active = await createBranch("ACTIVE");
    await setUpdatedAt("branches", active, LATEST);
    expect((await loadSourceDates(prisma)).branches).toEqual(LATEST);
    // Leave no active test branch behind for later files.
    await setBranchStatus(active, "CLOSED");
  });
});
