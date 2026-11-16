// Run from the project root (needs `npx tsx`, no install needed in the project):
//   TZ=Asia/Jakarta npx tsx scripts/batch5-logic-check.ts
// Try other zones too (DST): TZ=America/New_York, TZ=Europe/London, TZ=Pacific/Auckland
export {}; // makes this file a module so the scripts don't share globals under `tsc`
import * as fs from "node:fs";
import * as path from "node:path";

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
const snapshot = () => JSON.stringify([...mem.entries()].sort());

async function main() {
  const Dash = await import("@/lib/dashboard");
  const Q = await import("@/lib/quick-actions");
  const T = await import("@/lib/tasks");
  const S = await import("@/lib/schedule");
  const E = await import("@/lib/events");
  const Sub = await import("@/lib/subjects");
  const C = await import("@/lib/calendar");
  const { storage } = await import("@/lib/storage");
  const { STORAGE_KEYS } = await import("@/lib/storage-keys");
  const { APP_NAME, APP_TAGLINE } = await import("@/lib/brand");
  type Task = import("@/types").Task;

  const seedAll = () => {
    mem.clear();
    mem.set(STORAGE_KEYS.subjects, JSON.stringify([
      { id: "s1", name: "Basis Data", code: "IF2140", lecturer: "Bu Sari", color: "#65B8FF", createdAt: "x", updatedAt: "x" },
      { id: "s2", name: "Kalkulus", color: "#FF8A7A", createdAt: "x", updatedAt: "x" },
    ]));
    const sc = (o: Record<string, unknown>) => ({ subjectId: "s1", mode: "offline", createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z", ...o });
    mem.set(STORAGE_KEYS.schedules, JSON.stringify([
      sc({ id: "c1", recurrence: "weekly", dayOfWeek: 3, startTime: "08:00", endTime: "09:40", room: "R.301" }),
      sc({ id: "c2", subjectId: "s2", recurrence: "biweekly", date: "2026-11-04", dayOfWeek: 3, startTime: "09:00", endTime: "10:40", mode: "online" }),
      sc({ id: "c3", recurrence: "biweekly", date: "2026-11-11", dayOfWeek: 3, startTime: "13:00", endTime: "14:00" }),
      sc({ id: "c4", recurrence: "none", date: "2026-11-18", dayOfWeek: 3, startTime: "15:00", endTime: "16:00" }),
      sc({ id: "c5", recurrence: "none", date: "2026-11-19", dayOfWeek: 4, startTime: "08:00", endTime: "09:00" }),
      sc({ id: "c6", recurrence: "weekly", dayOfWeek: 4, startTime: "08:00", endTime: "09:00" }),
      sc({ id: "c7", recurrence: "none", dayOfWeek: 3, startTime: "08:00", endTime: "09:00" }),
      sc({ id: "c8", subjectId: "s2", recurrence: "monthly", dayOfWeek: 3, startTime: "12:00", endTime: "13:00" }),
      sc({ id: "c9", subjectId: "gone", recurrence: "weekly", dayOfWeek: 3, startTime: "17:00", endTime: "18:00" }),
    ]));
    const tk = (o: Record<string, unknown>) => ({ priority: "medium", status: "todo", createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z", ...o });
    mem.set(STORAGE_KEYS.tasks, JSON.stringify([
      tk({ id: "t1", title: "Terlambat kemarin", deadline: "2026-11-17", deadlineTime: "10:00" }),
      tk({ id: "t2", title: "Terlambat hari ini", deadline: "2026-11-18", deadlineTime: "09:00" }),
      tk({ id: "t3", title: "Nanti malam", deadline: "2026-11-18", deadlineTime: "23:00" }),
      tk({ id: "t4", title: "Hari ini tanpa jam", deadline: "2026-11-18" }),
      tk({ id: "t5", title: "Minggu depan", deadline: "2026-11-25", priority: "high", status: "in_progress", subjectId: "s1" }),
      tk({ id: "t6", title: "Selesai lama", deadline: "2026-11-10", status: "done" }),
      tk({ id: "t7", title: "Legacy selesai", dueDate: "2026-11-16", status: "completed" }),
      tk({ id: "t8", title: "Tanpa deadline" }),
      tk({ id: "t9", title: "Status aneh", deadline: "2026-11-30", status: "archived" }),
      tk({ id: "t10", title: "Legacy terlambat", dueDate: "2026-11-14" }),
    ]));
    const ev = (o: Record<string, unknown>) => ({ type: "exam", createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z", ...o });
    mem.set(STORAGE_KEYS.events, JSON.stringify([
      ev({ id: "e1", title: "UTS Basis Data", category: "uts", date: "2026-11-18", startTime: "07:00", endTime: "09:00", subjectId: "s1", location: "Aula" }),
      ev({ id: "e2", title: "Quiz Kalkulus", category: "quiz", date: "2026-11-20", subjectId: "s2" }),
      ev({ id: "e3", title: "Tanpa tanggal", category: "lainnya", date: "" }),
      ev({ id: "e4", title: "UAS lalu", category: "uas", date: "2026-11-10" }),
      ev({ id: "e5", title: "Seminar AI", category: "seminar", type: "other", date: "2026-11-25" }),
      ev({ id: "e6", title: "Workshop", category: "lainnya", type: "other", date: "2026-12-01" }),
    ]));
  };
  const load = async () => ({
    tasks: await storage.read("tasks"), subjects: await storage.read("subjects"),
    schedules: await storage.read("schedules"), events: await storage.read("events"),
  });
  const now = new Date(2026, 10, 18, 9, 30); // Wed 18 Nov 2026, 09:30 (Wed is an "on" week for anchor 4 Nov)

  /* ================= greeting + date ================= */
  const at = (h: number, m = 0) => new Date(2026, 10, 18, h, m);
  eq("greeting boundaries", [at(0), at(3, 59), at(4), at(10, 59), at(11), at(14, 59), at(15), at(17, 59), at(18), at(23, 59)].map(Dash.greetingFor),
    ["Selamat malam", "Selamat malam", "Selamat pagi", "Selamat pagi", "Selamat siang", "Selamat siang", "Selamat sore", "Selamat sore", "Selamat malam", "Selamat malam"]);
  ok("date line in Indonesian", /^Rabu, 18 November 2026$/.test(Dash.dateLine(now)), Dash.dateLine(now));
  ok("brand identity constants", APP_NAME === "CampusBest" && APP_TAGLINE === "Your Campus Bestie.");

  /* ================= empty state ================= */
  mem.clear();
  const empty = Dash.buildDashboard(await load(), now);
  eq("empty data: zeros", empty.stats, { totalTasks: 0, openTasks: 0, doneTasks: 0, overdueTasks: 0, subjects: 0, upcomingEvents: 0 });
  ok("empty data: percent 0, no division by zero, nothing listed", empty.progress.percent === 0 && empty.today.length === 0 && empty.tasks.items.length === 0 && empty.events.items.length === 0 && empty.tasks.total === 0);
  // The only thing a first read may write is the one-time migration marker (Batch 1), never any data collection.
  ok("reading empty storage wrote no data (at most the migration marker)", [...mem.keys()].every((k) => k === "campusbest_migration_v1"), [...mem.keys()]);

  /* ================= stats from real (stored, partly legacy) data ================= */
  seedAll();
  const before = snapshot();
  const data = await load();
  const model = Dash.buildDashboard(data, now);
  eq("stats", model.stats, { totalTasks: 10, openTasks: 8, doneTasks: 2, overdueTasks: 3, subjects: 2, upcomingEvents: 4 });
  eq("progress", model.progress, { total: 10, done: 2, open: 8, overdue: 3, percent: 20 });
  ok("done = status done + completed (legacy), unknown status counts as open", data.tasks.filter((t) => ["t6", "t7"].includes(t.id)).every((t) => !!t) && model.stats.doneTasks === 2 && model.stats.openTasks === 8);
  eq("overdue = unfinished and past deadline (time or 23:59), incl. legacy dueDate", data.tasks.filter((t) => Dash.isOverdue(t, now)).map((t) => t.id), ["t1", "t2", "t10"]);
  ok("done + open = total always", model.stats.doneTasks + model.stats.openTasks === model.stats.totalTasks);
  ok("a task due at 23:59 isn't overdue at 23:58 but is at 00:00 next day", !Dash.isOverdue(data.tasks.find((t) => t.id === "t4")!, new Date(2026, 10, 18, 23, 58)) && Dash.isOverdue(data.tasks.find((t) => t.id === "t4")!, new Date(2026, 10, 19, 0, 0)));
  ok("done task past its deadline never counts as overdue", !Dash.isOverdue(data.tasks.find((t) => t.id === "t6")!, now));
  ok("no deadline = not overdue", !Dash.isOverdue(data.tasks.find((t) => t.id === "t8")!, now));
  eq("percent rounding", [[0, 3], [1, 3], [2, 3], [3, 3], [1, 8]].map(([d, n]) => Dash.taskProgress(Array.from({ length: n }, (_, i) => ({ status: i < d ? "completed" : "todo", createdAt: "x", id: String(i), title: "t", priority: "low", updatedAt: "x" }) as unknown as Task), now).percent), [0, 33, 67, 100, 13]);
  ok("dashboard computation is read-only", snapshot() === before);

  /* ================= today's schedule ================= */
  const today = model.today;
  eq("today's classes (weekly, biweekly on-week, one-off, unknown recurrence as weekly; others excluded), by time", today.map((c) => c.item.id), ["c1", "c2", "c8", "c4", "c9"]);
  eq("statuses at 09:30", today.map((c) => c.status), ["ongoing", "ongoing", "upcoming", "upcoming", "upcoming"]);
  ok("biweekly off-week (c3), other days (c5, c6), undated one-off (c7) are not shown", !today.some((c) => ["c3", "c5", "c6", "c7"].includes(c.item.id)));
  ok("class of a deleted subject is still listed", today.some((c) => c.item.id === "c9") && S.subjectTitle(undefined) === "Mata kuliah dihapus");
  const st = (s: string, e: string, h: number, m: number) => Dash.classStatus({ startTime: s, endTime: e }, new Date(2026, 10, 18, h, m));
  eq("classStatus boundaries (start inclusive, end exclusive)", [st("08:00", "09:40", 7, 59), st("08:00", "09:40", 8, 0), st("08:00", "09:40", 9, 39), st("08:00", "09:40", 9, 40), st("08:00", "09:40", 23, 59)], ["upcoming", "ongoing", "ongoing", "done", "done"]);
  const wedLater = Dash.todayClasses(data.schedules, new Date(2026, 10, 18, 18, 30));
  ok("evening: everything done", wedLater.every((c) => c.status === "done") && wedLater.length === 5);
  eq("next week's Wednesday (25 Nov, biweekly off-week for c2, on-week for c3)", Dash.todayClasses(data.schedules, new Date(2026, 10, 25, 9, 0)).map((c) => c.item.id), ["c1", "c8", "c3", "c9"]);
  eq("2 Dec is an on-week for c2 again", Dash.todayClasses(data.schedules, new Date(2026, 11, 2, 9, 0)).map((c) => c.item.id), ["c1", "c2", "c8", "c9"]);
  eq("23:59 Wed vs 00:00 Thu (midnight rollover)", [Dash.todayClasses(data.schedules, new Date(2026, 10, 18, 23, 59)).length, Dash.todayClasses(data.schedules, new Date(2026, 10, 19, 0, 0)).map((c) => c.item.id)], [5, ["c5", "c6"]]);
  eq("Sunday has no classes", Dash.todayClasses(data.schedules, new Date(2026, 10, 15, 10, 0)), []);
  eq("the schedule page uses the same rule (scheduleOnDate)", Dash.todayClasses(data.schedules, now).map((c) => c.item.id), S.scheduleOnDate(data.schedules, "2026-11-18").map((s) => s.id));

  /* ================= upcoming tasks ================= */
  eq("upcoming tasks: overdue first, nearest next, no-deadline last; done excluded; limit 5", model.tasks.items.map((t) => t.id), ["t10", "t1", "t2", "t3", "t4"]);
  eq("total counts all unfinished", model.tasks.total, 8);
  eq("with a high limit: full order", Dash.upcomingTasks(data.tasks, 20).items.map((t) => t.id), ["t10", "t1", "t2", "t3", "t4", "t5", "t9", "t8"]);
  ok("same order the Tasks page uses (sortTasks by deadline, unfinished)", JSON.stringify(Dash.upcomingTasks(data.tasks, 20).items.map((t) => t.id)) === JSON.stringify(T.sortTasks(data.tasks.filter((t) => t.id !== "t6" && t.id !== "t7"), "deadline").map((t) => t.id)));
  ok("overdue ones are recognizable through deadlineInfo", model.tasks.items.filter((t) => T.deadlineInfo(t, now)?.tone === "overdue").map((t) => t.id).join() === "t10,t1,t2");
  ok("the unknown-status task is listed as a normal todo", T.taskStatusKind(data.tasks.find((t) => t.id === "t9")!) === "todo");
  eq("limit 0", Dash.upcomingTasks(data.tasks, 0).items, []);

  /* ================= upcoming events ================= */
  eq("upcoming events: today and later, nearest first, no past/undated", model.events.items.map((e) => e.id), ["e1", "e2", "e5", "e6"]);
  eq("limit and total", [Dash.upcomingEvents(data.events, data.subjects, now, 2).items.map((e) => e.id), Dash.upcomingEvents(data.events, data.subjects, now, 2).total], [["e1", "e2"], 4]);
  ok("same result as the Exams page 'Mendatang' filter + sort", JSON.stringify(model.events.items.map((e) => e.id)) === JSON.stringify(E.sortEvents(E.filterEvents(data.events, new Map(data.subjects.map((s) => [s.id, s])), { query: "", category: "all", time: "upcoming" }, now), now).map((e) => e.id)));
  ok("every category label is available for the cards", model.events.items.every((e) => E.categoryLabel(e.category).length > 0));
  eq("the day after: the exam of the 18th drops out", Dash.upcomingEvents(data.events, data.subjects, new Date(2026, 10, 19, 8, 0)).items.map((e) => e.id), ["e2", "e5", "e6"]);

  /* ================= dashboard follows the sources (no stored copy) ================= */
  seedAll();
  const keysBefore = [...mem.keys()].sort().join();
  let d = Dash.buildDashboard(await load(), now);
  // complete a task
  await storage.update("tasks", (l) => l.map((t) => (t.id === "t1" ? T.toggleTaskDone(t, now) : t)));
  let d2 = Dash.buildDashboard(await load(), now);
  ok("completing an overdue task: open -1, done +1, overdue -1, percent 30", d2.stats.openTasks === d.stats.openTasks - 1 && d2.stats.doneTasks === d.stats.doneTasks + 1 && d2.stats.overdueTasks === d.stats.overdueTasks - 1 && d2.progress.percent === 30 && !d2.tasks.items.some((t) => t.id === "t1"));
  // add a task through the real create path
  const newTask = T.createTask({ ...T.EMPTY_TASK_FORM, title: "Baru", deadline: "2026-11-18", deadlineTime: "09:31" }, now);
  await storage.update("tasks", (l) => [...l, newTask]);
  d = Dash.buildDashboard(await load(), now);
  ok("new task counts and is listed (due a minute from now, not overdue)", d.stats.totalTasks === 11 && d.tasks.total === d2.tasks.total + 1 && !Dash.isOverdue(newTask, now) && Dash.isOverdue(newTask, new Date(2026, 10, 18, 9, 32)));
  // schedule: add a one-off class today at 10:00
  const newClass = S.createSchedule({ ...S.emptyScheduleForm(now), subjectId: "s1", recurrence: "none", date: "2026-11-18", startTime: "10:00", endTime: "11:00" }, now);
  await storage.update("schedules", (l) => [...l, newClass]);
  eq("new one-off class appears today in time order", Dash.buildDashboard(await load(), now).today.map((c) => c.item.id), ["c1", "c2", newClass.id, "c8", "c4", "c9"]);
  await storage.update("schedules", (l) => l.filter((s) => s.id !== newClass.id));
  ok("deleting it removes it", !Dash.buildDashboard(await load(), now).today.some((c) => c.item.id === newClass.id));
  // events: add, edit, delete
  const newEvent = E.createEvent({ ...E.EMPTY_EVENT_FORM, title: "Praktikum Jarkom", category: "praktikum", date: "2026-11-19", startTime: "08:00" }, now);
  await storage.update("events", (l) => [...l, newEvent]);
  d = Dash.buildDashboard(await load(), now);
  ok("new event is counted and sorted between 18th and 20th", d.stats.upcomingEvents === 5 && d.events.items.map((e) => e.id).slice(0, 3).join() === `e1,${newEvent.id},e2`);
  await storage.update("events", (l) => l.map((e) => (e.id === newEvent.id ? E.applyEventEdit(e, { ...E.eventToFormValues(e, new Set()), date: "2026-11-01" }, now) : e)));
  ok("moving it to the past removes it from upcoming", Dash.buildDashboard(await load(), now).stats.upcomingEvents === 4);
  await storage.update("events", (l) => l.filter((e) => e.id !== newEvent.id));
  // subjects
  const subj = Sub.createSubject({ ...Sub.emptySubjectForm("#65B8FF"), name: "Jaringan", code: "IF3000" } as any, now);
  await storage.update("subjects", (l) => [...l, subj]);
  ok("new subject counted", Dash.buildDashboard(await load(), now).stats.subjects === 3);
  await storage.update("subjects", (l) => l.filter((s) => s.id !== "s1"));
  d = Dash.buildDashboard(await load(), now);
  ok("deleting a subject lowers the count; its classes, tasks, events remain on the dashboard", d.stats.subjects === 2 && d.today.some((c) => c.item.id === "c1") && d.events.items.some((e) => e.id === "e1") && d.stats.totalTasks === 11);
  ok("no dashboard collection or extra key was ever created", [...mem.keys()].sort().join() === keysBefore);
  // Same data the calendar shows for today.
  const src = await load();
  const calToday = C.entriesForDate("2026-11-18", { ...src }).filter((e) => e.kind === "class").map((e) => e.sourceId).sort();
  eq("dashboard classes = calendar classes for today", Dash.todayClasses(src.schedules, now).map((c) => c.item.id).sort(), calToday);
  const calTasks = C.entriesForDate("2026-11-18", src).filter((e) => e.kind === "task").map((e) => e.sourceId).sort();
  ok("every dashboard task due today is on the calendar", Dash.upcomingTasks(src.tasks, 50).items.filter((t) => T.deadlineInfo(t, now) && /Hari ini/.test(T.deadlineInfo(t, now)!.label)).every((t) => calTasks.includes(t.id)));

  /* ================= legacy / Phase 1 data ================= */
  mem.clear();
  mem.set("campusmate_tasks", JSON.stringify([{ id: "1", title: "Lama", status: "done" }, { id: "2", title: "Lama 2", dueDate: "2026-11-01" }]));
  mem.set("campusmate_subjects", JSON.stringify([{ id: "s", name: "Lama" }]));
  const { migrateLegacyKeys } = await import("@/lib/storage");
  migrateLegacyKeys((globalThis as any).window.localStorage);
  const legacyModel = Dash.buildDashboard(await load(), now);
  eq("Phase 1 data shows up after migration", [legacyModel.stats.totalTasks, legacyModel.stats.doneTasks, legacyModel.stats.overdueTasks, legacyModel.stats.subjects], [2, 1, 1, 1]);
  ok("legacy keys untouched", mem.get("campusmate_tasks")!.includes('"status":"done"'));

  /* ================= quick actions ================= */
  const navText = fs.readFileSync(path.join(process.cwd(), "src/lib/navigation.ts"), "utf8");
  const navHrefs = [...navText.matchAll(/href: "([^"]+)"/g)].map((m) => m[1]);
  eq("5 quick actions: task, schedule, event, note, calendar", Q.QUICK_ACTIONS.map((a) => a.key), ["task", "schedule", "event", "note", "calendar"]);
  ok("every quick action points at an existing route", Q.QUICK_ACTIONS.every((a) => navHrefs.includes(a.href.split("?")[0])));
  eq("add actions carry the flag, calendar doesn't", Q.QUICK_ACTIONS.map((a) => Q.wantsAdd(new URL(a.href, "http://x").search)), [true, true, true, true, false]);
  eq("targets: tasks, schedule, exams, notes, calendar", Q.QUICK_ACTIONS.map((a) => a.href.split("?")[0]), ["/tasks", "/schedule", "/exams", "/notes", "/calendar"]);
  eq("wantsAdd", ["?tambah=1", "?tambah", "?x=1&tambah=1", "", "?x=1", "?tambahan=1"].map(Q.wantsAdd), [true, true, true, false, false, false]);
  eq("withoutAddParam", ["?tambah=1", "?tambah=1&x=2", "?x=2&tambah=1", "", "?x=2"].map(Q.withoutAddParam), ["", "?x=2", "?x=2", "", "?x=2"]);
  const view = (f: string) => fs.readFileSync(path.join(process.cwd(), f), "utf8");
  ok("Tasks, Schedule, Exams and Notes open their own existing form from the flag (no second form)", ["tasks/tasks-view", "schedule/schedule-view", "events/events-view", "notes/notes-view"].every((f) => /useOpenFromQuery\(openCreate\)/.test(view(`src/components/${f}.tsx`))));
  ok("the dashboard contains no form modal of its own", !/FormModal|createTask|createEvent|createSchedule|storage\.(write|update)|\.update\(|\.set\(/.test(["dashboard-view", "quick-actions", "today-schedule-card", "upcoming-tasks-card", "upcoming-events-card", "task-progress-card"].map((f) => view(`src/components/dashboard/${f}.tsx`)).join("\n")));

  /* ================= static guards over the whole codebase ================= */
  const walk = (dir: string): string[] => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]));
  const files = walk(path.join(process.cwd(), "src")).filter((f) => /\.(ts|tsx)$/.test(f));
  const rel = (f: string) => path.relative(process.cwd(), f).replace(/\\/g, "/");
  const bad = (re: RegExp) => files.filter((f) => re.test(fs.readFileSync(f, "utf8"))).map(rel);
  eq("no UTC-based local date keys (toISOString().slice/split/substring)", bad(/toISOString\(\)\s*\.\s*(slice|split|substring)/), []);
  eq("localStorage only touched by storage.ts and theme-script.ts", bad(/localStorage/).sort(), ["src/lib/storage.ts", "src/lib/theme-script.ts"]);
  eq("legacy campusmate_ keys only in the storage layer / theme script", bad(/campusmate_/).sort(), ["src/lib/storage-keys.ts", "src/lib/storage.ts", "src/lib/theme-script.ts"].filter((f) => bad(/campusmate_/).includes(f)));
  eq("no raw Math.random ids (generateId only)", bad(/Math\.random\(\)\.toString/).filter((f) => !f.endsWith("lib/id.ts")), []);
  eq("every nav route has a page", navHrefs.filter((h) => !fs.existsSync(path.join(process.cwd(), "src/app", h, "page.tsx"))), []);
  const placeholders = navHrefs.filter((h) => /PlaceholderPage/.test(fs.readFileSync(path.join(process.cwd(), "src/app", h, "page.tsx"), "utf8")));
  eq("no page is a placeholder anymore (Notes B1, Focus B2, Statistics B5 part A)", placeholders.sort(), []);
  ok("Phase 2 pages are server components with metadata and a view", ["dashboard", "calendar", "tasks", "schedule", "subjects", "exams"].every((r) => { const t = view(`src/app/${r}/page.tsx`); return /export const metadata/.test(t) && !/"use client"/.test(t); }));
  const pkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), "package.json"), "utf8"));
  eq("no dependency added since Phase 1", Object.keys(pkg.dependencies).sort(), ["@radix-ui/react-dialog", "class-variance-authority", "clsx", "framer-motion", "lucide-react", "next", "react", "react-dom", "tailwind-merge"]);
  eq("no unexpected devDependency", Object.keys(pkg.devDependencies).sort(), ["@types/node", "@types/react", "@types/react-dom", "autoprefixer", "postcss", "tailwindcss", "typescript"]);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}
main();
