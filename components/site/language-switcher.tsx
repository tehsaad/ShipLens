"use client";

import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";

/**
 * Links to the same page in the other language (section 7.1: "en / اردو"). The accessible name
 * starts with the visible language name (WCAG 2.5.3), read in that language, followed by a
 * screen-reader explanation in the page's language.
 */
export function LanguageSwitcher() {
  const t = useTranslations("language");
  const locale = useLocale();
  const pathname = usePathname();
  const other = locale === "en" ? "ur" : "en";
  return (
    <Link
      href={pathname}
      locale={other}
      hrefLang={other}
      className="rounded-full border px-3 py-1 text-sm hover:bg-muted"
    >
      <span lang={other}>{t("switchTo")}</span>
      <span className="sr-only">
        {" "}
        ({t("label")}: {t("switchToName")})
      </span>
    </Link>
  );
}
