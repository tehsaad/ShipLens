import type { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";
import { lastModifiedOf, type SourceDates } from "./last-modified";
import { PUBLIC_PAGES, languageAlternates, localizedPath } from "./pages";
import { absoluteUrl } from "./site";

/**
 * sitemap.xml: every public page in both languages, with its hreflang alternates. Only
 * canonical URLs of pages that exist for everyone; the staff area, API routes and drafts never
 * appear. lastModified is included only when it is known from published records.
 */
export function buildSitemap(origin: URL, dates: SourceDates): MetadataRoute.Sitemap {
  return PUBLIC_PAGES.flatMap((page) => {
    const lastModified = lastModifiedOf(page, dates);
    const languages = Object.fromEntries(
      Object.entries(languageAlternates(page.path)).map(([language, path]) => [
        language,
        absoluteUrl(path, origin),
      ]),
    );
    return routing.locales.map((locale) => ({
      url: absoluteUrl(localizedPath(locale, page.path), origin),
      ...(lastModified ? { lastModified } : {}),
      alternates: { languages },
    }));
  });
}

/**
 * robots.txt. API routes return data, not pages, so crawlers are kept out of them. The staff
 * area stays crawlable on purpose: every admin page (including the login page linked from the
 * footer) answers `noindex`, and a crawler only sees that if robots.txt lets it fetch the page.
 * A disallowed URL can still be indexed from links alone. robots.txt is not access control:
 * the staff area requires a session regardless.
 */
export function buildRobots(origin: URL): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/"] }],
    sitemap: absoluteUrl("/sitemap.xml", origin),
  };
}
