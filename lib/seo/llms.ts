import { routing, type AppLocale } from "@/i18n/routing";
import { PUBLIC_PAGES, localizedPath } from "./pages";
import { absoluteUrl } from "./site";

type Messages = Record<string, Record<string, unknown>>;

const HEADINGS: Record<AppLocale, string> = { en: "## Pages (English)", ur: "## صفحات (اردو)" };

const text = (messages: Messages, namespace: string, key: string) =>
  String(messages[namespace]?.[key] ?? "");

/**
 * llms.txt (the llmstxt.org proposal): a plain Markdown summary of the public site with links to
 * its pages, built from the same page list and messages as the pages themselves. It lists
 * public URLs only. It is not a crawl rule (robots.txt), a page list (sitemap.xml) or access
 * control, and no AI system is known to be bound to read it.
 */
export function buildLlmsTxt(origin: URL, messages: Record<AppLocale, Messages>): string {
  const en = messages.en;
  const lines = [
    `# ${text(en, "site", "name")}`,
    "",
    `> ${text(en, "site", "tagline")}`,
    "",
    text(en, "home", "metaDescription"),
    "",
    "The site is published in English (/en) and Urdu (/ur, right to left). Each page below exists in both languages at the same path.",
  ];
  for (const locale of routing.locales) {
    const own = messages[locale];
    lines.push("", HEADINGS[locale], "");
    for (const page of PUBLIC_PAGES) {
      const title =
        page.key === "home" ? text(own, "nav", "home") : text(own, page.namespace, "metaTitle");
      const url = absoluteUrl(localizedPath(locale, page.path), origin);
      lines.push(`- [${title}](${url}): ${text(own, page.namespace, "metaDescription")}`);
    }
  }
  return lines.join("\n") + "\n";
}
