import type { AppLocale } from "@/i18n/routing";
import { localizedPath, type PublicPage } from "./pages";
import { absoluteUrl } from "./site";

/**
 * schema.org structured data (JSON-LD) for the public pages. Every value comes from what the
 * page itself shows: the site's messages and published, public records (active branches,
 * published events). Nothing here may come from members, applications, messages, finance or
 * staff records. There is deliberately no postal address, phone number, rating, review,
 * founding date, legal status or social profile: the organisation publishes none of those.
 */

export type JsonLdNode = { "@type": string; "@id"?: string; [key: string]: unknown };

/** Stable identifiers, so the nodes on different pages describe the same things. */
export const schemaIds = (origin: URL) => ({
  organization: absoluteUrl("/#organization", origin),
  website: absoluteUrl("/#website", origin),
  branch: (code: string) => absoluteUrl(`/#branch-${encodeURIComponent(code)}`, origin),
});

/** The @id of something a page lists, for example ".../en/branches#branches". */
export function pageItemId(origin: URL, locale: AppLocale, path: string, anchor: string): string {
  return `${absoluteUrl(localizedPath(locale, path), origin)}#${anchor}`;
}

export type SiteFacts = {
  /** English name and tagline, and the Urdu name. */
  name: string;
  alternateName: string;
  description: string;
};

export function organizationNode(origin: URL, site: SiteFacts): JsonLdNode {
  return {
    "@type": "Organization",
    "@id": schemaIds(origin).organization,
    name: site.name,
    alternateName: site.alternateName,
    description: site.description,
    url: absoluteUrl("/en", origin),
    logo: absoluteUrl("/icon.svg", origin),
    // The tagline: "Volunteer branches across Pakistan".
    areaServed: { "@type": "Country", name: "Pakistan" },
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "general enquiries",
      url: absoluteUrl("/en/contact", origin),
      availableLanguage: ["English", "Urdu"],
    },
  };
}

export function websiteNode(origin: URL, site: SiteFacts): JsonLdNode {
  return {
    "@type": "WebSite",
    "@id": schemaIds(origin).website,
    url: absoluteUrl("/en", origin),
    name: site.name,
    alternateName: site.alternateName,
    inLanguage: ["en", "ur"],
    publisher: { "@id": schemaIds(origin).organization },
  };
}

export function webPageNode(
  origin: URL,
  locale: AppLocale,
  page: Pick<PublicPage, "path" | "schemaType">,
  text: { name: string; description: string },
  mainEntity?: string,
): JsonLdNode {
  const url = absoluteUrl(localizedPath(locale, page.path), origin);
  return {
    "@type": page.schemaType,
    "@id": `${url}#webpage`,
    url,
    name: text.name,
    description: text.description,
    inLanguage: locale,
    isPartOf: { "@id": schemaIds(origin).website },
    publisher: { "@id": schemaIds(origin).organization },
    ...(mainEntity ? { mainEntity: { "@id": mainEntity } } : {}),
  };
}

/** A public branch, as listed on the Branches page (active branches only). */
export type BranchFacts = { code: string; name: string; city: string; contactEmail: string | null };

export function branchListNode(origin: URL, listId: string, branches: BranchFacts[]): JsonLdNode {
  return {
    "@type": "ItemList",
    "@id": listId,
    numberOfItems: branches.length,
    itemListElement: branches.map((branch, index) => ({
      "@type": "ListItem",
      position: index + 1,
      item: {
        "@type": "Organization",
        "@id": schemaIds(origin).branch(branch.code),
        name: branch.name,
        identifier: branch.code,
        address: { "@type": "PostalAddress", addressLocality: branch.city },
        ...(branch.contactEmail ? { email: branch.contactEmail } : {}),
        parentOrganization: { "@id": schemaIds(origin).organization },
      },
    })),
  };
}

/** A published event, as shown on the Events page. */
export type EventFacts = {
  id: string;
  name: string;
  startsAt: Date;
  endsAt: Date;
  location: string;
  city: string | null;
};

export function eventListNode(
  origin: URL,
  locale: AppLocale,
  listId: string,
  events: EventFacts[],
): JsonLdNode {
  const pageUrl = absoluteUrl(localizedPath(locale, "/events"), origin);
  return {
    "@type": "ItemList",
    "@id": listId,
    numberOfItems: events.length,
    itemListElement: events.map((event, index) => ({
      "@type": "ListItem",
      position: index + 1,
      item: {
        "@type": "Event",
        "@id": `${pageUrl}#event-${encodeURIComponent(event.id)}`,
        name: event.name,
        startDate: event.startsAt.toISOString(),
        endDate: event.endsAt.toISOString(),
        // Events take place at a named place, not online.
        eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
        location: {
          "@type": "Place",
          name: event.location,
          address: event.city
            ? { "@type": "PostalAddress", addressLocality: event.city }
            : event.location,
        },
        organizer: { "@id": schemaIds(origin).organization },
        url: pageUrl,
      },
    })),
  };
}

export function graph(nodes: JsonLdNode[]): { "@context": string; "@graph": JsonLdNode[] } {
  return { "@context": "https://schema.org", "@graph": nodes };
}

/**
 * JSON for a `<script type="application/ld+json">` element. Characters that could end the
 * script element or open an HTML comment are escaped, so a value like `</script>` in published
 * content cannot break out of it. The result still parses to the same JSON.
 */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}
