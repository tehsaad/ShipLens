"use client";

import { useActionState } from "react";
import { Field, FormMessages, Select, SubmitButton, Textarea } from "@/components/admin/form";
import { initialFormState } from "@/lib/form-state";
import { CONTENT_TYPE_LABELS, LOCALE_LABELS } from "@/lib/labels";
import { contentStatusAction, createContentAction, updateContentAction } from "./actions";

const BODY_HINT =
  "Markdown: **bold**, _italic_, # headings, - lists, [links](https://…). HTML is not allowed.";

export function CreateContentForm() {
  const [state, action] = useActionState(createContentAction, initialFormState);
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-3" noValidate>
      <div className="sm:col-span-3">
        <FormMessages state={state} />
      </div>
      <Field name="type" label="Type" state={state}>
        {(props) => (
          <Select defaultValue="PAGE" {...props}>
            {Object.entries(CONTENT_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Field name="locale" label="Language" state={state}>
        {(props) => (
          <Select defaultValue="en" {...props}>
            {Object.entries(LOCALE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Field
        name="slug"
        label="Slug"
        state={state}
        hint="Same slug in both languages, e.g. about."
      />
      <Field name="title" label="Title" state={state} className="sm:col-span-3" />
      <Field name="body" label="Body" state={state} hint={BODY_HINT} className="sm:col-span-3">
        {(props) => <Textarea className="min-h-48 font-mono" {...props} />}
      </Field>
      <div className="sm:col-span-3">
        <SubmitButton pendingLabel="Creating…">Create draft</SubmitButton>
      </div>
    </form>
  );
}

export function EditContentForm({
  entry,
  slugEditable,
  dir,
}: {
  entry: { id: string; slug: string; title: string; body: string };
  slugEditable: boolean;
  dir: "ltr" | "rtl";
}) {
  const [state, action] = useActionState(updateContentAction, initialFormState);
  return (
    <form action={action} className="grid gap-4" noValidate>
      <input type="hidden" name="id" value={entry.id} />
      <FormMessages state={state} />
      {slugEditable ? (
        <Field
          name="slug"
          label="Slug"
          state={state}
          defaultValue={entry.slug}
          className="sm:max-w-sm"
        />
      ) : null}
      <Field name="title" label="Title" state={state} defaultValue={entry.title} dir={dir} />
      <Field name="body" label="Body" state={state} hint={BODY_HINT}>
        {(props) => (
          <Textarea defaultValue={entry.body} dir={dir} className="min-h-72 font-mono" {...props} />
        )}
      </Field>
      <div>
        <SubmitButton>Save</SubmitButton>
      </div>
    </form>
  );
}

export function StatusButtons({
  id,
  published,
  pending,
}: {
  id: string;
  published: boolean;
  pending: boolean;
}) {
  const [state, action] = useActionState(contentStatusAction, initialFormState);
  return (
    <form action={action} className="grid gap-3">
      <input type="hidden" name="id" value={id} />
      <FormMessages state={state} />
      <div className="flex flex-wrap gap-2">
        {!published || pending ? (
          <SubmitButton name="intent" value="publish" pendingLabel="Publishing…">
            {published ? "Publish changes" : "Publish"}
          </SubmitButton>
        ) : null}
        {pending ? (
          <SubmitButton name="intent" value="discard" variant="outline" pendingLabel="Discarding…">
            Discard pending changes
          </SubmitButton>
        ) : null}
        {published ? (
          <SubmitButton
            name="intent"
            value="unpublish"
            variant="destructive"
            pendingLabel="Unpublishing…"
          >
            Unpublish
          </SubmitButton>
        ) : null}
      </div>
    </form>
  );
}
