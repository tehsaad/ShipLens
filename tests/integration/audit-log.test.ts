import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "@/lib/generated/prisma/client";
import { addDays, parseDateOnly } from "@/lib/dates";
import type { Actor } from "@/lib/permissions";
import { recordAudit } from "@/lib/services/audit";
import { auditFilterOptions, listAuditLog } from "@/lib/services/audit-log";
import { TEST_REQUEST, contextFor, createActor } from "./helpers/context";
import { createTestPrisma } from "./helpers/prisma";
import { businessDate, pool } from "./helpers/sql";

let prisma: PrismaClient;
let admin: Actor;
let editor: Actor;
const entityId = `audit-test-${Date.now()}`;

beforeAll(async () => {
  prisma = createTestPrisma();
  admin = await createActor("SUPER_ADMIN");
  editor = await createActor("CONTENT_EDITOR");
  for (const action of ["content.create", "content.publish", "member.export"]) {
    await recordAudit(prisma, editor, TEST_REQUEST, {
      action,
      entityType: "ContentEntry",
      entityId,
      after: { title: "Audited" },
    });
  }
});

afterAll(async () => {
  await prisma.$disconnect();
  await pool.end();
});

describe("audit log viewer (section 7.2)", () => {
  it("filters by actor, entity, action and date, newest first", async () => {
    const ctx = contextFor(prisma, admin);
    const byActor = await listAuditLog(ctx, { actorId: editor.id });
    expect(byActor.total).toBe(3);
    expect(byActor.items.map((entry) => entry.action)).toEqual([
      "member.export",
      "content.publish",
      "content.create",
    ]);
    expect(byActor.items[0]).toMatchObject({
      actorRole: "CONTENT_EDITOR",
      ipAddress: "127.0.0.1",
      after: { title: "Audited" },
    });

    const exports = await listAuditLog(ctx, { entityId, action: "EXPORT" });
    expect(exports.items.map((entry) => entry.action)).toEqual(["member.export"]);

    const byEntity = await listAuditLog(ctx, { entityType: "ContentEntry", entityId });
    expect(byEntity.total).toBe(3);

    const today = parseDateOnly(await businessDate());
    expect((await listAuditLog(ctx, { entityId, from: today, to: today })).total).toBe(3);
    expect((await listAuditLog(ctx, { entityId, from: addDays(today, 1) })).total).toBe(0);
    expect((await listAuditLog(ctx, { entityId, to: addDays(today, -1) })).total).toBe(0);

    const options = await auditFilterOptions(ctx);
    expect(options.users.map((user) => user.id)).toContain(editor.id);
    expect(options.entityTypes).toContain("ContentEntry");
  });

  it("is for Super Admin only", async () => {
    for (const role of ["FINANCE_REVIEWER", "CONTENT_EDITOR", "HR_LEAD"] as const) {
      const ctx = contextFor(prisma, await createActor(role));
      await expect(listAuditLog(ctx)).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(auditFilterOptions(ctx)).rejects.toMatchObject({ code: "FORBIDDEN" });
    }
  });
});
