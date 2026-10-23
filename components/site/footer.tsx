import { getTranslations } from "next-intl/server";
import NextLink from "next/link";
import { Link } from "@/i18n/navigation";

export async function SiteFooter() {
  const t = await getTranslations("footer");
  return (
    <footer className="mt-16 border-t">
      <div className="text-muted-foreground mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-6 text-sm">
        <p className="me-auto">{t("rights", { year: new Date().getFullYear() })}</p>
        <Link href="/privacy" className="hover:text-foreground">
          {t("privacy")}
        </Link>
        <Link href="/terms" className="hover:text-foreground">
          {t("terms")}
        </Link>
        <NextLink href="/admin/login" className="hover:text-foreground" hrefLang="en">
          {t("staff")}
        </NextLink>
      </div>
    </footer>
  );
}
