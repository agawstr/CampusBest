import type { FocusMode, FocusSession, FocusSettings, FocusTimerState, FocusTimerStatus, Task } from "@/types";
import { isTaskDone } from "./domain";
import { toDateKey } from "./date";

/**
 * Pure Pomodoro rules. Nothing here reads the clock or touches storage: `nowMs` (epoch ms) is always
 * passed in, so every rule can be tested. Running time comes from timestamps, never from counting ticks.
 */

/* ---------------- constants ---------------- */

/** A long break after this many finished focus sessions. */
export const LONG_BREAK_EVERY = 4;
/** A focus session that was stopped early is only saved when it ran at least this long. */
export const MIN_RECORD_MINUTES = 1;

export const FOCUS_MODES = ["focus", "short_break", "long_break"] as const satisfies readonly FocusMode[];
export const FOCUS_MODE_LABELS: Record<FocusMode, string> = {
  focus: "Fokus",
  short_break: "Istirahat pendek",
  long_break: "Istirahat panjang",
};

export const FOCUS_LIMITS = {
  focusMinutes: { min: 1, max: 180 },
  shortBreakMinutes: { min: 1, max: 60 },
  longBreakMinutes: { min: 1, max: 120 },
} as const;

export const DEFAULT_FOCUS_SETTINGS: FocusSettings = { focusMinutes: 25, shortBreakMinutes: 5, longBreakMinutes: 15 };

export type FocusPresetKey = "25-5" | "50-10" | "custom";
export const FOCUS_PRESETS: readonly { key: Exclude<FocusPresetKey, "custom">; label: string; settings: FocusSettings }[] = [
  { key: "25-5", label: "25 / 5", settings: { focusMinutes: 25, shortBreakMinutes: 5, longBreakMinutes: 15 } },
  { key: "50-10", label: "50 / 10", settings: { focusMinutes: 50, shortBreakMinutes: 10, longBreakMinutes: 15 } },
];

export function presetOf(settings: FocusSettings): FocusPresetKey {
  const hit = FOCUS_PRESETS.find(
    (p) =>
      p.settings.focusMinutes === settings.focusMinutes &&
      p.settings.shortBreakMinutes === settings.shortBreakMinutes &&
      p.settings.longBreakMinutes === settings.longBreakMinutes,
  );
  return hit ? hit.key : "custom";
}

/* ---------------- normalization (used by lib/normalize.ts when settings are read) ---------------- */

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => typeof v === "object" && v !== null && !Array.isArray(v);

function intIn(v: unknown, min: number, max: number): number | undefined {
  const n = typeof v === "string" && v.trim() !== "" ? Number(v) : v;
  return typeof n === "number" && Number.isInteger(n) && n >= min && n <= max ? n : undefined;
}

/** undefined when nothing usable is stored. Missing or invalid fields fall back to the defaults one by one. */
export function normalizeFocusSettings(raw: unknown): FocusSettings | undefined {
  if (!isRec(raw)) return undefined;
  const L = FOCUS_LIMITS;
  return {
    focusMinutes: intIn(raw.focusMinutes, L.focusMinutes.min, L.focusMinutes.max) ?? DEFAULT_FOCUS_SETTINGS.focusMinutes,
    shortBreakMinutes: intIn(raw.shortBreakMinutes, L.shortBreakMinutes.min, L.shortBreakMinutes.max) ?? DEFAULT_FOCUS_SETTINGS.shortBreakMinutes,
    longBreakMinutes: intIn(raw.longBreakMinutes, L.longBreakMinutes.min, L.longBreakMinutes.max) ?? DEFAULT_FOCUS_SETTINGS.longBreakMinutes,
  };
}

export function resolveFocusSettings(stored: FocusSettings | undefined): FocusSettings {
  return stored ?? DEFAULT_FOCUS_SETTINGS;
}

export interface FocusSettingsErrors { focusMinutes?: string; shortBreakMinutes?: string; longBreakMinutes?: string }
export interface FocusSettingsInput { focusMinutes: string; shortBreakMinutes: string; longBreakMinutes: string }

export function validateFocusSettings(
  input: FocusSettingsInput,
): { ok: true; settings: FocusSettings } | { ok: false; errors: FocusSettingsErrors } {
  const errors: FocusSettingsErrors = {};
  const out: Partial<FocusSettings> = {};
  (Object.keys(FOCUS_LIMITS) as (keyof typeof FOCUS_LIMITS)[]).forEach((key) => {
    const { min, max } = FOCUS_LIMITS[key];
    const n = intIn(input[key].trim(), min, max);
    if (n === undefined) errors[key] = `Isi bilangan bulat ${min}–${max} menit.`;
    else out[key] = n;
  });
  if (Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, settings: out as FocusSettings };
}

const MAX_PHASE_MS = 24 * 3_600_000;
const optId = (v: unknown) => (typeof v === "string" && v.trim() !== "" ? v : undefined);
const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const validIso = (v: unknown): v is string => typeof v === "string" && Number.isFinite(Date.parse(v));

export function idleState(mode: FocusMode = "focus", cycle = 0, link: FocusLink = {}): FocusTimerState {
  const state: FocusTimerState = { mode, status: "idle", cycle };
  if (link.subjectId) state.subjectId = link.subjectId;
  if (link.taskId) state.taskId = link.taskId;
  return state;
}

/**
 * Anything that doesn't describe a usable timer becomes an idle one (so a damaged record can never
 * leave the timer stuck). undefined when nothing is stored.
 */
export function normalizeTimerState(raw: unknown): FocusTimerState | undefined {
  if (!isRec(raw)) return undefined;
  const mode: FocusMode = (FOCUS_MODES as readonly unknown[]).includes(raw.mode) ? (raw.mode as FocusMode) : "focus";
  const cycleRaw = intIn(raw.cycle, 0, LONG_BREAK_EVERY - 1);
  const link: FocusLink = { subjectId: optId(raw.subjectId), taskId: optId(raw.taskId) };
  const idle = idleState(mode, cycleRaw ?? 0, link);
  const status: FocusTimerStatus = raw.status === "running" || raw.status === "paused" ? raw.status : "idle";
  if (status === "idle") return idle;

  const runId = optId(raw.runId);
  const durationMs = finite(raw.durationMs) && raw.durationMs > 0 && raw.durationMs <= MAX_PHASE_MS ? raw.durationMs : undefined;
  if (!runId || !validIso(raw.startedAt) || durationMs === undefined) return idle;
  const active: FocusTimerState = { ...idle, status, runId, startedAt: raw.startedAt, durationMs };
  if (status === "running") {
    if (!finite(raw.endsAt)) return idle;
    active.endsAt = raw.endsAt;
  } else {
    if (!finite(raw.remainingMs) || raw.remainingMs < 0) return idle;
    active.remainingMs = Math.min(raw.remainingMs, durationMs);
  }
  return active;
}

/* ---------------- time ---------------- */

const clamp = (n: number, lo: number, hi: number) => Math.min(Math.max(n, lo), hi);
export const phaseMinutes = (settings: FocusSettings, mode: FocusMode): number =>
  mode === "focus" ? settings.focusMinutes : mode === "short_break" ? settings.shortBreakMinutes : settings.longBreakMinutes;
export const phaseMs = (settings: FocusSettings, mode: FocusMode): number => phaseMinutes(settings, mode) * 60_000;

/** Length of the phase in progress, or of the next phase when idle. */
export function totalMs(state: FocusTimerState, settings: FocusSettings): number {
  return state.status !== "idle" && state.durationMs ? state.durationMs : phaseMs(settings, state.mode);
}

export function remainingMs(state: FocusTimerState, settings: FocusSettings, nowMs: number): number {
  const total = totalMs(state, settings);
  if (state.status === "running" && finite(state.endsAt)) return clamp(state.endsAt - nowMs, 0, total);
  if (state.status === "paused" && finite(state.remainingMs)) return clamp(state.remainingMs, 0, total);
  return total;
}

/** Time actually spent in the phase (pauses don't count). 0 when idle. */
export function elapsedMs(state: FocusTimerState, settings: FocusSettings, nowMs: number): number {
  if (state.status === "idle") return 0;
  return totalMs(state, settings) - remainingMs(state, settings, nowMs);
}

/** 0 (just started) to 1 (done). */
export function progressOf(state: FocusTimerState, settings: FocusSettings, nowMs: number): number {
  const total = totalMs(state, settings);
  return total > 0 ? clamp(elapsedMs(state, settings, nowMs) / total, 0, 1) : 0;
}

export function isExpired(state: FocusTimerState, nowMs: number): boolean {
  return state.status === "running" && finite(state.endsAt) && state.endsAt <= nowMs;
}

/** "25:00". Rounds up, so the display reads 00:00 only when the time is really up. */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** 25 -> "25 mnt", 90 -> "1 j 30 mnt", 120 -> "2 j". */
export function formatMinutes(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  if (m < 60) return `${m} mnt`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest === 0 ? `${h} j` : `${h} j ${rest} mnt`;
}

/* ---------------- transitions (all immutable) ---------------- */

export interface FocusLink { subjectId?: string; taskId?: string }

export function withLink(state: FocusTimerState, link: FocusLink): FocusTimerState {
  const { subjectId: _s, taskId: _t, ...rest } = state;
  const next: FocusTimerState = { ...rest };
  if (link.subjectId) next.subjectId = link.subjectId;
  if (link.taskId) next.taskId = link.taskId;
  return next;
}

/** idle -> running. Anything else is returned unchanged. */
export function beginPhase(state: FocusTimerState, settings: FocusSettings, nowMs: number, runId: string): FocusTimerState {
  if (state.status !== "idle") return state;
  const durationMs = phaseMs(settings, state.mode);
  return {
    mode: state.mode, status: "running", cycle: state.cycle,
    ...(state.subjectId ? { subjectId: state.subjectId } : {}),
    ...(state.taskId ? { taskId: state.taskId } : {}),
    runId, startedAt: new Date(nowMs).toISOString(), durationMs, endsAt: nowMs + durationMs,
  };
}

/** running -> paused. Not running, or already out of time: unchanged (the finish rule handles that). */
export function pausePhase(state: FocusTimerState, nowMs: number): FocusTimerState {
  if (state.status !== "running" || !finite(state.endsAt) || isExpired(state, nowMs)) return state;
  const { endsAt, ...rest } = state;
  return { ...rest, status: "paused", remainingMs: clamp(endsAt - nowMs, 0, state.durationMs ?? Infinity) };
}

/** paused -> running. The pause itself isn't counted: the new end is now + what was left. */
export function resumePhase(state: FocusTimerState, nowMs: number): FocusTimerState {
  if (state.status !== "paused" || !finite(state.remainingMs)) return state;
  const { remainingMs: left, ...rest } = state;
  return { ...rest, status: "running", endsAt: nowMs + left };
}

export type FocusEndReason = "completed" | "reset" | "skip";

export interface FocusEnd {
  /** false when the request didn't apply (e.g. "completed" before the time is up, or reset while idle). */
  changed: boolean;
  state: FocusTimerState;
  /** Only for focus phases, and only when it completed or ran at least MIN_RECORD_MINUTES. */
  session?: FocusSession;
}

const nextAfterSkip = (mode: FocusMode): FocusMode => (mode === "focus" ? "short_break" : "focus");

/**
 * Ends the current phase.
 *  - completed: the timer ran out. Focus -> saved as completed, cycle +1; the 4th one leads to a long break.
 *  - reset: back to idle in the same phase. A focus phase that ran >= 1 minute is saved as NOT completed.
 *  - skip: jump to the next phase (focus -> short break, break -> focus), without counting toward the cycle.
 *    Same saving rule as reset: never completed.
 * Breaks are never saved.
 */
export function endPhase(state: FocusTimerState, reason: FocusEndReason, nowMs: number, settings: FocusSettings = DEFAULT_FOCUS_SETTINGS): FocusEnd {
  if (reason === "completed" && !isExpired(state, nowMs)) return { changed: false, state };

  if (state.status === "idle") {
    if (reason !== "skip") return { changed: false, state };
    return { changed: true, state: idleState(nextAfterSkip(state.mode), state.cycle, state) };
  }

  const link: FocusLink = { subjectId: state.subjectId, taskId: state.taskId };
  const completed = reason === "completed";
  const total = totalMs(state, settings);
  const endMs = completed && finite(state.endsAt) ? state.endsAt : nowMs;
  const spent = completed ? total : elapsedMs(state, settings, nowMs);
  const minutes = completed ? Math.max(1, Math.round(spent / 60_000)) : Math.floor(spent / 60_000);

  let session: FocusSession | undefined;
  if (state.mode === "focus" && (completed || minutes >= MIN_RECORD_MINUTES)) {
    const endedAt = new Date(endMs).toISOString();
    session = {
      id: state.runId ?? `focus-${endMs}`,
      createdAt: endedAt,
      updatedAt: endedAt,
      ...(state.subjectId ? { subjectId: state.subjectId } : {}),
      ...(state.taskId ? { taskId: state.taskId } : {}),
      startedAt: state.startedAt ?? new Date(endMs - spent).toISOString(),
      endedAt,
      durationMinutes: minutes,
      completed,
    };
  }

  let next: FocusTimerState;
  if (reason === "reset") next = idleState(state.mode, state.cycle, link);
  else if (reason === "skip") next = idleState(nextAfterSkip(state.mode), state.cycle, link);
  else if (state.mode === "focus") {
    const finished = state.cycle + 1;
    next = finished >= LONG_BREAK_EVERY ? idleState("long_break", 0, link) : idleState("short_break", finished, link);
  } else next = idleState("focus", state.cycle, link);

  return { changed: true, state: next, session };
}

/** Same session id twice (two tabs, or a retry) never makes a duplicate. */
export function appendSession(list: readonly FocusSession[], session: FocusSession): FocusSession[] {
  return list.some((s) => s.id === session.id) ? [...list] : [...list, session];
}

/** The run a write is about: used to skip a stale write when another tab already moved the timer on. */
export function sameRun(a: FocusTimerState, b: FocusTimerState): boolean {
  return a.status === b.status && a.mode === b.mode && (a.runId ?? "") === (b.runId ?? "");
}

/* ---------------- subject / task choice ---------------- */

/** Tasks that can be picked for a session: not finished, nearest deadline first (tasks without one last). */
export function selectableTasks(tasks: readonly Task[], sort: (t: readonly Task[]) => Task[]): Task[] {
  return sort(tasks.filter((t) => !isTaskDone(t)));
}

/** Drops a subject that no longer exists and a task that is gone or already finished. */
export function sanitizeLink(link: FocusLink, subjectIds: ReadonlySet<string>, tasks: readonly Task[]): FocusLink {
  const out: FocusLink = {};
  if (link.subjectId && subjectIds.has(link.subjectId)) out.subjectId = link.subjectId;
  const task = link.taskId ? tasks.find((t) => t.id === link.taskId) : undefined;
  if (task && !isTaskDone(task)) out.taskId = task.id;
  return out;
}

/* ---------------- history and summaries ---------------- */

export interface FocusToday { minutes: number; sessions: number; completed: number }

const startMs = (s: Pick<FocusSession, "startedAt">): number | null => {
  const t = Date.parse(s.startedAt);
  return Number.isFinite(t) ? t : null;
};

/**
 * Focus time on the local day of `now`. Counts every saved session that started today (minutes are the
 * time really spent, so a stopped session counts for what it ran); `completed` counts only finished ones.
 * A session belongs to the day it started on.
 */
export function focusToday(sessions: readonly FocusSession[], now: Date): FocusToday {
  const today = toDateKey(now);
  const out: FocusToday = { minutes: 0, sessions: 0, completed: 0 };
  for (const s of sessions) {
    const t = startMs(s);
    if (t === null || toDateKey(new Date(t)) !== today) continue;
    out.sessions += 1;
    if (s.completed) out.completed += 1;
    if (Number.isFinite(s.durationMinutes) && s.durationMinutes > 0) out.minutes += s.durationMinutes;
  }
  return out;
}

/** Newest first. Sessions without a valid start time go last; ties fall back to id so the order is stable. */
export function sortSessions(sessions: readonly FocusSession[]): FocusSession[] {
  return [...sessions].sort((a, b) => {
    const ta = startMs(a), tb = startMs(b);
    if (ta === null && tb !== null) return 1;
    if (ta !== null && tb === null) return -1;
    if (ta !== null && tb !== null && ta !== tb) return tb - ta;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

const pad = (n: number) => String(n).padStart(2, "0");

/** "Hari ini, 14:05" / "Kemarin, 09:30" / "12 Nov, 20:10". Local time. "" when the start time is unusable. */
export function sessionWhen(session: FocusSession, now: Date): string {
  const t = startMs(session);
  if (t === null) return "";
  const d = new Date(t);
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const dayDiff = Math.round(
    (Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) - Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())) / 86_400_000,
  );
  if (dayDiff === 0) return `Hari ini, ${time}`;
  if (dayDiff === 1) return `Kemarin, ${time}`;
  const date = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short" }).format(d);
  return `${date}, ${time}`;
}
