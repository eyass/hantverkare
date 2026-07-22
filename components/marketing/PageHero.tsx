import type { CSSProperties, ReactNode } from "react";
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
 * framer-motion. This content is above-the-fold and must render visible
 * immediately on load — a CSS animation has no dependency on React state,
 * JS timers, or animation-library internals, so it cannot get stuck at
 * `opacity: 0` the way the previous framer-motion `initial`/`animate`
 * mount animation did. `prefers-reduced-motion: reduce` disables the
 * animation entirely via a media query in globals.css.
 */
export function PageHero({ eyebrow, title, description, children, compact }: PageHeroProps) {
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
            className="hero-fade-in rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-medium tracking-wide text-blue-200 backdrop-blur"
            style={{ "--hero-fade-offset": "-8px" } as CSSProperties}
          >
            {eyebrow}
          </span>
        )}
        <h1
          className={`hero-fade-in font-semibold tracking-tight text-white ${
            compact ? "text-3xl sm:text-4xl" : "text-4xl sm:text-6xl"
          }`}
          style={{ "--hero-fade-delay": "0.05s" } as CSSProperties}
        >
          {title}
        </h1>
        {description && (
          <p
            className={`hero-fade-in max-w-2xl leading-8 text-slate-300 ${
              compact ? "text-base" : "text-lg sm:text-xl"
            }`}
            style={{ "--hero-fade-delay": "0.12s" } as CSSProperties}
          >
            {description}
          </p>
        )}
        {children && (
          <div className="hero-fade-in" style={{ "--hero-fade-delay": "0.2s" } as CSSProperties}>
            {children}
          </div>
        )}
      </div>
    </section>
  );
}
