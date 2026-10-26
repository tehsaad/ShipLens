import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageJsonLd } from "@/components/seo/page-json-ld";
import { RelatedLinks } from "@/components/site/related-links";
import { getPrisma } from "@/lib/db";
import { localeFrom } from "@/lib/locale-params";
import { pageMetadata } from "@/lib/seo/metadata";
import { SITE_URL } from "@/lib/seo/site";
import { branchListNode, pageItemId } from "@/lib/seo/structured-data";
import { listPublicBranches } from "@/lib/services/branches";
import { BranchList } from "./branch-list";

type Props = { params: Promise<{ locale: string }> };

export function generateMetadata({ params }: Props): Promise<Metadata> {
  return pageMetadata(params, "branches");
}

/** Section 7.1 Branches: ACTIVE branches only, with code, city and contact email. */
export default async function BranchesPage({ params }: Props) {
  const locale = await localeFrom(params);
  setRequestLocale(locale);
  const t = await getTranslations("branches");
  const branches = await listPublicBranches(getPrisma());

  return (
    <div className="grid gap-8">
      <header className="grid gap-2">
        <h1 className="text-3xl font-semibold">{t("title")}</h1>
        <p className="text-muted-foreground text-lg">{t("intro")}</p>
      </header>
      <BranchList branches={branches} />
      <RelatedLinks pages={["getInvolved", "events", "contact"]} />
      <PageJsonLd
        locale={locale}
        page="branches"
        list={branchListNode(
          SITE_URL,
          pageItemId(SITE_URL, locale, "/branches", "branches"),
          branches,
        )}
      />
    </div>
  );
}
