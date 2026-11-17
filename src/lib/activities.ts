import type { Activity, ActivityCategory, ActivityRecurrence } from "@/types";
import {
  addDays, diffInDays, formatDateID, isValidTime, parseDateKey, timeToMinutes, toDateKey,
} from "./date";
import { ACTIVITY_CATEGORIES, ACTIVITY_CATEGORY_LABELS } from "./domain";
import { generateId } from "./id";
import { weekdayOf } from "./schedule";

/**
 * Kegiatan Lain (di luar kuliah). Pure logic: no storage, no browser, no clock (`now` comes in).
 * Lives in its own collection (`campusbest_activities`) and is deliberately NOT part of Statistics,
 * which is per mata kuliah.
 */

type Day = Activity["dayOfWeek"];

export const MAX_TITLE = 120;
export const MAX_LOCATION = 120;
export const MAX_NOTES = 1000;

/* ---------------- which dates an activity falls on (same rules as class schedules) ---------------- */

/**
 *  - none:     exactly `date`. Without a valid date it never occurs (see activityNeedsDate()).
 *  - biweekly: every 14 days counting from the anchor `date`, never before it; the weekday is the anchor's.
 *  - weekly:   every week on `dayOfWeek`. Unknown recurrence values are shown as weekly, like normalization does.
 * Date arithmetic is on calendar days (diffInDays uses UTC y/m/d), so DST changes and the device time zone
 * can't move an occurrence to another day.
 */
export function activityOccursOn(item: Activity, dateKey: string): boolean {
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

/** "none" and "biweekly" can't be placed without a usable date; they are listed separately so they can be fixed. */
export function activityNeedsDate(item: Activity): boolean {
  return (item.recurrence === "none" || item.recurrence === "biweekly") && !(item.date && parseDateKey(item.date));
}

export function compareActivities(a: Activity, b: Activity): number {
  const sa = timeToMinutes(a.startTime) ?? 0;
  const sb = timeToMinutes(b.startTime) ?? 0;
  if (sa !== sb) return sa - sb;
  const ea = a.endTime ? timeToMinutes(a.endTime) ?? 0 : 0;
  const eb = b.endTime ? timeToMinutes(b.endTime) ?? 0 : 0;
  if (ea !== eb) return ea - eb;
  const t = a.title.localeCompare(b.title, "id", { sensitivity: "base" });
  return t !== 0 ? t : a.createdAt.localeCompare(b.createdAt);
}

/** Activities that happen on `dateKey`, earliest first. Does not mutate the input. */
export function activitiesOnDate(items: readonly Activity[], dateKey: string): Activity[] {
  return items.filter((item) => activityOccursOn(item, dateKey)).sort(compareActivities);
}

export interface ActivityWeekDay { key: string; date: Date; items: Activity[] }

/** Seven consecutive days from `weekStart` (a local date), each with its activities. */
export function buildActivityWeek(items: readonly Activity[], weekStart: Date): ActivityWeekDay[] {
  return Array.from({ length: 7 }, (_, i) => {
    const date = addDays(weekStart, i);
    const key = toDateKey(date);
    return { key, date, items: activitiesOnDate(items, key) };
  });
}

/* ---------------- dashboard: today and the days after ---------------- */

export type ActivityStatus = "upcoming" | "ongoing" | "done";
export interface AgendaActivity {
  /** Date the occurrence falls on ("YYYY-MM-DD"). */
  date: string;
  /** 0 = today, 1 = tomorrow, ... */
  daysFromToday: number;
  item: Activity;
  /** Only meaningful for today; later days are always "upcoming". */
  status: ActivityStatus;
}

/**
 * Starts inclusive, ends exclusive (at exactly the end time it counts as done). Without an end time we can't
 * know when it finishes, so no status is claimed: it stays "upcoming" (the dashboard shows no chip for it).
 */
export function activityStatus(item: Pick<Activity, "startTime" | "endTime">, now: Date): ActivityStatus {
  const end = item.endTime ? timeToMinutes(item.endTime) : null;
  if (end === null) return "upcoming";
  const minutes = now.getHours() * 60 + now.getMinutes();
  const start = timeToMinutes(item.startTime);
  if (minutes >= end) return "done";
  if (start !== null && minutes >= start) return "ongoing";
  return "upcoming";
}

/** Occurrences from today through the next `days - 1` days, in date then time order. */
export function activityAgenda(items: readonly Activity[], now: Date, days = 7): AgendaActivity[] {
  const out: AgendaActivity[] = [];
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  for (let i = 0; i < days; i += 1) {
    const key = toDateKey(addDays(today, i));
    for (const item of activitiesOnDate(items, key)) {
      out.push({ date: key, daysFromToday: i, item, status: i === 0 ? activityStatus(item, now) : "upcoming" });
    }
  }
  return out;
}

/* ---------------- labels ---------------- */

export function categoryLabel(category: ActivityCategory): string {
  return ACTIVITY_CATEGORY_LABELS[category] ?? ACTIVITY_CATEGORY_LABELS.lainnya;
}

export function activityTimeRange(item: Pick<Activity, "startTime" | "endTime">): string {
  return item.endTime ? `${item.startTime} - ${item.endTime}` : item.startTime;
}

export function activityRecurrenceNote(item: Pick<Activity, "recurrence">): string | null {
  if (item.recurrence === "none") return "Sekali saja";
  if (item.recurrence === "biweekly") return "Dua minggu sekali";
  return "Tiap minggu";
}

/** "Olahraga · Lapangan Rektorat" for the calendar/dashboard detail line. */
export function activityDetail(item: Pick<Activity, "category" | "location">): string {
  return [categoryLabel(item.category), item.location].filter(Boolean).join(" · ");
}

export function dayLabelFor(daysFromToday: number, date: string): string {
  if (daysFromToday === 0) return "Hari ini";
  if (daysFromToday === 1) return "Besok";
  return formatDateID(date, { weekday: "long", day: "numeric", month: "short" });
}

/* ---------------- form <-> record ---------------- */

export interface ActivityFormValues {
  title: string;
  category: ActivityCategory;
  recurrence: ActivityRecurrence;
  /** Used by weekly. */
  dayOfWeek: Day;
  /** Used by none (the date) and biweekly (the first occurrence). */
  date: string;
  startTime: string;
  /** "" = no end time. */
  endTime: string;
  location: string;
  notes: string;
}

export function emptyActivityForm(now: Date = new Date()): ActivityFormValues {
  return {
    title: "", category: "organisasi", recurrence: "none", dayOfWeek: now.getDay() as Day,
    date: toDateKey(now), startTime: "16:00", endTime: "", location: "", notes: "",
  };
}

export function activityToFormValues(item: Activity): ActivityFormValues {
  return {
    title: item.title,
    category: item.category,
    recurrence: item.recurrence,
    dayOfWeek: item.dayOfWeek,
    date: item.date ?? "",
    startTime: item.startTime,
    endTime: item.endTime ?? "",
    location: item.location ?? "",
    notes: item.notes ?? "",
  };
}

export type ActivityFormErrors = Partial<Record<"title" | "date" | "startTime" | "endTime" | "location" | "notes", string>>;

export function validateActivityForm(values: ActivityFormValues): ActivityFormErrors {
  const errors: ActivityFormErrors = {};
  const title = values.title.trim();
  if (!title) errors.title = "Judul kegiatan wajib diisi.";
  else if (title.length > MAX_TITLE) errors.title = `Judul maksimal ${MAX_TITLE} karakter.`;
  if (values.location.trim().length > MAX_LOCATION) errors.location = `Lokasi maksimal ${MAX_LOCATION} karakter.`;
  if (values.notes.trim().length > MAX_NOTES) errors.notes = `Catatan maksimal ${MAX_NOTES} karakter.`;
  if (values.recurrence !== "weekly") {
    if (!values.date) errors.date = values.recurrence === "none" ? "Tanggal wajib diisi." : "Tanggal mulai wajib diisi.";
    else if (!parseDateKey(values.date)) errors.date = "Tanggal tidak valid.";
  }
  if (!isValidTime(values.startTime)) errors.startTime = "Jam mulai tidak valid.";
  if (values.endTime !== "") {
    if (!isValidTime(values.endTime)) errors.endTime = "Jam selesai tidak valid.";
    else if (!errors.startTime) {
      const start = timeToMinutes(values.startTime);
      const end = timeToMinutes(values.endTime);
      if (start !== null && end !== null && end <= start) errors.endTime = "Jam selesai harus setelah jam mulai.";
    }
  }
  return errors;
}

const blankToUndefined = (v: string) => (v.trim() === "" ? undefined : v.trim());
const isDated = (r: ActivityRecurrence) => r === "none" || r === "biweekly";

/** dayOfWeek to store: from the date for dated recurrences, else the picked day. */
function dayFor(values: ActivityFormValues): Day {
  return (isDated(values.recurrence) ? weekdayOf(values.date) ?? values.dayOfWeek : values.dayOfWeek) as Day;
}

export function createActivity(values: ActivityFormValues, now: Date = new Date()): Activity {
  const stamp = now.toISOString();
  return {
    id: generateId(),
    createdAt: stamp,
    updatedAt: stamp,
    title: values.title.trim(),
    category: values.category,
    recurrence: values.recurrence,
    dayOfWeek: dayFor(values),
    date: isDated(values.recurrence) ? values.date : undefined,
    startTime: values.startTime,
    endTime: blankToUndefined(values.endTime),
    location: blankToUndefined(values.location),
    notes: blankToUndefined(values.notes),
  };
}

/** Which form controls the user actually changed, as opposed to merely displayed. */
export interface ActivityFormTouched { category: boolean; recurrence: boolean; dayOfWeek: boolean; date: boolean }
export const ACTIVITY_UNTOUCHED: ActivityFormTouched = { category: false, recurrence: false, dayOfWeek: false, date: false };

/** Original stored values of enum fields normalization could not recognize, to be written back as they were. */
export interface PreservedActivityFields { category?: unknown; recurrence?: unknown; dayOfWeek?: unknown }

/** Same idea as scheduleFieldsToPreserve: a touched field is never preserved; dayOfWeek also follows date/recurrence. */
export function activityFieldsToPreserve(
  touched: ActivityFormTouched,
  getRaw: (field: "category" | "recurrence" | "dayOfWeek") => unknown,
): PreservedActivityFields {
  const out: PreservedActivityFields = {};
  if (!touched.category) { const raw = getRaw("category"); if (raw !== undefined) out.category = raw; }
  if (!touched.recurrence) { const raw = getRaw("recurrence"); if (raw !== undefined) out.recurrence = raw; }
  if (!touched.dayOfWeek && !touched.date && !touched.recurrence) {
    const raw = getRaw("dayOfWeek");
    if (raw !== undefined) out.dayOfWeek = raw;
  }
  return out;
}

const asCategory = (v: unknown) => v as Activity["category"];
const asRecurrence = (v: unknown) => v as Activity["recurrence"];
const asDay = (v: unknown) => v as Activity["dayOfWeek"];

/** Applies a form to the freshest copy of a record. Spreads the old record first so unknown fields survive; bumps `updatedAt`. */
export function applyActivityEdit(
  item: Activity,
  values: ActivityFormValues,
  now: Date = new Date(),
  preserved: PreservedActivityFields = {},
): Activity {
  const keepRecurrence = preserved.recurrence !== undefined;
  return {
    ...item,
    title: values.title.trim(),
    category: preserved.category !== undefined ? asCategory(preserved.category) : values.category,
    recurrence: keepRecurrence ? asRecurrence(preserved.recurrence) : values.recurrence,
    dayOfWeek: preserved.dayOfWeek !== undefined ? asDay(preserved.dayOfWeek) : dayFor(keepRecurrence ? { ...values, recurrence: "weekly" } : values),
    date: keepRecurrence ? item.date : isDated(values.recurrence) ? values.date : undefined,
    startTime: values.startTime,
    endTime: blankToUndefined(values.endTime),
    location: blankToUndefined(values.location),
    notes: blankToUndefined(values.notes),
    updatedAt: now.toISOString(),
  };
}

export { ACTIVITY_CATEGORIES };
