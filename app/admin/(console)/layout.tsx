import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { AdminShell, type NavItem } from "@/components/admin/admin-shell";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/session";
import { ROLE_LABELS } from "@/lib/labels";
import { type Action, can } from "@/lib/permissions";
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
  { href: "/admin/results", key: "results", action: "result.read" },
  { href: "/admin/messages", key: "messages", action: "contactMessage.read" },
  { href: "/admin/audit", key: "audit", action: "audit.read" },
] as const satisfies { href: string; key: string; action: Action }[];

export default async function ConsoleLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();
  const t = await getTranslations({ locale: user.locale, namespace: "admin.nav" });

  // Dashboard is open to every signed-in user; the rest are gated by role.
  const links: NavItem[] = [
    { href: "/admin", label: t("dashboard"), icon: "dashboard" },
    ...NAV.filter((item) => can(user, item.action)).map((item) => ({
      href: item.href,
      label: t(item.key),
      icon: item.key,
    })),
  ];

  return (
    <AdminShell
      brand={t("label")}
      links={links}
      user={{ name: user.name, role: ROLE_LABELS[user.role] }}
      passwordHref="/admin/change-password"
      passwordLabel={t("password")}
      signOut={
        <form action={logout} className="flex-1">
          <Button type="submit" size="sm" variant="outline" className="w-full">
            {t("signOut")}
          </Button>
        </form>
      }
    >
      {children}
    </AdminShell>
  );
}
