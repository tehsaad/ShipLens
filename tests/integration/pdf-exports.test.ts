import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "@/lib/generated/prisma/client";
import { parseDateOnly } from "@/lib/dates";
import type { Actor } from "@/lib/permissions";
import { exportMonthlySummary, exportReportPdf } from "@/lib/services/pdf-exports";
import { approveReport, getReport, openReport, submitReport } from "@/lib/services/reports";
import { pdfTextOf } from "../support/pdf-text";
import { contextFor, createActor } from "./helpers/context";
import { createTestPrisma } from "./helpers/prisma";
import { addDays, createBranch, createCollection, mondayWeeksAgo, pool } from "./helpers/sql";

let prisma: PrismaClient;
let finance: Actor;
let branchId: string;
let lead: Actor;
let otherLead: Actor;
let monday: string;
let approvedId: string;
let draftId: string;

const pdfText = (body: string | Uint8Array) => pdfTextOf(Buffer.from(body as Uint8Array));

beforeAll(async () => {
  prisma = createTestPrisma();
  finance = await createActor("FINANCE_REVIEWER");
  branchId = await createBranch();
  lead = await createActor("BRANCH_LEAD", branchId);
  otherLead = await createActor("BRANCH_LEAD", await createBranch());
  monday = await mondayWeeksAgo(2);
  await createCollection({
    branchId,
    enteredById: lead.id,
    amount: 1000,
    collectedOn: addDays(monday, 1),
  });
  const leadCtx = contextFor(prisma, lead);
  approvedId = (await openReport(leadCtx, parseDateOnly(monday))).id;
  await submitReport(leadCtx, approvedId, 1);
  await approveReport(contextFor(prisma, finance), approvedId, { version: 2, comment: "Fine." });
  draftId = (await openReport(leadCtx, parseDateOnly(await mondayWeeksAgo(3)))).id;
});

afterAll(async () => {
  await prisma.$disconnect();
  await pool.end();
});

describe("weekly report PDF (section 7.3)", () => {
  it("serves an approved report to its branch and to finance, and audits each download", async () => {
    for (const actor of [lead, finance]) {
      const file = await exportReportPdf(contextFor(prisma, actor), approvedId);
      expect(file.contentType).toBe("application/pdf");
      expect(file.filename).toMatch(/^weekly-report-BR-[A-Z]{3}-\d{3}-\d{4}-\d{2}-\d{2}\.pdf$/);
      const text = pdfText(file.body);
      expect(text).toContain(`(Monday) to ${addDays(monday, 6)} (Sunday)`);
      expect(text).toContain("1,000.00");
      expect(text).toContain("Submitted -> Approved");
      expect(text).toContain("Fine.");
      const audit = await prisma.auditLog.findFirstOrThrow({
        where: { actorId: actor.id, action: "report.export" },
      });
      expect(audit).toMatchObject({
        entityType: "WeeklyReport",
        entityId: approvedId,
        branchId,
        after: { format: "pdf", document: "weeklyReport" },
      });
    }
    // Downloads are audited, but the report's history lists transitions only.
    const history = (await getReport(contextFor(prisma, lead), approvedId)).history;
    expect(history.map((entry) => entry.action)).not.toContain("report.export");
  });

  it("refuses reports that are not approved, other branches and other roles", async () => {
    await expect(exportReportPdf(contextFor(prisma, lead), draftId)).rejects.toMatchObject({
      code: "RULE_VIOLATION",
    });
    await expect(exportReportPdf(contextFor(prisma, otherLead), approvedId)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    const hr = await createActor("HR_LEAD");
    await expect(exportReportPdf(contextFor(prisma, hr), approvedId)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});

describe("monthly branch summary PDF (section 7.3)", () => {
  it("summarises the branch's month and audits the download", async () => {
    const month = addDays(monday, 1).slice(0, 7);
    const file = await exportMonthlySummary(contextFor(prisma, lead), { branchId: null, month });
    expect(file.filename).toMatch(
      new RegExp(`^monthly-summary-BR-[A-Z]{3}-\\d{3}-${month}\\.pdf$`),
    );
    const text = pdfText(file.body);
    expect(text).toContain(`${month}-01 to ${month}-`);
    expect(text).toContain("1,000.00");
    expect(text).toContain("Not yet routed");
    expect(
      await prisma.auditLog.findFirstOrThrow({
        where: { actorId: lead.id, action: "report.export", entityType: "Branch" },
      }),
    ).toMatchObject({
      entityId: branchId,
      after: { format: "pdf", document: "monthlySummary", month },
    });
  });

  it("refuses another branch, a missing branch and months that have not started", async () => {
    const month = monday.slice(0, 7);
    await expect(
      exportMonthlySummary(contextFor(prisma, otherLead), { branchId, month }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      exportMonthlySummary(contextFor(prisma, finance), { branchId: null, month }),
    ).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(
      exportMonthlySummary(contextFor(prisma, finance), { branchId, month: "2999-01" }),
    ).rejects.toMatchObject({ code: "VALIDATION" });
  });
});
