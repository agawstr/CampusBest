import type { Subject, Task } from "@/types";
import { isTaskDone } from "./domain";
import { validateAbbr } from "./course-label";
import { generateId } from "./id";

export const SUBJECT_COLORS = [
  { value: "#65B8FF", label: "Biru" },
  { value: "#7C8CFF", label: "Indigo" },
  { value: "#B38CFF", label: "Ungu" },
  { value: "#FF8FB1", label: "Pink" },
  { value: "#FF8A7A", label: "Koral" },
  { value: "#FFB547", label: "Kuning" },
  { value: "#5CD6A4", label: "Hijau" },
  { value: "#35C9D6", label: "Tosca" },
] as const;

/** Rotates through the palette so consecutive subjects start with different colors. */
export function defaultSubjectColor(existingCount: number): string {
  return SUBJECT_COLORS[existingCount % SUBJECT_COLORS.length].value;
}

export interface SubjectTaskCount { total: number; active: number; done: number }

/** Tasks per subject id. Subjects with no tasks are simply absent from the map. */
export function countTasksBySubject(tasks: readonly Task[]): Map<string, SubjectTaskCount> {
  const map = new Map<string, SubjectTaskCount>();
  for (const task of tasks) {
    if (!task.subjectId) continue;
    const entry = map.get(task.subjectId) ?? { total: 0, active: 0, done: 0 };
    entry.total += 1;
    if (isTaskDone(task)) entry.done += 1;
    else entry.active += 1;
    map.set(task.subjectId, entry);
  }
  return map;
}

export function sortSubjects(subjects: readonly Subject[]): Subject[] {
  return [...subjects].sort((a, b) => a.name.localeCompare(b.name, "id", { sensitivity: "base" }) || a.createdAt.localeCompare(b.createdAt));
}

/* ---------------- form <-> record ---------------- */

export interface SubjectFormValues {
  name: string;
  code: string;
  /** Optional so older callers/forms without the field keep working. */
  abbr?: string;
  lecturer: string;
  credits: string;
  semester: string;
  color: string;
}

export const MAX_CREDITS = 24;
export const MAX_SEMESTER = 14;

export function emptySubjectForm(color: string): SubjectFormValues {
  return { name: "", code: "", abbr: "", lecturer: "", credits: "", semester: "", color };
}

export function subjectToFormValues(subject: Subject): SubjectFormValues {
  return {
    name: subject.name,
    code: subject.code ?? "",
    abbr: subject.abbr ?? "",
    lecturer: subject.lecturer ?? "",
    credits: subject.credits !== undefined ? String(subject.credits) : "",
    semester: subject.semester !== undefined ? String(subject.semester) : "",
    color: subject.color,
  };
}

export type SubjectFormErrors = Partial<Record<"name" | "abbr" | "credits" | "semester", string>>;

function parseOptionalInt(value: string, max: number): { ok: boolean; value?: number } {
  const text = value.trim();
  if (text === "") return { ok: true };
  const n = Number(text);
  return Number.isInteger(n) && n >= 1 && n <= max ? { ok: true, value: n } : { ok: false };
}

export function validateSubjectForm(values: SubjectFormValues): SubjectFormErrors {
  const errors: SubjectFormErrors = {};
  if (!values.name.trim()) errors.name = "Nama mata kuliah wajib diisi.";
  const abbrError = validateAbbr(values.abbr ?? "");
  if (abbrError) errors.abbr = abbrError;
  if (!parseOptionalInt(values.credits, MAX_CREDITS).ok) errors.credits = `SKS berupa angka bulat 1 sampai ${MAX_CREDITS}.`;
  if (!parseOptionalInt(values.semester, MAX_SEMESTER).ok) errors.semester = `Semester berupa angka bulat 1 sampai ${MAX_SEMESTER}.`;
  return errors;
}

const blankToUndefined = (v: string) => (v.trim() === "" ? undefined : v.trim());

function fields(values: SubjectFormValues) {
  return {
    name: values.name.trim(),
    code: blankToUndefined(values.code),
    abbr: blankToUndefined((values.abbr ?? "").replace(/\s+/g, " ")),
    lecturer: blankToUndefined(values.lecturer),
    credits: parseOptionalInt(values.credits, MAX_CREDITS).value,
    semester: parseOptionalInt(values.semester, MAX_SEMESTER).value,
    color: values.color,
  };
}

export function createSubject(values: SubjectFormValues, now: Date = new Date()): Subject {
  const stamp = now.toISOString();
  return { id: generateId(), createdAt: stamp, updatedAt: stamp, ...fields(values) };
}

/** Spreads the old record first (unknown fields survive) and bumps `updatedAt`. */
export function applySubjectEdit(subject: Subject, values: SubjectFormValues, now: Date = new Date()): Subject {
  return { ...subject, ...fields(values), updatedAt: now.toISOString() };
}
