import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { LOCALES, PUBLIC_PAGES as PAGES } from "./helpers";

/**
 * Section 11: axe checks on the public pages, against WCAG 2.1 A and AA. Every page is checked
 * in both languages and in both themes, since colour contrast differs between them.
 */

const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

for (const theme of ["light", "dark"] as const) {
  test.describe(`${theme} theme`, () => {
    // The site follows the system theme until the visitor picks one.
    test.use({ colorScheme: theme });

    for (const locale of LOCALES) {
      for (const page of PAGES) {
        const path = `/${locale}${page}`;

        test(`${path} meets WCAG 2.1 AA`, async ({ page: browserPage }) => {
          await browserPage.goto(path);
          const html = browserPage.locator("html");
          // Make sure the theme under test is the one shown.
          if (theme === "dark") await expect(html).toHaveClass(/\bdark\b/);
          else await expect(html).not.toHaveClass(/\bdark\b/);

          const { violations } = await new AxeBuilder({ page: browserPage })
            .withTags(TAGS)
            .analyze();
          const found = violations.map(
            (violation) =>
              `${violation.id} (${violation.impact}): ${violation.help} at ` +
              violation.nodes.map((node) => node.target.join(" ")).join(", "),
          );
          expect(found).toEqual([]);
        });
      }
    }
  });
}
