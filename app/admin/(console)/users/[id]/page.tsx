import type { Metadata } from "next";
import { Badge, PageHeader, Section } from "@/components/admin/page";
import { requirePermission } from "@/lib/auth/session";
import { ROLE_LABELS } from "@/lib/labels";
import { loadOrNotFound, routeId, serviceContext } from "@/lib/server-action";
import { getUser, listAssignableBranches } from "@/lib/services/users";
import { ActiveForm, EditUserForm, ResetPasswordForm } from "../forms";

export const metadata: Metadata = { title: "User" };

export default async function UserPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requirePermission("user.read");
  const ctx = await serviceContext(actor);
  const user = await loadOrNotFound(async () => getUser(ctx, await routeId(params)));
  const branches = await listAssignableBranches(ctx);
  const isSelf = user.id === actor.id;
  const locked = user.lockedUntil !== null && user.lockedUntil > new Date();

  return (
    <>
      <PageHeader
        title={user.name}
        description={
          <>
            {user.email} · {ROLE_LABELS[user.role]}
            {user.branch ? ` · ${user.branch.code}` : ""}{" "}
            {user.isActive ? null : <Badge tone="bad">Deactivated</Badge>}{" "}
            {locked ? <Badge tone="warn">Locked after failed sign-ins</Badge> : null}
          </>
        }
      />
      <Section title="Details">
        <EditUserForm user={user} branches={branches} />
      </Section>
      <Section title="Password">
        <ResetPasswordForm id={user.id} />
      </Section>
      <Section title="Access">
        {isSelf ? (
          <p className="text-muted-foreground text-sm">You cannot deactivate your own account.</p>
        ) : (
          <ActiveForm id={user.id} isActive={user.isActive} />
        )}
      </Section>
    </>
  );
}
