"use client";

import { useEffect, useState } from "react";

/**
 * The current time, null until mounted (so server and first client render agree), then refreshed every
 * minute and when the tab becomes visible again. Lets "now"-dependent UI (greeting, ongoing class,
 * midnight rollover) stay correct without a reload.
 */
let hydrated = false;

export function useNow(intervalMs = 60_000): Date | null {
  const [now, setNow] = useState<Date | null>(() => (hydrated ? new Date() : null));
  useEffect(() => {
    hydrated = true;
    const tick = () => setNow(new Date());
    if (now === null) tick();
    const id = window.setInterval(tick, intervalMs);
    const onVisible = () => { if (document.visibilityState === "visible") tick(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { window.clearInterval(id); document.removeEventListener("visibilitychange", onVisible); };
  }, [intervalMs]); // eslint-disable-line react-hooks/exhaustive-deps
  return now;
}
