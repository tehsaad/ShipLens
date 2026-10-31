"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Select } from "@/components/admin/form";
import { Label } from "@/components/ui/label";
import type { AppLocale } from "@/i18n/routing";

export type EventItem = {
  id: string;
  titleEn: string;
  titleUr: string | null;
  startsAt: string;
  endsAt: string;
  /** The start time, formatted on the server: browsers' date formatting differs from Node's. */
  when: string;
  location: string;
  branch: { code: string; city: string } | null;
};

type Show = "upcoming" | "past" | "all";

/**
 * Section 7.1 Events: upcoming and past published events, filtered in the browser. `now` is
 * the time the page was rendered, so the server and the browser agree on the split.
 */
export function EventList({ events, now }: { events: EventItem[]; now: number }) {
  const t = useTranslations("events");
  const locale = useLocale() as AppLocale;
  const [show, setShow] = useState<Show>("upcoming");
  const [branch, setBranch] = useState("");
  const branches = [...new Set(events.map((event) => event.branch?.code ?? ""))]
    .filter(Boolean)
    .sort();

  const shown = events
    .filter((event) =>
      show === "all"
        ? true
        : show === "upcoming"
          ? Date.parse(event.endsAt) >= now
          : Date.parse(event.endsAt) < now,
    )
    .filter((event) => !branch || (branch === "HQ" ? !event.branch : event.branch?.code === branch))
    .sort((a, b) =>
      show === "past"
        ? Date.parse(b.startsAt) - Date.parse(a.startsAt)
        : Date.parse(a.startsAt) - Date.parse(b.startsAt),
    );

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end gap-4">
        <fieldset className="grid gap-2">
          <legend className="mb-2 text-sm font-medium">{t("filterLabel")}</legend>
          <div className="flex gap-1 rounded-full border p-1">
            {(["upcoming", "past", "all"] as const).map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={show === value}
                onClick={() => setShow(value)}
                className="rounded-full px-3 py-1 text-sm aria-pressed:bg-primary aria-pressed:text-primary-foreground"
              >
                {t(value)}
              </button>
            ))}
          </div>
        </fieldset>
        <div className="grid gap-2">
          <Label htmlFor="branch">{t("branchFilter")}</Label>
          <Select
            id="branch"
            value={branch}
            onChange={(event) => setBranch(event.target.value)}
            className="w-48"
          >
            <option value="">{t("allBranches")}</option>
            <option value="HQ">{t("headOffice")}</option>
            {branches.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </Select>
        </div>
      </div>
      {shown.length === 0 ? <p className="text-muted-foreground">{t("empty")}</p> : null}
      <ul className="grid gap-4">
        {shown.map((event) => {
          const fallback = locale === "ur" && !event.titleUr;
          return (
            <li key={event.id} className="card-surface is-interactive grid gap-2 p-5">
              <h2
                className="text-lg font-semibold"
                lang={fallback ? "en" : undefined}
                dir={fallback ? "ltr" : undefined}
              >
                {locale === "ur" ? (event.titleUr ?? event.titleEn) : event.titleEn}
              </h2>
              {fallback ? (
                <p className="text-muted-foreground text-xs">{t("titleFallback")}</p>
              ) : null}
              <dl className="grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1 text-sm">
                <dt className="text-muted-foreground">{t("when")}</dt>
                <dd>
                  <time dateTime={event.startsAt}>{event.when}</time>
                </dd>
                <dt className="text-muted-foreground">{t("where")}</dt>
                <dd dir="auto">
                  {event.location}
                  {event.branch ? ` · ${event.branch.code}` : ""}
                </dd>
              </dl>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
