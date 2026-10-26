import { expect, test } from "@playwright/test";
import { PRODUCTION_ORIGIN } from "../lib/seo/site";
import { applications, contactMessage, members, users, type SeedMember } from "../prisma/seed/data";
import { auditSite } from "../scripts/seo-audit";
import { DEMO_PASSWORD, LOCALES, PUBLIC_PAGES } from "./helpers";

/**
 * Search and sharing: what crawlers fetch from the production build. Read-only, so it can run
 * in any order with the other specs. Canonical URLs use the production origin (SITE_URL is not
 * set in E2E), and requests go to the local server.
 */

test("the public site passes the SEO audit", async ({ baseURL }) => {
  const result = await auditSite({ base: baseURL!, canonicalOrigin: PRODUCTION_ORIGIN });
  expect(result.failures).toEqual([]);
  expect(result.checked.pages).toBe(PUBLIC_PAGES.length * LOCALES.length);
});

type JsonLdItem = { item: Record<string, unknown> };

async function jsonLdList(page: import("@playwright/test").Page, type: string) {
  const text = await page.locator('script[type="application/ld+json"]').textContent();
  const graph = (JSON.parse(text!) as { "@graph": Record<string, unknown>[] })["@graph"];
  const list = graph.find((node) => node["@type"] === "ItemList");
  return ((list?.["itemListElement"] ?? []) as JsonLdItem[])
    .map(({ item }) => item)
    .filter((item) => item["@type"] === type);
}

for (const locale of LOCALES) {
  test(`/${locale}/events describes exactly the events it shows`, async ({ page }) => {
    await page.goto(`/${locale}/events`);
    const shown = await page.locator("main li:has(time)").evaluateAll((items) =>
      items.map((item) => ({
        name: item.querySelector("h2")?.textContent ?? "",
        startDate: item.querySelector("time")?.getAttribute("datetime") ?? "",
      })),
    );
    const described = (await jsonLdList(page, "Event")).map((event) => ({
      name: event["name"],
      startDate: event["startDate"],
    }));
    // Upcoming events only, as the list opens on those; the list is empty once the seeded
    // events are past, and the structured data must then be empty too.
    expect(described).toEqual(shown);
  });

  test(`/${locale}/branches describes exactly the branches it shows`, async ({ page }) => {
    await page.goto(`/${locale}/branches`);
    const shown = await page.locator("main li dd.font-mono").allTextContents();
    const described = (await jsonLdList(page, "Organization")).map((b) => b["identifier"]);
    expect(shown.length).toBeGreaterThan(0);
    expect(described).toEqual(shown.map((code) => code.trim()));
  });
}

test("public pages and crawler files reveal no private records", async ({ request }) => {
  const memberText = (member: SeedMember) => [member.fullName, member.email, member.phone];
  const secrets = [
    contactMessage.name,
    contactMessage.email,
    contactMessage.message,
    DEMO_PASSWORD,
    ...users.flatMap((user) => [user.email, user.name]),
    ...members.flatMap(memberText),
    ...applications.flatMap((application) => [application.email, application.phone]),
  ];
  const paths = [
    ...LOCALES.flatMap((locale) => PUBLIC_PAGES.map((page) => `/${locale}${page}`)),
    "/robots.txt",
    "/sitemap.xml",
    "/llms.txt",
  ];
  for (const path of paths) {
    const body = await (await request.get(path)).text();
    const leaked = secrets.filter((secret) => body.includes(secret));
    expect(leaked, path).toEqual([]);
  }
});
