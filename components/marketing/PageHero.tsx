"use client";

import type { ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
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
 */
export function PageHero({ eyebrow, title, description, children, compact }: PageHeroProps) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <section className="relative overflow-hidden bg-[#020617]">
      <GradientBackdrop />
      <div
        className={`relative mx-auto flex max-w-4xl flex-col items-center gap-6 px-4 text-center sm:px-8 ${
          compact ? "pt-20 pb-14 sm:pt-24 sm:pb-16" : "pt-24 pb-16 sm:pt-32 sm:pb-20"
        }`}
      >
        {eyebrow && (
          <motion.span
            initial={{ opacity: 0, y: shouldReduceMotion ? 0 : -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-medium tracking-wide text-blue-200 backdrop-blur"
          >
            {eyebrow}
          </motion.span>
        )}
        <motion.h1
          initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.05 }}
          className={`font-semibold tracking-tight text-white ${
            compact ? "text-3xl sm:text-4xl" : "text-4xl sm:text-6xl"
          }`}
        >
          {title}
        </motion.h1>
        {description && (
          <motion.p
            initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.12 }}
            className={`max-w-2xl leading-8 text-slate-300 ${compact ? "text-base" : "text-lg sm:text-xl"}`}
          >
            {description}
          </motion.p>
        )}
        {children && (
          <motion.div
            initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            {children}
          </motion.div>
        )}
      </div>
    </section>
  );
}
