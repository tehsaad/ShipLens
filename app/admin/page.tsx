import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/session";
import { logout } from "./actions";

export const metadata: Metadata = { title: "Admin" };

const ROLE_LABELS = {
  SUPER_ADMIN: "Super Admin",
  FINANCE_REVIEWER: "Finance Reviewer",
  CONTENT_EDITOR: "Content Editor",
  BRANCH_LEAD: "Branch Lead",
  HR_LEAD: "HR Lead",
} as const;

export default async function AdminHomePage() {
  const user = await requireUser();

  return (
    <main className="mx-auto grid max-w-2xl gap-6 px-4 py-12">
      <header className="grid gap-1">
        <h1 className="text-2xl font-semibold">Admin</h1>
        <p className="text-muted-foreground">
          Signed in as {user.name} ({ROLE_LABELS[user.role]}).
        </p>
      </header>
      <p>Admin screens are added in later phases.</p>
      <div className="flex flex-wrap gap-3">
        <Button asChild variant="outline">
          <Link href="/admin/change-password">Change password</Link>
        </Button>
        <form action={logout}>
          <Button type="submit" variant="secondary">
            Sign out
          </Button>
        </form>
      </div>
    </main>
  );
}
