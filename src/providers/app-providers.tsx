"use client";

import type { ReactNode } from "react";
import { MotionConfig } from "framer-motion";
import { ThemeProvider } from "./theme-provider";
import { FocusTimerProvider } from "./focus-timer-provider";
import { PwaProvider } from "./pwa-provider";
import { ToastProvider } from "./toast-provider";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    // reducedMotion="user" makes Framer Motion honor prefers-reduced-motion.
    <MotionConfig reducedMotion="user">
      <ThemeProvider>
        <ToastProvider>
          {/* Above the pages, so the focus timer keeps running while you move between them. */}
          <PwaProvider>
            <FocusTimerProvider>{children}</FocusTimerProvider>
          </PwaProvider>
        </ToastProvider>
      </ThemeProvider>
    </MotionConfig>
  );
}
