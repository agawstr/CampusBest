"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, type ReactNode } from "react";
import { useStorage } from "@/hooks/use-storage";
import {
  endTimer, pauseTimer, resumeTimer, saveFocusSettings, setTimerLink, startTimer, StorageUnavailableError,
} from "@/lib/focus-store";
import { idleState, resolveFocusSettings, type FocusEndReason, type FocusLink } from "@/lib/focus";
import { playFocusChime } from "@/lib/sound";
import { useToast } from "@/providers/toast-provider";
import type { FocusSettings, FocusTimerState } from "@/types";

interface FocusTimerContextValue {
  /** false until the saved timer has been read (server render and first client render are the same). */
  ready: boolean;
  timer: FocusTimerState;
  settings: FocusSettings;
  start: (link: FocusLink) => Promise<void>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  /** Back to idle. A focus phase that already ran >= 1 minute is saved as not completed. */
  reset: () => Promise<void>;
  /** Jump to the next phase. Same saving rule as reset. */
  skip: () => Promise<void>;
  setLink: (link: FocusLink) => Promise<void>;
  /** true when saved. */
  saveSettings: (next: FocusSettings) => Promise<boolean>;
}

const FocusTimerContext = createContext<FocusTimerContextValue | null>(null);

/**
 * Lives in AppProviders, above the pages, so the timer keeps running while you move between pages (the
 * page template re-mounts on every navigation, this provider doesn't). It holds no clock of its own: the
 * saved timestamps are the truth. It only (a) shows the saved state, (b) wakes up at the end time (and
 * when the tab is visible again) to finish the phase, and (c) calls lib/focus-store for every action.
 */
export function FocusTimerProvider({ children }: { children: ReactNode }) {
  const settingsStore = useStorage("settings");
  const { toast } = useToast();
  const finishing = useRef(false);
  const failedRun = useRef<string | null>(null);

  const timer = settingsStore.data.focusTimer ?? idleState("focus", 0);
  const settings = resolveFocusSettings(settingsStore.data.focus);
  const ready = settingsStore.isReady;

  const fail = useCallback((error: unknown, fallback = "Penyimpanan browser penuh atau tidak bisa diakses. Coba lagi ya.") => {
    const blocked = error instanceof StorageUnavailableError;
    toast({
      title: "Gagal menyimpan",
      description: blocked ? "Timer fokus butuh penyimpanan browser, dan sekarang tidak bisa diakses." : fallback,
      variant: "error",
    });
  }, [toast]);

  const soundEnabled = settingsStore.data.focusSound !== false;

  const announce = useCallback((reason: FocusEndReason, ended: FocusTimerState | undefined, completedMode: "focus" | "break") => {
    if (reason !== "completed" || !ended) return;
    if (soundEnabled) playFocusChime(completedMode);
    if (completedMode === "focus") {
      toast({
        title: "Sesi fokus selesai",
        description: `Waktunya ${ended.mode === "long_break" ? "istirahat panjang" : "istirahat sebentar"}.`,
        variant: "success",
      });
    } else {
      toast({ title: "Istirahat selesai", description: "Siap lanjut fokus?", variant: "success" });
    }
  }, [toast, soundEnabled]);

  const end = useCallback(async (reason: FocusEndReason, wasMode: "focus" | "break") => {
    try {
      const result = await endTimer(reason);
      failedRun.current = null;
      if (result.changed) announce(result.reason, result.state, wasMode);
    } catch (error) {
      fail(error, "Sesinya belum tersimpan. Coba lagi ya.");
    }
  }, [announce, fail]);

  /* Finish the phase when its time is up, also if that happened while the page was closed or in the background. */
  useEffect(() => {
    if (!ready || timer.status !== "running" || timer.endsAt === undefined || !timer.runId) return;
    const { endsAt, runId, mode } = timer;
    const wasMode = mode === "focus" ? "focus" : "break";
    const check = () => {
      if (Date.now() < endsAt || finishing.current || failedRun.current === runId) return;
      finishing.current = true;
      void (async () => {
        try {
          const result = await endTimer("completed");
          if (result.changed) announce(result.reason, result.state, wasMode);
        } catch (error) {
          failedRun.current = runId; // don't retry (and re-toast) every tick; the next action or reload retries
          fail(error, "Sesinya belum tersimpan. Coba lagi ya.");
        } finally {
          finishing.current = false;
        }
      })();
    };
    const timeout = window.setTimeout(check, Math.max(0, endsAt - Date.now()) + 25);
    const onVisible = () => { if (document.visibilityState === "visible") check(); };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pageshow", onVisible);
    check();
    return () => {
      window.clearTimeout(timeout);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pageshow", onVisible);
    };
  }, [ready, timer.status, timer.endsAt, timer.runId, timer.mode, announce, fail]); // eslint-disable-line react-hooks/exhaustive-deps

  const start = useCallback(async (link: FocusLink) => {
    try { failedRun.current = null; await startTimer(link); } catch (error) { fail(error); }
  }, [fail]);
  const pause = useCallback(async () => { try { await pauseTimer(); } catch (error) { fail(error); } }, [fail]);
  const resume = useCallback(async () => { try { await resumeTimer(); } catch (error) { fail(error); } }, [fail]);
  const reset = useCallback(() => end("reset", timer.mode === "focus" ? "focus" : "break"), [end, timer.mode]);
  const skip = useCallback(() => end("skip", timer.mode === "focus" ? "focus" : "break"), [end, timer.mode]);
  const setLink = useCallback(async (link: FocusLink) => { try { await setTimerLink(link); } catch (error) { fail(error); } }, [fail]);
  const saveSettings = useCallback(async (next: FocusSettings) => {
    try { await saveFocusSettings(next); return true; } catch (error) { fail(error); return false; }
  }, [fail]);

  const value = useMemo<FocusTimerContextValue>(
    () => ({ ready, timer, settings, start, pause, resume, reset, skip, setLink, saveSettings }),
    // timer/settings objects change identity whenever any setting changes; the fields below are what matter
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ready, settingsStore.data.focusTimer, settingsStore.data.focus, start, pause, resume, reset, skip, setLink, saveSettings],
  );

  return <FocusTimerContext.Provider value={value}>{children}</FocusTimerContext.Provider>;
}

export function useFocusTimer() {
  const ctx = useContext(FocusTimerContext);
  if (!ctx) throw new Error("useFocusTimer must be used inside FocusTimerProvider");
  return ctx;
}
