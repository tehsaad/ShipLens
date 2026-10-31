import type { Metadata } from "next";
import { CalendarDays, HeartHandshake, MapPin, Sparkles, TrendingUp } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Markdown } from "@/components/markdown";
import { PageJsonLd } from "@/components/seo/page-json-ld";
import { DustField } from "@/components/site/river/dust-field";
import { FlowingRow } from "@/components/site/river/flowing-row";
import { RiverScene } from "@/components/site/river/river-scene";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { getPrisma } from "@/lib/db";
import { localeFrom } from "@/lib/locale-params";
import { eventTimeFormat, renderedAt } from "@/lib/public-format";
import { pageMetadata } from "@/lib/seo/metadata";
import { listPublicBranches } from "@/lib/services/branches";
import { listPublishedEntries } from "@/lib/services/content";
import { listPublishedEvents } from "@/lib/services/events";
import { getPublicImpact } from "@/lib/services/impact";

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
  const [branches, programs, announcements, events, impact] = await Promise.all([
    listPublicBranches(db),
    listPublishedEntries(db, "PROGRAM", locale),
    listPublishedEntries(db, "ANNOUNCEMENT", locale),
    listPublishedEvents(db),
    getPublicImpact(db),
  ]);
  const now = renderedAt();
  const upcoming = events.filter((event) => event.endsAt >= now).slice(0, 3);
  const when = eventTimeFormat(locale);

  const num = new Intl.NumberFormat(locale);

  const flowTitles = t.raw("flowTitles") as string[];
  const flowBodies = t.raw("flowBodies") as string[];
  const flowItems = flowTitles.map((title, i) => ({ title, body: flowBodies[i] ?? "" }));

  return (
    <div className="grid gap-20 lg:gap-28">
      {/* Hero ------------------------------------------------------------- */}
      <section className="relative isolate grid max-w-3xl gap-6 pt-6 pb-2">
        <div className="hero-aurora" aria-hidden="true" />
        <DustField />
        <p className="eyebrow relative">{t("eyebrow")}</p>
        <h1 className="relative text-4xl sm:text-5xl lg:text-6xl">{t("heroTitle")}</h1>
        <p className="text-muted-foreground relative max-w-2xl text-lg text-pretty">
          {t("heroText")}
        </p>
        <div className="relative flex flex-wrap items-center gap-3">
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

      {/* Announcements ---------------------------------------------------- */}
      {announcements.length > 0 ? (
        <section aria-labelledby="announcements" className="grid gap-4">
          <h2 id="announcements" className="text-2xl">
            {t("announcementsTitle")}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {announcements.slice(0, 2).map((entry) => (
              <article
                key={entry.slug}
                lang={entry.fallback ? "en" : locale}
                dir={entry.fallback ? "ltr" : undefined}
                className="card-surface p-5"
              >
                <h3 className="text-lg font-semibold">{entry.title}</h3>
                <div className="text-muted-foreground mt-1">
                  <Markdown>{entry.body}</Markdown>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {/* Flowing cards: ways we help ------------------------------------- */}
      <section aria-labelledby="flow-title" className="grid gap-5">
        <div className="grid max-w-2xl gap-2">
          <p className="eyebrow">{t("flowEyebrow")}</p>
          <h2 id="flow-title" className="text-2xl sm:text-3xl">
            {t("flowHeading")}
          </h2>
          <p className="text-muted-foreground text-pretty">{t("flowLede")}</p>
        </div>
        <FlowingRow items={flowItems} />
      </section>

      {/* The journey (river) --------------------------------------------- */}
      <section aria-labelledby="journey-title" className="grid gap-4">
        <div className="grid max-w-2xl gap-3">
          <p className="eyebrow">{t("journeyEyebrow")}</p>
          <h2 id="journey-title" className="text-3xl sm:text-4xl">
            {t("journeyTitle")}
          </h2>
          <p className="text-muted-foreground text-lg text-pretty">{t("journeyText")}</p>
        </div>

        <div id="home-journey" className="relative mt-6">
          <RiverScene targetId="home-journey" />

          <div className="relative z-10 flex flex-col gap-24 lg:gap-40">
            {/* Stop 1 — Programs */}
            <article
              data-river-card
              data-side="start"
              className="card-surface is-interactive w-full p-6 lg:w-[42%] lg:p-8 lg:me-auto"
            >
              <p className="eyebrow">
                <Sparkles className="h-4 w-4" aria-hidden="true" />
                {t("stopPrograms")}
              </p>
              <div className="mt-2 flex items-baseline justify-between gap-4">
                <h3 className="text-2xl">{t("programsTitle")}</h3>
                <Link href="/programs" className="text-primary text-sm whitespace-nowrap underline">
                  {t("programsMore")}
                </Link>
              </div>
              <ul className="mt-5 grid gap-4 sm:grid-cols-2">
                {programs.slice(0, 4).map((entry) => (
                  <li
                    key={entry.slug}
                    lang={entry.fallback ? "en" : locale}
                    dir={entry.fallback ? "ltr" : undefined}
                    className="border-border/70 rounded-xl border p-4"
                  >
                    <h4 className="font-semibold">{entry.title}</h4>
                    <div className="text-muted-foreground mt-1 text-sm">
                      <Markdown>{entry.body}</Markdown>
                    </div>
                  </li>
                ))}
              </ul>
            </article>

            {/* Stop 2 — Branches */}
            <article
              data-river-card
              data-side="end"
              className="card-surface is-interactive w-full p-6 lg:w-[42%] lg:p-8 lg:ms-auto"
            >
              <p className="eyebrow">
                <MapPin className="h-4 w-4" aria-hidden="true" />
                {t("stopBranches")}
              </p>
              <h3 className="mt-2 text-2xl">{t("branchesTitle")}</h3>
              <p className="text-muted-foreground mt-2 text-pretty">{t("branchesText")}</p>
              <div className="mt-5 flex items-end gap-6">
                <p>
                  <span className="stat-figure text-primary block text-5xl">
                    {num.format(impact.activeBranches)}
                  </span>
                  <span className="text-muted-foreground text-sm">{t("statActiveBranches")}</span>
                </p>
                <p>
                  <span className="stat-figure text-primary block text-5xl">
                    {num.format(impact.cities)}
                  </span>
                  <span className="text-muted-foreground text-sm">{t("statCities")}</span>
                </p>
              </div>
              <Link
                href="/branches"
                className="text-primary mt-5 inline-block text-sm font-medium underline"
              >
                {t("branchesMore")}
              </Link>
            </article>

            {/* Stop 3 — Impact */}
            <article
              data-river-card
              data-side="start"
              className="card-surface bg-teal-deep is-interactive w-full p-6 text-white lg:w-[48%] lg:p-9 lg:me-auto"
            >
              <p className="eyebrow" style={{ color: "var(--marigold)" }}>
                <TrendingUp className="h-4 w-4" aria-hidden="true" />
                {t("stopImpact")}
              </p>
              <h3 className="mt-2 text-2xl text-white">{t("impactTitle")}</h3>
              <p className="mt-2 text-pretty text-white/80">{t("impactText")}</p>
              <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-7 sm:grid-cols-3">
                <div>
                  <dt className="text-sm text-white/70">{t("statActiveBranches")}</dt>
                  <dd className="stat-figure text-marigold mt-1 text-4xl">
                    {num.format(impact.activeBranches)}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-white/70">{t("statMembers")}</dt>
                  <dd className="stat-figure text-marigold mt-1 text-4xl">
                    {num.format(impact.activeMembers)}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-white/70">{t("statCities")}</dt>
                  <dd className="stat-figure text-marigold mt-1 text-4xl">
                    {num.format(impact.cities)}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-white/70">{t("statCollections")}</dt>
                  <dd className="stat-figure text-marigold mt-1 text-4xl">
                    {num.format(impact.collections)}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-white/70">{t("statTeams")}</dt>
                  <dd className="stat-figure text-marigold mt-1 text-4xl">
                    {num.format(impact.teams)}
                  </dd>
                </div>
              </dl>
              <Link
                href="/results"
                className="text-marigold mt-6 inline-block text-sm font-semibold underline"
              >
                {t("resultsMore")}
              </Link>
            </article>

            {/* Stop 4 — Events */}
            <article
              data-river-card
              data-side="end"
              className="card-surface is-interactive w-full p-6 lg:w-[42%] lg:p-8 lg:ms-auto"
            >
              <p className="eyebrow">
                <CalendarDays className="h-4 w-4" aria-hidden="true" />
                {t("stopEvents")}
              </p>
              <div className="mt-2 flex items-baseline justify-between gap-4">
                <h3 className="text-2xl">{t("eventsTitle")}</h3>
                <Link href="/events" className="text-primary text-sm whitespace-nowrap underline">
                  {t("eventsMore")}
                </Link>
              </div>
              {upcoming.length === 0 ? (
                <p className="text-muted-foreground mt-4">{t("eventsEmpty")}</p>
              ) : (
                <ul className="mt-5 grid gap-3">
                  {upcoming.map((event) => {
                    const title =
                      locale === "ur" ? (event.titleUr ?? event.titleEn) : event.titleEn;
                    return (
                      <li key={event.id} className="border-border/70 rounded-xl border p-4">
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
            </article>

            {/* Stop 5 — Join */}
            <article
              data-river-card
              data-side="start"
              className="card-surface is-interactive w-full p-6 text-center lg:w-[42%] lg:p-10 lg:me-auto"
            >
              <p className="flex justify-center">
                <span className="eyebrow">
                  <HeartHandshake className="h-4 w-4" aria-hidden="true" />
                  {t("stopJoin")}
                </span>
              </p>
              <h3 className="mt-3 text-2xl sm:text-3xl">{t("joinTitle")}</h3>
              <p className="text-muted-foreground mx-auto mt-2 max-w-md text-pretty">
                {t("joinText")}
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                <Button asChild size="lg">
                  <Link href="/get-involved">{t("ctaApply")}</Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link href="/contact">{t("ctaContact")}</Link>
                </Button>
              </div>
            </article>
          </div>
        </div>
      </section>

      <PageJsonLd locale={locale} page="home" />
    </div>
  );
}
