"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Select } from "@/components/admin/form";
import { Label } from "@/components/ui/label";
import type { PublicBranch } from "@/lib/services/branches";

/** Section 7.1 Branches: filter by city in the browser, so the page itself stays cached. */
export function BranchList({ branches }: { branches: PublicBranch[] }) {
  const t = useTranslations("branches");
  const [city, setCity] = useState("");
  const cities = [...new Set(branches.map((branch) => branch.city))].sort();
  const shown = city ? branches.filter((branch) => branch.city === city) : branches;

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end gap-3">
        <div className="grid gap-2">
          <Label htmlFor="city">{t("filterLabel")}</Label>
          <Select
            id="city"
            value={city}
            onChange={(event) => setCity(event.target.value)}
            className="w-56"
          >
            <option value="">{t("allCities")}</option>
            {cities.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </Select>
        </div>
        <p className="text-muted-foreground text-sm" aria-live="polite">
          {t("count", { count: shown.length })}
        </p>
      </div>
      {shown.length === 0 ? <p className="text-muted-foreground">{t("empty")}</p> : null}
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((branch) => (
          <li key={branch.id} className="bg-card grid gap-2 rounded-xl border p-5">
            <h2 className="text-lg font-semibold">{branch.name}</h2>
            <dl className="grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1 text-sm">
              <dt className="text-muted-foreground">{t("code")}</dt>
              <dd dir="ltr" className="font-mono">
                {branch.code}
              </dd>
              <dt className="text-muted-foreground">{t("city")}</dt>
              <dd>{branch.city}</dd>
              <dt className="text-muted-foreground">{t("contact")}</dt>
              <dd dir="ltr">
                {branch.contactEmail ? (
                  <a href={`mailto:${branch.contactEmail}`} className="text-primary underline">
                    {branch.contactEmail}
                  </a>
                ) : (
                  <span dir="auto">{t("noEmail")}</span>
                )}
              </dd>
            </dl>
          </li>
        ))}
      </ul>
    </div>
  );
}
