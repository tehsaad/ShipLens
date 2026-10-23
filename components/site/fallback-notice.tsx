import { getTranslations } from "next-intl/server";

/** Section 7.4: shown when the Urdu version is missing and the English one is displayed. */
export async function FallbackNotice() {
  const t = await getTranslations("fallback");
  return (
    <p role="note" className="rounded-md border border-dashed bg-muted px-3 py-2 text-sm">
      {t("notice")}
    </p>
  );
}
