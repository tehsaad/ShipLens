import Link from "next/link";
import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/session";
import { ROLE_LABELS } from "@/lib/labels";
import { can, type Action } from "@/lib/permissions";
import { logout } from "../actions";

/**
 * Admin navigation; each link appears only when the role may use it (pages check again).
 * Labels come from messages/{en,ur}.json in the user's language (section 7.4).
 */
const NAV = [
  { href: "/admin/branches", key: "branches", action: "branch.read" },
  { href: "/admin/users", key: "users", action: "user.read" },
  { href: "/admin/applications", key: "applications", action: "application.read" },
  { href: "/admin/members", key: "members", action: "member.read" },
  { href: "/admin/teams", key: "teams", action: "team.read" },
  { href: "/admin/collections", key: "collections", action: "collection.read" },
  { href: "/admin/reports", key: "reports", action: "report.read" },
  { href: "/admin/content", key: "content", action: "content.read" },
  { href: "/admin/events", key: "events", action: "event.read" },
  { href: "/admin/messages", key: "messages", action: "contactMessage.read" },
] as const satisfies { href: string; key: string; action: Action }[];

export default async function ConsoleLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();
  const t = await getTranslations({ locale: user.locale, namespace: "admin.nav" });
  const links = NAV.filter((item) => can(user, item.action));

  return (
    <div className="min-h-svh">
      <header className="border-b">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Link href="/admin" className="font-semibold">
            {t("label")}
          </Link>
          <nav aria-label={t("label")} className="flex flex-wrap gap-4 text-sm">
            {links.map((item) => (
              <Link key={item.href} href={item.href} className="hover:underline">
                {t(item.key)}
              </Link>
            ))}
          </nav>
          <div className="text-muted-foreground ms-auto flex items-center gap-3 text-sm">
            <span>
              {user.name} · {ROLE_LABELS[user.role]}
            </span>
            <Link href="/admin/change-password" className="hover:underline">
              {t("password")}
            </Link>
            <form action={logout}>
              <Button type="submit" size="sm" variant="outline">
                {t("signOut")}
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto grid max-w-6xl gap-6 px-4 py-8">{children}</main>
    </div>
  );
}
