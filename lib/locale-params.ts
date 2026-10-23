import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { routing, type AppLocale } from "@/i18n/routing";

/** The page's locale from its route params; an unknown locale is a 404. */
export async function localeFrom(params: Promise<{ locale: string }>): Promise<AppLocale> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  return locale;
}
