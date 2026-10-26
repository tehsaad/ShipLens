import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { FallbackNotice } from "@/components/site/fallback-notice";
import { Markdown } from "@/components/markdown";
import { PageJsonLd } from "@/components/seo/page-json-ld";
import { RelatedLinks } from "@/components/site/related-links";
import { getPrisma } from "@/lib/db";
import { localeFrom } from "@/lib/locale-params";
import { pageMetadata } from "@/lib/seo/metadata";
import { listPublishedEntries } from "@/lib/services/content";

type Props = { params: Promise<{ locale: string }> };

export function generateMetadata({ params }: Props): Promise<Metadata> {
  return pageMetadata(params, "programs");
}

/** Section 7.1 Programs: published PROGRAM entries. */
export default async function ProgramsPage({ params }: Props) {
  const locale = await localeFrom(params);
  setRequestLocale(locale);
  const t = await getTranslations("programs");
  const programs = await listPublishedEntries(getPrisma(), "PROGRAM", locale);

  return (
    <div className="grid gap-8">
      <header className="grid gap-2">
        <h1 className="text-3xl font-semibold">{t("title")}</h1>
        <p className="text-muted-foreground text-lg">{t("intro")}</p>
      </header>
      {programs.length === 0 ? <p className="text-muted-foreground">{t("empty")}</p> : null}
      <div className="grid gap-6 md:grid-cols-2">
        {programs.map((entry) => (
          <article
            key={entry.slug}
            className="bg-card grid content-start gap-3 rounded-xl border p-6"
          >
            {entry.fallback ? <FallbackNotice /> : null}
            <div
              lang={entry.fallback ? "en" : locale}
              dir={entry.fallback ? "ltr" : undefined}
              className="grid gap-3"
            >
              <h2 className="text-xl font-semibold">{entry.title}</h2>
              <Markdown>{entry.body}</Markdown>
            </div>
          </article>
        ))}
      </div>
      <RelatedLinks pages={["branches", "events", "getInvolved"]} />
      <PageJsonLd locale={locale} page="programs" />
    </div>
  );
}
