"use client";

import { useActionState } from "react";
import { Field, FormMessages, Select, SubmitButton, Textarea } from "@/components/admin/form";
import type { CollectionPurpose } from "@/lib/generated/prisma/enums";
import { initialFormState } from "@/lib/form-state";
import { PURPOSE_LABELS } from "@/lib/labels";
import {
  createCollectionAction,
  createCorrectionAction,
  routeCollectionAction,
  updateCollectionAction,
} from "./actions";

type Values = {
  amount: string;
  collectedOn: string;
  purpose: CollectionPurpose;
  description: string | null;
  correctionNote?: string | null;
};

function CollectionFields({
  state,
  values,
  today,
  isCorrection = false,
}: {
  state: Parameters<typeof Field>[0]["state"];
  values?: Values;
  today: string;
  isCorrection?: boolean;
}) {
  return (
    <>
      <Field
        name="amount"
        label="Amount (PKR)"
        state={state}
        inputMode="decimal"
        defaultValue={values?.amount ?? ""}
        hint={isCorrection ? "Positive or negative, never zero." : "Greater than zero."}
      />
      <Field
        name="collectedOn"
        label="Collected on"
        state={state}
        type="date"
        max={today}
        defaultValue={values?.collectedOn ?? today}
      />
      <Field name="purpose" label="Purpose" state={state}>
        {(props) => (
          <Select defaultValue={values?.purpose ?? "GENERAL"} {...props}>
            {Object.entries(PURPOSE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Field
        name="description"
        label="Description (optional)"
        state={state}
        className="sm:col-span-3"
      >
        {(props) => (
          <Textarea maxLength={500} defaultValue={values?.description ?? ""} {...props} />
        )}
      </Field>
      {isCorrection ? (
        <Field
          name="correctionNote"
          label="Reason for the correction"
          state={state}
          className="sm:col-span-3"
        >
          {(props) => (
            <Textarea maxLength={500} defaultValue={values?.correctionNote ?? ""} {...props} />
          )}
        </Field>
      ) : null}
    </>
  );
}

export function CreateCollectionForm({ today }: { today: string }) {
  const [state, action] = useActionState(createCollectionAction, initialFormState);
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-3" noValidate>
      <div className="sm:col-span-3">
        <FormMessages state={state} />
      </div>
      <CollectionFields state={state} today={today} />
      <div className="sm:col-span-3">
        <SubmitButton pendingLabel="Recording…">Record collection</SubmitButton>
      </div>
    </form>
  );
}

export function EditCollectionForm({
  id,
  values,
  today,
  isCorrection,
}: {
  id: string;
  values: Values;
  today: string;
  isCorrection: boolean;
}) {
  const [state, action] = useActionState(updateCollectionAction, initialFormState);
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-3" noValidate>
      <input type="hidden" name="id" value={id} />
      <div className="sm:col-span-3">
        <FormMessages state={state} />
      </div>
      <CollectionFields state={state} values={values} today={today} isCorrection={isCorrection} />
      <div className="sm:col-span-3">
        <SubmitButton>Save changes</SubmitButton>
      </div>
    </form>
  );
}

export function CorrectionForm({ id }: { id: string }) {
  const [state, action] = useActionState(createCorrectionAction, initialFormState);
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-3" noValidate>
      <input type="hidden" name="id" value={id} />
      <div className="sm:col-span-3">
        <FormMessages state={state} />
      </div>
      <Field
        name="amount"
        label="Correction (PKR)"
        state={state}
        inputMode="decimal"
        hint="Use a negative amount to reduce, e.g. -500."
      />
      <Field name="correctionNote" label="Reason" state={state} className="sm:col-span-2">
        {(props) => <Textarea maxLength={500} {...props} />}
      </Field>
      <div className="sm:col-span-3">
        <SubmitButton pendingLabel="Recording…">Record correction</SubmitButton>
      </div>
    </form>
  );
}

export function RouteForm({ id }: { id: string }) {
  const [state, action] = useActionState(routeCollectionAction, initialFormState);
  return (
    <form action={action} className="grid gap-4 sm:max-w-md" noValidate>
      <input type="hidden" name="id" value={id} />
      <FormMessages state={state} />
      <Field
        name="routingReference"
        label="Transfer or deposit reference"
        state={state}
        maxLength={100}
      />
      <div>
        <SubmitButton pendingLabel="Saving…">Mark as routed</SubmitButton>
      </div>
    </form>
  );
}
