import type { Metadata } from "next";
import { Building2, ClipboardList, Coins, Inbox, Send, Users } from "lucide-react";
import Link from "next/link";
import { Reveal } from "@/components/admin/animate";
import { DashboardHero } from "@/components/admin/dashboard-hero";
import { Cell, DataTable, ExportLink, Section } from "@/components/admin/page";
import { StatCard } from "@/components/admin/stat-card";
import { CollectionTrend, NewMemberTrend } from "@/components/admin/trend-charts";
import { requireUser } from "@/lib/auth/session";
import { formatBusinessDate } from "@/lib/dates";
import { ROLE_LABELS } from "@/lib/labels";
import { formatPkr } from "@/lib/money";
import { can } from "@/lib/permissions";
import { serviceContext } from "@/lib/server-action";
import { getDashboard, UNROUTED_LIST_SIZE } from "@/lib/services/dashboard";

export const metadata: Metadata = { title: "Dashboard" };

export default async function AdminHomePage() {
  const user = await requireUser();
  const roleLabel = ROLE_LABELS[user.role];

  if (!can(user, "dashboard.view")) {
    return (
      <DashboardHero
        name={user.name}
        role={user.role}
        roleLabel={roleLabel}
        scope="Use the menu above to manage the records your role covers."
      />
    );
  }

  const dashboard = await getDashboard(await serviceContext(user));
  const { finance, membership } = dashboard;
  const scope = `${
    dashboard.branchScope ? `Branch ${dashboard.branchScope.code}` : "All branches"
  } · as of ${dashboard.asOf} (Asia/Karachi)`;

  return (
    <>
      <DashboardHero name={user.name} role={user.role} roleLabel={roleLabel} scope={scope} />

      <Reveal pop className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {finance ? (
          <>
            <StatCard
              label="Collections this month"
              value={Number(finance.collectionsThisMonth.total)}
              kind="pkr"
              detail={`${finance.collectionsThisMonth.count} entries dated this month`}
              icon={Coins}
              tone="teal"
            />
            <StatCard
              label="Unrouted collections"
              value={Number(finance.unrouted.total)}
              kind="pkr"
              detail={`${finance.unrouted.count} entries not yet routed to the main account`}
              icon={Send}
              tone="amber"
            />
            <StatCard
              label="Reports awaiting review"
              value={finance.reportsAwaitingReview.count}
              detail={
                finance.reportsAwaitingReview.oldestSubmittedAt
                  ? `Oldest submitted ${formatBusinessDate(finance.reportsAwaitingReview.oldestSubmittedAt)}`
                  : "None waiting"
              }
              icon={ClipboardList}
              tone="amber"
            />
          </>
        ) : null}
        {dashboard.activeBranches !== null ? (
          <StatCard
            label="Active branches"
            value={dashboard.activeBranches}
            icon={Building2}
            tone="teal"
          />
        ) : null}
        {membership ? (
          <>
            <StatCard
              label="Active members"
              value={membership.activeMembers}
              icon={Users}
              tone="emerald"
            />
            <StatCard
              label="Pending applications"
              value={membership.pendingApplications}
              detail="Status new"
              icon={Inbox}
              tone="marigold"
            />
          </>
        ) : null}
      </Reveal>

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
            <div className="flex flex-wrap items-center gap-4 text-sm">
              {finance.unrouted.count > finance.unroutedList.length ? (
                <Link href="/admin/collections?routed=no" className="text-primary underline">
                  See all {finance.unrouted.count} unrouted collections
                </Link>
              ) : null}
              {can(user, "dashboard.exportUnrouted") && finance.unrouted.count > 0 ? (
                <ExportLink href="/admin/export/unrouted">Download all as CSV</ExportLink>
              ) : null}
            </div>
          </Section>
        </>
      ) : null}
    </>
  );
}
