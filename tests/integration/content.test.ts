import { randomInt } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "@/lib/generated/prisma/client";
import type { Actor } from "@/lib/permissions";
import {
  listContactMessages,
  markContactMessageHandled,
  submitContactMessage,
} from "@/lib/services/contact";
import {
  createContent,
  discardContentDraft,
  getPublishedEntry,
  listPublishedEntries,
  publishContent,
  unpublishContent,
  updateContent,
} from "@/lib/services/content";
import { createEvent, listPublishedEvents, setEventPublished } from "@/lib/services/events";
import { eventSchema } from "@/lib/validation/events";
import { TEST_REQUEST, contextFor, createActor } from "./helpers/context";
import { createTestPrisma } from "./helpers/prisma";
import { createBranch, pool } from "./helpers/sql";

let prisma: PrismaClient;
let editor: Actor;

const slug = () => `test-page-${Date.now()}-${randomInt(1_000_000)}`;

beforeAll(async () => {
  prisma = createTestPrisma();
  editor = await createActor("CONTENT_EDITOR");
});

afterAll(async () => {
  await prisma.$disconnect();
  await pool.end();
});

describe("content manager (section 7.2)", () => {
  it("keeps drafts hidden until published, and edits pending until republished", async () => {
    const ctx = contextFor(prisma, editor);
    const page = slug();
    const { id } = await createContent(ctx, {
      type: "PAGE",
      slug: page,
      locale: "en",
      title: "First title",
      body: "First body",
    });
    expect(await getPublishedEntry(prisma, "PAGE", page, "en")).toBeNull();

    await publishContent(ctx, id);
    expect(await getPublishedEntry(prisma, "PAGE", page, "en")).toMatchObject({
      title: "First title",
      fallback: false,
    });

    const saved = await updateContent(ctx, id, { title: "Second title", body: "Second body" });
    expect(saved.pending).toBe(true);
    expect((await getPublishedEntry(prisma, "PAGE", page, "en"))!.title).toBe("First title");

    await publishContent(ctx, id);
    expect(await getPublishedEntry(prisma, "PAGE", page, "en")).toMatchObject({
      title: "Second title",
      body: "Second body",
    });

    await updateContent(ctx, id, { title: "Abandoned", body: "Abandoned" });
    await discardContentDraft(ctx, id);
    expect(await prisma.contentEntry.findUniqueOrThrow({ where: { id } })).toMatchObject({
      draftTitle: null,
      title: "Second title",
    });

    await unpublishContent(ctx, id);
    expect(await getPublishedEntry(prisma, "PAGE", page, "en")).toBeNull();

    const actions = await prisma.auditLog.findMany({
      where: { entityId: id },
      orderBy: { createdAt: "asc" },
      select: { action: true },
    });
    expect(actions.map((row) => row.action)).toEqual([
      "content.create",
      "content.publish",
      "content.saveDraft",
      "content.publish",
      "content.saveDraft",
      "content.discardDraft",
      "content.unpublish",
    ]);
  });

  it("keeps slugs unique per type and language, and fixed once published", async () => {
    const ctx = contextFor(prisma, editor);
    const page = slug();
    const { id } = await createContent(ctx, {
      type: "PROGRAM",
      slug: page,
      locale: "en",
      title: "One",
      body: "x",
    });
    await expect(
      createContent(ctx, { type: "PROGRAM", slug: page, locale: "en", title: "Two", body: "x" }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(
      createContent(ctx, { type: "PROGRAM", slug: page, locale: "ur", title: "دو", body: "x" }),
    ).resolves.toHaveProperty("id");
    await publishContent(ctx, id);
    await unpublishContent(ctx, id);
    await expect(
      updateContent(ctx, id, { title: "One", body: "x", slug: `${page}-renamed` }),
    ).rejects.toMatchObject({ code: "RULE_VIOLATION" });
  });

  it("falls back to English when the Urdu version is missing (section 7.4)", async () => {
    const ctx = contextFor(prisma, editor);
    const both = slug();
    const englishOnly = slug();
    for (const [entrySlug, locale, title] of [
      [both, "en", "Tutoring"],
      [both, "ur", "ٹیوشن"],
      [englishOnly, "en", "Food drive"],
    ] as const) {
      const { id } = await createContent(ctx, {
        type: "PROGRAM",
        slug: entrySlug,
        locale,
        title,
        body: "x",
      });
      await publishContent(ctx, id);
    }
    const urdu = await listPublishedEntries(prisma, "PROGRAM", "ur");
    expect(urdu.find((entry) => entry.slug === both)).toMatchObject({
      title: "ٹیوشن",
      fallback: false,
    });
    expect(urdu.find((entry) => entry.slug === englishOnly)).toMatchObject({
      title: "Food drive",
      fallback: true,
    });
    expect(await getPublishedEntry(prisma, "PROGRAM", englishOnly, "ur")).toMatchObject({
      fallback: true,
    });
  });

  it("is refused to roles without content access", async () => {
    for (const role of ["BRANCH_LEAD", "FINANCE_REVIEWER", "HR_LEAD"] as const) {
      const actor =
        role === "BRANCH_LEAD"
          ? await createActor(role, await createBranch())
          : await createActor(role);
      await expect(
        createContent(contextFor(prisma, actor), {
          type: "PAGE",
          slug: slug(),
          locale: "en",
          title: "No",
          body: "x",
        }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    }
  });
});

describe("events (decision 6)", () => {
  it("shows only published events, and rejects an end before the start", async () => {
    const input = eventSchema.parse({
      titleEn: `Clean-up day ${Date.now()}`,
      titleUr: "",
      startsAt: "2026-12-05T09:00",
      endsAt: "2026-12-05T13:00",
      location: "City park",
      branchId: "",
    });
    expect(input.startsAt.toISOString()).toBe("2026-12-05T04:00:00.000Z");
    expect(input.titleUr).toBeNull();

    const { id } = await createEvent(contextFor(prisma, editor), input);
    expect((await listPublishedEvents(prisma)).map((event) => event.id)).not.toContain(id);
    await setEventPublished(contextFor(prisma, editor), id, true);
    expect((await listPublishedEvents(prisma)).map((event) => event.id)).toContain(id);

    expect(
      eventSchema.safeParse({
        ...input,
        startsAt: "2026-12-05T09:00",
        endsAt: "2026-12-05T08:00",
        titleUr: "",
        branchId: "",
      }).success,
    ).toBe(false);
  });
});

describe("contact form (section 7.1)", () => {
  it("stores the message, audits ids only, and lets Super Admin handle it", async () => {
    const email = `visitor-${Date.now()}@example.test`;
    await submitContactMessage(
      prisma,
      { name: "Visitor", email, message: "Is there a branch in Quetta?" },
      TEST_REQUEST,
    );
    const stored = await prisma.contactMessage.findFirstOrThrow({ where: { email } });
    const audit = await prisma.auditLog.findFirstOrThrow({
      where: { action: "contactMessage.submit", entityId: stored.id },
    });
    expect(JSON.stringify(audit)).not.toContain(email);

    const admin = await createActor("SUPER_ADMIN");
    const open = await listContactMessages(contextFor(prisma, admin), { handled: false });
    expect(open.items.map((message) => message.id)).toContain(stored.id);
    await markContactMessageHandled(contextFor(prisma, admin), stored.id);
    expect(
      (await prisma.contactMessage.findUniqueOrThrow({ where: { id: stored.id } })).handledById,
    ).toBe(admin.id);

    await expect(listContactMessages(contextFor(prisma, editor))).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});
