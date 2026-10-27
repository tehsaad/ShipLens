"use client";

import { Moon, Sun } from "lucide-react";
import { useTranslations } from "next-intl";

/**
 * Light and dark theme switch. The stored choice is applied before paint by theme-script.ts;
 * the icon follows the `dark` class through CSS, so it is right from the first paint.
 */
export function ThemeToggle() {
  const t = useTranslations();

  function toggleTheme() {
    // Read the page, not component state: the header renders a toggle for wide screens and
    // another in the mobile menu.
    const dark = document.documentElement.classList.toggle("dark");
    try {
      localStorage.setItem("theme", dark ? "dark" : "light");
    } catch {
      // Private browsing: the choice lasts for this page only.
    }
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      title={t("theme.toggle")}
      className="focus-ring-marigold text-muted-foreground hover:bg-border/50 hover:text-primary relative inline-flex h-11 w-11 items-center justify-center rounded-xl transition-colors duration-200 active:scale-95"
    >
      <Sun className="hidden h-[1.2rem] w-[1.2rem] dark:block" aria-hidden="true" />
      <Moon className="h-[1.2rem] w-[1.2rem] dark:hidden" aria-hidden="true" />
      <span className="sr-only">{t("theme.toggle")}</span>
    </button>
  );
}
