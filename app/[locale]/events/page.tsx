import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getPrisma } from "@/lib/db";
import { localeFrom } from "@/lib/locale-params";
import { pageMetadata } from "@/lib/page-meta";
import { renderedAt } from "@/lib/public-format";
import { listPublishedEvents } from "@/lib/services/events";
import { EventList } from "./event-list";

type Props = { params: Promise<{ locale: string }> };

export function generateMetadata({ params }: Props): Promise<Metadata> {
  return pageMetadata(params, "events", "/events");
}

export default async function EventsPage({ params }: Props) {
  const locale = await localeFrom(params);
  setRequestLocale(locale);
  const t = await getTranslations("events");
  const events = await listPublishedEvents(getPrisma());

  return (
    <div className="grid gap-8">
      <header className="grid gap-2">
        <h1 className="text-3xl font-semibold">{t("title")}</h1>
        <p className="text-muted-foreground text-lg">{t("intro")}</p>
      </header>
      <EventList
        now={renderedAt().getTime()}
        events={events.map((event) => ({
          ...event,
          startsAt: event.startsAt.toISOString(),
          endsAt: event.endsAt.toISOString(),
        }))}
      />
    </div>
  );
}
