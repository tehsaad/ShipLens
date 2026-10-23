"use client";

import { Menu } from "lucide-react";
import { useState } from "react";
import { cn } from "cn";
import { Link, usePathname } from "@/i18n/navigation";

type Item = { href: string; label: string };

/** Main navigation: a row on wide screens, a toggled list on narrow ones. */
export function NavLinks({
  items,
  label,
  menuLabel,
}: {
  items: Item[];
  label: string;
  menuLabel: string;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const isCurrent = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
  return (
    <nav aria-label={label} className="order-last basis-full md:order-none md:basis-auto">
      <button
        type="button"
        className="inline-flex items-center gap-2 rounded-md px-2 py-1 text-sm md:hidden"
        aria-expanded={open}
        aria-controls="site-nav"
        onClick={() => setOpen((value) => !value)}
      >
        <Menu className="size-4" aria-hidden />
        {menuLabel}
      </button>
      <ul
        id="site-nav"
        className={cn(
          "flex-col gap-1 pt-2 md:flex md:flex-row md:gap-5 md:pt-0",
          open ? "flex" : "hidden",
        )}
      >
        {items.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={isCurrent(item.href) ? "page" : undefined}
              className="block rounded-md px-2 py-1 text-sm hover:text-primary aria-[current=page]:font-semibold aria-[current=page]:text-primary md:px-0"
              onClick={() => setOpen(false)}
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
