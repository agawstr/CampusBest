// Run from the project root (needs `npx tsx`, no install needed in the project):
//   TZ=Asia/Jakarta npx tsx scripts/batch3-logic-check.ts
// Try other zones too (DST): TZ=America/New_York, TZ=Europe/London, TZ=Pacific/Auckland
export {}; // makes this file a module so the two scripts don't share globals under `tsc`

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

async function main() {
  const S = await import("@/lib/schedule");
  const C = await import("@/lib/calendar");
  const D = await import("@/lib/date");
  const { storage } = await import("@/lib/storage");
  const { normalizeSchedule, normalizeTask, normalizeEvent } = await import("@/lib/normalize");
  const { STORAGE_KEYS } = await import("@/lib/storage-keys");
  type Sched = import("@/types").ScheduleItem;
  type Subject = import("@/types").Subject;

  const SCHED_KEY = STORAGE_KEYS.schedules;
  const rawSched = () => JSON.parse(mem.get(SCHED_KEY) ?? "null");
  const sch = (o: Record<string, unknown>): Sched =>
    normalizeSchedule({ subjectId: "s1", startTime: "08:00", endTime: "09:40", createdAt: "2026-01-01T00:00:00Z", ...o }, 0);
  const fv = (o: Partial<import("@/lib/schedule").ScheduleFormValues> = {}): import("@/lib/schedule").ScheduleFormValues => ({
    ...S.emptyScheduleForm(new Date(2026, 10, 15)), subjectId: "s1", ...o,
  });
  const NONE = S.SCHEDULE_UNTOUCHED;
  const rawFor = (id: string) => (f: "mode" | "recurrence" | "dayOfWeek") => storage.getCoercedRaw("schedules", id, f);
  /** Same flow as ScheduleView.handleSave for an edit. */
  const editViaStorage = (id: string, values: import("@/lib/schedule").ScheduleFormValues, touched: import("@/lib/schedule").ScheduleFormTouched, now = new Date(2026, 10, 20, 10, 0)) =>
    storage.update("schedules", (list) =>
      list.map((s) => (s.id === id ? S.applyScheduleEdit(s, values, now, S.scheduleFieldsToPreserve(touched, rawFor(id))) : s)));
  /** Form values as the form would show them for the record as currently normalized. */
  const formFor = async (id: string) => {
    const list = await storage.read("schedules");
    return S.scheduleToFormValues(list.find((s) => s.id === id)!, new Set(["s1", "s2"]));
  };

  /* ================= occurrence rules ================= */
  // 2026-11-04 is a Wednesday.
  const wk = sch({ id: "w", dayOfWeek: 3, recurrence: "weekly" });
  ok("weekly Wed 11-04", S.occursOn(wk, "2026-11-04"));
  ok("weekly Wed 11-11", S.occursOn(wk, "2026-11-11"));
  ok("weekly not Thu", !S.occursOn(wk, "2026-11-05"));
  ok("weekly ignores a stray date", S.occursOn(sch({ id: "w2", dayOfWeek: 3, recurrence: "weekly", date: "2026-11-11" }), "2026-11-04"));
  ok("weekly Sunday = 0", S.occursOn(sch({ id: "w3", dayOfWeek: 0, recurrence: "weekly" }), "2026-11-15"));
  ok("invalid key never occurs", !S.occursOn(wk, "2026-02-30") && !S.occursOn(wk, "garbage"));

  const one = sch({ id: "o", recurrence: "none", date: "2026-11-10", dayOfWeek: 2 });
  ok("none on its date", S.occursOn(one, "2026-11-10"));
  ok("none not a week later", !S.occursOn(one, "2026-11-17"));
  ok("none not a day earlier", !S.occursOn(one, "2026-11-09"));
  ok("none ignores dayOfWeek that disagrees", S.occursOn(sch({ id: "o2", recurrence: "none", date: "2026-11-10", dayOfWeek: 5 }), "2026-11-10"));

  const bi = sch({ id: "b", recurrence: "biweekly", date: "2026-11-04", dayOfWeek: 3 });
  const biDates = ["2026-11-04", "2026-11-18", "2026-12-02", "2026-12-16", "2026-12-30", "2027-01-13"];
  ok("biweekly hits every 14 days (incl. year change)", biDates.every((d) => S.occursOn(bi, d)));
  ok("biweekly skips the off weeks", ["2026-11-11", "2026-11-25", "2026-12-09", "2027-01-06"].every((d) => !S.occursOn(bi, d)));
  ok("biweekly skips other weekdays of an on-week", !S.occursOn(bi, "2026-11-05") && !S.occursOn(bi, "2026-11-19"));
  ok("biweekly never before its anchor", !S.occursOn(bi, "2026-10-21") && !S.occursOn(bi, "2026-10-07"));
  ok("biweekly: dayOfWeek that disagrees with the anchor does not shift it", S.occursOn(sch({ id: "b2", recurrence: "biweekly", date: "2026-11-04", dayOfWeek: 1 }), "2026-11-18"));
  // DST: 2026-03-08 US spring forward, 2026-10-25 EU fall back. Day arithmetic must not drift.
  const biDst = sch({ id: "bd", recurrence: "biweekly", date: "2026-03-04", dayOfWeek: 3 });
  ok("biweekly across DST start", S.occursOn(biDst, "2026-03-18") && !S.occursOn(biDst, "2026-03-11") && S.occursOn(biDst, "2026-04-01"));
  const biDst2 = sch({ id: "bd2", recurrence: "biweekly", date: "2026-10-14", dayOfWeek: 3 });
  ok("biweekly across DST end", S.occursOn(biDst2, "2026-10-28") && !S.occursOn(biDst2, "2026-10-21") && S.occursOn(biDst2, "2026-11-11"));

  // Items that can't be placed.
  const noDateNone = sch({ id: "nd1", recurrence: "none" });
  const noDateBi = sch({ id: "nd2", recurrence: "biweekly" });
  const badDate = sch({ id: "nd3", recurrence: "none", date: "2026-02-30" });
  ok("none without date never occurs", !S.occursOn(noDateNone, "2026-11-10") && S.needsDate(noDateNone));
  ok("biweekly without anchor never occurs", !S.occursOn(noDateBi, "2026-11-10") && S.needsDate(noDateBi));
  ok("malformed date is kept in memory but counts as missing", badDate.date === "2026-02-30" && S.needsDate(badDate) && !S.occursOn(badDate, "2026-02-28"));
  ok("weekly never needsDate", !S.needsDate(wk));
  ok("none/biweekly with date don't need one", !S.needsDate(one) && !S.needsDate(bi));

  /* ================= normalization of legacy data ================= */
  const legacy = normalizeSchedule({ id: "L1", subjectId: "s1", dayOfWeek: 2, startTime: "10:00", endTime: "11:40", room: "R1", extra: "keep" }, 0);
  ok("Phase 1 record = weekly, offline, no date", legacy.recurrence === "weekly" && legacy.mode === "offline" && legacy.date === undefined);
  ok("Phase 1 record occurs on Tuesdays", S.occursOn(legacy, "2026-11-10") && S.occursOn(legacy, "2026-11-17") && !S.occursOn(legacy, "2026-11-11"));
  ok("unknown field kept by normalization", (legacy as any).extra === "keep");
  ok("unknown recurrence is shown as weekly on its dayOfWeek", S.occursOn(sch({ id: "u", recurrence: "monthly", dayOfWeek: 2 }), "2026-11-17"));

  /* ================= week + ordering ================= */
  const a = sch({ id: "a", recurrence: "weekly", dayOfWeek: 1, startTime: "13:00", endTime: "14:40", createdAt: "2026-01-02T00:00:00Z" });
  const b = sch({ id: "b", recurrence: "weekly", dayOfWeek: 1, startTime: "08:00", endTime: "09:40" });
  const c = sch({ id: "c", recurrence: "none", date: "2026-11-09", startTime: "08:00", endTime: "08:50", dayOfWeek: 1 });
  const items = [a, b, c, one, bi, wk];
  eq("scheduleOnDate sorted by time, then end, doesn't mutate", S.scheduleOnDate(items, "2026-11-09").map((s) => s.id), ["c", "b", "a"]);
  ok("input order kept", items[0] === a && items[1] === b && items[2] === c);
  const wkMon = S.buildWeek(items, D.startOfWeek(new Date(2026, 10, 15), 1)); // week of Mon 9 Nov
  eq("week (Mon start) days", wkMon.map((d) => d.key), ["2026-11-09", "2026-11-10", "2026-11-11", "2026-11-12", "2026-11-13", "2026-11-14", "2026-11-15"]);
  eq("week (Mon start) ids per day", wkMon.map((d) => d.items.map((s) => s.id)), [["c", "b", "a"], ["o"], ["w"], [], [], [], []]);
  const wkSun = S.buildWeek(items, D.startOfWeek(new Date(2026, 10, 15), 0)); // Sun 15 Nov first
  eq("week (Sun start) first/last", [wkSun[0].key, wkSun[6].key], ["2026-11-15", "2026-11-21"]);
  // Wednesday of the week of 16 Nov is the 18th (biweekly on-week); of the week of 9 Nov is the 11th (off-week).
  eq("biweekly shows up in the on-week only", [S.buildWeek(items, new Date(2026, 10, 16))[2].items.map((s) => s.id), S.buildWeek(items, new Date(2026, 10, 9))[2].items.map((s) => s.id)], [[bi.id, wk.id], [wk.id]]);
  eq("nextDateForWeekday same day", S.nextDateForWeekday(0, new Date(2026, 10, 15)), "2026-11-15");
  eq("nextDateForWeekday later", S.nextDateForWeekday(3, new Date(2026, 10, 15)), "2026-11-18");
  eq("nextDateForWeekday wraps month", S.nextDateForWeekday(1, new Date(2026, 10, 30, 23, 30)), "2026-11-30");
  ok("week range same month", /^9 - 15 November 2026$/.test(S.formatWeekRange(new Date(2026, 10, 9))), S.formatWeekRange(new Date(2026, 10, 9)));
  ok("week range across months", /^26 Okt - 1 Nov 2026$/.test(S.formatWeekRange(new Date(2026, 9, 26))), S.formatWeekRange(new Date(2026, 9, 26)));
  ok("week range across years", /Des 2026 - .*Jan 2027/.test(S.formatWeekRange(new Date(2026, 11, 28))), S.formatWeekRange(new Date(2026, 11, 28)));
  eq("weekdayOf", [S.weekdayOf("2026-11-15"), S.weekdayOf("2026-11-04"), S.weekdayOf("nope")], [0, 3, null]);

  /* ================= form validation ================= */
  eq("valid weekly form", S.validateScheduleForm(fv()), {});
  ok("subject required", !!S.validateScheduleForm(fv({ subjectId: "" })).subjectId);
  ok("end must be after start", !!S.validateScheduleForm(fv({ startTime: "10:00", endTime: "10:00" })).endTime);
  ok("end before start", !!S.validateScheduleForm(fv({ startTime: "10:00", endTime: "09:00" })).endTime);
  ok("empty time", !!S.validateScheduleForm(fv({ startTime: "" })).startTime);
  ok("none needs a date", !!S.validateScheduleForm(fv({ recurrence: "none", date: "" })).date);
  ok("biweekly needs a start date", !!S.validateScheduleForm(fv({ recurrence: "biweekly", date: "" })).date);
  ok("impossible date rejected", !!S.validateScheduleForm(fv({ recurrence: "none", date: "2026-02-30" })).date);
  eq("weekly doesn't need a date", S.validateScheduleForm(fv({ recurrence: "weekly", date: "" })), {});
  eq("none with date ok", S.validateScheduleForm(fv({ recurrence: "none", date: "2026-11-10" })), {});

  /* ================= create ================= */
  const now0 = new Date(2026, 10, 15, 9, 0);
  const cw = S.createSchedule(fv({ recurrence: "weekly", dayOfWeek: 4, date: "2026-11-10", room: " A1 " }), now0);
  ok("create weekly: day as picked, no date, room trimmed", cw.dayOfWeek === 4 && cw.date === undefined && cw.room === "A1" && cw.recurrence === "weekly");
  const cn = S.createSchedule(fv({ recurrence: "none", dayOfWeek: 1, date: "2026-11-10" }), now0);
  ok("create none: date kept, weekday derived from date (Tue)", cn.date === "2026-11-10" && cn.dayOfWeek === 2);
  const cb = S.createSchedule(fv({ recurrence: "biweekly", dayOfWeek: 1, date: "2026-11-04", room: "" }), now0);
  ok("create biweekly: anchor kept, weekday derived (Wed), empty room dropped", cb.date === "2026-11-04" && cb.dayOfWeek === 3 && cb.room === undefined);
  ok("create: new ids, timestamps equal", cw.id !== cn.id && cw.createdAt === cw.updatedAt && cw.createdAt === now0.toISOString());

  /* ================= CRUD through storage + persistence ================= */
  mem.clear();
  await storage.update("schedules", (l) => [...l, cw]);
  await storage.update("schedules", (l) => [...l, cn]);
  await storage.update("schedules", (l) => [...l, cb]);
  ok("3 written to localStorage", rawSched().length === 3);
  const afterRefresh = await storage.read("schedules"); // a reload re-reads and re-normalizes the raw JSON
  eq("persisted data survives a re-read unchanged", afterRefresh.map((s) => [s.id, s.recurrence, s.date ?? null, s.dayOfWeek]), [cw, cn, cb].map((s) => [s.id, s.recurrence, s.date ?? null, s.dayOfWeek]));
  ok("reading never wrote", JSON.stringify(rawSched()) === JSON.stringify([cw, cn, cb]));

  // Edit: change room only.
  const t1 = new Date(2026, 10, 20, 10, 0);
  await editViaStorage(cw.id, { ...(await formFor(cw.id)), room: "B2" }, NONE, t1);
  let cur = rawSched().find((s: any) => s.id === cw.id);
  ok("edit saved + updatedAt bumped, createdAt kept", cur.room === "B2" && cur.updatedAt === t1.toISOString() && cur.createdAt === cw.createdAt);
  ok("edit left others untouched", JSON.stringify(rawSched().filter((s: any) => s.id !== cw.id)) === JSON.stringify([cn, cb]));

  // Edit: weekly -> none (touched recurrence + date).
  await editViaStorage(cw.id, { ...(await formFor(cw.id)), recurrence: "none", date: "2026-11-12" }, { ...NONE, recurrence: true, date: true }, t1);
  cur = rawSched().find((s: any) => s.id === cw.id);
  ok("weekly -> none: date set, weekday derived (Thu)", cur.recurrence === "none" && cur.date === "2026-11-12" && cur.dayOfWeek === 4);
  // Edit: none -> weekly clears the date, keeps the weekday from it.
  await editViaStorage(cw.id, { ...(await formFor(cw.id)), recurrence: "weekly", dayOfWeek: S.weekdayOf("2026-11-12")! }, { ...NONE, recurrence: true }, t1);
  cur = rawSched().find((s: any) => s.id === cw.id);
  ok("none -> weekly: date cleared, weekday kept", cur.recurrence === "weekly" && !("date" in cur) && cur.dayOfWeek === 4);
  // Edit: weekly -> biweekly.
  await editViaStorage(cw.id, { ...(await formFor(cw.id)), recurrence: "biweekly", date: "2026-11-05" }, { ...NONE, recurrence: true, date: true }, t1);
  cur = rawSched().find((s: any) => s.id === cw.id);
  ok("weekly -> biweekly", cur.recurrence === "biweekly" && cur.date === "2026-11-05" && cur.dayOfWeek === 4);
  // Edit: change the day on a weekly.
  await editViaStorage(cn.id, { ...(await formFor(cn.id)), recurrence: "weekly", dayOfWeek: 6 }, { ...NONE, recurrence: true, dayOfWeek: true }, t1);
  cur = rawSched().find((s: any) => s.id === cn.id);
  ok("none -> weekly on Saturday", cur.recurrence === "weekly" && cur.dayOfWeek === 6 && !("date" in cur));
  // Move the anchor of a biweekly.
  await editViaStorage(cb.id, { ...(await formFor(cb.id)), date: "2026-11-11" }, { ...NONE, date: true }, t1);
  cur = rawSched().find((s: any) => s.id === cb.id);
  ok("biweekly anchor moved, weekday follows", cur.date === "2026-11-11" && cur.dayOfWeek === 3 && cur.recurrence === "biweekly");
  // Edit of a record that vanished is a no-op.
  const before = JSON.stringify(rawSched());
  await editViaStorage("nope", fv(), NONE, t1);
  ok("editing a missing id changes nothing", JSON.stringify(rawSched()) === before);

  // Delete.
  await storage.update("schedules", (l) => l.filter((s) => s.id !== cn.id));
  ok("delete removes only that record", rawSched().length === 2 && !rawSched().some((s: any) => s.id === cn.id));
  // Parallel writes don't lose anything.
  await Promise.all(Array.from({ length: 20 }, (_, i) => storage.update("schedules", (l) => [...l, S.createSchedule(fv({ room: `P${i}` }), now0)])));
  ok("20 parallel adds all kept", rawSched().length === 22);

  /* ================= enum preservation ================= */
  const seed = (rec: Record<string, unknown>) => {
    mem.clear();
    mem.set(SCHED_KEY, JSON.stringify([{ id: "x1", subjectId: "s1", startTime: "08:00", endTime: "09:40", room: "R", createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z", mystery: { a: 1 }, ...rec }]));
  };
  const saved = () => rawSched()[0];

  seed({ mode: "hybrid", recurrence: "monthly", dayOfWeek: 9 });
  let f = await formFor("x1");
  eq("form shows the fallbacks", [f.mode, f.recurrence, f.dayOfWeek], ["offline", "weekly", 1]);
  await editViaStorage("x1", { ...f, room: "Baru" }, NONE);
  ok("edit room only: unknown mode/recurrence/dayOfWeek survive", saved().mode === "hybrid" && saved().recurrence === "monthly" && saved().dayOfWeek === 9 && saved().room === "Baru", saved());
  ok("unknown extra field + updatedAt", saved().mystery.a === 1 && saved().updatedAt !== "2026-01-01T00:00:00Z");
  f = await formFor("x1");
  await editViaStorage("x1", { ...f, startTime: "07:00" }, NONE, new Date(2026, 10, 21));
  ok("second edit in a row still keeps them", saved().mode === "hybrid" && saved().recurrence === "monthly" && saved().dayOfWeek === 9 && saved().startTime === "07:00", saved());
  ok("no date was invented for the unknown recurrence", !("date" in saved()));

  seed({ mode: "hybrid", recurrence: "monthly", dayOfWeek: 9 });
  f = await formFor("x1");
  await editViaStorage("x1", { ...f, mode: "offline" }, { ...NONE, mode: true });
  ok("clicking Offline (same as fallback) is saved", saved().mode === "offline" && saved().recurrence === "monthly" && saved().dayOfWeek === 9, saved());
  seed({ mode: "hybrid", recurrence: "monthly", dayOfWeek: 9 });
  f = await formFor("x1");
  await editViaStorage("x1", { ...f, mode: "online" }, { ...NONE, mode: true });
  ok("mode chosen = online", saved().mode === "online" && saved().recurrence === "monthly" && saved().dayOfWeek === 9);
  seed({ mode: "hybrid", recurrence: "monthly", dayOfWeek: 9 });
  f = await formFor("x1");
  await editViaStorage("x1", { ...f, recurrence: "weekly" }, { ...NONE, recurrence: true });
  ok("clicking Weekly saves weekly (and weekday follows the form, since recurrence was touched)", saved().recurrence === "weekly" && saved().mode === "hybrid" && saved().dayOfWeek === 1, saved());
  seed({ mode: "hybrid", recurrence: "monthly", dayOfWeek: 9 });
  f = await formFor("x1");
  await editViaStorage("x1", { ...f, dayOfWeek: 5 }, { ...NONE, dayOfWeek: true });
  ok("picking a day saves it, others stay", saved().dayOfWeek === 5 && saved().mode === "hybrid" && saved().recurrence === "monthly");
  seed({ mode: "hybrid", recurrence: "monthly", dayOfWeek: 9 });
  f = await formFor("x1");
  await editViaStorage("x1", { ...f, recurrence: "none", date: "2026-11-10" }, { ...NONE, recurrence: true, date: true });
  ok("recurrence -> none with a date: weekday derived, mode kept", saved().recurrence === "none" && saved().date === "2026-11-10" && saved().dayOfWeek === 2 && saved().mode === "hybrid");

  // Legacy string weekday "3" (recognized after coercion, original kept when untouched).
  seed({ dayOfWeek: "3" });
  f = await formFor("x1");
  ok("string weekday shown as 3", f.dayOfWeek === 3);
  await editViaStorage("x1", { ...f, room: "Z" }, NONE);
  ok("untouched legacy \"3\" is written back as it was", saved().dayOfWeek === "3" && saved().room === "Z", saved());
  // Plain Phase 1 record: no recurrence/mode stored at all.
  seed({ dayOfWeek: 2 });
  f = await formFor("x1");
  await editViaStorage("x1", { ...f, room: "Q" }, NONE);
  ok("Phase 1 record edit: stays weekly Tue; mode/recurrence now written explicitly", saved().dayOfWeek === 2 && saved().recurrence === "weekly" && saved().mode === "offline" && saved().room === "Q", saved());
  // Reading never writes.
  seed({ dayOfWeek: 2, mode: "weird" });
  const rawBefore = mem.get(SCHED_KEY);
  await storage.read("schedules"); await formFor("x1");
  ok("read leaves storage byte-identical", mem.get(SCHED_KEY) === rawBefore);
  // Saving a different record doesn't touch an unknown-enum record.
  mem.set(SCHED_KEY, JSON.stringify([
    { id: "u1", subjectId: "s1", startTime: "08:00", endTime: "09:00", dayOfWeek: 2, mode: "hybrid", recurrence: "monthly", createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z" },
    { id: "k1", subjectId: "s1", startTime: "10:00", endTime: "11:00", dayOfWeek: 2, mode: "offline", recurrence: "weekly", createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z" },
  ]));
  await storage.read("schedules");
  await editViaStorage("k1", { ...(await formFor("k1")), room: "X" }, NONE);
  const u1 = rawSched().find((s: any) => s.id === "u1");
  ok("editing a sibling keeps an unknown-enum record exactly", u1.mode === "hybrid" && u1.recurrence === "monthly" && u1.updatedAt === "2026-01-01T00:00:00Z", u1);
  await storage.update("schedules", (l) => l.filter((s) => s.id !== "k1"));
  ok("deleting a sibling keeps it too", rawSched().length === 1 && rawSched()[0].mode === "hybrid");
  // Non-object entries aren't lost by schedule saves.
  mem.set(SCHED_KEY, JSON.stringify([{ id: "k2", subjectId: "s1", startTime: "10:00", endTime: "11:00", dayOfWeek: 2 }, "garbage", 42]));
  await storage.update("schedules", (l) => [...l, cw]);
  ok("orphan entries kept on write", rawSched().includes("garbage") && rawSched().includes(42));
  // A malformed date in a record is not lost by saving another record.
  mem.set(SCHED_KEY, JSON.stringify([
    { id: "m1", subjectId: "s1", startTime: "08:00", endTime: "09:00", recurrence: "none", date: "2026-02-30", createdAt: "x", updatedAt: "x" },
    { id: "m2", subjectId: "s1", startTime: "10:00", endTime: "11:00", dayOfWeek: 2, recurrence: "weekly", createdAt: "x", updatedAt: "x" },
  ]));
  await storage.read("schedules");
  await editViaStorage("m2", { ...(await formFor("m2")), room: "K" }, NONE);
  ok("malformed date of another record survives", rawSched().find((s: any) => s.id === "m1").date === "2026-02-30");
  // fieldsToPreserve unit behaviour.
  const getRaw = (field: string) => ({ mode: "m", recurrence: "r", dayOfWeek: "d" } as Record<string, unknown>)[field];
  eq("preserve: nothing touched -> all three", S.scheduleFieldsToPreserve(NONE, getRaw as any), { mode: "m", recurrence: "r", dayOfWeek: "d" });
  eq("preserve: date touched -> weekday not preserved", S.scheduleFieldsToPreserve({ ...NONE, date: true }, getRaw as any), { mode: "m", recurrence: "r" });
  eq("preserve: recurrence touched -> recurrence+weekday not preserved", S.scheduleFieldsToPreserve({ ...NONE, recurrence: true }, getRaw as any), { mode: "m" });
  eq("preserve: everything recognized -> nothing", S.scheduleFieldsToPreserve(NONE, () => undefined), {});

  // Legacy migration still feeds schedules.
  mem.clear();
  mem.set("campusmate_schedules", JSON.stringify([{ id: "1", subjectId: "s1", dayOfWeek: 1, startTime: "08:00", endTime: "09:40" }]));
  // Migration runs once per page load (already spent earlier in this process), so call it directly.
  const { migrateLegacyKeys } = await import("@/lib/storage");
  migrateLegacyKeys((globalThis as any).window.localStorage);
  const migrated = await storage.read("schedules");
  ok("legacy campusmate_schedules is read as weekly Monday", migrated.length === 1 && migrated[0].recurrence === "weekly" && S.occursOn(migrated[0], "2026-11-09"));
  ok("legacy key untouched", mem.get("campusmate_schedules")!.includes('"dayOfWeek":1'));

  /* ================= calendar ================= */
  const subs: Subject[] = [
    { id: "s1", name: "Basis Data", code: "IF2140", color: "#65B8FF", createdAt: "x", updatedAt: "x" },
    { id: "s2", name: "Kalkulus", color: "#FF8A7A", createdAt: "x", updatedAt: "x" },
  ];
  const tasks = [
    normalizeTask({ id: "t1", title: "Laporan", subjectId: "s1", deadline: "2026-11-18", deadlineTime: "23:00", status: "todo", createdAt: "x" }),
    normalizeTask({ id: "t2", title: "Lama (dueDate)", dueDate: "2026-11-18", status: "done", createdAt: "x" }),
    normalizeTask({ id: "t3", title: "Tanpa deadline", createdAt: "x" }),
    normalizeTask({ id: "t4", title: "Rusak", deadline: "bukan-tanggal", createdAt: "x" }),
  ];
  const events = [
    normalizeEvent({ id: "e1", title: "UTS Basis Data", date: "2026-11-18", startTime: "07:30", endTime: "09:30", location: "Aula", subjectId: "s1", category: "uts", createdAt: "x" }),
    normalizeEvent({ id: "e2", title: "Seminar", date: "2026-11-20", createdAt: "x" }),
    normalizeEvent({ id: "e3", title: "Tanpa tanggal", createdAt: "x" }),
    normalizeEvent({ id: "e4", title: "Aneh", date: "2026-11-18", category: "hologram", createdAt: "x" }),
  ];
  const scheds = [
    sch({ id: "c1", subjectId: "s1", recurrence: "biweekly", date: "2026-11-04", dayOfWeek: 3, startTime: "09:00", endTime: "10:40", room: "R.301" }),
    sch({ id: "c2", subjectId: "s2", recurrence: "weekly", dayOfWeek: 3, startTime: "13:00", endTime: "14:40", mode: "online" }),
    sch({ id: "c3", subjectId: "gone", recurrence: "none", date: "2026-11-18", dayOfWeek: 3, startTime: "16:00", endTime: "17:00" }),
  ];
  const src = { schedules: scheds, tasks, events, subjects: subs };
  const d18 = C.entriesForDate("2026-11-18", src);
  eq("18 Nov merges all three sources, timed first then all-day", d18.map((e) => `${e.kind}:${e.sourceId}`), ["event:e1", "class:c1", "class:c2", "class:c3", "task:t1", "event:e4", "task:t2"]);
  ok("class entry details", d18[1].title === "Basis Data" && d18[1].startTime === "09:00" && d18[1].endTime === "10:40" && d18[1].detail === "R.301" && d18[1].color === "#65B8FF");
  ok("online class says Online", d18[2].detail === "Online");
  ok("class with deleted subject still shown, neutral name", d18[3].title === "Mata kuliah dihapus" && d18[3].color === undefined);
  ok("task entry: deadline time, subject, not done", d18[4].startTime === "23:00" && d18[4].detail === "Basis Data" && d18[4].done === false);
  ok("legacy dueDate task shows, flagged done", d18[6].title === "Lama (dueDate)" && d18[6].done === true);
  ok("event: category label, location and subject in detail", d18[0].detail === "UTS · Aula · Basis Data");
  ok("event with unknown category normalizes to Lainnya", d18[5].detail === "Lainnya");
  ok("keys unique", new Set(d18.map((e) => e.key)).size === d18.length);
  eq("11 Nov: only the weekly class (biweekly off-week)", C.entriesForDate("2026-11-11", src).map((e) => e.sourceId), ["c2"]);
  eq("20 Nov: only the event", C.entriesForDate("2026-11-20", src).map((e) => `${e.kind}:${e.sourceId}`), ["event:e2"]);
  eq("empty day", C.entriesForDate("2026-11-21", src), []);
  eq("invalid date", C.entriesForDate("nope", src), []);
  ok("tasks without/with broken deadline and events without date appear nowhere", !["2026-11-18", "2026-11-20"].some((d) => C.entriesForDate(d, src).some((e) => ["t3", "t4", "e3"].includes(e.sourceId))));
  // Source of truth: change the sources, the calendar follows; no calendar storage exists.
  ok("no calendar collection in storage", !Object.keys(STORAGE_KEYS).some((k) => /calendar/i.test(k)));
  const src2 = { ...src, schedules: scheds.filter((s) => s.id !== "c2"), tasks: tasks.filter((t) => t.id !== "t1") };
  eq("removing a class and a task updates 18 Nov at once", C.entriesForDate("2026-11-18", src2).map((e) => `${e.kind}:${e.sourceId}`), ["event:e1", "class:c1", "class:c3", "event:e4", "task:t2"]);

  // Month grid.
  const nov1 = C.monthGrid(2026, 10, 1);
  ok("Nov 2026 (Mon start): 6 rows, starts 26 Oct, ends 6 Dec", nov1.length === 42 && nov1[0].key === "2026-10-26" && nov1[41].key === "2026-12-06", [nov1.length, nov1[0].key, nov1[41].key]);
  eq("Nov 2026 in-month count", nov1.filter((c) => c.inMonth).length, 30);
  ok("first in-month cell is the 1st (a Sunday, last column)", nov1[6].key === "2026-11-01" && nov1[6].inMonth && !nov1[5].inMonth);
  const nov0 = C.monthGrid(2026, 10, 0);
  ok("Nov 2026 (Sun start): 5 rows, 1 Nov..5 Dec", nov0.length === 35 && nov0[0].key === "2026-11-01" && nov0[34].key === "2026-12-05");
  const feb = C.monthGrid(2027, 1, 1);
  ok("Feb 2027 starts Monday: exactly 4 rows", feb.length === 28 && feb[0].key === "2027-02-01" && feb[27].key === "2027-02-28");
  const feb28 = C.monthGrid(2028, 1, 1);
  ok("Feb 2028 leap year has the 29th", feb28.some((c) => c.key === "2028-02-29" && c.inMonth));
  ok("all keys unique and consecutive", nov1.every((c, i) => i === 0 || D.diffInDays(nov1[i - 1].key, c.key) === 1));
  eq("shiftMonth +1 Dec->Jan", C.shiftMonth({ year: 2026, month: 11 }, 1), { year: 2027, month: 0 });
  eq("shiftMonth -1 Jan->Dec", C.shiftMonth({ year: 2027, month: 0 }, -1), { year: 2026, month: 11 });
  eq("shiftMonth +14", C.shiftMonth({ year: 2026, month: 10 }, 14), { year: 2028, month: 0 });
  eq("monthOf", [C.monthOf("2026-11-15"), C.monthOf("x")], [{ year: 2026, month: 10 }, null]);
  eq("default selection: today when in month", C.defaultSelectionFor({ year: 2026, month: 10 }, "2026-11-15"), "2026-11-15");
  eq("default selection: the 1st otherwise", C.defaultSelectionFor({ year: 2026, month: 11 }, "2026-11-15"), "2026-12-01");

  const byDate = C.entriesByDate(nov1, src);
  ok("recurring biweekly lands on the right Wednesdays of Nov", ["2026-11-04", "2026-11-18"].every((d) => byDate.get(d)?.some((e) => e.sourceId === "c1")) && !["2026-11-11", "2026-11-25"].some((d) => byDate.get(d)?.some((e) => e.sourceId === "c1")));
  eq("weekly class appears on all 4 Wednesdays", [...byDate].filter(([, l]) => l.some((e) => e.sourceId === "c2")).map(([k]) => k).filter((k) => k.startsWith("2026-11")), ["2026-11-04", "2026-11-11", "2026-11-18", "2026-11-25"]);
  eq("dots: kinds in fixed order", C.kindsPresent(byDate.get("2026-11-18")), ["class", "event", "task"]);
  eq("dots: single kind", C.kindsPresent(byDate.get("2026-11-20")), ["event"]);
  eq("dots: none", C.kindsPresent(byDate.get("2026-11-21")), []);
  eq("dots: undefined", C.kindsPresent(undefined), []);
  const agenda = C.agendaForMonth(nov1, byDate);
  eq("agenda: only days with something, in order, in-month only", agenda.map((d) => d.date), ["2026-11-04", "2026-11-11", "2026-11-18", "2026-11-20", "2026-11-25"]);
  ok("agenda excludes greyed neighbour-month days", agenda.every((d) => d.date.startsWith("2026-11")));
  // Neighbour-month day in the grid still has its entries (for the dots).
  const dec = C.entriesByDate(C.monthGrid(2026, 11, 1), src);
  ok("Dec grid includes late-Nov greyed days with entries", dec.has("2026-11-30") === false && dec.has("2026-12-02"));

  // Calendar over data that went through storage (end to end, new "refresh").
  mem.clear();
  await storage.write("schedules", [cb, cw].map((s) => ({ ...s })) as any);
  await storage.write("tasks", tasks);
  const reloaded = { schedules: await storage.read("schedules"), tasks: await storage.read("tasks"), events: await storage.read("events"), subjects: subs };
  ok("calendar over re-read storage still lists the task deadline and the class", C.entriesForDate("2026-11-18", reloaded).some((e) => e.kind === "task" && e.sourceId === "t1"));

  // Deleting a subject (Subjects page only writes `subjects`) doesn't touch schedules.
  mem.clear();
  const schedJson = JSON.stringify([{ id: "z", subjectId: "s1", dayOfWeek: 2, startTime: "08:00", endTime: "09:00", mode: "offline", recurrence: "weekly", createdAt: "x", updatedAt: "x" }]);
  mem.set(SCHED_KEY, schedJson);
  mem.set(STORAGE_KEYS.subjects, JSON.stringify([{ id: "s1", name: "A", color: "#000", createdAt: "x", updatedAt: "x" }]));
  await storage.update("subjects", (l) => l.filter((s) => s.id !== "s1"));
  ok("subject delete leaves schedules byte-identical", mem.get(SCHED_KEY) === schedJson);
  const afterDelete = await storage.read("schedules");
  ok("schedule of a deleted subject still occurs and needs a new subject only on edit", S.occursOn(afterDelete[0], "2026-11-10") && S.subjectTitle(undefined) === "Mata kuliah dihapus");
  const orphanForm = S.scheduleToFormValues(afterDelete[0], new Set<string>());
  ok("form of an orphan schedule has no subject selected -> validation asks for one", orphanForm.subjectId === "" && !!S.validateScheduleForm(orphanForm).subjectId);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}
main();
