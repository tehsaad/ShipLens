"use client";

import { useActionState } from "react";
import { Field, FormMessages, Select, SubmitButton, Textarea } from "@/components/admin/form";
import { type FormState, initialFormState } from "@/lib/form-state";
import {
  createResultAction,
  resultStatusAction,
  setResultImageAction,
  updateResultAction,
} from "./actions";

const BODY_HINT =
  "Markdown: **bold**, _italic_, # headings, - lists, [links](https://…). HTML is not allowed.";

type Branch = { id: string; code: string; name: string };

type ResultValues = {
  id: string;
  titleEn: string;
  titleUr: string | null;
  bodyEn: string;
  bodyUr: string | null;
  happenedOn: string;
};

function BranchField({
  branches,
  defaultValue,
  state,
}: {
  branches: Branch[];
  defaultValue?: string;
  state: FormState;
}) {
  return (
    <Field
      name="branchId"
      label="Branch"
      state={state}
      hint="Leave as network-wide for head office."
    >
      {(props) => (
        <Select defaultValue={defaultValue ?? ""} {...props}>
          <option value="">Network-wide (head office)</option>
          {branches.map((branch) => (
            <option key={branch.id} value={branch.id}>
              {branch.code} — {branch.name}
            </option>
          ))}
        </Select>
      )}
    </Field>
  );
}

export function CreateResultForm({ branches }: { branches: Branch[] | null }) {
  const [state, action] = useActionState(createResultAction, initialFormState);
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2" noValidate>
      <div className="sm:col-span-2">
        <FormMessages state={state} />
      </div>
      <Field name="titleEn" label="Title (English)" state={state} />
      <Field name="titleUr" label="Title (Urdu, optional)" state={state} dir="rtl" />
      <Field
        name="bodyEn"
        label="Body (English)"
        state={state}
        hint={BODY_HINT}
        className="sm:col-span-2"
      >
        {(props) => <Textarea className="min-h-40 font-mono" {...props} />}
      </Field>
      <Field
        name="bodyUr"
        label="Body (Urdu, optional)"
        state={state}
        hint={BODY_HINT}
        className="sm:col-span-2"
      >
        {(props) => <Textarea className="min-h-40 font-mono" dir="rtl" {...props} />}
      </Field>
      {branches ? <BranchField branches={branches} state={state} /> : null}
      <Field name="happenedOn" label="Date (optional)" type="date" state={state} />
      <div className="sm:col-span-2">
        <SubmitButton pendingLabel="Creating…">Create draft</SubmitButton>
      </div>
    </form>
  );
}

export function EditResultForm({ result }: { result: ResultValues }) {
  const [state, action] = useActionState(updateResultAction, initialFormState);
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2" noValidate>
      <input type="hidden" name="id" value={result.id} />
      <div className="sm:col-span-2">
        <FormMessages state={state} />
      </div>
      <Field name="titleEn" label="Title (English)" state={state} defaultValue={result.titleEn} />
      <Field
        name="titleUr"
        label="Title (Urdu, optional)"
        state={state}
        defaultValue={result.titleUr ?? ""}
        dir="rtl"
      />
      <Field
        name="bodyEn"
        label="Body (English)"
        state={state}
        hint={BODY_HINT}
        className="sm:col-span-2"
      >
        {(props) => (
          <Textarea defaultValue={result.bodyEn} className="min-h-48 font-mono" {...props} />
        )}
      </Field>
      <Field
        name="bodyUr"
        label="Body (Urdu, optional)"
        state={state}
        hint={BODY_HINT}
        className="sm:col-span-2"
      >
        {(props) => (
          <Textarea
            defaultValue={result.bodyUr ?? ""}
            dir="rtl"
            className="min-h-48 font-mono"
            {...props}
          />
        )}
      </Field>
      <Field
        name="happenedOn"
        label="Date (optional)"
        type="date"
        state={state}
        defaultValue={result.happenedOn}
      />
      <div className="sm:col-span-2">
        <SubmitButton>Save</SubmitButton>
      </div>
    </form>
  );
}

export function ResultStatusButtons({ id, published }: { id: string; published: boolean }) {
  const [state, action] = useActionState(resultStatusAction, initialFormState);
  return (
    <form action={action} className="grid gap-3">
      <input type="hidden" name="id" value={id} />
      <FormMessages state={state} />
      <div className="flex flex-wrap gap-2">
        {published ? (
          <SubmitButton
            name="intent"
            value="unpublish"
            variant="destructive"
            pendingLabel="Unpublishing…"
          >
            Unpublish
          </SubmitButton>
        ) : (
          <SubmitButton name="intent" value="publish" pendingLabel="Publishing…">
            Publish
          </SubmitButton>
        )}
      </div>
    </form>
  );
}

export function ResultImageForm({
  id,
  altEn,
  altUr,
  hasImage,
}: {
  id: string;
  altEn: string | null;
  altUr: string | null;
  hasImage: boolean;
}) {
  const [state, action] = useActionState(setResultImageAction, initialFormState);
  return (
    <form action={action} className="grid gap-4 sm:max-w-lg" noValidate>
      <input type="hidden" name="id" value={id} />
      <FormMessages state={state} />
      <Field
        name="image"
        label={hasImage ? "Replace image" : "Image"}
        state={state}
        hint="JPEG, PNG or WebP, up to 1.5 MB."
      >
        {(props) => <input type="file" accept="image/jpeg,image/png,image/webp" {...props} />}
      </Field>
      <Field
        name="imageAltEn"
        label="Image description (English)"
        state={state}
        defaultValue={altEn ?? ""}
        hint="Describe the image for screen readers."
      />
      <Field
        name="imageAltUr"
        label="Image description (Urdu, optional)"
        state={state}
        defaultValue={altUr ?? ""}
        dir="rtl"
      />
      <div>
        <SubmitButton pendingLabel="Saving…">Save image</SubmitButton>
      </div>
    </form>
  );
}
