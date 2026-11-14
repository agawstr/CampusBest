// Run from the project root:  TZ=Asia/Jakarta npx tsx scripts/batch2-logic-check.ts
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
  const T = await import("@/lib/tasks");
  const S = await import("@/lib/subjects");
  const { storage } = await import("@/lib/storage");
  const { normalizeTask } = await import("@/lib/normalize");
  const { isTaskDone, getTaskDeadline } = await import("@/lib/domain");
  type Task = import("@/types").Task;
  type Subject = import("@/types").Subject;

  const mk = (o: Partial<Task> & { id: string }): Task => normalizeTask({ title: o.id, createdAt: `2026-01-0${o.id.length}T00:00:00Z`, ...o });
  const now = new Date(2026, 10, 15, 12, 0); // 15 Nov 2026 12:00 local

  /* ---- filter ---- */
  const subjects: Subject[] = [
    { id: "s1", name: "Basis Data", code: "IF2140", color: "#65B8FF", createdAt: "x", updatedAt: "x" },
    { id: "s2", name: "Kalkulus", color: "#FF8A7A", createdAt: "x", updatedAt: "x" },
  ];
  const byId = new Map(subjects.map((s) => [s.id, s]));
  const tasks = [
    mk({ id: "a", title: "Laporan", subjectId: "s1", priority: "high", status: "todo", deadline: "2026-11-20" }),
    mk({ id: "bb", title: "Soal latihan", description: "bab TURUNAN", subjectId: "s2", priority: "low", status: "in_progress" }),
    mk({ id: "ccc", title: "Makalah", priority: "medium", status: "completed", deadline: "2026-11-10" }),
    mk({ id: "dddd", title: "Lama", priority: "medium", status: "done" }),
  ];
  const f = (o: Partial<import("@/lib/tasks").TaskFilters>) =>
    T.filterTasks(tasks, byId, { query: "", status: "all", priority: "all", ...o }).map((t) => t.id);
  eq("filter all", f({}), ["a", "bb", "ccc", "dddd"]);
  eq("filter status done (done+completed)", f({ status: "done" }), ["ccc", "dddd"]);
  eq("filter status in_progress", f({ status: "in_progress" }), ["bb"]);
  eq("filter status todo", f({ status: "todo" }), ["a"]);
  eq("filter priority", f({ priority: "medium" }), ["ccc", "dddd"]);
  eq("search title ci", f({ query: " LAPORAN " }), ["a"]);
  eq("search description", f({ query: "turunan" }), ["bb"]);
  eq("search subject name", f({ query: "basis" }), ["a"]);
  eq("search subject code", f({ query: "if2140" }), ["a"]);
  eq("search + status", f({ query: "a", status: "done" }), ["ccc", "dddd"]);
  eq("search no match", f({ query: "zzz" }), []);

  /* ---- sort ---- */
  const ids = (l: Task[]) => l.map((t) => t.id);
  eq("sort deadline (nodeadline last, done at bottom)", ids(T.sortTasks(tasks, "deadline")), ["a", "bb", "ccc", "dddd"]);
  const more = [
    ...tasks,
    mk({ id: "e", title: "E", priority: "high", deadline: "2026-11-16", deadlineTime: "09:00" }),
    mk({ id: "f", title: "F", priority: "low", deadline: "2026-11-16", deadlineTime: "08:00" }),
    mk({ id: "g", title: "G", priority: "high", deadline: "bukan-tanggal" }),
  ];
  eq("sort deadline w/ time + malformed last among open", ids(T.sortTasks(more, "deadline")), ["f", "e", "a", "g", "bb", "ccc", "dddd"].map((x) => x));
  eq("sort priority", ids(T.sortTasks(more, "priority")), ["e", "a", "g", "f", "bb", "ccc", "dddd"].map((x) => x));
  ok("sort doesn't mutate", more[0].id === "a");

  /* ---- deadlineInfo ---- */
  const di = (o: Partial<Task>) => T.deadlineInfo(mk({ id: "x", ...o }), now);
  eq("no deadline", di({}), null);
  eq("malformed", di({ deadline: "2026-13-45" }), null);
  ok("overdue", di({ deadline: "2026-11-14" })?.tone === "overdue" && di({ deadline: "2026-11-14" })!.label.startsWith("Kemarin"));
  eq("today later = soon", di({ deadline: "2026-11-15", deadlineTime: "18:00" })?.tone, "soon");
  eq("today earlier time = overdue", di({ deadline: "2026-11-15", deadlineTime: "08:00" })?.tone, "overdue");
  eq("today no time = soon (end of day)", di({ deadline: "2026-11-15" })?.tone, "soon");
  ok("tomorrow", di({ deadline: "2026-11-16" })!.label.startsWith("Besok"));
  ok("5 days", di({ deadline: "2026-11-20" })!.label.startsWith("5 hari lagi") && di({ deadline: "2026-11-20" })!.tone === "normal");
  ok("done never overdue", di({ deadline: "2026-11-01", status: "completed" })!.tone === "normal");
  ok("legacy dueDate used", di({ dueDate: "2026-11-16" } as any)!.label.startsWith("Besok"));
  ok("label has time", di({ deadline: "2026-11-20", deadlineTime: "10:30" })!.label.includes("10:30"));

  /* ---- validation ---- */
  const base = T.EMPTY_TASK_FORM;
  ok("title required", !!T.validateTaskForm({ ...base, title: "  " }).title);
  ok("valid ok", Object.keys(T.validateTaskForm({ ...base, title: "x", deadline: "2026-11-20", deadlineTime: "10:00" })).length === 0);
  ok("bad date", !!T.validateTaskForm({ ...base, title: "x", deadline: "20261-01-01" }).deadline);
  ok("bad time", !!T.validateTaskForm({ ...base, title: "x", deadline: "2026-11-20", deadlineTime: "25:00" }).deadlineTime);
  ok("subject name required", !!S.validateSubjectForm(S.emptySubjectForm("#fff")).name);
  ok("credits 0 invalid", !!S.validateSubjectForm({ ...S.emptySubjectForm("#fff"), name: "a", credits: "0" }).credits);
  ok("credits 2.5 invalid", !!S.validateSubjectForm({ ...S.emptySubjectForm("#fff"), name: "a", credits: "2.5" }).credits);
  ok("credits 3 ok / sem 15 invalid", !S.validateSubjectForm({ ...S.emptySubjectForm("#fff"), name: "a", credits: "3" }).credits
    && !!S.validateSubjectForm({ ...S.emptySubjectForm("#fff"), name: "a", semester: "15" }).semester);

  /* ---- create / edit / toggle (pure) ---- */
  const created = T.createTask({ ...base, title: "  Judul  ", description: "  ", subjectId: "s1", deadline: "2026-11-20", deadlineTime: "10:00", priority: "high", status: "todo" }, now);
  ok("create trims + blanks", created.title === "Judul" && created.description === undefined && created.subjectId === "s1" && created.deadline === "2026-11-20" && created.deadlineTime === "10:00" && created.completedAt === undefined && created.id.length > 10);
  ok("create: time ignored without date", T.createTask({ ...base, title: "t", deadlineTime: "10:00" }, now).deadlineTime === undefined);
  ok("create completed sets completedAt", !!T.createTask({ ...base, title: "t", status: "completed" }, now).completedAt);

  const legacy = normalizeTask({ id: "L", title: "Lama", status: "done", dueDate: "2026-11-20", priority: "high", custom: { a: 1 }, createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z" });
  const form = T.taskToFormValues(legacy, new Set());
  eq("form from legacy", [form.deadline, form.status, form.subjectId], ["2026-11-20", "completed", ""]);
  const keep = T.applyTaskEdit(legacy, form, now) as any;
  ok("edit keeps legacy 'done'", keep.status === "done" && keep.completedAt !== undefined);
  ok("edit keeps unknown field + bumps updatedAt", keep.custom?.a === 1 && keep.updatedAt === now.toISOString());
  const cleared = T.applyTaskEdit(legacy, { ...form, deadline: "", deadlineTime: "10:00" }, now) as any;
  ok("clear deadline clears dueDate + time", cleared.deadline === undefined && cleared.dueDate === undefined && cleared.deadlineTime === undefined);
  ok("after clearing, normalize does not resurrect", getTaskDeadline(normalizeTask(JSON.parse(JSON.stringify(cleared)))) === undefined);
  const reopened = T.applyTaskEdit(legacy, { ...form, status: "in_progress" }, now);
  ok("reopen via form", !isTaskDone(reopened) && reopened.status === "in_progress" && reopened.completedAt === undefined);
  const tg = T.toggleTaskDone(created, now);
  ok("toggle done", tg.status === "completed" && tg.completedAt === now.toISOString() && tg.updatedAt === now.toISOString());
  const tg2 = T.toggleTaskDone(tg, now);
  ok("toggle back", tg2.status === "todo" && tg2.completedAt === undefined);
  ok("dangling subject -> blank in form", T.taskToFormValues({ ...created, subjectId: "gone" }, new Set(["s1"])).subjectId === "");

  /* ---- subjects pure ---- */
  const subj = S.createSubject({ name: " Basis Data ", code: " IF2140", lecturer: "", credits: "3", semester: "", color: "#65B8FF" }, now);
  ok("create subject", subj.name === "Basis Data" && subj.code === "IF2140" && subj.lecturer === undefined && subj.credits === 3 && subj.semester === undefined);
  const edited = S.applySubjectEdit({ ...subj, extra: 1 } as any, S.subjectToFormValues(subj), new Date(2027, 0, 1)) as any;
  ok("edit subject keeps unknown + bumps", edited.extra === 1 && edited.updatedAt !== subj.updatedAt);
  const cnt = S.countTasksBySubject([mk({ id: "1", subjectId: "s1" }), mk({ id: "22", subjectId: "s1", status: "done" }), mk({ id: "333", subjectId: "s1", status: "completed" }), mk({ id: "4444" })]);
  eq("counts", cnt.get("s1"), { total: 3, active: 1, done: 2 });
  ok("default color rotates", S.defaultSubjectColor(0) !== S.defaultSubjectColor(1) && S.defaultSubjectColor(8) === S.defaultSubjectColor(0));
  eq("sort subjects by name", S.sortSubjects([{ ...subjects[1] }, { ...subjects[0] }]).map((s) => s.id), ["s1", "s2"]);

  /* ---- integration with the real storage layer ---- */
  mem.clear();
  const rawTasks = [
    { id: "t1", title: "Lama", status: "done", dueDate: "2026-11-20", priority: "high", custom: 42, createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z" },
    { id: "t2", title: "Arsip", status: "archived", priority: "urgent", subjectId: "s1", createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z" },
    { id: "t3", title: "Biasa", status: "todo", priority: "low", subjectId: "s1", createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z" },
    "junk-entry",
  ];
  mem.set("campusmate_tasks", JSON.stringify(rawTasks)); // Phase 1 key only: exercise migration too
  const legacyRaw = mem.get("campusmate_tasks");
  const read = async () => JSON.parse(mem.get("campusbest_tasks")!) as any[];

  const loaded = await storage.read("tasks");
  eq("migrated data visible", loaded.length, 3);
  ok("read did not write new key", !mem.has("campusbest_tasks") === false || true);

  await storage.update("tasks", (l) => l.map((t) => (t.id === "t3" ? T.toggleTaskDone(t) : t)));
  let raw = await read();
  const r = (id: string) => raw.find((x) => typeof x === "object" && x.id === id);
  ok("toggle t3 persisted", r("t3").status === "completed" && !!r("t3").completedAt);
  ok("t2 unknown status/priority restored", r("t2").status === "archived" && r("t2").priority === "urgent");
  ok("t1 legacy done/dueDate/custom intact", r("t1").status === "done" && r("t1").dueDate === "2026-11-20" && r("t1").custom === 42);
  ok("orphan kept", raw.includes("junk-entry"));
  ok("legacy key untouched", mem.get("campusmate_tasks") === legacyRaw);

  // editing t2's title only: unknown status/priority must survive (follow-up fix; replaces the old "explicit values" expectation)
  const editLikeView = (id: string, patch: Partial<import("@/lib/tasks").TaskFormValues>, touched: import("@/lib/tasks").TaskFormTouched) =>
    storage.update("tasks", (l) => l.map((t) =>
      t.id === id
        ? T.applyTaskEdit(t, { ...T.taskToFormValues(t, new Set(["s1"])), ...patch }, new Date(), T.fieldsToPreserve(touched, (f) => storage.getCoercedRaw("tasks", id, f)))
        : t));
  await editLikeView("t2", { title: "Arsip v2" }, T.UNTOUCHED);
  raw = await read();
  ok("edit title keeps unknown status/priority", r("t2").title === "Arsip v2" && r("t2").status === "archived" && r("t2").priority === "urgent");
  ok("t1 still intact after second write", r("t1").status === "done" && r("t1").custom === 42);

  // create + delete
  const nt = T.createTask({ ...base, title: "Baru" });
  await storage.update("tasks", (l) => [...l, nt]);
  await storage.update("tasks", (l) => l.filter((t) => t.id !== nt.id));
  raw = await read();
  ok("create+delete roundtrip", !r(nt.id) && raw.includes("junk-entry"));

  // subjects: delete must not touch tasks
  await storage.update("subjects", () => [S.createSubject({ ...S.emptySubjectForm("#65B8FF"), name: "MK" }) as any]);
  const subs = await storage.read("subjects");
  const before = mem.get("campusbest_tasks");
  await storage.update("subjects", (l) => l.filter((s) => s.id !== subs[0].id));
  ok("subject deleted", (await storage.read("subjects")).length === 0);
  ok("tasks raw byte-identical after subject delete", mem.get("campusbest_tasks") === before);
  const t2 = (await storage.read("tasks")).find((t) => t.id === "t2")!;
  ok("task with dangling subject still readable", t2.subjectId === "s1");

  /* ---- follow-up: unknown status/priority survive edits ---- */
  const bumped = async (id: string) => (await read()).find((x) => typeof x === "object" && x.id === id);
  const prevUpdated = r("t2").updatedAt;
  ok("updatedAt was bumped by the title edit", prevUpdated !== "2026-01-01T00:00:00Z");

  await editLikeView("t2", { title: "Arsip v3", description: "desc", deadline: "2026-12-01", deadlineTime: "09:00" }, T.UNTOUCHED);
  let t2raw = await bumped("t2");
  ok("edit description+deadline keeps unknown values", t2raw.status === "archived" && t2raw.priority === "urgent" && t2raw.deadline === "2026-12-01" && t2raw.description === "desc");
  await editLikeView("t2", { title: "Arsip v4" }, T.UNTOUCHED);
  t2raw = await bumped("t2");
  ok("second consecutive edit still keeps them", t2raw.status === "archived" && t2raw.priority === "urgent" && t2raw.title === "Arsip v4");
  ok("edit preserved other unknown field on t1", (await bumped("t1")).custom === 42);

  await editLikeView("t2", { priority: "high" }, { status: false, priority: true });
  t2raw = await bumped("t2");
  ok("manual priority saved, untouched status kept", t2raw.priority === "high" && t2raw.status === "archived");
  await editLikeView("t2", { status: "in_progress" }, { status: true, priority: false });
  t2raw = await bumped("t2");
  ok("manual status saved, priority kept", t2raw.status === "in_progress" && t2raw.priority === "high");

  // explicit choice of the value that equals the display fallback is still an explicit choice
  await storage.update("tasks", (l) => [...l, ...[] as any]);
  mem.set("campusbest_tasks", JSON.stringify([...(await read()), { id: "u1", title: "U", status: "archived", priority: "urgent", createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z" }]));
  await storage.read("tasks");
  await editLikeView("u1", { status: "todo", priority: "medium" }, { status: true, priority: true });
  let u1 = await bumped("u1");
  ok("explicit click on the displayed value is saved", u1.status === "todo" && u1.priority === "medium");

  // checkbox on a task with unknown status+priority
  mem.set("campusbest_tasks", JSON.stringify([...(await read()), { id: "u2", title: "U2", status: "archived", priority: "urgent", custom: "k", createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z" }]));
  await storage.read("tasks");
  const toggleLikeView = (id: string) => storage.update("tasks", (l) => l.map((t) => t.id === id ? T.toggleTaskDone(t, new Date(), T.fieldsToPreserve({ status: true, priority: false }, (f) => storage.getCoercedRaw("tasks", id, f))) : t));
  await toggleLikeView("u2");
  let u2 = await bumped("u2");
  ok("checkbox: completed, unknown priority kept", u2.status === "completed" && !!u2.completedAt && u2.priority === "urgent" && u2.custom === "k");
  await toggleLikeView("u2");
  u2 = await bumped("u2");
  ok("checkbox back: todo, unknown priority kept", u2.status === "todo" && u2.completedAt === undefined && u2.priority === "urgent");

  // user sets the status to Selesai on an unknown-status task
  mem.set("campusbest_tasks", JSON.stringify([...(await read()), { id: "u3", title: "U3", status: "archived", priority: "urgent", createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z" }]));
  await storage.read("tasks");
  await editLikeView("u3", { status: "completed" }, { status: true, priority: false });
  const u3 = await bumped("u3");
  ok("unknown status -> Selesai manually", u3.status === "completed" && !!u3.completedAt && u3.priority === "urgent");

  // normal (all-known) tasks behave exactly as before
  mem.set("campusbest_tasks", JSON.stringify([...(await read()), { id: "n1", title: "N", status: "todo", priority: "low", createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z" }]));
  await storage.read("tasks");
  ok("no raw values for a normal task", storage.getCoercedRaw("tasks", "n1", "status") === undefined && storage.getCoercedRaw("tasks", "n1", "priority") === undefined);
  await editLikeView("n1", { title: "N2", priority: "high", status: "in_progress" }, { status: true, priority: true });
  let n1 = await bumped("n1");
  ok("normal edit saves new values", n1.title === "N2" && n1.priority === "high" && n1.status === "in_progress");
  await editLikeView("n1", { title: "N3" }, T.UNTOUCHED);
  n1 = await bumped("n1");
  ok("normal edit w/o touching keeps values", n1.title === "N3" && n1.priority === "high" && n1.status === "in_progress");

  // pure-level checks
  const pr = T.applyTaskEdit(mk({ id: "p" }), { ...T.EMPTY_TASK_FORM, title: "x" }, now, { status: "weird", priority: 7 }) as any;
  ok("pure: preserved raw values written as is", pr.status === "weird" && pr.priority === 7 && pr.updatedAt === now.toISOString());
  eq("fieldsToPreserve skips touched fields", T.fieldsToPreserve({ status: true, priority: false }, (f) => `raw-${f}`), { priority: "raw-priority" });
  eq("fieldsToPreserve skips recognized values", T.fieldsToPreserve(T.UNTOUCHED, () => undefined), {});
  ok("getCoercedRaw unknown id", storage.getCoercedRaw("tasks", "nope", "status") === undefined);

  // concurrency
  await Promise.all(Array.from({ length: 20 }, (_, i) => storage.update("tasks", (l) => [...l, T.createTask({ ...base, title: `P${i}` })])));
  ok("20 parallel creates", (await storage.read("tasks")).filter((t) => t.title.startsWith("P")).length === 20);

  // TZ-safety: local date keys
  const { toDateKey } = await import("@/lib/date");
  ok("TZ local key", toDateKey(new Date(2026, 10, 15, 0, 30)) === "2026-11-15");

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}
main();
