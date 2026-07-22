"use client";

import type { CSSProperties, ReactNode } from "react";
import { useEffect, useRef } from "react";
import { GradientBackdrop } from "./GradientBackdrop";

type PageHeroProps = {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  compact?: boolean;
};

/**
 * Shared dark, gradient-mesh hero band used at the top of every marketing
 * page for visual consistency (Home gets the full version with actions,
 * inner pages use `compact` for a shorter band).
 *
 * The badge/h1/description/actions fade+slide in on mount using plain CSS
 * `@keyframes` (see `.hero-fade-in` in `app/globals.css`) rather than
 * framer-motion, since this content is above-the-fold and must be visible
 * immediately on load.
 *
 * CSS animations alone are not actually bulletproof here: some browsers
 * (and this sandboxed testing environment, which reports
 * `document.visibilityState === "hidden"` even for a nominally-focused
 * tab) pause/suspend animations — CSS keyframes included — for tabs they
 * consider backgrounded, which can leave the `from` state (opacity: 0)
 * applied indefinitely. So on top of the CSS animation we run the same
 * unconditional-fallback pattern used by `AnimatedSection.tsx`: a plain
 * `setTimeout` that force-applies the final visible inline styles after a
 * short grace period, no matter whether the CSS animation ever resolved.
 */
function useHeroFadeInFallback(delayMs: number) {
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const fallbackTimeout = window.setTimeout(() => {
      const node = ref.current;
      if (!node) return;
      const opacity = Number(window.getComputedStyle(node).opacity);
      if (Number.isNaN(opacity) || opacity < 0.98) {
        node.style.opacity = "1";
        node.style.transform = "none";
        node.style.animation = "none";
      }
    }, delayMs + 700);

    return () => window.clearTimeout(fallbackTimeout);
  }, [delayMs]);

  return ref;
}

export function PageHero({ eyebrow, title, description, children, compact }: PageHeroProps) {
  const badgeRef = useHeroFadeInFallback(0);
  const h1Ref = useHeroFadeInFallback(50);
  const pRef = useHeroFadeInFallback(120);
  const actionsRef = useHeroFadeInFallback(200);

  return (
    <section className="relative overflow-hidden bg-[#020617]">
      <GradientBackdrop />
      <div
        className={`relative mx-auto flex max-w-4xl flex-col items-center gap-6 px-4 text-center sm:px-8 ${
          compact ? "pt-20 pb-14 sm:pt-24 sm:pb-16" : "pt-24 pb-16 sm:pt-32 sm:pb-20"
        }`}
      >
        {eyebrow && (
          <span
            ref={badgeRef as React.RefObject<HTMLSpanElement>}
            className="hero-fade-in rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-medium tracking-wide text-blue-200 backdrop-blur"
            style={{ "--hero-fade-offset": "-8px" } as CSSProperties}
          >
            {eyebrow}
          </span>
        )}
        <h1
          ref={h1Ref as React.RefObject<HTMLHeadingElement>}
          className={`hero-fade-in font-semibold tracking-tight text-white ${
            compact ? "text-3xl sm:text-4xl" : "text-4xl sm:text-6xl"
          }`}
          style={{ "--hero-fade-delay": "0.05s" } as CSSProperties}
        >
          {title}
        </h1>
        {description && (
          <p
            ref={pRef as React.RefObject<HTMLParagraphElement>}
            className={`hero-fade-in max-w-2xl leading-8 text-slate-300 ${
              compact ? "text-base" : "text-lg sm:text-xl"
            }`}
            style={{ "--hero-fade-delay": "0.12s" } as CSSProperties}
          >
            {description}
          </p>
        )}
        {children && (
          <div
            ref={actionsRef as React.RefObject<HTMLDivElement>}
            className="hero-fade-in"
            style={{ "--hero-fade-delay": "0.2s" } as CSSProperties}
          >
            {children}
          </div>
        )}
      </div>
    </section>
  );
}
