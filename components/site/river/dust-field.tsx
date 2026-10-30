"use client";

import { useEffect, useRef } from "react";

/**
 * A soft field of drifting "dust" motes, used behind the hero. Pure decoration: aria-hidden,
 * never interactive, and off entirely under reduced motion. It pauses itself whenever it
 * scrolls out of view, so nothing keeps animating behind the rest of the page.
 */
export function DustField({ count = 18, className = "" }: { count?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = ref.current;
    if (!host) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let cancelled = false;
    let cleanup: (() => void) | null = null;

    void (async () => {
      const { default: gsap } = await import("gsap");
      if (cancelled || !host) return;

      const motes: HTMLSpanElement[] = [];
      for (let i = 0; i < count; i++) {
        const mote = document.createElement("span");
        const size = 2 + Math.random() * 4;
        Object.assign(mote.style, {
          position: "absolute",
          top: `${Math.random() * 100}%`,
          left: `${Math.random() * 100}%`,
          width: `${size}px`,
          height: `${size}px`,
          borderRadius: "999px",
          background: i % 3 === 0 ? "var(--marigold)" : "var(--primary)",
          opacity: "0",
          pointerEvents: "none",
          filter: "blur(0.4px)",
        } as CSSStyleDeclaration);
        host.append(mote);
        motes.push(mote);
      }

      const tweens = motes.map((mote) =>
        gsap.to(mote, {
          y: `-=${40 + Math.random() * 70}`,
          x: `+=${Math.random() * 40 - 20}`,
          opacity: 0.35 + Math.random() * 0.35,
          duration: 4 + Math.random() * 6,
          delay: Math.random() * 4,
          repeat: -1,
          yoyo: true,
          ease: "sine.inOut",
        }),
      );

      // Only animate while the hero is on screen.
      const io = new IntersectionObserver(
        ([entry]) => {
          if (!entry) return;
          tweens.forEach((tw) => (entry.isIntersecting ? tw.resume() : tw.pause()));
        },
        { threshold: 0 },
      );
      io.observe(host);

      cleanup = () => {
        io.disconnect();
        tweens.forEach((tw) => tw.kill());
        motes.forEach((m) => m.remove());
      };
    })();

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [count]);

  return <div ref={ref} aria-hidden="true" className={`dust-field ${className}`} />;
}
