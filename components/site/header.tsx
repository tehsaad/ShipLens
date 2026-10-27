import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { NavLinks } from "./nav-links";

/** Site header (design by Gemini): the "walking together" mark, the name and the navigation. */
export async function SiteHeader() {
  const t = await getTranslations();

  return (
    <header className="border-border bg-background/90 sticky top-0 z-50 w-full border-b backdrop-blur-md">
      <div className="relative mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
        <Link href="/" className="focus-ring-marigold flex items-center gap-2 rounded-md">
          <svg
            aria-hidden="true"
            className="text-primary h-8 w-8"
            viewBox="0 0 512 512"
            fill="none"
          >
            <circle cx="256" cy="160" r="48" fill="var(--color-marigold)" />
            <path
              d="M160 352L256 160L352 352"
              stroke="currentColor"
              strokeWidth="48"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span className="text-primary text-xl font-bold tracking-tight whitespace-nowrap">
            {t("site.name")}
          </span>
        </Link>

        <NavLinks />
      </div>
    </header>
  );
}
