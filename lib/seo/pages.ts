import { routing, type AppLocale } from "@/i18n/routing";

/**
 * The public pages (section 7.1, plus Privacy and Terms). Metadata, the sitemap, structured
 * data, llms.txt and the SEO tests all read this list, so a page added here is covered by each.
 *
 * - `path`: the same in both languages (the routing has no localised slugs).
 * - `namespace`: the messages namespace holding `metaTitle` and `metaDescription`.
 * - `schemaType`: the schema.org WebPage type that describes the page.
 * - `sources`: the published records the page shows, used for its last-modified date. A page
 *   built only from messages has none, and the sitemap then gives no date rather than a guess.
 */
export const PUBLIC_PAGES = [
  {
    key: "home",
    path: "",
    namespace: "home",
    schemaType: "WebPage",
    sources: ["programs", "announcements", "events", "branches"],
  },
  { key: "about", path: "/about", namespace: "about", schemaType: "AboutPage", sources: ["about"] },
  {
    key: "programs",
    path: "/programs",
    namespace: "programs",
    schemaType: "CollectionPage",
    sources: ["programs"],
  },
  {
    key: "branches",
    path: "/branches",
    namespace: "branches",
    schemaType: "CollectionPage",
    sources: ["branches"],
  },
  {
    key: "events",
    path: "/events",
    namespace: "events",
    schemaType: "CollectionPage",
    sources: ["events"],
  },
  {
    key: "getInvolved",
    path: "/get-involved",
    namespace: "getInvolved",
    schemaType: "WebPage",
    sources: ["branches"],
  },
  {
    key: "contact",
    path: "/contact",
    namespace: "contact",
    schemaType: "ContactPage",
    sources: [],
  },
  { key: "privacy", path: "/privacy", namespace: "privacy", schemaType: "WebPage", sources: [] },
  { key: "terms", path: "/terms", namespace: "terms", schemaType: "WebPage", sources: [] },
] as const satisfies readonly PublicPage[];

export type PublicPageKey = (typeof PUBLIC_PAGES)[number]["key"];

/** Published data that public pages are built from. */
export type ContentSource = "about" | "programs" | "announcements" | "events" | "branches";

export type PublicPage = {
  key: string;
  path: string;
  namespace: string;
  schemaType: "WebPage" | "AboutPage" | "CollectionPage" | "ContactPage";
  sources: readonly ContentSource[];
};

export function publicPage(key: PublicPageKey): (typeof PUBLIC_PAGES)[number] {
  return PUBLIC_PAGES.find((page) => page.key === key)!;
}

/** The path of a page in one language, for example "/ur/programs". */
export function localizedPath(locale: AppLocale, path: string): string {
  return `/${locale}${path}`;
}

/**
 * hreflang alternates of a page: every language, plus x-default. English is the default
 * language of the site (routing.defaultLocale), so x-default points at the English page.
 */
export function languageAlternates(path: string): Record<string, string> {
  const languages: Record<string, string> = {};
  for (const locale of routing.locales) languages[locale] = localizedPath(locale, path);
  languages["x-default"] = localizedPath(routing.defaultLocale, path);
  return languages;
}
