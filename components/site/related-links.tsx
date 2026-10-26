import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { publicPage, type PublicPageKey } from "@/lib/seo/pages";

/** Links to the pages a visitor of this page is likely to want next, named for where they go. */
export async function RelatedLinks({ pages }: { pages: PublicPageKey[] }) {
  const t = await getTranslations("related");
  return (
    <nav aria-labelledby="related-pages" className="grid gap-3 border-t pt-6">
      <h2 id="related-pages" className="text-muted-foreground text-sm font-medium">
        {t("label")}
      </h2>
      <ul className="flex flex-wrap gap-x-6 gap-y-2">
        {pages.map((key) => (
          <li key={key}>
            <Link href={publicPage(key).path || "/"} className="text-primary font-medium underline">
              {t(key)}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
