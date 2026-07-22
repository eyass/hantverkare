"use client";

import { motion, useReducedMotion, type Variants } from "framer-motion";
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
 */
export function AnimatedSection({
  children,
  delay = 0,
  className,
  ...rest
}: AnimatedSectionProps) {
  const shouldReduceMotion = useReducedMotion();

  if (shouldReduceMotion) {
    return (
      <div className={className} {...rest}>
        {children}
      </div>
    );
  }

  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.2 }}
      variants={variants}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
