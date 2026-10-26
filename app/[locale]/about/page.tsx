import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { FallbackNotice } from "@/components/site/fallback-notice";
import { Markdown } from "@/components/markdown";
import { PageJsonLd } from "@/components/seo/page-json-ld";
import { RelatedLinks } from "@/components/site/related-links";
import { getPrisma } from "@/lib/db";
import { localeFrom } from "@/lib/locale-params";
import { pageMetadata } from "@/lib/seo/metadata";
import { getPublishedEntry } from "@/lib/services/content";

type Props = { params: Promise<{ locale: string }> };

export function generateMetadata({ params }: Props): Promise<Metadata> {
  return pageMetadata(params, "about");
}

/** Section 7.1 About: mission, vision and history, edited in the content manager (PAGE "about"). */
export default async function AboutPage({ params }: Props) {
  const locale = await localeFrom(params);
  setRequestLocale(locale);
  const t = await getTranslations("about");
  const entry = await getPublishedEntry(getPrisma(), "PAGE", "about", locale);

  return (
    <div className="grid max-w-3xl gap-10">
      {entry ? (
        <article className="grid gap-6">
          {entry.fallback ? <FallbackNotice /> : null}
          <div
            lang={entry.fallback ? "en" : locale}
            dir={entry.fallback ? "ltr" : undefined}
            className="grid gap-6"
          >
            <h1 className="text-3xl font-semibold">{entry.title}</h1>
            <Markdown>{entry.body}</Markdown>
          </div>
        </article>
      ) : (
        <article className="grid gap-4">
          <h1 className="text-3xl font-semibold">{t("missingTitle")}</h1>
          <p className="text-muted-foreground">{t("missing")}</p>
        </article>
      )}
      <RelatedLinks pages={["programs", "branches", "getInvolved"]} />
      <PageJsonLd locale={locale} page="about" />
    </div>
  );
}
