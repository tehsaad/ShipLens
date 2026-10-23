"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { startTransition, useActionState } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { Select, Textarea } from "@/components/admin/form";
import { Honeypot, PublicField } from "@/components/site/public-field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { initialPublicFormState } from "@/lib/public-form";
import { applicationSchema } from "@/lib/validation/applications";
import { submitApplicationAction } from "./actions";

type Values = z.input<typeof applicationSchema>;
type BranchOption = { id: string; name: string; city: string };

const AVAILABILITY = ["WEEKDAYS", "WEEKENDS", "FLEXIBLE"] as const;

/**
 * Volunteer application (section 7.1): React Hook Form validates with the same Zod schema as
 * the server action, field by field, in the visitor's language. Without JavaScript the form
 * still posts to the server action, which validates again.
 */
export function ApplicationForm({ branches }: { branches: BranchOption[] }) {
  const t = useTranslations("form");
  const [state, formAction, pending] = useActionState(
    submitApplicationAction,
    initialPublicFormState,
  );
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Values, unknown, z.output<typeof applicationSchema>>({
    resolver: zodResolver(applicationSchema),
    mode: "onTouched",
  });

  if (state.ok) {
    return (
      <Alert role="status">
        <AlertDescription>{t("applicationThanks")}</AlertDescription>
      </Alert>
    );
  }

  const error = (name: keyof Values) => errors[name]?.message ?? state.fieldErrors?.[name]?.[0];
  // Valid in the browser: send the form's own fields (including the honeypot) to the server.
  const onValid = (_values: unknown, event?: { target: EventTarget | null }) => {
    const formData = new FormData(event!.target as HTMLFormElement);
    startTransition(() => formAction(formData));
  };

  return (
    <form
      action={formAction}
      onSubmit={handleSubmit(onValid)}
      className="relative grid gap-4"
      noValidate
    >
      {state.formError ? (
        <Alert variant="destructive" aria-live="polite">
          <AlertDescription>{t(state.formError)}</AlertDescription>
        </Alert>
      ) : null}
      <Honeypot label={t("honeypot")} />
      <PublicField id="fullName" label={t("fullName")} error={error("fullName")}>
        {(props) => (
          <Input {...props} autoComplete="name" maxLength={80} {...register("fullName")} />
        )}
      </PublicField>
      <div className="grid gap-4 sm:grid-cols-2">
        <PublicField id="email" label={t("email")} error={error("email")}>
          {(props) => (
            <Input {...props} type="email" autoComplete="email" dir="ltr" {...register("email")} />
          )}
        </PublicField>
        <PublicField id="phone" label={t("phone")} hint={t("phoneHint")} error={error("phone")}>
          {(props) => (
            <Input {...props} type="tel" autoComplete="tel" dir="ltr" {...register("phone")} />
          )}
        </PublicField>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <PublicField
          id="preferredBranchId"
          label={t("preferredBranch")}
          error={error("preferredBranchId")}
        >
          {(props) => (
            <Select {...props} defaultValue="" {...register("preferredBranchId")}>
              <option value="">{t("chooseBranch")}</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.city} · {branch.name}
                </option>
              ))}
            </Select>
          )}
        </PublicField>
        <PublicField id="availability" label={t("availability")} error={error("availability")}>
          {(props) => (
            <Select {...props} defaultValue="" {...register("availability")}>
              <option value="">{t("chooseOne")}</option>
              {AVAILABILITY.map((value) => (
                <option key={value} value={value}>
                  {t(`availability${value}`)}
                </option>
              ))}
            </Select>
          )}
        </PublicField>
      </div>
      <PublicField id="skills" label={t("skills")} hint={t("skillsHint")} error={error("skills")}>
        {(props) => <Textarea {...props} maxLength={500} {...register("skills")} />}
      </PublicField>
      <PublicField
        id="motivation"
        label={t("motivation")}
        hint={t("motivationHint")}
        error={error("motivation")}
      >
        {(props) => (
          <Textarea {...props} maxLength={1000} className="min-h-32" {...register("motivation")} />
        )}
      </PublicField>
      <PublicField id="consentGiven" label="" error={error("consentGiven")}>
        {(props) => (
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-1.5" {...props} {...register("consentGiven")} />
            {t("consent")}
          </label>
        )}
      </PublicField>
      <div>
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? t("sending") : t("submitApplication")}
        </Button>
      </div>
    </form>
  );
}
