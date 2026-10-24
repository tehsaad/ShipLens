import { expect, test, type Browser, type Page } from "@playwright/test";
import {
  expectPageStatus,
  expectRouteStatus,
  seedBranch,
  seedCollection,
  seedReport,
  storageStateFor,
  type Role,
} from "./helpers";

/**
 * Section 11: for each role, the pages and exports outside its permissions answer 403, and
 * another branch's records answer 404 (section 4). Each role also opens one page it may use,
 * so a lost session cannot pass for a refusal.
 */

async function signedIn(browser: Browser, role: Role): Promise<Page> {
  const context = await browser.newContext({ storageState: storageStateFor(role) });
  return context.newPage();
}

/** The status shown in a report page's header, for example "Submitted · version 2". */
function reportHeader(page: Page) {
  return page.getByText(/· version \d+$/);
}

test.describe("Content Editor", () => {
  test.use({ storageState: storageStateFor("CONTENT_EDITOR") });

  test("is refused finance, membership, users and the audit log", async ({ page }) => {
    await expectPageStatus(page, "/admin/content", 200);
    for (const path of [
      "/admin/collections",
      "/admin/reports",
      "/admin/members",
      "/admin/users",
      "/admin/audit",
    ]) {
      await expectPageStatus(page, path, 403);
    }
    await expectRouteStatus(page, "/admin/collections/export", 403);
    await expectRouteStatus(page, "/admin/reports/export", 403);
  });
});

test.describe("HR Lead", () => {
  test.use({ storageState: storageStateFor("HR_LEAD") });

  test("is refused finance, content and users", async ({ page }) => {
    await expectPageStatus(page, "/admin/applications", 200);
    for (const path of ["/admin/reports", "/admin/collections", "/admin/users", "/admin/content"]) {
      await expectPageStatus(page, path, 403);
    }
    await expectRouteStatus(page, "/admin/reports/export", 403);
    await expectRouteStatus(page, "/admin/export/unrouted", 403);
  });
});

test.describe("Finance Reviewer", () => {
  test.use({ storageState: storageStateFor("FINANCE_REVIEWER") });

  test("is refused applicants, members, content, users and the audit log", async ({ page }) => {
    await expectPageStatus(page, "/admin/reports", 200);
    for (const path of [
      "/admin/applications",
      "/admin/members",
      "/admin/content",
      "/admin/users",
      "/admin/audit",
    ]) {
      await expectPageStatus(page, path, 403);
    }
    await expectRouteStatus(page, "/admin/members/export", 403);
    await expectRouteStatus(page, "/admin/applications/export", 403);
  });
});

test.describe("Branch Lead", () => {
  test.use({ storageState: storageStateFor("BRANCH_LEAD") });

  const own = seedReport("BR-KAR-001", "2026-09-07");
  const foreignReport = seedReport("BR-LAH-001", "2026-09-07");
  const foreignBranch = seedBranch("BR-LAH-001");

  test("is refused other roles' areas", async ({ page }) => {
    await expectPageStatus(page, `/admin/reports/${own.id}`, 200);
    for (const path of ["/admin/users", "/admin/audit", "/admin/applications", "/admin/content"]) {
      await expectPageStatus(page, path, 403);
    }
    await expectRouteStatus(page, "/admin/applications/export", 403);
  });

  test("gets 404 for another branch's records", async ({ page }) => {
    await expectPageStatus(page, `/admin/reports/${foreignReport.id}`, 404);
    await expectPageStatus(page, `/admin/collections/${seedCollection("BR-LAH-001").id}`, 404);
    await expectPageStatus(page, `/admin/branches/${foreignBranch.id}`, 404);
    await expectRouteStatus(page, `/admin/reports/${foreignReport.id}/pdf`, 404);
  });

  test("exports only its own branch, whatever branch the link names", async ({ page }) => {
    const response = await page.request.get(
      `/admin/collections/export?branchId=${foreignBranch.id}`,
    );
    expect(response.status()).toBe(200);
    const rows = (await response.text()).trim().split("\r\n").slice(1);
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) expect(row.split(",")[2]).toBe("BR-KAR-001");
  });
});

test.describe("Super Admin", () => {
  // A submitted report that no other test changes.
  const report = seedReport("BR-ISL-001", "2026-09-28");
  const path = `/admin/reports/${report.id}`;

  /**
   * Submits the reviewer's Approve form, taken from the server-rendered page, in `page`. The
   * browser sends it as a plain form POST with the page's own session, as it would without
   * JavaScript, so nothing about the server action request is built by hand.
   */
  async function replayApprove(page: Page, formHtml: string): Promise<void> {
    await page.goto(path);
    await Promise.all([
      page.waitForEvent("load"),
      page.evaluate((html) => {
        const holder = document.createElement("div");
        holder.innerHTML = html;
        document.body.append(holder);
        holder.querySelector("form")!.submit();
      }, formHtml),
    ]);
  }

  test("cannot approve a report, even by replaying the reviewer's form", async ({ browser }) => {
    // The Finance Reviewer's page carries the Approve form.
    const reviewer = await signedIn(browser, "FINANCE_REVIEWER");
    const html = await (await reviewer.request.get(path)).text();
    const formHtml = await reviewer.evaluate((source) => {
      const doc = new DOMParser().parseFromString(source, "text/html");
      const form = [...doc.forms].find((candidate) =>
        [...candidate.querySelectorAll("button")].some((b) => b.textContent?.trim() === "Approve"),
      );
      return form?.outerHTML ?? null;
    }, html);
    expect(formHtml, "the reviewer's page has an Approve form").not.toBeNull();

    // Super Admin may read the report but sees no review controls.
    const admin = await signedIn(browser, "SUPER_ADMIN");
    await admin.goto(path);
    await expect(reportHeader(admin)).toContainText("Submitted");
    await expect(admin.getByRole("button", { name: "Approve" })).toHaveCount(0);
    await expect(admin.getByRole("button", { name: "Return to Branch Lead" })).toHaveCount(0);

    // Replayed with the Super Admin's session, the server refuses: nothing changes.
    await replayApprove(admin, formHtml!);
    await admin.goto(path);
    await expect(reportHeader(admin)).toContainText("Submitted · version 2");
    await admin.goto(`/admin/audit?entityId=${report.id}&action=report.approve`);
    await expect(admin.getByText("Nothing to show.")).toBeVisible();

    // The same replay with the reviewer's session approves, so the request itself was valid.
    await replayApprove(reviewer, formHtml!);
    await reviewer.goto(path);
    await expect(reportHeader(reviewer)).toContainText("Approved · version 3");
  });
});
