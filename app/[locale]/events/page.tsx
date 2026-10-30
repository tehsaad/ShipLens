import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageJsonLd } from "@/components/seo/page-json-ld";
import { RelatedLinks } from "@/components/site/related-links";
import { getPrisma } from "@/lib/db";
import { localeFrom } from "@/lib/locale-params";
import { pageMetadata } from "@/lib/seo/metadata";
import { eventTimeFormat, renderedAt } from "@/lib/public-format";
import { SITE_URL } from "@/lib/seo/site";
import { eventListNode, pageItemId } from "@/lib/seo/structured-data";
import { listPublishedEvents } from "@/lib/services/events";
import { EventList } from "./event-list";

type Props = { params: Promise<{ locale: string }> };

export function generateMetadata({ params }: Props): Promise<Metadata> {
  return pageMetadata(params, "events");
}

export default async function EventsPage({ params }: Props) {
  const locale = await localeFrom(params);
  setRequestLocale(locale);
  const t = await getTranslations("events");
  const events = await listPublishedEvents(getPrisma());
  const when = eventTimeFormat(locale);
  const now = renderedAt();
  // The list opens on upcoming events, so those are the ones in the HTML and the ones
  // described in the structured data.
  const upcoming = events.filter((event) => event.endsAt >= now);

  return (
    <div className="grid gap-8">
      <header className="grid gap-2">
        <h1 className="text-4xl font-semibold sm:text-5xl">{t("title")}</h1>
        <p className="text-muted-foreground text-lg">{t("intro")}</p>
      </header>
      <EventList
        now={now.getTime()}
        events={events.map((event) => ({
          ...event,
          startsAt: event.startsAt.toISOString(),
          endsAt: event.endsAt.toISOString(),
          when: when.format(event.startsAt),
        }))}
      />
      <RelatedLinks pages={["branches", "getInvolved"]} />
      <PageJsonLd
        locale={locale}
        page="events"
        list={eventListNode(
          SITE_URL,
          locale,
          pageItemId(SITE_URL, locale, "/events", "upcoming"),
          upcoming.map((event) => ({
            id: event.id,
            name: locale === "ur" ? (event.titleUr ?? event.titleEn) : event.titleEn,
            startsAt: event.startsAt,
            endsAt: event.endsAt,
            location: event.location,
            city: event.branch?.city ?? null,
          })),
        )}
      />
    </div>
  );
}
