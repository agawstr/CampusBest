// Calendar mini-batch 0.12.1: short titles inside month cells ("+N lagi").
// Run from the project root:  TZ=Asia/Jakarta npx tsx scripts/batch12-logic-check.ts
import * as fs from "node:fs";
import * as path from "node:path";
export {};

const mem = new Map<string, string>();
(globalThis as any).window = {
  localStorage: {
    getItem: (k: string) => (mem.has(k) ? mem.get(k)! : null),
    setItem: (k: string, v: string) => { mem.set(k, String(v)); },
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
const code = (f: string) => view(f).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

async function main() {
  const C = await import("@/lib/calendar");
  const { normalizeSchedule, normalizeTask, normalizeEvent } = await import("@/lib/normalize");
  type Entry = import("@/lib/calendar").CalendarEntry;

  const mk = (i: number, o: Partial<Entry> = {}): Entry => ({
    key: `k${i}`, kind: "event", date: "2026-11-16", sourceId: `s${i}`, title: `Judul ${i}`, shortTitle: `Judul ${i}`, ...o,
  });
  const list = (n: number) => Array.from({ length: n }, (_, i) => mk(i));

  /* ---------- previewEntries: pure counting ---------- */
  for (const max of [2, 3]) {
    for (let n = 0; n <= 8; n++) {
      const { shown, more } = C.previewEntries(list(n), max);
      ok(`n=${n} max=${max}: shown = min(n,max)`, shown.length === Math.min(n, max), shown.length);
      ok(`n=${n} max=${max}: more = n - shown (never negative)`, more === Math.max(0, n - max), more);
      ok(`n=${n} max=${max}: shown + more = total`, shown.length + more === n);
    }
  }
  eq("exactly at the limit: no '+N lagi'", C.previewEntries(list(2), 2).more, 0);
  eq("one over the limit: '+1 lagi'", C.previewEntries(list(3), 2).more, 1);
  eq("5 entries, xl limit 3: '+2 lagi'", C.previewEntries(list(5), 3).more, 2);
  eq("5 entries, lg limit 2: '+3 lagi'", C.previewEntries(list(5), 2).more, 3);
  eq("undefined entries (day without agenda)", C.previewEntries(undefined, 2), { shown: [], more: 0 });
  eq("empty list", C.previewEntries([], 3), { shown: [], more: 0 });
  eq("max 0 shows nothing, all remain", [C.previewEntries(list(4), 0).shown.length, C.previewEntries(list(4), 0).more], [0, 4]);
  eq("negative max is treated as 0", [C.previewEntries(list(4), -3).shown.length, C.previewEntries(list(4), -3).more], [0, 4]);
  eq("NaN max is treated as 0", [C.previewEntries(list(4), NaN).shown.length, C.previewEntries(list(4), NaN).more], [0, 4]);
  eq("fractional max is floored", C.previewEntries(list(5), 2.9).shown.length, 2);
  const src = list(4);
  const before = JSON.stringify(src);
  C.previewEntries(src, 2);
  ok("does not mutate the input", JSON.stringify(src) === before);
  ok("shown entries are the very same objects (no copies, no edits)", C.previewEntries(src, 2).shown.every((e, i) => e === src[i]));
  const long = mk(1, { title: "Presentasi Akhir Proyek Rekayasa Perangkat Lunak Lanjut Kelompok 7 Sesi Sore" });
  eq("long titles are passed through whole (truncation is CSS only)", C.previewEntries([long], 2).shown[0].title, long.title);

  /* ---------- against the real day list ---------- */
  const subjects = [{ id: "s1", name: "Basis Data", color: "#3b82f6", createdAt: "x", updatedAt: "x" }, { id: "s2", name: "Jaringan Komputer", color: "#22c55e", createdAt: "x", updatedAt: "x" }] as any[];
  // 2026-11-16 is a Monday (dayOfWeek 1).
  const schedules = [
    normalizeSchedule({ subjectId: "s2", dayOfWeek: 1, startTime: "13:00", endTime: "14:40", room: "R2", recurrence: "weekly", createdAt: "x" }, 0),
    normalizeSchedule({ subjectId: "s1", dayOfWeek: 1, startTime: "08:00", endTime: "09:40", room: "R1", recurrence: "weekly", createdAt: "x" }, 1),
  ];
  const tasks = [
    normalizeTask({ title: "Laporan praktikum", deadline: "2026-11-16", deadlineTime: "10:00", status: "todo", priority: "high", createdAt: "x" }, 0),
    normalizeTask({ title: "Tugas selesai", deadline: "2026-11-16", status: "completed", priority: "low", createdAt: "x" }, 1),
    normalizeTask({ title: "Tugas bulan depan", deadline: "2026-12-02", status: "todo", priority: "low", createdAt: "x" }, 2),
  ];
  const events = [
    normalizeEvent({ title: "Quiz 2", category: "quiz", date: "2026-11-16", startTime: "09:50", endTime: "10:30", createdAt: "x" }, 0),
    normalizeEvent({ title: "Seminar nasional", category: "seminar", date: "2026-11-17", createdAt: "x" }, 1),
  ];
  const sources = { schedules, tasks, events, subjects };
  const cells = C.monthGrid(2026, 10, 1);
  const byDate = C.entriesByDate(cells, sources);

  const day = byDate.get("2026-11-16")!;
  eq("Monday 16 Nov has 5 entries (2 classes, 1 event, 2 tasks)", day.length, 5);
  const detail = C.entriesForDate("2026-11-16", sources);
  eq("cell source (byDate) equals the detail card source (entriesForDate), same order", day.map((e) => e.key), detail.map((e) => e.key));
  eq("expected order: 08:00 class, 09:50 event, 10:00 task, 13:00 class, all-day task",
    detail.map((e) => e.title), ["Basis Data", "Quiz 2", "Laporan praktikum", "Jaringan Komputer", "Tugas selesai"]);

  const lg = C.previewEntries(day, 2), xl = C.previewEntries(day, 3);
  eq("lg shows the first 2 titles of the detail list", lg.shown.map((e) => e.title), detail.slice(0, 2).map((e) => e.title));
  eq("lg: '+3 lagi'", lg.more, 3);
  eq("xl shows the first 3 titles of the detail list", xl.shown.map((e) => e.title), detail.slice(0, 3).map((e) => e.title));
  eq("xl: '+2 lagi'", xl.more, 2);
  ok("xl shown starts with exactly lg shown (the CSS just hides the 3rd below xl)", xl.shown.slice(0, 2).every((e, i) => e === lg.shown[i]));
  ok("every shown title belongs to this date", xl.shown.every((e) => e.date === "2026-11-16"));
  ok("no title from another date leaks in (task of 2 Dec, event of 17 Nov)", !xl.shown.some((e) => e.title === "Tugas bulan depan" || e.title === "Seminar nasional"));
  ok("a completed task keeps done=true so the cell can strike it through", detail.find((e) => e.title === "Tugas selesai")?.done === true);

  const tue = byDate.get("2026-11-17")!;
  eq("a day with 1 entry: 1 title, no '+N lagi'", [C.previewEntries(tue, 2).shown.length, C.previewEntries(tue, 2).more], [1, 0]);
  const quiet = byDate.get("2026-11-18");
  eq("a day with nothing has no entry list and an empty preview", [quiet, C.previewEntries(quiet, 3)], [undefined, { shown: [], more: 0 }]);
  eq("kinds present (dots on small screens) still derive from the same list", C.kindsPresent(day), ["class", "event", "task"]);

  // Greyed days of a neighbouring month: their cells get the same treatment from the same function.
  const spill = cells.filter((c) => !c.inMonth && byDate.has(c.key));
  ok("grid cells outside the month still resolve through the same map", spill.every((c) => C.previewEntries(byDate.get(c.key), 2).shown.length > 0));

  // Every cell of the grid, every limit: shown + more always equals the entries the detail card would list.
  let consistent = true;
  for (const c of cells) {
    for (const max of [2, 3]) {
      const p = C.previewEntries(byDate.get(c.key), max);
      const d = C.entriesForDate(c.key, sources);
      if (p.shown.length + p.more !== d.length || p.shown.some((e, i) => e.key !== d[i].key)) consistent = false;
    }
  }
  ok("all cells in the month: preview agrees with the detail list in count and order", consistent);

  /* ---------- old calendar behaviour is untouched ---------- */
  eq("defaultSelectionFor: today when in month", C.defaultSelectionFor({ year: 2026, month: 10 }, "2026-11-16"), "2026-11-16");
  eq("defaultSelectionFor: 1st otherwise", C.defaultSelectionFor({ year: 2026, month: 11 }, "2026-11-16"), "2026-12-01");
  eq("shiftMonth wraps the year", C.shiftMonth({ year: 2026, month: 11 }, 1), { year: 2027, month: 0 });
  eq("monthGrid Nov 2026 (1 Nov is a Sunday, Monday start) is 6 rows", C.monthGrid(2026, 10, 1).length, 42);
  ok("agenda lists only days of the month that have something", C.agendaForMonth(cells, byDate).every((d) => d.entries.length > 0 && d.date.startsWith("2026-11")));
  ok("calendar still writes nothing (previewEntries and co. never touch storage)", mem.size === 0);

  /* ---------- source-level checks of the view ---------- */
  const v = view("src/components/calendar/calendar-view.tsx");
  const vc = code("src/components/calendar/calendar-view.tsx");
  const l = code("src/lib/calendar.ts");
  ok("view limits are 2 (lg) and 3 (xl)", /TITLES_LG = 2;/.test(v) && /TITLES_XL = 3;/.test(v));
  ok("the cell takes titles from byDate (same source as the detail card), not from a second computation", /const entries = byDate\.get\(cell\.key\);/.test(vc) && /previewEntries\(entries, TITLES_XL\)/.test(vc));
  ok("detail card still reads selectedEntries from byDate", /byDate\.get\(selected\)/.test(vc));
  // 0.12.2 (intentional change): the small-screen dots became compact chips (short label + start time).
  ok("below lg the cell shows compact chips (lg:hidden), not dots", /flex w-full min-w-0 flex-col gap-0\.5 lg:hidden/.test(vc) && !/kindsPresent\(/.test(vc) && /e\.shortTitle/.test(vc) && /e\.shortTime/.test(vc));
  ok("titles are hidden below lg (hidden ... lg:flex) and 3rd only from xl", /hidden min-w-0 flex-col gap-0\.5 text-left lg:flex/.test(vc) && /i >= TITLES_LG && "hidden xl:block"/.test(vc));
  ok("'+N lagi' exists for lg (hidden from xl) and for xl (hidden below xl) with the right counts", /xl:hidden">\+\{moreLg\} lagi/.test(vc) && /xl:block">\+\{moreXl\} lagi/.test(vc) && /const moreLg = previewEntries\(entries, TITLES_LG\)\.more/.test(vc) && /const moreXl = previewEntries\(entries, TITLES_XL\)\.more/.test(vc));
  ok("long titles cannot stretch a cell (title chip truncates, min-w-0, overflow-hidden, fixed heights)", /block truncate rounded px-1 text-\[11px\]/.test(vc) && /min-w-0/.test(vc) && /overflow-hidden/.test(vc) && /lg:h-\[6\.75rem\]/.test(vc) && /xl:h-\[8\.25rem\]/.test(vc));
  ok("full title stays reachable on hover (title attribute)", /title=\{e\.title\}/.test(vc));
  ok("cell label for screen readers is still the activity count (titles are aria-hidden)", /aria-label=\{`\$\{formatDateID/.test(vc) && /aria-hidden>\s*\{shown\.map/.test(vc));
  ok("today and selected highlights are kept", /isToday && "bg-accent text-accent-fg"/.test(vc) && /border-accent\/60 bg-accent\/15/.test(vc) && /aria-current=\{isToday \? "date" : undefined\}/.test(vc) && /aria-pressed=\{isSelected\}/.test(vc));
  ok("two-column layout still starts at lg", /lg:grid-cols-\[minmax\(0,1\.5fr\)_minmax\(0,1fr\)\]/.test(vc));
  ok("today is still the initial selection", /useState<string>\(\(\) => todayKey\(\)\)/.test(vc));
  ok("month navigation, 'Hari ini', mode switch kept", /goTo\(shiftMonth\(ym, -1\)\)/.test(vc) && /goTo\(shiftMonth\(ym, 1\)\)/.test(vc) && /Hari ini/.test(vc) && /SegmentedControl/.test(vc));
  ok("the view still only reads (no write/update/remove)", !/\.(set|update|reset|write|remove)\(/.test(vc) && !/storage\.write|clearAll/.test(vc));
  ok("lib/calendar still has no storage or browser access", !/storage|localStorage|window\.|document\./i.test(l));
  ok("no key built from UTC dates in the calendar", !/toISOString/.test(l) && !/toISOString/.test(vc));
  ok("KIND_TONE exported for the cell chips and unchanged otherwise", /export const KIND_TONE/.test(view("src/components/calendar/calendar-entry-row.tsx")));

  /* ---------- scope: nothing outside the calendar changed ---------- */
  ok("storage layer, keys, models and normalize do not mention previewEntries", ["src/lib/storage.ts", "src/lib/storage-keys.ts", "src/lib/normalize.ts", "src/types/models.ts"].every((f) => !/previewEntries/.test(view(f))));
  const pkg = JSON.parse(view("package.json"));
  eq("no dependency added", Object.keys(pkg.dependencies).sort(), ["@radix-ui/react-dialog", "class-variance-authority", "clsx", "framer-motion", "lucide-react", "next", "react", "react-dom", "tailwind-merge"]);
  ok("version 0.12.1 or 0.12.2 (0.12.2 after the abbreviation mini-batch)", ["0.12.1", "0.12.2", "0.13.0"].includes(pkg.version), pkg.version);
  ok("APP_VERSION and sw.js VERSION match package.json", view("src/lib/pwa.ts").includes(`APP_VERSION = "${pkg.version}"`) && view("public/sw.js").includes(`const VERSION = "${pkg.version}"`));
  ok("tailwind screens are defaults (lg 1024, xl 1280)", !/screens/.test(view("tailwind.config.ts")));

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}
main();
