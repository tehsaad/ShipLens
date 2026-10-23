import type { Metadata } from "next";
import Link from "next/link";
import { Badge, Cell, DataTable, PageHeader, Section } from "@/components/admin/page";
import { requirePermission } from "@/lib/auth/session";
import { businessToday, formatBusinessDate, formatDateOnly } from "@/lib/dates";
import { PURPOSE_LABELS } from "@/lib/labels";
import { formatPkr } from "@/lib/money";
import { can } from "@/lib/permissions";
import { loadOrNotFound, routeId, serviceContext } from "@/lib/server-action";
import { getCollection, LOCK_MESSAGES } from "@/lib/services/collections";
import { CorrectionForm, EditCollectionForm, RouteForm } from "../forms";

export const metadata: Metadata = { title: "Collection" };

const dateTime = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Karachi",
  dateStyle: "medium",
  timeStyle: "short",
});

export default async function CollectionPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission("collection.read");
  const ctx = await serviceContext(user);
  const row = await loadOrNotFound(async () => getCollection(ctx, await routeId(params)));
  const scope = { branchId: row.branchId };
  const isCorrection = row.correctsCollectionId !== null;
  const today = formatDateOnly(businessToday());

  const details: [string, React.ReactNode][] = [
    ["Branch", row.branch.code],
    ["Amount", formatPkr(row.amount)],
    ["Collected on", formatDateOnly(row.collectedOn)],
    ["Purpose", PURPOSE_LABELS[row.purpose]],
    ["Description", row.description ?? "—"],
    ["Entered by", `${row.enteredBy.name} on ${formatBusinessDate(row.createdAt)}`],
    [
      "Routing",
      row.routedAt
        ? `Routed ${dateTime.format(row.routedAt)} by ${row.routedBy?.name ?? "—"} (ref. ${row.routingReference})`
        : "Not routed yet",
    ],
  ];
  if (isCorrection) {
    details.push(["Reason", row.correctionNote ?? "—"]);
    details.push([
      "Corrects",
      row.corrects ? (
        <Link href={`/admin/collections/${row.corrects.id}`} className="text-primary underline">
          {formatPkr(row.corrects.amount)} on {formatDateOnly(row.corrects.collectedOn)}
        </Link>
      ) : (
        "—"
      ),
    ]);
  }
  if (row.netAmount !== null && row.corrections.length > 0) {
    details.push(["Net after corrections", formatPkr(row.netAmount)]);
  }

  return (
    <>
      <PageHeader
        title={`${isCorrection ? "Correction" : "Collection"} · ${formatPkr(row.amount)}`}
        description={
          row.lockReason ? (
            <Badge tone="neutral">{LOCK_MESSAGES[row.lockReason]}</Badge>
          ) : (
            <Badge tone="good">Editable until {dateTime.format(row.lockedAt)}</Badge>
          )
        }
      />
      <Section title="Details">
        <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[max-content_1fr]">
          {details.map(([label, value]) => (
            <div key={label} className="contents">
              <dt className="text-muted-foreground">{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </Section>
      {row.corrections.length > 0 ? (
        <Section title="Corrections">
          <DataTable head={["Recorded", "Amount", "Reason"]}>
            {row.corrections.map((correction) => (
              <tr key={correction.id}>
                <Cell>
                  <Link
                    href={`/admin/collections/${correction.id}`}
                    className="text-primary underline"
                  >
                    {formatDateOnly(correction.collectedOn)}
                  </Link>
                </Cell>
                <Cell className="tabular-nums">{formatPkr(correction.amount)}</Cell>
                <Cell>{correction.correctionNote}</Cell>
              </tr>
            ))}
          </DataTable>
        </Section>
      ) : null}
      {!row.lockReason && can(user, "collection.update", scope) ? (
        <Section title="Edit">
          <EditCollectionForm
            id={row.id}
            today={today}
            isCorrection={isCorrection}
            values={{
              amount: row.amount.toFixed(2),
              collectedOn: formatDateOnly(row.collectedOn),
              purpose: row.purpose,
              description: row.description,
              correctionNote: row.correctionNote,
            }}
          />
        </Section>
      ) : null}
      {!isCorrection && can(user, "collection.correct", scope) ? (
        <Section title="Record a correction">
          <p className="text-muted-foreground text-sm">
            A correction is a new entry dated today that adjusts this one. The total can never go
            below zero.
          </p>
          <CorrectionForm id={row.id} />
        </Section>
      ) : null}
      {!row.routedAt && can(user, "collection.route", scope) ? (
        <Section title="Route to the main account">
          <RouteForm id={row.id} />
        </Section>
      ) : null}
    </>
  );
}
