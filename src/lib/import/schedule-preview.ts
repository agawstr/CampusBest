import type { ScheduleItem, ScheduleMode, Subject } from "@/types";
import { isValidTime, timeToMinutes } from "../date";
import { createSchedule } from "../schedule";
import { nameKey } from "./text";
import { subjectIdentity } from "./duplicates";
import { isOnlineRoom } from "./siam";
import { matchSubject } from "./subjects";
import { CHOICE_MIXED, choiceToValue, type SubjectChoice } from "./preview";
import type { ScheduleDraft } from "./types";

/**
 * Preview items for the SIAM lane. A Schedule row always needs a Subject, so unlike Tasks there is no
 * "none" choice: a name that matches nothing becomes "new" (created only when the user imports), a doubtful
 * match is "unresolved" and blocks that item until the user chooses.
 */

export type ScheduleDupAction = "skip" | "import";

export interface ScheduleImportItem {
  key: string;
  included: boolean;
  /** Subject name as the source wrote it (also the name a "new" Subject gets). */
  sourceSubject: string;
  /** Code that was literally in the cell, "" otherwise. Used for matching and for a new Subject. */
  subjectCode: string;
  /** Display only: Schedule has no class field. */
  className: string;
  /** Lecturer of a NEW Subject. Never written onto an existing Subject. */
  lecturer: string;
  subject: SubjectChoice;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  room: string;
  mode: ScheduleMode;
  warnings: string[];
  dupAction: ScheduleDupAction;
}

function matchDraft(d: ScheduleDraft, subjects: readonly Subject[]): SubjectChoice {
  let m = matchSubject(d.subjectName, subjects);
  if (m.kind !== "exact" && d.subjectCode) {
    const byCode = matchSubject(d.subjectCode, subjects);
    if (byCode.kind === "exact") m = byCode;
    else if (m.kind === "none" && byCode.kind !== "none") m = byCode;
  }
  switch (m.kind) {
    case "exact": return { kind: "existing", subjectId: m.subject.id };
    case "similar": return { kind: "unresolved", hint: `Mirip dengan "${m.candidates[0].name}"` };
    case "ambiguous": return { kind: "unresolved", hint: "Ada lebih dari satu mata kuliah yang cocok" };
    default: return { kind: "new" };
  }
}

/** Turns what the parser read into preview items, matching subjects without ever creating anything. */
export function buildScheduleItems(drafts: readonly ScheduleDraft[], subjects: readonly Subject[]): ScheduleImportItem[] {
  return drafts.map((d, i) => {
    const online = isOnlineRoom(d.room);
    const warnings = [...d.warnings];
    if (online) warnings.push("Ruangnya kelihatan online, jadi mode diset Online. Ubah kalau salah.");
    return {
      key: `sch-${i}`, included: true, sourceSubject: d.subjectName, subjectCode: d.subjectCode,
      className: d.className, lecturer: d.lecturer, subject: matchDraft(d, subjects),
      dayOfWeek: d.dayOfWeek, startTime: d.startTime, endTime: d.endTime, room: d.room,
      mode: online ? "online" : "offline", warnings, dupAction: "skip",
    };
  });
}

/* ---------------- validation ---------------- */

export type ScheduleItemErrors = Partial<Record<"subject" | "day" | "startTime" | "endTime", string>>;

export function validateScheduleItem(item: ScheduleImportItem, subjects: readonly Subject[]): ScheduleItemErrors {
  const e: ScheduleItemErrors = {};
  if (item.subject.kind === "unresolved") e.subject = "Pilih mata kuliahnya dulu.";
  else if (item.subject.kind === "none") e.subject = "Jadwal butuh mata kuliah.";
  else if (item.subject.kind === "existing") {
    const id = item.subject.subjectId;
    if (!subjects.some((s) => s.id === id)) e.subject = "Mata kuliah ini sudah tidak ada. Pilih yang lain.";
  } else if (item.subject.kind === "new" && !item.sourceSubject.trim()) e.subject = "Nama mata kuliah baru belum ada.";
  if (!Number.isInteger(item.dayOfWeek) || item.dayOfWeek < 0 || item.dayOfWeek > 6) e.day = "Hari tidak valid.";
  if (!isValidTime(item.startTime)) e.startTime = "Jam mulai tidak valid.";
  if (!isValidTime(item.endTime)) e.endTime = "Jam selesai tidak valid.";
  const s = timeToMinutes(item.startTime), en = timeToMinutes(item.endTime);
  if (!e.startTime && !e.endTime && s !== null && en !== null && en <= s) e.endTime = "Jam selesai harus setelah jam mulai.";
  return e;
}

export const scheduleHasErrors = (e: ScheduleItemErrors) => Object.keys(e).length > 0;

/* ---------------- duplicates ---------------- */

export type ScheduleDupInfo =
  | { kind: "existing"; scheduleId: string; label: string }
  | { kind: "batch"; withKey: string; label: string };

function identityOf(item: ScheduleImportItem): string {
  return item.subject.kind === "existing" ? subjectIdentity.existing(item.subject.subjectId)
    : item.subject.kind === "none" ? subjectIdentity.none
    : subjectIdentity.pending(item.sourceSubject);
}

const slotKey = (identity: string, day: number, start: string, end: string) => `${identity}|${day}|${start}|${end}`;

/** Only a session that really repeats every week counts as "the same" as an imported weekly session. */
const isWeekly = (s: ScheduleItem) => s.recurrence !== "none" && s.recurrence !== "biweekly";

/**
 * Same session = same subject, same weekday, same start and end time. Room and class don't matter: the same
 * subject can't be in two places at once. Checked against existing weekly Schedule items and against earlier
 * included items of this batch. Pure: nothing is written.
 */
export function detectScheduleDuplicates(items: readonly ScheduleImportItem[], existing: readonly ScheduleItem[], subjects: readonly Subject[]): Map<string, ScheduleDupInfo> {
  const subjectName = (id: string) => subjects.find((s) => s.id === id)?.name ?? "mata kuliah dihapus";
  const existingBySlot = new Map<string, ScheduleItem>();
  for (const s of existing) {
    if (!isWeekly(s)) continue;
    const k = slotKey(subjectIdentity.existing(s.subjectId), s.dayOfWeek, s.startTime, s.endTime);
    if (!existingBySlot.has(k)) existingBySlot.set(k, s);
  }
  const out = new Map<string, ScheduleDupInfo>();
  const seen = new Map<string, { key: string; label: string }>();
  for (const item of items) {
    const label = `${item.sourceSubject} (${item.startTime}-${item.endTime})`;
    const k = slotKey(identityOf(item), item.dayOfWeek, item.startTime, item.endTime);
    const hit = existingBySlot.get(k);
    if (hit) out.set(item.key, { kind: "existing", scheduleId: hit.id, label: `${subjectName(hit.subjectId)} (${hit.startTime}-${hit.endTime})` });
    else {
      const earlier = seen.get(k);
      if (earlier) out.set(item.key, { kind: "batch", withKey: earlier.key, label: earlier.label });
    }
    if (item.included && !seen.has(k)) seen.set(k, { key: item.key, label });
  }
  return out;
}

/* ---------------- what will actually be imported ---------------- */

export interface ScheduleItemState {
  item: ScheduleImportItem;
  errors: ScheduleItemErrors;
  dup?: ScheduleDupInfo;
  ready: boolean;
}

export function evaluateSchedule(items: readonly ScheduleImportItem[], existing: readonly ScheduleItem[], subjects: readonly Subject[]): ScheduleItemState[] {
  const dups = detectScheduleDuplicates(items, existing, subjects);
  return items.map((item) => {
    const errors = validateScheduleItem(item, subjects);
    const dup = dups.get(item.key);
    const skipped = dup !== undefined && item.dupAction === "skip";
    return { item, errors, dup, ready: item.included && !scheduleHasErrors(errors) && !skipped };
  });
}

export interface ScheduleImportSummary {
  total: number; ready: number; skippedDuplicates: number; excluded: number; needsFixing: number; newSubjects: number;
}

export function summarizeSchedule(states: readonly ScheduleItemState[]): ScheduleImportSummary {
  const readyStates = states.filter((s) => s.ready);
  const newNames = new Set(readyStates.filter((s) => s.item.subject.kind === "new").map((s) => nameKey(s.item.sourceSubject)));
  return {
    total: states.length,
    ready: readyStates.length,
    skippedDuplicates: states.filter((s) => s.item.included && s.dup && s.item.dupAction === "skip").length,
    excluded: states.filter((s) => !s.item.included).length,
    needsFixing: states.filter((s) => s.item.included && scheduleHasErrors(s.errors)).length,
    newSubjects: newNames.size,
  };
}

/** The weekly ScheduleItem for one ready item, made by the same createSchedule() the Schedule form uses. */
export function itemToSchedule(item: ScheduleImportItem, subjectId: string, now: Date = new Date()): ScheduleItem {
  return createSchedule({
    subjectId, recurrence: "weekly", dayOfWeek: item.dayOfWeek as ScheduleItem["dayOfWeek"], date: "",
    startTime: item.startTime, endTime: item.endTime, room: item.room, mode: item.mode,
  }, now);
}

/** Items with the same source subject name, so the user decides once for all of them (same idea as Tasks). */
export interface ScheduleSubjectGroup { id: string; name: string; count: number; value: string; hint?: string }

export function groupScheduleSubjects(items: readonly ScheduleImportItem[]): ScheduleSubjectGroup[] {
  const map = new Map<string, ScheduleSubjectGroup>();
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
