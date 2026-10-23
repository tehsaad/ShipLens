import type { Metadata } from "next";
import Link from "next/link";
import { Cell, DataTable, PageHeader, Section } from "@/components/admin/page";
import { Button } from "@/components/ui/button";
import { requirePermission } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { loadOrNotFound, routeId, serviceContext } from "@/lib/server-action";
import { getTeam, listTeamCandidates } from "@/lib/services/teams";
import { MemberStatusBadge } from "../../members/status-badge";
import { removeMemberAction } from "../actions";
import { AssignMemberForm, RenameTeamForm } from "../forms";

export const metadata: Metadata = { title: "Team" };

export default async function TeamPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission("team.read");
  const ctx = await serviceContext(user);
  const team = await loadOrNotFound(async () => getTeam(ctx, await routeId(params)));
  const scope = { branchId: team.branchId };
  const canAssign = can(user, "team.assignMembers", scope);
  const canReadMembers = can(user, "member.read", scope);

  return (
    <>
      <PageHeader title={team.name} description={`${team.branch.code} · ${team.branch.name}`} />
      <DataTable
        head={["Member", "Role in team", "Status", ...(canAssign ? [""] : [])]}
        empty={team.members.length === 0}
      >
        {team.members.map(({ member, roleInTeam }) => (
          <tr key={member.id}>
            <Cell>
              {canReadMembers ? (
                <Link href={`/admin/members/${member.id}`} className="text-primary underline">
                  {member.memberCode} · {member.fullName}
                </Link>
              ) : (
                `${member.memberCode} · ${member.fullName}`
              )}
            </Cell>
            <Cell>{roleInTeam ?? "—"}</Cell>
            <Cell>
              <MemberStatusBadge status={member.status} />
            </Cell>
            {canAssign ? (
              <Cell>
                <form action={removeMemberAction}>
                  <input type="hidden" name="id" value={team.id} />
                  <input type="hidden" name="memberId" value={member.id} />
                  <Button type="submit" size="sm" variant="outline">
                    Remove
                  </Button>
                </form>
              </Cell>
            ) : null}
          </tr>
        ))}
      </DataTable>
      {canAssign ? (
        <Section title="Add a member">
          <AssignMemberForm id={team.id} candidates={await listTeamCandidates(ctx, team.id)} />
        </Section>
      ) : null}
      {can(user, "team.update", scope) ? (
        <Section title="Name">
          <RenameTeamForm id={team.id} name={team.name} />
        </Section>
      ) : null}
    </>
  );
}
