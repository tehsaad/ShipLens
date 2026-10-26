import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { routing, type AppLocale } from "@/i18n/routing";
import { localeFrom } from "@/lib/locale-params";
import { languageAlternates, localizedPath, publicPage, type PublicPageKey } from "./pages";

/** Open Graph locales: the page's language and the country the branches are in. */
export const OG_LOCALE: Record<AppLocale, string> = { en: "en_PK", ur: "ur_PK" };

/** The shared social preview image of each language (public/og/), 1200 by 630 pixels. */
export const SOCIAL_IMAGE = { width: 1200, height: 630, type: "image/png" } as const;
export const socialImagePath = (locale: AppLocale) => `/og/${locale}.png`;

/** Page titles are "<page> · <site>"; the home page uses its own full title instead. */
export const titleTemplate = (siteName: string) => `%s · ${siteName}`;

export type PageText = {
  title: string;
  description: string;
  siteName: string;
  imageAlt: string;
};

/**
 * Metadata of a public page: title, description, self-referencing canonical, hreflang
 * alternates, Open Graph and X (Twitter) cards. Next.js replaces rather than merges these
 * objects between the layout and the page, so each page gets the complete set from here.
 * URLs are relative and resolve against `metadataBase` (the canonical origin) in the layout.
 */
export function buildPageMetadata(
  locale: AppLocale,
  path: string,
  text: PageText,
  { isHome = false }: { isHome?: boolean } = {},
): Metadata {
  const canonical = localizedPath(locale, path);
  const fullTitle = isHome ? text.title : titleTemplate(text.siteName).replace("%s", text.title);
  const image = { url: socialImagePath(locale), alt: text.imageAlt, ...SOCIAL_IMAGE };
  return {
    title: isHome ? { absolute: text.title } : text.title,
    description: text.description,
    alternates: { canonical, languages: languageAlternates(path) },
    openGraph: {
      type: "website",
      siteName: text.siteName,
      locale: OG_LOCALE[locale],
      alternateLocale: routing.locales.filter((other) => other !== locale).map((l) => OG_LOCALE[l]),
      url: canonical,
      title: fullTitle,
      description: text.description,
      images: [image],
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description: text.description,
      images: [{ url: image.url, alt: image.alt }],
    },
  };
}

/** generateMetadata for a public page, with its text from the page's messages. */
export async function pageMetadata(
  params: Promise<{ locale: string }>,
  key: PublicPageKey,
): Promise<Metadata> {
  const locale = await localeFrom(params);
  const page = publicPage(key);
  const t = await getTranslations({ locale });
  return buildPageMetadata(
    locale,
    page.path,
    {
      title: t(`${page.namespace}.metaTitle`),
      description: t(`${page.namespace}.metaDescription`),
      siteName: t("site.name"),
      imageAlt: t("seo.imageAlt"),
    },
    { isHome: key === "home" },
  );
}
