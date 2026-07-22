"use client";

import { motion, useReducedMotion } from "framer-motion";

/**
 * Layered, blurred gradient "blobs" behind hero-style sections — pure CSS/SVG,
 * no external images. Subtly animated (slow drift) unless the visitor prefers
 * reduced motion, in which case the blobs render static.
 */
export function GradientBackdrop({ className = "" }: { className?: string }) {
  const shouldReduceMotion = useReducedMotion();

  const blobs = [
    {
      className:
        "left-[-10%] top-[-10%] h-[420px] w-[420px] bg-[radial-gradient(circle_at_30%_30%,#60a5fa,transparent_70%)]",
      animate: shouldReduceMotion
        ? undefined
        : { x: [0, 30, -10, 0], y: [0, -20, 10, 0] },
      duration: 22,
    },
    {
      className:
        "right-[-15%] top-[5%] h-[480px] w-[480px] bg-[radial-gradient(circle_at_60%_40%,#1e3a8a,transparent_70%)]",
      animate: shouldReduceMotion
        ? undefined
        : { x: [0, -25, 15, 0], y: [0, 15, -15, 0] },
      duration: 26,
    },
    {
      className:
        "left-[20%] bottom-[-20%] h-[380px] w-[380px] bg-[radial-gradient(circle_at_50%_50%,#38bdf8,transparent_70%)]",
      animate: shouldReduceMotion
        ? undefined
        : { x: [0, 20, -20, 0], y: [0, -10, 20, 0] },
      duration: 30,
    },
  ];

  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
    >
      {blobs.map((blob, index) => (
        <motion.div
          key={index}
          className={`absolute rounded-full opacity-40 blur-3xl ${blob.className}`}
          animate={blob.animate}
          transition={
            blob.animate
              ? { duration: blob.duration, repeat: Infinity, ease: "easeInOut" }
              : undefined
          }
        />
      ))}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,transparent_0%,#020617_95%)]" />
    </div>
  );
}
