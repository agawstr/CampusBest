// Calendar mini-batch 0.12.2: subject abbreviations, "P" for lab rooms, compact chips on small screens.
// Run from the project root:  TZ=Asia/Jakarta npx tsx scripts/batch13-logic-check.ts
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
  const L = await import("@/lib/course-label");
  const C = await import("@/lib/calendar");
  const S = await import("@/lib/subjects");
  const N = await import("@/lib/normalize");

  /* ---------- lab detection: the rooms from the owner's real SIAM schedule ---------- */
  const REAL = {
    jstLab: "Lab Pembelajaran Gedung G - G1.5",
    papbLab: "Lab Pembelajaran Gedung G - G1.2",
    mlopsClass: "Gedung F FILKOM - F3.17",
  };
  ok("real SIAM: G1.5 (JST) is a lab", L.isLabRoom(REAL.jstLab));
  ok("real SIAM: G1.2 (PAPB) is a lab", L.isLabRoom(REAL.papbLab));
  ok("real SIAM: F3.17 (MLOps) is a normal class", !L.isLabRoom(REAL.mlopsClass));
  ok("owner's examples: F3.7 and F3.5 are normal classes", !L.isLabRoom("F3.7") && !L.isLabRoom("F3.5") && !L.isLabRoom("Gedung F FILKOM - F3.7") && !L.isLabRoom("Gedung F FILKOM - F3.5"));
  ok("bare room codes work: G1.5 and G1.2 are labs", L.isLabRoom("G1.5") && L.isLabRoom("g1.2") && L.isLabRoom(" G1.5 "));
  ok("a building letter alone is NOT a lab: Gedung G, Gedung F, G", !L.isLabRoom("Gedung G") && !L.isLabRoom("Gedung F") && !L.isLabRoom("G") && !L.isLabRoom("F"));
  ok("other G rooms are not labs by default (G1.3, G2.1, G1.50, G1.15)", !L.isLabRoom("G1.3") && !L.isLabRoom("G2.1") && !L.isLabRoom("G1.50") && !L.isLabRoom("G1.15") && !L.isLabRoom("Gedung G - G1.50"));
  ok("the word lab / laboratorium / praktikum counts, whole word only", L.isLabRoom("Lab 2") && L.isLabRoom("Laboratorium Komputer") && L.isLabRoom("lab jaringan") && L.isLabRoom("Ruang Praktikum") && !L.isLabRoom("Labuan") && !L.isLabRoom("Elabora") && !L.isLabRoom("Collab Space 3"));
  ok("empty, undefined, null, non-string are not labs", !L.isLabRoom("") && !L.isLabRoom("   ") && !L.isLabRoom(undefined) && !L.isLabRoom(null) && !L.isLabRoom(5 as any));
  eq("roomCode takes the last code", [L.roomCode(REAL.jstLab), L.roomCode(REAL.mlopsClass), L.roomCode("G1.5"), L.roomCode("Gedung G"), L.roomCode(undefined)], ["G1.5", "F3.17", "G1.5", null, null]);
  ok("the list is adjustable: custom codes", L.isLabRoom("H2.1", ["H2.1"]) && !L.isLabRoom("G1.5", ["H2.1"]));
  eq("default list is exactly the two known lab rooms", [...L.LAB_ROOM_CODES], ["G1.2", "G1.5"]);

  /* ---------- automatic abbreviations ---------- */
  eq("JST from the real name", L.autoAbbreviation("Jaringan Saraf Tiruan"), "JST");
  eq("PAPB from the real name", L.autoAbbreviation("Pengembangan Aplikasi Perangkat Bergerak"), "PAPB");
  eq("MLOps from the bracket acronym", L.autoAbbreviation("Machine Learning Operations (MLOps)"), "MLOPS");
  eq("Komputer Grafik -> KG", L.autoAbbreviation("Komputer Grafik"), "KG");
  eq("stop words are skipped", [L.autoAbbreviation("Sistem dan Teknologi Informasi"), L.autoAbbreviation("Pengantar Teknologi di Bidang Informatika")], ["STI", "PTBI"]);
  eq("numbers stay", [L.autoAbbreviation("Pemrograman Web 2"), L.autoAbbreviation("Matematika Diskrit II")], ["PW2", "MDII"]);
  eq("one word: first 4 letters", [L.autoAbbreviation("Statistika"), L.autoAbbreviation("Etika"), L.autoAbbreviation("Ai")], ["STAT", "ETIK", "AI"]);
  ok("a non-acronym bracket is not used", L.autoAbbreviation("Basis Data (Teori)") === "BD");
  ok("never longer than the maximum", L.autoAbbreviation("Satu Dua Tiga Empat Lima Enam Tujuh Delapan Sembilan").length <= L.MAX_ABBR_LENGTH);
  eq("empty / weird names fall back to MK", [L.autoAbbreviation(""), L.autoAbbreviation("   "), L.autoAbbreviation(undefined), L.autoAbbreviation("()")], ["MK", "MK", "MK", "MK"]);
  ok("never uses Subject.code", L.subjectAbbreviation({ name: "Jaringan Saraf Tiruan", abbr: undefined, ...({ code: "CIF65318" } as any) }) === "JST");
  eq("typed abbreviation wins and is only trimmed (case kept)", [L.subjectAbbreviation({ name: "Komputer Grafik", abbr: "  KG " }), L.subjectAbbreviation({ name: "X", abbr: "MLOps" }), L.subjectAbbreviation({ name: "Komputer Grafik", abbr: "   " })], ["KG", "MLOps", "KG"]);

  /* ---------- labels ---------- */
  eq("classLabel adds P only for labs, never twice", [L.classLabel("JST", false), L.classLabel("JST", true), L.classLabel("JST P", true), L.classLabel("PAPB", true)], ["JST", "JST P", "JST P", "PAPB P"]);
  eq("shortenTitle", [L.shortenTitle("Laporan"), L.shortenTitle("Proyek Iterasi 1: Halaman Cover"), L.shortenTitle("  a   b  "), L.shortenTitle(undefined), L.shortenTitle("123456789012"), L.shortenTitle("1234567890123")], ["Laporan", "Proyek Iter…", "a b", "", "123456789012", "12345678901…"]);
  eq("validateAbbr", [L.validateAbbr("JST"), L.validateAbbr(""), L.validateAbbr("1234567"), L.validateAbbr("123456")], [undefined, undefined, `Singkatan maksimal ${L.MAX_ABBR_LENGTH} karakter.`, undefined]);

  /* ---------- Subjects form <-> record ---------- */
  const blank = S.emptySubjectForm("#65B8FF");
  ok("empty form has an empty abbr", blank.abbr === "");
  const made = S.createSubject({ ...blank, name: "Komputer Grafik", abbr: " KG ", code: "IF2140" }, new Date(2026, 10, 16));
  ok("create keeps abbr trimmed, code separate", made.abbr === "KG" && made.code === "IF2140");
  ok("empty abbr is stored as undefined", S.createSubject({ ...blank, name: "A", abbr: "   " }).abbr === undefined);
  ok("form round trip", S.subjectToFormValues(made).abbr === "KG");
  ok("too long abbr is a form error, valid one is not", !!S.validateSubjectForm({ ...blank, name: "A", abbr: "ABCDEFGH" }).abbr && !S.validateSubjectForm({ ...blank, name: "A", abbr: "ABCDEF" }).abbr);
  const edited = S.applySubjectEdit({ ...made, extra: 1 } as any, { ...S.subjectToFormValues(made), abbr: "" }, new Date(2027, 0, 1)) as any;
  ok("clearing abbr works, unknown fields and updatedAt survive", edited.abbr === undefined && edited.extra === 1 && edited.updatedAt !== made.updatedAt);
  const old = N.normalizeSubject({ id: "s", name: "Lama", color: "#fff" });
  ok("old subject without abbr is valid and stays without abbr", old.abbr === undefined && old.name === "Lama");
  ok("garbage abbr (number / empty) reads as none", N.normalizeSubject({ id: "s", name: "x", abbr: 5 }).abbr === undefined && N.normalizeSubject({ id: "s", name: "x", abbr: "  " }).abbr === undefined);
  ok("abbr survives normalize", N.normalizeSubject({ id: "s", name: "x", abbr: "JST" }).abbr === "JST");

  /* ---------- Calendar entries (owner's real schedule) ---------- */
  const subjects = [
    { id: "jst", name: "Jaringan Saraf Tiruan", code: "CIF65318", abbr: undefined, color: "#65B8FF", createdAt: "", updatedAt: "" },
    { id: "papb", name: "Pengembangan Aplikasi Perangkat Bergerak", code: "CIF65115", abbr: "PAPB", color: "#FFB547", createdAt: "", updatedAt: "" },
    { id: "mlops", name: "Machine Learning Operations (MLOps)", code: "CIF60048", abbr: "MLO", color: "#5CD6A4", createdAt: "", updatedAt: "" },
  ] as any[];
  const sch = (id: string, subjectId: string, dayOfWeek: number, startTime: string, endTime: string, room?: string) =>
    N.normalizeSchedule({ id, subjectId, dayOfWeek, startTime, endTime, room, mode: "offline", recurrence: "weekly" });
  const schedules = [
    sch("a", "jst", 1, "07:00", "08:40", REAL.jstLab),
    sch("b", "mlops", 3, "16:00", "17:40", REAL.mlopsClass),
    sch("c", "papb", 5, "12:30", "14:10", REAL.papbLab),
    sch("d", "jst", 1, "10:00", "11:40", "Gedung F FILKOM - F3.7"), // same subject, same day, a normal class
  ];
  const tasks = [N.normalizeTask({ id: "t", title: "Proyek Iterasi 1: Halaman Cover & AI Disclaimer", deadline: "2026-11-16", deadlineTime: "23:59", subjectId: "jst", status: "todo" }),
    N.normalizeTask({ id: "t2", title: "Laporan", deadline: "2026-11-16", status: "todo" })];
  const events = [N.normalizeEvent({ id: "e", title: "Presentasi Akhir Proyek", date: "2026-11-16", startTime: "13:00", category: "presentasi" })];
  const src = { schedules, tasks, events, subjects } as any;

  const mon = C.entriesForDate("2026-11-16", src); // Monday
  const cls = mon.filter((e) => e.kind === "class");
  eq("Monday: two classes of the same subject stay two entries, ordered by time", cls.map((e) => [e.shortTitle, e.shortTime, e.lab]), [["JST P", "07:00", true], ["JST", "10:00", false]]);
  eq("full titles and details are unchanged", cls.map((e) => [e.title, e.detail, e.startTime, e.endTime]), [["Jaringan Saraf Tiruan", REAL.jstLab, "07:00", "08:40"], ["Jaringan Saraf Tiruan", "Gedung F FILKOM - F3.7", "10:00", "11:40"]]);
  const task = mon.find((e) => e.sourceId === "t")!;
  ok("task: short name + deadline time, full title kept", task.shortTitle === "Proyek Iter…" && task.shortTime === "23:59" && task.title.startsWith("Proyek Iterasi 1") && task.startTime === "23:59");
  const task2 = mon.find((e) => e.sourceId === "t2")!;
  ok("task without a deadline time has no time", task2.shortTitle === "Laporan" && task2.shortTime === undefined);
  const ev = mon.find((e) => e.kind === "event")!;
  ok("event: short name + start time", ev.shortTitle === "Presentasi…" && ev.shortTime === "13:00");
  ok("non-class entries are not marked lab", !task.lab && !ev.lab);
  const wed = C.entriesForDate("2026-11-18", src)[0];
  ok("Wednesday MLOps in F3.17: uses the typed abbreviation, no P", wed.shortTitle === "MLO" && wed.lab === false && wed.shortTime === "16:00");
  const fri = C.entriesForDate("2026-11-20", src)[0];
  ok("Friday PAPB in G1.2: PAPB P", fri.shortTitle === "PAPB P" && fri.lab === true && fri.shortTime === "12:30");
  const noAbbr = C.entriesForDate("2026-11-16", { ...src, subjects: [{ ...subjects[0], abbr: undefined }] }).filter((e: any) => e.kind === "class");
  ok("subject without abbr: automatic JST", noAbbr[0].shortTitle === "JST P");
  const gone = C.entriesForDate("2026-11-16", { ...src, subjects: [] }).find((e: any) => e.kind === "class")!;
  ok("deleted subject keeps working", gone.title === "Mata kuliah dihapus" && gone.shortTitle === "Dihapus");
  const badTime = C.entriesForDate("2026-11-16", { ...src, tasks: [{ ...tasks[0], deadlineTime: "25:99" }] }).find((e: any) => e.sourceId === "t")!;
  ok("invalid time gives no short time", badTime.shortTime === undefined);
  const perDay = Array.from({ length: 30 }, (_, k) => C.entriesForDate(`2026-11-${String(k + 1).padStart(2, "0")}`, src));
  ok("November: 13 busy days and 21 entries (18 classes + 2 tasks + 1 event), unchanged by the new fields", perDay.filter((d) => d.length > 0).length === 13 && perDay.reduce((n, d) => n + d.length, 0) === 21);
  ok("every entry has a short title", perDay.flat().every((e) => typeof e.shortTitle === "string" && e.shortTitle.length > 0));
  ok("rooms in the lab list do not change the class ordering rule (by start time)", cls[0].startTime! < cls[1].startTime!);

  /* ---------- storage safety ---------- */
  const raw = { id: "s9", name: "Komputer Grafik", abbr: "KG", futureField: { keep: true }, color: "#fff", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" };
  mem.set("campusbest_subjects", JSON.stringify([raw]));
  const { storage } = await import("@/lib/storage");
  const read = (await storage.read("subjects")) as any[];
  ok("abbr reads from storage", read[0].abbr === "KG");
  await storage.update("subjects", (list: any[]) => list.map((s) => ({ ...s, name: "Komputer Grafik Lanjut", updatedAt: "2026-02-01T00:00:00.000Z" })));
  const back = JSON.parse(mem.get("campusbest_subjects")!)[0];
  ok("abbr and unknown fields survive an unrelated edit", back.abbr === "KG" && back.futureField.keep === true);
  mem.set("campusbest_subjects", JSON.stringify([{ id: "o", name: "Lama", color: "#fff" }]));
  const beforeRead = mem.get("campusbest_subjects");
  await storage.read("subjects");
  ok("reading old data writes nothing new (no abbr key invented)", mem.get("campusbest_subjects") === beforeRead && !beforeRead!.includes("abbr"));

  /* ---------- source checks ---------- */
  const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const vc = strip(view("src/components/calendar/calendar-view.tsx"));
  const cal = strip(view("src/lib/calendar.ts"));
  const lab = strip(view("src/lib/course-label.ts"));
  const form = view("src/components/subjects/subject-form-modal.tsx");
  ok("course-label is pure: no storage, no clock", !/localStorage|storage|new Date|Date\.now/.test(lab));
  ok("Subject.code is not used for the abbreviation", !/\.code\b/.test(lab) && !/\.code\b/.test(cal.replace(/event\.code/g, "")));
  ok("calendar uses the shared helpers, rooms checked via isLabRoom", /isLabRoom\(item\.room\)/.test(cal) && /subjectAbbreviation\(subject\)/.test(cal) && /classLabel\(/.test(cal));
  ok("desktop (lg+) chips are unchanged: full title, limits 2/3", /TITLES_LG = 2;/.test(vc) && /TITLES_XL = 3;/.test(vc) && /hidden min-w-0 flex-col gap-0\.5 text-left lg:flex/.test(vc) && /\{e\.title\}/.test(vc) && /h-\[6\.75rem\]/.test(vc) && /xl:h-\[8\.25rem\]/.test(vc));
  ok("mobile chips: limit 2 on phones, 3 from sm, only below lg", /TITLES_MOBILE = 2;/.test(vc) && /i >= TITLES_MOBILE && "hidden sm:flex"/.test(vc) && /flex w-full min-w-0 flex-col gap-0\.5 lg:hidden/.test(vc));
  ok("mobile chips show short label and start time, truncated", /truncate[^"]*">\{e\.shortTitle\}/.test(vc) && /\{e\.shortTime &&/.test(vc));
  ok("mobile '+N' counts match the limits", /const moreMobile = previewEntries\(entries, TITLES_MOBILE\)\.more/.test(vc) && /moreXl > 0/.test(vc));
  ok("cells still read from byDate (no second computation)", /const entries = byDate\.get\(cell\.key\);/.test(vc) && /byDate\.get\(selected\)/.test(vc));
  ok("the Subjects form has an abbreviation field with a hint", /Singkatan \(opsional\)/.test(form) && /hint=/.test(form) && /errors\.abbr/.test(form));
  const pkg = JSON.parse(view("package.json"));
  eq("no dependency added", Object.keys(pkg.dependencies).sort(), ["@radix-ui/react-dialog", "class-variance-authority", "clsx", "framer-motion", "lucide-react", "next", "react", "react-dom", "tailwind-merge"]);
  ok("version 0.12.2 everywhere", pkg.version === "0.12.2" && /APP_VERSION = "0\.12\.2"/.test(view("src/lib/pwa.ts")) && /const VERSION = "0\.12\.2"/.test(view("public/sw.js")));
  ok("storage layer files untouched by name (no new key)", !/abbr/.test(view("src/lib/storage-keys.ts")) && !/abbr/.test(view("src/lib/storage.ts")));

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}
main();
