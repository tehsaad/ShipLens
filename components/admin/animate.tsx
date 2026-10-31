"use client";

import gsap from "gsap";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

// Runs before paint on the client, falls back to useEffect during SSR (no DOM to measure there).
const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

const intFmt = new Intl.NumberFormat("en-PK");
function format(value: number, kind: "int" | "pkr"): string {
  const n = intFmt.format(Math.round(value));
  return kind === "pkr" ? `PKR ${n}` : n;
}

/** Counts a number up from zero on mount. Shows the final value with no motion or no JS. */
export function CountUp({ value, kind = "int" }: { value: number; kind?: "int" | "pkr" }) {
  const [text, setText] = useState(() => format(value, kind));

  useIsoLayoutEffect(() => {
    if (prefersReducedMotion() || value === 0) return;
    const proxy = { n: 0 };
    setText(format(0, kind));
    const tween = gsap.to(proxy, {
      n: value,
      duration: 1.1,
      ease: "power2.out",
      onUpdate: () => setText(format(proxy.n, kind)),
    });
    return () => {
      tween.kill();
    };
  }, [value, kind]);

  return <span className="tabular-nums">{text}</span>;
}

/**
 * Reveals its direct children on mount with a small stagger. `pop` adds a gentle scale overshoot
 * (good for KPI cards, not data tables). Under reduced motion it does nothing — children are
 * already in their final state from the server render.
 */
export function Reveal({
  children,
  className,
  stagger = 0.06,
  y = 16,
  pop = false,
}: {
  children: React.ReactNode;
  className?: string;
  stagger?: number;
  y?: number;
  pop?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useIsoLayoutEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion() || el.children.length === 0) return;
    // fromTo (not from) so a re-run — React StrictMode mounts effects twice in dev — always
    // animates to the visible state instead of freezing children at opacity 0.
    const tween = gsap.fromTo(
      el.children,
      { opacity: 0, y, scale: pop ? 0.94 : 1 },
      {
        opacity: 1,
        y: 0,
        scale: 1,
        duration: 0.5,
        ease: pop ? "back.out(1.4)" : "power2.out",
        stagger: { each: stagger, from: "start" },
        clearProps: "opacity,transform",
      },
    );
    return () => {
      tween.kill();
    };
  }, []);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
