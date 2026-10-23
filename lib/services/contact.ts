import "server-only";
import type { Prisma, PrismaClient } from "@/lib/generated/prisma/client";
import { authorize } from "@/lib/permissions";
import type { RequestContext } from "@/lib/request-context";
import { recordAudit } from "@/lib/services/audit";
import {
  found,
  pageArgs,
  toPage,
  withRuleErrors,
  type Page,
  type ServiceContext,
} from "@/lib/services/shared";

/** The public contact form (section 7.1); SUPER_ADMIN reads and handles the messages. */

export async function submitContactMessage(
  db: PrismaClient,
  input: { name: string; email: string; message: string },
  request: RequestContext,
): Promise<void> {
  authorize(null, "contactMessage.submit");
  await db.$transaction(async (tx) => {
    const message = await tx.contactMessage.create({ data: input, select: { id: true } });
    // Ids only: the sender's details stay in the message, not in the permanent audit log.
    await recordAudit(tx, null, request, {
      action: "contactMessage.submit",
      entityType: "ContactMessage",
      entityId: message.id,
    });
  });
}

const messageSelect = {
  id: true,
  name: true,
  email: true,
  message: true,
  receivedAt: true,
  handledAt: true,
  handledBy: { select: { name: true } },
} satisfies Prisma.ContactMessageSelect;

export type ContactMessageView = Prisma.ContactMessageGetPayload<{ select: typeof messageSelect }>;

export async function listContactMessages(
  { db, actor }: ServiceContext,
  filters: { handled?: boolean | null; page?: number } = {},
): Promise<Page<ContactMessageView>> {
  authorize(actor, "contactMessage.read");
  const where: Prisma.ContactMessageWhereInput =
    filters.handled === true
      ? { handledAt: { not: null } }
      : filters.handled === false
        ? { handledAt: null }
        : {};
  const page = filters.page ?? 1;
  const [items, total] = await Promise.all([
    db.contactMessage.findMany({
      where,
      select: messageSelect,
      orderBy: { receivedAt: "desc" },
      ...pageArgs(page),
    }),
    db.contactMessage.count({ where }),
  ]);
  return toPage(items, total, page);
}

/** Marks a message as handled once someone has replied. */
export async function markContactMessageHandled(
  { db, actor, request, now = new Date() }: ServiceContext,
  id: string,
): Promise<void> {
  authorize(actor, "contactMessage.handle");
  await withRuleErrors(() =>
    db.$transaction(async (tx) => {
      found(await tx.contactMessage.findUnique({ where: { id }, select: { id: true } }));
      const { count } = await tx.contactMessage.updateMany({
        where: { id, handledAt: null },
        data: { handledAt: now, handledById: actor.id },
      });
      if (count === 0) return;
      await recordAudit(tx, actor, request, {
        action: "contactMessage.handle",
        entityType: "ContactMessage",
        entityId: id,
        after: { handledAt: now },
      });
    }),
  );
}
