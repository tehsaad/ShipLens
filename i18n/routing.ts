import { defineRouting } from "next-intl/routing";

/** Section 7.4: English and Urdu, with the locale always in the URL (/en/..., /ur/...). */
export const routing = defineRouting({
  locales: ["en", "ur"],
  defaultLocale: "en",
  localePrefix: "always",
});

export type AppLocale = (typeof routing.locales)[number];

/** Urdu is written right to left. */
export function directionOf(locale: AppLocale): "ltr" | "rtl" {
  return locale === "ur" ? "rtl" : "ltr";
}
