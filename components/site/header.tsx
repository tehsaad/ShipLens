import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { LanguageSwitcher } from "./language-switcher";
import { NavLinks } from "./nav-links";
import { ThemeToggle } from "./theme-toggle";

export const NAV_ITEMS = [
  { href: "/", key: "home" },
  { href: "/about", key: "about" },
  { href: "/programs", key: "programs" },
  { href: "/branches", key: "branches" },
  { href: "/events", key: "events" },
  { href: "/get-involved", key: "getInvolved" },
  { href: "/contact", key: "contact" },
] as const;

export async function SiteHeader() {
  const t = await getTranslations();
  const items = NAV_ITEMS.map((item) => ({ href: item.href, label: t(`nav.${item.key}`) }));
  return (
    <header className="border-b bg-background/95">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3">
        <Link href="/" className="text-lg font-semibold text-primary">
          {t("site.name")}
        </Link>
        <NavLinks items={items} label={t("nav.label")} menuLabel={t("nav.menu")} />
        <div className="ms-auto flex items-center gap-2">
          <LanguageSwitcher />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
