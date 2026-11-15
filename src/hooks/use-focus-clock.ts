"use client";

import { useEffect, useState } from "react";

/**
 * Epoch ms that refreshes twice a second while `active`, and right away when the tab becomes visible
 * again. The timer's remaining time is always computed from timestamps; this only makes the screen
 * redraw. Does nothing while the timer is idle or paused.
 */
export function useFocusClock(active: boolean, intervalMs = 500): number {
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  useEffect(() => {
    setNowMs(Date.now());
    if (!active) return;
    const tick = () => setNowMs(Date.now());
    const id = window.setInterval(tick, intervalMs);
    const onVisible = () => { if (document.visibilityState === "visible") tick(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { window.clearInterval(id); document.removeEventListener("visibilitychange", onVisible); };
  }, [active, intervalMs]);
  return nowMs;
}
