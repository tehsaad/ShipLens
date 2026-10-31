"use client";

import gsap from "gsap";
import { Building2, FileText, LineChart, type LucideIcon, ShieldCheck, Users } from "lucide-react";
import { useEffect, useLayoutEffect, useRef } from "react";

const useIso = typeof window !== "undefined" ? useLayoutEffect : useEffect;

const ROLE_ICON: Record<string, LucideIcon> = {
  SUPER_ADMIN: ShieldCheck,
  FINANCE_REVIEWER: LineChart,
  HR_LEAD: Users,
  CONTENT_EDITOR: FileText,
  BRANCH_LEAD: Building2,
};

/** The dashboard greeting: a role emblem that assembles on entry, plus the branch/date scope. */
export function DashboardHero({
  name,
  role,
  roleLabel,
  scope,
}: {
  name: string;
  role: string;
  roleLabel: string;
  scope: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const orbRef = useRef<HTMLDivElement>(null);
  const Icon = ROLE_ICON[role] ?? ShieldCheck;
  const firstName = name.split(" ")[0] ?? name;

  useIso(() => {
    const root = rootRef.current;
    if (!root || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // fromTo (not from) stays correct when React StrictMode re-runs the effect in dev.
    const tl = gsap.timeline();
    tl.fromTo(
      root.querySelectorAll("[data-hero]"),
      { opacity: 0, y: 14 },
      {
        opacity: 1,
        y: 0,
        duration: 0.5,
        stagger: 0.08,
        ease: "power2.out",
        clearProps: "opacity,transform",
      },
    );
    if (orbRef.current) {
      tl.fromTo(
        orbRef.current,
        { scale: 0, rotate: -140, opacity: 0 },
        {
          scale: 1,
          rotate: 0,
          opacity: 1,
          duration: 0.75,
          ease: "back.out(1.6)",
          clearProps: "transform,opacity",
        },
        0.05,
      );
    }
    return () => {
      tl.kill();
    };
  }, []);

  return (
    <div
      ref={rootRef}
      className="surface relative flex items-center justify-between gap-6 overflow-hidden p-6 sm:p-7"
    >
      <div className="grid gap-2">
        <p data-hero className="text-primary text-xs font-semibold tracking-widest uppercase">
          {roleLabel}
        </p>
        <h1 data-hero className="text-2xl font-bold sm:text-3xl">
          Welcome back, {firstName}
        </h1>
        <p data-hero className="text-muted-foreground text-sm">
          {scope}
        </p>
      </div>
      <div className="orb-wrap relative hidden h-24 w-24 shrink-0 sm:block" aria-hidden="true">
        <div ref={orbRef} className="hero-orb h-24 w-24" />
        <span className="absolute inset-0 grid place-items-center">
          <span className="bg-card text-primary grid h-14 w-14 place-items-center rounded-full border shadow-sm">
            <Icon className="h-6 w-6" />
          </span>
        </span>
      </div>
    </div>
  );
}
