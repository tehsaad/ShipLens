"use client";

import { type CSSProperties, useEffect, useRef } from "react";

type Item = { title: string; body: string };

// Colourful top accent per card: a saturated line, with a matching pastel chip.
const ACCENT_LINE = ["#38bdf8", "#34d399", "#fb7185", "#f59e0b", "#a78bfa"];
const ACCENT_CHIP = [
  "var(--fill-sky)",
  "var(--fill-leaf)",
  "var(--fill-coral)",
  "var(--fill-amber)",
  "var(--fill-lilac)",
];

/**
 * A row of cards that flows sideways as the visitor scrolls past it — the horizontal echo of
 * the river's downward current. The motion is tied to scroll (it never loops on its own), and
 * under reduced motion the row simply becomes a normal horizontally scrollable strip.
 *
 * The card text is real, translated content rendered on the server; only the sideways drift is
 * added here on the client.
 */
export function FlowingRow({ items }: { items: Item[] }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    const track = trackRef.current;
    if (!wrap || !track) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let cancelled = false;
    let cleanup: (() => void) | null = null;

    void (async () => {
      const [{ default: gsap }, { ScrollTrigger }] = await Promise.all([
        import("gsap"),
        import("gsap/ScrollTrigger"),
      ]);
      if (cancelled || !wrap || !track) return;
      gsap.registerPlugin(ScrollTrigger);

      // The strip no longer needs to scroll on its own, so hide the overflow affordance.
      wrap.style.overflowX = "hidden";

      const tween = gsap.fromTo(
        track,
        { x: () => Math.min(0, wrap.clientWidth - track.scrollWidth) * 0.12 },
        {
          x: () => Math.min(0, wrap.clientWidth - track.scrollWidth),
          ease: "none",
          scrollTrigger: {
            trigger: wrap,
            start: "top bottom",
            end: "bottom top",
            scrub: 0.6,
            invalidateOnRefresh: true,
          },
        },
      );

      cleanup = () => {
        tween.scrollTrigger?.kill();
        tween.kill();
      };
    })();

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [items.length]);

  return (
    <div
      ref={wrapRef}
      className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      <div ref={trackRef} className="flex w-max gap-4 pb-2">
        {items.map((item, i) => (
          <article
            key={i}
            className="card-surface accent-bar is-interactive w-64 shrink-0 p-5"
            style={{ "--accent": ACCENT_LINE[i % ACCENT_LINE.length] } as CSSProperties}
            aria-hidden="false"
          >
            <span
              className="eyebrow eyebrow-chip"
              style={{ "--chip": ACCENT_CHIP[i % ACCENT_CHIP.length] } as CSSProperties}
              aria-hidden="true"
            >
              {String(i + 1).padStart(2, "0")}
            </span>
            <h3 className="mt-2 text-lg font-semibold">{item.title}</h3>
            <p className="text-muted-foreground mt-1 text-sm text-pretty">{item.body}</p>
          </article>
        ))}
      </div>
    </div>
  );
}
