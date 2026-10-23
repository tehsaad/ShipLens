import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader, Section } from "@/components/admin/page";
import { requirePermission } from "@/lib/auth/session";
import { businessToday, formatBusinessDate, formatDateOnly } from "@/lib/dates";
import { AVAILABILITY_LABELS } from "@/lib/labels";
import { can } from "@/lib/permissions";
import { loadOrNotFound, routeId, serviceContext } from "@/lib/server-action";
import { getApplication, listMemberBranches } from "@/lib/services/applications";
import { AcceptForm, DeclineForm } from "../forms";
import { ApplicationStatusBadge } from "../status-badge";

export const metadata: Metadata = { title: "Application" };

export default async function ApplicationPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission("application.read");
  const ctx = await serviceContext(user);
  const application = await loadOrNotFound(async () => getApplication(ctx, await routeId(params)));
  const canDecide = application.status === "NEW" && can(user, "application.decide");

  const details: [string, string][] = [
    ["Email", application.email],
    ["Phone", application.phone],
    [
      "Preferred branch",
      `${application.preferredBranch.code} · ${application.preferredBranch.name}`,
    ],
    ["Availability", AVAILABILITY_LABELS[application.availability]],
    ["Submitted", formatBusinessDate(application.createdAt)],
    ["Consent given", application.consentGiven ? "Yes" : "No"],
  ];

  return (
    <>
      <PageHeader
        title={application.fullName}
        description={<ApplicationStatusBadge status={application.status} />}
      />
      <Section title="Application">
        <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[max-content_1fr]">
          {details.map(([label, value]) => (
            <div key={label} className="contents">
              <dt className="text-muted-foreground">{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
          <dt className="text-muted-foreground">Skills</dt>
          <dd className="whitespace-pre-wrap">{application.skills || "—"}</dd>
          <dt className="text-muted-foreground">Motivation</dt>
          <dd className="whitespace-pre-wrap">{application.motivation}</dd>
        </dl>
      </Section>
      {application.status !== "NEW" ? (
        <Section title="Decision">
          <p className="text-sm">
            {application.status === "ACCEPTED" ? "Accepted" : "Declined"} by{" "}
            {application.decidedBy?.name ?? "—"} on{" "}
            {application.decidedAt ? formatBusinessDate(application.decidedAt) : "—"}.
          </p>
          {application.member ? (
            <p className="text-sm">
              Member:{" "}
              <Link
                href={`/admin/members/${application.member.id}`}
                className="text-primary underline"
              >
                {application.member.memberCode}
              </Link>
            </p>
          ) : null}
          {application.declineReason ? (
            <p className="text-sm">Internal reason: {application.declineReason}</p>
          ) : null}
        </Section>
      ) : null}
      {canDecide ? (
        <>
          <Section title="Accept">
            <AcceptForm
              id={application.id}
              preferredBranchId={application.preferredBranchId}
              branches={await listMemberBranches(ctx)}
              today={formatDateOnly(businessToday())}
            />
          </Section>
          <Section title="Decline">
            <DeclineForm id={application.id} />
          </Section>
        </>
      ) : null}
    </>
  );
}
