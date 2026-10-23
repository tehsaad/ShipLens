import type { Metadata } from "next";
import { PageHeader, Section } from "@/components/admin/page";
import { requirePermission } from "@/lib/auth/session";
import { formatDateOnly } from "@/lib/dates";
import { can } from "@/lib/permissions";
import { BRANCH_TRANSITIONS } from "@/lib/rules/branch";
import { loadOrNotFound, routeId, serviceContext } from "@/lib/server-action";
import { getBranch, listLeadCandidates } from "@/lib/services/branches";
import { BranchStatusForm, EditBranchForm } from "../forms";
import { BranchStatusBadge } from "../status-badge";

export const metadata: Metadata = { title: "Branch" };

export default async function BranchPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission("branch.read");
  const ctx = await serviceContext(user);
  const branch = await loadOrNotFound(async () => getBranch(ctx, await routeId(params)));
  const canEdit = can(user, "branch.update");

  return (
    <>
      <PageHeader
        title={`${branch.code} · ${branch.name}`}
        description={
          <>
            {branch.city} · <BranchStatusBadge status={branch.status} /> · opened{" "}
            {branch.openedAt ? formatDateOnly(branch.openedAt) : "not yet"}
          </>
        }
      />
      {canEdit ? (
        <Section title="Details">
          <EditBranchForm branch={branch} candidates={await listLeadCandidates(ctx, branch.id)} />
        </Section>
      ) : null}
      {can(user, "branch.changeStatus") ? (
        <Section title="Status">
          <BranchStatusForm id={branch.id} options={BRANCH_TRANSITIONS[branch.status]} />
        </Section>
      ) : null}
    </>
  );
}
