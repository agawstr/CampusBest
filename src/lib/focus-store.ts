import type { FocusSettings, FocusSession, FocusTimerState } from "@/types";
import {
  appendSession, beginPhase, DEFAULT_FOCUS_SETTINGS, endPhase, idleState, isExpired, pausePhase, resolveFocusSettings,
  resumePhase, sameRun, withLink, type FocusEndReason, type FocusLink,
} from "./focus";
import { generateId } from "./id";
import { getStorageAdapter, storage } from "./storage";

/**
 * The timer's persistence, with no React in it so it can be tested like the other lib files.
 *
 * Where things live (no new key, no new storage API):
 *  - settings.focus       the phase lengths
 *  - settings.focusTimer  the running/paused timer, as timestamps
 *  - focus_sessions       the history
 * Every function writes only on a state change (never per second) and goes through storage.update, so
 * writes in this tab are serialized and the theme/sidebar fields beside the timer are carried along.
 */

export class StorageUnavailableError extends Error {
  constructor() { super("storage unavailable"); this.name = "StorageUnavailableError"; }
}

/** A blocked LocalStorage skips writes without an error, so the timer (which lives in storage) checks first. */
export function ensureWritable(): void {
  if (!getStorageAdapter().isAvailable()) throw new StorageUnavailableError();
}

export interface TimerSnapshot { timer: FocusTimerState; settings: FocusSettings }

export async function readTimer(): Promise<TimerSnapshot> {
  const s = await storage.read("settings");
  return { timer: s.focusTimer ?? idleState("focus", 0), settings: resolveFocusSettings(s.focus) };
}

/** Starts the phase that is next in line. Returns the new state, or null if the timer wasn't idle. */
export async function startTimer(link: FocusLink, nowMs: number = Date.now()): Promise<FocusTimerState | null> {
  ensureWritable();
  if ((await readTimer()).timer.status !== "idle") return null; // nothing to do: don't rewrite settings
  const box: { value: FocusTimerState | null } = { value: null };
  await storage.update("settings", (s) => {
    const cur = s.focusTimer ?? idleState("focus", 0);
    if (cur.status !== "idle") return s;
    box.value = beginPhase(withLink(cur, link), resolveFocusSettings(s.focus), nowMs, generateId());
    return { ...s, focusTimer: box.value };
  });
  return box.value;
}

export async function pauseTimer(nowMs: number = Date.now()): Promise<boolean> {
  ensureWritable();
  const current = (await readTimer()).timer;
  if (pausePhase(current, nowMs) === current) return false; // not running (or already out of time): no write
  const box = { changed: false };
  await storage.update("settings", (s) => {
    const cur = s.focusTimer ?? idleState("focus", 0);
    const next = pausePhase(cur, nowMs);
    if (next === cur) return s;
    box.changed = true;
    return { ...s, focusTimer: next };
  });
  return box.changed;
}

export async function resumeTimer(nowMs: number = Date.now()): Promise<boolean> {
  ensureWritable();
  if ((await readTimer()).timer.status !== "paused") return false;
  const box = { changed: false };
  await storage.update("settings", (s) => {
    const cur = s.focusTimer ?? idleState("focus", 0);
    const next = resumePhase(cur, nowMs);
    if (next === cur) return s;
    box.changed = true;
    return { ...s, focusTimer: next };
  });
  return box.changed;
}

export interface CommitResult {
  /** true when this call moved the timer on (false: nothing to do, or another tab got there first). */
  changed: boolean;
  reason: FocusEndReason;
  session?: FocusSession;
  state?: FocusTimerState;
}

/**
 * Ends the current phase (finished, reset or skipped) and saves the session if there is one.
 * Order matters: the session is written first (idempotent by id), then the timer moves on. If something
 * fails in between, the timer still says "running, expired" and the next call finishes the job without
 * a duplicate. A timer that has run out is always finished as completed, whatever was asked.
 * Throws when storage can't be written; the timer state is then left untouched.
 */
export async function endTimer(reason: FocusEndReason, nowMs: number = Date.now()): Promise<CommitResult> {
  ensureWritable();
  const { timer: cur, settings } = await readTimer();
  const effective: FocusEndReason = isExpired(cur, nowMs) ? "completed" : reason;
  const end = endPhase(cur, effective, nowMs, settings);
  if (!end.changed) return { changed: false, reason: effective };

  const session = end.session;
  if (session) await storage.update("focusSessions", (list) => appendSession(list, session));

  const box = { changed: false };
  await storage.update("settings", (s) => {
    const latest = s.focusTimer ?? idleState("focus", 0);
    if (!sameRun(latest, cur)) return s; // another tab already moved the timer on
    box.changed = true;
    return { ...s, focusTimer: end.state };
  });
  return { changed: box.changed, reason: effective, session, state: end.state };
}

/** Only while idle: the choice is locked during a phase so the saved session matches what was started. */
export async function setTimerLink(link: FocusLink): Promise<boolean> {
  ensureWritable();
  if ((await readTimer()).timer.status !== "idle") return false;
  const box = { changed: false };
  await storage.update("settings", (s) => {
    const cur = s.focusTimer ?? idleState("focus", 0);
    if (cur.status !== "idle") return s;
    box.changed = true;
    return { ...s, focusTimer: withLink(cur, link) };
  });
  return box.changed;
}

/** Saves the phase lengths. A phase already running keeps the length it started with. */
export async function saveFocusSettings(next: FocusSettings): Promise<void> {
  ensureWritable();
  await storage.update("settings", (s) => ({ ...s, focus: { ...DEFAULT_FOCUS_SETTINGS, ...next } }));
}
