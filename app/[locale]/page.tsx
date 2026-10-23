import { getTranslations, setRequestLocale } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { localeFrom } from "@/lib/locale-params";

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = await localeFrom(params);
  setRequestLocale(locale);
  const t = await getTranslations("home");
  return (
    <section className="grid max-w-3xl gap-6 py-8">
      <h1 className="text-4xl font-semibold text-balance">{t("heroTitle")}</h1>
      <p className="text-muted-foreground text-lg">{t("heroText")}</p>
      <div className="flex flex-wrap gap-3">
        <Button asChild size="lg">
          <Link href="/get-involved">{t("ctaApply")}</Link>
        </Button>
        <Button asChild size="lg" variant="outline">
          <Link href="/programs">{t("ctaPrograms")}</Link>
        </Button>
      </div>
    </section>
  );
}
