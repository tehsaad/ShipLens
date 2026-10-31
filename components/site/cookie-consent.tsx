"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Link } from "@/i18n/navigation";

const STORAGE_KEY = "cookie-consent";

/**
 * A cookie-consent notice shown once, until the visitor accepts or declines. The site uses only
 * an essential session cookie, so the choice is remembered in localStorage and nothing else
 * changes; it is here for transparency and to meet the expectation of a consent notice.
 *
 * Rendered only after mount, so the server HTML never includes it and hydration cannot mismatch.
 */
export function CookieConsent() {
  const t = useTranslations("cookies");
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Read once on mount (localStorage is not available during server rendering). Private
    // browsing or blocked storage throws, in which case the notice shows for this view only.
    let decided = false;
    try {
      decided = Boolean(localStorage.getItem(STORAGE_KEY));
    } catch {
      decided = false;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time init from storage
    if (!decided) setVisible(true);
  }, []);

  function choose(choice: "accepted" | "declined") {
    try {
      localStorage.setItem(STORAGE_KEY, choice);
    } catch {
      // Ignore: the notice simply reappears next time if storage is unavailable.
    }
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div
      role="region"
      aria-label={t("label")}
      className="motion-reduce-fade fixed inset-x-0 bottom-0 z-50 px-4 pb-4"
    >
      <div className="bg-card border-border mx-auto flex w-full max-w-3xl flex-col gap-3 rounded-xl border p-4 shadow-lg sm:flex-row sm:items-center sm:gap-4">
        <p className="text-muted-foreground text-sm text-pretty">
          {t("message")}{" "}
          <Link href="/privacy" className="text-primary font-medium underline">
            {t("learnMore")}
          </Link>
        </p>
        <div className="flex shrink-0 gap-2 sm:ms-auto">
          <button
            type="button"
            onClick={() => choose("declined")}
            className="border-border hover:bg-background focus-ring-marigold inline-flex h-10 items-center justify-center rounded-lg border px-4 text-sm font-medium transition-colors"
          >
            {t("decline")}
          </button>
          <button
            type="button"
            onClick={() => choose("accepted")}
            className="bg-primary text-primary-foreground hover:bg-primary/90 focus-ring-marigold inline-flex h-10 items-center justify-center rounded-lg px-4 text-sm font-semibold transition-colors"
          >
            {t("accept")}
          </button>
        </div>
      </div>
    </div>
  );
}
