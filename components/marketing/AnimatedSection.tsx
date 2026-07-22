"use client";

import { motion, useAnimationControls, useReducedMotion, type Variants } from "framer-motion";
import { useEffect, useRef } from "react";
import type { HTMLAttributes } from "react";

type AnimatedSectionProps = HTMLAttributes<HTMLDivElement> & {
  delay?: number;
  as?: "div" | "section";
};

const variants: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0 },
};

/**
 * Fade+slide-up wrapper that plays once when scrolled into view.
 * Fully disabled (renders children statically, no motion) when the
 * visitor has `prefers-reduced-motion: reduce` set.
 *
 * Deliberately does NOT use framer-motion's `whileInView` (or even a raw
 * `IntersectionObserver`) as the sole trigger. Both are driven off the
 * browser's rendering/animation pipeline, which some browsers suspend or
 * heavily throttle for tabs they consider backgrounded/low-priority —
 * when that happens the observer callback can simply never fire, or a
 * tween that did start can freeze mid-flight. Either way the section is
 * left permanently stuck at a partial/near-zero opacity instead of
 * resolving to fully visible, which is exactly the bug this component
 * previously had.
 *
 * Instead, "has this scrolled into view" is decided with a plain
 * `getBoundingClientRect` check — a synchronous DOM read that doesn't
 * depend on any observer or animation timeline — run on mount and on
 * scroll/resize. On top of that, an unconditional fallback timer forces
 * the final visible styles directly after a short grace period no matter
 * what, so content can never be left permanently invisible.
 */
export function AnimatedSection({
  children,
  delay = 0,
  className,
  ...rest
}: AnimatedSectionProps) {
  const shouldReduceMotion = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const controls = useAnimationControls();
  const revealedRef = useRef(false);

  useEffect(() => {
    if (shouldReduceMotion) return;

    const reveal = () => {
      if (revealedRef.current) return;
      revealedRef.current = true;
      controls.start("visible");
      window.removeEventListener("scroll", checkVisibility);
      window.removeEventListener("resize", checkVisibility);
    };

    function checkVisibility() {
      const node = ref.current;
      if (!node || revealedRef.current) return;
      const rect = node.getBoundingClientRect();
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
      // Reveal once at least ~10% of the element (or the whole element, if
      // it's shorter than that) has entered the viewport.
      const visibleAmount = Math.min(rect.bottom, viewportHeight) - Math.max(rect.top, 0);
      const threshold = Math.min(rect.height * 0.1, viewportHeight * 0.1) || 1;
      if (visibleAmount >= threshold) {
        reveal();
      }
    }

    checkVisibility();
    window.addEventListener("scroll", checkVisibility, { passive: true });
    window.addEventListener("resize", checkVisibility, { passive: true });

    // Unconditional safety net: whatever else happens (observer never
    // fires, scroll events get throttled, a tween stalls partway), force
    // the final visible state after a short grace period so the section
    // is never left permanently invisible.
    const fallbackDelayMs = (delay + 0.6) * 1000 + 1200;
    const fallbackTimeout = window.setTimeout(() => {
      reveal();
      const node = ref.current;
      if (!node) return;
      const opacity = Number(window.getComputedStyle(node).opacity);
      if (Number.isNaN(opacity) || opacity < 0.98) {
        node.style.opacity = "1";
        node.style.transform = "none";
      }
    }, fallbackDelayMs);

    return () => {
      window.removeEventListener("scroll", checkVisibility);
      window.removeEventListener("resize", checkVisibility);
      window.clearTimeout(fallbackTimeout);
    };
  }, [controls, delay, shouldReduceMotion]);

  if (shouldReduceMotion) {
    return (
      <div className={className} {...rest}>
        {children}
      </div>
    );
  }

  return (
    <motion.div
      ref={ref}
      className={className}
      initial="hidden"
      animate={controls}
      variants={variants}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
