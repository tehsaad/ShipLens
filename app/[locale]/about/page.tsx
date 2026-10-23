import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { FallbackNotice } from "@/components/site/fallback-notice";
import { Markdown } from "@/components/markdown";
import { getPrisma } from "@/lib/db";
import { localeFrom } from "@/lib/locale-params";
import { pageMetadata } from "@/lib/page-meta";
import { getPublishedEntry } from "@/lib/services/content";

type Props = { params: Promise<{ locale: string }> };

export function generateMetadata({ params }: Props): Promise<Metadata> {
  return pageMetadata(params, "about", "/about");
}

/** Section 7.1 About: mission, vision and history, edited in the content manager (PAGE "about"). */
export default async function AboutPage({ params }: Props) {
  const locale = await localeFrom(params);
  setRequestLocale(locale);
  const t = await getTranslations("about");
  const entry = await getPublishedEntry(getPrisma(), "PAGE", "about", locale);

  if (!entry) {
    return (
      <article className="grid max-w-3xl gap-4">
        <h1 className="text-3xl font-semibold">{t("missingTitle")}</h1>
        <p className="text-muted-foreground">{t("missing")}</p>
      </article>
    );
  }
  return (
    <article className="grid max-w-3xl gap-6">
      {entry.fallback ? <FallbackNotice /> : null}
      <div
        lang={entry.fallback ? "en" : locale}
        dir={entry.fallback ? "ltr" : undefined}
        className="grid gap-6"
      >
        <h1 className="text-3xl font-semibold">{entry.title}</h1>
        <Markdown>{entry.body}</Markdown>
      </div>
    </article>
  );
}
