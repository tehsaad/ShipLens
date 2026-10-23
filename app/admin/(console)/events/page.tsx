import type { Metadata } from "next";
import Link from "next/link";
import { Badge, Cell, DataTable, PageHeader, Section } from "@/components/admin/page";
import { requirePermission } from "@/lib/auth/session";
import { serviceContext } from "@/lib/server-action";
import { listEventBranches, listEvents } from "@/lib/services/events";
import { EventForm } from "./forms";

export const metadata: Metadata = { title: "Events" };

const when = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Karachi",
  dateStyle: "medium",
  timeStyle: "short",
});

export default async function EventsPage() {
  const user = await requirePermission("event.read");
  const ctx = await serviceContext(user);
  const [events, branches] = await Promise.all([listEvents(ctx), listEventBranches(ctx)]);

  return (
    <>
      <PageHeader
        title="Events"
        description="Only published events appear on the public Events page."
      />
      <Section title="New event">
        <EventForm branches={branches} />
      </Section>
      <DataTable
        head={["Starts", "Title", "Location", "Branch", "Status"]}
        empty={events.length === 0}
      >
        {events.map((event) => (
          <tr key={event.id}>
            <Cell>{when.format(event.startsAt)}</Cell>
            <Cell>
              <Link href={`/admin/events/${event.id}`} className="text-primary underline">
                {event.titleEn}
              </Link>{" "}
              {event.titleUr ? null : <Badge tone="warn">No Urdu title</Badge>}
            </Cell>
            <Cell>{event.location}</Cell>
            <Cell>{event.branch?.code ?? "Head office"}</Cell>
            <Cell>
              {event.status === "PUBLISHED" ? (
                <Badge tone="good">Published</Badge>
              ) : (
                <Badge>Draft</Badge>
              )}
            </Cell>
          </tr>
        ))}
      </DataTable>
    </>
  );
}
