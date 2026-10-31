"use client";

import { useEffect, useRef } from "react";

type Point = { x: number; y: number };

const MOBILE_MAX = 768;
const NODE_GAP = 30;

/**
 * The "river": a winding S-curve drawn behind the home page's milestone cards. As the visitor
 * scrolls, the river draws itself and a marker travels down it, arriving at each stop in turn.
 *
 * Pure decoration layered over server-rendered content. It reads the cards already in the page
 * (`[data-river-card]`) and places each stop in the central gutter beside its card, so node
 * positions follow the real layout — which makes right-to-left work with no special-casing.
 * Under reduced motion it paints the river once and never moves it; on narrow screens it drops
 * the river and just reveals the cards. If the script never runs, the cards stand on their own.
 */
export function RiverScene({ targetId }: { targetId: string }) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    const container = document.getElementById(targetId);
    if (!host || !container) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const svgNS = "http://www.w3.org/2000/svg";

    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("class", "river-svg");
    svg.setAttribute("fill", "none");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("preserveAspectRatio", "none");
    Object.assign(svg.style, {
      position: "absolute",
      inset: "0",
      width: "100%",
      height: "100%",
      zIndex: "0",
      pointerEvents: "none",
      overflow: "visible",
    } as CSSStyleDeclaration);

    const track = document.createElementNS(svgNS, "path");
    track.setAttribute("class", "river-path-track");
    track.setAttribute("stroke-width", "3");
    const draw = document.createElementNS(svgNS, "path");
    draw.setAttribute("class", "river-path-draw");
    draw.setAttribute("stroke-width", "3");
    const boat = document.createElementNS(svgNS, "circle");
    boat.setAttribute("class", "river-boat");
    boat.setAttribute("r", "9");

    svg.append(track, draw, boat);
    host.append(svg);

    const nodeEls: SVGGElement[] = [];

    function cardList(): HTMLElement[] {
      return Array.from(container!.querySelectorAll<HTMLElement>("[data-river-card]"));
    }

    function geometry(cards: HTMLElement[]): { points: Point[]; W: number; H: number } {
      const W = container!.clientWidth;
      const H = container!.clientHeight;
      const centerX = W / 2;
      const points: Point[] = [{ x: centerX, y: 0 }];
      cards.forEach((card) => {
        const left = card.offsetLeft;
        const right = left + card.offsetWidth;
        const y = card.offsetTop + card.offsetHeight / 2;
        // The card sits on one side; put the stop in the central gutter on its inner edge.
        const onLeftSide = (left + right) / 2 < centerX;
        const x = onLeftSide ? right + NODE_GAP : left - NODE_GAP;
        points.push({ x: Math.max(16, Math.min(W - 16, x)), y });
      });
      points.push({ x: centerX, y: H });
      return { points, W, H };
    }

    function pathD(points: Point[]): string {
      let d = `M ${points[0]!.x} ${points[0]!.y}`;
      for (let i = 1; i < points.length; i++) {
        const prev = points[i - 1]!;
        const cur = points[i]!;
        const midY = (prev.y + cur.y) / 2;
        d += ` C ${prev.x} ${midY}, ${cur.x} ${midY}, ${cur.x} ${cur.y}`;
      }
      return d;
    }

    function placeNodes(points: Point[]) {
      const milestones = points.slice(1, -1);
      milestones.forEach((p, i) => {
        let g = nodeEls[i];
        if (!g) {
          g = document.createElementNS(svgNS, "g") as SVGGElement;
          g.setAttribute("class", "river-node-g");
          const ring = document.createElementNS(svgNS, "circle");
          ring.setAttribute("class", "river-node-ring");
          ring.setAttribute("r", "22");
          const label = document.createElementNS(svgNS, "text");
          label.setAttribute("class", "river-node-label");
          label.setAttribute("text-anchor", "middle");
          label.setAttribute("dy", "0.36em");
          label.textContent = String(i + 1);
          g.append(ring, label);
          svg.append(g);
          nodeEls[i] = g;
        }
        g.setAttribute("transform", `translate(${p.x} ${p.y})`);
      });
    }

    function paintStatic() {
      const cards = cardList();
      if (container!.clientWidth < MOBILE_MAX) {
        svg.style.display = "none";
        return;
      }
      svg.style.display = "";
      const { points, W, H } = geometry(cards);
      svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
      const d = pathD(points);
      track.setAttribute("d", d);
      draw.setAttribute("d", d);
      placeNodes(points);
      const first = points[1] ?? points[0]!;
      boat.setAttribute("cx", String(first.x));
      boat.setAttribute("cy", String(first.y));
    }

    // Reduced motion (or the script disabled): draw the river once, if we are on a wide
    // screen, and stop. The cards are already visible from the server render.
    if (reduced) {
      paintStatic();
      boat.style.display = "none";
      return () => svg.remove();
    }

    let triggers: Array<{ kill: () => void }> = [];
    let cancelled = false;
    let cleanup: (() => void) | null = null;

    void (async () => {
      const [{ default: gsap }, { ScrollTrigger }, { MotionPathPlugin }] = await Promise.all([
        import("gsap"),
        import("gsap/ScrollTrigger"),
        import("gsap/MotionPathPlugin"),
      ]);
      if (cancelled) return;
      gsap.registerPlugin(ScrollTrigger, MotionPathPlugin);

      function build() {
        triggers.forEach((t) => t.kill());
        triggers = [];
        const cards = cardList();
        const wide = container!.clientWidth >= MOBILE_MAX;

        // Always reveal the cards (reset first so rebuilds are idempotent).
        gsap.set(cards, { clearProps: "opacity,visibility,transform" });
        cards.forEach((card, i) => {
          const reveal = gsap.fromTo(
            card,
            { autoAlpha: 0, y: 44 },
            {
              autoAlpha: 1,
              y: 0,
              duration: 0.7,
              ease: "power3.out",
              overwrite: "auto",
              scrollTrigger: { trigger: card, start: "top 85%" },
            },
          );
          if (reveal.scrollTrigger) triggers.push(reveal.scrollTrigger);

          const node = nodeEls[i];
          if (wide && node) {
            const pop = gsap.fromTo(
              node,
              { autoAlpha: 0 },
              {
                autoAlpha: 1,
                duration: 0.5,
                ease: "power2.out",
                overwrite: "auto",
                scrollTrigger: { trigger: card, start: "top 85%" },
              },
            );
            if (pop.scrollTrigger) triggers.push(pop.scrollTrigger);
            const ring = node.querySelector(".river-node-ring");
            if (ring) {
              gsap.fromTo(
                ring,
                { attr: { r: 6 } },
                {
                  attr: { r: 22 },
                  duration: 0.5,
                  ease: "back.out(2)",
                  overwrite: "auto",
                  scrollTrigger: { trigger: card, start: "top 85%" },
                },
              );
            }
          }
        });

        if (!wide) {
          svg.style.display = "none";
          ScrollTrigger.refresh();
          return;
        }
        svg.style.display = "";

        const { points, W, H } = geometry(cards);
        svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
        const d = pathD(points);
        track.setAttribute("d", d);
        draw.setAttribute("d", d);
        placeNodes(points);

        const len = draw.getTotalLength();
        gsap.set(draw, { strokeDasharray: len, strokeDashoffset: len });

        const scrubCfg = {
          trigger: container!,
          start: "top 60%",
          end: "bottom 80%",
          scrub: 0.6 as const,
        };
        const drawTl = gsap.to(draw, {
          strokeDashoffset: 0,
          ease: "none",
          scrollTrigger: scrubCfg,
        });
        if (drawTl.scrollTrigger) triggers.push(drawTl.scrollTrigger);

        const boatTl = gsap.to(boat, {
          ease: "none",
          motionPath: { path: draw, align: draw, alignOrigin: [0.5, 0.5] },
          scrollTrigger: scrubCfg,
        });
        if (boatTl.scrollTrigger) triggers.push(boatTl.scrollTrigger);

        ScrollTrigger.refresh();
      }

      build();

      let raf = 0;
      const ro = new ResizeObserver(() => {
        if (raf) cancelAnimationFrame(raf);
        raf = requestAnimationFrame(build);
      });
      ro.observe(container!);

      cleanup = () => {
        if (raf) cancelAnimationFrame(raf);
        ro.disconnect();
        triggers.forEach((t) => t.kill());
        svg.remove();
      };
    })();

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [targetId]);

  return <div ref={hostRef} aria-hidden="true" className="river-host" />;
}
