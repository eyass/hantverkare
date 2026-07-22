"use client";

import { motion, useAnimationControls, useInView, useReducedMotion, type Variants } from "framer-motion";
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
 * Deliberately does NOT use framer-motion's `whileInView` directly.
 * `whileInView` drives its animation off the same rendering timeline as
 * requestAnimationFrame/WAAPI, which some browsers throttle heavily for
 * tabs they consider backgrounded or low-priority (e.g. after a fast
 * scroll, or on battery-saver mode on mobile). When that happens the
 * tween can get stuck mid-flight — the element is permanently left at a
 * partial opacity instead of resolving to fully visible. We use
 * `useInView` (a plain IntersectionObserver — unaffected by animation
 * throttling) to make the "has this scrolled into view" decision, drive
 * the animation from React state, and add a short defensive fallback
 * that force-applies the final visible styles directly if the animation
 * hasn't finished shortly after it should have. This guarantees content
 * is never permanently stuck invisible, even in degraded conditions.
 */
export function AnimatedSection({
  children,
  delay = 0,
  className,
  ...rest
}: AnimatedSectionProps) {
  const shouldReduceMotion = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, amount: 0.1, margin: "0px 0px -10% 0px" });
  const controls = useAnimationControls();

  useEffect(() => {
    if (!isInView) return;

    controls.start("visible");

    // Defensive fallback: if the tween hasn't resolved shortly after it
    // should have finished, force the final visible state directly so the
    // section is never left permanently stuck at a partial opacity.
    const fallbackDelayMs = (delay + 0.6) * 1000 + 400;
    const timeout = window.setTimeout(() => {
      const node = ref.current;
      if (!node) return;
      const opacity = Number(window.getComputedStyle(node).opacity);
      if (Number.isNaN(opacity) || opacity < 0.98) {
        node.style.opacity = "1";
        node.style.transform = "none";
      }
    }, fallbackDelayMs);

    return () => window.clearTimeout(timeout);
  }, [isInView, controls, delay]);

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
