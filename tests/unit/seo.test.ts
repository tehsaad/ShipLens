import { afterEach, describe, expect, it, vi } from "vitest";
import { routing, type AppLocale } from "@/i18n/routing";
import { buildRobots, buildSitemap } from "@/lib/seo/crawl";
import { lastModifiedOf } from "@/lib/seo/last-modified";
import { buildLlmsTxt } from "@/lib/seo/llms";
import { buildPageMetadata, titleTemplate } from "@/lib/seo/metadata";
import { PUBLIC_PAGES, languageAlternates } from "@/lib/seo/pages";
import { PRODUCTION_ORIGIN, absoluteUrl, checkSiteOrigin, resolveSiteUrl } from "@/lib/seo/site";
import {
  branchListNode,
  eventListNode,
  graph,
  organizationNode,
  serializeJsonLd,
  webPageNode,
  websiteNode,
} from "@/lib/seo/structured-data";
import en from "@/messages/en.json";
import ur from "@/messages/ur.json";

const origin = new URL(PRODUCTION_ORIGIN);
const messages = { en, ur } as unknown as Record<AppLocale, Record<string, Record<string, string>>>;
const text = (locale: AppLocale, namespace: string, key: string) =>
  messages[locale][namespace]![key]!;

afterEach(() => vi.restoreAllMocks());

describe("canonical origin", () => {
  it("accepts a bare HTTPS origin on a public host", () => {
    expect(checkSiteOrigin("https://shiplens.onrender.com")).toEqual({
      origin: new URL("https://shiplens.onrender.com"),
    });
    expect(checkSiteOrigin("https://volunteers.example.org/")).toEqual({
      origin: new URL("https://volunteers.example.org"),
    });
  });

  it.each([
    ["http://shiplens.onrender.com", "not HTTPS"],
    ["https://localhost:3000", "a local address"],
    ["https://127.0.0.1", "a local address"],
    ["https://0.0.0.0:10000", "a local address"],
    ["https://[::1]", "a local address"],
    ["https://shiplens-pr-12.onrender.com", "a preview deployment"],
    ["https://shiplens.onrender.com/en", "not a bare origin"],
    ["https://shiplens.onrender.com/?utm_source=x", "not a bare origin"],
    ["https://user:secret@shiplens.onrender.com", "contains credentials"],
    ["shiplens.onrender.com", "not a URL"],
  ])("rejects %s (%s)", (value, problem) => {
    expect(checkSiteOrigin(value)).toEqual({ problem });
  });

  it("defaults to production and replaces an unusable value instead of publishing it", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(resolveSiteUrl(undefined).origin).toBe(PRODUCTION_ORIGIN);
    expect(resolveSiteUrl("http://localhost:3200").origin).toBe(PRODUCTION_ORIGIN);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("seo.site_url_rejected"));
    expect(resolveSiteUrl(" https://volunteers.example.org ").origin).toBe(
      "https://volunteers.example.org",
    );
  });

  it("builds absolute URLs on the canonical origin", () => {
    expect(absoluteUrl("/ur/programs", origin)).toBe("https://shiplens.onrender.com/ur/programs");
  });
});

describe("Get Involved answers", () => {
  // app/[locale]/get-involved/page.tsx answers questions with published Privacy and Terms
  // sentences, picked by position. Reordering those paragraphs must not swap the answers.
  const sentence = (locale: AppLocale, namespace: "privacy" | "terms", index: number) =>
    (messages[locale][namespace]!["body"] as unknown as string[])[index]!;

  it.each([
    ["en", "terms", 2, /unpaid/],
    ["en", "privacy", 1, /CNIC/],
    ["en", "privacy", 2, /HR team/],
    ["ur", "terms", 2, /بلا معاوضہ/],
    ["ur", "privacy", 1, /CNIC/],
    ["ur", "privacy", 2, /ایچ آر ٹیم/],
  ] as const)("%s %s paragraph %i is the one the answer quotes", (locale, ns, index, topic) => {
    expect(sentence(locale, ns, index)).toMatch(topic);
  });
});

describe("page titles and descriptions", () => {
  const documentTitle = (locale: AppLocale, page: (typeof PUBLIC_PAGES)[number]) =>
    page.key === "home"
      ? text(locale, page.namespace, "metaTitle")
      : titleTemplate(text(locale, "site", "name")).replace(
          "%s",
          text(locale, page.namespace, "metaTitle"),
        );

  for (const locale of routing.locales) {
    it(`are unique, present and of a useful length in ${locale}`, () => {
      const titles = PUBLIC_PAGES.map((page) => documentTitle(locale, page));
      const descriptions = PUBLIC_PAGES.map((page) =>
        text(locale, page.namespace, "metaDescription"),
      );
      expect(new Set(titles).size).toBe(PUBLIC_PAGES.length);
      expect(new Set(descriptions).size).toBe(PUBLIC_PAGES.length);
      for (const description of descriptions) {
        expect(description.length).toBeGreaterThanOrEqual(70);
        expect(description.length).toBeLessThanOrEqual(200);
      }
      // The site name is in every title, once.
      for (const title of titles) {
        expect(title.split(text(locale, "site", "name")).length - 1).toBe(1);
      }
    });
  }

  it("differ between the languages", () => {
    for (const page of PUBLIC_PAGES) {
      expect(text("ur", page.namespace, "metaDescription")).not.toBe(
        text("en", page.namespace, "metaDescription"),
      );
    }
  });
});

describe("page metadata", () => {
  const pageText = {
    title: "Programs",
    description: "What our branches do.",
    siteName: "ShipLens Volunteers",
    imageAlt: "Logo",
  };

  it("has a self-referencing canonical and reciprocal language alternates", () => {
    for (const locale of routing.locales) {
      const metadata = buildPageMetadata(locale, "/programs", pageText);
      expect(metadata.alternates?.canonical).toBe(`/${locale}/programs`);
      expect(metadata.alternates?.languages).toEqual({
        en: "/en/programs",
        ur: "/ur/programs",
        "x-default": "/en/programs",
      });
    }
  });

  it("has Open Graph and X cards for the page, in its language", () => {
    const metadata = buildPageMetadata("ur", "/programs", pageText);
    expect(metadata.title).toBe("Programs");
    expect(metadata.openGraph).toMatchObject({
      type: "website",
      url: "/ur/programs",
      locale: "ur_PK",
      alternateLocale: ["en_PK"],
      siteName: "ShipLens Volunteers",
      title: "Programs · ShipLens Volunteers",
      description: "What our branches do.",
      images: [{ url: "/og/ur.png", width: 1200, height: 630, alt: "Logo" }],
    });
    expect(metadata.twitter).toMatchObject({
      card: "summary_large_image",
      title: "Programs · ShipLens Volunteers",
      images: [{ url: "/og/ur.png", alt: "Logo" }],
    });
  });

  it("gives the home page its own full title", () => {
    const metadata = buildPageMetadata(
      "en",
      "",
      { ...pageText, title: "Home title" },
      {
        isHome: true,
      },
    );
    expect(metadata.title).toEqual({ absolute: "Home title" });
    expect(metadata.alternates?.canonical).toBe("/en");
    expect(metadata.openGraph?.title).toBe("Home title");
  });

  it("links every language of a page, with English as the default", () => {
    expect(languageAlternates("")).toEqual({ en: "/en", ur: "/ur", "x-default": "/en" });
  });
});

describe("sitemap.xml", () => {
  const dates = {
    about: new Date("2026-09-01T00:00:00Z"),
    programs: new Date("2026-09-10T00:00:00Z"),
    events: new Date("2026-10-01T00:00:00Z"),
    branches: new Date("2026-08-01T00:00:00Z"),
  };
  const sitemap = buildSitemap(origin, dates);
  const urls = sitemap.map((entry) => entry.url);

  it("lists every public page in both languages, once, on the canonical origin", () => {
    expect(urls).toHaveLength(PUBLIC_PAGES.length * routing.locales.length);
    expect(new Set(urls).size).toBe(urls.length);
    for (const url of urls) {
      expect(
        url.startsWith(`${PRODUCTION_ORIGIN}/en`) || url.startsWith(`${PRODUCTION_ORIGIN}/ur`),
      ).toBe(true);
      expect(url).not.toMatch(/[?#]/);
    }
    expect(urls).toContain(`${PRODUCTION_ORIGIN}/en`);
    expect(urls).toContain(`${PRODUCTION_ORIGIN}/ur/get-involved`);
  });

  it("never lists the staff area or API routes", () => {
    expect(urls.filter((url) => /\/(admin|api)\b/.test(url))).toEqual([]);
  });

  it("gives every URL its language alternates", () => {
    const entry = sitemap.find((item) => item.url === `${PRODUCTION_ORIGIN}/ur/events`)!;
    expect(entry.alternates?.languages).toEqual({
      en: `${PRODUCTION_ORIGIN}/en/events`,
      ur: `${PRODUCTION_ORIGIN}/ur/events`,
      "x-default": `${PRODUCTION_ORIGIN}/en/events`,
    });
  });

  it("dates pages from their published records and leaves the others undated", () => {
    const dateOf = (url: string) => sitemap.find((item) => item.url === url)?.lastModified;
    expect(dateOf(`${PRODUCTION_ORIGIN}/en/about`)).toEqual(dates.about);
    expect(dateOf(`${PRODUCTION_ORIGIN}/ur/events`)).toEqual(dates.events);
    // Home shows programs, announcements, events and branches: the latest of them.
    expect(dateOf(`${PRODUCTION_ORIGIN}/en`)).toEqual(dates.events);
    for (const path of ["/en/contact", "/ur/privacy", "/en/terms"]) {
      expect(dateOf(`${PRODUCTION_ORIGIN}${path}`)).toBeUndefined();
    }
  });

  it("still lists every page when no dates are known", () => {
    const undated = buildSitemap(origin, {});
    expect(undated).toHaveLength(sitemap.length);
    expect(undated.every((entry) => entry.lastModified === undefined)).toBe(true);
    expect(lastModifiedOf({ sources: ["about"] }, {})).toBeUndefined();
  });
});

describe("robots.txt", () => {
  const robots = buildRobots(origin);

  it("points at the canonical sitemap", () => {
    expect(robots.sitemap).toBe(`${PRODUCTION_ORIGIN}/sitemap.xml`);
  });

  it("keeps crawlers out of API routes only", () => {
    expect(robots.rules).toEqual([{ userAgent: "*", allow: "/", disallow: ["/api/"] }]);
  });
});

describe("structured data", () => {
  const site = {
    name: "ShipLens Volunteers",
    alternateName: "شپ لینز رضاکار",
    description: "Volunteer branches across Pakistan, one head office.",
  };

  it("escapes markup so content cannot end the script element", () => {
    const hostile = { name: '</script><script>alert("x")</script> & \u2028' };
    const json = serializeJsonLd(hostile);
    expect(json).not.toMatch(/[<>&\u2028]/);
    expect(JSON.parse(json)).toEqual(hostile);
  });

  it("describes the organisation and website with stable identifiers and no invented facts", () => {
    const organization = organizationNode(origin, site);
    expect(organization).toMatchObject({
      "@type": "Organization",
      "@id": `${PRODUCTION_ORIGIN}/#organization`,
      name: "ShipLens Volunteers",
      url: `${PRODUCTION_ORIGIN}/en`,
    });
    for (const key of [
      "address",
      "telephone",
      "sameAs",
      "aggregateRating",
      "review",
      "foundingDate",
      "award",
    ]) {
      expect(organization).not.toHaveProperty(key);
    }
    expect(websiteNode(origin, site)).toMatchObject({
      "@id": `${PRODUCTION_ORIGIN}/#website`,
      publisher: { "@id": `${PRODUCTION_ORIGIN}/#organization` },
    });
  });

  it("describes a page at its canonical URL, in its language", () => {
    const node = webPageNode(
      origin,
      "ur",
      { path: "/contact", schemaType: "ContactPage" },
      { name: "رابطہ", description: "پیغام بھیجیں" },
    );
    expect(node).toMatchObject({
      "@type": "ContactPage",
      "@id": `${PRODUCTION_ORIGIN}/ur/contact#webpage`,
      url: `${PRODUCTION_ORIGIN}/ur/contact`,
      inLanguage: "ur",
      isPartOf: { "@id": `${PRODUCTION_ORIGIN}/#website` },
    });
    expect(node).not.toHaveProperty("mainEntity");
  });

  it("lists branches with only their public details", () => {
    const list = branchListNode(origin, "list", [
      {
        code: "BR-KAR-001",
        name: "Karachi Central",
        city: "Karachi",
        contactEmail: "k@example.org",
      },
      { code: "BR-QUE-001", name: "Quetta", city: "Quetta", contactEmail: null },
    ]);
    const items = (list["itemListElement"] as { item: Record<string, unknown> }[]).map(
      (i) => i.item,
    );
    expect(items[0]).toMatchObject({
      "@id": `${PRODUCTION_ORIGIN}/#branch-BR-KAR-001`,
      identifier: "BR-KAR-001",
      email: "k@example.org",
      address: { "@type": "PostalAddress", addressLocality: "Karachi" },
      parentOrganization: { "@id": `${PRODUCTION_ORIGIN}/#organization` },
    });
    expect(items[1]).not.toHaveProperty("email");
    expect(Object.keys(items[0]!).sort()).toEqual(
      ["@id", "@type", "address", "email", "identifier", "name", "parentOrganization"].sort(),
    );
  });

  it("describes events with their published dates and place", () => {
    const list = eventListNode(origin, "en", "list", [
      {
        id: "e1",
        name: "Winter Clothing Collection",
        startsAt: new Date("2026-11-15T05:00:00Z"),
        endsAt: new Date("2026-11-15T11:00:00Z"),
        location: "Lahore Main branch office",
        city: "Lahore",
      },
      {
        id: "e2",
        name: "Head office open day",
        startsAt: new Date("2026-12-01T05:00:00Z"),
        endsAt: new Date("2026-12-01T09:00:00Z"),
        location: "Head office",
        city: null,
      },
    ]);
    const [first, second] = (list["itemListElement"] as { item: Record<string, unknown> }[]).map(
      (i) => i.item,
    );
    expect(first).toMatchObject({
      "@type": "Event",
      "@id": `${PRODUCTION_ORIGIN}/en/events#event-e1`,
      startDate: "2026-11-15T05:00:00.000Z",
      endDate: "2026-11-15T11:00:00.000Z",
      location: {
        "@type": "Place",
        name: "Lahore Main branch office",
        address: { "@type": "PostalAddress", addressLocality: "Lahore" },
      },
      organizer: { "@id": `${PRODUCTION_ORIGIN}/#organization` },
      url: `${PRODUCTION_ORIGIN}/en/events`,
    });
    expect(second!["location"]).toMatchObject({ address: "Head office" });
    expect(list["numberOfItems"]).toBe(2);
  });

  it("wraps nodes in one graph", () => {
    expect(graph([websiteNode(origin, site)])).toMatchObject({
      "@context": "https://schema.org",
      "@graph": [{ "@type": "WebSite" }],
    });
  });
});

describe("llms.txt", () => {
  const llms = buildLlmsTxt(origin, messages as never);

  it("summarises the site and links every public page in both languages", () => {
    expect(llms.startsWith("# ShipLens Volunteers\n")).toBe(true);
    for (const page of PUBLIC_PAGES) {
      for (const locale of routing.locales) {
        expect(llms).toContain(`(${PRODUCTION_ORIGIN}/${locale}${page.path}):`);
      }
    }
  });

  it("links public pages only", () => {
    const links = [...llms.matchAll(/\]\(([^)]+)\)/g)].map((match) => match[1]);
    expect(links).toHaveLength(PUBLIC_PAGES.length * routing.locales.length);
    expect(links.filter((link) => /\/(admin|api)\b/.test(link!))).toEqual([]);
  });
});
