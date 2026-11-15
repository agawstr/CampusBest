import type { Subject, Task } from "@/types";
import { isValidTime, parseDateKey } from "../date";
import { createTask, type TaskFormStatus } from "../tasks";
import { findDuplicates, subjectIdentity, type DupCandidate, type DupInfo } from "./duplicates";
import { matchSubject } from "./subjects";
import { nameKey, safeUrl } from "./text";
import type { ImportSourceKey, TaskDraft } from "./types";

/**
 * What the user does with the subject of one item:
 *  - existing:   link to a Subject that already exists
 *  - new:        create a Subject named like the source name (one per distinct name, never a duplicate)
 *  - none:       no subject
 *  - unresolved: the app isn't sure (a similar or ambiguous match); the user must choose before importing
 */
export type SubjectChoice =
  | { kind: "existing"; subjectId: string }
  | { kind: "new" }
  | { kind: "none" }
  | { kind: "unresolved"; hint?: string };

export type DupAction = "skip" | "import";

export interface ImportItem {
  key: string;
  included: boolean;
  title: string;
  /** Subject name as the source wrote it (also the name of the Subject that "new" would create). */
  sourceSubject: string;
  subject: SubjectChoice;
  deadline: string;
  deadlineTime: string;
  url: string;
  /** Status the source showed ("Turned in"). Read-only information. */
  sourceStatus: string;
  /** The Task status to import with. Starts as "todo" whatever the source says. */
  status: TaskFormStatus;
  warnings: string[];
  /** What to do when this item is a duplicate. Starts as "skip". */
  dupAction: DupAction;
}

/** Turns what the parser read into preview items, matching subjects without ever creating anything. */
export function buildItems(drafts: readonly TaskDraft[], subjects: readonly Subject[]): ImportItem[] {
  return drafts.map((d, i) => {
    let subject: SubjectChoice = { kind: "none" };
    if (d.subjectName.trim()) {
      const match = matchSubject(d.subjectName, subjects);
      if (match.kind === "exact") subject = { kind: "existing", subjectId: match.subject.id };
      else if (match.kind === "similar") subject = { kind: "unresolved", hint: `Mirip dengan "${match.candidates[0].name}"` };
      else if (match.kind === "ambiguous") subject = { kind: "unresolved", hint: "Ada lebih dari satu mata kuliah yang cocok" };
      else subject = { kind: "new" };
    }
    return {
      key: `item-${i}`, included: true, title: d.title, sourceSubject: d.subjectName.trim(), subject,
      deadline: d.deadline, deadlineTime: d.deadlineTime, url: d.url, sourceStatus: d.sourceStatus,
      status: "todo", warnings: d.warnings, dupAction: "skip",
    };
  });
}

/* ---------------- validation ---------------- */

export type ItemErrors = Partial<Record<"title" | "deadline" | "deadlineTime" | "url" | "subject", string>>;

export function validateItem(item: ImportItem, subjects: readonly Subject[]): ItemErrors {
  const e: ItemErrors = {};
  if (!item.title.trim()) e.title = "Judul tugas wajib diisi.";
  if (item.deadline.trim() && !parseDateKey(item.deadline.trim())) e.deadline = "Tanggal deadline tidak valid.";
  if (item.deadlineTime.trim()) {
    if (!isValidTime(item.deadlineTime.trim())) e.deadlineTime = "Jam deadline tidak valid.";
    else if (!item.deadline.trim()) e.deadlineTime = "Jam butuh tanggal. Isi tanggalnya dulu.";
  }
  if (item.url.trim() && !safeUrl(item.url.trim())) e.url = "URL harus diawali http:// atau https://.";
  if (item.subject.kind === "unresolved") e.subject = "Pilih mata kuliahnya dulu.";
  if (item.subject.kind === "existing") {
    const id = item.subject.subjectId;
    if (!subjects.some((s) => s.id === id)) e.subject = "Mata kuliah ini sudah tidak ada. Pilih yang lain.";
  }
  if (item.subject.kind === "new" && !item.sourceSubject.trim()) e.subject = "Nama mata kuliah baru belum ada.";
  return e;
}

export const hasErrors = (e: ItemErrors) => Object.keys(e).length > 0;

/* ---------------- duplicates ---------------- */

export function candidateOf(item: ImportItem): DupCandidate {
  const subject =
    item.subject.kind === "existing" ? subjectIdentity.existing(item.subject.subjectId)
    : item.subject.kind === "none" ? subjectIdentity.none
    : subjectIdentity.pending(item.sourceSubject);
  return {
    title: item.title.trim(), url: item.url.trim(), deadline: item.deadline.trim(),
    deadlineTime: item.deadline.trim() ? item.deadlineTime.trim() : "", subject,
  };
}

export function detectDuplicates(items: readonly ImportItem[], tasks: readonly Task[]): Map<string, DupInfo> {
  return findDuplicates(items.map((i) => ({ key: i.key, included: i.included, candidate: candidateOf(i) })), tasks);
}

/* ---------------- what will actually be imported ---------------- */

export interface ItemState {
  item: ImportItem;
  errors: ItemErrors;
  dup?: DupInfo;
  /** included, valid, and not a duplicate that is being skipped */
  ready: boolean;
}

export function evaluate(items: readonly ImportItem[], tasks: readonly Task[], subjects: readonly Subject[]): ItemState[] {
  const dups = detectDuplicates(items, tasks);
  return items.map((item) => {
    const errors = validateItem(item, subjects);
    const dup = dups.get(item.key);
    const skipped = dup !== undefined && item.dupAction === "skip";
    return { item, errors, dup, ready: item.included && !hasErrors(errors) && !skipped };
  });
}

export interface ImportSummary {
  total: number;
  ready: number;
  skippedDuplicates: number;
  excluded: number;
  needsFixing: number;
  newSubjects: number;
}

export function summarize(states: readonly ItemState[]): ImportSummary {
  const readyStates = states.filter((s) => s.ready);
  const newNames = new Set(readyStates.filter((s) => s.item.subject.kind === "new").map((s) => s.item.sourceSubject.trim().toLowerCase()));
  return {
    total: states.length,
    ready: readyStates.length,
    skippedDuplicates: states.filter((s) => s.item.included && s.dup && s.item.dupAction === "skip").length,
    excluded: states.filter((s) => !s.item.included).length,
    needsFixing: states.filter((s) => s.item.included && hasErrors(s.errors)).length,
    newSubjects: newNames.size,
  };
}

/* ---------------- to Task ---------------- */

/**
 * The task for one ready item, made by the same createTask() the Tasks form uses, plus the two import fields.
 * Date and time are copied as text: no Date object, no time zone, no shifting.
 */
export function itemToTask(item: ImportItem, subjectId: string | undefined, source: ImportSourceKey, now: Date = new Date()): Task {
  const base = createTask({
    title: item.title, description: "", subjectId: subjectId ?? "",
    deadline: item.deadline.trim(), deadlineTime: item.deadlineTime.trim(), priority: "medium", status: item.status,
  }, now);
  const url = safeUrl(item.url.trim());
  const task: Task = { ...base, importSource: source };
  if (url) task.url = url;
  return task;
}

/* ---------------- select <-> choice (used by the subject dropdowns) ---------------- */

export const CHOICE_NEW = "__new";
export const CHOICE_NONE = "__none";
export const CHOICE_MIXED = "__mixed";

/** "" = unresolved, "__new", "__none", or the subject id. */
export function choiceToValue(choice: SubjectChoice): string {
  switch (choice.kind) {
    case "existing": return choice.subjectId;
    case "new": return CHOICE_NEW;
    case "none": return CHOICE_NONE;
    default: return "";
  }
}

export function choiceFromValue(value: string): SubjectChoice {
  if (value === CHOICE_NEW) return { kind: "new" };
  if (value === CHOICE_NONE) return { kind: "none" };
  if (value === "") return { kind: "unresolved" };
  return { kind: "existing", subjectId: value };
}

export interface SubjectGroup {
  /** nameKey of the source name; the group id. */
  id: string;
  name: string;
  count: number;
  /** Shared choice value of the group's items, or CHOICE_MIXED when they differ. */
  value: string;
  hint?: string;
}

/** Items that came with the same subject name from the source, so the user can decide once for all of them. */
export function groupSubjects(items: readonly ImportItem[]): SubjectGroup[] {
  const map = new Map<string, SubjectGroup>();
  for (const item of items) {
    const name = item.sourceSubject.trim();
    if (!name) continue;
    const id = nameKey(name);
    const value = choiceToValue(item.subject);
    const hint = item.subject.kind === "unresolved" ? item.subject.hint : undefined;
    const g = map.get(id);
    if (!g) map.set(id, { id, name, count: 1, value, hint });
    else { g.count++; if (g.value !== value) g.value = CHOICE_MIXED; if (!g.hint && hint) g.hint = hint; }
  }
  return [...map.values()];
}
