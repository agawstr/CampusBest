import type { ScheduleItem, ScheduleMode, ScheduleRecurrence, Subject } from "@/types";
import {
  addDays, diffInDays, formatDateID, isValidTime, parseDateKey, timeToMinutes, toDateKey,
} from "./date";
import { generateId } from "./id";

type Day = ScheduleItem["dayOfWeek"];

/* ---------------- which dates a schedule item falls on ---------------- */

/** Weekday (0 = Sunday) of a date key, or null when the key is malformed. */
export function weekdayOf(dateKey: string): Day | null {
  const d = parseDateKey(dateKey);
  return d ? (d.getDay() as Day) : null;
}

/**
 * Rules (the only place they live):
 *  - none:     exactly `date`. Without a valid date it never occurs (see needsDate()).
 *  - biweekly: every 14 days counting from the anchor `date`, never before it. The weekday is the
 *              anchor's weekday, so an old `dayOfWeek` that disagrees with the anchor can't shift it.
 *  - weekly:   every week on `dayOfWeek`. Unknown recurrence values are shown as weekly too,
 *              matching how normalization displays them.
 */
export function occursOn(item: ScheduleItem, dateKey: string): boolean {
  const day = parseDateKey(dateKey);
  if (!day) return false;
  switch (item.recurrence) {
    case "none":
      return item.date === dateKey && parseDateKey(item.date) !== null;
    case "biweekly": {
      if (!item.date) return false;
      const diff = diffInDays(item.date, dateKey);
      if (diff === null || diff < 0) return false;
      return diff % 14 === 0;
    }
    default:
      return day.getDay() === item.dayOfWeek;
  }
}

/** "none" and "biweekly" can't be placed without a usable date. They are listed separately so they can be fixed. */
export function needsDate(item: ScheduleItem): boolean {
  return (item.recurrence === "none" || item.recurrence === "biweekly") && !(item.date && parseDateKey(item.date));
}

export function compareSchedule(a: ScheduleItem, b: ScheduleItem): number {
  const sa = timeToMinutes(a.startTime) ?? 0;
  const sb = timeToMinutes(b.startTime) ?? 0;
  if (sa !== sb) return sa - sb;
  const ea = timeToMinutes(a.endTime) ?? 0;
  const eb = timeToMinutes(b.endTime) ?? 0;
  if (ea !== eb) return ea - eb;
  return a.createdAt.localeCompare(b.createdAt);
}

/** Items that happen on `dateKey`, earliest first. Does not mutate the input. */
export function scheduleOnDate(items: readonly ScheduleItem[], dateKey: string): ScheduleItem[] {
  return items.filter((item) => occursOn(item, dateKey)).sort(compareSchedule);
}

export interface WeekDay { key: string; date: Date; items: ScheduleItem[] }

/** Seven consecutive days from `weekStart` (a local date), each with its sessions. */
export function buildWeek(items: readonly ScheduleItem[], weekStart: Date): WeekDay[] {
  return Array.from({ length: 7 }, (_, i) => {
    const date = addDays(weekStart, i);
    const key = toDateKey(date);
    return { key, date, items: scheduleOnDate(items, key) };
  });
}

/** First date on or after `from` whose weekday is `dayOfWeek`. */
export function nextDateForWeekday(dayOfWeek: number, from: Date): string {
  const offset = (dayOfWeek - from.getDay() + 7) % 7;
  return toDateKey(addDays(from, offset));
}

/* ---------------- labels ---------------- */

/** "10 - 16 November 2026", "27 Okt - 2 Nov 2026" or, across years, with both years. */
export function formatWeekRange(weekStart: Date): string {
  const end = addDays(weekStart, 6);
  if (weekStart.getFullYear() !== end.getFullYear()) {
    const f = { day: "numeric", month: "short", year: "numeric" } as const;
    return `${formatDateID(weekStart, f)} - ${formatDateID(end, f)}`;
  }
  if (weekStart.getMonth() !== end.getMonth()) {
    return `${formatDateID(weekStart, { day: "numeric", month: "short" })} - ${formatDateID(end, { day: "numeric", month: "short", year: "numeric" })}`;
  }
  return `${weekStart.getDate()} - ${formatDateID(end, { day: "numeric", month: "long", year: "numeric" })}`;
}

export function timeRange(item: Pick<ScheduleItem, "startTime" | "endTime">): string {
  return `${item.startTime} - ${item.endTime}`;
}

export function recurrenceNote(item: ScheduleItem): string | null {
  if (item.recurrence === "none") return "Sekali saja";
  if (item.recurrence === "biweekly") return "Dua minggu sekali";
  return null;
}

export function subjectTitle(subject: Subject | undefined): string {
  return subject ? subject.name : "Mata kuliah dihapus";
}

/* ---------------- form <-> record ---------------- */

export interface ScheduleFormValues {
  subjectId: string;
  recurrence: ScheduleRecurrence;
  /** Used by weekly. */
  dayOfWeek: Day;
  /** Used by none (the date) and biweekly (the first session). */
  date: string;
  startTime: string;
  endTime: string;
  room: string;
  mode: ScheduleMode;
}

export function emptyScheduleForm(now: Date = new Date()): ScheduleFormValues {
  return {
    subjectId: "", recurrence: "weekly", dayOfWeek: now.getDay() as Day, date: "",
    startTime: "08:00", endTime: "09:40", room: "", mode: "offline",
  };
}

/** A subject id that no longer exists is shown as "nothing selected" (the select can't represent it). */
export function scheduleToFormValues(item: ScheduleItem, subjectIds: ReadonlySet<string>): ScheduleFormValues {
  return {
    subjectId: subjectIds.has(item.subjectId) ? item.subjectId : "",
    recurrence: item.recurrence,
    dayOfWeek: item.dayOfWeek,
    date: item.date ?? "",
    startTime: item.startTime,
    endTime: item.endTime,
    room: item.room ?? "",
    mode: item.mode,
  };
}

export type ScheduleFormErrors = Partial<Record<"subjectId" | "date" | "startTime" | "endTime", string>>;

export function validateScheduleForm(values: ScheduleFormValues): ScheduleFormErrors {
  const errors: ScheduleFormErrors = {};
  if (!values.subjectId) errors.subjectId = "Pilih mata kuliah dulu.";
  if (values.recurrence !== "weekly") {
    if (!values.date) errors.date = values.recurrence === "none" ? "Tanggal wajib diisi." : "Tanggal mulai wajib diisi.";
    else if (!parseDateKey(values.date)) errors.date = "Tanggal tidak valid.";
  }
  if (!isValidTime(values.startTime)) errors.startTime = "Jam mulai tidak valid.";
  if (!isValidTime(values.endTime)) errors.endTime = "Jam selesai tidak valid.";
  const start = timeToMinutes(values.startTime);
  const end = timeToMinutes(values.endTime);
  if (!errors.startTime && !errors.endTime && start !== null && end !== null && end <= start) {
    errors.endTime = "Jam selesai harus setelah jam mulai.";
  }
  return errors;
}

const blankToUndefined = (v: string) => (v.trim() === "" ? undefined : v.trim());
const isDated = (r: ScheduleRecurrence) => r === "none" || r === "biweekly";

/** dayOfWeek to store: from the date for dated recurrences (so legacy readers still see the right weekday), else the picked day. */
function dayFor(values: ScheduleFormValues): Day {
  return (isDated(values.recurrence) ? weekdayOf(values.date) ?? values.dayOfWeek : values.dayOfWeek) as Day;
}

export function createSchedule(values: ScheduleFormValues, now: Date = new Date()): ScheduleItem {
  const stamp = now.toISOString();
  return {
    id: generateId(),
    createdAt: stamp,
    updatedAt: stamp,
    subjectId: values.subjectId,
    dayOfWeek: dayFor(values),
    startTime: values.startTime,
    endTime: values.endTime,
    room: blankToUndefined(values.room),
    mode: values.mode,
    recurrence: values.recurrence,
    date: isDated(values.recurrence) ? values.date : undefined,
  };
}

/** Which form controls the user actually clicked or changed, as opposed to merely displayed. */
export interface ScheduleFormTouched { mode: boolean; recurrence: boolean; dayOfWeek: boolean; date: boolean }
export const SCHEDULE_UNTOUCHED: ScheduleFormTouched = { mode: false, recurrence: false, dayOfWeek: false, date: false };

/** Original stored values of enum fields normalization could not recognize, to be written back as they were. */
export interface PreservedScheduleFields { mode?: unknown; recurrence?: unknown; dayOfWeek?: unknown }

/**
 * Which unknown stored values must survive a save. `getRaw` returns the original stored value of a
 * field, or undefined if it was recognized. A touched field is never preserved, so a deliberate choice
 * is saved even when it equals the fallback shown. `dayOfWeek` is also derived from the date and from
 * the recurrence kind, so touching either of those counts as touching it.
 */
export function scheduleFieldsToPreserve(
  touched: ScheduleFormTouched,
  getRaw: (field: "mode" | "recurrence" | "dayOfWeek") => unknown,
): PreservedScheduleFields {
  const out: PreservedScheduleFields = {};
  if (!touched.mode) { const raw = getRaw("mode"); if (raw !== undefined) out.mode = raw; }
  if (!touched.recurrence) { const raw = getRaw("recurrence"); if (raw !== undefined) out.recurrence = raw; }
  if (!touched.dayOfWeek && !touched.date && !touched.recurrence) {
    const raw = getRaw("dayOfWeek");
    if (raw !== undefined) out.dayOfWeek = raw;
  }
  return out;
}

// Unknown values are by definition outside the unions; this is the one place that writes them back on purpose.
const asMode = (v: unknown) => v as ScheduleItem["mode"];
const asRecurrence = (v: unknown) => v as ScheduleItem["recurrence"];
const asDay = (v: unknown) => v as ScheduleItem["dayOfWeek"];

/**
 * Applies a form to the freshest copy of a record. Spreads the old record first so unknown fields
 * survive, and always bumps `updatedAt`. When the recurrence is an unknown stored value the user left
 * alone, `date` is left exactly as stored too, since we don't know what it means.
 */
export function applyScheduleEdit(
  item: ScheduleItem,
  values: ScheduleFormValues,
  now: Date = new Date(),
  preserved: PreservedScheduleFields = {},
): ScheduleItem {
  const keepRecurrence = preserved.recurrence !== undefined;
  return {
    ...item,
    subjectId: values.subjectId,
    startTime: values.startTime,
    endTime: values.endTime,
    room: blankToUndefined(values.room),
    mode: preserved.mode !== undefined ? asMode(preserved.mode) : values.mode,
    recurrence: keepRecurrence ? asRecurrence(preserved.recurrence) : values.recurrence,
    dayOfWeek: preserved.dayOfWeek !== undefined ? asDay(preserved.dayOfWeek) : dayFor(keepRecurrence ? { ...values, recurrence: "weekly" } : values),
    date: keepRecurrence ? item.date : isDated(values.recurrence) ? values.date : undefined,
    updatedAt: now.toISOString(),
  };
}
