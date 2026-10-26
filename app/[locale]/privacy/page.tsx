import type { Metadata } from "next";
import { StaticPage } from "@/components/site/static-page";
import { localeFrom } from "@/lib/locale-params";
import { pageMetadata } from "@/lib/seo/metadata";

type Props = { params: Promise<{ locale: string }> };

export function generateMetadata({ params }: Props): Promise<Metadata> {
  return pageMetadata(params, "privacy");
}

export default async function Page({ params }: Props) {
  return <StaticPage locale={await localeFrom(params)} namespace="privacy" />;
}
