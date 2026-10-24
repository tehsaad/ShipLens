"use client";

import "@/lib/zod-jitless";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { startTransition, useActionState } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { Textarea } from "@/components/admin/form";
import { Honeypot, PublicField } from "@/components/site/public-field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { initialPublicFormState } from "@/lib/public-form";
import { contactSchema } from "@/lib/validation/applications";
import { submitContactAction } from "./actions";

type Values = z.input<typeof contactSchema>;

/** Contact form (section 7.1), validated with the same Zod schema in the browser and server. */
export function ContactForm() {
  const t = useTranslations("form");
  const [state, formAction, pending] = useActionState(submitContactAction, initialPublicFormState);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Values, unknown, z.output<typeof contactSchema>>({
    resolver: zodResolver(contactSchema),
    mode: "onTouched",
  });

  if (state.ok) {
    return (
      <Alert role="status">
        <AlertDescription>{t("messageThanks")}</AlertDescription>
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
      <div className="grid gap-4 sm:grid-cols-2">
        <PublicField id="name" label={t("name")} error={error("name")}>
          {(props) => <Input {...props} autoComplete="name" maxLength={80} {...register("name")} />}
        </PublicField>
        <PublicField id="email" label={t("email")} error={error("email")}>
          {(props) => (
            <Input {...props} type="email" autoComplete="email" dir="ltr" {...register("email")} />
          )}
        </PublicField>
      </div>
      <PublicField
        id="message"
        label={t("message")}
        hint={t("messageHint")}
        error={error("message")}
      >
        {(props) => (
          <Textarea {...props} maxLength={2000} className="min-h-40" {...register("message")} />
        )}
      </PublicField>
      <div>
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? t("sending") : t("submitMessage")}
        </Button>
      </div>
    </form>
  );
}
