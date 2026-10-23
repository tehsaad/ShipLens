import type { AppLocale } from "@/i18n/routing";

/** Event times on the public site, in Asia/Karachi and the visitor's language. */
export function eventTimeFormat(locale: AppLocale): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat(locale === "ur" ? "ur-PK" : "en-GB", {
    timeZone: "Asia/Karachi",
    dateStyle: "full",
    timeStyle: "short",
  });
}

/**
 * The moment a cached public page is rendered. Server components render once per cache
 * entry, so reading the clock here is deliberate: the page is regenerated at least every five
 * minutes, which bounds how stale the upcoming/past split can be.
 */
export function renderedAt(): Date {
  return new Date();
}
