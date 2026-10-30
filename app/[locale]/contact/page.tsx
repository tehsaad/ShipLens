import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageJsonLd } from "@/components/seo/page-json-ld";
import { RelatedLinks } from "@/components/site/related-links";
import { localeFrom } from "@/lib/locale-params";
import { pageMetadata } from "@/lib/seo/metadata";
import { ContactForm } from "./contact-form";

type Props = { params: Promise<{ locale: string }> };

export function generateMetadata({ params }: Props): Promise<Metadata> {
  return pageMetadata(params, "contact");
}

export default async function ContactPage({ params }: Props) {
  const locale = await localeFrom(params);
  setRequestLocale(locale);
  const t = await getTranslations("contact");
  return (
    <div className="grid max-w-2xl gap-8">
      <header className="grid gap-2">
        <h1 className="text-4xl font-semibold sm:text-5xl">{t("title")}</h1>
        <p className="text-muted-foreground text-lg">{t("intro")}</p>
      </header>
      <section aria-labelledby="send" className="grid gap-4">
        <h2 id="send" className="text-xl font-semibold">
          {t("formTitle")}
        </h2>
        <ContactForm />
      </section>
      <RelatedLinks pages={["getInvolved", "branches"]} />
      <PageJsonLd locale={locale} page="contact" />
    </div>
  );
}
