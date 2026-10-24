import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "@/lib/generated/prisma/client";
import { parseDateOnly } from "@/lib/dates";
import type { Actor } from "@/lib/permissions";
import { createCollection, routeCollection } from "@/lib/services/collections";
import {
  exportApplications,
  exportCollections,
  exportMembers,
  exportReports,
  exportUnrouted,
  type ExportFile,
} from "@/lib/services/exports";
import { contextFor, createActor } from "./helpers/context";
import { createTestPrisma } from "./helpers/prisma";
import { businessDate, createBranch, pool } from "./helpers/sql";

let prisma: PrismaClient;
let branchId: string;
let otherBranchId: string;
let lead: Actor;
let otherLead: Actor;
let finance: Actor;

/** The data lines of a CSV body (after the byte order mark and the header). */
function dataLines(file: ExportFile): string[] {
  const text = file.body as string;
  expect(text.startsWith("﻿")).toBe(true);
  return text.slice(1).trimEnd().split("\r\n").slice(1);
}

async function collect(actor: Actor, description: string | null = null): Promise<string> {
  const { id } = await createCollection(contextFor(prisma, actor), {
    amount: "250.00",
    collectedOn: parseDateOnly(await businessDate()),
    purpose: "GENERAL",
    description,
  });
  return id;
}

async function lastExportAudit(actor: Actor, action: string) {
  return prisma.auditLog.findFirstOrThrow({
    where: { actorId: actor.id, action },
    orderBy: { createdAt: "desc" },
  });
}

beforeAll(async () => {
  prisma = createTestPrisma();
  branchId = await createBranch();
  otherBranchId = await createBranch();
  lead = await createActor("BRANCH_LEAD", branchId);
  otherLead = await createActor("BRANCH_LEAD", otherBranchId);
  finance = await createActor("FINANCE_REVIEWER");
});

afterAll(async () => {
  await prisma.$disconnect();
  await pool.end();
});

describe("CSV exports (section 7.3)", () => {
  it("keeps a Branch Lead inside its own branch whatever branch it asks for", async () => {
    const own = await collect(lead);
    const foreign = await collect(otherLead);

    const file = await exportCollections(contextFor(prisma, lead), { branchId: otherBranchId });
    const lines = dataLines(file);
    expect(lines.some((line) => line.startsWith(own))).toBe(true);
    expect(lines.some((line) => line.startsWith(foreign))).toBe(false);
    expect(file.filename).toMatch(/^collections-\d{4}-\d{2}-\d{2}\.csv$/);
    expect(file.contentType).toBe("text/csv; charset=utf-8");

    const audit = await lastExportAudit(lead, "collection.export");
    expect(audit).toMatchObject({ entityType: "Collection", branchId, entityId: null });
    expect(audit.after).toEqual({
      format: "csv",
      rows: lines.length,
      filters: { branchId: otherBranchId },
    });
  });

  it("escapes cells and neutralises formulas in exported text", async () => {
    const id = await collect(lead, '=SUM(A1), "winter" drive');
    const line = dataLines(await exportCollections(contextFor(prisma, lead), {})).find((row) =>
      row.startsWith(id),
    );
    expect(line).toContain(`,"'=SUM(A1), ""winter"" drive",`);
    expect(line).toContain(",250.00,");
  });

  it("exports every unrouted collection of the actor's branches, and only unrouted ones", async () => {
    const unrouted = await collect(lead);
    const routed = await collect(lead);
    const foreign = await collect(otherLead);
    await routeCollection(contextFor(prisma, finance), routed, "TRX-EXPORT-1");

    const lines = dataLines(await exportUnrouted(contextFor(prisma, lead)));
    const ids = lines.map((line) => line.split(",")[0]);
    expect(ids).toContain(unrouted);
    expect(ids).not.toContain(routed);
    expect(ids).not.toContain(foreign);

    const all = dataLines(await exportUnrouted(contextFor(prisma, finance))).map(
      (line) => line.split(",")[0],
    );
    expect(all).toEqual(expect.arrayContaining([unrouted, foreign]));
    expect(await lastExportAudit(finance, "dashboard.exportUnrouted")).toMatchObject({
      branchId: null,
      after: { format: "csv", rows: all.length, filters: {} },
    });
  });

  it("exports members of the lead's branch only, with their teams", async () => {
    const code = (fullName: string, branch: string) =>
      prisma.member
        .create({
          data: {
            fullName,
            email: `${fullName.replace(/\s/g, ".").toLowerCase()}.${Date.now()}@example.test`,
            phone: "+923001112233",
            branchId: branch,
            joinedAt: new Date("2026-02-01T00:00:00Z"),
          },
          select: { memberCode: true },
        })
        .then((member) => member.memberCode);
    const own = await code("Export Own", branchId);
    const foreign = await code("Export Foreign", otherBranchId);

    const lines = dataLines(await exportMembers(contextFor(prisma, lead), { q: "Export" }));
    expect(lines.some((line) => line.startsWith(`${own},Export Own,`))).toBe(true);
    expect(lines.some((line) => line.startsWith(foreign))).toBe(false);
    expect(lines.find((line) => line.startsWith(own))).toContain(",+923001112233,");
  });

  it("exports reports and applications for the roles that may read them", async () => {
    const admin = await createActor("SUPER_ADMIN");
    const reports = await exportReports(contextFor(prisma, admin), { status: "APPROVED" });
    expect((reports.body as string).split("\r\n")[0]).toContain("Branch,Branch name,Week start");
    for (const line of dataLines(reports)) expect(line).toContain(",Approved,");

    const hr = await createActor("HR_LEAD");
    const applications = await exportApplications(contextFor(prisma, hr), { status: "NEW" });
    for (const line of dataLines(applications)) expect(line).toContain(",New,");
    expect(await lastExportAudit(hr, "application.export")).toMatchObject({
      after: { format: "csv", filters: { status: "NEW" } },
    });
  });

  it("refuses roles without the export permission (section 4)", async () => {
    const editor = await createActor("CONTENT_EDITOR");
    const hr = await createActor("HR_LEAD");
    const refusals: [Actor, (actor: Actor) => Promise<unknown>][] = [
      [editor, (actor) => exportCollections(contextFor(prisma, actor), {})],
      [hr, (actor) => exportCollections(contextFor(prisma, actor), {})],
      [finance, (actor) => exportMembers(contextFor(prisma, actor), {})],
      [lead, (actor) => exportApplications(contextFor(prisma, actor), {})],
      [editor, (actor) => exportReports(contextFor(prisma, actor), {})],
      [hr, (actor) => exportUnrouted(contextFor(prisma, actor))],
    ];
    for (const [actor, run] of refusals) {
      await expect(run(actor)).rejects.toMatchObject({ code: "FORBIDDEN" });
    }
    expect(await prisma.auditLog.count({ where: { actorId: editor.id } })).toBe(0);
  });
});
