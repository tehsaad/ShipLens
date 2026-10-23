"use client";

import { useActionState } from "react";
import { Field, FormMessages, Select, SubmitButton } from "@/components/admin/form";
import { initialFormState } from "@/lib/form-state";
import { createEventAction, publishEventAction, updateEventAction } from "./actions";

type BranchOption = { id: string; code: string; name: string };
type Values = {
  titleEn: string;
  titleUr: string | null;
  startsAt: string;
  endsAt: string;
  location: string;
  branchId: string | null;
};

export function EventForm({
  event,
  branches,
}: {
  event?: { id: string } & Values;
  branches: BranchOption[];
}) {
  const [state, action] = useActionState(
    event ? updateEventAction : createEventAction,
    initialFormState,
  );
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2" noValidate>
      {event ? <input type="hidden" name="id" value={event.id} /> : null}
      <div className="sm:col-span-2">
        <FormMessages state={state} />
      </div>
      <Field
        name="titleEn"
        label="Title (English)"
        state={state}
        defaultValue={event?.titleEn ?? ""}
      />
      <Field
        name="titleUr"
        label="Title (Urdu, optional)"
        state={state}
        defaultValue={event?.titleUr ?? ""}
        dir="rtl"
        lang="ur"
        hint="Without it, the Urdu site shows the English title with a notice."
      />
      <Field
        name="startsAt"
        label="Starts (Karachi time)"
        state={state}
        type="datetime-local"
        defaultValue={event?.startsAt ?? ""}
      />
      <Field
        name="endsAt"
        label="Ends (Karachi time)"
        state={state}
        type="datetime-local"
        defaultValue={event?.endsAt ?? ""}
      />
      <Field name="location" label="Location" state={state} defaultValue={event?.location ?? ""} />
      <Field name="branchId" label="Branch" state={state}>
        {(props) => (
          <Select defaultValue={event?.branchId ?? ""} {...props}>
            <option value="">Head office</option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.code} · {branch.name}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <div className="sm:col-span-2">
        <SubmitButton pendingLabel="Saving…">{event ? "Save" : "Create draft event"}</SubmitButton>
      </div>
    </form>
  );
}

export function PublishEventForm({ id, published }: { id: string; published: boolean }) {
  const [state, action] = useActionState(publishEventAction, initialFormState);
  return (
    <form action={action} className="grid gap-3">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="intent" value={published ? "unpublish" : "publish"} />
      <FormMessages state={state} />
      <div>
        <SubmitButton variant={published ? "destructive" : "default"}>
          {published ? "Unpublish" : "Publish"}
        </SubmitButton>
      </div>
    </form>
  );
}
