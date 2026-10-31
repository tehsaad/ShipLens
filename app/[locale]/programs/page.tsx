import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { FallbackNotice } from "@/components/site/fallback-notice";
import { Markdown } from "@/components/markdown";
import { PageJsonLd } from "@/components/seo/page-json-ld";
import { RelatedLinks } from "@/components/site/related-links";
import { Link } from "@/i18n/navigation";
import { getPrisma } from "@/lib/db";
import { localeFrom } from "@/lib/locale-params";
import { eventTimeFormat, renderedAt } from "@/lib/public-format";
import { pageMetadata } from "@/lib/seo/metadata";
import { listPublishedEntries } from "@/lib/services/content";
import { listPublishedEvents } from "@/lib/services/events";

type Props = { params: Promise<{ locale: string }> };

export function generateMetadata({ params }: Props): Promise<Metadata> {
  return pageMetadata(params, "programs");
}

/** Section 7.1 Programs: published PROGRAM entries, with upcoming events folded in. */
export default async function ProgramsPage({ params }: Props) {
  const locale = await localeFrom(params);
  setRequestLocale(locale);
  const t = await getTranslations("programs");
  const db = getPrisma();
  const [programs, events] = await Promise.all([
    listPublishedEntries(db, "PROGRAM", locale),
    listPublishedEvents(db),
  ]);
  const now = renderedAt();
  const upcoming = events.filter((event) => event.endsAt >= now).slice(0, 4);
  const when = eventTimeFormat(locale);

  return (
    <div className="grid gap-8">
      <header className="grid gap-2">
        <h1 className="text-4xl font-semibold sm:text-5xl">{t("title")}</h1>
        <p className="text-muted-foreground text-lg">{t("intro")}</p>
      </header>
      {programs.length === 0 ? <p className="text-muted-foreground">{t("empty")}</p> : null}
      <div className="grid gap-6 md:grid-cols-2">
        {programs.map((entry) => (
          <article
            key={entry.slug}
            className="card-surface is-interactive grid content-start gap-3 p-6"
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
      <section aria-labelledby="upcoming-events" className="grid gap-4">
        <div className="flex items-baseline justify-between gap-4">
          <h2 id="upcoming-events" className="text-2xl font-semibold">
            {t("eventsTitle")}
          </h2>
          <Link href="/events" className="text-primary text-sm whitespace-nowrap underline">
            {t("eventsMore")}
          </Link>
        </div>
        {upcoming.length === 0 ? (
          <p className="text-muted-foreground">{t("eventsEmpty")}</p>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2">
            {upcoming.map((event) => {
              const fallback = locale === "ur" && !event.titleUr;
              return (
                <li key={event.id} className="card-surface is-interactive grid gap-1 p-5">
                  <h3
                    className="font-semibold"
                    lang={fallback ? "en" : undefined}
                    dir={fallback ? "ltr" : undefined}
                  >
                    {locale === "ur" ? (event.titleUr ?? event.titleEn) : event.titleEn}
                  </h3>
                  <p className="text-muted-foreground text-sm">
                    <time dateTime={event.startsAt.toISOString()}>
                      {when.format(event.startsAt)}
                    </time>{" "}
                    · {event.location}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </section>
      <RelatedLinks pages={["branches", "events", "getInvolved"]} />
      <PageJsonLd locale={locale} page="programs" />
    </div>
  );
}
