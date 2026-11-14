"use client";

import { motion, type HTMLMotionProps } from "framer-motion";
import { duration, easing } from "@/lib/tokens";
import { cn } from "@/lib/utils";

interface CardProps extends HTMLMotionProps<"div"> {
  /** Subtle entrance on mount. Pass delay to stagger a group. */
  animate?: boolean;
  delay?: number;
  glass?: boolean;
}

export function Card({ className, animate = true, delay = 0, glass = true, children, ...props }: CardProps) {
  return (
    <motion.div
      initial={animate ? { opacity: 0, y: 10 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: duration.slow, ease: easing.smooth, delay }}
      className={cn(
        "rounded-card p-5 shadow-soft",
        glass ? "glass" : "border border-fg/10 bg-card",
        className,
      )}
      {...props}
    >
      {children}
    </motion.div>
  );
}
