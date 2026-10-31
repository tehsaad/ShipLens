import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { ReactNode } from "react";
import { CookieConsent } from "@/components/site/cookie-consent";
import { SiteFooter } from "@/components/site/footer";
import { SiteHeader } from "@/components/site/header";
import { SmoothScroll } from "@/components/site/smooth-scroll";
import { THEME_SCRIPT } from "@/components/site/theme-script";
import { directionOf, routing } from "@/i18n/routing";
import { bricolage, instrumentSans, jetbrainsMono, nastaliq } from "@/lib/fonts";
import { titleTemplate } from "@/lib/seo/metadata";
import { SITE_URL } from "@/lib/seo/site";
import { cn } from "@/lib/utils";
import "../globals.css";

/**
 * Public pages are rendered on first request and then served from the cache, refreshed at
 * most every five minutes or when staff publish (section 9). Nothing is prerendered at build
 * time, because the image is built without a database.
 */
export const revalidate = 300;
export function generateStaticParams() {
  return [];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "site" });
  // Defaults for pages without their own metadata (the not-found page). Each public page sets
  // its description, canonical, alternates and social cards (lib/seo/metadata.ts); relative
  // URLs in them resolve against the canonical origin here.
  return {
    title: { template: titleTemplate(t("name")), default: t("name") },
    description: t("tagline"),
    metadataBase: SITE_URL,
  };
}

export default async function LocaleLayout({
  children,
  params,
}: Readonly<{ children: ReactNode; params: Promise<{ locale: string }> }>) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations("site");

  return (
    <html
      lang={locale}
      dir={directionOf(locale)}
      className={cn(
        "site font-sans",
        instrumentSans.variable,
        bricolage.variable,
        jetbrainsMono.variable,
        nastaliq.variable,
      )}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="flex min-h-svh flex-col">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:start-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-background focus:px-3 focus:py-2"
        >
          {t("skipToContent")}
        </a>
        <NextIntlClientProvider>
          <SmoothScroll />
          <SiteHeader />
          <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-10">
            {children}
          </main>
          <SiteFooter />
          <CookieConsent />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
