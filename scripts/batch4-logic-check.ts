// Run from the project root (needs `npx tsx`, no install needed in the project):
//   TZ=Asia/Jakarta npx tsx scripts/batch4-logic-check.ts
// Try other zones too (DST): TZ=America/New_York, TZ=Europe/London, TZ=Pacific/Auckland
export {}; // makes this file a module so the scripts don't share globals under `tsc`
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
  const E = await import("@/lib/events");
  const C = await import("@/lib/calendar");
  const { EVENT_CATEGORIES, EVENT_CATEGORY_LABELS, eventTypeFromCategory } = await import("@/lib/domain");
  const { storage, migrateLegacyKeys } = await import("@/lib/storage");
  const { normalizeEvent, normalizeTask } = await import("@/lib/normalize");
  const { STORAGE_KEYS } = await import("@/lib/storage-keys");
  type Ev = import("@/types").CampusEvent;
  type Subject = import("@/types").Subject;

  const KEY = STORAGE_KEYS.events;
  const raw = () => JSON.parse(mem.get(KEY) ?? "null");
  const ev = (o: Record<string, unknown>): Ev => normalizeEvent({ title: String(o.id), createdAt: "2026-01-01T00:00:00Z", date: "2026-11-18", ...o }, 0);
  const fv = (o: Partial<import("@/lib/events").EventFormValues> = {}): import("@/lib/events").EventFormValues => ({ ...E.EMPTY_EVENT_FORM, title: "Event", date: "2026-11-18", ...o });
  const NONE = E.EVENT_UNTOUCHED;
  const TOUCHED = { category: true };
  const rawOf = (id: string) => (f: "category" | "type") => storage.getCoercedRaw("events", id, f);
  /** Same flow as EventsView.handleSave for an edit. */
  const editViaStorage = (id: string, values: import("@/lib/events").EventFormValues, touched: import("@/lib/events").EventFormTouched, now = new Date(2026, 10, 20, 10, 0)) =>
    storage.update("events", (list) =>
      list.map((e) => (e.id === id ? E.applyEventEdit(e, values, now, E.eventFieldsToPreserve(touched, rawOf(id)), touched) : e)));
  const formFor = async (id: string) => {
    const list = await storage.read("events");
    return E.eventToFormValues(list.find((e) => e.id === id)!, new Set(["s1", "s2"]));
  };
  const now = new Date(2026, 10, 15, 12, 0); // Sun 15 Nov 2026, noon

  const subs: Subject[] = [
    { id: "s1", name: "Basis Data", code: "IF2140", color: "#65B8FF", createdAt: "x", updatedAt: "x" },
    { id: "s2", name: "Kalkulus", color: "#FF8A7A", createdAt: "x", updatedAt: "x" },
  ];
  const byId = new Map(subs.map((s) => [s.id, s]));

  /* ================= all categories ================= */
  const EXPECT_TYPE: Record<string, string> = { uts: "exam", uas: "exam", quiz: "exam", praktikum: "exam", presentasi: "other", seminar: "other", lainnya: "other" };
  eq("7 categories on the model", [...EVENT_CATEGORIES], ["uts", "uas", "quiz", "presentasi", "praktikum", "seminar", "lainnya"]);
  eq("labels", EVENT_CATEGORIES.map((c) => EVENT_CATEGORY_LABELS[c]), ["UTS", "UAS", "Quiz", "Presentasi", "Praktikum", "Seminar", "Lainnya"]);
  mem.clear();
  for (const c of EVENT_CATEGORIES) {
    const created = E.createEvent(fv({ title: `Tes ${c}`, category: c }), now);
    await storage.update("events", (l) => [...l, created]);
  }
  const allCats = await storage.read("events");
  ok("all 7 categories survive a write + re-read", EVENT_CATEGORIES.every((c, i) => allCats[i].category === c));
  ok("type is derived from category on create", EVENT_CATEGORIES.every((c, i) => allCats[i].type === EXPECT_TYPE[c] && allCats[i].type === eventTypeFromCategory(c)));
  ok("nothing was coerced (all recognized)", EVENT_CATEGORIES.every((c, i) => storage.getCoercedRaw("events", allCats[i].id, "category") === undefined));
  ok("every category label shows on the calendar", EVENT_CATEGORIES.every((c, i) => C.entriesForDate("2026-11-18", { schedules: [], tasks: [], events: allCats, subjects: subs }).some((e) => e.sourceId === allCats[i].id && e.categoryLabel === EVENT_CATEGORY_LABELS[c])));

  /* ================= validation ================= */
  eq("valid minimal form", E.validateEventForm(fv()), {});
  ok("title required", !!E.validateEventForm(fv({ title: "   " })).title);
  ok("date required", !!E.validateEventForm(fv({ date: "" })).date);
  ok("impossible date", !!E.validateEventForm(fv({ date: "2026-02-30" })).date);
  ok("times optional", Object.keys(E.validateEventForm(fv({ startTime: "", endTime: "" }))).length === 0);
  ok("start only ok", Object.keys(E.validateEventForm(fv({ startTime: "08:00" }))).length === 0);
  ok("end without start rejected", !!E.validateEventForm(fv({ startTime: "", endTime: "09:00" })).startTime);
  ok("end before start rejected", !!E.validateEventForm(fv({ startTime: "10:00", endTime: "09:00" })).endTime);
  ok("end equal to start rejected", !!E.validateEventForm(fv({ startTime: "10:00", endTime: "10:00" })).endTime);
  ok("bad time format", !!E.validateEventForm(fv({ startTime: "25:00" })).startTime);

  /* ================= create ================= */
  const c1 = E.createEvent(fv({ title: "  UTS Basis Data ", description: " Bab 1-5 ", category: "uts", startTime: "07:30", endTime: "09:30", location: " Aula ", subjectId: "s1" }), now);
  ok("create: trims, keeps fields", c1.title === "UTS Basis Data" && c1.description === "Bab 1-5" && c1.location === "Aula" && c1.subjectId === "s1" && c1.startTime === "07:30" && c1.endTime === "09:30" && c1.date === "2026-11-18");
  ok("create: type exam for UTS, timestamps equal and local-independent ISO", c1.type === "exam" && c1.createdAt === c1.updatedAt && c1.createdAt === now.toISOString());
  const c2 = E.createEvent(fv({ description: "", location: "  ", subjectId: "", startTime: "", endTime: "09:00" }), now);
  ok("create: blanks become undefined, end dropped without start", c2.description === undefined && c2.location === undefined && c2.subjectId === undefined && c2.startTime === undefined && c2.endTime === undefined);
  ok("create: unique ids", c1.id !== c2.id && c1.id.length > 0);
  ok("create: date key kept exactly as picked (no UTC shift)", E.createEvent(fv({ date: "2026-12-31" }), new Date(2026, 11, 31, 23, 59)).date === "2026-12-31");

  /* ================= CRUD through storage + persistence ================= */
  mem.clear();
  await storage.update("events", (l) => [...l, c1]);
  await storage.update("events", (l) => [...l, c2]);
  ok("2 events in localStorage under the events key only", raw().length === 2 && [...mem.keys()].every((k) => k === KEY));
  const re1 = await storage.read("events"); // reload re-reads and re-normalizes
  eq("persisted data re-reads identically", re1.map((e) => [e.id, e.title, e.category, e.type, e.date, e.startTime ?? null]), [c1, c2].map((e) => [e.id, e.title, e.category, e.type, e.date, e.startTime ?? null]));
  ok("reading never wrote", JSON.stringify(raw()) === JSON.stringify([c1, c2]));

  const t1 = new Date(2026, 10, 20, 10, 0);
  await editViaStorage(c1.id, { ...(await formFor(c1.id)), title: "UTS Basis Data (revisi)", location: "Lab 2" }, NONE, t1);
  let cur = raw().find((e: any) => e.id === c1.id);
  ok("edit saved, updatedAt bumped, createdAt kept", cur.title === "UTS Basis Data (revisi)" && cur.location === "Lab 2" && cur.updatedAt === t1.toISOString() && cur.createdAt === c1.createdAt);
  ok("edit leaves category/type as they were", cur.category === "uts" && cur.type === "exam");
  ok("sibling untouched byte for byte", JSON.stringify(raw().find((e: any) => e.id === c2.id)) === JSON.stringify(c2));
  await editViaStorage(c1.id, { ...(await formFor(c1.id)), category: "seminar" }, TOUCHED, t1);
  cur = raw().find((e: any) => e.id === c1.id);
  ok("category touched -> type derived (exam -> other)", cur.category === "seminar" && cur.type === "other");
  await editViaStorage(c1.id, { ...(await formFor(c1.id)), category: "uas", date: "2026-12-10", startTime: "", endTime: "", description: "", subjectId: "s2" }, TOUCHED, t1);
  cur = raw().find((e: any) => e.id === c1.id);
  ok("category back to UAS -> exam; date/time/description/subject updated, cleared fields gone", cur.type === "exam" && cur.date === "2026-12-10" && !("startTime" in cur) && !("endTime" in cur) && !("description" in cur) && cur.subjectId === "s2");
  const before = JSON.stringify(raw());
  await editViaStorage("nope", fv(), NONE, t1);
  ok("editing a missing id changes nothing", JSON.stringify(raw()) === before);
  await storage.update("events", (l) => l.filter((e) => e.id !== c2.id));
  ok("delete removes only that record", raw().length === 1 && raw()[0].id === c1.id);
  await Promise.all(Array.from({ length: 20 }, (_, i) => storage.update("events", (l) => [...l, E.createEvent(fv({ title: `P${i}` }), now)])));
  ok("20 parallel adds all kept", raw().length === 21);

  /* ================= filters, sort, labels ================= */
  const list: Ev[] = [
    ev({ id: "e1", title: "UTS Basis Data", category: "uts", date: "2026-11-18", location: "Aula B", description: "Bab 1-5 normalisasi", subjectId: "s1", startTime: "07:30", endTime: "09:30" }),
    ev({ id: "e2", title: "Quiz Kalkulus", category: "quiz", date: "2026-11-15", subjectId: "s2" }),
    ev({ id: "e3", title: "Seminar AI", category: "seminar", date: "2026-11-20", location: "Auditorium" }),
    ev({ id: "e4", title: "UAS Semester Lalu", category: "uas", date: "2026-11-10" }),
    ev({ id: "e5", title: "Praktikum Jaringan", category: "praktikum", date: "2026-11-14", startTime: "13:00" }),
    ev({ id: "e6", title: "Tanpa tanggal", category: "lainnya", date: "" }),
    ev({ id: "e7", title: "Presentasi Kelompok", category: "presentasi", date: "2026-11-15", startTime: "09:00", endTime: "10:00" }),
    ev({ id: "e8", title: "Workshop", category: "lainnya", date: "2026-11-22" }),
    ev({ id: "e9", title: "Kuis Susulan", category: "quiz", date: "2026-11-21" }),
  ];
  const F = (o: Partial<import("@/lib/events").EventFilters>) =>
    E.filterEvents(list, byId, { query: "", category: "all", time: "all", ...o }, now).map((e) => e.id);
  eq("no filter keeps everything in input order", F({}), ["e1", "e2", "e3", "e4", "e5", "e6", "e7", "e8", "e9"]);
  eq("search title, case-insensitive, trimmed", F({ query: "  seminar " }), ["e3"]);
  eq("search description", F({ query: "NORMALISASI" }), ["e1"]);
  eq("search location", F({ query: "auditorium" }), ["e3"]);
  eq("search subject name (e2 also matches by title)", F({ query: "kalkulus" }), ["e2"]);
  eq("search matches subject name even when the title doesn't", F({ query: "basis data" }), ["e1"]);
  eq("search subject code", F({ query: "if2140" }), ["e1"]);
  eq("search no match", F({ query: "zzz" }), []);
  eq("category uts", F({ category: "uts" }), ["e1"]);
  eq("category quiz", F({ category: "quiz" }), ["e2", "e9"]);
  eq("category lainnya", F({ category: "lainnya" }), ["e6", "e8"]);
  eq("time today", F({ time: "today" }), ["e2", "e7"]);
  eq("time week = today..+6 (21 Nov in, 22 Nov out)", F({ time: "week" }), ["e1", "e2", "e3", "e7", "e9"]);
  eq("time upcoming (today and later)", F({ time: "upcoming" }), ["e1", "e2", "e3", "e7", "e8", "e9"]);
  eq("time past", F({ time: "past" }), ["e4", "e5"]);
  ok("undated only under 'all'", F({}).includes("e6") && ["today", "week", "upcoming", "past"].every((t) => !F({ time: t as any }).includes("e6")));
  eq("category + time", F({ category: "quiz", time: "upcoming" }), ["e2", "e9"]);
  eq("query + category + time", F({ query: "kuis", category: "quiz", time: "week" }), ["e9"]);
  eq("past + category with no match", F({ category: "uts", time: "past" }), []);
  eq("sort: nearest first, then recent past, then undated", E.sortEvents(list, now).map((e) => e.id), ["e2", "e7", "e1", "e3", "e9", "e8", "e5", "e4", "e6"]);
  ok("sort doesn't mutate", list[0].id === "e1" && list[8].id === "e9");
  const tie = [ev({ id: "t3", title: "B", date: "2026-11-20", startTime: "10:00" }), ev({ id: "t2", title: "A", date: "2026-11-20", startTime: "10:00" }), ev({ id: "t1", title: "C", date: "2026-11-20" })];
  eq("same date: all-day first, then time, then title", E.sortEvents(tie, now).map((e) => e.id), ["t1", "t2", "t3"]);
  const pastTie = [ev({ id: "p1", title: "A", date: "2026-11-10", startTime: "08:00" }), ev({ id: "p2", title: "B", date: "2026-11-10", startTime: "14:00" })];
  eq("same past date: later time first", E.sortEvents(pastTie, now).map((e) => e.id), ["p2", "p1"]);
  eq("daysAway", [E.eventDaysAway(list[1], now), E.eventDaysAway(list[2], now), E.eventDaysAway(list[3], now), E.eventDaysAway(list[5], now)], [0, 5, -5, null]);
  const info = (id: string) => E.eventDateInfo(list.find((e) => e.id === id)!, now);
  ok("date info: today/tomorrow/soon/normal/yesterday/past/none",
    info("e2").tone === "today" && info("e2").label.startsWith("Hari ini · ") &&
    E.eventDateInfo(ev({ id: "x", date: "2026-11-16" }), now).label.startsWith("Besok · ") &&
    info("e1").tone === "soon" && info("e1").label.startsWith("3 hari lagi · ") &&
    info("e3").tone === "normal" && info("e3").label.startsWith("5 hari lagi · ") &&
    E.eventDateInfo(ev({ id: "y", date: "2026-11-14" }), now).label.startsWith("Kemarin · ") &&
    info("e4").tone === "past" && info("e4").label.startsWith("5 hari lalu · ") &&
    info("e6").tone === "none" && info("e6").label === "Belum ada tanggal");
  eq("time labels", [E.eventTimeLabel(list[0]), E.eventTimeLabel(list[4]), E.eventTimeLabel(list[1])], ["07:30 - 09:30", "13:00", "Seharian"]);

  /* ================= legacy data ================= */
  const seed = (rec: Record<string, unknown> | Record<string, unknown>[] | unknown[]) => {
    mem.clear();
    mem.set(KEY, JSON.stringify(Array.isArray(rec) ? rec : [{ id: "x1", title: "Aneh", date: "2026-11-18", createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z", mystery: { a: 1 }, ...rec }]));
  };
  const saved = () => raw()[0];

  seed({ title: "UTS Basis Data", type: "exam" }); // Phase 1: type only, no category
  let f = await formFor("x1");
  eq("Phase 1 event: category guessed from title, type kept", [f.category, (await storage.read("events"))[0].type], ["uts", "exam"]);
  const rb = mem.get(KEY);
  await storage.read("events");
  ok("reading legacy data wrote nothing", mem.get(KEY) === rb);
  await editViaStorage("x1", { ...f, description: "Catatan" }, NONE);
  ok("unrelated edit: type stays, category written explicitly as shown, extra field kept, updatedAt bumped", saved().type === "exam" && saved().category === "uts" && saved().description === "Catatan" && saved().mystery.a === 1 && saved().updatedAt !== "2026-01-01T00:00:00Z", saved());

  seed({ title: "Pengumpulan laporan", type: "deadline" });
  f = await formFor("x1");
  eq("legacy type deadline: category falls back to lainnya", f.category, "lainnya");
  await editViaStorage("x1", { ...f, location: "Online" }, NONE);
  ok("unrelated edit keeps legacy type 'deadline'", saved().type === "deadline" && saved().location === "Online", saved());
  seed({ title: "Pengumpulan laporan", type: "deadline" });
  f = await formFor("x1");
  await editViaStorage("x1", { ...f, category: "lainnya" }, TOUCHED);
  ok("choosing a category derives the type (deadline -> other)", saved().type === "other" && saved().category === "lainnya");

  seed({ title: "Seminar lama" }); // no type, no category at all
  f = await formFor("x1");
  eq("no type/category: guessed seminar -> other", [f.category, (await storage.read("events"))[0].type], ["seminar", "other"]);

  seed({ date: "" }); // broken legacy date
  const brokenForm = await formFor("x1");
  ok("event without date: form empty date, validation asks for one", brokenForm.date === "" && !!E.validateEventForm(brokenForm).date);
  ok("event without date never on the calendar", C.entriesForDate("2026-11-18", { schedules: [], tasks: [], events: await storage.read("events"), subjects: subs }).length === 0);
  await editViaStorage("x1", { ...brokenForm, date: "2026-11-30" }, NONE);
  ok("giving it a date fixes it", saved().date === "2026-11-30");

  mem.clear();
  mem.set("campusmate_events", JSON.stringify([{ id: "1", title: "Quiz lama", type: "exam", date: "2026-11-19" }]));
  migrateLegacyKeys((globalThis as any).window.localStorage);
  const mig = await storage.read("events");
  ok("legacy campusmate_events migrated and readable", mig.length === 1 && mig[0].category === "quiz" && mig[0].type === "exam" && mem.get("campusmate_events")!.includes("Quiz lama"));

  /* ================= unknown enum preservation ================= */
  seed({ category: "hologram", type: "party" });
  f = await formFor("x1");
  eq("form shows the fallback category", f.category, "lainnya");
  await editViaStorage("x1", { ...f, location: "Aula" }, NONE);
  ok("edit location only: unknown category AND type survive", saved().category === "hologram" && saved().type === "party" && saved().location === "Aula", saved());
  ok("extra field + updatedAt", saved().mystery.a === 1 && saved().updatedAt !== "2026-01-01T00:00:00Z");
  f = await formFor("x1");
  await editViaStorage("x1", { ...f, title: "Judul baru" }, NONE, new Date(2026, 10, 21));
  ok("second edit in a row still keeps them", saved().category === "hologram" && saved().type === "party" && saved().title === "Judul baru", saved());
  await editViaStorage("x1", { ...(await formFor("x1")), date: "2026-12-01", startTime: "08:00", endTime: "09:00" }, NONE, new Date(2026, 10, 22));
  ok("changing date/time keeps them too", saved().category === "hologram" && saved().type === "party" && saved().date === "2026-12-01");

  seed({ category: "hologram", type: "party" });
  f = await formFor("x1");
  await editViaStorage("x1", { ...f, category: "lainnya" }, TOUCHED);
  ok("clicking Lainnya (same as the fallback shown) is saved, type derived", saved().category === "lainnya" && saved().type === "other", saved());
  seed({ category: "hologram", type: "party" });
  f = await formFor("x1");
  await editViaStorage("x1", { ...f, category: "uts" }, TOUCHED);
  ok("choosing UTS: category uts, type exam (the unknown type is replaced because category was touched)", saved().category === "uts" && saved().type === "exam", saved());

  seed({ title: "Seminar X", category: "hologram" });
  f = await formFor("x1");
  eq("unknown category with 'seminar' in title shows seminar", f.category, "seminar");
  await editViaStorage("x1", { ...f, location: "L" }, NONE);
  ok("but the stored 'hologram' is kept on an unrelated edit", saved().category === "hologram" && saved().location === "L", saved());

  seed({ category: "quiz", type: "party" }); // valid category, unknown type
  f = await formFor("x1");
  eq("valid category + unknown type: form shows quiz", f.category, "quiz");
  await editViaStorage("x1", { ...f, location: "L" }, NONE);
  ok("unknown type kept when category untouched", saved().category === "quiz" && saved().type === "party");
  seed({ category: "quiz", type: "party" });
  f = await formFor("x1");
  await editViaStorage("x1", { ...f, category: "quiz" }, TOUCHED);
  ok("re-picking Quiz is deliberate: type becomes exam", saved().category === "quiz" && saved().type === "exam");

  seed({ category: 5, type: ["x"] }); // wrong JSON types
  await editViaStorage("x1", { ...(await formFor("x1")), location: "L" }, NONE);
  ok("non-string enum values are kept too", saved().category === 5 && JSON.stringify(saved().type) === '["x"]', saved());

  // Siblings and orphans.
  seed([
    { id: "u1", title: "Aneh", date: "2026-11-18", category: "hologram", type: "party", createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z" },
    { id: "k1", title: "Biasa", date: "2026-11-19", category: "quiz", type: "exam", createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z" },
    "garbage", 42,
  ]);
  await storage.read("events");
  await editViaStorage("k1", { ...(await formFor("k1")), location: "X" }, NONE);
  const u1 = raw().find((e: any) => e.id === "u1");
  ok("editing a sibling keeps an unknown-enum record exactly", u1.category === "hologram" && u1.type === "party" && u1.updatedAt === "2026-01-01T00:00:00Z", u1);
  ok("non-object entries kept on write", raw().includes("garbage") && raw().includes(42));
  await storage.update("events", (l) => l.filter((e) => e.id !== "k1"));
  ok("deleting the sibling keeps the unknown-enum record", raw().some((e: any) => e.id === "u1" && e.category === "hologram"));

  // fieldsToPreserve / applyEventEdit units.
  const getRaw = (f: string) => ({ category: "c", type: "t" } as Record<string, unknown>)[f];
  eq("preserve: untouched -> both", E.eventFieldsToPreserve(NONE, getRaw as any), { category: "c", type: "t" });
  eq("preserve: category touched -> neither (type follows category)", E.eventFieldsToPreserve(TOUCHED, getRaw as any), {});
  eq("preserve: nothing unknown -> nothing", E.eventFieldsToPreserve(NONE, () => undefined), {});
  eq("preserve: only type unknown", E.eventFieldsToPreserve(NONE, ((f: string) => (f === "type" ? "t" : undefined)) as any), { type: "t" });
  const base = ev({ id: "z", category: "uts", type: "exam" });
  ok("apply: untouched category, no preserved -> unchanged category/type", (() => { const r = E.applyEventEdit(base, fv({ category: "seminar" }), now); return r.category === "uts" && r.type === "exam"; })());
  ok("apply: touched -> derived", (() => { const r = E.applyEventEdit(base, fv({ category: "seminar" }), now, {}, TOUCHED); return r.category === "seminar" && r.type === "other"; })());
  ok("apply: updatedAt always bumped", E.applyEventEdit(base, fv(), now).updatedAt === now.toISOString() && base.updatedAt !== now.toISOString());

  /* ================= calendar integration ================= */
  mem.clear();
  const srcOf = async () => ({ schedules: await storage.read("schedules"), tasks: await storage.read("tasks"), events: await storage.read("events"), subjects: subs });
  const keysBefore = [...mem.keys()];
  const made = E.createEvent(fv({ title: "UTS Basis Data", category: "uts", date: "2026-11-18", startTime: "07:30", endTime: "09:30", location: "Aula B", subjectId: "s1" }), now);
  await storage.update("events", (l) => [...l, made]);
  let day = C.entriesForDate("2026-11-18", await srcOf());
  let entry = day.find((e) => e.sourceId === made.id)!;
  ok("new event appears on its date", !!entry && entry.kind === "event" && entry.date === "2026-11-18");
  ok("with category label, time, location, subject, subject color", entry.categoryLabel === "UTS" && entry.startTime === "07:30" && entry.endTime === "09:30" && entry.detail === "Aula B · Basis Data" && entry.color === "#65B8FF" && entry.title === "UTS Basis Data");
  ok("and not on other dates", ["2026-11-17", "2026-11-19", "2026-12-18"].every((d) => !C.entriesForDate(d, { schedules: [], tasks: [], events: [made], subjects: subs }).some((e) => e.sourceId === made.id)));
  ok("only the events key exists: no calendar storage, no duplicate record", [...mem.keys()].every((k) => k === KEY) && raw().length === 1 && keysBefore.length === 0);
  const cells = C.monthGrid(2026, 10, 1);
  const idx = C.entriesByDate(cells, await srcOf());
  eq("month dots show an event on the 18th", C.kindsPresent(idx.get("2026-11-18")), ["event"]);
  ok("agenda lists it", C.agendaForMonth(cells, idx).some((d) => d.date === "2026-11-18" && d.entries.some((e) => e.sourceId === made.id)));

  await editViaStorage(made.id, { ...(await formFor(made.id)), date: "2026-11-25", title: "UTS (dimajukan)", category: "quiz", startTime: "", endTime: "", location: "" }, TOUCHED);
  ok("edit: gone from the old date", !C.entriesForDate("2026-11-18", await srcOf()).some((e) => e.sourceId === made.id));
  entry = C.entriesForDate("2026-11-25", await srcOf()).find((e) => e.sourceId === made.id)!;
  ok("edit: on the new date with the new title/category, all-day, no location", !!entry && entry.title === "UTS (dimajukan)" && entry.categoryLabel === "Quiz" && entry.startTime === undefined && entry.endTime === undefined && entry.detail === "Basis Data");
  ok("edit: still one record", raw().length === 1);
  const idx2 = C.entriesByDate(cells, await srcOf());
  ok("edit: month dots follow", C.kindsPresent(idx2.get("2026-11-18")).length === 0 && C.kindsPresent(idx2.get("2026-11-25")).includes("event"));

  // The same date as a class and a task: merged, event ordered by its time.
  const withClass = { ...(await srcOf()), schedules: [normalizeEventLikeSchedule()], tasks: [normalizeTask({ id: "t1", title: "Laporan", deadline: "2026-11-25", createdAt: "x" })] };
  function normalizeEventLikeSchedule() {
    return { id: "c1", subjectId: "s2", dayOfWeek: 3, startTime: "09:00", endTime: "10:00", mode: "offline", recurrence: "weekly", createdAt: "x", updatedAt: "x" } as import("@/types").ScheduleItem;
  }
  eq("event + weekly class + task on 25 Nov", C.entriesForDate("2026-11-25", withClass).map((e) => `${e.kind}:${e.sourceId}`), ["class:c1", "event:" + made.id, "task:t1"]);

  await storage.update("events", (l) => l.filter((e) => e.id !== made.id));
  ok("delete: gone from the calendar at once", !C.entriesForDate("2026-11-25", await srcOf()).some((e) => e.sourceId === made.id) && raw().length === 0);
  ok("delete: month dots cleared", C.kindsPresent(C.entriesByDate(cells, await srcOf()).get("2026-11-25")).length === 0);

  // Deleting a subject keeps the event; calendar just loses the subject label.
  mem.clear();
  const evJson = JSON.stringify([{ id: "q", title: "Quiz", category: "quiz", type: "exam", date: "2026-11-19", subjectId: "s1", createdAt: "x", updatedAt: "x" }]);
  mem.set(KEY, evJson);
  mem.set(STORAGE_KEYS.subjects, JSON.stringify(subs));
  await storage.update("subjects", (l) => l.filter((s) => s.id !== "s1"));
  ok("subject delete leaves events byte-identical", mem.get(KEY) === evJson);
  const afterSub = await storage.read("subjects");
  const q = (await C.entriesForDate("2026-11-19", { schedules: [], tasks: [], events: await storage.read("events"), subjects: afterSub }))[0];
  ok("event of a deleted subject still on the calendar, no subject name/color", q.title === "Quiz" && q.detail === undefined && q.color === undefined);
  const orphanForm = E.eventToFormValues((await storage.read("events"))[0], new Set(afterSub.map((s) => s.id)));
  ok("form of such an event shows 'no subject'", orphanForm.subjectId === "");

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}
main();
