import type { Metadata } from "next";
import Link from "next/link";
import { Cell, DataTable, PageHeader, Section } from "@/components/admin/page";
import { CollectionTrend, NewMemberTrend } from "@/components/admin/trend-charts";
import { requireUser } from "@/lib/auth/session";
import { formatBusinessDate } from "@/lib/dates";
import { ROLE_LABELS } from "@/lib/labels";
import { formatPkr } from "@/lib/money";
import { can } from "@/lib/permissions";
import { serviceContext } from "@/lib/server-action";
import { getDashboard, UNROUTED_LIST_SIZE } from "@/lib/services/dashboard";

export const metadata: Metadata = { title: "Dashboard" };

function Kpi({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="rounded-xl border p-4">
      <dt className="text-muted-foreground text-sm">{label}</dt>
      <dd className="mt-1 text-2xl font-semibold tabular-nums">{value}</dd>
      {detail ? <dd className="text-muted-foreground mt-1 text-xs">{detail}</dd> : null}
    </div>
  );
}

export default async function AdminHomePage() {
  const user = await requireUser();
  if (!can(user, "dashboard.view")) {
    return (
      <PageHeader
        title="Admin"
        description={`Signed in as ${user.name} (${ROLE_LABELS[user.role]}). Use the menu to manage the records your role covers.`}
      />
    );
  }

  const dashboard = await getDashboard(await serviceContext(user));
  const { finance, membership } = dashboard;

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={`${dashboard.branchScope ? `Branch ${dashboard.branchScope.code}` : "All branches"} · as of ${dashboard.asOf} (Asia/Karachi)`}
      />
      <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {finance ? (
          <>
            <Kpi
              label="Collections this month"
              value={formatPkr(finance.collectionsThisMonth.total)}
              detail={`${finance.collectionsThisMonth.count} entries dated this month`}
            />
            <Kpi
              label="Unrouted collections"
              value={formatPkr(finance.unrouted.total)}
              detail={`${finance.unrouted.count} entries not yet routed to the main account`}
            />
            <Kpi
              label="Reports awaiting review"
              value={String(finance.reportsAwaitingReview.count)}
              detail={
                finance.reportsAwaitingReview.oldestSubmittedAt
                  ? `Oldest submitted ${formatBusinessDate(finance.reportsAwaitingReview.oldestSubmittedAt)}`
                  : "None waiting"
              }
            />
          </>
        ) : null}
        {dashboard.activeBranches !== null ? (
          <Kpi label="Active branches" value={String(dashboard.activeBranches)} />
        ) : null}
        {membership ? (
          <>
            <Kpi label="Active members" value={String(membership.activeMembers)} />
            <Kpi
              label="Pending applications"
              value={String(membership.pendingApplications)}
              detail="Status new"
            />
          </>
        ) : null}
      </dl>

      {finance ? (
        <Section title="Collections per month (last 12 months)">
          <CollectionTrend data={finance.collectionTrend} />
        </Section>
      ) : null}
      {membership ? (
        <Section title="New members per month (last 12 months)">
          <NewMemberTrend data={membership.newMemberTrend} />
        </Section>
      ) : null}

      {finance ? (
        <>
          <Section title="Overdue weekly reports">
            <p className="text-muted-foreground text-sm">
              Completed weeks since each active branch opened with no submitted or approved report.
            </p>
            <DataTable
              head={["Branch", "Overdue weeks", "Oldest missing week"]}
              empty={finance.overdueReports.length === 0}
            >
              {finance.overdueReports.map((row) => (
                <tr key={row.branchId}>
                  <Cell>
                    {row.code} · {row.name}
                  </Cell>
                  <Cell className="tabular-nums">{row.count}</Cell>
                  <Cell>{row.oldestWeek}</Cell>
                </tr>
              ))}
            </DataTable>
          </Section>
          <Section title={`Unrouted collections (oldest ${UNROUTED_LIST_SIZE})`}>
            <DataTable
              head={["Date", "Branch", "Amount"]}
              empty={finance.unroutedList.length === 0}
            >
              {finance.unroutedList.map((row) => (
                <tr key={row.id}>
                  <Cell>
                    <Link href={`/admin/collections/${row.id}`} className="text-primary underline">
                      {row.collectedOn}
                    </Link>
                  </Cell>
                  <Cell>{row.branchCode}</Cell>
                  <Cell className="tabular-nums">{formatPkr(row.amount)}</Cell>
                </tr>
              ))}
            </DataTable>
            {finance.unrouted.count > finance.unroutedList.length ? (
              <p className="text-sm">
                <Link href="/admin/collections?routed=no" className="text-primary underline">
                  See all {finance.unrouted.count} unrouted collections
                </Link>
              </p>
            ) : null}
          </Section>
        </>
      ) : null}
    </>
  );
}
