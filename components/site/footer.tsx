import { getTranslations } from "next-intl/server";
import NextLink from "next/link";
import { Link } from "@/i18n/navigation";

export async function SiteFooter() {
  const t = await getTranslations("footer");
  const nav = await getTranslations("nav");
  return (
    <footer className="mt-16 border-t">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8">
        <nav
          aria-label={t("linksLabel")}
          className="text-muted-foreground flex flex-wrap gap-x-6 gap-y-2 text-sm"
        >
          <Link href="/about" className="hover:text-foreground">
            {nav("about")}
          </Link>
          <Link href="/results" className="hover:text-foreground">
            {nav("results")}
          </Link>
          <Link href="/events" className="hover:text-foreground">
            {nav("events")}
          </Link>
          <Link href="/contact" className="hover:text-foreground">
            {nav("contact")}
          </Link>
          <Link href="/privacy" className="hover:text-foreground">
            {t("privacy")}
          </Link>
          <Link href="/terms" className="hover:text-foreground">
            {t("terms")}
          </Link>
          <NextLink href="/admin/login" className="hover:text-foreground" hrefLang="en">
            {t("staff")}
          </NextLink>
        </nav>
        <p className="text-muted-foreground text-sm">
          {t("rights", { year: new Date().getFullYear() })}
        </p>
      </div>
    </footer>
  );
}
