"use client";

import { useEffect } from "react";
import { wantsAdd, withoutAddParam } from "@/lib/quick-actions";

/**
 * Runs `onOpen` once on mount when the page was opened with `?tambah=1` (the dashboard's quick actions),
 * then removes the flag from the address bar. Reads `window.location` instead of useSearchParams so
 * the page can stay statically rendered (no Suspense boundary needed).
 */
export function useOpenFromQuery(onOpen: () => void) {
  useEffect(() => {
    if (!wantsAdd(window.location.search)) return;
    const { pathname, search, hash } = window.location;
    window.history.replaceState(window.history.state, "", pathname + withoutAddParam(search) + hash);
    onOpen();
    // Mount only: the flag is consumed above, so a later render must not reopen the form.
  }, []);
}
