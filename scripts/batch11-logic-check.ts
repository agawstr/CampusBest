// Phase 3 Batch 5 (Statistics + Settings + Export/Import) logic checks. Part A: Statistics. Part B: Settings.
// Run from the project root:  TZ=Asia/Jakarta npx tsx scripts/batch11-logic-check.ts
// Try other zones too (DST): TZ=America/New_York, TZ=Europe/London, TZ=Pacific/Auckland
export {}; // makes this file a module so the scripts don't share globals under `tsc`
import * as fs from "node:fs";
import * as path from "node:path";
import { buildStatistics, periodWindow, ALL_PERIOD_WEEKS, NO_SUBJECT_LABEL, STATS_PERIOD_OPTIONS, type StatisticsData } from "../src/lib/statistics";
import { countData, describeCounts, getAppInfo, saveWeekStartsOn, SettingsStorageError, weekStartFromValue, weekStartToValue, WEEK_START_OPTIONS } from "../src/lib/settings";
import { saveFocusSettings } from "../src/lib/focus-store";
import { APP_VERSION } from "../src/lib/pwa";
import { APP_DESCRIPTION, APP_NAME, APP_TAGLINE } from "../src/lib/brand";
import { STORAGE_KEYS, storage, LocalStorageAdapter, setStorageAdapter } from "../src/lib/storage";
import { MIGRATION_FLAG_KEY } from "../src/lib/storage-keys";
import {
  BACKUP_NAMES, COLLECTION_NAMES, MAX_BACKUP_CHARS, SUPPORTED_SCHEMA_VERSION, backupFilename, buildBackup, deepEqual, incomingWins, parseBackup,
  planImport, planIsNoop, verifyBackupMatches, type ImportMode, type ParsedBackup, type Snapshot,
} from "../src/lib/backup";
import { applyImport, backupFromSnapshot, BackupBuildError, createBackupFile, readSnapshot } from "../src/lib/backup-store";
import { downloadTextFile } from "../src/lib/download";
import type { CampusEvent, FocusSession, Subject, Task } from "../src/types";

// Minimal localStorage stand-in so the real storage layer can be exercised without a browser.
const mem = new Map<string, string>();
let blocked = false; // simulates blocked LocalStorage (private mode): every write throws, even the probe
(globalThis as any).window = {
  localStorage: {
    getItem: (k: string) => (mem.has(k) ? mem.get(k)! : null),
    setItem: (k: string, v: string) => { if (blocked) throw new DOMException("Access denied.", "SecurityError"); mem.set(k, String(v)); },
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
const view = (f: string) => fs.readFileSync(path.join(process.cwd(), f), "utf8");

/* ---------------- fixtures (every value is explicit; nothing random) ---------------- */
const NOW = new Date(2026, 10, 15, 10, 0); // Sun 15 Nov 2026, 10:00 local
const iso = (y: number, m: number, d: number, h = 9, min = 0) => new Date(y, m - 1, d, h, min).toISOString();
const base = { createdAt: iso(2026, 1, 1), updatedAt: iso(2026, 1, 1) };
const subj = (id: string, name: string, color = "#123456"): Subject => ({ ...base, id, name, color });
const task = (id: string, o: Partial<Task> = {}): Task => ({ ...base, id, title: id, priority: "medium", status: "todo", ...o });
const ev = (id: string, date: string, category: CampusEvent["category"] = "lainnya"): CampusEvent => ({
  ...base, id, title: id, type: category === "uts" || category === "uas" || category === "quiz" || category === "praktikum" ? "exam" : "other", category, date,
});
const ses = (id: string, startedAt: string, durationMinutes: number, o: Partial<FocusSession> = {}): FocusSession => ({
  ...base, id, startedAt, durationMinutes, completed: true, ...o,
});
const empty: StatisticsData = { tasks: [], subjects: [], events: [], focusSessions: [] };

/* ---------------- empty ---------------- */
for (const p of ["7d", "30d", "all"] as const) {
  const m = buildStatistics(empty, p, NOW);
  ok(`empty/${p}: hasData false`, m.hasData === false);
  eq(`empty/${p}: task stats all zero`, m.tasks, { total: 0, done: 0, open: 0, todo: 0, inProgress: 0, overdue: 0, percent: 0 });
  eq(`empty/${p}: no subject rows`, m.bySubject, []);
  eq(`empty/${p}: events zero`, m.events, { total: 0, byCategory: [], upcoming: 0, upcomingExams: 0 });
  ok(`empty/${p}: focus zero, no NaN`, m.focus.minutes === 0 && m.focus.sessions === 0 && m.focus.averageMinutes === 0 && m.focus.activeDays === 0);
}
eq("series length 7d / 30d / all", [7, 30, ALL_PERIOD_WEEKS], [7, 30, 12].map((n, i) => buildStatistics(empty, (["7d", "30d", "all"] as const)[i], NOW).focus.series.length === n ? n : -1));
eq("window 7d", periodWindow("7d", NOW), { from: "2026-11-09", to: "2026-11-15" });
eq("window 30d", periodWindow("30d", NOW), { from: "2026-10-17", to: "2026-11-15" });
eq("window all", periodWindow("all", NOW), null);

/* ---------------- tasks ---------------- */
const tasks: Task[] = [
  task("done-new", { status: "done", deadline: "2026-11-15" }),          // Phase 1 value, today
  task("done-p2", { status: "completed", deadline: "2026-11-09" }),      // first day of 7d
  task("wip", { status: "in_progress", deadline: "2026-11-12", subjectId: "s1" }),
  task("late", { status: "todo", deadline: "2026-11-10", subjectId: "s1" }), // overdue, inside 7d
  task("edge-out", { status: "todo", deadline: "2026-11-08" }),          // one day before 7d window, inside 30d
  task("legacy", { status: "todo", dueDate: "2026-10-20" } as Partial<Task>), // Phase 1 field, inside 30d only
  task("future", { status: "todo", deadline: "2026-11-20" }),            // after today
  task("nodate", { status: "todo", createdAt: iso(2026, 11, 14) }),     // falls back to createdAt (inside 7d)
  task("nodate-old", { status: "todo", createdAt: iso(2026, 3, 1) }),   // old createdAt, only in all
  task("badcreated", { status: "todo", createdAt: "nonsense" }),        // no usable date: only in all
];
const subjects = [subj("s1", "Algoritma", "#ff0000"), subj("s2", "Basis Data")];
const D: StatisticsData = { ...empty, tasks, subjects };
const t7 = buildStatistics(D, "7d", NOW).tasks;
const t30 = buildStatistics(D, "30d", NOW).tasks;
const tAll = buildStatistics(D, "all", NOW).tasks;
eq("7d tasks total (done-new, done-p2, wip, late, nodate)", t7.total, 5);
eq("7d: done counts both 'done' and 'completed'", t7.done, 2);
eq("7d: open/todo/inProgress", [t7.open, t7.todo, t7.inProgress], [3, 2, 1]);
eq("7d: overdue (late and wip both passed their deadline, not done)", t7.overdue, 2);
eq("7d: percent 2/5", t7.percent, 40);
eq("30d tasks total adds edge-out and legacy", t30.total, 7);
eq("all tasks total = every task", tAll.total, 10);
ok("all: invalid-createdAt task counted only in all", t30.total < tAll.total);
eq("all: percent 2/10", tAll.percent, 20);
ok("period boundary: deadline today-7 excluded from 7d, today-6 included", t7.total === 5 && buildStatistics({ ...empty, tasks: [task("a", { deadline: "2026-11-08" })] }, "7d", NOW).tasks.total === 0 && buildStatistics({ ...empty, tasks: [task("a", { deadline: "2026-11-09" })] }, "7d", NOW).tasks.total === 1);
eq("done + open == total in every period", ["7d", "30d", "all"].map((p) => { const t = buildStatistics(D, p as "7d", NOW).tasks; return t.done + t.open === t.total && t.todo + t.inProgress === t.open; }), [true, true, true]);

/* ---------------- by subject ---------------- */
const withFocus: StatisticsData = {
  ...D,
  tasks: [...tasks, task("orphan", { subjectId: "deleted", deadline: "2026-11-14" })],
  focusSessions: [
    ses("f1", iso(2026, 11, 14, 8), 25, { subjectId: "s2" }),
    ses("f2", iso(2026, 11, 13, 8), 30, { subjectId: "s1" }),
    ses("f3", iso(2026, 11, 13, 20), 15, { subjectId: "ghost" }),
  ],
};
const rows = buildStatistics(withFocus, "7d", NOW).bySubject;
eq("subject rows order: subjects by tasks desc, then focus-only, 'none' last", rows.map((r) => r.name), ["Algoritma", "Basis Data", NO_SUBJECT_LABEL]);
const algo = rows[0], bd = rows[1], none = rows[2];
eq("Algoritma: 2 tasks, 0 done, 30 min focus", [algo.tasks, algo.doneTasks, algo.percent, algo.focusMinutes], [2, 0, 0, 30]);
eq("Basis Data (no tasks) kept because of focus time", [bd.tasks, bd.focusMinutes], [0, 25]);
ok("tasks with deleted subject and sessions with unknown subject land in 'none'", none.subjectId === null && none.focusMinutes === 15 && none.tasks === 4 && none.color === undefined, none);
eq("subject task counts add up to the task total", rows.reduce((n, r) => n + r.tasks, 0), buildStatistics(withFocus, "7d", NOW).tasks.total);
eq("subject without tasks has percent 0 (no NaN)", bd.percent, 0);

/* ---------------- events ---------------- */
const events: CampusEvent[] = [
  ev("e-uts", "2026-11-18", "uts"), ev("e-quiz-past", "2026-11-10", "quiz"), ev("e-sem", "2026-11-15", "seminar"),
  ev("e-old", "2026-09-01", "uas"), ev("e-bad", "not-a-date", "lainnya"),
];
const e7 = buildStatistics({ ...empty, events }, "7d", NOW).events;
eq("7d events: only quiz (past) and seminar (today)", [e7.total, e7.byCategory.map((c) => `${c.category}:${c.count}`)], [2, ["quiz:1", "seminar:1"]]);
ok("'upcoming' ignores the period (today and later) and exam-like split", e7.upcoming === 2 && e7.upcomingExams === 1, e7);
const eAll = buildStatistics({ ...empty, events }, "all", NOW).events;
eq("all events include the invalid-date one", eAll.total, 5);
eq("category rows in the canonical order with labels", eAll.byCategory.map((c) => c.label), ["UTS", "UAS", "Quiz", "Seminar", "Lainnya"]);

/* ---------------- focus ---------------- */
const sessions: FocusSession[] = [
  ses("a", iso(2026, 11, 15, 7), 25),
  ses("b", iso(2026, 11, 15, 9), 10, { completed: false }),
  ses("c", iso(2026, 11, 9, 23, 30), 50),               // 23:30 local on the first day of 7d
  ses("d", iso(2026, 11, 8, 12), 40),                   // day before 7d
  ses("e", iso(2026, 10, 18, 12), 20),                  // inside 30d only
  ses("zero", iso(2026, 11, 14, 12), 0, { completed: false }), // counted as a session, adds 0 minutes
  ses("nan", iso(2026, 11, 14, 13), Number.NaN),
  ses("bad", "garbage", 99),                            // no start time: only in all, no chart bucket
  ses("old", iso(2026, 5, 4, 12), 60),                  // outside the 12 weeks
];
const F: StatisticsData = { ...empty, focusSessions: sessions };
const f7 = buildStatistics(F, "7d", NOW).focus;
eq("7d focus: sessions a,b,c,zero,nan", f7.sessions, 5);
eq("7d focus minutes (25+10+50)", f7.minutes, 85);
eq("7d completed (a,c,nan, zero is false)", f7.completed, 3);
eq("7d average = round(85/5)", f7.averageMinutes, 17);
eq("7d active days (15, 9, 14)", f7.activeDays, 3);
eq("7d chart minutes sum equals total", f7.series.reduce((n, b) => n + b.minutes, 0), f7.minutes);
eq("7d chart sessions sum equals total", f7.series.reduce((n, b) => n + b.sessions, 0), f7.sessions);
eq("7d chart keys are consecutive local days", f7.series.map((b) => b.key), ["2026-11-09", "2026-11-10", "2026-11-11", "2026-11-12", "2026-11-13", "2026-11-14", "2026-11-15"]);
eq("7d: a late-evening session stays on its local day", f7.series[0].minutes, 50);
const f30 = buildStatistics(F, "30d", NOW).focus;
eq("30d focus adds d and e", [f30.sessions, f30.minutes], [7, 145]);
eq("30d chart sums equal totals", [f30.series.reduce((n, b) => n + b.minutes, 0), f30.series.reduce((n, b) => n + b.sessions, 0)], [f30.minutes, f30.sessions]);
const fAll = buildStatistics(F, "all", NOW).focus;
eq("all focus counts every session, even without a valid start", fAll.sessions, 9);
eq("all focus minutes include the invalid-start and old ones", fAll.minutes, 25 + 10 + 50 + 40 + 20 + 99 + 60);
ok("all: weekly series is 12 buckets, one week apart, ending this week", fAll.seriesUnit === "week" && fAll.series.length === 12 && fAll.series[11].key === "2026-11-09", fAll.series.map((b) => b.key));
eq("all: weekly series holds only the last 12 weeks (excludes 'old' and 'bad')", fAll.series.reduce((n, b) => n + b.minutes, 0), 25 + 10 + 50 + 40 + 20);
eq("all: this week (Mon 09/11) holds a, b, c, zero, nan", fAll.series[11].sessions, 5);
eq("weekStartsOn Sunday moves the weekly buckets", buildStatistics(F, "all", NOW, 0).focus.series[11].key, "2026-11-15");
const noCompleted = buildStatistics({ ...empty, focusSessions: [ses("x", iso(2026, 11, 15, 8), 5, { completed: false })] }, "7d", NOW).focus;
eq("stopped-early session counts its real minutes but not as completed", [noCompleted.minutes, noCompleted.completed], [5, 0]);

/* ---------------- hasData, purity, unknown fields ---------------- */
ok("hasData true when only focus sessions exist, even if the period is empty", buildStatistics({ ...empty, focusSessions: [ses("old", iso(2026, 1, 1), 5)] }, "7d", NOW).hasData === true);
ok("hasData false with only subjects (no activity)", buildStatistics({ ...empty, subjects }, "all", NOW).hasData === false);
const frozen = JSON.stringify(withFocus);
buildStatistics(withFocus, "7d", NOW); buildStatistics(withFocus, "all", NOW);
eq("inputs are never mutated", JSON.stringify(withFocus), frozen);
const odd = task("odd", { status: "archived" as never, deadline: "2026-11-14", ...({ futureField: 1 } as object) });
eq("unknown status value does not crash and counts as not done", buildStatistics({ ...empty, tasks: [odd] }, "7d", NOW).tasks.open, 1);
eq("same input, same output (deterministic)", JSON.stringify(buildStatistics(withFocus, "30d", NOW)), JSON.stringify(buildStatistics(withFocus, "30d", NOW)));

eq("period labels are the clear ones", STATS_PERIOD_OPTIONS.map((o) => o.label), ["7 hari terakhir", "30 hari terakhir", "Semua waktu"]);

/* ---------------- source-level safety ---------------- */
const lib = view("src/lib/statistics.ts").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, ""); // code only, comments stripped
ok("lib/statistics never touches storage or the browser", !/storage|localStorage|window\.|document\./i.test(lib), "found storage/browser use");
ok("lib/statistics has no random or sample data", !/Math\.random|sample|dummy|faker/i.test(lib));
const comp = view("src/components/statistics/statistics-view.tsx");
ok("view only reads (no write/update/set/reset calls)", !/\.(set|update|reset|write|remove)\(/.test(comp) && !/storage\.write|clearAll/.test(comp));
ok("view reads the five collections it needs through useStorage", ["tasks", "subjects", "events", "focusSessions", "settings"].every((n) => new RegExp(`useStorage\\("${n}"\\)`).test(comp)));
ok("view has an empty state and a skeleton (no fake numbers)", /EmptyState/.test(comp) && /animate-pulse/.test(comp));
const page = view("src/app/statistics/page.tsx");
ok("/statistics is a server component with metadata and no longer a placeholder", /export const metadata/.test(page) && !/"use client"/.test(page) && !/PlaceholderPage/.test(page) && /StatisticsView/.test(page));
const nav = view("src/lib/navigation.ts");
ok("navigation: Statistics no longer carries placeholder copy", !/Belum ada statistik/.test(nav));
const pkg = JSON.parse(view("package.json"));
eq("no dependency added", Object.keys(pkg.dependencies).sort(), ["@radix-ui/react-dialog", "class-variance-authority", "clsx", "framer-motion", "lucide-react", "next", "react", "react-dom", "tailwind-merge"]);
ok("storage layer, keys and models untouched by part A (no statistics mention)", ["src/lib/storage.ts", "src/lib/storage-keys.ts", "src/lib/normalize.ts", "src/types/models.ts"].every((f) => !/statistics/i.test(view(f))));
ok("service worker VERSION matches package.json (0.12.0 after Batch 5)", new RegExp(`const VERSION = "${JSON.parse(view("package.json")).version.replace(/\./g, "\\.")}"`).test(view("public/sw.js")));


/* ================= Part B: Settings ================= */
(async () => {
  const SETTINGS = STORAGE_KEYS.settings;
  const rawSettings = () => JSON.parse(mem.get(SETTINGS) ?? "null");
  const timer = { mode: "focus", status: "running", cycle: 2, runId: "run-1", startedAt: "2026-11-15T01:00:00.000Z", durationMs: 1_500_000, endsAt: 1_900_000_000_000 };
  const seed = { theme: "light", sidebarCollapsed: true, weekStartsOn: 1, schemaVersion: 2, focus: { focusMinutes: 50, shortBreakMinutes: 10, longBreakMinutes: 20 }, focusTimer: timer, futureField: { keep: ["me"] } };

  // app info: the version really comes from the existing sources
  const pkg = JSON.parse(view("package.json"));
  const info = getAppInfo();
  eq("app info version is APP_VERSION", info.version, APP_VERSION);
  eq("APP_VERSION equals package.json and public/sw.js", [APP_VERSION, /const VERSION = "([^"]+)"/.exec(view("public/sw.js"))?.[1]], [pkg.version, pkg.version]);
  eq("app info identity comes from brand.ts", [info.name, info.tagline, info.description], [APP_NAME, APP_TAGLINE, APP_DESCRIPTION]);
  const aboutSrc = view("src/components/settings/about-card.tsx");
  ok("About card renders getAppInfo() and hard-codes no version number", /getAppInfo\(\)/.test(aboutSrc) && !/\b\d+\.\d+\.\d+\b/.test(aboutSrc) && !/\b\d+\.\d+\.\d+\b/.test(view("src/lib/settings.ts")));

  // week start
  eq("week start options", WEEK_START_OPTIONS.map((o) => [o.value, o.label]), [["1", "Senin"], ["0", "Minggu"]]);
  eq("week start value round trip", [weekStartFromValue(weekStartToValue(0)), weekStartFromValue(weekStartToValue(1))], [0, 1]);
  eq("unknown week start value falls back to Monday", [weekStartFromValue("x"), weekStartFromValue("")], [1, 1]);

  // saving a preference keeps everything else in the settings record, including a running timer and unknown fields
  mem.set(SETTINGS, JSON.stringify(seed));
  await saveWeekStartsOn(0);
  eq("saveWeekStartsOn changes only weekStartsOn", rawSettings(), { ...seed, weekStartsOn: 0 });
  await saveWeekStartsOn(1);
  eq("and back again", rawSettings().weekStartsOn, 1);
  eq("running timer survives a preference save", rawSettings().focusTimer, timer);
  eq("storage.read still sees the saved week start", (await storage.read("settings")).weekStartsOn, 1);

  // first save on an empty store creates only the settings key (no other collection keys)
  mem.clear();
  await saveWeekStartsOn(0);
  const created = [...mem.keys()].filter((k) => k !== STORAGE_KEYS.settings && !/migration_v1$/.test(k));
  eq("first save creates no other data key", created, []);
  eq("defaults are filled in around the new value", [rawSettings().theme, rawSettings().weekStartsOn], ["dark", 0]);

  // blocked storage: clear error, nothing written
  mem.clear(); mem.set(SETTINGS, JSON.stringify(seed));
  blocked = true;
  let err: unknown = null;
  try { await saveWeekStartsOn(0); } catch (e) { err = e; }
  blocked = false;
  ok("blocked storage throws SettingsStorageError", err instanceof SettingsStorageError);
  eq("and the stored settings are untouched", rawSettings(), seed);

  // Focus Timer settings go through the existing settings.focus, not a new place
  mem.clear(); mem.set(SETTINGS, JSON.stringify(seed));
  await saveFocusSettings({ focusMinutes: 30, shortBreakMinutes: 6, longBreakMinutes: 18 });
  eq("focus durations saved into settings.focus", rawSettings().focus, { focusMinutes: 30, shortBreakMinutes: 6, longBreakMinutes: 18 });
  eq("saving durations leaves the running timer, week start, theme and unknown fields alone", [rawSettings().focusTimer, rawSettings().weekStartsOn, rawSettings().theme, rawSettings().futureField], [timer, 1, "light", seed.futureField]);
  eq("storage keys: the original 7 plus activities (0.13.0)", Object.keys(STORAGE_KEYS).length, 8);
  ok("lib/settings.ts writes only through storage.update('settings')", /storage\.update\("settings"/.test(view("src/lib/settings.ts")) && !/localStorage|setRaw|STORAGE_KEYS|storage\.write\(/.test(view("src/lib/settings.ts").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")));

  // delete-all summary
  const counts = countData({ subjects: [subj("a", "A")], tasks, schedules: [], events, notes: [], focusSessions: sessions });
  eq("countData", counts, { subjects: 1, tasks: 10, schedules: 0, events: 5, notes: 0, focusSessions: 9 });
  eq("describeCounts skips empty collections", describeCounts(counts), "1 mata kuliah, 10 tugas, 5 ujian & event, 9 sesi fokus");
  eq("describeCounts is empty when there is nothing", describeCounts(countData({ subjects: [], tasks: [], schedules: [], events: [], notes: [], focusSessions: [] })), "");

  // page wiring (source level)
  const page = view("src/app/settings/page.tsx");
  ok("Settings keeps the PWA install card, the self-test card and the About card", /<InstallCard \/>/.test(page) && /<StorageCard \/>/.test(page) && /<AboutCard \/>/.test(page));
  ok("Settings keeps the theme control (AppearanceCard uses useTheme/setTheme)", /<AppearanceCard \/>/.test(page) && /useTheme\(\)/.test(view("src/components/settings/appearance-card.tsx")) && /setTheme\(value\)/.test(view("src/components/settings/appearance-card.tsx")));
  ok("ThemeProvider still saves the theme into settings", /storage\.update\("settings", \(s\) => \(\{ \.\.\.s, theme: next \}\)\)/.test(view("src/providers/theme-provider.tsx")));
  ok("Settings Focus card is the existing FocusSettingsCard wired to saveSettings from the focus provider", /<FocusSettingsCard title="Timer fokus" settings=\{focusSettings\} onSave=\{saveSettings\} \/>/.test(page) && /useFocusTimer\(\)/.test(page));
  ok("the Focus page still uses the same card with its default title", /<FocusSettingsCard settings=\{settings\} onSave=\{saveSettings\} \/>/.test(view("src/components/focus/focus-view.tsx")) && /title = "Durasi"/.test(view("src/components/focus/focus-settings-card.tsx")));
  ok("component preview (modal / bottom sheet / toast demo) is gone from Settings", !/Pratinjau komponen|Buka modal|Buka bottom sheet|Tampilkan toast|BottomSheet/.test(page));
  ok("delete-all keeps its confirmation, lists what is lost, and reports a failure", /ConfirmationDialog/.test(page) && /destructive/.test(page) && /describeCounts/.test(page) && /Gagal menghapus data/.test(page) && /storage\.clearAll\(\)/.test(page));
  ok("delete-all text still mentions focus sessions and CampusMate data", /sesi fokus/.test(page) && /CampusMate/.test(page));
  ok("Settings has a server layout with metadata", /export const metadata/.test(view("src/app/settings/layout.tsx")) && !/"use client"/.test(view("src/app/settings/layout.tsx")));
  ok("responsive: two columns from lg, one column below", /lg:grid-cols-2/.test(page) && /space-y-4/.test(page));
  ok("InstallCard file untouched in behaviour (still read-only, still has install + offline sections)", /Pasang aplikasi/.test(view("src/components/settings/install-card.tsx")) && /Pemakaian offline/.test(view("src/components/settings/install-card.tsx")) && !/storage\./.test(view("src/components/settings/install-card.tsx")));
  ok("no new storage key or dependency for Settings", !/campusbest_/.test(view("src/lib/settings.ts")) && Object.keys(JSON.parse(view("package.json")).dependencies).length === 9);


  /* ================= Part C: Export/Import ================= */
  const FIXED = new Date(2026, 10, 15, 10, 30);
  const emptySnap = (): Snapshot => ({ subjects: null, tasks: null, schedules: null, events: null, notes: null, focusSessions: null, activities: null, settings: null });
  const snapOf = (o: Partial<Snapshot>): Snapshot => ({ ...emptySnap(), ...o });
  const parsedOf = (o: Partial<Snapshot>): ParsedBackup => {
    const r = parseBackup(buildBackup(snapOf(o), FIXED).content);
    if (!r.ok) throw new Error("fixture invalid: " + r.errors.join("; "));
    return r.backup;
  };
  const withEnvelope = (patch: (f: any) => void, o: Partial<Snapshot> = {}): string => {
    const f = JSON.parse(buildBackup(snapOf(o), FIXED).content); patch(f); return JSON.stringify(f);
  };
  const errsOf = (text: string): string[] => { const r = parseBackup(text); return r.ok ? [] : r.errors; };
  const T = (n: number) => `2026-11-${String(n).padStart(2, "0")}T08:00:00.000Z`;
  const rt = (id: string, day: number | undefined, extra: Record<string, unknown> = {}) => ({ id, title: id, ...(day === undefined ? {} : { updatedAt: T(day) }), ...extra });

  // ---- export ----
  eq("filename uses local date and time", backupFilename(FIXED), "campusbest-backup-2026-11-15-1030.json");
  const legacyTask = { id: "t-old", title: "Lama", dueDate: "2026-11-20", status: "done", futureField: { a: [1, 2] } };
  const orphanEntry = "not-an-object";
  const dev = snapOf({
    tasks: [legacyTask, orphanEntry, rt("t2", 3)], subjects: [rt("s1", 1)], focusSessions: [{ id: "f1", startedAt: T(2), durationMinutes: 25, completed: true }],
    settings: { theme: "light", weekStartsOn: 0, schemaVersion: 2, focus: { focusMinutes: 50, shortBreakMinutes: 10, longBreakMinutes: 20 }, focusTimer: timer, futureField: 1 },
  });
  const devCopy = JSON.stringify(dev);
  const built = buildBackup(dev, FIXED);
  const env = JSON.parse(built.content);
  eq("export envelope", [env.app, env.format, env.formatVersion, env.schemaVersion, env.appVersion, env.exportedAt], ["CampusBest", "campusbest-backup", 1, SUPPORTED_SCHEMA_VERSION, APP_VERSION, FIXED.toISOString()]);
  eq("export counts", built.counts, { subjects: 1, tasks: 3, schedules: 0, events: 0, notes: 0, focusSessions: 1, activities: 0 });
  eq("export carries every collection and settings", Object.keys(env.data).sort(), [...BACKUP_NAMES].sort());
  eq("export keeps raw records verbatim (legacy fields, unknown fields, entries that are not objects)", env.data.tasks, dev.tasks);
  ok("export never contains the running timer", !("focusTimer" in env.data.settings) && !/endsAt/.test(built.content));
  eq("export keeps other settings and unknown settings fields", [env.data.settings.theme, env.data.settings.focus.focusMinutes, env.data.settings.futureField], ["light", 50, 1]);
  eq("export does not modify the snapshot", JSON.stringify(dev), devCopy);
  const nothing = JSON.parse(buildBackup(emptySnap(), FIXED).content);
  eq("export of an empty device: empty lists and {} settings", [nothing.data.tasks, nothing.data.settings, nothing.counts.tasks], [[], {}, 0]);
  eq("export of a non-list stored value becomes an empty list", JSON.parse(buildBackup(snapOf({ tasks: "garbage", settings: [1] }), FIXED).content).data, { subjects: [], tasks: [], schedules: [], events: [], notes: [], focusSessions: [], activities: [], settings: {} });

  // ---- round trip and verify ----
  const rtParsed = parseBackup(built.content);
  ok("export parses back as valid", rtParsed.ok === true);
  if (rtParsed.ok) {
    eq("round trip: every collection is identical", COLLECTION_NAMES.map((n) => deepEqual(rtParsed.backup.data[n], Array.isArray(dev[n]) ? dev[n] : [])), COLLECTION_NAMES.map(() => true));
    eq("round trip: settings identical minus the timer", rtParsed.backup.settings, { theme: "light", weekStartsOn: 0, schemaVersion: 2, focus: { focusMinutes: 50, shortBreakMinutes: 10, longBreakMinutes: 20 }, futureField: 1 });
    eq("meta read back", [rtParsed.backup.meta.appVersion, rtParsed.backup.meta.exportedAt, rtParsed.warnings.length], [APP_VERSION, FIXED.toISOString(), 1]); // 1 = the entry without an id
    eq("info counts unrecognized entries", rtParsed.backup.info.tasks, { total: 3, recognized: 2, unrecognized: 1, duplicateIds: 0 });
  }
  eq("verifyBackupMatches accepts a faithful backup", verifyBackupMatches(built.content, dev), null);
  ok("verifyBackupMatches rejects a backup of different data", verifyBackupMatches(built.content, snapOf({ ...dev, notes: [rt("n", 1)] })) !== null);
  ok("verifyBackupMatches rejects an unparseable backup", verifyBackupMatches("{", dev) !== null);

  // ---- validation ----
  const ok0 = (text: string) => parseBackup(text).ok === true;
  ok("empty text refused", !ok0("") && !ok0("   \n"));
  ok("invalid JSON refused (truncated file)", errsOf(built.content.slice(0, 80)).length === 1 && /JSON/.test(errsOf("{")[0]));
  ok("non-object roots refused", !ok0("[]") && !ok0("42") && !ok0("null") && !ok0('"x"'));
  ok("oversized text refused", !ok0("x".repeat(MAX_BACKUP_CHARS + 1)) && /besar/.test(errsOf("x".repeat(MAX_BACKUP_CHARS + 1))[0]));
  ok("a different app's JSON is refused", errsOf(JSON.stringify({ hello: "world" })).length > 0 && errsOf(withEnvelope((f) => { f.app = "Other"; })).some((e) => /bukan file cadangan CampusBest/.test(e)));
  ok("wrong format name refused", errsOf(withEnvelope((f) => { f.format = "x"; })).length > 0);
  ok("missing/invalid formatVersion refused", errsOf(withEnvelope((f) => { delete f.formatVersion; })).length > 0 && errsOf(withEnvelope((f) => { f.formatVersion = "1"; })).length > 0 && errsOf(withEnvelope((f) => { f.formatVersion = 0; })).length > 0);
  ok("newer formatVersion refused", errsOf(withEnvelope((f) => { f.formatVersion = 2; })).some((e) => /lebih baru/.test(e)));
  ok("newer schemaVersion refused", errsOf(withEnvelope((f) => { f.schemaVersion = SUPPORTED_SCHEMA_VERSION + 1; })).some((e) => /skema yang lebih baru/.test(e)));
  ok("missing or non-integer schemaVersion refused", errsOf(withEnvelope((f) => { delete f.schemaVersion; })).length > 0 && errsOf(withEnvelope((f) => { f.schemaVersion = 1.5; })).length > 0);
  ok("missing data refused", errsOf(withEnvelope((f) => { delete f.data; })).length > 0 && errsOf(withEnvelope((f) => { f.data = []; })).length > 0);
  for (const name of COLLECTION_NAMES) ok(`missing collection ${name} refused (never read as 'empty')`, errsOf(withEnvelope((f) => { delete f.data[name]; })).length === 1);
  ok("a collection that is not a list is refused", errsOf(withEnvelope((f) => { f.data.tasks = {}; })).length === 1 && errsOf(withEnvelope((f) => { f.data.notes = "x"; })).length === 1);
  ok("settings must be an object", errsOf(withEnvelope((f) => { delete f.data.settings; })).length === 1 && errsOf(withEnvelope((f) => { f.data.settings = []; })).length === 1);
  eq("all problems are reported together", errsOf(withEnvelope((f) => { delete f.data.tasks; delete f.data.notes; f.data.settings = 5; })).length, 3);
  ok("UTF-8 BOM in front is tolerated", ok0("\ufeff" + built.content));
  ok("unknown extra top-level fields do not matter", ok0(withEnvelope((f) => { f.somethingNew = { x: 1 }; })));
  const dupFile = parseBackup(withEnvelope((f) => { f.data.tasks = [rt("a", 1), rt("a", 2), "x", 7, null, { title: "no id" }, { id: "" }]; f.counts.tasks = 99; }));
  ok("duplicates, entries without id and a wrong counts header give warnings, not errors", dupFile.ok && dupFile.warnings.length === 3, dupFile);
  if (dupFile.ok) eq("info for odd entries", dupFile.backup.info.tasks, { total: 7, recognized: 2, unrecognized: 5, duplicateIds: 1 });
  const oldSchema = parseBackup(withEnvelope((f) => { f.schemaVersion = 1; }));
  ok("older schema accepted with a note", oldSchema.ok && oldSchema.warnings.some((w) => /skema lama/.test(w)));
  const withTimer = parseBackup(withEnvelope((f) => { f.data.settings.focusTimer = { mode: "focus", status: "running", endsAt: 1 }; }));
  ok("a focusTimer inside the file is dropped at parse time", withTimer.ok && !("focusTimer" in withTimer.backup.settings));
  ok("settings may be empty", ok0(withEnvelope((f) => { f.data.settings = {}; })));

  // ---- merge rule ----
  ok("incomingWins: later wins, earlier loses, equal keeps device", incomingWins(rt("a", 5), rt("a", 3)) && !incomingWins(rt("a", 3), rt("a", 5)) && !incomingWins(rt("a", 4), rt("a", 4)));
  ok("incomingWins: the side with a valid updatedAt beats the side without", incomingWins(rt("a", 1), rt("a", undefined)) && !incomingWins(rt("a", undefined), rt("a", 1)));
  ok("incomingWins: neither has one -> device stays; an unparseable value counts as missing", !incomingWins(rt("a", undefined), rt("a", undefined)) && !incomingWins({ id: "a", updatedAt: "garbage" }, { id: "a", updatedAt: "nope" }) && incomingWins(rt("a", 1), { id: "a", updatedAt: "nope" }));
  ok("deepEqual ignores key order but not content", deepEqual({ a: 1, b: [1, { c: 2 }] }, { b: [1, { c: 2 }], a: 1 }) && !deepEqual({ a: 1 }, { a: 2 }) && !deepEqual([1], [1, 2]) && !deepEqual({ a: 1 }, { a: 1, b: undefined }));

  // ---- merge plan ----
  const devM = snapOf({
    tasks: [rt("same", 2), rt("newer-here", 9), rt("older-here", 1), rt("tie", 5, { title: "device" }), rt("only-here-stamp", 4), rt("nostamp-here", undefined), legacyTask, "stray-entry"],
    subjects: [rt("s1", 1)],
    settings: { theme: "dark", weekStartsOn: 1, schemaVersion: 2, focusTimer: timer },
  });
  const fileM = parsedOf({
    tasks: [
      { ...rt("same", 2) }, // identical, even if key order differs: rebuilt below
      rt("newer-here", 3), rt("older-here", 7, { extra: "from file", futureField: [1] }), rt("tie", 5, { title: "file" }),
      rt("only-here-stamp", undefined), rt("nostamp-here", 2), rt("brand-new", 1, { unknownField: { deep: true } }),
      rt("dup", 1), rt("dup", 6, { title: "dup-newer" }), "stray-in-file", { title: "no id" },
    ],
    subjects: [rt("s1", 1), rt("s2", 1)], events: [rt("e1", 1)], notes: [rt("n1", 1)],
  });
  const devMCopy = JSON.stringify(devM), fileMCopy = JSON.stringify(fileM);
  const mp = planImport(devM, fileM, "merge");
  const tp = mp.collections.find((c) => c.name === "tasks")!;
  eq("merge tasks stats", { added: tp.added, updated: tp.updated, unchanged: tp.unchanged, keptCurrent: tp.keptCurrent, skipped: tp.skipped }, { added: 2, updated: 2, unchanged: 1, keptCurrent: 3, skipped: 2 });
  const mt = mp.writes.tasks as any[];
  eq("merge: result order = device order, updated in place, new appended", mt.map((x) => (typeof x === "string" ? x : x.id)), ["same", "newer-here", "older-here", "tie", "only-here-stamp", "nostamp-here", "t-old", "stray-entry", "brand-new", "dup"]);
  eq("merge: device copy stays when it is newer", mt[1], rt("newer-here", 9));
  eq("merge: file copy replaces an older device copy as a whole (unknown fields included)", mt[2], rt("older-here", 7, { extra: "from file", futureField: [1] }));
  eq("merge: equal timestamp keeps the device copy", mt[3].title, "device");
  eq("merge: device stamp beats file without stamp", mt[4], rt("only-here-stamp", 4));
  eq("merge: file stamp beats device without stamp", mt[5], rt("nostamp-here", 2));
  eq("merge: legacy device record untouched, byte for byte", mt[6], legacyTask);
  eq("merge: entries the app can't type stay where they were", mt[7], "stray-entry");
  eq("merge: new record keeps its unknown fields", mt[8], rt("brand-new", 1, { unknownField: { deep: true } }));
  eq("merge: same id twice in the file -> the newer one", mt[9].title, "dup-newer");
  eq("merge: no duplicate ids among recognized entries", new Set(mt.filter((x) => typeof x === "object").map((x) => x.id)).size, mt.filter((x) => typeof x === "object").length);
  const sp = mp.collections.find((c) => c.name === "subjects")!;
  eq("merge subjects: s1 unchanged, s2 added", [sp.unchanged, sp.added, sp.resulting], [1, 1, 2]);
  eq("merge: settings are never part of a merge", [mp.settings, "settings" in mp.writes], ["unchanged", false]);
  eq("merge: collections with nothing to change are not written", Object.keys(mp.writes).sort(), ["events", "notes", "subjects", "tasks"]);
  eq("merge does not mutate device snapshot or parsed file", [JSON.stringify(devM), JSON.stringify(fileM)], [devMCopy, fileMCopy]);
  eq("merge totals add up", mp.totals.resulting, mp.collections.reduce((n, c) => n + c.resulting, 0));
  // idempotent: merging what a merge produced, again, changes nothing
  const afterMerge = snapOf({ ...devM, ...(mp.writes as Partial<Snapshot>) });
  ok("merging the same file twice is a no-op the second time", planIsNoop(planImport(afterMerge, fileM, "merge")), planImport(afterMerge, fileM, "merge").collections.map((c) => [c.name, c.added, c.updated]));
  // a stored value that is not a list is kept as an entry
  const garbageMerge = planImport(snapOf({ notes: "stored-garbage" }), parsedOf({ notes: [rt("n1", 1)] }), "merge").writes.notes as unknown[];
  eq("merge keeps a non-list stored value instead of overwriting it", garbageMerge, ["stored-garbage", rt("n1", 1)]);
  ok("merging an empty file into an empty device writes nothing", planIsNoop(planImport(emptySnap(), parsedOf({}), "merge")));
  ok("merging into an empty device adds everything", planImport(emptySnap(), parsedOf({ tasks: [rt("a", 1), rt("b", 1)] }), "merge").collections.find((c) => c.name === "tasks")!.added === 2);

  // ---- replace plan ----
  const fileR = parsedOf({ tasks: [rt("x", 1), "stray", { title: "no id" }], subjects: [], events: [rt("e", 1)], settings: { theme: "light", weekStartsOn: 0, schemaVersion: 2, focus: { focusMinutes: 40, shortBreakMinutes: 8, longBreakMinutes: 16 } } });
  const rp = planImport(devM, fileR, "replace");
  eq("replace: every collection becomes exactly the file's list (unrecognized entries too)", [rp.writes.tasks, rp.writes.subjects, rp.writes.events], [fileR.data.tasks, [], [rt("e", 1)]]);
  eq("replace: settings come from the file, the device's running timer is carried over untouched", rp.writes.settings, { theme: "light", weekStartsOn: 0, schemaVersion: 2, focus: { focusMinutes: 40, shortBreakMinutes: 8, longBreakMinutes: 16 }, focusTimer: timer });
  const fileRT = parseBackup(withEnvelope((f) => { f.data.settings.focusTimer = { mode: "focus", status: "running", runId: "other", endsAt: 5 }; }, {}));
  ok("replace never takes a timer from the file", fileRT.ok && JSON.stringify(planImport(devM, fileRT.backup, "replace").writes.settings).includes('"run-1"') && !JSON.stringify(planImport(devM, fileRT.backup, "replace").writes.settings).includes('"other"'));
  ok("replace on a device without a timer writes none", !("focusTimer" in (planImport(snapOf({ settings: { theme: "dark" } }), fileR, "replace").writes.settings as object)));
  eq("replace stats show current -> resulting", rp.collections.filter((c) => ["tasks", "subjects"].includes(c.name)).map((c) => [c.name, c.current, c.incoming, c.resulting]), [["subjects", 1, 0, 0], ["tasks", 8, 3, 3]]);
  ok("replace warns when the file holds less data than the device", rp.warnings.length === 1 && /lebih sedikit/.test(rp.warnings[0]));
  ok("replace with an empty file on a device with data gives the strong warning", /tidak berisi data sama sekali/.test(planImport(devM, parsedOf({}), "replace").warnings[0]));
  ok("replace with identical data is a no-op", planIsNoop(planImport(snapOf({ tasks: [rt("a", 1)], settings: { theme: "dark" } }), parsedOf({ tasks: [rt("a", 1)], settings: { theme: "dark" } }), "replace")));
  eq("replace: absent keys + empty file creates nothing", Object.keys(planImport(emptySnap(), parsedOf({}), "replace").writes), []);
  eq("replace does not mutate its inputs", [JSON.stringify(devM), JSON.stringify(fileR)], [devMCopy, JSON.stringify(fileR)]);

  /* ---------- apply, against the real storage layer on the localStorage stand-in ---------- */
  class Faulty extends LocalStorageAdapter {
    sets: string[] = [];
    failWhen: (key: string, n: number) => boolean = () => false;
    drop = new Set<string>();
    async setRaw(key: string, value: unknown): Promise<void> {
      this.sets.push(key);
      if (this.failWhen(key, this.sets.length)) throw new DOMException("The quota has been exceeded.", "QuotaExceededError");
      if (this.drop.has(key)) return;
      return super.setRaw(key, value);
    }
  }
  const K = STORAGE_KEYS;
  const seedStore = (o: Partial<Record<keyof typeof K, unknown>>) => {
    mem.clear(); mem.set(MIGRATION_FLAG_KEY, JSON.stringify({ version: 1 }));
    for (const [n, v] of Object.entries(o)) mem.set(K[n as keyof typeof K], JSON.stringify(v));
  };
  const dumpMem = () => JSON.stringify([...mem.entries()].sort(([a], [b]) => (a < b ? -1 : 1)));
  const deviceSeed = {
    tasks: [legacyTask, rt("t2", 3), "stray"], subjects: [rt("s1", 1)], focusSessions: [{ id: "f1", startedAt: T(2), durationMinutes: 25, completed: true }],
    settings: { theme: "dark", weekStartsOn: 1, schemaVersion: 2, focusTimer: timer, futureField: { keep: true } },
  };
  const fileSeedSnap = snapOf({
    tasks: [rt("t2", 8, { title: "newer from file" }), rt("t3", 1)], subjects: [rt("s1", 1), rt("s2", 1)], events: [rt("e1", 1)], notes: [rt("n1", 1)], focusSessions: [{ id: "f2", startedAt: T(4), durationMinutes: 50, completed: true }],
    settings: { theme: "light", weekStartsOn: 0, schemaVersion: 2, focus: { focusMinutes: 50, shortBreakMinutes: 10, longBreakMinutes: 20 } },
  });
  const fileBackup = parsedOf(fileSeedSnap as Partial<Snapshot>);
  let faulty = new Faulty(); setStorageAdapter(faulty);
  const fresh = () => { faulty = new Faulty(); setStorageAdapter(faulty); };
  let delivered: string[] = [];
  let writesAtDelivery: number[] = [];
  const deliver = (f: { filename: string; content: string }) => { delivered.push(f.content); writesAtDelivery.push(faulty.sets.length); };

  // export through the real layer
  seedStore(deviceSeed);
  const beforeExport = dumpMem();
  const exported = await createBackupFile(FIXED);
  eq("createBackupFile writes nothing", dumpMem(), beforeExport);
  const expParsed = parseBackup(exported.content);
  ok("createBackupFile reflects raw storage, minus the timer", expParsed.ok && deepEqual(expParsed.backup.data.tasks, deviceSeed.tasks) && !("focusTimer" in expParsed.backup.settings) && (expParsed.backup as any).settings.futureField.keep === true);
  blocked = true;
  let buildErr: unknown = null;
  try { await createBackupFile(FIXED); } catch (e) { buildErr = e; }
  blocked = false;
  ok("createBackupFile throws BackupBuildError when storage is blocked", buildErr instanceof BackupBuildError);
  seedStore({});
  ok("an empty device exports a valid empty backup", (await createBackupFile(FIXED)).counts.tasks === 0 && parseBackup((await createBackupFile(FIXED)).content).ok === true);

  // merge, happy path
  seedStore(deviceSeed); fresh(); delivered = []; writesAtDelivery = [];
  const prevM = await readSnapshot();
  const untouchedBefore = [K.schedules, K.settings].map((k) => mem.get(k));
  const resM = await applyImport({ backup: fileBackup, mode: "merge", previewed: prevM, deliverBackup: deliver });
  ok("merge applied", resM.ok === true && resM.noChanges === false && resM.backupFilename === undefined, resM);
  eq("merge made no automatic backup", delivered.length, 0);
  eq("merge wrote only the collections that change", faulty.sets.sort(), [K.events, K.focusSessions, K.notes, K.subjects, K.tasks].sort());
  eq("merge left schedules and settings byte-identical (running timer, unknown settings fields)", [K.schedules, K.settings].map((k) => mem.get(k)), untouchedBefore);
  const tasksAfter = JSON.parse(mem.get(K.tasks)!);
  eq("merge result in storage: legacy record intact, newer file copy used, new added, stray kept", tasksAfter.map((x: any) => (typeof x === "string" ? x : x.id + ":" + (x.title ?? ""))), ["t-old:Lama", "t2:newer from file", "stray", "t3:t3"]);
  eq("merge: legacy fields survive verbatim", tasksAfter[0], legacyTask);
  eq("storage layer reads the merged data (and the legacy task still counts as done)", [(await storage.read("tasks")).length, (await storage.read("tasks")).some((t) => t.id === "t-old" && t.status === "done")], [3, true]);
  const resM2 = await applyImport({ backup: fileBackup, mode: "merge", previewed: await readSnapshot(), deliverBackup: deliver });
  ok("a merge repeated right away changes nothing", resM2.ok === true && resM2.noChanges === true);
  eq("...and writes nothing", faulty.sets.length, 5);

  // replace, happy path: the backup is delivered BEFORE any write and really contains the old data
  seedStore(deviceSeed); fresh(); delivered = []; writesAtDelivery = [];
  const prevR = await readSnapshot();
  const resR = await applyImport({ backup: fileBackup, mode: "replace", previewed: prevR, deliverBackup: deliver, now: FIXED });
  ok("replace applied and reports the backup file name", resR.ok === true && resR.backupFilename === "campusbest-backup-2026-11-15-1030.json", resR);
  eq("backup delivered exactly once, with zero data writes done at that moment", [delivered.length, writesAtDelivery], [1, [0]]);
  const bk = parseBackup(delivered[0]);
  ok("the delivered backup is valid and holds exactly the data that was replaced", bk.ok && deepEqual(bk.backup.data.tasks, deviceSeed.tasks) && deepEqual(bk.backup.data.subjects, deviceSeed.subjects) && deepEqual(bk.backup.data.focusSessions, deviceSeed.focusSessions) && (bk.backup as any).settings.futureField.keep === true);
  eq("replace: collections are now exactly the file's", [JSON.parse(mem.get(K.tasks)!), JSON.parse(mem.get(K.subjects)!), JSON.parse(mem.get(K.events)!), JSON.parse(mem.get(K.notes)!)], [fileBackup.data.tasks, fileBackup.data.subjects, fileBackup.data.events, fileBackup.data.notes]);
  eq("replace: old-only data is gone from storage (backup has it)", [JSON.parse(mem.get(K.tasks)!).some((t: any) => t.id === "t-old"), JSON.parse(mem.get(K.focusSessions)!).map((f: any) => f.id)], [false, ["f2"]]);
  const settingsAfter = JSON.parse(mem.get(K.settings)!);
  eq("replace: theme and preferences restored, device timer untouched, no timer from the file", [settingsAfter.theme, settingsAfter.weekStartsOn, settingsAfter.focus.focusMinutes, settingsAfter.focusTimer], ["light", 0, 50, timer]);
  eq("replace: the storage layer sees the restored settings", [(await storage.read("settings")).theme, (await storage.read("settings")).focusTimer?.runId], ["light", "run-1"]);
  eq("no storage key other than the known ones exists afterwards", [...mem.keys()].filter((k) => !Object.values(K).includes(k) && k !== MIGRATION_FLAG_KEY), []);

  // replace: backup cannot be delivered -> nothing written
  seedStore(deviceSeed); fresh();
  const before1 = dumpMem();
  const resNoBackup = await applyImport({ backup: fileBackup, mode: "replace", previewed: await readSnapshot(), deliverBackup: () => { throw new Error("download blocked"); } });
  ok("replace cancelled when the backup can't be downloaded", !resNoBackup.ok && resNoBackup.code === "backup_failed", resNoBackup);
  eq("...and not a single write happened", [dumpMem(), faulty.sets.length], [before1, 0]);
  const resAsync = await applyImport({ backup: fileBackup, mode: "replace", previewed: await readSnapshot(), deliverBackup: async () => { throw new Error("async fail"); } });
  ok("an async download failure cancels the replace too", !resAsync.ok && resAsync.code === "backup_failed" && dumpMem() === before1 && faulty.sets.length === 0);

  // stale preview
  seedStore(deviceSeed); fresh(); delivered = [];
  const stalePrev = await readSnapshot();
  mem.set(K.notes, JSON.stringify([rt("added-in-another-tab", 1)]));
  const beforeStale = dumpMem();
  const resStale = await applyImport({ backup: fileBackup, mode: "replace", previewed: stalePrev, deliverBackup: deliver });
  ok("import refused when storage changed after the preview", !resStale.ok && resStale.code === "stale" && dumpMem() === beforeStale && delivered.length === 0 && faulty.sets.length === 0, resStale);

  // storage blocked
  seedStore(deviceSeed); fresh(); delivered = [];
  const prevB = await readSnapshot(); blocked = true;
  const resBlocked = await applyImport({ backup: fileBackup, mode: "replace", previewed: prevB, deliverBackup: deliver });
  blocked = false;
  ok("blocked storage: refused, no backup attempt, nothing changed", !resBlocked.ok && resBlocked.code === "storage_unavailable" && delivered.length === 0);

  // write failure -> rollback of everything, for replace and merge, incl. keys that did not exist before
  for (const mode of ["replace", "merge"] as ImportMode[]) {
    for (const failAt of [1, 3, 5]) {
      seedStore({ tasks: deviceSeed.tasks, subjects: deviceSeed.subjects, settings: deviceSeed.settings }); // schedules, events, notes, focusSessions are absent keys
      fresh();
      const snapBefore = dumpMem();
      faulty.failWhen = (_k, n) => n === failAt;
      const res = await applyImport({ backup: fileBackup, mode, previewed: await readSnapshot(), deliverBackup: () => {} });
      const failedOk = !res.ok && res.code === "write_failed" && res.rolledBack === true;
      ok(`${mode}: write #${failAt} fails -> reported as rolled back`, failedOk, res);
      ok(`${mode}: write #${failAt} fails -> every key is exactly as before (absent keys removed again)`, dumpMem() === snapBefore);
    }
  }
  // the write "succeeds" but is silently dropped -> read-back catches it
  seedStore(deviceSeed); fresh(); faulty.drop.add(K.subjects);
  const snapDrop = dumpMem();
  const resDrop = await applyImport({ backup: fileBackup, mode: "replace", previewed: await readSnapshot(), deliverBackup: () => {} });
  ok("a silently dropped write is detected and rolled back", !resDrop.ok && resDrop.code === "write_failed" && resDrop.rolledBack === true && dumpMem() === snapDrop, resDrop);
  // rollback itself fails -> said honestly, with the keys concerned
  seedStore(deviceSeed); fresh();
  faulty.failWhen = (_k, n) => n >= 2; // first write works, everything after fails, including the rollback
  const resStuck = await applyImport({ backup: fileBackup, mode: "replace", previewed: await readSnapshot(), deliverBackup: () => {} });
  ok("when even the rollback fails, the result says so and names the key", !resStuck.ok && resStuck.code === "write_failed" && resStuck.rolledBack === false && (resStuck.rollbackFailed ?? []).length === 1 && /cadangan/.test(resStuck.message), resStuck);

  // replace that changes nothing
  seedStore(deviceSeed); fresh(); delivered = [];
  const sameAsDevice = parsedOf({ ...(await readSnapshot()) });
  const resSame = await applyImport({ backup: sameAsDevice, mode: "replace", previewed: await readSnapshot(), deliverBackup: deliver });
  ok("replace with identical data: no backup, no write", resSame.ok && resSame.noChanges && delivered.length === 0 && faulty.sets.length === 0, resSame);

  // old data with unknown fields and a running timer, restored from a file written by the same app
  seedStore(deviceSeed); fresh();
  const selfBackup = await createBackupFile(FIXED);
  seedStore({ tasks: [rt("other", 1)], settings: { theme: "light", focusTimer: { ...timer, runId: "run-2" } } }); fresh();
  const selfParsed = parseBackup(selfBackup.content);
  const resSelf = await applyImport({ backup: (selfParsed as any).backup, mode: "replace", previewed: await readSnapshot(), deliverBackup: () => {} });
  ok("restoring a backup produced by this app brings back legacy records and unknown fields exactly", resSelf.ok && deepEqual(JSON.parse(mem.get(K.tasks)!), deviceSeed.tasks) && JSON.parse(mem.get(K.settings)!).futureField.keep === true);
  eq("...while the timer that is running now stays the one running now", JSON.parse(mem.get(K.settings)!).focusTimer.runId, "run-2");

  setStorageAdapter(new LocalStorageAdapter());

  // ---- download helper ----
  const g = globalThis as any;
  const clicks: any[] = []; const revoked: string[] = []; let appended = 0, removed = 0;
  const realCreate = URL.createObjectURL, realRevoke = URL.revokeObjectURL;
  g.document = { createElement: () => { const a: any = { click: () => clicks.push({ href: a.href, download: a.download }), remove: () => { removed += 1; } }; return a; }, body: { appendChild: () => { appended += 1; } } };
  URL.createObjectURL = () => "blob:test"; URL.revokeObjectURL = (u: string) => { revoked.push(u); };
  downloadTextFile({ filename: "x.json", content: "{}", mime: "application/json" });
  eq("download: one click on a link carrying the file name and the blob", [clicks.length, clicks[0].download, clicks[0].href, appended, removed], [1, "x.json", "blob:test", 1, 1]);
  g.document.createElement = () => ({ click: () => { throw new Error("blocked"); }, remove: () => {} });
  let dlErr = false; try { downloadTextFile({ filename: "y.json", content: "{}", mime: "application/json" }); } catch { dlErr = true; }
  ok("download: a click that throws is rethrown and the blob released (so the caller can cancel)", dlErr && revoked.includes("blob:test"));
  URL.createObjectURL = (() => { throw new Error("no blob"); }) as any;
  let dlErr2 = false; try { downloadTextFile({ filename: "z.json", content: "{}", mime: "application/json" }); } catch { dlErr2 = true; }
  ok("download: createObjectURL failure is rethrown", dlErr2);
  delete g.document;
  let dlErr3 = false; try { downloadTextFile({ filename: "z.json", content: "{}", mime: "application/json" }); } catch { dlErr3 = true; }
  ok("download: no document -> throws", dlErr3);
  URL.createObjectURL = realCreate; URL.revokeObjectURL = realRevoke;

  // ---- source-level safety for part C ----
  const backupLib = view("src/lib/backup.ts").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  ok("lib/backup.ts is pure: no storage, no browser, no clock", !/storage|localStorage|window|document|Date\.now|new Date\(\)/.test(backupLib.replace(/StorageName/g, "")));
  const storeSrc = view("src/lib/backup-store.ts");
  ok("backup-store goes through the adapter and never clears or removes through the manager", /getStorageAdapter\(\)/.test(storeSrc) && !/clearAll|storage\.remove|localStorage/.test(storeSrc));
  ok("no new storage key and no change to the storage layer for backup", ["src/lib/storage.ts", "src/lib/storage-keys.ts", "src/lib/normalize.ts"].every((f) => !/campusbest-backup|backup-store|lib\/backup/.test(view(f))));
  ok("the running timer is excluded in the export code", /focusTimer: _ignored/.test(view("src/lib/backup.ts")));


  // ---- UI wiring for part C (source level; no browser here) ----
  const card = view("src/components/settings/backup-card.tsx");
  ok("the backup card sits right above the delete card in the right column", page.indexOf("<AboutCard />") < page.indexOf("<BackupCard />") && page.indexOf("<BackupCard />") < page.indexOf("Hapus semua data"));
  ok("card offers export and import, with a JSON-only hidden file input", /Ekspor data/.test(card) && /Impor dari file/.test(card) && /accept="\.json,application\/json"/.test(card) && /type="file"/.test(card));
  ok("import is parsed and previewed from the same plan that is applied (planImport / applyImport)", /parseBackup\(/.test(card) && /planImport\(/.test(card) && /applyImport\(/.test(card) && /previewed: picked\.snapshot/.test(card));
  ok("both modes offered, Replace needs an explicit confirmation and downloads via downloadTextFile", /Gabung/.test(card) && /Ganti semuanya/.test(card) && /understood/.test(card) && /deliverBackup: downloadTextFile/.test(card));
  ok("Replace button stays disabled until confirmed, and a no-op import cannot be run", /!noop && \(!replace \|\| understood\)/.test(card));
  ok("the app reloads after a successful import (fresh state everywhere)", (card.match(/window\.location\.reload\(\)/g) ?? []).length >= 2);
  ok("failure and rollback outcomes are shown to the user", /role="alert"/.test(card) && /data dikembalikan/.test(card) && /rollbackFailed/.test(card));
  ok("the card never writes storage itself", !/localStorage|storage\.(write|update|remove|clearAll)|setRaw/.test(card));
  ok("no undefined Tailwind colour tokens in the card", !/-warning/.test(card));

  console.log(`${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
