"use client";

import { useActionState } from "react";
import { Field, FormMessages, Select, SubmitButton, Textarea } from "@/components/admin/form";
import { initialFormState } from "@/lib/form-state";
import { AVAILABILITY_LABELS } from "@/lib/labels";
import { submitApplicationAction } from "./actions";

type BranchOption = { id: string; code: string; name: string; city: string };

export function ApplicationForm({ branches }: { branches: BranchOption[] }) {
  const [state, action] = useActionState(submitApplicationAction, initialFormState);
  if (state.success) return <FormMessages state={state} />;
  const consentError = state.fieldErrors?.["consentGiven"];

  return (
    <form action={action} className="grid gap-4" noValidate>
      <FormMessages state={state} />
      {/* Honeypot: hidden from people and assistive technology; bots tend to fill it. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 overflow-hidden">
        <label>
          Website
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <Field
        name="fullName"
        label="Full name"
        state={state}
        autoComplete="name"
        required
        maxLength={80}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          name="email"
          label="Email"
          state={state}
          type="email"
          autoComplete="email"
          required
        />
        <Field
          name="phone"
          label="Phone"
          state={state}
          type="tel"
          autoComplete="tel"
          required
          hint="For example +92 300 1234567 or 0300 1234567."
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field name="preferredBranchId" label="Preferred branch" state={state}>
          {(props) => (
            <Select defaultValue="" required {...props}>
              <option value="">Choose a branch</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.city} · {branch.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field name="availability" label="Availability" state={state}>
          {(props) => (
            <Select defaultValue="" required {...props}>
              <option value="">Choose one</option>
              {Object.entries(AVAILABILITY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>
      <Field name="skills" label="Skills (optional)" state={state} hint="Up to 500 characters.">
        {(props) => <Textarea maxLength={500} {...props} />}
      </Field>
      <Field
        name="motivation"
        label="Why do you want to volunteer?"
        state={state}
        hint="Between 50 and 1000 characters."
      >
        {(props) => <Textarea maxLength={1000} required className="min-h-32" {...props} />}
      </Field>
      <div className="grid gap-1">
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            name="consentGiven"
            className="mt-0.5"
            aria-invalid={consentError ? true : undefined}
            aria-describedby={consentError ? "consent-error" : undefined}
          />
          I agree that the organisation stores these details to process my application and contact
          me. No national ID is collected.
        </label>
        {consentError ? (
          <p id="consent-error" className="text-destructive text-sm">
            {consentError[0]}
          </p>
        ) : null}
      </div>
      <div>
        <SubmitButton pendingLabel="Sending…">Send application</SubmitButton>
      </div>
    </form>
  );
}
