import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Markdown } from "@/components/markdown";
import { PageJsonLd } from "@/components/seo/page-json-ld";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { getPrisma } from "@/lib/db";
import { localeFrom } from "@/lib/locale-params";
import { pageMetadata } from "@/lib/seo/metadata";
import { eventTimeFormat, renderedAt } from "@/lib/public-format";
import { listPublicBranches } from "@/lib/services/branches";
import { listPublishedEntries } from "@/lib/services/content";
import { listPublishedEvents } from "@/lib/services/events";

type Props = { params: Promise<{ locale: string }> };

export function generateMetadata({ params }: Props): Promise<Metadata> {
  return pageMetadata(params, "home");
}

/** Section 7.1 Home: mission, call to action, programs preview, active branch count, latest events. */
export default async function HomePage({ params }: Props) {
  const locale = await localeFrom(params);
  setRequestLocale(locale);
  const t = await getTranslations("home");
  const db = getPrisma();
  const [branches, programs, announcements, events] = await Promise.all([
    listPublicBranches(db),
    listPublishedEntries(db, "PROGRAM", locale),
    listPublishedEntries(db, "ANNOUNCEMENT", locale),
    listPublishedEvents(db),
  ]);
  const now = renderedAt();
  const upcoming = events.filter((event) => event.endsAt >= now).slice(0, 3);
  const when = eventTimeFormat(locale);

  return (
    <div className="grid gap-16">
      <section className="grid max-w-3xl gap-6 pt-4">
        <h1 className="text-4xl font-semibold text-balance">{t("heroTitle")}</h1>
        <p className="text-muted-foreground text-lg">{t("heroText")}</p>
        <div className="flex flex-wrap items-center gap-3">
          <Button asChild size="lg">
            <Link href="/get-involved">{t("ctaApply")}</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/programs">{t("ctaPrograms")}</Link>
          </Button>
          <Link href="/branches" className="text-primary ms-2 font-medium underline">
            {t("statBranches", { count: branches.length })}
          </Link>
        </div>
      </section>

      {announcements.length > 0 ? (
        <section aria-labelledby="announcements" className="grid gap-4">
          <h2 id="announcements" className="text-2xl font-semibold">
            {t("announcementsTitle")}
          </h2>
          {announcements.slice(0, 2).map((entry) => (
            <article
              key={entry.slug}
              lang={entry.fallback ? "en" : locale}
              dir={entry.fallback ? "ltr" : undefined}
              className="bg-card rounded-xl border p-5"
            >
              <h3 className="text-lg font-semibold">{entry.title}</h3>
              <Markdown>{entry.body}</Markdown>
            </article>
          ))}
        </section>
      ) : null}

      <section aria-labelledby="programs" className="grid gap-4">
        <div className="flex items-baseline justify-between gap-4">
          <h2 id="programs" className="text-2xl font-semibold">
            {t("programsTitle")}
          </h2>
          <Link href="/programs" className="text-primary text-sm underline">
            {t("programsMore")}
          </Link>
        </div>
        <ul className="grid gap-4 sm:grid-cols-3">
          {programs.slice(0, 3).map((entry) => (
            <li
              key={entry.slug}
              lang={entry.fallback ? "en" : locale}
              dir={entry.fallback ? "ltr" : undefined}
              className="bg-card rounded-xl border p-5"
            >
              <h3 className="font-semibold">{entry.title}</h3>
              <div className="text-muted-foreground mt-2 text-sm">
                <Markdown>{entry.body}</Markdown>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="events" className="grid gap-4">
        <div className="flex items-baseline justify-between gap-4">
          <h2 id="events" className="text-2xl font-semibold">
            {t("eventsTitle")}
          </h2>
          <Link href="/events" className="text-primary text-sm underline">
            {t("eventsMore")}
          </Link>
        </div>
        {upcoming.length === 0 ? (
          <p className="text-muted-foreground">{t("eventsEmpty")}</p>
        ) : (
          <ul className="grid gap-3">
            {upcoming.map((event) => {
              const title = locale === "ur" ? (event.titleUr ?? event.titleEn) : event.titleEn;
              return (
                <li key={event.id} className="bg-card rounded-xl border p-4">
                  <p
                    className="font-semibold"
                    lang={locale === "ur" && !event.titleUr ? "en" : undefined}
                  >
                    {title}
                  </p>
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
      <PageJsonLd locale={locale} page="home" />
    </div>
  );
}
