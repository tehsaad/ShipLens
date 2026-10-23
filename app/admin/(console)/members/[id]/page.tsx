import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader, Section } from "@/components/admin/page";
import { requirePermission } from "@/lib/auth/session";
import { formatDateOnly } from "@/lib/dates";
import { can } from "@/lib/permissions";
import { loadOrNotFound, routeId, serviceContext } from "@/lib/server-action";
import { listMemberBranches } from "@/lib/services/applications";
import { getMember } from "@/lib/services/members";
import { BranchForm, ContactForm, StatusForm } from "../forms";
import { MemberStatusBadge } from "../status-badge";

export const metadata: Metadata = { title: "Member" };

export default async function MemberPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission("member.read");
  const ctx = await serviceContext(user);
  const member = await loadOrNotFound(async () => getMember(ctx, await routeId(params)));
  const scope = { branchId: member.branchId };

  return (
    <>
      <PageHeader
        title={`${member.memberCode} · ${member.fullName}`}
        description={
          <>
            {member.branch.code} · {member.branch.name} · joined {formatDateOnly(member.joinedAt)} ·{" "}
            <MemberStatusBadge status={member.status} />
            {member.applicationId ? (
              <>
                {" "}
                ·{" "}
                {can(user, "application.read") ? (
                  <Link
                    href={`/admin/applications/${member.applicationId}`}
                    className="text-primary underline"
                  >
                    application
                  </Link>
                ) : (
                  "from an application"
                )}
              </>
            ) : null}
          </>
        }
      />
      <Section title="Teams">
        {member.teams.length === 0 ? (
          <p className="text-muted-foreground text-sm">Not in any team.</p>
        ) : (
          <ul className="grid gap-1 text-sm">
            {member.teams.map(({ team, roleInTeam }) => (
              <li key={team.id}>
                {can(user, "team.read", scope) ? (
                  <Link href={`/admin/teams/${team.id}`} className="text-primary underline">
                    {team.name}
                  </Link>
                ) : (
                  team.name
                )}
                {roleInTeam ? ` · ${roleInTeam}` : ""}
              </li>
            ))}
          </ul>
        )}
      </Section>
      {can(user, "member.updateContact", scope) ? (
        <Section title="Contact details">
          <ContactForm member={member} />
        </Section>
      ) : (
        <Section title="Contact details">
          <p className="text-sm">
            {member.email} · {member.phone}
          </p>
        </Section>
      )}
      {can(user, "member.changeStatus", scope) ? (
        <Section title="Status">
          <StatusForm id={member.id} status={member.status} />
        </Section>
      ) : null}
      {can(user, "member.changeBranch", scope) ? (
        <Section title="Branch">
          <BranchForm
            id={member.id}
            branchId={member.branchId}
            branches={await listMemberBranches(ctx)}
          />
        </Section>
      ) : null}
    </>
  );
}
