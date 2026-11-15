import type { Subject } from "@/types";
import { generateId } from "../id";
import { getStorageAdapter, storage } from "../storage";
import { defaultSubjectColor } from "../subjects";
import { itemToTask, validateItem, hasErrors, type ImportItem } from "./preview";
import { itemToSchedule, scheduleHasErrors, validateScheduleItem, type ScheduleImportItem } from "./schedule-preview";
import { nameKey } from "./text";
import type { ImportSourceKey } from "./types";

/**
 * The only file in Bulk Import that writes. Order matters:
 *  1. new Subjects (one per distinct name; a name that appeared in the meantime is reused, never duplicated),
 *  2. then all Tasks in a single write.
 * So a failure can leave at most some new Subjects behind (harmless, and reused by the next try), never tasks
 * that point at a Subject that doesn't exist. Existing records are never changed or removed.
 */

export class ImportStorageError extends Error {
  constructor(message = "storage unavailable") { super(message); this.name = "ImportStorageError"; }
}

export interface CommitResult {
  tasksAdded: number;
  subjectsAdded: number;
}

/** A blocked LocalStorage skips writes without an error, so check first (same reason as Notes and Focus). */
export function ensureWritable(): void {
  if (!getStorageAdapter().isAvailable()) throw new ImportStorageError();
}

/**
 * `items` must already be the final list (included, valid, duplicates decided). They are validated once more
 * here; nothing is written when any of them is invalid.
 */
export async function commitImport(
  items: readonly ImportItem[],
  source: ImportSourceKey,
  now: Date = new Date(),
): Promise<CommitResult> {
  if (items.length === 0) return { tasksAdded: 0, subjectsAdded: 0 };
  ensureWritable();

  const currentSubjects = await storage.read("subjects");
  if (items.some((i) => hasErrors(validateItem(i, currentSubjects)))) throw new Error("invalid import items");

  // 1. Subjects that need creating, grouped by normalized name.
  const wanted = new Map<string, string>(); // nameKey -> display name (first spelling wins)
  for (const item of items) {
    if (item.subject.kind !== "new") continue;
    const key = nameKey(item.sourceSubject);
    if (key && !wanted.has(key)) wanted.set(key, item.sourceSubject.trim());
  }

  const idByName = new Map<string, string>();
  let subjectsAdded = 0;
  if (wanted.size > 0) {
    await storage.update("subjects", (list) => {
      const next: Subject[] = [...list];
      idByName.clear();
      subjectsAdded = 0;
      for (const [key, name] of wanted) {
        const found = next.find((s) => nameKey(s.name) === key);
        if (found) { idByName.set(key, found.id); continue; }
        const stamp = now.toISOString();
        const created: Subject = { id: generateId(), createdAt: stamp, updatedAt: stamp, name, color: defaultSubjectColor(next.length) };
        next.push(created);
        idByName.set(key, created.id);
        subjectsAdded++;
      }
      return next;
    });
  }

  // 2. Tasks, one write.
  const tasks = items.map((item) => {
    let subjectId: string | undefined;
    if (item.subject.kind === "existing") subjectId = item.subject.subjectId;
    else if (item.subject.kind === "new") subjectId = idByName.get(nameKey(item.sourceSubject));
    return itemToTask(item, subjectId, source, now);
  });
  await storage.update("tasks", (list) => [...list, ...tasks]);

  return { tasksAdded: tasks.length, subjectsAdded };
}

export interface ScheduleCommitResult {
  schedulesAdded: number;
  subjectsAdded: number;
}

/**
 * SIAM lane. Same order and guarantees as commitImport: new Subjects first (name, plus the code and lecturer
 * the source literally had; an existing Subject is never changed), then every Schedule item in a single write.
 * Existing Schedule items are never touched, and every imported item is a new weekly record.
 */
export async function commitScheduleImport(items: readonly ScheduleImportItem[], now: Date = new Date()): Promise<ScheduleCommitResult> {
  if (items.length === 0) return { schedulesAdded: 0, subjectsAdded: 0 };
  ensureWritable();

  const currentSubjects = await storage.read("subjects");
  if (items.some((i) => scheduleHasErrors(validateScheduleItem(i, currentSubjects)))) throw new Error("invalid import items");

  const wanted = new Map<string, { name: string; code: string; lecturer: string }>();
  for (const item of items) {
    if (item.subject.kind !== "new") continue;
    const key = nameKey(item.sourceSubject);
    if (!key) continue;
    const prev = wanted.get(key);
    if (!prev) wanted.set(key, { name: item.sourceSubject.trim(), code: item.subjectCode.trim(), lecturer: item.lecturer.trim() });
    else {
      if (!prev.code && item.subjectCode.trim()) prev.code = item.subjectCode.trim();
      if (!prev.lecturer && item.lecturer.trim()) prev.lecturer = item.lecturer.trim();
    }
  }

  const idByName = new Map<string, string>();
  let subjectsAdded = 0;
  if (wanted.size > 0) {
    await storage.update("subjects", (list) => {
      const next: Subject[] = [...list];
      idByName.clear();
      subjectsAdded = 0;
      for (const [key, w] of wanted) {
        const found = next.find((s) => nameKey(s.name) === key);
        if (found) { idByName.set(key, found.id); continue; }
        const stamp = now.toISOString();
        const created: Subject = { id: generateId(), createdAt: stamp, updatedAt: stamp, name: w.name, color: defaultSubjectColor(next.length) };
        if (w.code) created.code = w.code;
        if (w.lecturer) created.lecturer = w.lecturer;
        next.push(created);
        idByName.set(key, created.id);
        subjectsAdded++;
      }
      return next;
    });
  }

  const schedules = items.map((item) => {
    const subjectId = item.subject.kind === "existing" ? item.subject.subjectId : idByName.get(nameKey(item.sourceSubject));
    if (!subjectId) throw new Error("subject missing");
    return itemToSchedule(item, subjectId, now);
  });
  await storage.update("schedules", (list) => [...list, ...schedules]);
  return { schedulesAdded: schedules.length, subjectsAdded };
}
