import type { Metadata } from "next";
import Link from "next/link";
import { Badge, Cell, DataTable, PageHeader, Section } from "@/components/admin/page";
import { requirePermission } from "@/lib/auth/session";
import { addDays, businessToday, formatDateOnly } from "@/lib/dates";
import { PURPOSE_LABELS, REPORT_STATUS_LABELS } from "@/lib/labels";
import { formatPkr } from "@/lib/money";
import { can } from "@/lib/permissions";
import { notesEditable, submissionFor, weekIsComplete } from "@/lib/rules/report";
import { loadOrNotFound, routeId, serviceContext } from "@/lib/server-action";
import { getReport } from "@/lib/services/reports";
import { NotesForm, ReviewForms, SubmitForm } from "../forms";
import { ReportStatusBadge } from "../status-badge";

export const metadata: Metadata = { title: "Weekly report" };

const dateTime = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Karachi",
  dateStyle: "medium",
  timeStyle: "short",
});

const ACTION_LABELS: Record<string, string> = {
  "report.create": "Draft opened",
  "report.updateNotes": "Notes changed",
  "report.submit": "Submitted",
  "report.resubmit": "Resubmitted",
  "report.approve": "Approved",
  "report.return": "Returned",
};

function statusLabel(status: string | null): string {
  return status
    ? (REPORT_STATUS_LABELS[status as keyof typeof REPORT_STATUS_LABELS] ?? status)
    : "—";
}

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission("report.read");
  const ctx = await serviceContext(user);
  const report = await loadOrNotFound(async () => getReport(ctx, await routeId(params)));
  const scope = { branchId: report.branchId };
  const versioned = { id: report.id, version: report.version };
  const submission = submissionFor(report.status);
  const complete = weekIsComplete(report.weekStart, businessToday());
  const weekEnd = addDays(report.weekStart, 6);

  const totals: [string, string][] = [
    ["Collections (net)", formatPkr(report.totals.collectionsTotal)],
    ["Collection entries", String(report.totals.collectionsCount)],
    ["New members", String(report.totals.newMembers)],
    ["Active members", String(report.totals.activeMembers)],
  ];

  return (
    <>
      <PageHeader
        title={`${report.branch.code} · week of ${formatDateOnly(report.weekStart)}`}
        description={
          <>
            {formatDateOnly(report.weekStart)} – {formatDateOnly(weekEnd)} ·{" "}
            <ReportStatusBadge status={report.status} /> · version {report.version}
          </>
        }
      />
      <Section
        title={
          report.totalsLive ? "Totals (live until submitted)" : "Totals (frozen at submission)"
        }
      >
        <dl className="grid gap-4 sm:grid-cols-4">
          {totals.map(([label, value]) => (
            <div key={label} className="rounded-lg border p-3">
              <dt className="text-muted-foreground text-xs">{label}</dt>
              <dd className="text-lg font-semibold tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
        {report.reviewComment ? (
          <p className="text-sm">
            <span className="text-muted-foreground">Reviewer comment:</span> {report.reviewComment}
          </p>
        ) : null}
        {report.leadNotes && !(notesEditable(report.status) && can(user, "report.draft", scope)) ? (
          <p className="text-sm">
            <span className="text-muted-foreground">Branch Lead notes:</span> {report.leadNotes}
          </p>
        ) : null}
      </Section>

      {submission && can(user, "report.submit", scope) ? (
        <Section title={submission === "submit" ? "Submit for review" : "Resubmit for review"}>
          <NotesForm report={versioned} notes={report.leadNotes} />
          {complete ? (
            <SubmitForm
              report={versioned}
              label={submission === "submit" ? "Submit report" : "Resubmit report"}
            />
          ) : (
            <p className="text-muted-foreground text-sm">
              This week ends on {formatDateOnly(weekEnd)}. It can be submitted from the following
              Monday.
            </p>
          )}
        </Section>
      ) : null}

      {report.status === "SUBMITTED" && can(user, "report.approve", scope) ? (
        <Section title="Review">
          <ReviewForms report={versioned} />
        </Section>
      ) : null}

      <Section title="Collections in this week">
        <DataTable
          head={["Date", "Amount", "Purpose", "Description", "Routed"]}
          empty={report.collections.length === 0}
        >
          {report.collections.map((row) => (
            <tr key={row.id}>
              <Cell>
                {can(user, "collection.read", scope) ? (
                  <Link href={`/admin/collections/${row.id}`} className="text-primary underline">
                    {formatDateOnly(row.collectedOn)}
                  </Link>
                ) : (
                  formatDateOnly(row.collectedOn)
                )}
              </Cell>
              <Cell className="tabular-nums">
                {formatPkr(row.amount)}{" "}
                {row.correctsCollectionId ? <Badge tone="warn">Correction</Badge> : null}
              </Cell>
              <Cell>{PURPOSE_LABELS[row.purpose as keyof typeof PURPOSE_LABELS]}</Cell>
              <Cell>{row.description ?? "—"}</Cell>
              <Cell>{row.routedAt ? "Yes" : "No"}</Cell>
            </tr>
          ))}
        </DataTable>
      </Section>

      <Section title="History">
        <DataTable
          head={["When", "Step", "By", "From", "To", "Version", "Comment"]}
          empty={report.history.length === 0}
        >
          {report.history.map((entry, index) => (
            <tr key={index}>
              <Cell>{dateTime.format(entry.at)}</Cell>
              <Cell>{ACTION_LABELS[entry.action] ?? entry.action}</Cell>
              <Cell>{entry.actor ?? "—"}</Cell>
              <Cell>{statusLabel(entry.from)}</Cell>
              <Cell>{statusLabel(entry.to)}</Cell>
              <Cell>{entry.version ?? "—"}</Cell>
              <Cell>{entry.comment ?? "—"}</Cell>
            </tr>
          ))}
        </DataTable>
      </Section>
    </>
  );
}
