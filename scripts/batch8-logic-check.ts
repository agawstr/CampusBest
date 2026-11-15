// Run from the project root (needs `npx tsx`, no install needed in the project):
//   TZ=Asia/Jakarta npx tsx scripts/batch8-logic-check.ts
// Try other zones too (DST): TZ=America/New_York, TZ=Europe/London, TZ=Pacific/Auckland
export {}; // makes this file a module so the scripts don't share globals under `tsc`
import * as fs from "node:fs";
import * as path from "node:path";

const mem = new Map<string, string>();
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
const resetWorld = () => { mem.clear(); failWrites = false; failKey = null; blocked = false; };

async function main() {
  const Tx = await import("@/lib/import/text");
  const { parseBrone } = await import("@/lib/import/brone");
  const { parseClassroom } = await import("@/lib/import/classroom");
  const Src = await import("@/lib/import/sources");
  const Sub = await import("@/lib/import/subjects");
  const Dup = await import("@/lib/import/duplicates");
  const P = await import("@/lib/import/preview");
  const Cm = await import("@/lib/import/commit");
  const T = await import("@/lib/tasks");
  const Dash = await import("@/lib/dashboard");
  const Cal = await import("@/lib/calendar");
  const { storage, migrateLegacyKeys } = await import("@/lib/storage");
  const { normalizeTask } = await import("@/lib/normalize");
  const { parseDateKey, isValidTime } = await import("@/lib/date");
  const { STORAGE_KEYS } = await import("@/lib/storage-keys");
  type Task = import("@/types").Task;
  type Subject = import("@/types").Subject;

  const TASKS_KEY = STORAGE_KEYS.tasks;
  const SUBJECTS_KEY = STORAGE_KEYS.subjects;
  const raw = (k: string) => JSON.parse(mem.get(k) ?? "null");
  const now = new Date(2026, 10, 15, 12, 0);
  const subj = (id: string, name: string, code?: string): Subject => ({ id, name, code, color: "#65B8FF", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" });

  /* ================= text helpers ================= */
  eq("splitLines: trims, drops blanks, keeps original line numbers", Tx.splitLines("  a \r\n\r\n b​  c \n").map((l) => [l.n, l.text]), [[1, "a"], [3, "b c"]]);
  eq("splitLines: non-string input is safe", [Tx.splitLines(undefined as any), Tx.splitLines(null as any)], [[], []]);
  eq("nameKey ignores case, accents, punctuation", [Tx.nameKey("  Pemrosesan  Bahasa-Alami! "), Tx.nameKey("Café"), Tx.nameKey("Praktikum 89: Backpropagation Part 1 & Part 2")], ["pemrosesan bahasa alami", "cafe", "praktikum 89 backpropagation part 1 part 2"]);
  eq("safeUrl accepts http(s) only", ["https://a.b/c", "http://a.b", "javascript:alert(1)", "data:text/html,x", "file:///etc/passwd", "ftp://a.b", "https://a b", "", "//a.b", null].map((u) => Tx.safeUrl(u as any)), ["https://a.b/c", "http://a.b", null, null, null, null, null, null, null, null]);
  eq("urlKey: case of host, fragment and trailing slash don't matter; the query does", [Tx.urlKey("https://Classroom.Google.com/c/1/#x") === Tx.urlKey("https://classroom.google.com/c/1"), Tx.urlKey("https://a.b/x?id=1") === Tx.urlKey("https://a.b/x?id=2")], [true, false]);
  eq("readLink: markdown link", Tx.readLink("[Modul 9 - DataStore Room](https://classroom.google.com/c/1/a/2)"), { title: "Modul 9 - DataStore Room", url: "https://classroom.google.com/c/1/a/2", linked: true, warnings: [] });
  eq("readLink: markdown link with brackets in the title", Tx.readLink("[[Part 1] Tugas](https://a.b/x)").title, "[Part 1] Tugas");
  eq("readLink: a javascript: link keeps the text, drops the URL, warns", [Tx.readLink("[Klik](javascript:alert(1))").title, Tx.readLink("[Klik](javascript:alert(1))").url, Tx.readLink("[Klik](javascript:alert(1))").warnings.length], ["Klik", "", 1]);
  eq("readLink: trailing bare URL, without its punctuation", [Tx.readLink("Tugas 1 https://a.b/x.").title, Tx.readLink("Tugas 1 https://a.b/x.").url], ["Tugas 1", "https://a.b/x"]);
  eq("readLink: plain text stays as it is", Tx.readLink("Tugas biasa"), { title: "Tugas biasa", url: "", linked: false, warnings: [] });
  eq("lineUrl: only a line that is just a URL", [Tx.lineUrl("https://a.b/c"), Tx.lineUrl("<https://a.b/c>"), Tx.lineUrl("lihat https://a.b/c"), Tx.lineUrl("javascript:alert(1)")], ["https://a.b/c", "https://a.b/c", null, null]);
  eq("readTime", ["23:59", "00:00", "7:05", "11:59 PM", "12:00 AM", "10:00 » 11:00", "24:00", "12:60", "13:00 PM", "Activity event", "2026"].map((t) => Tx.readTime(t)), [
    { time: "23:59" }, { time: "00:00" }, { time: "07:05" }, { time: "23:59" }, { time: "00:00" }, { time: "10:00" },
    { error: 'Jam "24:00" tidak valid.' }, { error: 'Jam "12:60" tidak valid.' }, { error: 'Jam "13:00 PM" tidak valid.' }, null, null,
  ]);
  eq("readDate: weekday + English month", Tx.readDate("Monday, 16 November 2026"), { date: "2026-11-16", warnings: [] });
  eq("readDate: no weekday, abbreviations, Indonesian", [Tx.readDate("5 Dec 2026"), Tx.readDate("5 Desember 2026"), Tx.readDate("Sabtu, 5 Desember 2026"), Tx.readDate("7 Agu 2026"), Tx.readDate("1 Mei 2026")].map((d) => (d && "date" in d ? d.date : d)), ["2026-12-05", "2026-12-05", "2026-12-05", "2026-08-07", "2026-05-01"]);
  ok("readDate: a wrong weekday only warns", (() => { const d = Tx.readDate("Tuesday, 16 November 2026"); return !!d && "date" in d && d.date === "2026-11-16" && d.warnings.length === 1; })());
  eq("readDate: an impossible date is an error", Tx.readDate("31 November 2026"), { error: 'Tanggal "31 November 2026" tidak ada di kalender.' });
  eq("readDate: leap day", [Tx.readDate("29 February 2028"), Tx.readDate("29 February 2027")].map((d) => (d && "date" in d ? d.date : "error" in (d ?? {}) ? "error" : d)), ["2028-02-29", "error"]);
  eq("readDate: titles that merely contain numbers are not dates", ["Tugas 5 Akhir 2026", "Laporan 5 Mei 2026", "LK07 - Presentasi Proposal Skripsi", "16 November", "Proyek 1: 2026"].map((t) => Tx.readDate(t)), [null, null, null, null, null]);

  /* ================= BRONE: the sample from the spec ================= */
  const BRONE_SAMPLE = [
    "Monday, 16 November 2026", "23:59", "Activity event", "Proyek Iterasi 1: Halaman Cover & AI Disclaimer", "Assignment is due · Komputer Grafis",
    "Tuesday, 17 November 2026", "00:00", "Activity event", "LoRa", "Assignment is due · Jaringan Nirkabel",
    "Wednesday, 18 November 2026", "00:00", "Activity event", "5G testbed deployment", "Assignment is due · Jaringan Nirkabel",
    "Monday, 23 November 2026", "23:59", "Activity event", "Proyek Iterasi 2: Latar Belakang dan Motivasi", "Assignment is due · Komputer Grafis",
    "Wednesday, 25 November 2026", "23:59", "Activity event", "LK07 - Presentasi Proposal Skripsi", "Assignment is due · Metodologi Penelitian dan Penulisan Ilmiah",
    "Monday, 30 November 2026", "23:59", "Activity event", "Proyek Iterasi 3: Sebuah Screenshot Awal", "Assignment is due · Komputer Grafis",
    "Saturday, 5 December 2026", "23:59", "Activity event", "Tugas Akhir", "Assignment is due · Pemrosesan Bahasa Alami",
    "23:59", "Activity event", "Tugas Akhir - Peer Evaluation", "Assignment is due · Pemrosesan Bahasa Alami",
    "Monday, 7 December 2026", "23:59", "Activity event", "Proyek Final", "Assignment is due · Komputer Grafis",
  ].join("\n");
  const b = parseBrone(BRONE_SAMPLE);
  eq("BRONE sample: 9 tasks, nothing unreadable", [b.drafts.length, b.issues.length], [9, 0]);
  eq("BRONE sample: 8 different dates", new Set(b.drafts.map((d) => d.deadline)).size, 8);
  eq("BRONE sample: every task with date, time, subject", b.drafts.map((d) => [d.title, d.deadline, d.deadlineTime, d.subjectName]), [
    ["Proyek Iterasi 1: Halaman Cover & AI Disclaimer", "2026-11-16", "23:59", "Komputer Grafis"],
    ["LoRa", "2026-11-17", "00:00", "Jaringan Nirkabel"],
    ["5G testbed deployment", "2026-11-18", "00:00", "Jaringan Nirkabel"],
    ["Proyek Iterasi 2: Latar Belakang dan Motivasi", "2026-11-23", "23:59", "Komputer Grafis"],
    ["LK07 - Presentasi Proposal Skripsi", "2026-11-25", "23:59", "Metodologi Penelitian dan Penulisan Ilmiah"],
    ["Proyek Iterasi 3: Sebuah Screenshot Awal", "2026-11-30", "23:59", "Komputer Grafis"],
    ["Tugas Akhir", "2026-12-05", "23:59", "Pemrosesan Bahasa Alami"],
    ["Tugas Akhir - Peer Evaluation", "2026-12-05", "23:59", "Pemrosesan Bahasa Alami"],
    ["Proyek Final", "2026-12-07", "23:59", "Komputer Grafis"],
  ]);
  eq("BRONE sample: '00:00' is kept as a real time on the day it is written", b.drafts.filter((d) => d.deadlineTime === "00:00").map((d) => d.deadline), ["2026-11-17", "2026-11-18"]);
  eq("BRONE sample: 'Activity event' lines are counted as ignored and never become a title", [b.ignored, b.drafts.some((d) => /activity/i.test(d.title))], [9, false]);
  eq("BRONE sample: two tasks with the same date and time stay two tasks (date carries over)", b.drafts.filter((d) => d.deadline === "2026-12-05").map((d) => d.title), ["Tugas Akhir", "Tugas Akhir - Peer Evaluation"]);
  ok("BRONE sample: no URL is invented, no source status, no warnings", b.drafts.every((d) => d.url === "" && d.sourceStatus === "" && d.warnings.length === 0));
  eq("BRONE sample: line numbers point at the title line", b.drafts.slice(0, 3).map((d) => d.line), [4, 9, 14]);
  eq("BRONE: Windows line endings, no-break spaces and a different order give the same result", JSON.stringify(parseBrone(BRONE_SAMPLE.replace(/\n/g, "\r\n").replace(/Activity event/g, "Activity event"))), JSON.stringify(b));

  /* BRONE: variations and trouble */
  const B = (lines: string[]) => parseBrone(lines.join("\n"));
  const one = B(["Senin, 16 November 2026", "08:30", "Activity event", "[Laporan 1](https://brone.example/mod/assign/view.php?id=7)", "Assignment is due · Basis Data"]);
  eq("BRONE: Indonesian date, Markdown link keeps its URL", [one.drafts[0]?.title, one.drafts[0]?.url, one.drafts[0]?.deadline], ["Laporan 1", "https://brone.example/mod/assign/view.php?id=7", "2026-11-16"]);
  const urlLine = B(["16 November 2026", "10:00", "Tugas X", "https://brone.example/mod/assign/view.php?id=9", "Assignment is due · Basis Data"]);
  eq("BRONE: a URL line after the title is attached to it", urlLine.drafts[0]?.url, "https://brone.example/mod/assign/view.php?id=9");
  const urlAfter = B(["16 November 2026", "10:00", "Tugas X", "Assignment is due · Basis Data", "https://brone.example/x/1"]);
  eq("BRONE: a URL line right after the task is attached to it", urlAfter.drafts[0]?.url, "https://brone.example/x/1");
  eq("BRONE: no URL in the text -> no URL (never built)", B(["16 November 2026", "10:00", "Tugas X", "Assignment is due · Basis Data"]).drafts[0]?.url, "");
  const badLink = B(["16 November 2026", "10:00", "[Tugas](javascript:alert(1))", "Assignment is due · Basis Data"]);
  eq("BRONE: a non-http link is dropped with a warning", [badLink.drafts[0]?.url, badLink.drafts[0]?.warnings.length], ["", 1]);
  const noTime = B(["16 November 2026", "10:00", "A", "Assignment is due · X", "B", "Assignment is due · X"]);
  eq("BRONE: each task needs its own time; a missing one is NOT filled from the previous task", [noTime.drafts.map((d) => d.deadlineTime), noTime.drafts[1]?.warnings.length], [["10:00", ""], 1]);
  const badDay = B(["31 November 2026", "10:00", "Tugas Z", "Assignment is due · X", "17 November 2026", "09:00", "Tugas Y", "Assignment is due · X"]);
  eq("BRONE: an impossible date is reported, its task isn't guessed, the next date works", [badDay.drafts.map((d) => d.title), badDay.issues.length, badDay.issues[0]?.reason], [["Tugas Y"], 2, 'Tanggal "31 November 2026" tidak ada di kalender.']);
  const noDate = B(["10:00", "Tugas Z", "Assignment is due · X"]);
  eq("BRONE: a task before any date is reported, not invented", [noDate.drafts.length, noDate.issues[0]?.reason], [0, "Belum ada baris tanggal di atas tugas ini."]);
  const wrongWeekday = B(["Tuesday, 16 November 2026", "10:00", "Tugas Q", "Assignment is due · X"]);
  eq("BRONE: a wrong weekday keeps the written date and adds a warning", [wrongWeekday.drafts[0]?.deadline, wrongWeekday.drafts[0]?.warnings.length], ["2026-11-16", 1]);
  const otherKind = B(["16 November 2026", "10:00", "Kuis 3", "Quiz closes · Basis Data", "11:00", "Tugas W", "Assignment is due · Basis Data"]);
  eq("BRONE: another kind of event is reported, and the task after it still reads", [otherKind.drafts.map((d) => [d.title, d.deadlineTime]), otherKind.issues.length, /Quiz closes|bukan/.test(otherKind.issues[0]?.reason ?? "")], [[["Tugas W", "11:00"]], 1, true]);
  const dangling = B(["16 November 2026", "10:00", "Judul tanpa jenis", "Judul lain", "Assignment is due · X"]);
  eq("BRONE: a title without its 'Assignment is due' line is reported; the next one still reads", [dangling.drafts.map((d) => d.title), dangling.issues.map((i) => i.text)], [["Judul lain"], ["Judul tanpa jenis"]]);
  eq("BRONE: a stray 'Assignment is due' line is reported", B(["16 November 2026", "10:00", "Assignment is due · X"]).issues.length, 1);
  eq("BRONE: no course name -> task kept with a warning", [B(["16 November 2026", "10:00", "T", "Assignment is due"]).drafts[0]?.subjectName, B(["16 November 2026", "10:00", "T", "Assignment is due"]).drafts[0]?.warnings.length], ["", 1]);
  eq("BRONE: 12-hour time", B(["16 November 2026", "11:59 PM", "T", "Assignment is due · X"]).drafts[0]?.deadlineTime, "23:59");
  eq("BRONE: a bad time is reported and the task is imported without time", [B(["16 November 2026", "25:00", "T", "Assignment is due · X"]).drafts[0]?.deadlineTime, B(["16 November 2026", "25:00", "T", "Assignment is due · X"]).issues.length], ["", 1]);
  eq("BRONE: titles that contain ' · ' or dashes are not cut", B(["16 November 2026", "10:00", "Modul 3 · Part A - B", "Assignment is due · Basis Data"]).drafts[0]?.title, "Modul 3 · Part A - B");
  eq("BRONE: the date carries to later tasks until a new date", B(["16 November 2026", "10:00", "A", "Assignment is due · X", "11:00", "B", "Assignment is due · X", "17 November 2026", "12:00", "C", "Assignment is due · X"]).drafts.map((d) => d.deadline), ["2026-11-16", "2026-11-16", "2026-11-17"]);

  /* ================= Google Classroom ================= */
  const CLASSROOM_TITLES = [
    "Modul Praktikum 10: Extreme Learning Machine", "Praktikum 89: Backpropagation Part 1 & Part 2", "Modul Praktikum 45: Adaline Madaline",
    "Modul Praktikum 7: Learning Vector Quantization", "Modul Praktikum 6: Self-Organizing Maps", "Modul Praktikum 23: Hebb Net + Perceptron",
    "Modul Praktikum 1: Konsep JST", "Modul 9 - DataStore Room",
  ];
  const linked = CLASSROOM_TITLES.map((t, i) => [`${i + 1}. [${t}](https://classroom.google.com/c/ABC/a/${i + 1}/details)`, i < 7 ? "Jaringan Syaraf Tiruan" : "Pemrograman Mobile", i % 2 === 0 ? "Turned in" : "Assigned"].join("\n")).join("\n");
  const c1 = parseClassroom(linked);
  eq("Classroom: numbered Markdown links -> all 8 titles, none unreadable", [c1.drafts.map((d) => d.title), c1.issues.length], [CLASSROOM_TITLES, 0]);
  eq("Classroom: URLs are kept as written", c1.drafts.map((d) => d.url), CLASSROOM_TITLES.map((_, i) => `https://classroom.google.com/c/ABC/a/${i + 1}/details`));
  eq("Classroom: subject and source status come from the following lines", [c1.drafts[0]?.subjectName, c1.drafts[0]?.sourceStatus, c1.drafts[1]?.sourceStatus, c1.drafts[7]?.subjectName], ["Jaringan Syaraf Tiruan", "Turned in", "Assigned", "Pemrograman Mobile"]);
  ok("Classroom: no deadline is ever made up", c1.drafts.every((d) => d.deadline === "" && d.deadlineTime === ""));
  ok("Classroom: 'Turned in' stays information (the draft has no task status at all)", c1.drafts.every((d) => !("status" in d)));
  const c2 = parseClassroom("1\nModul Praktikum 10: Extreme Learning Machine\nhttps://classroom.google.com/c/A/a/1\nJST\nTurned in\n2\nModul 9 - DataStore Room\nMobile");
  eq("Classroom: number on its own line, URL on its own line, status optional", c2.drafts.map((d) => [d.title, d.url, d.subjectName, d.sourceStatus]), [["Modul Praktikum 10: Extreme Learning Machine", "https://classroom.google.com/c/A/a/1", "JST", "Turned in"], ["Modul 9 - DataStore Room", "", "Mobile", ""]]);
  const c3 = parseClassroom(`${CLASSROOM_TITLES.slice(0, 3).map((t) => `${t}\nJaringan Syaraf Tiruan\nTurned in`).join("\n")}`);
  eq("Classroom: no numbers and no links anywhere (title / subject / status lines)", c3.drafts.map((d) => [d.title, d.subjectName, d.sourceStatus]), CLASSROOM_TITLES.slice(0, 3).map((t) => [t, "Jaringan Syaraf Tiruan", "Turned in"]));
  eq("Classroom: titles without status lines in the plain layout", parseClassroom("A\nX\nB\nY").drafts.map((d) => [d.title, d.subjectName]), [["A", "X"], ["B", "Y"]]);
  eq("Classroom: a '&' and '+' in the title survive", [c1.drafts[1]?.title, c1.drafts[5]?.title], ["Praktikum 89: Backpropagation Part 1 & Part 2", "Modul Praktikum 23: Hebb Net + Perceptron"]);
  const c4 = parseClassroom("1. [Tugas](javascript:alert(1))\nX");
  eq("Classroom: a javascript: link is dropped (no URL), the title stays", [c4.drafts[0]?.title, c4.drafts[0]?.url, c4.drafts[0]?.warnings.length], ["Tugas", "", 1]);
  eq("Classroom: a missing subject gives a warning, not a guess", [parseClassroom("1. Tugas A").drafts[0]?.subjectName, parseClassroom("1. Tugas A").drafts[0]?.warnings.length], ["", 1]);
  const c5 = parseClassroom("Classwork\n1. Tugas A\nBasis Data\nDue tomorrow\nTurned in\nhttps://x.y/1\nhttps://x.y/2");
  eq("Classroom: stray lines are reported, not mixed into the task", [c5.drafts.map((d) => [d.title, d.subjectName, d.sourceStatus]), c5.issues.map((i) => i.text)], [[["Tugas A", "Basis Data", "Turned in"]], ["Classwork", "Due tomorrow", "https://x.y/1", "https://x.y/2"]]);
  eq("Classroom: a status with nothing above it is reported", parseClassroom("Turned in").issues.length, 1);
  eq("Classroom: bullet + link, tab-separated number", [parseClassroom("- [T](https://a.b/1)\nX").drafts[0]?.title, parseClassroom("3\tTugas Tab\nX").drafts[0]?.title], ["T", "Tugas Tab"]);
  eq("Classroom: Indonesian statuses are recognized", parseClassroom("1. T\nX\nDiserahkan").drafts[0]?.sourceStatus, "Diserahkan");
  eq("Classroom: a title that starts with a number but no delimiter is still plain text", parseClassroom("2026 Report\nX").drafts.map((d) => [d.title, d.subjectName]), [["2026 Report", "X"]]);

  /* ================= guards in runParser, registry ================= */
  const classroomDef = Src.getImportSource("google_classroom"), broneDef = Src.getImportSource("brone");
  eq("registry: exactly the two sources of Bulk Import 1, both feeding Tasks", Src.IMPORT_SOURCES.map((s) => [s.key, s.target]), [["google_classroom", "tasks"], ["brone", "tasks"]]);
  eq("registry: unknown key throws", (() => { try { Src.getImportSource("siam" as any); return "no"; } catch { return "throws"; } })(), "throws");
  eq("runParser: empty / whitespace / non-string text gives one reason, no drafts", [Src.runParser(broneDef, "").drafts.length, Src.runParser(broneDef, "  \n ").issues.length, Src.runParser(broneDef, undefined as any).issues.length], [0, 1, 1]);
  eq("runParser: text over the size limit is refused", [Src.runParser(broneDef, "x".repeat(Src.MAX_IMPORT_CHARS + 1)).drafts.length, /terlalu panjang/.test(Src.runParser(broneDef, "x".repeat(Src.MAX_IMPORT_CHARS + 1)).issues[0]?.reason ?? "")], [0, true]);
  eq("runParser: nothing readable -> a hint about the wrong source", [Src.runParser(broneDef, "​").issues.length, Src.runParser(classroomDef, "!!!").issues.length >= 0], [1, true]);
  const many = Array.from({ length: Src.MAX_IMPORT_ITEMS + 20 }, (_, i) => `${i + 1}. Tugas ${i}\nX`).join("\n");
  const capped = Src.runParser(classroomDef, many);
  eq("runParser: more than the item cap is cut with a note", [capped.drafts.length, capped.issues.some((i) => /Terlalu banyak/.test(i.reason))], [Src.MAX_IMPORT_ITEMS, true]);
  eq("runParser: a throwing parser can't crash the page", Src.runParser({ ...broneDef, parse: () => { throw new Error("boom"); } }, "x").issues.length, 1);
  eq("detectSource hints", [Src.detectSource("Assignment is due · X"), Src.detectSource("1. T\nTurned in"), Src.detectSource("halo")], ["brone", "google_classroom", null]);

  /* fuzz: whatever is pasted, the parsers don't throw and every draft is sane */
  let seed = 12345;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
  const frags = ["Monday, 16 November 2026", "31 February 2026", "23:59", "00:00", "25:61", "Activity event", "Assignment is due · Basis Data", "Assignment is due", "1.", "2) [T](https://a.b/x)", "[x](javascript:1)", "https://a.b/c", "Turned in", "Judul acak", "»", "", "  ", "\t", "Quiz closes · X", "[", "](", "((("];
  let fuzzOk = true, fuzzThrew = false, fuzzDrafts = 0;
  for (let i = 0; i < 400; i++) {
    const txt = Array.from({ length: 1 + Math.floor(rnd() * 14) }, () => frags[Math.floor(rnd() * frags.length)]).join(rnd() < 0.2 ? "\r\n" : "\n");
    for (const def of Src.IMPORT_SOURCES) {
      try {
        const r = def.parse(txt);
        fuzzDrafts += r.drafts.length;
        for (const d of r.drafts) {
          const sane = d.title.trim() !== "" && (d.deadline === "" || parseDateKey(d.deadline) !== null) && (d.deadlineTime === "" || isValidTime(d.deadlineTime)) && (d.url === "" || Tx.safeUrl(d.url) !== null) && (d.deadlineTime === "" || d.deadline !== "" || def.key === "google_classroom");
          if (!sane) { fuzzOk = false; console.log("insane draft", def.key, JSON.stringify(d), JSON.stringify(txt)); }
        }
      } catch (e) { fuzzThrew = true; console.log("threw", def.key, JSON.stringify(txt), e); }
    }
  }
  ok("fuzz: 400 random pastes x 2 parsers never throw", !fuzzThrew);
  ok("fuzz: every draft has a title, a real date/time and a safe URL", fuzzOk && fuzzDrafts > 0, fuzzDrafts);

  /* ================= subject matching ================= */
  const S1 = subj("s1", "Komputer Grafis", "IF3100"), S2 = subj("s2", "Jaringan Nirkabel"), S3 = subj("s3", "Pemrosesan Bahasa Alami");
  const list = [S1, S2, S3];
  const kind = (n: string, l = list) => Sub.matchSubject(n, l).kind;
  eq("subject match: exact ignoring case, spaces and punctuation", [kind("komputer  grafis"), kind("KOMPUTER-GRAFIS"), kind("Komputer Grafis ")], ["exact", "exact", "exact"]);
  eq("subject match: by code and by 'code name'", [kind("IF3100"), kind("IF3100 - Komputer Grafis"), kind("Komputer Grafis (IF3100)")], ["exact", "exact", "exact"]);
  eq("subject match: nothing close", [kind("Metodologi Penelitian dan Penulisan Ilmiah"), kind(""), kind("   ")], ["none", "none", "none"]);
  eq("subject match: close but not the same is only 'similar' (never applied by itself)", [kind("Komputer Grafis Lanjut"), kind("Jaringan Nirkabel dan Seluler"), kind("Pemrosesan Bahasa")], ["similar", "similar", "similar"]);
  eq("subject match: short unrelated names don't count as similar", kind("IF", [subj("x", "Informatika Fisika")]), "none");
  eq("subject match: two subjects with the same name -> ambiguous", kind("Basis Data", [subj("a", "Basis Data"), subj("b", "basis data")]), "ambiguous");
  eq("subject match: returns the matching subject", (Sub.matchSubject("jaringan nirkabel", list) as any).subject.id, "s2");

  /* ================= duplicates ================= */
  const cand = (o: Partial<import("@/lib/import/duplicates").DupCandidate> = {}) => ({ title: "Tugas 1", url: "", deadline: "2026-11-20", deadlineTime: "23:59", subject: "id:s1", ...o });
  ok("same title + subject + date + time", Dup.isSameTask(cand(), cand()));
  ok("title compare ignores case and punctuation", Dup.isSameTask(cand({ title: "tugas 1!" }), cand()));
  ok("different title", !Dup.isSameTask(cand({ title: "Tugas 2" }), cand()));
  ok("different subject", !Dup.isSameTask(cand({ subject: "id:s2" }), cand()));
  ok("different date", !Dup.isSameTask(cand({ deadline: "2026-11-21" }), cand()));
  ok("same date, different time", !Dup.isSameTask(cand({ deadlineTime: "00:00" }), cand()));
  ok("same date, one side has no time: not a contradiction", Dup.isSameTask(cand({ deadlineTime: "" }), cand()));
  ok("one side has no deadline: not a contradiction (Classroom vs BRONE)", Dup.isSameTask(cand({ deadline: "", deadlineTime: "" }), cand()));
  ok("same URL is the same task, even if the title was edited", Dup.isSameTask(cand({ url: "https://a.b/x/", title: "Lain" }), cand({ url: "https://A.b/x#top" })));
  ok("different URLs are different tasks even with the same title", !Dup.isSameTask(cand({ url: "https://a.b/1" }), cand({ url: "https://a.b/2" })));
  ok("an empty title never matches", !Dup.isSameTask(cand({ title: "" }), cand({ title: "" })));
  ok("a 00:00 time is a time, not 'empty': 00:00 vs 23:59 differ", !Dup.isSameTask(cand({ deadlineTime: "00:00" }), cand({ deadlineTime: "23:59" })));

  /* ================= preview: items, validation, summary ================= */
  const subs = [S1, S2];
  const items = P.buildItems(b.drafts, subs);
  eq("buildItems: exact matches are linked, unmatched are 'new', nothing is created", [items.filter((i) => i.subject.kind === "existing").length, items.filter((i) => i.subject.kind === "new").length, items.filter((i) => i.subject.kind === "unresolved").length], [6, 3, 0]);
  eq("buildItems: the Komputer Grafis items link to s1", items.filter((i) => i.sourceSubject === "Komputer Grafis").map((i) => (i.subject as any).subjectId), ["s1", "s1", "s1", "s1"]);
  ok("buildItems: everything starts included, status todo, skip duplicates", items.every((i) => i.included && i.status === "todo" && i.dupAction === "skip"));
  const withStatus = P.buildItems(c1.drafts, []);
  ok("buildItems: 'Turned in' does NOT make the task done (status stays todo, source status shown separately)", withStatus.every((i) => i.status === "todo") && withStatus[0].sourceStatus === "Turned in");
  eq("buildItems: a similar subject is unresolved with a hint; no subject name -> none", [P.buildItems([{ ...b.drafts[0], subjectName: "Komputer Grafis Lanjut" }], subs)[0].subject, P.buildItems([{ ...b.drafts[0], subjectName: "" }], subs)[0].subject], [{ kind: "unresolved", hint: 'Mirip dengan "Komputer Grafis"' }, { kind: "none" }]);
  const it0 = items[0];
  eq("validate: a clean item has no errors", P.validateItem(it0, subs), {});
  eq("validate: title, date, time, url, subject", [
    P.validateItem({ ...it0, title: "  " }, subs).title, P.validateItem({ ...it0, deadline: "2026-02-30" }, subs).deadline,
    P.validateItem({ ...it0, deadlineTime: "24:00" }, subs).deadlineTime, P.validateItem({ ...it0, deadline: "", deadlineTime: "10:00" }, subs).deadlineTime,
    P.validateItem({ ...it0, url: "javascript:alert(1)" }, subs).url, P.validateItem({ ...it0, subject: { kind: "unresolved" } }, subs).subject,
    P.validateItem({ ...it0, subject: { kind: "existing", subjectId: "gone" } }, subs).subject, P.validateItem({ ...it0, subject: { kind: "new" }, sourceSubject: "" }, subs).subject,
  ].map((m) => typeof m), ["string", "string", "string", "string", "string", "string", "string", "string"]);
  eq("validate: no deadline, 00:00 and an http URL are all fine", [P.validateItem({ ...it0, deadline: "", deadlineTime: "" }, subs), P.validateItem({ ...it0, deadlineTime: "00:00" }, subs), P.validateItem({ ...it0, url: "http://a.b" }, subs)], [{}, {}, {}]);
  const existingTasks: Task[] = [normalizeTask({ id: "t-old", title: "LoRa", subjectId: "s2", deadline: "2026-11-17", deadlineTime: "00:00", createdAt: "x", updatedAt: "x" })];
  const st = P.evaluate(items, existingTasks, subs);
  eq("evaluate: the task already in Tasks is flagged as a duplicate and skipped by default", [st[1].dup?.kind, st[1].ready, st.filter((s) => s.ready).length], ["existing", false, 8]);
  const st2 = P.evaluate(items.map((i) => (i.key === "item-1" ? { ...i, dupAction: "import" as const } : i)), existingTasks, subs);
  eq("evaluate: 'Tetap impor' makes the duplicate importable", [st2[1].ready, st2.filter((s) => s.ready).length], [true, 9]);
  const st3 = P.evaluate(items.map((i, n) => (n === 0 ? { ...i, included: false } : i)), existingTasks, subs);
  eq("evaluate: an unchecked item isn't ready", [st3[0].ready, st3.filter((s) => s.ready).length], [false, 7]);
  const dupBatch = P.evaluate(P.buildItems([b.drafts[0], b.drafts[0], { ...b.drafts[0], title: "Lain" }], subs), [], subs);
  eq("evaluate: a twin inside the same paste is flagged against the first one", [dupBatch.map((s) => s.dup?.kind ?? null), dupBatch.map((s) => s.ready)], [[null, "batch", null], [true, false, true]]);
  const dupAfterRemoval = P.evaluate(P.buildItems([b.drafts[0], b.drafts[0]], subs).map((i, n) => (n === 0 ? { ...i, included: false } : i)), [], subs);
  eq("evaluate: if the first twin is unchecked, the second isn't a duplicate of it", [dupAfterRemoval[1].dup, dupAfterRemoval[1].ready], [undefined, true]);
  const classroomVsBrone = P.evaluate(P.buildItems([{ ...b.drafts[1], deadline: "", deadlineTime: "", sourceStatus: "Assigned" }], subs), existingTasks, subs);
  eq("evaluate: a Classroom task (no deadline) matches the same task already imported from BRONE", classroomVsBrone[0].dup?.kind, "existing");
  const sameTitleOtherSubject = P.evaluate(P.buildItems([{ ...b.drafts[1], subjectName: "Komputer Grafis" }], subs), existingTasks, subs);
  eq("evaluate: same title in another subject is not a duplicate", sameTitleOtherSubject[0].dup, undefined);
  const unresolved = P.evaluate(P.buildItems([{ ...b.drafts[0], subjectName: "Komputer Grafis Lanjut" }], subs), [], subs);
  eq("evaluate: an unresolved subject blocks the item until chosen", [unresolved[0].ready, Object.keys(unresolved[0].errors)], [false, ["subject"]]);
  const sm = P.summarize(st);
  eq("summarize", sm, { total: 9, ready: 8, skippedDuplicates: 1, excluded: 0, needsFixing: 0, newSubjects: 2 });
  eq("choice <-> select value round trip", ["", "__new", "__none", "s1"].map((v) => P.choiceToValue(P.choiceFromValue(v))), ["", "__new", "__none", "s1"]);
  const groups = P.groupSubjects(items);
  eq("groupSubjects: one row per source subject, with counts", groups.map((g) => [g.name, g.count, g.value]), [["Komputer Grafis", 4, "s1"], ["Jaringan Nirkabel", 2, "s2"], ["Metodologi Penelitian dan Penulisan Ilmiah", 1, "__new"], ["Pemrosesan Bahasa Alami", 2, "__new"]]);
  eq("groupSubjects: mixed choices show as mixed", P.groupSubjects([{ ...items[0] }, { ...items[3], subject: { kind: "none" } }]).find((g) => g.name === "Komputer Grafis")?.value, "__mixed");

  /* itemToTask */
  const t0 = P.itemToTask({ ...items[1], url: "https://brone.example/x" }, "s2", "brone", now);
  eq("itemToTask: date and time are copied as text (no time zone shift), 00:00 kept", [t0.deadline, t0.deadlineTime, t0.title, t0.subjectId], ["2026-11-17", "00:00", "LoRa", "s2"]);
  eq("itemToTask: status todo, priority medium, importSource, url, timestamps", [t0.status, t0.priority, t0.importSource, t0.url, t0.createdAt, t0.completedAt], ["todo", "medium", "brone", "https://brone.example/x", now.toISOString(), undefined]);
  const t1 = P.itemToTask({ ...items[1], status: "completed" }, undefined, "google_classroom", now);
  eq("itemToTask: a chosen 'Selesai' sets completedAt like the Tasks form does; no subject -> none", [t1.status, t1.completedAt, t1.subjectId], ["completed", now.toISOString(), undefined]);
  ok("itemToTask: an unsafe URL never reaches the record", P.itemToTask({ ...items[1], url: "javascript:alert(1)" }, "s2", "brone", now).url === undefined);
  ok("itemToTask: no deadline -> no time either", (() => { const t = P.itemToTask({ ...items[1], deadline: "", deadlineTime: "10:00" }, "s2", "brone", now); return t.deadline === undefined && t.deadlineTime === undefined; })());
  ok("itemToTask: the task is a valid Task for the rest of the app", T.validateTaskForm(T.taskToFormValues(t0, new Set(["s2"]))) && Object.keys(T.validateTaskForm(T.taskToFormValues(t0, new Set(["s2"])))).length === 0);

  /* ================= commit through the real storage layer ================= */
  const readyItems = (its: import("@/lib/import/preview").ImportItem[], tasks: Task[], ss: Subject[]) => P.evaluate(its, tasks, ss).filter((s) => s.ready).map((s) => s.item);

  resetWorld();
  const base: Subject[] = [S1, S2];
  mem.set(SUBJECTS_KEY, JSON.stringify(base));
  const legacyTask = { id: "t-old", title: "Tugas lama", status: "archived", priority: "urgent", deadline: "2026-11-30", futureField: { keep: [1, 2] }, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-02T00:00:00.000Z" };
  mem.set(TASKS_KEY, JSON.stringify([legacyTask, "stray", 42]));
  const tasksBefore = await storage.read("tasks");
  const subjectsBefore = await storage.read("subjects");
  const final = readyItems(P.buildItems(b.drafts, subjectsBefore), tasksBefore, subjectsBefore);
  const res = await Cm.commitImport(final, "brone", now);
  eq("commit: 9 tasks and 2 new subjects (Metodologi..., Pemrosesan...), not one per task", [res.tasksAdded, res.subjectsAdded], [9, 2]);
  const subsAfter = raw(SUBJECTS_KEY) as any[];
  eq("commit: subjects = the old two untouched + 2 new ones, each name once", [subsAfter.length, subsAfter.slice(0, 2), new Set(subsAfter.map((s) => Tx.nameKey(s.name))).size], [4, base, 4]);
  ok("commit: new subjects have a name, a palette color and ids", subsAfter.slice(2).every((s) => typeof s.id === "string" && s.id.length > 8 && /^#[0-9A-F]{6}$/i.test(s.color)) && subsAfter.slice(2).map((s) => s.name).join("|") === "Metodologi Penelitian dan Penulisan Ilmiah|Pemrosesan Bahasa Alami");
  const tasksAfter = raw(TASKS_KEY) as any[];
  eq("commit: the old task, the unknown fields and the stray entries are byte-for-byte as before", [JSON.stringify(tasksAfter[0]), tasksAfter.slice(-2)].length === 2 && tasksAfter.filter((x) => typeof x === "object" && x?.id === "t-old").map((x) => JSON.stringify(x)), [JSON.stringify(legacyTask)]);
  ok("commit: stray non-object entries are still there", tasksAfter.includes("stray") && tasksAfter.includes(42));
  const imported = tasksAfter.filter((x) => x && x.importSource === "brone");
  eq("commit: 9 imported tasks, in order, right subject ids", [imported.length, imported.map((x) => x.title).slice(0, 3), imported[0].subjectId, imported[1].subjectId, imported[4].subjectId === subsAfter[2].id, imported[6].subjectId === subsAfter[3].id && imported[7].subjectId === subsAfter[3].id], [9, ["Proyek Iterasi 1: Halaman Cover & AI Disclaimer", "LoRa", "5G testbed deployment"], "s1", "s2", true, true]);
  eq("commit: deadlines stored as written", imported.map((x) => `${x.deadline} ${x.deadlineTime}`), b.drafts.map((d) => `${d.deadline} ${d.deadlineTime}`));
  eq("commit: the unknown status/priority of the old task survived (restore still works)", [(await storage.read("tasks")).find((t) => t.id === "t-old")?.status, JSON.stringify(raw(TASKS_KEY).find((x: any) => x?.id === "t-old"))], ["todo", JSON.stringify({ ...legacyTask })]);

  // integration: Tasks, Calendar, Dashboard
  const after = { tasks: await storage.read("tasks"), subjects: await storage.read("subjects"), schedules: await storage.read("schedules"), events: await storage.read("events") };
  const tsorted = T.sortTasks(after.tasks.filter((t) => t.importSource === "brone"), "deadline");
  eq("integration/Tasks: imported tasks sort and filter like any other", [tsorted[0].title, T.filterTasks(after.tasks, new Map(after.subjects.map((s) => [s.id, s])), { query: "lora", status: "all", priority: "all" }).length], ["Proyek Iterasi 1: Halaman Cover & AI Disclaimer", 1]);
  eq("integration/Calendar: the tasks show on their dates, 00:00 on its own date", [Cal.entriesForDate("2026-11-16", after).filter((e) => e.kind === "task").map((e) => e.title), Cal.entriesForDate("2026-11-17", after).filter((e) => e.kind === "task").map((e) => e.title), Cal.entriesForDate("2026-12-05", after).filter((e) => e.kind === "task").length], [["Proyek Iterasi 1: Halaman Cover & AI Disclaimer"], ["LoRa"], 2]);
  const dash = Dash.buildDashboard(after, now);
  eq("integration/Dashboard: counts include the import (9 new + 1 old), 4 subjects", [dash.stats.totalTasks, dash.stats.openTasks, dash.stats.subjects], [10, 10, 4]);
  eq("integration/Dashboard: the nearest open tasks are the imported ones, in deadline order", dash.tasks.items.slice(0, 2).map((t) => t.title), ["Proyek Iterasi 1: Halaman Cover & AI Disclaimer", "LoRa"]);

  // manual tasks still work, and editing an imported task keeps its link
  const manual = T.createTask({ ...T.EMPTY_TASK_FORM, title: "Manual", deadline: "2026-11-16", deadlineTime: "10:00" }, now);
  await storage.update("tasks", (l) => [...l, manual]);
  eq("manual task creation is unaffected (no url/importSource keys)", [raw(TASKS_KEY).find((x: any) => x?.id === manual.id)?.importSource, raw(TASKS_KEY).find((x: any) => x?.id === manual.id)?.url], [undefined, undefined]);
  const impId = imported[1].id;
  await storage.update("tasks", (l) => l.map((t) => (t.id === impId ? T.applyTaskEdit(t, { ...T.taskToFormValues(t, new Set(["s2"])), title: "LoRa (revisi)" }, now) : t)));
  const edited = raw(TASKS_KEY).find((x: any) => x?.id === impId);
  eq("editing an imported task through the Tasks form keeps importSource and url", [edited.title, edited.importSource], ["LoRa (revisi)", "brone"]);
  await storage.update("tasks", (l) => l.map((t) => (t.id === impId ? T.toggleTaskDone(t, now) : t)));
  eq("ticking an imported task keeps importSource", raw(TASKS_KEY).find((x: any) => x?.id === impId).importSource, "brone");

  // importing the same text again: everything is a duplicate and skipped
  const again = P.evaluate(P.buildItems(b.drafts, after.subjects), (await storage.read("tasks")), after.subjects);
  eq("second import of the same text: no new subjects needed, the tasks are flagged as duplicates", [again.filter((s) => s.dup).length >= 8, again.filter((s) => s.item.subject.kind === "new").length], [true, 0]);
  eq("...so a re-import adds no subject copies", again.map((s) => s.item.subject.kind), Array(9).fill("existing"));

  // classroom import with URL, then a second paste
  resetWorld();
  mem.set(SUBJECTS_KEY, JSON.stringify([subj("jst", "Jaringan Syaraf Tiruan")]));
  const cItems = P.buildItems(c1.drafts, await storage.read("subjects"));
  const cRes = await Cm.commitImport(readyItems(cItems, [], await storage.read("subjects")), "google_classroom", now);
  const cTasks = (raw(TASKS_KEY) as any[]);
  eq("Classroom commit: 8 tasks, 1 new subject, URLs and source kept, no deadline, all 'todo'", [cRes.tasksAdded, cRes.subjectsAdded, cTasks.every((x) => x.status === "todo" && x.importSource === "google_classroom" && x.deadline === undefined && /^https:\/\/classroom\.google\.com\//.test(x.url))], [8, 1, true]);
  const cAgain = P.evaluate(P.buildItems(c1.drafts, await storage.read("subjects")), await storage.read("tasks"), await storage.read("subjects"));
  eq("Classroom paste twice: every task is a duplicate (same URLs), all skipped", [cAgain.every((s) => s.dup?.kind === "existing"), cAgain.filter((s) => s.ready).length], [true, 0]);
  const afterBrone = P.evaluate(P.buildItems([{ ...c1.drafts[0], url: "" }], await storage.read("subjects")), await storage.read("tasks"), await storage.read("subjects"));
  eq("same Classroom task without its URL is still recognized by title + subject", afterBrone[0].dup?.kind, "existing");

  // names that differ only by case/spacing create one subject
  resetWorld();
  const caseItems = P.buildItems([
    { ...b.drafts[0], subjectName: "Mata Kuliah Baru", title: "A" }, { ...b.drafts[0], subjectName: "mata  kuliah baru", title: "B" },
  ], []);
  const caseRes = await Cm.commitImport(readyItems(caseItems, [], []), "brone", now);
  eq("two spellings of one new subject -> one subject, both tasks linked to it", [caseRes.subjectsAdded, (raw(SUBJECTS_KEY) as any[]).length, new Set((raw(TASKS_KEY) as any[]).map((x) => x.subjectId)).size], [1, 1, 1]);
  // a subject with that name appeared meanwhile: reused, not duplicated
  resetWorld();
  const lateItems = P.buildItems([{ ...b.drafts[0], subjectName: "Baru Muncul" }], []);
  await storage.update("subjects", (l) => [...l, subj("late", "baru muncul")]);
  const lateRes = await Cm.commitImport(readyItems(lateItems, [], []), "brone", now);
  eq("a subject created in the meantime is reused (no duplicate)", [lateRes.subjectsAdded, (raw(SUBJECTS_KEY) as any[]).length, (raw(TASKS_KEY) as any[])[0].subjectId], [0, 1, "late"]);

  // failures
  resetWorld();
  const okItems = readyItems(P.buildItems(b.drafts.slice(0, 2), []), [], []);
  eq("commit with nothing: no error, nothing added", await Cm.commitImport([], "brone"), { tasksAdded: 0, subjectsAdded: 0 });
  eq("commit with nothing wrote nothing", [...mem.keys()].filter((k) => k !== "campusbest_migration_v1"), []);
  blocked = true;
  await throwsAsync("blocked storage: commit throws ImportStorageError", () => Cm.commitImport(okItems, "brone"), "ImportStorageError");
  blocked = false;
  eq("blocked storage wrote nothing", [...mem.keys()], []);
  await throwsAsync("invalid items: commit refuses and writes nothing", () => Cm.commitImport([{ ...okItems[0], title: "" }], "brone"), undefined);
  eq("invalid items wrote nothing", [...mem.keys()].filter((k) => k !== "campusbest_migration_v1"), []);
  failWrites = true;
  await throwsAsync("full storage: commit throws", () => Cm.commitImport(okItems, "brone"), "QuotaExceededError");
  failWrites = false;
  eq("full storage: no half-written tasks", mem.has(TASKS_KEY), false);
  const retried = await Cm.commitImport(okItems, "brone", now);
  eq("retry after the failure works and adds each task once", [retried.tasksAdded, (raw(TASKS_KEY) as any[]).length], [2, 2]);
  resetWorld();
  failKey = TASKS_KEY;
  await throwsAsync("tasks write fails after subjects were written: throws", () => Cm.commitImport(okItems, "brone", now));
  failKey = null;
  const leftoverSubjects = (raw(SUBJECTS_KEY) as any[] | null)?.length ?? 0;
  const retry2 = await Cm.commitImport(okItems, "brone", now);
  eq("...subjects are never duplicated by the retry; tasks land once", [leftoverSubjects, (raw(SUBJECTS_KEY) as any[]).length, retry2.subjectsAdded, (raw(TASKS_KEY) as any[]).length], [2, 2, 0, 2]);
  resetWorld();
  await Promise.all([Cm.commitImport(okItems, "brone", now), Cm.commitImport(okItems, "brone", now)]);
  eq("two commits at once don't lose or corrupt data (queue): subjects once each, 4 tasks (the UI blocks the double click)", [(raw(SUBJECTS_KEY) as any[]).length, (raw(TASKS_KEY) as any[]).length], [2, 4]);

  /* ================= data from earlier builds ================= */
  eq("normalizeTask: url and importSource are kept when they are text", [normalizeTask({ id: "a", url: "https://a.b", importSource: "brone" }).url, normalizeTask({ id: "a", importSource: "brone" }).importSource], ["https://a.b", "brone"]);
  eq("normalizeTask: a non-text url or importSource reads as absent; old tasks have neither", [normalizeTask({ id: "a", url: 5 } as any).url, normalizeTask({ id: "a", importSource: {} } as any).importSource, normalizeTask({ id: "a" }).url], [undefined, undefined, undefined]);
  eq("normalizeTask: unknown fields still survive", (normalizeTask({ id: "a", extra: 1 } as any) as any).extra, 1);
  resetWorld();
  mem.set("campusmate_tasks", JSON.stringify([{ id: "1", title: "Lama", status: "done" }]));
  migrateLegacyKeys((globalThis as any).window.localStorage);
  const migratedDup = P.evaluate(P.buildItems([{ ...b.drafts[0], title: "Lama", subjectName: "", deadline: "", deadlineTime: "" }], []), await storage.read("tasks"), []);
  eq("a Phase 1 task (after migration) is recognized as an existing duplicate", migratedDup[0].dup?.kind, "existing");

  /* ================= static guards ================= */
  const view = (f: string) => fs.readFileSync(path.join(process.cwd(), f), "utf8");
  const walk = (dir: string): string[] => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]));
  const code = (t: string) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, ""); // source without comments
  const importLib = walk(path.join(process.cwd(), "src/lib/import")).map((f) => path.relative(process.cwd(), f).replace(/\\/g, "/"));
  const importUi = ["src/components/import/import-view.tsx", "src/components/import/import-item-card.tsx", "src/components/import/schedule-import-view.tsx", "src/components/import/schedule-import-item-card.tsx"];
  eq("the import library is these modules", importLib.sort(), ["src/lib/import/brone.ts", "src/lib/import/classroom.ts", "src/lib/import/commit.ts", "src/lib/import/duplicates.ts", "src/lib/import/preview.ts", "src/lib/import/schedule-preview.ts", "src/lib/import/siam.ts", "src/lib/import/sources.ts", "src/lib/import/subjects.ts", "src/lib/import/text.ts", "src/lib/import/types.ts"]);
  eq("only commit.ts writes to storage", importLib.filter((f) => /storage\.(write|update|remove)|setRaw/.test(view(f))), ["src/lib/import/commit.ts"]);
  ok("no localStorage/sessionStorage/indexedDB in the import library or its UI", [...importLib, ...importUi].every((f) => !/localStorage|sessionStorage|indexedDB/.test(view(f))));
  ok("the import UI never writes storage itself (it calls commitImport)", importUi.every((f) => !/storage\.(write|update|remove)|getStorageAdapter|setRaw/.test(view(f))) && /commitImport\(/.test(view("src/components/import/import-view.tsx")));
  ok("no UTC-based date keys and no Date parsing of the pasted text", [...importLib, ...importUi].every((f) => !/toISOString\(\)\s*\.\s*(slice|split|substring)/.test(view(f))) && importLib.filter((f) => !/commit\.ts|preview\.ts/.test(f)).every((f) => !/new Date\(|Date\.parse|Date\.UTC/.test(view(f))));
  ok("parsers and helpers are pure (no clock, no randomness, no storage import)", ["text", "classroom", "brone", "siam", "sources", "subjects", "duplicates", "types"].every((n) => { const t = view(`src/lib/import/${n}.ts`); return !/Date\.now|Math\.random|new Date\(\)|from "\.\.\/storage"|from "@\/lib\/storage"/.test(t); }));
  ok("the task lane stayed as it was: Classroom and BRONE only in IMPORT_SOURCES, and their parsers know nothing about SIAM (SIAM lives in its own modules, see batch 9)", Src.IMPORT_SOURCES.length === 2 && ["classroom", "brone", "preview", "duplicates"].every((n) => !/siam/i.test(code(view(`src/lib/import/${n}.ts`)))));
  ok("the pasted text is never put into HTML (no dangerouslySetInnerHTML) and links are http(s) only", importUi.every((f) => !/dangerouslySetInnerHTML|innerHTML/.test(view(f))) && /safeUrl\(/.test(view("src/components/import/import-item-card.tsx")) && /safeUrl\(/.test(view("src/components/tasks/task-item.tsx")) && /rel="noopener noreferrer"/.test(view("src/components/tasks/task-item.tsx")));
  const navText = view("src/lib/navigation.ts");
  const navHrefs = [...navText.matchAll(/href: "([^"]+)"/g)].map((m) => m[1]);
  ok("/import is in the navigation (secondary) and has a page", navHrefs.includes("/import") && /key: "import"[\s\S]*?primary: false/.test(navText) && fs.existsSync(path.join(process.cwd(), "src/app/import/page.tsx")));
  const page = view("src/app/import/page.tsx");
  ok("/import is a server component with metadata and a view", /export const metadata/.test(page) && !/"use client"/.test(page) && /ImportView/.test(page) && !/PlaceholderPage/.test(page));
  ok("Tasks has a link to /import and the manual 'Tambah tugas' flow is still there", /href="\/import"/.test(view("src/components/tasks/tasks-view.tsx")) && /useOpenFromQuery\(openCreate\)/.test(view("src/components/tasks/tasks-view.tsx")) && /TaskFormModal/.test(view("src/components/tasks/tasks-view.tsx")));
  ok("the model change is additive and optional (url?, importSource?)", /url\?: string/.test(view("src/types/models.ts")) && /importSource\?: string/.test(view("src/types/models.ts")));
  eq("no new storage key (still the same 7)", Object.values(STORAGE_KEYS).sort(), ["campusbest_events", "campusbest_focus_sessions", "campusbest_notes", "campusbest_schedules", "campusbest_settings", "campusbest_subjects", "campusbest_tasks"]);
  const pkg = JSON.parse(view("package.json"));
  ok("version is 0.9.0 or later (0.10.0 after Bulk Import 2, 0.11.0 after PWA)", ["0.9.0", "0.10.0", "0.11.0"].includes(pkg.version), pkg.version);
  eq("no dependency added", Object.keys(pkg.dependencies).sort(), ["@radix-ui/react-dialog", "class-variance-authority", "clsx", "framer-motion", "lucide-react", "next", "react", "react-dom", "tailwind-merge"]);
  eq("only Statistics is left as a placeholder", navHrefs.filter((h) => /PlaceholderPage/.test(view(`src/app${h}/page.tsx`))), ["/statistics"]);
  ok("the Dashboard, Calendar and Tasks logic were not touched by the import (no import of lib/import there)", ["lib/dashboard.ts", "lib/calendar.ts", "lib/tasks.ts", "lib/schedule.ts", "lib/events.ts"].every((f) => !/lib\/import|\.\/import\//.test(view(`src/${f}`))));

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}
main();
