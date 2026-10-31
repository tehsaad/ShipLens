import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageJsonLd } from "@/components/seo/page-json-ld";
import { RelatedLinks } from "@/components/site/related-links";
import { Link } from "@/i18n/navigation";
import { getPrisma } from "@/lib/db";
import { localeFrom } from "@/lib/locale-params";
import { pageMetadata } from "@/lib/seo/metadata";
import { listApplicationBranches } from "@/lib/services/applications";
import { ApplicationForm } from "./application-form";

type Props = { params: Promise<{ locale: string }> };

export function generateMetadata({ params }: Props): Promise<Metadata> {
  return pageMetadata(params, "getInvolved");
}

/** Section 7.1 Get Involved: how volunteering works, and the application form. */
export default async function GetInvolvedPage({ params }: Props) {
  const locale = await localeFrom(params);
  setRequestLocale(locale);
  const t = await getTranslations("getInvolved");
  const all = await getTranslations();
  const branches = await listApplicationBranches(getPrisma());
  const steps = [1, 2, 3] as const;
  // Answers repeat what the site already states (the steps above, Privacy and Terms), so each
  // fact has one source and the same wording in both languages.
  const privacy = all.raw("privacy.body") as string[];
  const terms = all.raw("terms.body") as string[];
  const faq = [
    { question: t("faqReview"), answer: t("step2") },
    { question: t("faqAccepted"), answer: t("step3") },
    { question: t("faqPaid"), answer: terms[2] },
    { question: t("faqId"), answer: privacy[1] },
    { question: t("faqDetails"), answer: privacy[2] },
  ];

  return (
    <div className="grid gap-10">
      <header className="grid max-w-3xl gap-2">
        <h1 className="text-4xl font-semibold sm:text-5xl">{t("title")}</h1>
        <p className="text-muted-foreground text-lg">{t("intro")}</p>
      </header>
      <ol className="grid gap-4 sm:grid-cols-3">
        {steps.map((step) => (
          <li key={step} className="card-surface grid gap-1 p-5">
            <span className="text-primary text-sm font-semibold">{step}</span>
            <h2 className="font-semibold">{t(`step${step}Title`)}</h2>
            <p className="text-muted-foreground text-sm">{t(`step${step}`)}</p>
          </li>
        ))}
      </ol>
      <section aria-labelledby="apply" className="grid max-w-2xl gap-4">
        <h2 id="apply" className="text-2xl font-semibold">
          {t("formTitle")}
        </h2>
        {branches.length === 0 ? <p>{t("noBranches")}</p> : <ApplicationForm branches={branches} />}
      </section>
      <section aria-labelledby="faq" className="grid max-w-3xl gap-6">
        <h2 id="faq" className="text-2xl font-semibold">
          {t("faqTitle")}
        </h2>
        {faq.map(({ question, answer }) => (
          <div key={question} className="grid gap-1">
            <h3 className="font-semibold">{question}</h3>
            <p className="text-muted-foreground">{answer}</p>
          </div>
        ))}
        <div className="grid gap-1">
          <h3 className="font-semibold">{t("faqOther")}</h3>
          <p className="text-muted-foreground">
            {all("contact.intro")}{" "}
            <Link href="/contact" className="text-primary underline">
              {t("faqContactLink")}
            </Link>
          </p>
        </div>
      </section>
      <RelatedLinks pages={["branches", "programs", "events"]} />
      <PageJsonLd locale={locale} page="getInvolved" />
    </div>
  );
}
