import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getPrisma } from "@/lib/db";
import { localeFrom } from "@/lib/locale-params";
import { pageMetadata } from "@/lib/page-meta";
import { listApplicationBranches } from "@/lib/services/applications";
import { ApplicationForm } from "./application-form";

type Props = { params: Promise<{ locale: string }> };

export function generateMetadata({ params }: Props): Promise<Metadata> {
  return pageMetadata(params, "getInvolved", "/get-involved");
}

/** Section 7.1 Get Involved: how volunteering works, and the application form. */
export default async function GetInvolvedPage({ params }: Props) {
  const locale = await localeFrom(params);
  setRequestLocale(locale);
  const t = await getTranslations("getInvolved");
  const branches = await listApplicationBranches(getPrisma());
  const steps = [1, 2, 3] as const;

  return (
    <div className="grid gap-10">
      <header className="grid max-w-3xl gap-2">
        <h1 className="text-3xl font-semibold">{t("title")}</h1>
        <p className="text-muted-foreground text-lg">{t("intro")}</p>
      </header>
      <ol className="grid gap-4 sm:grid-cols-3">
        {steps.map((step) => (
          <li key={step} className="bg-card grid gap-1 rounded-xl border p-5">
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
    </div>
  );
}
