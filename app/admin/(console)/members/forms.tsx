"use client";

import { useActionState } from "react";
import { Field, FormMessages, Select, SubmitButton } from "@/components/admin/form";
import type { MemberStatus } from "@/lib/generated/prisma/enums";
import { initialFormState } from "@/lib/form-state";
import { MEMBER_STATUS_LABELS } from "@/lib/labels";
import { changeBranchAction, changeStatusAction, updateContactAction } from "./actions";

export function ContactForm({
  member,
}: {
  member: { id: string; fullName: string; email: string; phone: string };
}) {
  const [state, action] = useActionState(updateContactAction, initialFormState);
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-3" noValidate>
      <input type="hidden" name="id" value={member.id} />
      <div className="sm:col-span-3">
        <FormMessages state={state} />
      </div>
      <Field name="fullName" label="Full name" state={state} defaultValue={member.fullName} />
      <Field name="email" label="Email" state={state} type="email" defaultValue={member.email} />
      <Field name="phone" label="Phone" state={state} type="tel" defaultValue={member.phone} />
      <div className="sm:col-span-3">
        <SubmitButton>Save contact details</SubmitButton>
      </div>
    </form>
  );
}

export function StatusForm({ id, status }: { id: string; status: MemberStatus }) {
  const [state, action] = useActionState(changeStatusAction, initialFormState);
  return (
    <form action={action} className="grid gap-4 sm:max-w-sm" noValidate>
      <input type="hidden" name="id" value={id} />
      <FormMessages state={state} />
      <Field name="status" label="Status" state={state}>
        {(props) => (
          <Select defaultValue={status} {...props}>
            {Object.entries(MEMBER_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <div>
        <SubmitButton>Change status</SubmitButton>
      </div>
    </form>
  );
}

export function BranchForm({
  id,
  branchId,
  branches,
}: {
  id: string;
  branchId: string;
  branches: { id: string; code: string; name: string }[];
}) {
  const [state, action] = useActionState(changeBranchAction, initialFormState);
  return (
    <form action={action} className="grid gap-4 sm:max-w-sm" noValidate>
      <input type="hidden" name="id" value={id} />
      <FormMessages state={state} />
      <Field
        name="branchId"
        label="Branch"
        state={state}
        hint="Moving a member removes it from its current teams."
      >
        {(props) => (
          <Select defaultValue={branchId} {...props}>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.code} · {branch.name}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <div>
        <SubmitButton pendingLabel="Moving…">Move member</SubmitButton>
      </div>
    </form>
  );
}
