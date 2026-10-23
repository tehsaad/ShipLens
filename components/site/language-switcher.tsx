"use client";

import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";

/** Links to the same page in the other language (section 7.1: "en / اردو"). */
export function LanguageSwitcher() {
  const t = useTranslations("language");
  const locale = useLocale();
  const pathname = usePathname();
  const other = locale === "en" ? "ur" : "en";
  return (
    <Link
      href={pathname}
      locale={other}
      lang={other}
      hrefLang={other}
      className="rounded-full border px-3 py-1 text-sm hover:bg-muted"
      aria-label={`${t("label")}: ${t("switchToName")}`}
    >
      {t("switchTo")}
    </Link>
  );
}
