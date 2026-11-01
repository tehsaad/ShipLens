"use client";

import {
  Award,
  Building2,
  CalendarDays,
  ClipboardList,
  Coins,
  Contact,
  FileText,
  LayoutDashboard,
  type LucideIcon,
  Mail,
  Menu,
  Newspaper,
  ScrollText,
  Users,
  UsersRound,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode, useState } from "react";

export type NavItem = { href: string; label: string; icon: string };

const ICONS: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard,
  branches: Building2,
  users: Users,
  applications: ClipboardList,
  members: Contact,
  teams: UsersRound,
  collections: Coins,
  reports: FileText,
  content: Newspaper,
  events: CalendarDays,
  results: Award,
  messages: Mail,
  audit: ScrollText,
};

function isActive(pathname: string, href: string): boolean {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * The admin console shell: a branded left sidebar (a slide-in drawer on small
 * screens) plus a sticky top bar. A client leaf so it can track the active route
 * and the mobile drawer — no inline script, so the admin's nonce CSP is honoured.
 * Server-rendered children (the pages) pass straight through.
 */
export function AdminShell({
  brand,
  links,
  user,
  passwordHref,
  passwordLabel,
  signOut,
  children,
}: {
  brand: string;
  links: NavItem[];
  user: { name: string; role: string };
  passwordHref: string;
  passwordLabel: string;
  signOut: ReactNode;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <div className="admin-shell">
      {/* Mobile overlay */}
      <button
        type="button"
        aria-label="Close menu"
        tabIndex={open ? 0 : -1}
        className={`admin-overlay ${open ? "is-open" : ""}`}
        onClick={() => setOpen(false)}
      />

      <aside className={`admin-sidebar ${open ? "is-open" : ""}`} aria-label={brand}>
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <Link
            href="/admin"
            onClick={close}
            className="text-lg font-bold tracking-tight text-white"
          >
            {brand}
          </Link>
          <button
            type="button"
            aria-label="Close menu"
            className="admin-icon-btn lg:hidden"
            onClick={() => setOpen(false)}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav aria-label={brand} className="flex-1 overflow-y-auto px-3 py-2">
          <ul className="grid gap-1">
            {links.map((item) => {
              const Icon = ICONS[item.icon] ?? LayoutDashboard;
              const active = isActive(pathname, item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    onClick={close}
                    className={`admin-nav-link ${active ? "is-active" : ""}`}
                  >
                    <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                    <span>{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="admin-sidebar-foot grid gap-2 px-4 pt-3 pb-5">
          <p className="px-1 text-sm font-medium text-white">{user.name}</p>
          <p className="px-1 text-xs text-white/60">{user.role}</p>
          <div className="mt-1 flex items-center gap-2">
            <Link href={passwordHref} onClick={close} className="admin-foot-link">
              {passwordLabel}
            </Link>
            {signOut}
          </div>
        </div>
      </aside>

      <div className="admin-main">
        <header className="admin-topbar">
          <button
            type="button"
            aria-label="Open menu"
            aria-expanded={open}
            className="admin-icon-btn lg:hidden"
            onClick={() => setOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </button>
          <Link href="/admin" className="text-primary font-bold lg:hidden">
            {brand}
          </Link>
          <span className="text-muted-foreground ms-auto hidden text-sm sm:inline">
            {user.name} · {user.role}
          </span>
        </header>
        <main className="mx-auto grid w-full max-w-7xl gap-6 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
