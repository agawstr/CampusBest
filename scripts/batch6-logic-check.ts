// Run from the project root (needs `npx tsx`, no install needed in the project):
//   TZ=Asia/Jakarta npx tsx scripts/batch6-logic-check.ts
// Try other zones too (DST): TZ=America/New_York, TZ=Europe/London, TZ=Pacific/Auckland
export {}; // makes this file a module so the scripts don't share globals under `tsc`
import * as fs from "node:fs";
import * as path from "node:path";

const mem = new Map<string, string>();
let failWrites = false; // simulates a full LocalStorage: big writes throw, tiny probe writes still work
let blocked = false; // simulates blocked LocalStorage (private mode): every write throws, even the probe
(globalThis as any).window = {
  localStorage: {
    getItem: (k: string) => (mem.has(k) ? mem.get(k)! : null),
    setItem: (k: string, v: string) => {
      if (blocked) throw new DOMException("Access denied.", "SecurityError");
      if (failWrites && v.length > 20) throw new DOMException("The quota has been exceeded.", "QuotaExceededError");
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

async function main() {
  const N = await import("@/lib/notes");
  const Q = await import("@/lib/quick-actions");
  const { storage, migrateLegacyKeys } = await import("@/lib/storage");
  const { normalizeNote } = await import("@/lib/normalize");
  const { STORAGE_KEYS } = await import("@/lib/storage-keys");
  type Note = import("@/types").Note;
  type Subject = import("@/types").Subject;

  const KEY = STORAGE_KEYS.notes;
  const raw = () => JSON.parse(mem.get(KEY) ?? "null");
  const note = (o: Record<string, unknown>): Note => normalizeNote({ title: String(o.id), content: "", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z", ...o }, 0);
  const fv = (o: Partial<import("@/lib/notes").NoteFormValues> = {}): import("@/lib/notes").NoteFormValues => ({ ...N.EMPTY_NOTE_FORM, title: "Catatan", ...o });
  const now = new Date(2026, 10, 15, 12, 0); // Sun 15 Nov 2026, noon

  const subs: Subject[] = [
    { id: "s1", name: "Basis Data", code: "IF2140", color: "#65B8FF", createdAt: "x", updatedAt: "x" },
    { id: "s2", name: "Kalkulus", color: "#FF8A7A", createdAt: "x", updatedAt: "x" },
  ];
  const byId = new Map(subs.map((s) => [s.id, s]));

  /* ================= form <-> record ================= */
  eq("empty form", N.EMPTY_NOTE_FORM, { title: "", content: "", subjectId: "" });
  eq("title is required", N.validateNoteForm(fv({ title: "" })), { title: "Judul catatan wajib diisi." });
  eq("whitespace-only title is rejected", Object.keys(N.validateNoteForm(fv({ title: "   \n " }))), ["title"]);
  eq("content may be empty", N.validateNoteForm(fv({ title: "Ide", content: "" })), {});
  eq("a valid form has no errors", N.validateNoteForm(fv({ content: "isi", subjectId: "s1" })), {});

  const created = N.createNote(fv({ title: "  Normalisasi  ", content: "Baris 1\r\nBaris 2   \n\n", subjectId: "s1" }), new Date("2026-11-10T03:00:00.000Z"));
  ok("createNote makes an id", typeof created.id === "string" && created.id.length > 8);
  eq("createNote trims title, normalizes newlines, drops trailing whitespace", [created.title, created.content], ["Normalisasi", "Baris 1\nBaris 2"]);
  eq("createNote timestamps are equal and ISO", [created.createdAt, created.updatedAt], ["2026-11-10T03:00:00.000Z", "2026-11-10T03:00:00.000Z"]);
  eq("createNote: subject kept, not pinned", [created.subjectId, created.pinned], ["s1", false]);
  eq("createNote: blank subject becomes undefined", N.createNote(fv({ subjectId: "" })).subjectId, undefined);
  ok("createNote keeps inner blank lines and indentation", N.createNote(fv({ content: "a\n\n  b" })).content === "a\n\n  b");
  ok("two notes get different ids", N.createNote(fv()).id !== N.createNote(fv()).id);

  const base = note({ id: "n1", title: "Lama", content: "isi lama", subjectId: "s1", pinned: true, extra: { keep: 1 }, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-02T00:00:00.000Z" });
  const edited = N.applyNoteEdit(base, fv({ title: " Baru ", content: "isi baru\n", subjectId: "" }), new Date("2026-11-12T00:00:00.000Z"));
  eq("applyNoteEdit applies the form", [edited.title, edited.content, edited.subjectId], ["Baru", "isi baru", undefined]);
  eq("applyNoteEdit keeps id, createdAt, pinned and unknown fields", [edited.id, edited.createdAt, edited.pinned, (edited as any).extra], ["n1", "2026-01-01T00:00:00.000Z", true, { keep: 1 }]);
  eq("applyNoteEdit always bumps updatedAt", edited.updatedAt, "2026-11-12T00:00:00.000Z");
  ok("applyNoteEdit does not mutate the input", base.title === "Lama" && base.content === "isi lama" && base.subjectId === "s1");
  const same = N.applyNoteEdit(base, N.noteToFormValues(base, new Set(["s1"])), new Date("2026-11-12T00:00:00.000Z"));
  ok("an edit with no changes still bumps updatedAt", same.updatedAt !== base.updatedAt && same.title === base.title && same.content === base.content);
  eq("noteToFormValues for a normal note", N.noteToFormValues(base, new Set(["s1"])), { title: "Lama", content: "isi lama", subjectId: "s1" });
  eq("noteToFormValues: a deleted subject shows as no subject", N.noteToFormValues(base, new Set(["s2"])).subjectId, "");

  const pinOn = N.togglePinned(note({ id: "p" }), new Date("2026-11-12T00:00:00.000Z"));
  eq("togglePinned on: pinned true + updatedAt", [pinOn.pinned, pinOn.updatedAt], [true, "2026-11-12T00:00:00.000Z"]);
  const pinOff = N.togglePinned(pinOn, new Date("2026-11-13T00:00:00.000Z"));
  eq("togglePinned off: pinned false + updatedAt", [pinOff.pinned, pinOff.updatedAt], [false, "2026-11-13T00:00:00.000Z"]);
  ok("togglePinned keeps title/content/subject", pinOn.title === "p" && pinOn.content === "" && togglePinnedKeeps());
  function togglePinnedKeeps() { const n = note({ id: "k", content: "c", subjectId: "s2" }); const t = N.togglePinned(n); return t.content === "c" && t.subjectId === "s2" && t.id === "k"; }
  eq("isPinned: only a real true counts", [N.isPinned({ pinned: true }), N.isPinned({ pinned: false }), N.isPinned({}), N.isPinned({ pinned: "yes" as any })], [true, false, false, false]);

  /* ================= filter ================= */
  const list: Note[] = [
    note({ id: "a", title: "Rangkuman SQL", content: "JOIN dan GROUP BY", subjectId: "s1" }),
    note({ id: "b", title: "Limit", content: "Turunan dan integral", subjectId: "s2" }),
    note({ id: "c", title: "Ide proyek", content: "Aplikasi catatan", subjectId: undefined }),
    note({ id: "d", title: "Sisa", content: "dari mata kuliah lama", subjectId: "gone" }),
  ];
  const ids = (l: Note[]) => l.map((n) => n.id);
  const F = (query: string, subject: string) => ids(N.filterNotes(list, byId, { query, subject }));
  eq("no filter returns everything, in input order", F("", "all"), ["a", "b", "c", "d"]);
  eq("search in title", F("sql", "all"), ["a"]);
  eq("search in content", F("integral", "all"), ["b"]);
  eq("search is case-insensitive", F("RANGKUMAN", "all"), ["a"]);
  eq("search by subject name", F("kalkulus", "all"), ["b"]);
  eq("search by subject code", F("if2140", "all"), ["a"]);
  eq("search ignores surrounding spaces", F("  limit  ", "all"), ["b"]);
  eq("search with no match", F("zzz", "all"), []);
  eq("a deleted subject's name is not searchable (it has none)", F("gone", "all"), []);
  eq("subject filter by id", F("", "s1"), ["a"]);
  eq("subject filter 'none' includes notes whose subject was deleted", F("", "none"), ["c", "d"]);
  eq("subject filter for a deleted id matches nothing", F("", "gone"), []);
  eq("query + subject combine (AND)", F("a", "s2"), ["b"]);
  eq("query + subject with no overlap", F("sql", "s2"), []);
  ok("filter does not mutate the input", list.length === 4 && list[0].id === "a");
  eq("noteSubject resolves existing, undefined for deleted / none", [N.noteSubject(list[0], byId)?.id, N.noteSubject(list[3], byId), N.noteSubject(list[2], byId)], ["s1", undefined, undefined]);

  /* ================= sort ================= */
  const mk = (id: string, title: string, created: string, updated: string, pinned?: boolean) => note({ id, title, createdAt: created, updatedAt: updated, pinned });
  const s = [
    mk("old-pin", "Zebra", "2026-01-01T00:00:00.000Z", "2026-01-05T00:00:00.000Z", true),
    mk("new", "Mangga", "2026-03-01T00:00:00.000Z", "2026-03-02T00:00:00.000Z"),
    mk("edited", "apel", "2026-02-01T00:00:00.000Z", "2026-04-01T00:00:00.000Z"),
    mk("new-pin", "Buku", "2026-05-01T00:00:00.000Z", "2026-05-02T00:00:00.000Z", true),
    mk("oldest", "Cabai", "2025-12-01T00:00:00.000Z", "2025-12-01T00:00:00.000Z"),
  ];
  eq("sort updated: pinned first (newest edit first), then newest edit", ids(N.sortNotes(s, "updated")), ["new-pin", "old-pin", "edited", "new", "oldest"]);
  eq("sort created: pinned first, then newest created", ids(N.sortNotes(s, "created")), ["new-pin", "old-pin", "new", "edited", "oldest"]);
  eq("sort title: pinned first, then A-Z ignoring case", ids(N.sortNotes(s, "title")), ["new-pin", "old-pin", "edited", "oldest", "new"]);
  eq("default sort is 'updated'", ids(N.sortNotes(s)), ids(N.sortNotes(s, "updated")));
  ok("sort does not mutate the input", s[0].id === "old-pin" && s[1].id === "new");
  eq("pinned notes stay first when nothing is pinned", ids(N.sortNotes([mk("x", "X", "2026-01-01T00:00:00.000Z", "2026-01-01T00:00:00.000Z")], "title")), ["x"]);
  const tie = [mk("t2", "Sama", "2026-01-01T00:00:00.000Z", "2026-01-01T00:00:00.000Z"), mk("t1", "Sama", "2026-01-01T00:00:00.000Z", "2026-01-01T00:00:00.000Z")];
  eq("full ties fall back to id: stable and repeatable", [ids(N.sortNotes(tie)), ids(N.sortNotes([...tie].reverse()))], [["t1", "t2"], ["t1", "t2"]]);
  const broken = [
    note({ id: "good", updatedAt: "2026-06-01T00:00:00.000Z" }),
    { ...note({ id: "bad" }), updatedAt: "not a date", createdAt: "also not" } as Note,
  ];
  eq("a record with unreadable timestamps sorts last without throwing", ids(N.sortNotes(broken, "updated")), ["good", "bad"]);
  eq("labels", [N.NOTE_SORTS.length, N.NOTE_SORT_LABELS.updated, N.NOTE_SORT_LABELS.created, N.NOTE_SORT_LABELS.title], [3, "Terakhir diubah", "Terbaru dibuat", "Judul A-Z"]);

  /* ================= preview + time label ================= */
  eq("short content is returned as it is", N.notePreview("halo"), "halo");
  eq("empty content gives an empty preview", N.notePreview("   \n "), "");
  ok("long content is cut with an ellipsis", N.notePreview("kata ".repeat(200)).endsWith("…") && N.notePreview("kata ".repeat(200)).length <= 281);
  ok("preview cuts at a word boundary", !N.notePreview("abcdefghij ".repeat(60), 100).replace("…", "").endsWith("abcdefgh"));
  ok("a long unbroken word is still cut", N.notePreview("x".repeat(1000), 50).length === 51);
  eq("preview keeps line breaks", N.notePreview("a\r\nb"), "a\nb");
  eq("time label: today", N.noteTimeLabel({ updatedAt: new Date(2026, 10, 15, 8, 0).toISOString() }, now), "Diubah hari ini");
  eq("time label: yesterday", N.noteTimeLabel({ updatedAt: new Date(2026, 10, 14, 23, 30).toISOString() }, now), "Diubah kemarin");
  ok("time label: older shows a date", /^Diubah 3 Nov 2026$/.test(N.noteTimeLabel({ updatedAt: new Date(2026, 10, 3, 9, 0).toISOString() }, now)), N.noteTimeLabel({ updatedAt: new Date(2026, 10, 3, 9, 0).toISOString() }, now));
  eq("time label: legacy epoch fallback shows nothing", N.noteTimeLabel({ updatedAt: "1970-01-01T00:00:00.000Z" }, now), "");
  eq("time label: garbage shows nothing", N.noteTimeLabel({ updatedAt: "nope" }, now), "");
  eq("time label uses the local day, not UTC", N.noteTimeLabel({ updatedAt: new Date(2026, 10, 15, 0, 30).toISOString() }, now), "Diubah hari ini");

  /* ================= data from earlier builds ================= */
  const legacy = normalizeNote({ id: 7, content: 5 } as any, 3);
  eq("legacy record: numeric id, missing title, non-string content", [legacy.id, legacy.title, legacy.content], ["7", "Tanpa judul", ""]);
  eq("legacy record without id gets a deterministic one", normalizeNote({}, 4).id, "note-legacy-4");
  eq("pinned of the wrong type is read as not pinned", [normalizeNote({ pinned: "yes" } as any).pinned, N.isPinned(normalizeNote({ pinned: "yes" } as any))], [undefined, false]);

  /* ================= storage: CRUD, refresh, parallel writes ================= */
  mem.clear();
  eq("empty storage reads as no notes, and reading writes nothing", [(await storage.read("notes")).length, mem.has(KEY)], [0, false]);

  const n1 = N.createNote(fv({ title: "Satu", content: "isi satu", subjectId: "s1" }), new Date("2026-11-10T01:00:00.000Z"));
  const n2 = N.createNote(fv({ title: "Dua" }), new Date("2026-11-11T01:00:00.000Z"));
  await storage.update("notes", (l) => [...l, n1]);
  await storage.update("notes", (l) => [...l, n2]);
  eq("create writes both under campusbest_notes", raw().map((r: any) => r.title), ["Satu", "Dua"]);
  ok("only the notes key exists (no stray collections)", [...mem.keys()].filter((k) => k.startsWith("campusbest_") && k !== KEY).every((k) => k === "campusbest_migration_v1"));

  await storage.update("notes", (l) => l.map((n) => (n.id === n1.id ? N.applyNoteEdit(n, fv({ title: "Satu (revisi)", content: "baru", subjectId: "s2" }), new Date("2026-11-12T01:00:00.000Z")) : n)));
  const afterEdit = raw().find((r: any) => r.id === n1.id);
  eq("edit persists", [afterEdit.title, afterEdit.content, afterEdit.subjectId, afterEdit.updatedAt, afterEdit.createdAt], ["Satu (revisi)", "baru", "s2", "2026-11-12T01:00:00.000Z", "2026-11-10T01:00:00.000Z"]);
  eq("the sibling note is untouched byte for byte", JSON.stringify(raw().find((r: any) => r.id === n2.id)), JSON.stringify(n2));

  await storage.update("notes", (l) => l.map((n) => (n.id === n2.id ? N.togglePinned(n, new Date("2026-11-13T01:00:00.000Z")) : n)));
  eq("pin persists", [raw().find((r: any) => r.id === n2.id).pinned, raw().find((r: any) => r.id === n1.id).pinned], [true, false]);
  eq("after a refresh (re-read) the pinned note sorts first", ids(N.sortNotes(await storage.read("notes"))), [n2.id, n1.id]);
  await storage.update("notes", (l) => l.map((n) => (n.id === n2.id ? N.togglePinned(n, new Date("2026-11-14T01:00:00.000Z")) : n)));
  eq("unpin persists", raw().find((r: any) => r.id === n2.id).pinned, false);

  await storage.update("notes", (l) => l.filter((n) => n.id !== n2.id));
  eq("delete removes only that note", raw().map((r: any) => r.id), [n1.id]);

  await Promise.all(Array.from({ length: 20 }, (_, i) => storage.update("notes", (l) => [...l, N.createNote(fv({ title: `Paralel ${i}` }))])));
  eq("20 parallel creates all survive", [raw().length, new Set(raw().map((r: any) => r.id)).size], [21, 21]);
  await Promise.all(raw().slice(1, 11).map((r: any) => storage.update("notes", (l) => l.map((n) => (n.id === r.id ? N.togglePinned(n) : n)))));
  eq("10 parallel pins all land", (await storage.read("notes")).filter(N.isPinned).length, 10);

  /* unknown fields, odd entries and legacy data survive a normal edit */
  mem.clear();
  mem.set(KEY, JSON.stringify([{ id: "u1", title: "U", content: "c", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z", color: "pink", nested: { a: [1, 2] } }, "stray", 42, null]));
  await storage.update("notes", (l) => l.map((n) => (n.id === "u1" ? N.applyNoteEdit(n, fv({ title: "U2", content: "c2" }), new Date("2026-11-12T00:00:00.000Z")) : n)));
  const kept = raw();
  eq("unknown fields on the record are kept", [kept[0].color, kept[0].nested, kept[0].title], ["pink", { a: [1, 2] }, "U2"]);
  eq("non-object entries are appended back, not lost", kept.slice(1), ["stray", 42, null]);

  /* migration from the CampusMate prefix */
  mem.clear();
  mem.set("campusmate_notes", JSON.stringify([{ id: "old1", title: "Catatan Phase 1", content: "isi", subjectId: "s1", pinned: true, createdAt: "2026-02-01T00:00:00.000Z", updatedAt: "2026-02-02T00:00:00.000Z" }, { id: "old2" }]));
  migrateLegacyKeys((globalThis as any).window.localStorage);
  const migrated = await storage.read("notes");
  eq("Phase 1 notes show up after migration", migrated.map((n) => [n.id, n.title, n.pinned ?? false]), [["old1", "Catatan Phase 1", true], ["old2", "Tanpa judul", false]]);
  ok("legacy key untouched", mem.get("campusmate_notes")!.includes("Catatan Phase 1"));
  await storage.update("notes", (l) => l.map((n) => (n.id === "old1" ? N.applyNoteEdit(n, fv({ title: "Diedit", content: "isi" }), new Date()) : n)));
  eq("editing a migrated note leaves the legacy key alone and keeps the other note's id", [mem.get("campusmate_notes")!.includes("Catatan Phase 1"), raw().map((r: any) => r.id)], [true, ["old1", "old2"]]);

  /* deleting a subject never touches notes */
  mem.clear();
  mem.set(STORAGE_KEYS.subjects, JSON.stringify(subs));
  await storage.update("notes", () => [N.createNote(fv({ title: "Terkait", subjectId: "s1" }))]);
  const before = mem.get(KEY);
  await storage.update("subjects", (l) => l.filter((x) => x.id !== "s1"));
  eq("deleting a subject leaves campusbest_notes byte for byte", mem.get(KEY), before);
  const afterDelete = await storage.read("notes");
  const subjectsNow = new Map((await storage.read("subjects")).map((x) => [x.id, x]));
  eq("the orphaned note shows with no subject and matches the 'none' filter", [N.noteSubject(afterDelete[0], subjectsNow), ids(N.filterNotes(afterDelete, subjectsNow, { query: "", subject: "none" }))], [undefined, [afterDelete[0].id]]);
  eq("editing it clears the dead subject id (form shows 'no subject')", N.applyNoteEdit(afterDelete[0], N.noteToFormValues(afterDelete[0], new Set(subjectsNow.keys())), new Date()).subjectId, undefined);

  /* ================= storage failure: nothing half-written, text stays recoverable ================= */
  mem.clear();
  const keep = N.createNote(fv({ title: "Aman", content: "jangan hilang" }));
  await storage.update("notes", (l) => [...l, keep]);
  const stored = mem.get(KEY);
  failWrites = true;
  const draft = fv({ title: "Tulisan panjang", content: "isi yang sedang diketik ".repeat(50), subjectId: "s1" });
  let threw = false;
  try { await storage.update("notes", (l) => [...l, N.createNote(draft)]); } catch { threw = true; }
  eq("a failed write rejects (so the UI can show the error)", threw, true);
  eq("a failed write leaves the stored notes exactly as they were", mem.get(KEY), stored);
  eq("the in-memory form values are untouched by the failure", [draft.title, draft.content.length, draft.subjectId], ["Tulisan panjang", 1200, "s1"]);
  let editThrew = false;
  try { await storage.update("notes", (l) => l.map((n) => (n.id === keep.id ? N.togglePinned(n) : n))); } catch { editThrew = true; }
  eq("a failed pin also rejects and changes nothing", [editThrew, mem.get(KEY)], [true, stored]);
  failWrites = false;
  await storage.update("notes", (l) => [...l, N.createNote(draft)]);
  eq("retrying the same text after the failure saves it", [raw().length, raw()[1].title, raw()[1].content.length], [2, "Tulisan panjang", draft.content.trimEnd().length]);
  failWrites = true;
  try { await storage.update("notes", (l) => [...l, N.createNote(fv({ title: "gagal" }))]); } catch { /* expected */ }
  failWrites = false;
  await storage.update("notes", (l) => [...l, N.createNote(fv({ title: "setelah gagal" }))]);
  eq("the update queue is not stuck after a failed write", raw().map((r: any) => r.title), ["Aman", "Tulisan panjang", "setelah gagal"]);

  /* blocked LocalStorage: the storage layer skips the write silently, so the view checks availability first */
  const { getStorageAdapter } = await import("@/lib/storage");
  blocked = true;
  eq("blocked storage reports itself as unavailable", getStorageAdapter().isAvailable(), false);
  const beforeBlocked = mem.get(KEY);
  let silent = true;
  try { await storage.update("notes", (l) => [...l, N.createNote(fv({ title: "tak tersimpan" }))]); } catch { silent = false; }
  eq("known behaviour of the storage layer: a blocked write does not throw, and nothing is stored", [silent, mem.get(KEY)], [true, beforeBlocked]);
  blocked = false;
  eq("storage reports available again once writes work", getStorageAdapter().isAvailable(), true);

  /* a large note is stored and read back whole (no length limit, by design) */
  mem.clear();
  const big = "Baris catatan panjang.\n".repeat(20000);
  await storage.update("notes", (l) => [...l, N.createNote(fv({ title: "Besar", content: big }))]);
  eq("a 400 KB note round-trips", (await storage.read("notes"))[0].content.length, big.trimEnd().length);
  ok("its card preview stays small", N.notePreview((await storage.read("notes"))[0].content).length <= 281);

  /* ================= quick action + navigation ================= */
  const navText = fs.readFileSync(path.join(process.cwd(), "src/lib/navigation.ts"), "utf8");
  const navHrefs = [...navText.matchAll(/href: "([^"]+)"/g)].map((m) => m[1]);
  const noteAction = Q.QUICK_ACTIONS.find((a) => a.key === "note");
  eq("'Tambah catatan' quick action exists and opens /notes with the add flag", [noteAction?.label, noteAction?.href], ["Tambah catatan", "/notes?tambah=1"]);
  ok("it uses the shared flag, like the other add actions", Q.wantsAdd(new URL(noteAction!.href, "http://x").search) && navHrefs.includes("/notes"));
  eq("quick actions keep their order", Q.QUICK_ACTIONS.map((a) => a.key), ["task", "schedule", "event", "note", "calendar"]);
  eq("the flag is removed from the address afterwards", Q.withoutAddParam(new URL(noteAction!.href, "http://x").search), "");

  /* ================= static guards ================= */
  const view = (f: string) => fs.readFileSync(path.join(process.cwd(), f), "utf8");
  const notesPage = view("src/app/notes/page.tsx");
  ok("/notes is a server component with metadata and no longer a placeholder", /export const metadata/.test(notesPage) && !/"use client"/.test(notesPage) && !/PlaceholderPage/.test(notesPage) && /NotesView/.test(notesPage));
  const notesView = view("src/components/notes/notes-view.tsx");
  ok("Notes opens its own form from ?tambah=1 (no second form on the dashboard)", /useOpenFromQuery\(openCreate\)/.test(notesView));
  ok("saving reports success/failure so the form can keep the text", /Promise<boolean>/.test(notesView) && /return false/.test(notesView) && /return true/.test(notesView));
  ok("a failed save shows an error toast", /variant: "error"/.test(notesView));
  ok("save, pin and delete check that storage is writable first (blocked storage fails silently otherwise)", (notesView.match(/ensureWritable\(\);/g) ?? []).length === 3 && /isAvailable\(\)/.test(notesView));
  const form = view("src/components/notes/note-form-modal.tsx");
  ok("the form keeps the text of a failed save (draft kept, cleared only on success or Batal)", /drafts\.current\.set/.test(form) && /drafts\.current\.delete/.test(form) && /role="alert"/.test(form));
  ok("the form does not close itself on failure (the view closes it on success only)", !/onOpenChange\(false\)/.test(form.replace(/function cancel\(\)[\s\S]*?\n  }/, "")));
  const noteFiles = ["src/lib/notes.ts", "src/components/notes/notes-view.tsx", "src/components/notes/note-card.tsx", "src/components/notes/note-form-modal.tsx"];
  ok("Notes code never touches localStorage or other storage directly", noteFiles.every((f) => !/localStorage|sessionStorage|indexedDB/.test(view(f))));
  ok("Notes code never builds date keys from UTC", noteFiles.every((f) => !/toISOString\(\)\s*\.\s*(slice|split|substring)/.test(view(f))));
  ok("the dashboard gained no notes card, stat or form", !/notes/i.test(["lib/dashboard.ts", "components/dashboard/dashboard-view.tsx", "components/dashboard/task-progress-card.tsx", "components/dashboard/upcoming-tasks-card.tsx", "components/dashboard/upcoming-events-card.tsx", "components/dashboard/today-schedule-card.tsx"].map((f) => view(`src/${f}`)).join("\n")));
  const pkg = JSON.parse(view("package.json"));
  eq("no dependency added", Object.keys(pkg.dependencies).sort(), ["@radix-ui/react-dialog", "class-variance-authority", "clsx", "framer-motion", "lucide-react", "next", "react", "react-dom", "tailwind-merge"]);
  eq("only Statistics is left as a placeholder (Focus is built since Phase 3 Batch 2)", navHrefs.filter((h) => /PlaceholderPage/.test(view(`src/app${h}/page.tsx`))).sort(), ["/statistics"]);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}
main();
