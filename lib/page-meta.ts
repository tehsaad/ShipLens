import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { localeFrom } from "@/lib/locale-params";

/** Page title from messages, with links to the page in both languages. */
export async function pageMetadata(
  params: Promise<{ locale: string }>,
  namespace: string,
  path: string,
): Promise<Metadata> {
  const locale = await localeFrom(params);
  const t = await getTranslations({ locale, namespace });
  return {
    title: t("metaTitle"),
    alternates: {
      canonical: `/${locale}${path}`,
      languages: { en: `/en${path}`, ur: `/ur${path}` },
    },
  };
}
