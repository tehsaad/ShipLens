"use client";

import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { Label } from "@/components/ui/label";

/**
 * A labelled public form field. `error` is a message key under "errors" (from the shared Zod
 * schema, in the browser or from the server), shown in the visitor's language.
 */
export function PublicField({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: (props: {
    id: string;
    "aria-invalid"?: true;
    "aria-describedby"?: string;
  }) => ReactNode;
}) {
  const t = useTranslations("errors");
  const describedBy = [error ? `${id}-error` : null, hint ? `${id}-hint` : null]
    .filter(Boolean)
    .join(" ");
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      {children({
        id,
        ...(error ? { "aria-invalid": true as const } : {}),
        ...(describedBy ? { "aria-describedby": describedBy } : {}),
      })}
      {hint ? (
        <p id={`${id}-hint`} className="text-muted-foreground text-xs">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="text-destructive text-sm" role="alert">
          {t.has(error) ? t(error) : error}
        </p>
      ) : null}
    </div>
  );
}

/** Hidden from people and assistive technology; bots tend to fill it (section 7.1). */
export function Honeypot({ label }: { label: string }) {
  return (
    <div aria-hidden="true" className="absolute -start-[9999px] h-0 overflow-hidden">
      <label>
        {label}
        <input type="text" name="website" tabIndex={-1} autoComplete="off" />
      </label>
    </div>
  );
}
