import { getTranslations } from "next-intl/server";
import type { AppLocale } from "@/i18n/routing";
import { publicPage, type PublicPageKey } from "@/lib/seo/pages";
import { SITE_URL } from "@/lib/seo/site";
import {
  graph,
  organizationNode,
  serializeJsonLd,
  webPageNode,
  websiteNode,
  type JsonLdNode,
} from "@/lib/seo/structured-data";

/**
 * A public page's structured data: the organisation, the website, the page itself and, for
 * listing pages, what the page lists. Rendered on the server into the page's HTML; it is a
 * server component on purpose, so the JSON is inlined rather than loaded with client code.
 */
export async function PageJsonLd({
  locale,
  page: key,
  list,
}: {
  locale: AppLocale;
  page: PublicPageKey;
  list?: JsonLdNode;
}) {
  const page = publicPage(key);
  const [english, urdu, t] = await Promise.all([
    getTranslations({ locale: "en", namespace: "site" }),
    getTranslations({ locale: "ur", namespace: "site" }),
    getTranslations({ locale, namespace: page.namespace }),
  ]);
  const site = {
    name: english("name"),
    alternateName: urdu("name"),
    description: english("tagline"),
  };
  const nodes = [
    organizationNode(SITE_URL, site),
    websiteNode(SITE_URL, site),
    webPageNode(
      SITE_URL,
      locale,
      page,
      { name: t("metaTitle"), description: t("metaDescription") },
      list?.["@id"],
    ),
    ...(list ? [list] : []),
  ];
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(graph(nodes)) }}
    />
  );
}
