"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef } from "react";

/**
 * Original abstract SVG illustration of the quote-generation flow: a
 * stylized document with line items that animate in one after another,
 * plus a small orbiting "AI" spark. Purely decorative, on-brand navy/blue.
 */
export function QuoteFlowIllustration({ className = "" }: { className?: string }) {
  const shouldReduceMotion = useReducedMotion();

  const lines = [0, 1, 2, 3];

  const lineRefs = useRef<(SVGGElement | null)[]>([]);
  const barRef = useRef<SVGRectElement>(null);

  // Same bug class as AnimatedSection/PageHero/QuoteDemo: the line items and
  // total bar below play a one-shot `initial`/`animate` tween (opacity 0->1,
  // scaleX 0->1). If that tween ever fails to complete under throttled or
  // backgrounded conditions, this decorative illustration is left with
  // permanently invisible/collapsed content instead of settling into its
  // final fully-drawn state. Force the final visible values unconditionally
  // after the tweens should have long finished.
  useEffect(() => {
    if (shouldReduceMotion) return;
    const fallbackTimeout = window.setTimeout(() => {
      // Forcing these final values is safe even if the tween already
      // completed successfully — it's the same end state either way.
      lineRefs.current.forEach((node) => {
        if (!node) return;
        node.style.opacity = "1";
        node.style.transform = "none";
      });
      const bar = barRef.current;
      if (bar) {
        bar.style.transform = "scaleX(1)";
      }
    }, 3200);
    return () => window.clearTimeout(fallbackTimeout);
  }, [shouldReduceMotion]);

  return (
    <svg
      viewBox="0 0 360 320"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Illustration eines automatisch erstellten Angebots"
    >
      <defs>
        <linearGradient id="qfi-card" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#1e293b" />
          <stop offset="100%" stopColor="#0f172a" />
        </linearGradient>
        <linearGradient id="qfi-accent" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#60a5fa" />
          <stop offset="100%" stopColor="#2563eb" />
        </linearGradient>
      </defs>

      {/* Floating document card.
          Reduced-motion visitors render plain <g>/<rect>/<circle> elements
          instead of framer-motion's <motion.*> equivalents — this skips the
          library's per-element animation setup entirely (not just the
          visual tween), so there's no motion-library JS work happening for
          content that will never move. */}
      {shouldReduceMotion ? (
        <g>
          <rect x="40" y="30" width="280" height="260" rx="24" fill="url(#qfi-card)" />
          <rect x="40" y="30" width="280" height="260" rx="24" stroke="#334155" strokeOpacity="0.6" />

          {/* Header line */}
          <rect x="68" y="62" width="120" height="12" rx="6" fill="#94a3b8" opacity="0.6" />
          <rect x="68" y="82" width="80" height="8" rx="4" fill="#64748b" opacity="0.5" />

          {lines.map((line, index) => (
            <g key={line}>
              <rect
                x="68"
                y={120 + index * 34}
                width="160"
                height="10"
                rx="5"
                fill="#cbd5e1"
                opacity="0.85"
              />
              <rect
                x="252"
                y={120 + index * 34}
                width="44"
                height="10"
                rx="5"
                fill="url(#qfi-accent)"
              />
            </g>
          ))}

          <rect x="68" y="266" width="228" height="2" fill="#334155" />
        </g>
      ) : (
        <motion.g
          initial={{ y: 8 }}
          animate={{ y: [8, -8, 8] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        >
          <rect x="40" y="30" width="280" height="260" rx="24" fill="url(#qfi-card)" />
          <rect x="40" y="30" width="280" height="260" rx="24" stroke="#334155" strokeOpacity="0.6" />

          {/* Header line */}
          <rect x="68" y="62" width="120" height="12" rx="6" fill="#94a3b8" opacity="0.6" />
          <rect x="68" y="82" width="80" height="8" rx="4" fill="#64748b" opacity="0.5" />

          {/* Animated line items appearing one after another */}
          {lines.map((line, index) => (
            <motion.g
              key={line}
              ref={(node) => {
                lineRefs.current[index] = node;
              }}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{
                duration: 0.5,
                delay: 0.4 + index * 0.35,
                ease: "easeOut",
              }}
            >
              <rect
                x="68"
                y={120 + index * 34}
                width="160"
                height="10"
                rx="5"
                fill="#cbd5e1"
                opacity="0.85"
              />
              <rect
                x="252"
                y={120 + index * 34}
                width="44"
                height="10"
                rx="5"
                fill="url(#qfi-accent)"
              />
            </motion.g>
          ))}

          {/* Total bar */}
          <motion.rect
            ref={barRef}
            x="68"
            y="266"
            width="228"
            height="2"
            fill="#334155"
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 0.6, delay: 2 }}
            style={{ transformOrigin: "68px 267px" }}
          />
        </motion.g>
      )}

      {/* Orbiting AI spark */}
      {shouldReduceMotion ? (
        <circle cx="312" cy="56" r="10" fill="url(#qfi-accent)" />
      ) : (
        <motion.circle
          cx="312"
          cy="56"
          r="10"
          fill="url(#qfi-accent)"
          initial={{ scale: 0.6, opacity: 0.5 }}
          animate={{ scale: [0.6, 1.15, 0.6], opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
        />
      )}
    </svg>
  );
}
