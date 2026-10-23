import type { Metadata } from "next";
import { Badge, PageHeader, Section } from "@/components/admin/page";
import { requirePermission } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { loadOrNotFound, routeId, serviceContext } from "@/lib/server-action";
import { getEvent, listEventBranches } from "@/lib/services/events";
import { toKarachiInput } from "@/lib/validation/events";
import { EventForm, PublishEventForm } from "../forms";

export const metadata: Metadata = { title: "Event" };

export default async function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission("event.read");
  const ctx = await serviceContext(user);
  const event = await loadOrNotFound(async () => getEvent(ctx, await routeId(params)));
  const published = event.status === "PUBLISHED";

  return (
    <>
      <PageHeader
        title={event.titleEn}
        description={published ? <Badge tone="good">Published</Badge> : <Badge>Draft</Badge>}
      />
      {can(user, "event.publish") ? (
        <Section title="Publishing">
          <PublishEventForm id={event.id} published={published} />
        </Section>
      ) : null}
      {can(user, "event.update") ? (
        <Section title="Details">
          <EventForm
            branches={await listEventBranches(ctx)}
            event={{
              id: event.id,
              titleEn: event.titleEn,
              titleUr: event.titleUr,
              startsAt: toKarachiInput(event.startsAt),
              endsAt: toKarachiInput(event.endsAt),
              location: event.location,
              branchId: event.branchId,
            }}
          />
        </Section>
      ) : null}
    </>
  );
}
