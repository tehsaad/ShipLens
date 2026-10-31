import type { Metadata } from "next";
import Image from "next/image";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Markdown } from "@/components/markdown";
import { PageJsonLd } from "@/components/seo/page-json-ld";
import { FallbackNotice } from "@/components/site/fallback-notice";
import { RelatedLinks } from "@/components/site/related-links";
import { getPrisma } from "@/lib/db";
import { localeFrom } from "@/lib/locale-params";
import { pageMetadata } from "@/lib/seo/metadata";
import { listPublishedResults } from "@/lib/services/results";

type Props = { params: Promise<{ locale: string }> };

export function generateMetadata({ params }: Props): Promise<Metadata> {
  return pageMetadata(params, "results");
}

/** Section 7.1 (extension): published results and achievements, shown to visitors and supporters. */
export default async function ResultsPage({ params }: Props) {
  const locale = await localeFrom(params);
  setRequestLocale(locale);
  const t = await getTranslations("results");
  const results = await listPublishedResults(getPrisma());
  const dateFormat = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

  return (
    <div className="grid gap-8">
      <header className="grid gap-2">
        <h1 className="text-4xl font-semibold sm:text-5xl">{t("title")}</h1>
        <p className="text-muted-foreground max-w-2xl text-lg text-pretty">{t("intro")}</p>
      </header>

      {results.length === 0 ? <p className="text-muted-foreground">{t("empty")}</p> : null}

      <div className="grid gap-6 md:grid-cols-2">
        {results.map((result) => {
          const titleFallback = locale === "ur" && !result.titleUr;
          const title = locale === "ur" ? (result.titleUr ?? result.titleEn) : result.titleEn;
          const body = locale === "ur" ? (result.bodyUr ?? result.bodyEn) : result.bodyEn;
          const alt =
            (locale === "ur" ? (result.imageAltUr ?? result.imageAltEn) : result.imageAltEn) ??
            result.titleEn;
          const where = result.branch ? result.branch.city : t("networkLabel");
          return (
            <article key={result.id} className="card-surface is-interactive grid content-start">
              {result.imageUpdatedAt ? (
                <Image
                  src={`/api/media/results/${result.id}?v=${result.imageUpdatedAt.getTime()}`}
                  alt={alt}
                  width={800}
                  height={450}
                  unoptimized
                  sizes="(min-width: 768px) 50vw, 100vw"
                  className="h-52 w-full rounded-t-[inherit] object-cover"
                />
              ) : null}
              <div className="grid gap-3 p-6">
                <p className="eyebrow">
                  {where}
                  {result.happenedOn ? ` · ${dateFormat.format(result.happenedOn)}` : ""}
                </p>
                {titleFallback ? <FallbackNotice /> : null}
                <div
                  lang={titleFallback ? "en" : locale}
                  dir={titleFallback ? "ltr" : undefined}
                  className="grid gap-2"
                >
                  <h2 className="text-xl font-semibold">{title}</h2>
                  <div className="text-muted-foreground">
                    <Markdown>{body}</Markdown>
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      <RelatedLinks pages={["programs", "branches", "getInvolved"]} />
      <PageJsonLd locale={locale} page="results" />
    </div>
  );
}
