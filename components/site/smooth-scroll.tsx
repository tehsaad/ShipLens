"use client";

import Lenis from "lenis";
import { useEffect } from "react";

/**
 * Smooth momentum scrolling for the public site, tied to GSAP's ScrollTrigger so scroll-driven
 * animations (the home river) stay in step with the eased scroll position.
 *
 * Progressive enhancement only: it renders nothing, and if the script never runs — or the
 * visitor asks for reduced motion — the page keeps the browser's own native scrolling. No
 * content depends on it.
 */
export function SmoothScroll() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let cancelled = false;
    let cleanup: (() => void) | null = null;

    // Load GSAP and ScrollTrigger lazily so they stay out of the first-load bundle.
    void (async () => {
      const [{ default: gsap }, { ScrollTrigger }] = await Promise.all([
        import("gsap"),
        import("gsap/ScrollTrigger"),
      ]);
      if (cancelled) return;
      gsap.registerPlugin(ScrollTrigger);

      const lenis = new Lenis({ duration: 1.05, smoothWheel: true });
      lenis.on("scroll", ScrollTrigger.update);

      const onTick = (time: number) => lenis.raf(time * 1000);
      gsap.ticker.add(onTick);
      gsap.ticker.lagSmoothing(0);

      cleanup = () => {
        gsap.ticker.remove(onTick);
        lenis.destroy();
      };
    })();

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, []);

  return null;
}
