"use client";

import { motion, useReducedMotion } from "framer-motion";

/**
 * Original abstract SVG illustration of the quote-generation flow: a
 * stylized document with line items that animate in one after another,
 * plus a small orbiting "AI" spark. Purely decorative, on-brand navy/blue.
 */
export function QuoteFlowIllustration({ className = "" }: { className?: string }) {
  const shouldReduceMotion = useReducedMotion();

  const lines = [0, 1, 2, 3];

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

      {/* Floating document card */}
      <motion.g
        initial={{ y: shouldReduceMotion ? 0 : 8 }}
        animate={shouldReduceMotion ? undefined : { y: [8, -8, 8] }}
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
            initial={{ opacity: shouldReduceMotion ? 1 : 0, x: shouldReduceMotion ? 0 : -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{
              duration: 0.5,
              delay: shouldReduceMotion ? 0 : 0.4 + index * 0.35,
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
          x="68"
          y="266"
          width="228"
          height="2"
          fill="#334155"
          initial={{ scaleX: shouldReduceMotion ? 1 : 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 0.6, delay: shouldReduceMotion ? 0 : 2 }}
          style={{ transformOrigin: "68px 267px" }}
        />
      </motion.g>

      {/* Orbiting AI spark */}
      <motion.circle
        cx="312"
        cy="56"
        r="10"
        fill="url(#qfi-accent)"
        initial={{ scale: shouldReduceMotion ? 1 : 0.6, opacity: shouldReduceMotion ? 1 : 0.5 }}
        animate={
          shouldReduceMotion
            ? undefined
            : { scale: [0.6, 1.15, 0.6], opacity: [0.5, 1, 0.5] }
        }
        transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
      />
    </svg>
  );
}
