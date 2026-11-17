"use client";

import { motion, type HTMLMotionProps } from "framer-motion";
import { duration, easing } from "@/lib/tokens";
import { cn } from "@/lib/utils";

interface CardProps extends HTMLMotionProps<"div"> {
  /** Subtle entrance on mount. Pass delay to stagger a group. */
  animate?: boolean;
  delay?: number;
  glass?: boolean;
  /** E3 depth: a brighter, higher surface for the one element that should lead a screen. */
  raised?: boolean;
}

export function Card({ className, animate = true, delay = 0, glass = true, raised = false, children, ...props }: CardProps) {
  return (
    <motion.div
      initial={animate ? { opacity: 0, y: 10 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: duration.slow, ease: easing.smooth, delay }}
      className={cn(
        "rounded-card p-5",
        raised ? "shadow-raised" : "shadow-soft",
        glass ? (raised ? "glass glass-raised" : "glass") : "border border-fg/10 bg-card",
        className,
      )}
      {...props}
    >
      {children}
    </motion.div>
  );
}
