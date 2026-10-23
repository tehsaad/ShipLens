import "server-only";
import type { Prisma, PrismaClient } from "@/lib/generated/prisma/client";
import { AppError } from "@/lib/errors";
import { authorize } from "@/lib/permissions";
import { recordAudit } from "@/lib/services/audit";
import { found, withRuleErrors, type ServiceContext } from "@/lib/services/shared";
import type { EventInput } from "@/lib/validation/events";

/** Events (sections 5 and 7.1, decision 6): managed by CONTENT_EDITOR and SUPER_ADMIN. */

const eventSelect = {
  id: true,
  titleEn: true,
  titleUr: true,
  startsAt: true,
  endsAt: true,
  location: true,
  branchId: true,
  branch: { select: { code: true, name: true, city: true } },
  status: true,
  updatedAt: true,
} satisfies Prisma.EventSelect;

export type EventView = Prisma.EventGetPayload<{ select: typeof eventSelect }>;

export async function listEvents({ db, actor }: ServiceContext): Promise<EventView[]> {
  authorize(actor, "event.read");
  return db.event.findMany({ select: eventSelect, orderBy: { startsAt: "desc" } });
}

export async function getEvent({ db, actor }: ServiceContext, id: string): Promise<EventView> {
  authorize(actor, "event.read");
  return found(await db.event.findUnique({ where: { id }, select: eventSelect }));
}

function auditable(input: EventInput) {
  return { ...input, startsAt: input.startsAt.toISOString(), endsAt: input.endsAt.toISOString() };
}

export async function createEvent({ db, actor, request }: ServiceContext, input: EventInput) {
  authorize(actor, "event.create");
  return withRuleErrors(() =>
    db.$transaction(async (tx) => {
      const event = await tx.event.create({
        data: { ...input, status: "DRAFT" },
        select: { id: true },
      });
      await recordAudit(tx, actor, request, {
        action: "event.create",
        entityType: "Event",
        entityId: event.id,
        branchId: input.branchId,
        after: auditable(input),
      });
      return event;
    }),
  );
}

export async function updateEvent(
  { db, actor, request }: ServiceContext,
  id: string,
  input: EventInput,
) {
  authorize(actor, "event.update");
  await withRuleErrors(() =>
    db.$transaction(async (tx) => {
      const before = found(await tx.event.findUnique({ where: { id }, select: eventSelect }));
      await tx.event.update({ where: { id }, data: input });
      await recordAudit(tx, actor, request, {
        action: "event.update",
        entityType: "Event",
        entityId: id,
        branchId: input.branchId,
        before: {
          titleEn: before.titleEn,
          titleUr: before.titleUr,
          startsAt: before.startsAt,
          endsAt: before.endsAt,
          location: before.location,
          branchId: before.branchId,
        },
        after: auditable(input),
      });
    }),
  );
}

/** Publishes or unpublishes an event; only PUBLISHED events appear on the public site. */
export async function setEventPublished(
  { db, actor, request }: ServiceContext,
  id: string,
  published: boolean,
) {
  authorize(actor, "event.publish");
  await withRuleErrors(() =>
    db.$transaction(async (tx) => {
      const before = found(
        await tx.event.findUnique({ where: { id }, select: { status: true, branchId: true } }),
      );
      const status = published ? "PUBLISHED" : "DRAFT";
      if (before.status === status) {
        throw new AppError(
          "RULE_VIOLATION",
          published ? "The event is already published." : "The event is not published.",
        );
      }
      await tx.event.update({ where: { id }, data: { status } });
      await recordAudit(tx, actor, request, {
        action: published ? "event.publish" : "event.unpublish",
        entityType: "Event",
        entityId: id,
        branchId: before.branchId,
        before: { status: before.status },
        after: { status },
      });
    }),
  );
}

/** Branches an event can belong to (or none, for head office events). */
export async function listEventBranches({ db, actor }: ServiceContext) {
  authorize(actor, "event.update");
  return db.branch.findMany({
    where: { status: { not: "CLOSED" } },
    select: { id: true, code: true, name: true },
    orderBy: { code: "asc" },
  });
}

export type PublicEvent = {
  id: string;
  titleEn: string;
  titleUr: string | null;
  startsAt: Date;
  endsAt: Date;
  location: string;
  branch: { code: string; city: string } | null;
};

/** Published events for the public site, soonest first (section 7.1). */
export async function listPublishedEvents(db: PrismaClient): Promise<PublicEvent[]> {
  authorize(null, "content.readPublished");
  return db.event.findMany({
    where: { status: "PUBLISHED" },
    select: {
      id: true,
      titleEn: true,
      titleUr: true,
      startsAt: true,
      endsAt: true,
      location: true,
      branch: { select: { code: true, city: true } },
    },
    orderBy: { startsAt: "asc" },
  });
}
