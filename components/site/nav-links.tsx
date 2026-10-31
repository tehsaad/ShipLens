"use client";

import { LogIn, Menu, X } from "lucide-react";
import { useTranslations } from "next-intl";
import NextLink from "next/link";
import { useEffect, useRef, useState } from "react";
import { Link, usePathname } from "@/i18n/navigation";
import { LanguageSwitcher } from "./language-switcher";
import { ThemeToggle } from "./theme-toggle";

// A short primary nav. Events lives inside Programs now, and About and Contact are reachable
// from the footer, so the bar stays uncluttered.
const LINKS = [
  { href: "/", key: "home" },
  { href: "/programs", key: "programs" },
  { href: "/branches", key: "branches" },
  { href: "/get-involved", key: "getInvolved" },
] as const;

/** Main navigation: a row on wide screens, a menu panel on narrow ones (design by Gemini). */
export function NavLinks() {
  const t = useTranslations();
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
        menuButtonRef.current?.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isOpen]);

  return (
    <>
      <nav aria-label={t("nav.label")} className="hidden items-center xl:flex">
        <ul className="flex items-center gap-1">
          {LINKS.map((link) => {
            const isActive = pathname === link.href;
            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  aria-current={isActive ? "page" : undefined}
                  className={`group focus-ring-marigold relative inline-block rounded-md px-2.5 py-2 text-sm font-medium whitespace-nowrap transition-colors ${
                    isActive ? "text-primary" : "text-muted-foreground hover:text-primary"
                  }`}
                >
                  {t(`nav.${link.key}`)}
                  <span
                    aria-hidden="true"
                    className={`bg-primary motion-reduce-fade absolute start-2.5 bottom-0 h-[2px] transition-all duration-300 ease-out group-hover:w-[calc(100%-20px)] ${
                      isActive ? "w-[calc(100%-20px)]" : "w-0"
                    }`}
                  />
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="hidden items-center gap-2 xl:flex">
        <LanguageSwitcher />
        <ThemeToggle />
        <NextLink
          href="/admin/login"
          hrefLang="en"
          className="text-muted-foreground hover:text-primary focus-ring-marigold ms-1 inline-flex h-11 items-center gap-1.5 rounded-xl px-3 text-sm font-medium whitespace-nowrap transition-colors"
        >
          <LogIn className="h-4 w-4" aria-hidden="true" />
          {t("nav.signIn")}
        </NextLink>
        <Link
          href="/get-involved"
          className="bg-marigold text-marigold-foreground hover:bg-marigold/90 focus-ring-marigold motion-reduce-fade inline-flex h-11 items-center justify-center rounded-xl px-5 text-sm font-bold whitespace-nowrap shadow-sm transition-all duration-200 hover:-translate-y-0.5 active:scale-95"
        >
          {t("home.ctaApply")}
        </Link>
      </div>

      <button
        ref={menuButtonRef}
        type="button"
        className="text-ink hover:bg-border/50 focus-ring-marigold inline-flex h-11 w-11 items-center justify-center rounded-xl xl:hidden"
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        aria-controls="mobile-menu"
        aria-label={t("nav.menu")}
      >
        {isOpen ? (
          <X className="h-6 w-6" aria-hidden="true" />
        ) : (
          <Menu className="h-6 w-6" aria-hidden="true" />
        )}
      </button>

      {/* Closed, the panel is inert: its links cannot be focused or read. */}
      <div
        id="mobile-menu"
        inert={!isOpen}
        className={`border-border bg-surface motion-reduce-fade absolute start-0 end-0 top-16 z-40 border-b shadow-lg transition-all duration-300 ease-out xl:hidden ${
          isOpen ? "translate-y-0 opacity-100" : "pointer-events-none -translate-y-4 opacity-0"
        }`}
      >
        <nav aria-label={t("nav.menu")} className="flex flex-col gap-2 p-4">
          <ul className="flex flex-col gap-2">
            {LINKS.map((link) => {
              const isActive = pathname === link.href;
              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    aria-current={isActive ? "page" : undefined}
                    onClick={() => setIsOpen(false)}
                    className={`focus-ring-marigold flex h-11 items-center rounded-lg px-4 text-base font-medium transition-colors ${
                      isActive
                        ? "bg-primary/10 text-primary"
                        : "text-ink hover:bg-background hover:text-primary"
                    }`}
                  >
                    {t(`nav.${link.key}`)}
                  </Link>
                </li>
              );
            })}
          </ul>
          <NextLink
            href="/admin/login"
            hrefLang="en"
            onClick={() => setIsOpen(false)}
            className="text-ink hover:bg-background hover:text-primary focus-ring-marigold flex h-11 items-center gap-2 rounded-lg px-4 text-base font-medium transition-colors"
          >
            <LogIn className="h-4 w-4" aria-hidden="true" />
            {t("nav.signIn")}
          </NextLink>
          <div className="bg-border my-2 h-px w-full" role="none" />
          <div className="flex items-center gap-2 px-2">
            <LanguageSwitcher />
            <ThemeToggle />
            <Link
              href="/get-involved"
              onClick={() => setIsOpen(false)}
              className="bg-marigold text-marigold-foreground focus-ring-marigold ms-auto inline-flex h-11 items-center justify-center rounded-xl px-6 font-bold active:scale-95"
            >
              {t("home.ctaApply")}
            </Link>
          </div>
        </nav>
      </div>
    </>
  );
}
