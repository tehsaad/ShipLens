"use client";

import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";

/**
 * Links to the same page in the other language (section 7.1: "en / اردو"). The accessible name
 * starts with the visible language name (WCAG 2.5.3), read in that language, followed by a
 * screen-reader explanation in the page's language.
 */
export function LanguageSwitcher() {
  const t = useTranslations();
  const locale = useLocale();
  const pathname = usePathname();
  const other = locale === "en" ? "ur" : "en";

  return (
    <Link
      href={pathname}
      locale={other}
      hrefLang={other}
      className="focus-ring-marigold text-muted-foreground hover:bg-border/50 hover:text-primary inline-flex h-11 min-w-[3rem] items-center justify-center rounded-xl px-3 text-sm font-medium transition-all duration-200 active:scale-95"
    >
      <span lang={other}>{t("language.switchTo")}</span>
      <span className="sr-only">
        {" "}
        ({t("language.label")}: {t("language.switchToName")})
      </span>
    </Link>
  );
}
