"use client";

import { useActionState } from "react";
import { Field, FormMessages, SubmitButton, Textarea } from "@/components/admin/form";
import { initialFormState } from "@/lib/form-state";
import {
  approveReportAction,
  openReportAction,
  returnReportAction,
  saveNotesAction,
  submitReportAction,
} from "./actions";

export function WeekPicker({ today }: { today: string }) {
  const [state, action] = useActionState(openReportAction, initialFormState);
  return (
    <form action={action} className="flex flex-wrap items-end gap-3" noValidate>
      <Field
        name="week"
        label="Week containing"
        state={state}
        type="date"
        max={today}
        defaultValue={today}
        hint="Weeks run Monday to Sunday."
      />
      <SubmitButton pendingLabel="Opening…">Open week</SubmitButton>
      <div className="basis-full">
        <FormMessages state={state} />
      </div>
    </form>
  );
}

type Versioned = { id: string; version: number };

function Hidden({ id, version }: Versioned) {
  return (
    <>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="version" value={version} />
    </>
  );
}

export function NotesForm({ report, notes }: { report: Versioned; notes: string | null }) {
  const [state, action] = useActionState(saveNotesAction, initialFormState);
  return (
    <form action={action} className="grid gap-3" noValidate>
      <Hidden {...report} />
      <FormMessages state={state} />
      <Field name="leadNotes" label="Notes for the reviewer (optional)" state={state}>
        {(props) => <Textarea {...props} maxLength={2000} defaultValue={notes ?? ""} />}
      </Field>
      <div>
        <SubmitButton variant="outline">Save notes</SubmitButton>
      </div>
    </form>
  );
}

export function SubmitForm({ report, label }: { report: Versioned; label: string }) {
  const [state, action] = useActionState(submitReportAction, initialFormState);
  return (
    <form action={action} className="grid gap-3">
      <Hidden {...report} />
      <FormMessages state={state} />
      <div>
        <SubmitButton pendingLabel="Submitting…">{label}</SubmitButton>
      </div>
    </form>
  );
}

export function ReviewForms({ report }: { report: Versioned }) {
  const [approveState, approve] = useActionState(approveReportAction, initialFormState);
  const [returnState, sendBack] = useActionState(returnReportAction, initialFormState);
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <form action={approve} className="grid gap-3" noValidate>
        <Hidden {...report} />
        <FormMessages state={approveState} />
        <Field name="comment" label="Comment (optional)" state={approveState}>
          {(props) => <Textarea {...props} maxLength={2000} />}
        </Field>
        <div>
          <SubmitButton pendingLabel="Approving…">Approve</SubmitButton>
        </div>
      </form>
      <form action={sendBack} className="grid gap-3" noValidate>
        <Hidden {...report} />
        <FormMessages state={returnState} />
        <Field name="comment" label="What needs fixing (required)" state={returnState}>
          {(props) => <Textarea {...props} maxLength={2000} />}
        </Field>
        <div>
          <SubmitButton variant="destructive" pendingLabel="Returning…">
            Return to Branch Lead
          </SubmitButton>
        </div>
      </form>
    </div>
  );
}
