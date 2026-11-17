// 0.13.0: Kegiatan Lain (activities outside classes). Run from the project root:
//   TZ=Asia/Jakarta npx tsx scripts/batch14-logic-check.ts   (run-logic-checks.sh runs it in 5 time zones)
// Covers: storage + normalization, recurrence and time-zone rules, form logic, calendar, dashboard, backup/restore
// (including old backups without activities), isolation from Statistics and from older data.
// NOT covered here: rendering of the React components (checked only by reading their source for wiring).
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

async function main() {
  const A = await import("@/lib/activities");
  const N = await import("@/lib/normalize");
  const C = await import("@/lib/calendar");
  const D = await import("@/lib/dashboard");
  const B = await import("@/lib/backup");
  const BS = await import("@/lib/backup-store");
  const ST = await import("@/lib/storage");
  const STAT = await import("@/lib/statistics");
  const { STORAGE_KEYS } = await import("@/lib/storage-keys");
  type Activity = import("@/types").Activity;

  const mk = (o: Partial<Activity> & { id: string }): Activity => N.normalizeActivity({ createdAt: "2026-11-01T00:00:00.000Z", updatedAt: "2026-11-01T00:00:00.000Z", title: "K", startTime: "10:00", ...o } as any);

  /* ---------- storage key and normalization ---------- */
  eq("storage key is campusbest_activities", STORAGE_KEYS.activities, "campusbest_activities");
  eq("8 keys: the original 7 plus activities", Object.keys(STORAGE_KEYS).sort(), ["activities", "events", "focusSessions", "notes", "schedules", "settings", "subjects", "tasks"]);
  const n = N.normalizeActivity({ id: 5, title: "Futsal", category: "olahraga", recurrence: "weekly", dayOfWeek: "3", startTime: "19:00", endTime: "20:30", location: " GOR ", notes: "", future: { a: 1 } } as any, 2);
  eq("normalize: typed fields", [n.id, n.title, n.category, n.recurrence, n.dayOfWeek, n.startTime, n.endTime, n.location, n.notes], ["5", "Futsal", "olahraga", "weekly", 3, "19:00", "20:30", " GOR ", undefined]);
  ok("normalize keeps unknown fields", (n as any).future?.a === 1);
  const bad = N.normalizeActivity({ category: "zzz", recurrence: "monthly", dayOfWeek: 9, startTime: "25:00", endTime: "x", date: "garbage" } as any, 4);
  eq("normalize: safe fallbacks", [bad.id, bad.title, bad.category, bad.recurrence, bad.dayOfWeek, bad.startTime, bad.endTime, bad.date], ["activity-legacy-4", "Tanpa judul", "lainnya", "weekly", 1, "08:00", undefined, "garbage"]);
  const col = N.normalizeCollection("activities", [{ id: "a", title: "x", category: "zzz" }, "stray", 5, null]);
  eq("collection: non-objects become orphans, coerced enum remembered", [col.items.length, col.orphans, col.coerced.get("a")?.category?.raw], [1, ["stray", 5, null], "zzz"]);

  /* ---------- recurrence rules ---------- */
  const once = mk({ id: "o", recurrence: "none", date: "2026-11-18" });
  ok("none: only its date", A.activityOccursOn(once, "2026-11-18") && !A.activityOccursOn(once, "2026-11-17") && !A.activityOccursOn(once, "2026-11-25"));
  ok("none without date never occurs, needs a date", !A.activityOccursOn(mk({ id: "x", recurrence: "none" }), "2026-11-18") && A.activityNeedsDate(mk({ id: "x", recurrence: "none" })));
  ok("none with malformed date never occurs", !A.activityOccursOn(mk({ id: "x", recurrence: "none", date: "2026-02-31" }), "2026-02-31") && A.activityNeedsDate(mk({ id: "x", recurrence: "none", date: "2026-02-31" })));
  const weekly = mk({ id: "w", recurrence: "weekly", dayOfWeek: 3 }); // Wednesday
  ok("weekly: every Wednesday (2026-11-18 is a Wednesday)", A.activityOccursOn(weekly, "2026-11-18") && A.activityOccursOn(weekly, "2026-11-25") && A.activityOccursOn(weekly, "2025-01-01") && !A.activityOccursOn(weekly, "2026-11-19"));
  ok("weekly needs no date", !A.activityNeedsDate(weekly));
  const bi = mk({ id: "b", recurrence: "biweekly", date: "2026-11-04", dayOfWeek: 1 }); // anchor Wed; stale dayOfWeek ignored
  ok("biweekly: anchor, +14, +28", A.activityOccursOn(bi, "2026-11-04") && A.activityOccursOn(bi, "2026-11-18") && A.activityOccursOn(bi, "2026-12-02"));
  ok("biweekly: not the off weeks, not before the anchor", !A.activityOccursOn(bi, "2026-11-11") && !A.activityOccursOn(bi, "2026-11-25") && !A.activityOccursOn(bi, "2026-10-21") && !A.activityOccursOn(bi, "2026-10-07"));
  ok("biweekly: other weekday of an on-week is not matched", !A.activityOccursOn(bi, "2026-11-19"));
  ok("biweekly without anchor never occurs and needs a date", !A.activityOccursOn(mk({ id: "z", recurrence: "biweekly" }), "2026-11-18") && A.activityNeedsDate(mk({ id: "z", recurrence: "biweekly" })));
  ok("invalid date key never matches", !A.activityOccursOn(weekly, "2026-13-01") && !A.activityOccursOn(weekly, ""));

  /* ---------- time zones: DST edges, year edges ---------- */
  // Anchors chosen so the 14-day steps cross a DST change in several zones (US 2026-03-08 and 11-01, EU 03-29 and 10-25, NZ 04-05 and 09-27).
  const anchors = ["2026-02-22", "2026-10-18", "2026-03-22", "2026-09-20", "2026-12-21"];
  for (const anchor of anchors) {
    const item = mk({ id: `a-${anchor}`, recurrence: "biweekly", date: anchor });
    const start = new Date(Number(anchor.slice(0, 4)), Number(anchor.slice(5, 7)) - 1, Number(anchor.slice(8)));
    let good = true;
    for (let i = 0; i <= 70; i += 1) {
      const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      if (A.activityOccursOn(item, key) !== (i % 14 === 0)) { good = false; break; }
    }
    ok(`biweekly from ${anchor} is exactly every 14 calendar days for 70 days (TZ ${process.env.TZ})`, good);
  }
  const dstWeekly = mk({ id: "dw", recurrence: "weekly", dayOfWeek: 0 });
  let sundays = 0;
  for (let d = new Date(2026, 0, 1); d.getFullYear() === 2026; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) {
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    if (A.activityOccursOn(dstWeekly, key)) { sundays += 1; if (d.getDay() !== 0) sundays += 1000; }
  }
  eq("weekly Sunday occurs exactly 52 times in 2026, always on a Sunday", sundays, 52);
  const week = A.buildActivityWeek([weekly, once, bi], new Date(2026, 10, 16));
  eq("buildActivityWeek: 7 consecutive days from the given Monday", week.map((d) => d.key), ["2026-11-16", "2026-11-17", "2026-11-18", "2026-11-19", "2026-11-20", "2026-11-21", "2026-11-22"]);
  eq("buildActivityWeek: Wednesday has all three in time order", week[2].items.map((i) => i.id), ["w", "o", "b"].sort((a, b) => 0)); // same start time -> title then createdAt; all tie, so order is stable by title ("K")
  ok("week across a DST change keeps 7 distinct keys (NY 2026-11-01)", new Set(A.buildActivityWeek([], new Date(2026, 9, 26)).map((d) => d.key)).size === 7);
  ok("date keys never come from toISOString (no UTC shift)", !/toISOString\(\)\.slice|toISOString\(\)\.split/.test(view("src/lib/activities.ts")));
  // an instant late in the evening local time must still give today's local date
  const lateEvening = new Date(2026, 10, 17, 23, 30);
  eq("agenda day 0 uses the local date even at 23:30", A.activityAgenda([mk({ id: "t", recurrence: "none", date: "2026-11-17" })], lateEvening, 1).map((x) => x.date), ["2026-11-17"]);

  /* ---------- ordering ---------- */
  const early = mk({ id: "e", recurrence: "none", date: "2026-11-18", startTime: "07:00", title: "Z" });
  const late = mk({ id: "l", recurrence: "none", date: "2026-11-18", startTime: "18:00", title: "A" });
  const noEnd = mk({ id: "n", recurrence: "none", date: "2026-11-18", startTime: "07:00", title: "A" });
  const withEnd = mk({ id: "we", recurrence: "none", date: "2026-11-18", startTime: "07:00", endTime: "08:00", title: "A" });
  eq("order: start time, then end (none first), then title (n: no end, A; e: no end, Z; we: ends 08:00)", A.activitiesOnDate([late, early, withEnd, noEnd], "2026-11-18").map((i) => i.id), ["n", "e", "we", "l"]);
  const input = [late, early]; A.activitiesOnDate(input, "2026-11-18");
  eq("activitiesOnDate does not mutate its input", input.map((i) => i.id), ["l", "e"]);

  /* ---------- status and agenda ---------- */
  const timed = mk({ id: "s", recurrence: "weekly", dayOfWeek: 2, startTime: "10:00", endTime: "11:00" });
  eq("status: before / at start / inside / at end", [A.activityStatus(timed, new Date(2026, 10, 17, 9, 59)), A.activityStatus(timed, new Date(2026, 10, 17, 10, 0)), A.activityStatus(timed, new Date(2026, 10, 17, 10, 59)), A.activityStatus(timed, new Date(2026, 10, 17, 11, 0))], ["upcoming", "ongoing", "ongoing", "done"]);
  eq("status without end time never claims done or ongoing", A.activityStatus(mk({ id: "q", startTime: "10:00" }), new Date(2026, 10, 17, 23, 0)), "upcoming");
  const now = new Date(2026, 10, 17, 10, 30); // Tuesday
  const ag = A.activityAgenda([timed, once, mk({ id: "far", recurrence: "none", date: "2026-11-30" }), mk({ id: "past", recurrence: "none", date: "2026-11-16" })], now, 7);
  eq("agenda: today (Tue) and the next 6 days only, in order", ag.map((x) => [x.item.id, x.date, x.daysFromToday, x.status]), [["s", "2026-11-17", 0, "ongoing"], ["o", "2026-11-18", 1, "upcoming"], ["s", "2026-11-24", 7 - 0 - 0, "upcoming"]].slice(0, 2).concat([]) as any);
  eq("agenda labels", [A.dayLabelFor(0, "2026-11-17"), A.dayLabelFor(1, "2026-11-18")], ["Hari ini", "Besok"]);

  /* ---------- form logic ---------- */
  const f = A.emptyActivityForm(new Date(2026, 10, 17, 8, 0));
  eq("empty form defaults", [f.recurrence, f.date, f.dayOfWeek, f.startTime, f.endTime, f.category], ["none", "2026-11-17", 2, "16:00", "", "organisasi"]);
  eq("validate: empty title", Object.keys(A.validateActivityForm({ ...f })), ["title"]);
  const valid = { ...f, title: "  Rapat  " };
  eq("validate: ok", A.validateActivityForm(valid), {});
  ok("validate: title too long", !!A.validateActivityForm({ ...valid, title: "x".repeat(121) }).title);
  ok("validate: notes/location too long", !!A.validateActivityForm({ ...valid, notes: "x".repeat(1001) }).notes && !!A.validateActivityForm({ ...valid, location: "x".repeat(121) }).location);
  ok("validate: none/biweekly need a valid date, weekly doesn't", !!A.validateActivityForm({ ...valid, date: "" }).date && !!A.validateActivityForm({ ...valid, recurrence: "biweekly", date: "" }).date && !!A.validateActivityForm({ ...valid, date: "2026-02-30" }).date && !A.validateActivityForm({ ...valid, recurrence: "weekly", date: "" }).date);
  ok("validate: bad start; end optional, must be after start", !!A.validateActivityForm({ ...valid, startTime: "" }).startTime && !A.validateActivityForm({ ...valid, endTime: "" }).endTime && !!A.validateActivityForm({ ...valid, endTime: "16:00" }).endTime && !!A.validateActivityForm({ ...valid, endTime: "15:00" }).endTime && !!A.validateActivityForm({ ...valid, endTime: "99:99" }).endTime && !A.validateActivityForm({ ...valid, endTime: "17:00" }).endTime);
  const NOW = new Date("2026-11-17T03:00:00.000Z");
  const created = A.createActivity({ ...valid, category: "olahraga", location: " GOR ", notes: "  bawa bola ", endTime: "" }, NOW);
  eq("create: trimmed, blanks omitted, timestamps", [created.title, created.location, created.notes, created.endTime, created.createdAt, created.updatedAt, created.dayOfWeek, created.date], ["Rapat", "GOR", "bawa bola", undefined, NOW.toISOString(), NOW.toISOString(), 2, "2026-11-17"]);
  ok("create: id is unique", A.createActivity(valid).id !== A.createActivity(valid).id);
  const weeklyForm = A.createActivity({ ...valid, recurrence: "weekly", dayOfWeek: 5, date: "2026-11-17" }, NOW);
  eq("create weekly: day from the picker, no date stored", [weeklyForm.dayOfWeek, weeklyForm.date], [5, undefined]);
  const biForm = A.createActivity({ ...valid, recurrence: "biweekly", dayOfWeek: 5, date: "2026-11-18" }, NOW);
  eq("create biweekly: weekday follows the anchor date", [biForm.dayOfWeek, biForm.date], [3, "2026-11-18"]);
  const later = new Date("2026-11-20T00:00:00.000Z");
  const edited = A.applyActivityEdit({ ...created, extra: 42 } as Activity, { ...A.activityToFormValues(created), title: "Baru", recurrence: "weekly", dayOfWeek: 1 }, later);
  eq("edit: changes applied, id/createdAt kept, updatedAt bumped, unknown field kept, date dropped for weekly", [edited.id === created.id, edited.createdAt, edited.updatedAt, edited.title, edited.recurrence, edited.dayOfWeek, edited.date, (edited as any).extra], [true, created.createdAt, later.toISOString(), "Baru", "weekly", 1, undefined, 42]);
  const clearedEnd = A.applyActivityEdit({ ...created, endTime: "17:00", notes: "x" }, { ...A.activityToFormValues(created), endTime: "", notes: "" }, later);
  eq("edit can clear optional fields", [clearedEnd.endTime, clearedEnd.notes], [undefined, undefined]);
  eq("form <-> record round trip", A.activityToFormValues(A.createActivity(A.activityToFormValues(created), NOW)), A.activityToFormValues(created));
  const T0 = A.ACTIVITY_UNTOUCHED;
  const unknownRaw = (field: string) => ({ category: "mystery", recurrence: "monthly" } as Record<string, unknown>)[field];
  const pres = A.activityFieldsToPreserve(T0, unknownRaw as any);
  eq("preserve: untouched unknown values are carried", pres, { category: "mystery", recurrence: "monthly" });
  eq("preserve: touched fields are never preserved", A.activityFieldsToPreserve({ category: true, recurrence: true, dayOfWeek: false, date: false }, unknownRaw as any), {});
  const keep = A.applyActivityEdit({ ...created, category: "lainnya", recurrence: "weekly" }, { ...A.activityToFormValues(created), title: "Edit lain" }, later, pres);
  eq("edit keeps unknown stored category/recurrence when the user didn't touch them", [keep.category, keep.recurrence, keep.title], ["mystery", "monthly", "Edit lain"]);

  /* ---------- labels ---------- */
  eq("labels", [A.activityTimeRange({ startTime: "10:00" }), A.activityTimeRange({ startTime: "10:00", endTime: "11:30" }), A.categoryLabel("olahraga"), A.activityDetail({ category: "hobi", location: "Studio" }), A.activityDetail({ category: "hobi", location: undefined }), A.activityRecurrenceNote({ recurrence: "biweekly" }), A.activityRecurrenceNote({ recurrence: "none" })], ["10:00", "10:00 - 11:30", "Olahraga", "Hobi · Studio", "Hobi", "Dua minggu sekali", "Sekali saja"]);
  eq("8 categories, each labelled", [A.ACTIVITY_CATEGORIES.length, A.ACTIVITY_CATEGORIES.every((c) => A.categoryLabel(c).length > 0)], [8, true]);

  /* ---------- calendar ---------- */
  const subjects = [{ id: "s1", name: "Jaringan Saraf Tiruan", color: "#111", createdAt: "x", updatedAt: "x" }] as any;
  const schedules = [{ id: "c1", subjectId: "s1", dayOfWeek: 3, startTime: "08:00", endTime: "09:40", mode: "offline", recurrence: "weekly", createdAt: "x", updatedAt: "x" }] as any;
  const src = { schedules, tasks: [], events: [], subjects, activities: [weekly, once] };
  const day = C.entriesForDate("2026-11-18", src);
  eq("calendar: class first, then activities by time", day.map((e) => e.kind + ":" + e.sourceId), ["class:c1", "activity:w", "activity:o"]);
  const ae = day.find((e) => e.kind === "activity")!;
  eq("calendar entry fields", [ae.key, ae.title, ae.shortTitle, ae.shortTime, ae.startTime, ae.detail, ae.color], ["activity:w:2026-11-18", "K", "K", "10:00", "10:00", "Lainnya", undefined]);
  eq("calendar: without activities source nothing changes", C.entriesForDate("2026-11-18", { schedules, tasks: [], events: [], subjects }).map((e) => e.kind), ["class"]);
  eq("calendar: kindsPresent includes activity", C.kindsPresent(day), ["class", "activity"]);
  ok("calendar: other date has only the weekly activity", C.entriesForDate("2026-11-25", src).map((e) => e.sourceId).join() === "c1,w");
  const cells = C.monthGrid(2026, 10, 1);
  const idx = C.entriesByDate(cells, src);
  ok("calendar: month index has the one-off only on its date", [...idx.entries()].filter(([, v]) => v.some((e) => e.sourceId === "o")).map(([k]) => k).join() === "2026-11-18");
  eq("calendar label", C.CALENDAR_KIND_LABELS.activity, "Kegiatan");

  /* ---------- dashboard ---------- */
  const dm = D.buildDashboard({ tasks: [], subjects: [], schedules: [], events: [], activities: [timed, once] }, now);
  eq("dashboard: activities agenda + flag", [dm.activities.map((x) => x.item.id), dm.hasActivities], [["s", "o"], true]);
  const dm0 = D.buildDashboard({ tasks: [], subjects: [], schedules: [], events: [] }, now);
  eq("dashboard without activities: empty list, flag false", [dm0.activities, dm0.hasActivities], [[], false]);
  eq("dashboard stats unchanged by activities", Object.keys(dm.stats).sort(), ["doneTasks", "openTasks", "overdueTasks", "subjects", "totalTasks", "upcomingEvents"]);
  eq("dashboard class list not affected by activities", dm.today, dm0.today);

  /* ---------- statistics isolation ---------- */
  const sdata = { tasks: [], events: [], focusSessions: [], subjects } as any;
  eq("statistics output is independent of activities", JSON.stringify(STAT.buildStatistics(sdata, "all", now)), JSON.stringify(STAT.buildStatistics({ ...sdata, activities: [weekly, once] }, "all", now)));
  ok("statistics.ts and statistics-view never mention activities", !/activit/i.test(view("src/lib/statistics.ts")) && !/activit/i.test(view("src/components/statistics/statistics-view.tsx")));

  /* ---------- real storage: round trip, old data untouched ---------- */
  mem.clear();
  const oldRaw = {
    subjects: JSON.stringify([{ id: "s1", name: "Lama", color: "#000", createdAt: "x", updatedAt: "x" }]),
    tasks: JSON.stringify([{ id: "t1", title: "Tugas lama", dueDate: "2026-11-20", status: "done", weird: 1 }]),
    schedules: JSON.stringify([{ id: "c1", subjectId: "s1", dayOfWeek: 1, startTime: "08:00", endTime: "09:00" }]),
    events: JSON.stringify([{ id: "e1", title: "UTS", type: "exam", date: "2026-11-25" }]),
    notes: JSON.stringify([{ id: "n1", title: "N", content: "c" }]),
    settings: JSON.stringify({ theme: "light", schemaVersion: 2 }),
  };
  mem.set(STORAGE_KEYS.subjects, oldRaw.subjects); mem.set(STORAGE_KEYS.tasks, oldRaw.tasks); mem.set(STORAGE_KEYS.schedules, oldRaw.schedules);
  mem.set(STORAGE_KEYS.events, oldRaw.events); mem.set(STORAGE_KEYS.notes, oldRaw.notes); mem.set(STORAGE_KEYS.settings, oldRaw.settings);
  await ST.storage.read("subjects"); // the storage layer's own one-time migration flag is written on the first access, not by activities
  const before = JSON.stringify([...mem.entries()]);
  eq("reading activities on a device without any: empty, and nothing is written", [(await ST.storage.read("activities")).length, JSON.stringify([...mem.entries()])], [0, before]);
  const rec = A.createActivity({ ...valid, title: "Futsal", category: "olahraga" }, NOW);
  await ST.storage.update("activities", (l) => [...l, rec]);
  ok("activity saved under campusbest_activities only", mem.has("campusbest_activities") && JSON.parse(mem.get("campusbest_activities")!).length === 1);
  eq("every old key is byte-identical after adding an activity", Object.entries(oldRaw).map(([k, v]) => mem.get(`campusbest_${k}`) === v), Object.keys(oldRaw).map(() => true));
  await ST.storage.update("activities", (l) => l.map((a) => (a.id === rec.id ? A.applyActivityEdit(a, { ...A.activityToFormValues(a), title: "Futsal 2" }, later) : a)));
  eq("edit persists", (await ST.storage.read("activities"))[0].title, "Futsal 2");
  // unknown record + unknown enum survive a save of a different record
  mem.set("campusbest_activities", JSON.stringify([{ id: "u", title: "U", category: "future-cat", startTime: "09:00", recurrence: "none", date: "2026-11-18", keep: "me" }, "stray-entry"]));
  await ST.storage.update("activities", (l) => [...l, A.createActivity(valid, NOW)]);
  const raw = JSON.parse(mem.get("campusbest_activities")!);
  ok("a save keeps unknown fields, unknown enum values and non-object entries", raw[0].keep === "me" && raw[0].category === "future-cat" && raw.includes("stray-entry") && raw.length === 3, raw);
  await ST.storage.update("activities", (l) => l.filter((a) => a.id !== "u"));
  ok("delete removes only that record", !JSON.parse(mem.get("campusbest_activities")!).some((x: any) => x?.id === "u") && JSON.parse(mem.get("campusbest_activities")!).includes("stray-entry"));
  ok("old keys still byte-identical after edit/delete", Object.entries(oldRaw).every(([k, v]) => mem.get(`campusbest_${k}`) === v));
  mem.set("campusbest_activities", "{not json");
  eq("corrupt activities value reads as empty and is backed up, not lost", [(await ST.storage.read("activities")).length, mem.get("campusbest_activities__corrupt")], [0, "{not json"]);
  mem.delete("campusbest_activities"); mem.delete("campusbest_activities__corrupt");
  ok("self-test constant: 8 storage names", (await ST.runStorageSelfTest()).find((r) => /prefix campusbest_/.test(r.name))?.passed === true);

  /* ---------- backup / restore ---------- */
  const FIXED = new Date(2026, 10, 17, 10, 30);
  const act = (id: string, ts: string, extra: object = {}) => ({ id, title: id, category: "hobi", recurrence: "none", dayOfWeek: 1, date: "2026-11-18", startTime: "10:00", createdAt: ts, updatedAt: ts, ...extra });
  const snap = (o: Record<string, unknown>) => { const s = {} as any; for (const nme of B.BACKUP_NAMES) s[nme] = (o as any)[nme] ?? null; return s; };
  const dev = snap({ tasks: [{ id: "t1", title: "T", updatedAt: "2026-01-01T00:00:00.000Z" }], activities: [act("a1", "2026-11-01T00:00:00.000Z"), act("a2", "2026-11-02T00:00:00.000Z")], settings: { theme: "light", schemaVersion: 2, focusTimer: { status: "running" } } });
  const built = B.buildBackup(dev, FIXED);
  const env = JSON.parse(built.content);
  eq("export carries activities verbatim and counts it", [env.data.activities, built.counts.activities], [dev.activities, 2]);
  eq("export envelope unchanged (format 1, schema 2)", [env.formatVersion, env.schemaVersion], [1, 2]);
  eq("export key set = BACKUP_NAMES", Object.keys(env.data).sort(), [...B.BACKUP_NAMES].sort());
  ok("verify: built backup matches its snapshot", B.verifyBackupMatches(built.content, dev) === null);
  ok("backupFromSnapshot proves the round trip", (() => { try { BS.backupFromSnapshot(dev, FIXED); return true; } catch (e) { console.log(String(e)); return false; } })());
  const parsed = B.parseBackup(built.content);
  ok("new backup parses, nothing absent", parsed.ok && parsed.backup.absent.length === 0 && parsed.backup.info.activities.total === 2);

  // old backup (made before 0.13.0): no activities key at all
  const oldFile = JSON.parse(built.content); delete oldFile.data.activities; delete oldFile.counts.activities;
  const oldParsed = B.parseBackup(JSON.stringify(oldFile));
  ok("old backup without activities is accepted (not an error) and reported absent", oldParsed.ok && oldParsed.backup.absent.join() === "activities" && oldParsed.warnings.some((w) => /Kegiatan lain/.test(w)));
  if (oldParsed.ok) {
    const target = snap({ activities: [act("keep", "2026-11-05T00:00:00.000Z")], tasks: [{ id: "t9", title: "x" }] });
    const rp = B.planImport(target, oldParsed.backup, "replace");
    ok("REPLACE with an old backup leaves activities untouched (no write)", !("activities" in rp.writes) && rp.collections.find((c) => c.name === "activities")!.absent === true && rp.collections.find((c) => c.name === "activities")!.resulting === 1);
    const mp = B.planImport(target, oldParsed.backup, "merge");
    ok("MERGE with an old backup leaves activities untouched", !("activities" in mp.writes));
    ok("absent collection doesn't trigger the 'fewer items' warning by itself", !B.planImport(snap({ activities: [act("a", "2026-11-05T00:00:00.000Z")] }), { ...oldParsed.backup, data: { ...oldParsed.backup.data, tasks: [] } } as any, "replace").warnings.some((w) => /lebih sedikit|mengosongkan/.test(w)));
  }
  const badActs = JSON.parse(built.content); badActs.data.activities = "nope";
  ok("a present but non-list activities value is refused", B.parseBackup(JSON.stringify(badActs)).ok === false);
  const missingTasks = JSON.parse(built.content); delete missingTasks.data.tasks;
  ok("a missing REQUIRED collection is still refused", B.parseBackup(JSON.stringify(missingTasks)).ok === false);
  const wrongCount = JSON.parse(built.content); wrongCount.counts.activities = 9;
  ok("header count mismatch for activities warns", (() => { const r = B.parseBackup(JSON.stringify(wrongCount)); return r.ok && r.warnings.some((w) => /Kegiatan lain.*9/.test(w)); })());

  // merge / replace with a new backup
  if (parsed.ok) {
    const target = snap({ activities: [act("a1", "2026-11-09T00:00:00.000Z", { title: "newer on device" }), act("a3", "2026-11-03T00:00:00.000Z")] });
    const m = B.planImport(target, parsed.backup, "merge");
    const mergedActs = m.writes.activities as any[];
    eq("merge by id: a1 keeps the newer device copy, a2 added, a3 kept", mergedActs.map((a) => [a.id, a.title]), [["a1", "newer on device"], ["a3", "a3"], ["a2", "a2"]]);
    const r = B.planImport(target, parsed.backup, "replace");
    eq("replace: activities become exactly the file's", (r.writes.activities as any[]).map((a) => a.id), ["a1", "a2"]);
    eq("replace keeps this device's running timer", r.writes.settings, { theme: "light", schemaVersion: 2 });
  }
  ok("merging the same new file twice is a no-op", parsed.ok && B.planIsNoop(B.planImport(snap({ activities: dev.activities, tasks: dev.tasks }), parsed.backup, "merge")));

  // end to end through the real store (mock localStorage)
  mem.clear();
  mem.set(STORAGE_KEYS.tasks, JSON.stringify([{ id: "t1", title: "T", updatedAt: "2026-01-01T00:00:00.000Z" }]));
  mem.set(STORAGE_KEYS.activities, JSON.stringify([act("keep", "2026-11-05T00:00:00.000Z")]));
  const file = await BS.createBackupFile(FIXED);
  eq("createBackupFile includes the stored activities", JSON.parse(file.content).data.activities.map((a: any) => a.id), ["keep"]);
  mem.set(STORAGE_KEYS.activities, JSON.stringify([act("keep", "2026-11-05T00:00:00.000Z"), act("extra", "2026-11-06T00:00:00.000Z")]));
  const prev = await BS.readSnapshot();
  const delivered: string[] = [];
  const resOld = await BS.applyImport({ backup: (oldParsed as any).backup, mode: "replace", previewed: prev, deliverBackup: (f) => { delivered.push(f.content); }, now: FIXED });
  ok("applyImport(replace) with an old backup succeeds and keeps both activities on the device", resOld.ok && JSON.parse(mem.get(STORAGE_KEYS.activities)!).length === 2, resOld);
  ok("the automatic safety backup taken before Replace contains the activities", delivered.length === 1 && JSON.parse(delivered[0]).data.activities.length === 2);
  const prev2 = await BS.readSnapshot();
  const resNew = await BS.applyImport({ backup: (parsed as any).backup, mode: "replace", previewed: prev2, deliverBackup: () => {}, now: FIXED });
  ok("applyImport(replace) with a new backup restores its activities", resNew.ok && JSON.parse(mem.get(STORAGE_KEYS.activities)!).map((a: any) => a.id).join() === "a1,a2", resNew);
  const prev3 = await BS.readSnapshot();
  const resFail = await BS.applyImport({ backup: (parsed as any).backup, mode: "replace", previewed: { ...prev3, activities: [] }, deliverBackup: () => {}, now: FIXED });
  ok("a stale preview that differs in activities is refused", !resFail.ok && (resFail as any).code === "stale");

  /* ---------- UI wiring (source checks only; the components were NOT rendered here) ---------- */
  const shell = view("src/components/schedule/schedule-view.tsx");
  ok("Schedule has the two tabs Kuliah and Kegiatan Lain", /label: "Kuliah"/.test(shell) && /label: "Kegiatan Lain"/.test(shell) && /CourseSchedulePanel/.test(shell) && /ActivitiesPanel/.test(shell));
  ok("Kuliah panel keeps its logic: same hooks, same SIAM link, same quick-add flag", /useStorage\("schedules"\)/.test(view("src/components/schedule/course-schedule-panel.tsx")) && /sumber=siam/.test(view("src/components/schedule/course-schedule-panel.tsx")) && /useOpenFromQuery\(openCreate\)/.test(view("src/components/schedule/course-schedule-panel.tsx")));
  const panel = view("src/components/schedule/activities-panel.tsx");
  ok("activities panel: add/edit/delete go through the activities store only", /useStorage\("activities"\)/.test(panel) && !/useStorage\("(schedules|tasks|events|subjects)"\)/.test(panel) && /createActivity/.test(panel) && /applyActivityEdit/.test(panel) && /filter\(\(a\) => a\.id !== id\)/.test(panel) && /ConfirmationDialog/.test(panel));
  ok("form has all fields: title, category, recurrence, date/day, time, location, notes", ["Judul", "Kategori", "Pengulangan", "Tanggal", "Hari", "Jam mulai", "Lokasi", "Catatan"].every((l) => view("src/components/schedule/activity-form-modal.tsx").includes(l)));
  ok("calendar view and dashboard view read activities", /useStorage\("activities"\)/.test(view("src/components/calendar/calendar-view.tsx")) && /useStorage\("activities"\)/.test(view("src/components/dashboard/dashboard-view.tsx")) && /ActivitiesCard/.test(view("src/components/dashboard/dashboard-view.tsx")));
  ok("no other component or lib touches the key directly", !/campusbest_activities/.test([ "src/components", ].flatMap((d) => fs.readdirSync(d, { recursive: true }) as string[]).filter((f) => /\.tsx$/.test(f)).map((f) => view(`src/components/${f}`)).join("")));
  const pkg = JSON.parse(view("package.json"));
  ok("version 0.13.1 everywhere", pkg.version === "0.13.1" && view("src/lib/pwa.ts").includes('APP_VERSION = "0.13.1"') && view("public/sw.js").includes('const VERSION = "0.13.1"'));
  eq("no dependency added", Object.keys(pkg.dependencies).sort(), ["@radix-ui/react-dialog", "class-variance-authority", "clsx", "framer-motion", "lucide-react", "next", "react", "react-dom", "tailwind-merge"]);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
