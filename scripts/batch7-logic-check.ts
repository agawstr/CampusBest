// Run from the project root (needs `npx tsx`, no install needed in the project):
//   TZ=Asia/Jakarta npx tsx scripts/batch7-logic-check.ts
// Try other zones too (DST): TZ=America/New_York, TZ=Europe/London, TZ=Pacific/Auckland
export {}; // makes this file a module so the scripts don't share globals under `tsc`
import * as fs from "node:fs";
import * as path from "node:path";

const mem = new Map<string, string>();
const writes = new Map<string, number>(); // setItem calls per key
let failWrites = false; // simulates a full LocalStorage: big writes throw, tiny probe writes still work
let failKey: string | null = null; // simulates a full LocalStorage for one key only
let blocked = false; // simulates blocked LocalStorage (private mode): every write throws, even the probe
(globalThis as any).window = {
  localStorage: {
    getItem: (k: string) => (mem.has(k) ? mem.get(k)! : null),
    setItem: (k: string, v: string) => {
      if (blocked) throw new DOMException("Access denied.", "SecurityError");
      if (failWrites && v.length > 20) throw new DOMException("The quota has been exceeded.", "QuotaExceededError");
      if (failKey !== null && k === failKey) throw new DOMException("The quota has been exceeded.", "QuotaExceededError");
      writes.set(k, (writes.get(k) ?? 0) + 1);
      mem.set(k, String(v));
    },
    removeItem: (k: string) => { mem.delete(k); },
    key: (i: number) => [...mem.keys()][i] ?? null,
    get length() { return mem.size; },
  },
  addEventListener: () => {},
};

let pass = 0, fail = 0;
const ok = (name: string, cond: boolean, extra?: unknown) => {
  if (cond) pass++; else { fail++; console.log("FAIL:", name, extra ?? ""); }
};
const eq = (name: string, a: unknown, b: unknown) => ok(name, JSON.stringify(a) === JSON.stringify(b), { got: a, want: b });
const throwsAsync = async (name: string, fn: () => Promise<unknown>, errName?: string) => {
  try { await fn(); ok(name, false, "did not throw"); } catch (e) { ok(name, errName ? (e as Error).name === errName : true, (e as Error).name); }
};

const M = 60_000;
const SETTINGS_KEY = "campusbest_settings";
const SESSIONS_KEY = "campusbest_focus_sessions";
const read = (key: string) => JSON.parse(mem.get(key) ?? "null");
const resetWorld = () => { mem.clear(); writes.clear(); failWrites = false; failKey = null; blocked = false; };

async function main() {
  const F = await import("@/lib/focus");
  const S = await import("@/lib/focus-store");
  const Dash = await import("@/lib/dashboard");
  const { sortTasks } = await import("@/lib/tasks");
  const { storage, migrateLegacyKeys } = await import("@/lib/storage");
  const { normalizeFocusSession, normalizeSettings } = await import("@/lib/normalize");
  const { STORAGE_KEYS } = await import("@/lib/storage-keys");
  type FocusSession = import("@/types").FocusSession;
  type FocusTimerState = import("@/types").FocusTimerState;
  type Task = import("@/types").Task;
  type Subject = import("@/types").Subject;

  const D = F.DEFAULT_FOCUS_SETTINGS;
  const t0 = Date.UTC(2026, 10, 18, 3, 0, 0);

  /* ================= constants, presets, formatting ================= */
  eq("defaults are 25 / 5 / 15", D, { focusMinutes: 25, shortBreakMinutes: 5, longBreakMinutes: 15 });
  eq("long break every 4 focus sessions", F.LONG_BREAK_EVERY, 4);
  eq("a stopped session needs 1 minute to be saved", F.MIN_RECORD_MINUTES, 1);
  eq("preset 25/5 is recognized", F.presetOf(D), "25-5");
  eq("preset 50/10 is recognized", F.presetOf({ focusMinutes: 50, shortBreakMinutes: 10, longBreakMinutes: 15 }), "50-10");
  eq("anything else is custom", [F.presetOf({ ...D, focusMinutes: 30 }), F.presetOf({ ...D, longBreakMinutes: 20 }), F.presetOf({ ...D, shortBreakMinutes: 10 })], ["custom", "custom", "custom"]);
  eq("the two presets offered", F.FOCUS_PRESETS.map((p) => p.label), ["25 / 5", "50 / 10"]);
  eq("formatClock", [F.formatClock(25 * M), F.formatClock(1), F.formatClock(0), F.formatClock(-5), F.formatClock(180 * M), F.formatClock(59_001), F.formatClock(59 * 1000)], ["25:00", "00:01", "00:00", "00:00", "180:00", "01:00", "00:59"]);
  eq("formatMinutes", [0, 25, 59, 60, 90, 125].map(F.formatMinutes), ["0 mnt", "25 mnt", "59 mnt", "1 j", "1 j 30 mnt", "2 j 5 mnt"]);

  /* ================= settings: normalize + validate ================= */
  eq("no stored focus settings -> undefined", [F.normalizeFocusSettings(undefined), F.normalizeFocusSettings("x"), F.normalizeFocusSettings([]), F.normalizeFocusSettings(null)], [undefined, undefined, undefined, undefined]);
  eq("empty object -> defaults", F.normalizeFocusSettings({}), D);
  eq("numeric strings are accepted", F.normalizeFocusSettings({ focusMinutes: "50", shortBreakMinutes: " 10 " }), { focusMinutes: 50, shortBreakMinutes: 10, longBreakMinutes: 15 });
  eq("out of range, fractional, negative, NaN fall back field by field", F.normalizeFocusSettings({ focusMinutes: 0, shortBreakMinutes: 61, longBreakMinutes: 20.5 }), D);
  eq("one bad field doesn't spoil the good ones", F.normalizeFocusSettings({ focusMinutes: 40, shortBreakMinutes: "abc", longBreakMinutes: 30 }), { focusMinutes: 40, shortBreakMinutes: 5, longBreakMinutes: 30 });
  eq("limits are inclusive", F.normalizeFocusSettings({ focusMinutes: 180, shortBreakMinutes: 1, longBreakMinutes: 120 }), { focusMinutes: 180, shortBreakMinutes: 1, longBreakMinutes: 120 });
  eq("resolveFocusSettings falls back to the defaults", [F.resolveFocusSettings(undefined), F.resolveFocusSettings({ ...D, focusMinutes: 50 }).focusMinutes], [D, 50]);

  const good = F.validateFocusSettings({ focusMinutes: " 30 ", shortBreakMinutes: "7", longBreakMinutes: "20" });
  eq("validate: trims and parses", good.ok && good.settings, { focusMinutes: 30, shortBreakMinutes: 7, longBreakMinutes: 20 });
  const bad = F.validateFocusSettings({ focusMinutes: "", shortBreakMinutes: "abc", longBreakMinutes: "121" });
  ok("validate: each bad field gets its own message", !bad.ok && !!bad.errors.focusMinutes && !!bad.errors.shortBreakMinutes && !!bad.errors.longBreakMinutes);
  const bad2 = F.validateFocusSettings({ focusMinutes: "25", shortBreakMinutes: "1.5", longBreakMinutes: "15" });
  ok("validate: fractions and zero are refused, good fields have no error", !bad2.ok && bad2.errors.focusMinutes === undefined && !!bad2.errors.shortBreakMinutes);
  ok("validate: zero and 181 minutes are refused", !F.validateFocusSettings({ focusMinutes: "0", shortBreakMinutes: "5", longBreakMinutes: "15" }).ok && !F.validateFocusSettings({ focusMinutes: "181", shortBreakMinutes: "5", longBreakMinutes: "15" }).ok);

  /* ================= saved timer: normalize ================= */
  const iso0 = new Date(t0).toISOString();
  eq("nothing stored -> undefined", [F.normalizeTimerState(undefined), F.normalizeTimerState(null), F.normalizeTimerState("x"), F.normalizeTimerState([])], [undefined, undefined, undefined, undefined]);
  eq("empty object -> idle focus, cycle 0", F.normalizeTimerState({}), { mode: "focus", status: "idle", cycle: 0 });
  const runningRaw = { mode: "focus", status: "running", cycle: 2, subjectId: "s1", taskId: "t1", runId: "r1", startedAt: iso0, durationMs: 25 * M, endsAt: t0 + 25 * M };
  eq("a valid running timer is kept as is", F.normalizeTimerState(runningRaw), runningRaw);
  const pausedRaw = { mode: "short_break", status: "paused", cycle: 1, runId: "r2", startedAt: iso0, durationMs: 5 * M, remainingMs: 2 * M };
  eq("a valid paused timer is kept as is", F.normalizeTimerState(pausedRaw), pausedRaw);
  eq("running without endsAt -> idle (keeps mode, cycle and link)", F.normalizeTimerState({ ...runningRaw, endsAt: undefined }), { mode: "focus", status: "idle", cycle: 2, subjectId: "s1", taskId: "t1" });
  for (const [name, patch] of Object.entries({
    "endsAt is text": { endsAt: "soon" }, "endsAt is NaN": { endsAt: NaN }, "no runId": { runId: undefined }, "empty runId": { runId: "" },
    "bad startedAt": { startedAt: "yesterday" }, "zero duration": { durationMs: 0 }, "negative duration": { durationMs: -1 }, "absurd duration": { durationMs: 99 * 3_600_000 },
  })) {
    eq(`running with ${name} -> idle`, F.normalizeTimerState({ ...runningRaw, ...patch })?.status, "idle");
  }
  eq("paused with negative remaining -> idle", F.normalizeTimerState({ ...pausedRaw, remainingMs: -5 })?.status, "idle");
  eq("paused remaining above the duration is clamped", F.normalizeTimerState({ ...pausedRaw, remainingMs: 99 * M })?.remainingMs, 5 * M);
  eq("unknown mode -> focus, unknown status -> idle", [F.normalizeTimerState({ mode: "nap" })?.mode, F.normalizeTimerState({ status: "stopped" })?.status], ["focus", "idle"]);
  eq("cycle: 7 and 1.5 -> 0, \"2\" -> 2", [7, 1.5, "2"].map((c) => F.normalizeTimerState({ cycle: c })?.cycle), [0, 0, 2]);
  eq("empty link ids are dropped", F.normalizeTimerState({ subjectId: "", taskId: "  " }), { mode: "focus", status: "idle", cycle: 0 });
  let threw = false;
  try { for (const junk of [1, true, "x", [], [1], { status: 5 }, { mode: {}, status: [], cycle: {} }, { status: "running", endsAt: {}, durationMs: [] }]) F.normalizeTimerState(junk); } catch { threw = true; }
  ok("garbage never throws", !threw);

  /* ================= time math (timestamps, never ticks) ================= */
  const idle = F.idleState("focus");
  const idleCopy = JSON.stringify(idle);
  eq("idle: full length remaining, nothing elapsed", [F.remainingMs(idle, D, t0), F.elapsedMs(idle, D, t0), F.progressOf(idle, D, t0)], [25 * M, 0, 0]);
  const run = F.beginPhase(idle, D, t0, "run1");
  eq("idle state not mutated by start", JSON.stringify(idle), idleCopy);
  eq("start: running, end = start + length, ISO start, run id", [run.status, run.endsAt, run.startedAt, run.runId, run.durationMs], ["running", t0 + 25 * M, iso0, "run1", 25 * M]);
  eq("remaining/elapsed/progress after 10 minutes", [F.remainingMs(run, D, t0 + 10 * M), F.elapsedMs(run, D, t0 + 10 * M), F.progressOf(run, D, t0 + 10 * M)], [15 * M, 10 * M, 0.4]);
  eq("expiry is at the end time, not before", [F.isExpired(run, t0 + 25 * M - 1), F.isExpired(run, t0 + 25 * M), F.isExpired(run, t0 + 99 * M)], [false, true, true]);
  eq("after the end: remaining stays 0, progress 1", [F.remainingMs(run, D, t0 + 26 * M), F.progressOf(run, D, t0 + 26 * M)], [0, 1]);
  eq("a clock set back can't show more than the full length", [F.remainingMs(run, D, t0 - 5 * M), F.elapsedMs(run, D, t0 - 5 * M)], [25 * M, 0]);
  eq("remaining is a pure function of the time (a jump from 1 to 24 minutes is exact, like a background tab)", [F.remainingMs(run, D, t0 + 1 * M), F.remainingMs(run, D, t0 + 24 * M)], [24 * M, 1 * M]);
  ok("start only applies to an idle timer", F.beginPhase(run, D, t0 + 5 * M, "other") === run);
  const D50 = { focusMinutes: 50, shortBreakMinutes: 10, longBreakMinutes: 15 };
  eq("changing the settings doesn't change a running phase, only an idle one", [F.remainingMs(run, D50, t0), F.remainingMs(idle, D50, t0), F.remainingMs(F.idleState("short_break"), D50, t0), F.remainingMs(F.idleState("long_break"), D50, t0)], [25 * M, 50 * M, 10 * M, 15 * M]);

  const paused = F.pausePhase(run, t0 + 10 * M);
  eq("pause: paused, 15 minutes left, no end time, same run", [paused.status, paused.remainingMs, paused.endsAt, paused.runId], ["paused", 15 * M, undefined, "run1"]);
  eq("while paused, time passing changes nothing", [F.remainingMs(paused, D, t0 + 11 * M), F.remainingMs(paused, D, t0 + 600 * M), F.elapsedMs(paused, D, t0 + 600 * M), F.progressOf(paused, D, t0 + 600 * M)], [15 * M, 15 * M, 10 * M, 0.4]);
  ok("pause on idle or on an expired timer is a no-op", F.pausePhase(idle, t0) === idle && F.pausePhase(run, t0 + 30 * M) === run);
  const resumed = F.resumePhase(paused, t0 + 70 * M);
  eq("resume: the pause isn't counted (new end = now + what was left)", [resumed.status, resumed.endsAt, resumed.remainingMs], ["running", t0 + 85 * M, undefined]);
  eq("after resuming, 5 minutes later: 10 left, 15 elapsed", [F.remainingMs(resumed, D, t0 + 75 * M), F.elapsedMs(resumed, D, t0 + 75 * M)], [10 * M, 15 * M]);
  ok("resume on a running timer is a no-op", F.resumePhase(run, t0) === run);
  eq("link helpers", [F.withLink(idle, { subjectId: "s", taskId: "t" }), F.withLink(F.withLink(idle, { subjectId: "s" }), {})], [{ mode: "focus", status: "idle", cycle: 0, subjectId: "s", taskId: "t" }, { mode: "focus", status: "idle", cycle: 0 }]);

  /* ================= ending a phase: what is recorded ================= */
  ok("\"completed\" before the time is up does nothing", !F.endPhase(run, "completed", t0 + 24 * M).changed);
  const runLinked = F.beginPhase(F.withLink(idle, { subjectId: "s1", taskId: "t1" }), D, t0, "run1");
  const done = F.endPhase(runLinked, "completed", t0 + 25 * M, D);
  eq("completed: saved as completed, 25 min, start/end ISO, same id, link kept", done.session, {
    id: "run1", createdAt: new Date(t0 + 25 * M).toISOString(), updatedAt: new Date(t0 + 25 * M).toISOString(), subjectId: "s1", taskId: "t1",
    startedAt: iso0, endedAt: new Date(t0 + 25 * M).toISOString(), durationMinutes: 25, completed: true,
  });
  eq("completed focus -> short break, cycle 1, link kept", done.state, { mode: "short_break", status: "idle", cycle: 1, subjectId: "s1", taskId: "t1" });
  const late = F.endPhase(run, "completed", t0 + 3 * 60 * M, D);
  eq("finished while the page was closed: ended at the planned end, not at 'now'", [late.session?.endedAt, late.session?.durationMinutes, late.session?.completed], [new Date(t0 + 25 * M).toISOString(), 25, true]);
  ok("a session without a link has no subjectId/taskId keys", !("subjectId" in (late.session ?? {})) && !("taskId" in (late.session ?? {})));
  eq("input state not mutated by endPhase", JSON.stringify(run), JSON.stringify(F.beginPhase(idle, D, t0, "run1")));

  // the full cycle: 4 completed focus sessions -> long break -> back to focus, cycle reset
  let st: FocusTimerState = F.idleState("focus");
  let clock = t0;
  const seen: string[] = [];
  const ids = new Set<string>();
  let saved = 0;
  for (let i = 0; i < 9; i++) {
    st = F.beginPhase(st, D, clock, `cycle-${i}`);
    clock += F.phaseMs(D, st.mode);
    const e = F.endPhase(st, "completed", clock, D);
    if (e.session) { saved++; ids.add(e.session.id); }
    st = e.state;
    seen.push(`${st.mode}:${st.cycle}`);
  }
  eq("cycle: focus,short,focus,short,focus,short,focus,LONG,focus", seen, ["short_break:1", "focus:1", "short_break:2", "focus:2", "short_break:3", "focus:3", "long_break:0", "focus:0", "short_break:1"]);
  eq("only the 5 focus phases were saved, each with its own id", [saved, ids.size], [5, 5]);
  const brk = F.endPhase(F.beginPhase(F.idleState("short_break", 2), D, t0, "b1"), "completed", t0 + 5 * M, D);
  eq("a finished break saves nothing and returns to focus, cycle kept", [brk.session, brk.state], [undefined, { mode: "focus", status: "idle", cycle: 2 }]);
  const longBrk = F.endPhase(F.beginPhase(F.idleState("long_break", 0), D, t0, "b2"), "completed", t0 + 15 * M, D);
  eq("a finished long break saves nothing", [longBrk.session, longBrk.state.mode], [undefined, "focus"]);

  const at = (seconds: number, reason: "reset" | "skip", s = run) => F.endPhase(s, reason, t0 + seconds * 1000, D);
  for (const reason of ["reset", "skip"] as const) {
    ok(`${reason}: 59.999 seconds is not saved`, at(59.999, reason).session === undefined);
    ok(`${reason}: 0 seconds is not saved`, at(0, reason).session === undefined);
    const exactly = at(60, reason).session;
    eq(`${reason}: exactly 60 seconds is saved, as NOT completed, 1 minute`, [exactly?.durationMinutes, exactly?.completed], [1, false]);
    eq(`${reason}: 89 seconds -> 1 minute (rounded down)`, at(89, reason).session?.durationMinutes, 1);
    eq(`${reason}: 5 minutes 30 seconds -> 5 minutes`, at(330, reason).session?.durationMinutes, 5);
    eq(`${reason}: endedAt is the moment of stopping`, at(330, reason).session?.endedAt, new Date(t0 + 330_000).toISOString());
    ok(`${reason}: never marked completed, minutes are whole numbers`, [60, 61, 600, 1499].every((sec) => { const s = at(sec, reason).session; return !!s && s.completed === false && Number.isInteger(s.durationMinutes); }));
    const shortRun = F.beginPhase(F.idleState("short_break"), D, t0, "br");
    ok(`${reason}: a break is never saved, however long it ran`, F.endPhase(shortRun, reason, t0 + 4 * M, D).session === undefined);
  }
  eq("reset: back to idle in the same phase, cycle kept", at(300, "reset").state, { mode: "focus", status: "idle", cycle: 0 });
  const skipLinked = F.endPhase(F.beginPhase(F.withLink(F.idleState("focus", 2), { subjectId: "s1" }), D, t0, "k1"), "skip", t0 + 5 * M, D);
  eq("skip focus: next is a SHORT break, cycle NOT counted, link kept", skipLinked.state, { mode: "short_break", status: "idle", cycle: 2, subjectId: "s1" });
  eq("skipping a long-break-due focus doesn't hand out the long break", F.endPhase(F.beginPhase(F.idleState("focus", 3), D, t0, "k2"), "skip", t0 + 5 * M, D).state.mode, "short_break");
  eq("skip a break -> focus", F.endPhase(F.beginPhase(F.idleState("long_break"), D, t0, "k3"), "skip", t0 + M, D).state.mode, "focus");
  eq("skip while idle moves to the next phase without saving", [F.endPhase(F.idleState("focus", 1), "skip", t0), F.endPhase(F.idleState("short_break", 1), "skip", t0).state.mode], [{ changed: true, state: { mode: "short_break", status: "idle", cycle: 1 } }, "focus"]);
  ok("reset while idle changes nothing", !F.endPhase(F.idleState("focus"), "reset", t0).changed);
  const pausedLong = F.pausePhase(F.beginPhase(F.idleState("focus"), D, t0, "p1"), t0 + 5 * M);
  const pausedEnd = F.endPhase(pausedLong, "reset", t0 + 90 * M, D);
  eq("paused time isn't counted: 5 min run, 85 min paused -> 5 minutes", pausedEnd.session?.durationMinutes, 5);
  ok("a paused timer can't be 'completed'", !F.endPhase(pausedLong, "completed", t0 + 999 * M).changed);

  const list0: FocusSession[] = [{ id: "a", createdAt: iso0, updatedAt: iso0, startedAt: iso0, durationMinutes: 25, completed: true }];
  const dup = { ...list0[0]!, id: "b" };
  const l1 = F.appendSession(list0, dup);
  const l2 = F.appendSession(l1, { ...dup, durationMinutes: 99 });
  eq("appendSession adds once; the same id again changes nothing (keeps the first)", [l1.length, l2.length, l2[1]?.durationMinutes], [2, 2, 25]);
  ok("appendSession doesn't mutate its input", list0.length === 1);
  ok("sameRun compares status, mode and run id", F.sameRun(run, { ...run }) && !F.sameRun(run, paused) && !F.sameRun(run, { ...run, runId: "x" }) && F.sameRun(F.idleState("focus"), F.idleState("focus", 2)) && !F.sameRun(F.idleState("focus"), F.idleState("short_break")));

  /* ================= persistence through the real storage layer ================= */
  resetWorld();
  const empty = await S.readTimer();
  eq("empty storage: idle focus timer with the defaults", [empty.timer, empty.settings], [{ mode: "focus", status: "idle", cycle: 0 }, D]);
  ok("reading wrote nothing", [...mem.keys()].every((k) => k === "campusbest_migration_v1"), [...mem.keys()]);
  eq("normalizeSettings of nothing has no focus keys and schemaVersion stays 2", [Object.keys(normalizeSettings(undefined)).sort(), normalizeSettings(undefined).schemaVersion], [["schemaVersion", "sidebarCollapsed", "theme", "weekStartsOn"], 2]);

  await storage.update("settings", (s) => ({ ...s, theme: "light", sidebarCollapsed: true, weekStartsOn: 0, futureField: { x: 1 } } as typeof s));
  await S.saveFocusSettings({ focusMinutes: 50, shortBreakMinutes: 10, longBreakMinutes: 15 });
  eq("durations are saved in settings.focus and survive a reload (raw JSON read back)", read(SETTINGS_KEY).focus, { focusMinutes: 50, shortBreakMinutes: 10, longBreakMinutes: 15 });
  eq("saving durations keeps the other settings, including unknown fields", [read(SETTINGS_KEY).theme, read(SETTINGS_KEY).sidebarCollapsed, read(SETTINGS_KEY).weekStartsOn, read(SETTINGS_KEY).futureField], ["light", true, 0, { x: 1 }]);
  eq("custom durations are used by the next phase", (await S.readTimer()).settings, { focusMinutes: 50, shortBreakMinutes: 10, longBreakMinutes: 15 });

  const started = await S.startTimer({ subjectId: "s1", taskId: "t1" }, t0);
  eq("start: running 50-minute focus with the chosen link", [started?.status, started?.durationMs, started?.endsAt, started?.subjectId, started?.taskId], ["running", 50 * M, t0 + 50 * M, "s1", "t1"]);
  const stored = read(SETTINGS_KEY).focusTimer;
  eq("saved raw: status, end time (a timestamp), run id", [stored.status, stored.endsAt, typeof stored.runId, stored.startedAt], ["running", t0 + 50 * M, "string", iso0]);
  const afterReload = (await S.readTimer()).timer;
  eq("after a reload the timer is the same, and 20 minutes later 30 are left (computed from the timestamp)", [afterReload.runId, F.remainingMs(afterReload, D50, t0 + 20 * M)], [stored.runId, 30 * M]);
  ok("starting again while running changes nothing", (await S.startTimer({}, t0 + M)) === null && read(SETTINGS_KEY).focusTimer.runId === stored.runId);

  await storage.update("settings", (s) => ({ ...s, theme: "dark" })); // what the theme toggle does
  ok("a theme change keeps the running timer and the durations", read(SETTINGS_KEY).focusTimer.runId === stored.runId && read(SETTINGS_KEY).focus.focusMinutes === 50);

  ok("pause saves the paused state", (await S.pauseTimer(t0 + 10 * M)) && read(SETTINGS_KEY).focusTimer.status === "paused" && read(SETTINGS_KEY).focusTimer.remainingMs === 40 * M && !("endsAt" in read(SETTINGS_KEY).focusTimer));
  ok("pause again does nothing", !(await S.pauseTimer(t0 + 11 * M)));
  const wBefore = writes.get(SETTINGS_KEY) ?? 0;
  const reloadedPaused = (await S.readTimer()).timer;
  eq("a paused timer is exact after any amount of time", F.remainingMs(reloadedPaused, D50, t0 + 99 * 60 * M), 40 * M);
  const wMid = writes.get(SETTINGS_KEY) ?? 0;
  ok("resume saves a new end time", (await S.resumeTimer(t0 + 100 * M)) && read(SETTINGS_KEY).focusTimer.endsAt === t0 + 140 * M && read(SETTINGS_KEY).focusTimer.status === "running");
  ok("resume again does nothing", !(await S.resumeTimer(t0 + 101 * M)));
  eq("only real state changes write: resume = 1 write, the repeated resume = none", [wMid - wBefore, (writes.get(SETTINGS_KEY) ?? 0) - wMid], [0, 1]);
  const wNoop = writes.get(SETTINGS_KEY) ?? 0;
  await S.startTimer({}); await S.pauseTimer(t0 + 102 * M); await S.pauseTimer(t0 + 103 * M); await S.resumeTimer(t0 + 104 * M); await S.resumeTimer(t0 + 105 * M);
  eq("no-op start/pause/resume calls don't rewrite settings (pause + resume = 2 writes in total)", (writes.get(SETTINGS_KEY) ?? 0) - wNoop, 2);

  ok("the link can't change while a phase runs", !(await S.setTimerLink({ subjectId: "other" })) && read(SETTINGS_KEY).focusTimer.subjectId === "s1");

  // finish after the page was closed for a long time
  resetWorld();
  const sA = await S.startTimer({ subjectId: "s1" }, t0);
  const resultA = await S.endTimer("completed", t0 + 2 * 60 * M);
  eq("finished while closed: changed, completed, planned end time, 25 minutes", [resultA.changed, resultA.session?.completed, resultA.session?.endedAt, resultA.session?.durationMinutes], [true, true, new Date(t0 + 25 * M).toISOString(), 25]);
  eq("one session stored with the run id, link and times", (read(SESSIONS_KEY) as FocusSession[]).map((s) => [s.id, s.subjectId, s.startedAt, s.completed]), [[sA?.runId, "s1", iso0, true]]);
  eq("timer moved on: short break, cycle 1, link kept, idle", read(SETTINGS_KEY).focusTimer, { mode: "short_break", status: "idle", cycle: 1, subjectId: "s1" });
  const again = await S.endTimer("completed", t0 + 2 * 60 * M + 1);
  ok("finishing again does nothing and doesn't duplicate", !again.changed && (read(SESSIONS_KEY) as unknown[]).length === 1);

  // two callers (two tabs, or Strict Mode) finishing the same run
  await S.startTimer({}, t0 + 3 * 60 * M); // short break
  await S.endTimer("completed", t0 + 4 * 60 * M); // back to focus
  const sB = await S.startTimer({}, t0 + 5 * 60 * M);
  const [r1, r2] = await Promise.all([S.endTimer("completed", t0 + 6 * 60 * M), S.endTimer("completed", t0 + 6 * 60 * M)]);
  eq("two simultaneous finishes: exactly one session for the run", (read(SESSIONS_KEY) as FocusSession[]).filter((s) => s.id === sB?.runId).length, 1);
  eq("...and the cycle moved on only once", [read(SETTINGS_KEY).focusTimer.mode, read(SETTINGS_KEY).focusTimer.cycle, [r1.changed, r2.changed].filter(Boolean).length], ["short_break", 2, 1]);

  // reset / skip
  resetWorld();
  await S.startTimer({}, t0);
  const rs = await S.endTimer("reset", t0 + 3 * M + 10_000);
  eq("reset after 3m10s: saved as NOT completed, 3 minutes, timer back to idle focus", [rs.session?.completed, rs.session?.durationMinutes, read(SETTINGS_KEY).focusTimer], [false, 3, { mode: "focus", status: "idle", cycle: 0 }]);
  await S.startTimer({}, t0 + 10 * M);
  await S.endTimer("reset", t0 + 10 * M + 30_000);
  eq("reset after 30 seconds: nothing saved", (read(SESSIONS_KEY) as unknown[]).length, 1);
  await S.startTimer({}, t0 + 20 * M);
  const sk = await S.endTimer("skip", t0 + 22 * M);
  eq("skip after 2 minutes: saved as NOT completed, next is a short break (cycle not counted)", [sk.session?.completed, sk.session?.durationMinutes, read(SETTINGS_KEY).focusTimer.mode, read(SETTINGS_KEY).focusTimer.cycle], [false, 2, "short_break", 0]);
  const before = (read(SESSIONS_KEY) as unknown[]).length;
  await S.startTimer({}, t0 + 30 * M);
  await S.endTimer("reset", t0 + 33 * M);
  await S.startTimer({}, t0 + 40 * M);
  await S.endTimer("completed", t0 + 45 * M);
  eq("breaks (reset or finished) add no sessions; a finished break returns to focus", [(read(SESSIONS_KEY) as unknown[]).length, read(SETTINGS_KEY).focusTimer.mode], [before, "focus"]);
  await S.startTimer({}, t0 + 50 * M);
  const expiredReset = await S.endTimer("reset", t0 + 50 * M + 30 * M);
  eq("reset pressed after the time was already up is saved as completed (the time really ran out)", [expiredReset.reason, expiredReset.session?.completed], ["completed", true]);

  ok("the link can be chosen while idle and is saved", (await S.setTimerLink({ subjectId: "s9", taskId: "t9" })) && read(SETTINGS_KEY).focusTimer.subjectId === "s9");
  ok("...and cleared", (await S.setTimerLink({})) && !("subjectId" in read(SETTINGS_KEY).focusTimer));

  // failures
  resetWorld();
  await S.startTimer({}, t0);
  failWrites = true;
  await throwsAsync("full storage: finishing throws instead of pretending", () => S.endTimer("completed", t0 + 25 * M), "QuotaExceededError");
  failWrites = false;
  eq("...and the timer is untouched (still running, no session)", [read(SETTINGS_KEY).focusTimer.status, mem.has(SESSIONS_KEY)], ["running", false]);
  const retry = await S.endTimer("completed", t0 + 26 * M);
  eq("retry works and records exactly one session", [retry.changed, (read(SESSIONS_KEY) as unknown[]).length], [true, 1]);

  resetWorld();
  await S.startTimer({}, t0);
  failKey = SETTINGS_KEY;
  await throwsAsync("session saved but the timer write fails: throws", () => S.endTimer("completed", t0 + 25 * M));
  failKey = null;
  eq("...the session is there once, the timer still says running", [(read(SESSIONS_KEY) as unknown[]).length, read(SETTINGS_KEY).focusTimer.status], [1, "running"]);
  const heal = await S.endTimer("completed", t0 + 26 * M);
  eq("the next attempt finishes the job with NO duplicate session", [heal.changed, (read(SESSIONS_KEY) as unknown[]).length, read(SETTINGS_KEY).focusTimer.mode], [true, 1, "short_break"]);

  resetWorld();
  blocked = true;
  for (const [name, fn] of Object.entries({
    start: () => S.startTimer({}), pause: () => S.pauseTimer(), resume: () => S.resumeTimer(), end: () => S.endTimer("reset"),
    link: () => S.setTimerLink({}), settings: () => S.saveFocusSettings(D),
  })) await throwsAsync(`blocked storage: ${name} throws StorageUnavailableError`, fn, "StorageUnavailableError");
  blocked = false;
  eq("blocked storage wrote nothing", [...mem.keys()], []);

  resetWorld();
  mem.set(SETTINGS_KEY, JSON.stringify({ theme: "light", keepMe: 1, focusTimer: { status: "running", endsAt: "soon" }, focus: { focusMinutes: "abc" } }));
  const damaged = await S.readTimer();
  eq("a damaged saved timer reads as idle and damaged durations as defaults", [damaged.timer, damaged.settings], [{ mode: "focus", status: "idle", cycle: 0 }, D]);
  await S.startTimer({}, t0);
  eq("starting over a damaged record works and keeps the other settings", [read(SETTINGS_KEY).focusTimer.status, read(SETTINGS_KEY).theme, read(SETTINGS_KEY).keepMe], ["running", "light", 1]);

  /* ================= FocusSession: old data and storage safety ================= */
  const legacy = normalizeFocusSession({ id: "f1", startedAt: "2026-11-01T02:00:00.000Z", durationMinutes: 25, completed: true, note: "keep" }, 0) as FocusSession & { note?: string };
  eq("old session: no endedAt, same fields, unknown fields kept", [legacy.endedAt, legacy.durationMinutes, legacy.completed, legacy.note], [undefined, 25, true, "keep"]);
  eq("durationMinutes as text, missing startedAt, non-boolean completed", [normalizeFocusSession({ id: "f2", durationMinutes: "40", completed: "yes", createdAt: "2026-11-01T00:00:00.000Z" }, 1)].map((s) => [s.durationMinutes, s.startedAt, s.completed]), [[40, "2026-11-01T00:00:00.000Z", false]]);
  ok("endedAt only accepts text", normalizeFocusSession({ id: "f3", endedAt: 5 }, 2).endedAt === undefined && normalizeFocusSession({ id: "f4", endedAt: iso0 }, 3).endedAt === iso0);

  resetWorld();
  mem.set(SESSIONS_KEY, JSON.stringify([{ id: "old", startedAt: "2026-11-01T02:00:00.000Z", durationMinutes: 10, completed: true }, 5, "x", null]));
  await S.startTimer({}, t0);
  await S.endTimer("completed", t0 + 25 * M);
  const rawList = read(SESSIONS_KEY) as unknown[];
  ok("saving a session keeps old records and non-object entries", rawList.length === 5 && rawList.includes(5) && rawList.includes("x") && rawList.includes(null));
  const oldRaw = rawList.find((r) => typeof r === "object" && r !== null && (r as { id?: string }).id === "old") as Record<string, unknown>;
  ok("the old record gained no endedAt key", !("endedAt" in oldRaw) && oldRaw.durationMinutes === 10);

  resetWorld();
  mem.set("campusmate_focus_sessions", JSON.stringify([{ id: "m1", startedAt: "2026-10-01T02:00:00.000Z", durationMinutes: 30, completed: true }]));
  migrateLegacyKeys((globalThis as any).window.localStorage);
  eq("migrated from campusmate_focus_sessions, legacy key untouched", [(await storage.read("focusSessions")).map((s) => s.durationMinutes), mem.has("campusmate_focus_sessions")], [[30], true]);

  resetWorld();
  const mk = (i: number): FocusSession => ({ id: `p${i}`, createdAt: iso0, updatedAt: iso0, startedAt: iso0, durationMinutes: 1, completed: true });
  await Promise.all(Array.from({ length: 20 }, (_, i) => storage.update("focusSessions", (l) => F.appendSession(l, mk(i)))));
  eq("20 parallel appends: 20 sessions", (await storage.read("focusSessions")).length, 20);
  await Promise.all(Array.from({ length: 5 }, () => storage.update("focusSessions", (l) => F.appendSession(l, mk(99)))));
  eq("5 parallel appends of the same id: one more", (await storage.read("focusSessions")).length, 21);

  /* ================= today's summary and history order ================= */
  const now = new Date(2026, 10, 18, 15, 0, 0);
  const at2 = (d: Date): string => d.toISOString();
  const sess = (id: string, d: Date | string, minutes: number, completed: boolean): FocusSession => {
    const s = typeof d === "string" ? d : at2(d);
    return { id, createdAt: s, updatedAt: s, startedAt: s, durationMinutes: minutes, completed };
  };
  const today = F.focusToday([
    sess("a", new Date(2026, 10, 18, 9, 0), 25, true),
    sess("b", new Date(2026, 10, 18, 10, 0), 7, false),
    sess("c", new Date(2026, 10, 17, 23, 59), 25, true),
    sess("d", new Date(2026, 10, 19, 0, 0), 25, true),
    sess("e", "not a date", 25, true),
  ], now);
  eq("today: minutes include stopped sessions, completed counts only finished ones", today, { minutes: 32, sessions: 2, completed: 1 });
  eq("a session at 00:30 local today is today, one at 23:30 yesterday is not (local day, not UTC)", [
    F.focusToday([sess("x", new Date(2026, 10, 18, 0, 30), 10, true)], now).sessions,
    F.focusToday([sess("y", new Date(2026, 10, 17, 23, 30), 10, true)], now).sessions,
  ], [1, 0]);
  eq("a session that started yesterday 23:50 belongs to yesterday even though it ended today", F.focusToday([sess("z", new Date(2026, 10, 17, 23, 50), 25, true)], now), { minutes: 0, sessions: 0, completed: 0 });
  eq("nothing -> zeros", F.focusToday([], now), { minutes: 0, sessions: 0, completed: 0 });
  eq("negative or NaN minutes add nothing", F.focusToday([sess("n", new Date(2026, 10, 18, 8, 0), -5, true), sess("m", new Date(2026, 10, 18, 8, 5), NaN, false)], now), { minutes: 0, sessions: 2, completed: 1 });

  const unsorted = [sess("b", new Date(2026, 10, 18, 9, 0), 1, true), sess("bad", "nope", 1, true), sess("a", new Date(2026, 10, 18, 9, 0), 1, true), sess("new", new Date(2026, 10, 18, 11, 0), 1, true), sess("old", new Date(2026, 10, 1, 9, 0), 1, true)];
  const copy = JSON.stringify(unsorted);
  eq("history: newest first, ties by id, unusable dates last", F.sortSessions(unsorted).map((s) => s.id), ["new", "a", "b", "old", "bad"]);
  eq("sorting doesn't mutate", JSON.stringify(unsorted), copy);
  const when = (d: Date | string) => F.sessionWhen(sess("w", d, 1, true), now);
  eq("labels: today, yesterday, older date, unusable", [when(new Date(2026, 10, 18, 9, 5)), when(new Date(2026, 10, 17, 23, 59)), when(new Date(2026, 10, 16, 10, 5)).endsWith(", 10:05") && when(new Date(2026, 10, 16, 10, 5)).startsWith("16"), when("nope")], ["Hari ini, 09:05", "Kemarin, 23:59", true, ""]);

  /* ================= subject / task choice ================= */
  const task = (id: string, status: string, deadline?: string, subjectId?: string): Task => ({ id, title: id, status, priority: "medium", createdAt: iso0, updatedAt: iso0, deadline, subjectId } as unknown as Task);
  const tasks = [task("later", "todo", "2026-12-01"), task("fin", "completed"), task("legacyDone", "done"), task("soon", "in_progress", "2026-11-20", "s1"), task("odd", "archived"), task("none", "todo")];
  eq("finished tasks aren't offered (completed and legacy done); unknown status still is; nearest deadline first", F.selectableTasks(tasks, (l) => sortTasks(l, "deadline")).map((t) => t.id), ["soon", "later", "odd", "none"]);
  eq("sanitizeLink keeps a valid pair", F.sanitizeLink({ subjectId: "s1", taskId: "soon" }, new Set(["s1"]), tasks), { subjectId: "s1", taskId: "soon" });
  eq("sanitizeLink drops a deleted subject, a finished task and a deleted task", [
    F.sanitizeLink({ subjectId: "gone" }, new Set(["s1"]), tasks), F.sanitizeLink({ taskId: "fin" }, new Set(), tasks), F.sanitizeLink({ taskId: "gone" }, new Set(), tasks),
  ], [{}, {}, {}]);

  resetWorld();
  const subj = (id: string): Subject => ({ id, name: id, color: "#fff", createdAt: iso0, updatedAt: iso0 });
  await storage.write("subjects", [subj("s1"), subj("s2")]);
  await storage.write("tasks", [task("t1", "todo", undefined, "s1")]);
  await storage.write("focusSessions", [{ ...sess("k1", new Date(2026, 10, 18, 9, 0), 25, true), subjectId: "s1", taskId: "t1" }]);
  const sessionsBefore = mem.get(SESSIONS_KEY);
  await storage.update("subjects", (l) => l.filter((s) => s.id !== "s1"));
  await storage.update("tasks", (l) => l.filter((t) => t.id !== "t1"));
  ok("deleting the subject and the task leaves the saved focus sessions byte-for-byte unchanged", mem.get(SESSIONS_KEY) === sessionsBefore);
  const kept = (await storage.read("focusSessions"))[0];
  eq("the session still points at the old ids (they just have no label now)", [kept?.subjectId, kept?.taskId, F.focusToday([kept!], new Date(2026, 10, 18, 12, 0)).minutes], ["s1", "t1", 25]);

  /* ================= dashboard summary ================= */
  const empty0 = Dash.buildDashboard({ tasks: [], subjects: [], schedules: [], events: [] }, now);
  eq("dashboard without focus data: zeros", empty0.focus, { minutes: 0, sessions: 0, completed: 0 });
  eq("dashboard model keeps its earlier parts and adds focus", Object.keys(empty0).sort(), ["dateLine", "events", "focus", "greeting", "progress", "stats", "tasks", "today"]);
  eq("dashboard stats are unchanged by focus data", Object.keys(empty0.stats).sort(), ["doneTasks", "openTasks", "overdueTasks", "subjects", "totalTasks", "upcomingEvents"]);
  const withFocus = Dash.buildDashboard({ tasks: [], subjects: [], schedules: [], events: [], focusSessions: [sess("a", new Date(2026, 10, 18, 9, 0), 25, true), sess("b", new Date(2026, 10, 17, 9, 0), 25, true)] }, now);
  eq("dashboard: today's focus time and finished sessions only", withFocus.focus, { minutes: 25, sessions: 1, completed: 1 });
  const snapshot = JSON.stringify([...mem.entries()]);
  Dash.buildDashboard({ tasks: [], subjects: [], schedules: [], events: [], focusSessions: await storage.read("focusSessions") }, now);
  ok("building the dashboard writes nothing", JSON.stringify([...mem.entries()]) === snapshot);

  /* ================= static guards ================= */
  const view = (f: string) => fs.readFileSync(path.join(process.cwd(), f), "utf8");
  const focusPage = view("src/app/focus/page.tsx");
  ok("/focus is a server component with metadata and no longer a placeholder", /export const metadata/.test(focusPage) && !/"use client"/.test(focusPage) && !/PlaceholderPage/.test(focusPage) && /FocusView/.test(focusPage));
  const providers = view("src/providers/app-providers.tsx");
  ok("the timer provider sits in AppProviders, inside ToastProvider (above every page)", providers.indexOf("<ToastProvider>") !== -1 && providers.indexOf("<ToastProvider>") < providers.indexOf("<FocusTimerProvider>") && providers.indexOf("</FocusTimerProvider>") < providers.indexOf("</ToastProvider>"));
  ok("AppProviders wraps the whole shell in layout.tsx", /<AppProviders>[\s\S]*<AppShell>\{children\}<\/AppShell>[\s\S]*<\/AppProviders>/.test(view("src/app/layout.tsx")));
  const fv = view("src/components/focus/focus-view.tsx");
  ok("FocusView keeps no timer of its own (no interval, no reducer, no storage writes)", !/setInterval|useReducer|storage\.(write|update)|localStorage/.test(fv) && /useFocusTimer\(\)/.test(fv));
  const provider = view("src/providers/focus-timer-provider.tsx");
  ok("the provider doesn't write storage itself or count ticks", !/storage\.(write|update)|setInterval|localStorage/.test(provider) && /endTimer/.test(provider) && /visibilitychange/.test(provider));
  const clockHook = view("src/hooks/use-focus-clock.ts");
  ok("the redraw clock never touches storage and only runs while active", !/storage|localStorage/.test(clockHook) && /if \(!active\) return/.test(clockHook) && /clearInterval/.test(clockHook));
  const focusUiFiles = ["src/components/focus/focus-view.tsx", "src/components/focus/focus-settings-card.tsx", "src/components/focus/focus-history.tsx", "src/components/focus/timer-ring.tsx", "src/components/layout/focus-mini-timer.tsx", "src/components/dashboard/focus-today-card.tsx"];
  ok("Focus UI never touches storage directly", focusUiFiles.every((f) => !/localStorage|sessionStorage|indexedDB|getStorageAdapter|storage\.(write|update|remove)/.test(view(f))));
  const walk = (dir: string): string[] => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]));
  const files = walk(path.join(process.cwd(), "src")).filter((f) => /\.(ts|tsx)$/.test(f));
  const rel = (f: string) => path.relative(process.cwd(), f).replace(/\\/g, "/");
  const badFiles = (re: RegExp) => files.filter((f) => re.test(fs.readFileSync(f, "utf8"))).map(rel);
  eq("only lib/focus-store.ts writes the timer into settings", badFiles(/focusTimer:\s*(?!undefined)[a-z{]/i).filter((f) => !/normalize\.ts$|focus\.ts$/.test(f)), ["src/lib/focus-store.ts"]);
  eq("no audio and no Notification API", badFiles(/new Audio\(|Notification\.requestPermission|new Notification\(|\bAudioContext\b/), []);
  eq("no UTC-based date keys in the Focus code", badFiles(/toISOString\(\)\s*\.\s*(slice|split|substring)/), []);
  ok("the mini timer hides on /focus and the header shows it", /pathname === "\/focus"/.test(view("src/components/layout/focus-mini-timer.tsx")) && /<FocusMiniTimer \/>/.test(view("src/components/layout/header.tsx")));
  ok("Settings' delete-all text mentions focus sessions", /sesi fokus/.test(view("src/app/settings/page.tsx")));
  ok("the model change is additive and optional (endedAt?, focus?, focusTimer?)", /endedAt\?: string/.test(view("src/types/models.ts")) && /focus\?: FocusSettings/.test(view("src/types/models.ts")) && /focusTimer\?: FocusTimerState/.test(view("src/types/models.ts")));
  eq("no new storage key (still the same 7)", Object.values(STORAGE_KEYS).sort(), ["campusbest_events", "campusbest_focus_sessions", "campusbest_notes", "campusbest_schedules", "campusbest_settings", "campusbest_subjects", "campusbest_tasks"]);
  const pkg = JSON.parse(view("package.json"));
  ok("version is 0.8.0 or later (0.x)", /^0\.([89]|[1-9]\d)\.\d+$/.test(pkg.version), pkg.version);
  eq("no dependency added", Object.keys(pkg.dependencies).sort(), ["@radix-ui/react-dialog", "class-variance-authority", "clsx", "framer-motion", "lucide-react", "next", "react", "react-dom", "tailwind-merge"]);
  eq("only Statistics is left as a placeholder", ["/focus", "/statistics", "/notes"].filter((h) => /PlaceholderPage/.test(view(`src/app${h}/page.tsx`))), ["/statistics"]);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}
main();
