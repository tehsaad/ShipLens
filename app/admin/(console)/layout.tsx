import Link from "next/link";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/session";
import { ROLE_LABELS } from "@/lib/labels";
import { can, type Action } from "@/lib/permissions";
import { logout } from "../actions";

/** Admin navigation; each link appears only when the role may use it (pages check again). */
const NAV: { href: string; label: string; action: Action }[] = [
  { href: "/admin/branches", label: "Branches", action: "branch.read" },
  { href: "/admin/users", label: "Users", action: "user.read" },
  { href: "/admin/applications", label: "Applications", action: "application.read" },
  { href: "/admin/members", label: "Members", action: "member.read" },
  { href: "/admin/teams", label: "Teams", action: "team.read" },
  { href: "/admin/collections", label: "Collections", action: "collection.read" },
  { href: "/admin/reports", label: "Reports", action: "report.read" },
];

export default async function ConsoleLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();
  const links = NAV.filter((item) => can(user, item.action));

  return (
    <div className="min-h-svh">
      <header className="border-b">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Link href="/admin" className="font-semibold">
            Admin
          </Link>
          <nav aria-label="Admin" className="flex flex-wrap gap-4 text-sm">
            {links.map((item) => (
              <Link key={item.href} href={item.href} className="hover:underline">
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="text-muted-foreground ms-auto flex items-center gap-3 text-sm">
            <span>
              {user.name} · {ROLE_LABELS[user.role]}
            </span>
            <Link href="/admin/change-password" className="hover:underline">
              Password
            </Link>
            <form action={logout}>
              <Button type="submit" size="sm" variant="outline">
                Sign out
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto grid max-w-6xl gap-6 px-4 py-8">{children}</main>
    </div>
  );
}
