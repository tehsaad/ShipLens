import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageJsonLd } from "@/components/seo/page-json-ld";
import type { AppLocale } from "@/i18n/routing";

/** Privacy and Terms (section 7.1): static text from messages/{en,ur}.json. */
export async function StaticPage({
  locale,
  namespace,
}: {
  locale: AppLocale;
  namespace: "privacy" | "terms";
}) {
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace });
  const paragraphs = t.raw("body") as string[];
  return (
    <article className="grid max-w-3xl gap-4">
      <h1 className="text-3xl font-semibold">{t("title")}</h1>
      {paragraphs.map((paragraph) => (
        <p key={paragraph} className="text-muted-foreground leading-relaxed">
          {paragraph}
        </p>
      ))}
      <PageJsonLd locale={locale} page={namespace} />
    </article>
  );
}
