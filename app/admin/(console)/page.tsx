import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/page";
import { requireUser } from "@/lib/auth/session";
import { ROLE_LABELS } from "@/lib/labels";

export const metadata: Metadata = { title: "Admin" };

export default async function AdminHomePage() {
  const user = await requireUser();

  return (
    <PageHeader
      title="Admin"
      description={`Signed in as ${user.name} (${ROLE_LABELS[user.role]}). Use the menu to manage the records your role covers. The dashboard is added in Phase 3.`}
    />
  );
}
