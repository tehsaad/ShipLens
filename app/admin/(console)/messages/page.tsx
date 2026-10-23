import type { Metadata } from "next";
import Link from "next/link";
import { Badge, Cell, DataTable, PageHeader, Pagination } from "@/components/admin/page";
import { Button } from "@/components/ui/button";
import { requirePermission } from "@/lib/auth/session";
import { serviceContext } from "@/lib/server-action";
import { listContactMessages } from "@/lib/services/contact";
import { pageSchema } from "@/lib/validation/common";
import { markHandledAction } from "./actions";

export const metadata: Metadata = { title: "Messages" };

const when = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Karachi",
  dateStyle: "medium",
  timeStyle: "short",
});

export default async function MessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ show?: string; page?: string }>;
}) {
  const user = await requirePermission("contactMessage.read");
  const search = await searchParams;
  const handled = search.show === "handled" ? true : search.show === "all" ? null : false;
  const page = pageSchema.parse(search.page);
  const messages = await listContactMessages(await serviceContext(user), { handled, page });

  return (
    <>
      <PageHeader
        title="Contact messages"
        description="Messages from the public contact form. Reply by email, then mark them handled."
      />
      <nav className="flex gap-4 text-sm" aria-label="Filter">
        <Link
          href="/admin/messages"
          className="underline"
          aria-current={handled === false ? "page" : undefined}
        >
          Open
        </Link>
        <Link
          href="/admin/messages?show=handled"
          className="underline"
          aria-current={handled === true ? "page" : undefined}
        >
          Handled
        </Link>
        <Link
          href="/admin/messages?show=all"
          className="underline"
          aria-current={handled === null ? "page" : undefined}
        >
          All
        </Link>
      </nav>
      <DataTable
        head={["Received", "From", "Message", "Status"]}
        empty={messages.items.length === 0}
      >
        {messages.items.map((message) => (
          <tr key={message.id}>
            <Cell>{when.format(message.receivedAt)}</Cell>
            <Cell>
              {message.name}
              <br />
              <a href={`mailto:${message.email}`} className="text-primary underline">
                {message.email}
              </a>
            </Cell>
            <Cell className="max-w-md whitespace-pre-wrap">{message.message}</Cell>
            <Cell>
              {message.handledAt ? (
                <Badge tone="good">Handled by {message.handledBy?.name ?? "—"}</Badge>
              ) : (
                <form action={markHandledAction}>
                  <input type="hidden" name="id" value={message.id} />
                  <Button type="submit" size="sm" variant="outline">
                    Mark handled
                  </Button>
                </form>
              )}
            </Cell>
          </tr>
        ))}
      </DataTable>
      <Pagination
        page={messages.page}
        pageCount={messages.pageCount}
        total={messages.total}
        basePath="/admin/messages"
        params={{ show: search.show }}
      />
    </>
  );
}
