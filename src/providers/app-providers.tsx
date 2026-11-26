"use client";

import { useEffect, type ReactNode } from "react";
import { MotionConfig } from "framer-motion";
import { ThemeProvider } from "./theme-provider";
import { FocusTimerProvider } from "./focus-timer-provider";
import { PwaProvider } from "./pwa-provider";
import { ToastProvider } from "./toast-provider";

export function AppProviders({ children }: { children: ReactNode }) {
  useEffect(() => {
    const onContextMenu = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest('a[href^="/"]')) e.preventDefault();
    };
    document.addEventListener("contextmenu", onContextMenu);
    return () => document.removeEventListener("contextmenu", onContextMenu);
  }, []);

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
