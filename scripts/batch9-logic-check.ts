// Bulk Import 2 (SIAM Format 1 and 2 -> Schedule). Run from the project root:
//   TZ=Asia/Jakarta npx tsx scripts/batch9-logic-check.ts
export {}; // module, so scripts don't share globals under `tsc`
import * as fs from "node:fs";
import * as path from "node:path";

const mem = new Map<string, string>();
let blocked = false;
let failKey: string | null = null;
(globalThis as any).window = {
  localStorage: {
    getItem: (k: string) => (mem.has(k) ? mem.get(k)! : null),
    setItem: (k: string, v: string) => {
      if (blocked) throw new DOMException("Access denied.", "SecurityError");
      if (failKey !== null && k === failKey) throw new DOMException("The quota has been exceeded.", "QuotaExceededError");
      mem.set(k, String(v));
    },
    removeItem: (k: string) => { mem.delete(k); },
    key: (i: number) => [...mem.keys()][i] ?? null,
    get length() { return mem.size; },
  },
  addEventListener: () => {},
};

let pass = 0, fail = 0;
const ok = (name: string, cond: boolean, extra?: unknown) => { if (cond) pass++; else { fail++; console.log("FAIL:", name, extra ?? ""); } };
const eq = (name: string, a: unknown, b: unknown) => ok(name, JSON.stringify(a) === JSON.stringify(b), { got: a, want: b });
const throwsAsync = async (name: string, fn: () => Promise<unknown>) => { try { await fn(); ok(name, false, "did not throw"); } catch { ok(name, true); } };

const F1 = `| Hari | Jam | Mata Kuliah | Kelas | Dosen | Ruang | Action |
|---|---|---|---|---|---|---|
| Senin | 07.00 - 08.40 | Pemrograman Web | A | Dr. Budi Santoso | F2.3 | Detail |
| Selasa | 09.50 - 11.30 | Basis Data | B | Siti Aminah, M.Kom | Lab 2 | Detail |
| Jumat | 13.00 - 14.40 | Kalkulus | C | - | - | Detail |
| Minggu | 08.00 - 09.40 | Kelas Daring | A | Ani | Zoom | Detail |`;
const F2 = `| Hari | MK | Jam | Ruang |
|------|----|-----|-------|
| Senin | Pemrograman Web | 07.00 - 08.40 | F2.3 |
| Rabu | Basis Data | 10:00-11:40 | Lab 2 |
| Sabtu | Kalkulus | 07.00 - 08.40 | |`;
const TSV1 = "Hari\tJam\tMata Kuliah\tKelas\tDosen\tRuang\tAction\nSenin\t07.00 - 08.40\tPemrograman Web\tA\tDr. Budi\tF2.3\tDetail\nKamis\t13.00 - 14.40\tBasis Data\tB\tSiti\tLab 2\tDetail";
const TSV2 = "Hari\tMK\tJam\tRuang\nSelasa\tAlgoritma\t08.00 - 09.40\tG1.1";

async function main() {
  const Siam = await import("@/lib/import/siam");
  const Src = await import("@/lib/import/sources");
  const SP = await import("@/lib/import/schedule-preview");
  const P = await import("@/lib/import/preview");
  const Cm = await import("@/lib/import/commit");
  const Sch = await import("@/lib/schedule");
  const Cal = await import("@/lib/calendar");
  const Dash = await import("@/lib/dashboard");
  const { parseBrone } = await import("@/lib/import/brone");
  const { parseClassroom } = await import("@/lib/import/classroom");
  const { storage } = await import("@/lib/storage");
  const { STORAGE_KEYS } = await import("@/lib/storage-keys");
  const { toDateKey } = await import("@/lib/date");
  type Subject = import("@/types").Subject;
  type ScheduleItem = import("@/types").ScheduleItem;

  const raw = (k: string) => JSON.parse(mem.get(k) ?? "null");
  const reset = () => { mem.clear(); blocked = false; failKey = null; };
  const now = new Date(2026, 10, 15, 12, 0); // Sunday 15 Nov 2026, local
  const subj = (id: string, name: string, code?: string): Subject => ({ id, name, code, color: "#3b82f6", createdAt: "x", updatedAt: "x" });

  /* ================= weekday and time ================= */
  eq("weekdays map to 0 = Sunday", ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"].map(Siam.readWeekday), [0, 1, 2, 3, 4, 5, 6]);
  eq("weekday: case, apostrophe, English", [Siam.readWeekday("SENIN"), Siam.readWeekday("Jum'at"), Siam.readWeekday("Jum’at"), Siam.readWeekday("friday")], [1, 5, 5, 5]);
  eq("weekday: unknown", [Siam.readWeekday("Hari"), Siam.readWeekday(""), Siam.readWeekday("Senin 1")], [null, null, null]);
  eq("time range dots", Siam.readTimeRange("07.00 - 08.40"), { start: "07:00", end: "08:40" });
  eq("time range colon, no spaces", Siam.readTimeRange("10:00-11:40"), { start: "10:00", end: "11:40" });
  eq("time range s/d, WIB, single-digit hour", Siam.readTimeRange("7.00 s/d 8.40 WIB"), { start: "07:00", end: "08:40" });
  eq("time range en dash", Siam.readTimeRange("13.00 – 14.40"), { start: "13:00", end: "14:40" });
  ok("time range: end before start is an error", "error" in (Siam.readTimeRange("10.00 - 09.00") as object));
  ok("time range: equal is an error", "error" in (Siam.readTimeRange("10.00 - 10.00") as object));
  ok("time range: 25.00 is an error", "error" in (Siam.readTimeRange("25.00 - 26.00") as object));
  eq("time range: not a range", [Siam.readTimeRange("Detail"), Siam.readTimeRange(""), Siam.readTimeRange("07.00")], [null, null, null]);

  /* ================= format 1 ================= */
  const r1 = Siam.parseSiam(F1);
  eq("F1 detected", r1.format, 1);
  eq("F1 rows", r1.drafts.length, 4);
  eq("F1 first row", { d: r1.drafts[0].dayOfWeek, s: r1.drafts[0].startTime, e: r1.drafts[0].endTime, n: r1.drafts[0].subjectName, k: r1.drafts[0].className, l: r1.drafts[0].lecturer, r: r1.drafts[0].room }, { d: 1, s: "07:00", e: "08:40", n: "Pemrograman Web", k: "A", l: "Dr. Budi Santoso", r: "F2.3" });
  eq("F1 lecturer with comma kept", r1.drafts[1].lecturer, "Siti Aminah, M.Kom");
  eq("F1 dash = empty (lecturer, room), nothing invented", [r1.drafts[2].lecturer, r1.drafts[2].room], ["", ""]);
  ok("F1 empty room gets a warning", r1.drafts[2].warnings.length === 1);
  eq("F1 Sunday = 0", r1.drafts[3].dayOfWeek, 0);
  eq("F1 no issues, separator row not counted", [r1.issues.length, r1.ignored], [0, 0]);
  ok("the Action column never reaches a draft", r1.drafts.every((d) => !JSON.stringify(d).includes("Detail")));
  eq("F1 line numbers", r1.drafts.map((d) => d.line), [3, 4, 5, 6]);

  /* ================= format 2 ================= */
  const r2 = Siam.parseSiam(F2);
  eq("F2 detected", r2.format, 2);
  eq("F2 rows", r2.drafts.length, 3);
  eq("F2 first row", { d: r2.drafts[0].dayOfWeek, s: r2.drafts[0].startTime, n: r2.drafts[0].subjectName, r: r2.drafts[0].room, k: r2.drafts[0].className, l: r2.drafts[0].lecturer }, { d: 1, s: "07:00", n: "Pemrograman Web", r: "F2.3", k: "", l: "" });
  eq("F2 colon times", [r2.drafts[1].startTime, r2.drafts[1].endTime], ["10:00", "11:40"]);
  eq("F2 Saturday = 6, empty room", [r2.drafts[2].dayOfWeek, r2.drafts[2].room], [6, ""]);

  /* ================= other input shapes ================= */
  const t1 = Siam.parseSiam(TSV1);
  eq("tab-separated F1", [t1.format, t1.drafts.length, t1.drafts[1].dayOfWeek, t1.drafts[1].lecturer], [1, 2, 4, "Siti"]);
  const t2 = Siam.parseSiam(TSV2);
  eq("tab-separated F2", [t2.format, t2.drafts.length, t2.drafts[0].subjectName], [2, 1, "Algoritma"]);
  const reordered = Siam.parseSiam("| MK | Ruang | Hari | Jam |\n|--|--|--|--|\n| Fisika | R1 | Rabu | 08.00 - 09.40 |");
  eq("columns are found by header name, not position", [reordered.drafts[0]?.subjectName, reordered.drafts[0]?.dayOfWeek, reordered.drafts[0]?.room], ["Fisika", 3, "R1"]);
  const noEdgePipes = Siam.parseSiam("Hari | Jam | MK | Ruang\n--- | --- | --- | ---\nSenin | 07.00 - 08.40 | Fisika | R1");
  eq("rows without outer pipes", noEdgePipes.drafts.length, 1);
  const crlf = Siam.parseSiam(F2.replace(/\n/g, "\r\n"));
  eq("CRLF input", crlf.drafts.length, 3);
  const withTitle = Siam.parseSiam("Jadwal Kuliah Semester Ganjil\nNama: Andi\n\n" + F2 + "\n\nTotal 3 mata kuliah");
  eq("text around the table is ignored, not an error", [withTitle.drafts.length, withTitle.issues.length, withTitle.ignored], [3, 0, 3]);
  const twoTables = Siam.parseSiam(F2 + "\n\n" + F1);
  eq("two tables in one paste, each with its own header", [twoTables.drafts.length, twoTables.drafts[3].className, twoTables.drafts[3].lecturer], [7, "A", "Dr. Budi Santoso"]);
  ok("a format change mid-text is reported", twoTables.issues.length === 1);
  eq("<br> in a cell becomes a comma", Siam.parseSiam("| Hari | Jam | Mata Kuliah | Kelas | Dosen | Ruang | Action |\n|-|-|-|-|-|-|-|\n| Senin | 07.00 - 08.40 | PBO | A | Dr. A<br>Dr. B | R1 | |").drafts[0].lecturer, "Dr. A, Dr. B");
  eq("bold and links in a cell are plain text", Siam.parseSiam("| Hari | MK | Jam | Ruang |\n|-|-|-|-|\n| Senin | **[PBO](http://x.y/z)** | 07.00 - 08.40 | R1 |").drafts[0].subjectName, "PBO");
  eq("code split off only when literally present", [Siam.parseSiam("| Hari | MK | Jam | Ruang |\n|-|-|-|-|\n| Senin | TIF1234 - Basis Data | 07.00 - 08.40 | R1 |").drafts[0].subjectCode, Siam.parseSiam("| Hari | MK | Jam | Ruang |\n|-|-|-|-|\n| Senin | Basis Data (TIF1234) | 07.00 - 08.40 | R1 |").drafts[0].subjectName], ["TIF1234", "Basis Data"]);
  eq("no code invented for a plain name", Siam.parseSiam(F2).drafts.every((d) => d.subjectCode === ""), true);
  eq("a name that merely contains digits is not split", Siam.parseSiam("| Hari | MK | Jam | Ruang |\n|-|-|-|-|\n| Senin | Matematika 2 | 07.00 - 08.40 | R1 |").drafts[0].subjectName, "Matematika 2");

  /* ================= bad input ================= */
  const bad = Siam.parseSiam("| Hari | MK | Jam | Ruang |\n|-|-|-|-|\n| Funday | Fisika | 07.00 - 08.40 | R1 |\n| Senin | | 07.00 - 08.40 | R1 |\n| Senin | Fisika | pagi | R1 |\n| Senin | Fisika | 10.00 - 09.00 | R1 |\n| | | | |\n| Senin | Kimia | 07.00 - 08.40 | R1 |");
  eq("bad rows become issues, good rows survive, empty row skipped", [bad.drafts.length, bad.issues.length], [1, 4]);
  eq("issues carry line numbers", bad.issues.map((i) => i.line), [3, 4, 5, 6]);
  const noHeader = Siam.parseSiam("Senin | 07.00 - 08.40 | Fisika | R1");
  eq("no header: nothing read, one clear issue", [noHeader.drafts.length, noHeader.issues.length, noHeader.format], [0, 1, null]);
  const flat = Siam.parseSiam("Hari Jam Mata Kuliah Kelas Dosen Ruang Action\nSenin 07.00 - 08.40 PBO A Dr. A F2.3 Detail");
  ok("header without separators explains why", flat.drafts.length === 0 && /terpisah/.test(flat.issues[0].reason));
  const headerOnly = Siam.parseSiam(F2.split("\n").slice(0, 2).join("\n"));
  eq("header only: nothing read, no crash", [headerOnly.drafts.length, headerOnly.format], [0, 2]);
  const hostile = Siam.parseSiam("| Hari | MK | Jam | Ruang |\n|-|-|-|-|\n| Senin | <script>alert(1)</script> | 07.00 - 08.40 | <img src=x onerror=1> |");
  ok("markup stays inert text (never interpreted)", hostile.drafts.length === 1 && hostile.drafts[0].subjectName.includes("<script>"));
  ok("looksLikeSiam: yes for tables, no for task text", Siam.looksLikeSiam(F1) && Siam.looksLikeSiam(F2) && !Siam.looksLikeSiam("Tugas 1\nTurned in\n"));

  /* ================= guards in runScheduleParser ================= */
  const src = Src.SCHEDULE_SOURCES[0];
  ok("registry: one SIAM source targeting schedules", Src.SCHEDULE_SOURCES.length === 1 && src.key === "siam" && src.target === "schedules");
  ok("task registry untouched (Classroom + BRONE only)", Src.IMPORT_SOURCES.map((s) => s.key).join() === "google_classroom,brone");
  ok("empty text", Src.runScheduleParser(src, "  \n ").issues.length === 1);
  ok("huge text refused", Src.runScheduleParser(src, "x".repeat(Src.MAX_IMPORT_CHARS + 1)).drafts.length === 0);
  ok("parser crash is caught", Src.runScheduleParser({ ...src, parse: () => { throw new Error("boom"); } }, "abc").issues.length === 1);
  ok("non-string input is caught", Src.runScheduleParser(src, undefined as unknown as string).issues.length === 1);
  const many = "| Hari | MK | Jam | Ruang |\n|-|-|-|-|\n" + Array.from({ length: Src.MAX_SCHEDULE_ITEMS + 5 }, (_, i) => `| Senin | MK ${i} | 07.00 - 08.40 | R |`).join("\n");
  const cut = Src.runScheduleParser(src, many);
  eq("too many rows are cut with a note", [cut.drafts.length, cut.issues.length], [Src.MAX_SCHEDULE_ITEMS, 1]);
  ok("Classroom/BRONE parsers still work as before", parseClassroom("Tugas 1\nTurned in\n").drafts.length >= 0 && typeof parseBrone === "function" && Src.detectSource("Assignment is due") === "brone");

  /* ================= subject matching ================= */
  const subjects = [subj("s1", "Pemrograman Web"), subj("s2", "Basis Data", "TIF1234"), subj("s3", "Kalkulus Lanjut")];
  const items = SP.buildScheduleItems(Siam.parseSiam(F1).drafts, subjects);
  eq("exact name match links the subject", items[0].subject, { kind: "existing", subjectId: "s1" });
  eq("no match = new subject (created only on import)", items[3].subject, { kind: "new" });
  eq("similar name must be confirmed by the user", items[2].subject.kind, "unresolved");
  const byCode = SP.buildScheduleItems(Siam.parseSiam("| Hari | MK | Jam | Ruang |\n|-|-|-|-|\n| Senin | TIF1234 - Nama Lain | 07.00 - 08.40 | R |").drafts, subjects);
  eq("code in the cell matches a Subject with that code", byCode[0].subject, { kind: "existing", subjectId: "s2" });
  eq("online room sets mode online with a warning", [items[3].mode, items[3].warnings.some((w) => /online/i.test(w)), items[0].mode], ["online", true, "offline"]);
  eq("matching never writes", mem.size, 0);

  /* ================= validation ================= */
  const base = items[0];
  ok("valid item has no errors", !SP.scheduleHasErrors(SP.validateScheduleItem(base, subjects)));
  ok("unresolved subject blocks", "subject" in SP.validateScheduleItem(items[2], subjects));
  ok("'none' is not allowed for a schedule", "subject" in SP.validateScheduleItem({ ...base, subject: { kind: "none" } }, subjects));
  ok("deleted subject blocks", "subject" in SP.validateScheduleItem({ ...base, subject: { kind: "existing", subjectId: "gone" } }, subjects));
  ok("bad day / bad times block", "day" in SP.validateScheduleItem({ ...base, dayOfWeek: 7 }, subjects) && "startTime" in SP.validateScheduleItem({ ...base, startTime: "25:00" }, subjects) && "endTime" in SP.validateScheduleItem({ ...base, endTime: "07:00" }, subjects));

  /* ================= duplicates ================= */
  const existing: ScheduleItem[] = [
    { id: "e1", createdAt: "x", updatedAt: "x", subjectId: "s1", dayOfWeek: 1, startTime: "07:00", endTime: "08:40", mode: "offline", recurrence: "weekly" },
    { id: "e2", createdAt: "x", updatedAt: "x", subjectId: "s3", dayOfWeek: 5, startTime: "13:00", endTime: "14:40", mode: "offline", recurrence: "none", date: "2026-11-20" },
    { id: "e3", createdAt: "x", updatedAt: "x", subjectId: "s2", dayOfWeek: 2, startTime: "09:50", endTime: "11:30", mode: "offline", recurrence: "biweekly", date: "2026-11-17" },
  ];
  const dups = SP.detectScheduleDuplicates(items, existing, subjects);
  eq("same subject+day+time as an existing weekly item is a duplicate", dups.get(items[0].key)?.kind, "existing");
  ok("a one-off or biweekly item is NOT treated as the same weekly session", !dups.has(items[1].key) && !dups.has(items[2].key));
  const clone = [items[0], { ...items[0], key: "x2", room: "other room" }];
  eq("duplicate inside the batch (room doesn't matter)", SP.detectScheduleDuplicates(clone, [], subjects).get("x2")?.kind, "batch");
  const diffTime = [items[0], { ...items[0], key: "x3", startTime: "09:00", endTime: "10:00" }];
  eq("different time = not a duplicate", SP.detectScheduleDuplicates(diffTime, [], subjects).size, 0);
  const ex = SP.evaluateSchedule(items, existing, subjects);
  eq("a skipped duplicate is not ready", ex[0].ready, false);
  eq("'Tetap impor' makes it ready", SP.evaluateSchedule(items.map((i, n) => (n === 0 ? { ...i, dupAction: "import" as const } : i)), existing, subjects)[0].ready, true);
  eq("excluded item is not ready", SP.evaluateSchedule(items.map((i, n) => (n === 3 ? { ...i, included: false } : i)), existing, subjects)[3].ready, false);
  const sum = SP.summarizeSchedule(ex);
  eq("summary counts", [sum.total, sum.skippedDuplicates, sum.needsFixing, sum.newSubjects], [4, 1, 1, 1]);
  const pendingTwice = SP.buildScheduleItems(Siam.parseSiam("| Hari | MK | Jam | Ruang |\n|-|-|-|-|\n| Senin | Fisika | 07.00 - 08.40 | R |\n| Senin | fisika | 07.00 - 08.40 | R |").drafts, []);
  eq("same new-subject name in different case is one identity", SP.detectScheduleDuplicates(pendingTwice, [], []).size, 1);

  /* ================= commit ================= */
  reset();
  const seedSubjects = [subj("s1", "Pemrograman Web")];
  await storage.write("subjects", seedSubjects);
  const oldSchedule: ScheduleItem = { id: "old", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z", subjectId: "s1", dayOfWeek: 3, startTime: "10:00", endTime: "11:40", mode: "offline", recurrence: "weekly", room: "A1", ...( { mystery: 1 } as object) };
  await storage.write("schedules", [oldSchedule]);
  const beforeSchedules = mem.get(STORAGE_KEYS.schedules);
  const live = await storage.read("subjects");
  const list = SP.buildScheduleItems(Siam.parseSiam(F1).drafts, live).filter((i) => i.subject.kind !== "unresolved");
  const res = await Cm.commitScheduleImport(list, now);
  eq("commit result", res, { schedulesAdded: 4, subjectsAdded: 3 });
  const subs = raw(STORAGE_KEYS.subjects) as Subject[];
  eq("subjects: existing kept, 3 new", [subs.length, subs[0].id], [4, "s1"]);
  const newBasis = subs.find((s) => s.name === "Basis Data")!;
  eq("new subject gets the lecturer the source had", newBasis.lecturer, "Siti Aminah, M.Kom");
  eq("new subject with no lecturer gets none (dash is not data)", subs.find((s) => s.name === "Kalkulus")?.lecturer, undefined);
  eq("existing subject was not modified", subs[0], seedSubjects[0]);
  const sch = raw(STORAGE_KEYS.schedules) as ScheduleItem[];
  eq("old schedule item byte-identical, incl. unknown field", sch[0], JSON.parse(beforeSchedules!)[0]);
  const added = sch.slice(1);
  ok("every imported item is weekly, no date, valid weekday", added.every((s) => s.recurrence === "weekly" && s.date === undefined && s.dayOfWeek >= 0 && s.dayOfWeek <= 6));
  eq("Monday web class stored as dayOfWeek 1 with times and room", added.find((s) => s.subjectId === "s1" && s.dayOfWeek === 1) && { d: added[0].dayOfWeek, s: added[0].startTime, e: added[0].endTime, r: added[0].room, m: added[0].mode }, { d: 1, s: "07:00", e: "08:40", r: "F2.3", m: "offline" });
  eq("online session stored as online", added.find((s) => s.dayOfWeek === 0)?.mode, "online");
  ok("subjects point at real ids", added.every((s) => subs.some((x) => x.id === s.subjectId)));
  ok("new ids are unique", new Set(sch.map((s) => s.id)).size === sch.length);

  // second import of the same text: everything is now a duplicate
  const liveSubs = await storage.read("subjects");
  const liveSch = await storage.read("schedules");
  const again = SP.evaluateSchedule(SP.buildScheduleItems(Siam.parseSiam(F1).drafts, liveSubs).filter((i) => i.subject.kind === "existing"), liveSch, liveSubs);
  ok("re-importing the same table flags every row as a duplicate", again.length >= 3 && again.every((s) => s.dup?.kind === "existing" && !s.ready), again.map((a) => a.dup?.kind));

  // new subject shared by two rows is created once, and reused
  reset();
  const two = SP.buildScheduleItems(Siam.parseSiam("| Hari | Jam | Mata Kuliah | Kelas | Dosen | Ruang | Action |\n|-|-|-|-|-|-|-|\n| Senin | 07.00 - 08.40 | TIF901 - Fisika | A | Dr. F | R1 | |\n| Rabu | 07.00 - 08.40 | Fisika | A | | R1 | |").drafts, []);
  const r3 = await Cm.commitScheduleImport(two, now);
  const s3 = raw(STORAGE_KEYS.subjects) as Subject[];
  eq("one subject for two rows; code and lecturer filled from whichever row had them", [r3, s3.length, s3[0].code, s3[0].lecturer], [{ schedulesAdded: 2, subjectsAdded: 1 }, 1, "TIF901", "Dr. F"]);

  // refusals
  reset();
  const bad2 = SP.buildScheduleItems(Siam.parseSiam(F2).drafts, []).map((i, n) => (n === 0 ? { ...i, startTime: "99:00" } : i));
  await throwsAsync("invalid item: nothing written", () => Cm.commitScheduleImport(bad2, now));
  eq("...and storage is still empty", mem.size, 0);
  const good = SP.buildScheduleItems(Siam.parseSiam(F2).drafts, []);
  blocked = true;
  await throwsAsync("blocked storage is refused up front", () => Cm.commitScheduleImport(good, now));
  blocked = false;
  eq("...and nothing was written", mem.size, 0);
  failKey = STORAGE_KEYS.schedules;
  await throwsAsync("schedules write failing throws", () => Cm.commitScheduleImport(good, now));
  failKey = null;
  ok("...schedules key stays empty (no half-written schedules)", raw(STORAGE_KEYS.schedules) === null || (raw(STORAGE_KEYS.schedules) as unknown[]).length === 0);
  const retry = await Cm.commitScheduleImport(good, now);
  const subsAfterRetry = raw(STORAGE_KEYS.subjects) as Subject[];
  eq("retry succeeds and reuses subjects left by the failed try (no duplicates)", [retry.schedulesAdded, subsAfterRetry.length, new Set(subsAfterRetry.map((s) => s.name)).size], [3, 3, 3]);
  eq("empty list is a no-op", await Cm.commitScheduleImport([], now), { schedulesAdded: 0, subjectsAdded: 0 });

  /* ================= Schedule, Calendar, Dashboard ================= */
  reset();
  await storage.write("subjects", [subj("s1", "Pemrograman Web")]);
  const imp = SP.buildScheduleItems(Siam.parseSiam("| Hari | MK | Jam | Ruang |\n|-|-|-|-|\n| Senin | Pemrograman Web | 07.00 - 08.40 | F2.3 |\n| Minggu | Pemrograman Web | 08.00 - 09.40 | Z |").drafts, await storage.read("subjects"));
  await Cm.commitScheduleImport(imp, now);
  const allSch = await storage.read("schedules");
  const allSub = await storage.read("subjects");
  // 15 Nov 2026 is a Sunday; 16 Nov a Monday; same every week
  for (const [date, day, want] of [["2026-11-15", "Minggu", 1], ["2026-11-16", "Senin", 1], ["2026-11-23", "Senin", 1], ["2026-11-30", "Senin", 1], ["2027-02-01", "Senin", 1], ["2026-11-17", "Selasa", 0]] as const) {
    eq(`Schedule: ${date} (${day}) has ${want}`, Sch.scheduleOnDate(allSch, date).length, want);
  }
  const calEntries = Cal.entriesForDate("2026-11-16", { schedules: allSch, tasks: [], events: [], subjects: allSub });
  eq("Calendar shows the imported class", [calEntries.length, calEntries[0]?.kind, calEntries[0]?.startTime], [1, "class", "07:00"]);
  const dashSun = Dash.todayClasses(allSch, new Date(2026, 10, 15, 8, 30));
  eq("Dashboard 'today' on Sunday 08:30 shows the Sunday class as ongoing", [dashSun.length, dashSun[0]?.status], [1, "ongoing"]);
  eq("Dashboard before the class says upcoming", Dash.todayClasses(allSch, new Date(2026, 10, 15, 7, 0))[0]?.status, "upcoming");
  eq("weekday stored independent of the time zone (date key of 16 Nov is a Monday)", [toDateKey(new Date(2026, 10, 16)), Sch.weekdayOf("2026-11-16")], ["2026-11-16", 1]);

  /* ================= static guards ================= */
  const view = (f: string) => fs.readFileSync(path.join(process.cwd(), f), "utf8");
  const code = (t: string) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  const walk = (dir: string): string[] => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]));
  const importLib = walk(path.join(process.cwd(), "src/lib/import")).map((f) => path.relative(process.cwd(), f).replace(/\\/g, "/"));
  eq("only commit.ts writes", importLib.filter((f) => /storage\.(write|update|remove)|setRaw/.test(view(f))), ["src/lib/import/commit.ts"]);
  ok("siam.ts is pure (no clock, random, storage); schedule-preview.ts imports no storage", !/Date\.now|Math\.random|new Date\(\)|storage/.test(code(view("src/lib/import/siam.ts"))) && !/Date\.now|Math\.random|from "\.\.\/storage"|from "@\/lib\/storage"/.test(code(view("src/lib/import/schedule-preview.ts"))));
  ok("siam.ts never parses dates or builds Date objects (no time zone can shift a time)", !/new Date\(|Date\.parse|Date\.UTC|toISOString/.test(code(view("src/lib/import/siam.ts"))));
  ok("existing task lane files don't mention SIAM", ["classroom", "brone", "preview", "duplicates", "subjects", "text"].every((n) => !/siam/i.test(code(view(`src/lib/import/${n}.ts`)))));
  ok("commitImport (tasks) and its UI still exist", /export async function commitImport/.test(view("src/lib/import/commit.ts")) && /commitImport\(/.test(view("src/components/import/import-view.tsx")));
  ok("schedule UI writes only through commitScheduleImport", !/storage\.(write|update|remove)|getStorageAdapter|setRaw|localStorage/.test(view("src/components/import/schedule-import-view.tsx")) && /commitScheduleImport\(/.test(view("src/components/import/schedule-import-view.tsx")));
  ok("no dangerouslySetInnerHTML in the schedule import UI", ["schedule-import-view", "schedule-import-item-card"].every((n) => !/dangerouslySetInnerHTML|innerHTML/.test(view(`src/components/import/${n}.tsx`))));
  ok("Schedule page links to /import?sumber=siam", /href="\/import\?sumber=siam"/.test(view("src/components/schedule/schedule-view.tsx")) && /useOpenFromQuery\(openCreate\)/.test(view("src/components/schedule/schedule-view.tsx")));
  ok("lib/schedule, calendar, dashboard, tasks, events don't import lib/import", ["schedule", "calendar", "dashboard", "tasks", "events"].every((n) => !/lib\/import|\.\/import\//.test(view(`src/lib/${n}.ts`))));
  ok("ScheduleItem model not changed (no new field)", !/importSource/.test(view("src/types/models.ts").split("export interface ScheduleItem")[1].split("export type EventType")[0]));
  eq("still the same 7 storage keys", Object.values(STORAGE_KEYS).sort(), ["campusbest_events", "campusbest_focus_sessions", "campusbest_notes", "campusbest_schedules", "campusbest_settings", "campusbest_subjects", "campusbest_tasks"]);
  const pkg = JSON.parse(view("package.json"));
  ok("version 0.10.0 or later (0.11.0 after PWA, 0.12.0 after Batch 5)", ["0.10.0", "0.11.0", "0.12.0", "0.12.1", "0.12.2"].includes(pkg.version), pkg.version);
  eq("no dependency added", Object.keys(pkg.dependencies).sort(), ["@radix-ui/react-dialog", "class-variance-authority", "clsx", "framer-motion", "lucide-react", "next", "react", "react-dom", "tailwind-merge"]);
  ok("runner lists batch9", /batch9-logic-check\.ts/.test(view("scripts/run-logic-checks.sh")));

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}
main();
