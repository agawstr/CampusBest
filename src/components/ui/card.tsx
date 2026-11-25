"use client";

import type { HTMLAttributes } from "react";
import { motion, type HTMLMotionProps } from "framer-motion";
import { duration, easing } from "@/lib/tokens";
import { cn } from "@/lib/utils";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Subtle entrance on mount. Defaults to false to avoid double-animating after page transitions. */
  animate?: boolean;
  delay?: number;
  glass?: boolean;
  /** E1 ("item", no backdrop-filter) vs E2 ("glass") vs "solid". Overrides `glass` when set. */
  surface?: "glass" | "item" | "solid";
  /** E3 depth: a brighter, higher surface for the one element that should lead a screen. */
  raised?: boolean;
}

export function Card({ className, animate = false, delay = 0, glass = true, surface, raised = false, children, ...props }: CardProps) {
  const resolvedSurface = surface ?? (glass ? "glass" : "solid");
  const classes = cn(
    "rounded-card p-5",
    raised ? "shadow-raised" : "shadow-soft",
    resolvedSurface === "glass"
      ? (raised ? "glass glass-raised" : "glass")
      : resolvedSurface === "item"
        ? "glass-item"
        : "border border-fg/10 bg-card",
    className,
  );

  if (!animate) {
    return (
      <div className={classes} {...props}>
        {children}
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: duration.base, ease: easing.smooth, delay }}
      className={classes}
      {...(props as HTMLMotionProps<"div">)}
    >
      {children}
    </motion.div>
  );
}
