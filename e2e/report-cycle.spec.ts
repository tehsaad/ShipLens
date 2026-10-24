import { expect, test, type Browser, type Page } from "@playwright/test";
import { storageStateFor, type Role } from "./helpers";

/**
 * Section 11: the full weekly report cycle through the admin screens (section 6.4). Draft,
 * submit, return with a comment, resubmit and approve; then the report and its week's
 * collections are locked, and Super Admin sees every step in the audit log.
 *
 * The week of 2026-09-21 has no report in the sample data, and it is complete whatever
 * today's date, so it can be submitted. Each run starts from a freshly seeded database.
 */

const WEEK_START = "2026-09-21";
const IN_WEEK = "2026-09-23";

async function signedIn(browser: Browser, role: Role): Promise<Page> {
  const context = await browser.newContext({ storageState: storageStateFor(role) });
  return context.newPage();
}

/** The report page header line, for example "… · Submitted · version 3". */
function reportHeader(page: Page) {
  return page.getByText(/· version \d+$/);
}

test.describe.serial("Weekly report cycle", () => {
  let reportPath = "";
  let collectionPath = "";

  test("Branch Lead records a collection and drafts the week's report", async ({ browser }) => {
    const lead = await signedIn(browser, "BRANCH_LEAD");

    await lead.goto("/admin/collections");
    await lead.getByLabel("Amount (PKR)").fill("750");
    await lead.getByLabel("Collected on").fill(IN_WEEK);
    await lead.getByLabel("Description (optional)").fill("Receipt book 12, Friday prayers");
    await lead.getByRole("button", { name: "Record collection" }).click();
    await lead.waitForURL(/\/admin\/collections\/[0-9a-f-]{36}$/);
    collectionPath = new URL(lead.url()).pathname;

    await lead.goto("/admin/reports");
    await lead.getByLabel("Week containing").fill(IN_WEEK);
    await lead.getByRole("button", { name: "Open week" }).click();
    await lead.waitForURL(/\/admin\/reports\/[0-9a-f-]{36}$/);
    reportPath = new URL(lead.url()).pathname;
    await expect(
      lead.getByRole("heading", { name: `BR-KAR-001 · week of ${WEEK_START}` }),
    ).toBeVisible();
    await expect(reportHeader(lead)).toContainText("Draft · version 1");
    await expect(lead.getByRole("cell", { name: "Receipt book 12, Friday prayers" })).toBeVisible();

    await lead.getByLabel("Notes for the reviewer (optional)").fill("Receipts attached.");
    await lead.getByRole("button", { name: "Save notes" }).click();
    await expect(lead.getByText("Notes saved.")).toBeVisible();
    await expect(reportHeader(lead)).toContainText("Draft · version 2");

    await lead.getByRole("button", { name: "Submit report" }).click();
    await expect(reportHeader(lead)).toContainText("Submitted · version 3");
    await expect(lead.getByText("Totals (frozen at submission)")).toBeVisible();
  });

  test("Finance Reviewer returns it with a comment", async ({ browser }) => {
    const reviewer = await signedIn(browser, "FINANCE_REVIEWER");
    await reviewer.goto(reportPath);
    // A return needs a comment.
    await reviewer.getByRole("button", { name: "Return to Branch Lead" }).click();
    await expect(reviewer.getByText("Explain what the Branch Lead needs to fix.")).toBeVisible();

    await reviewer
      .getByLabel("What needs fixing (required)")
      .fill("Please add the receipt number for the Friday entry.");
    await reviewer.getByRole("button", { name: "Return to Branch Lead" }).click();
    await expect(reportHeader(reviewer)).toContainText("Returned · version 4");
  });

  test("Branch Lead sees the comment and resubmits", async ({ browser }) => {
    const lead = await signedIn(browser, "BRANCH_LEAD");
    await lead.goto(reportPath);
    await expect(
      lead.getByText("Please add the receipt number for the Friday entry.").first(),
    ).toBeVisible();
    await lead.getByRole("button", { name: "Resubmit report" }).click();
    await expect(reportHeader(lead)).toContainText("Submitted · version 5");
  });

  test("Finance Reviewer approves it", async ({ browser }) => {
    const reviewer = await signedIn(browser, "FINANCE_REVIEWER");
    await reviewer.goto(reportPath);
    await reviewer.getByRole("button", { name: "Approve" }).click();
    await expect(reportHeader(reviewer)).toContainText("Approved · version 6");
    await expect(reviewer.getByRole("button", { name: "Approve" })).toHaveCount(0);
  });

  test("the approved report and its week's collections are locked", async ({ browser }) => {
    const lead = await signedIn(browser, "BRANCH_LEAD");
    await lead.goto(reportPath);
    await expect(reportHeader(lead)).toContainText("Approved · version 6");
    for (const name of ["Save notes", "Submit report", "Resubmit report"]) {
      await expect(lead.getByRole("button", { name })).toHaveCount(0);
    }
    const pdf = await lead.request.get(`${reportPath}/pdf`);
    expect(pdf.status()).toBe(200);
    expect(pdf.headers()["content-type"]).toBe("application/pdf");

    // The week's existing entry can no longer be edited.
    await lead.goto(collectionPath);
    await expect(
      lead.getByText(
        "The weekly report for this week is approved, so its collections are read-only.",
      ),
    ).toBeVisible();
    await expect(lead.getByRole("button", { name: "Save changes" })).toHaveCount(0);

    // A new entry dated in the approved week is refused.
    await lead.goto("/admin/collections");
    await lead.getByLabel("Amount (PKR)").fill("100");
    await lead.getByLabel("Collected on").fill(IN_WEEK);
    await lead.getByRole("button", { name: "Record collection" }).click();
    await expect(lead.getByText(/^The weekly report for that date is approved\./)).toBeVisible();
    expect(new URL(lead.url()).pathname).toBe("/admin/collections");
  });

  test("Super Admin sees every step in the audit log", async ({ browser }) => {
    const admin = await signedIn(browser, "SUPER_ADMIN");
    const reportId = reportPath.split("/").pop()!;
    await admin.goto(`/admin/audit?entityId=${reportId}`);
    const rows = admin.locator("tbody tr");
    // Newest first. The Branch Lead's PDF download is audited against the report too.
    const steps: [action: string, actor: string][] = [
      ["report.export", "Farah Khan"],
      ["report.approve", "Bilal Ahmed"],
      ["report.resubmit", "Farah Khan"],
      ["report.return", "Bilal Ahmed"],
      ["report.submit", "Farah Khan"],
      ["report.updateNotes", "Farah Khan"],
      ["report.create", "Farah Khan"],
    ];
    await expect(rows).toHaveCount(steps.length);
    for (const [index, [action, actor]] of steps.entries()) {
      const cells = rows.nth(index).locator("td");
      await expect(cells.nth(1)).toContainText(actor);
      await expect(cells.nth(2)).toHaveText(action);
    }
  });
});
