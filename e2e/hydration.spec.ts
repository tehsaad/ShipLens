import { expect, test } from "@playwright/test";
import { THEME_SCRIPT } from "../components/site/theme-script";
import { LOCALES, PUBLIC_PAGES, flightPayload } from "./helpers";

/**
 * Public pages must hydrate cleanly. On a hydration mismatch React throws the server HTML away
 * and renders the page again in the browser: slower, and an error in every visitor's console.
 */

for (const locale of LOCALES) {
  for (const page of PUBLIC_PAGES) {
    const path = `/${locale}${page}`;

    test(`${path} hydrates without errors`, async ({ page: browserPage }) => {
      const errors: string[] = [];
      browserPage.on("pageerror", (error) => errors.push(error.message));
      browserPage.on("console", (message) => {
        if (message.type() === "error") errors.push(message.text());
      });
      await browserPage.goto(path);
      // Next.js adds its route announcer in an effect, once the page has hydrated.
      await expect(browserPage.locator("next-route-announcer")).toBeAttached();
      expect(errors).toEqual([]);
    });
  }
}

test("the root layout's <head> hydrates without waiting for client JavaScript", async ({
  request,
}) => {
  // Regression test. The theme script used to be imported from a "use client" module, so the
  // payload carried a reference to that module instead of the script itself. Hydrating <head>
  // then waited for the module's JavaScript, and when it arrived late React lost its place in
  // the document and failed with error 418 (seen on about one live page load in five).
  const payload = flightPayload(await (await request.get("/en")).text());
  expect(payload).toContain(`"__html":${JSON.stringify(THEME_SCRIPT)}`);
  expect(payload).not.toMatch(/"__html":"\$/);
});
