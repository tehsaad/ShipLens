import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { StaticPage } from "@/components/site/static-page";
import { localeFrom } from "@/lib/locale-params";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const t = await getTranslations({ locale: await localeFrom(params), namespace: "privacy" });
  return { title: t("metaTitle") };
}

export default async function Page({ params }: Props) {
  return <StaticPage locale={await localeFrom(params)} namespace="privacy" />;
}
