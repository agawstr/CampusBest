import type { CampusEvent, EventCategory, Subject } from "@/types";
import { EVENT_CATEGORIES, EVENT_CATEGORY_LABELS, eventTypeFromCategory } from "./domain";
import { daysUntil, formatDateID, isValidTime, parseDateKey, timeToMinutes } from "./date";
import { generateId } from "./id";

/* ---------------- view helpers ---------------- */

export type CategoryFilter = "all" | EventCategory;
export type TimeFilter = "all" | "today" | "week" | "upcoming" | "past";

export interface EventFilters {
  query: string;
  category: CategoryFilter;
  time: TimeFilter;
}

/** The event's date when it is a real calendar date, else undefined (legacy/broken records have none). */
export function eventDate(event: Pick<CampusEvent, "date">): string | undefined {
  return typeof event.date === "string" && parseDateKey(event.date) ? event.date : undefined;
}

/** Days from `now` to the event (0 = today, negative = past). null when it has no usable date. */
export function eventDaysAway(event: Pick<CampusEvent, "date">, now: Date = new Date()): number | null {
  const key = eventDate(event);
  return key ? daysUntil(key, now) : null;
}

function matchesTime(event: CampusEvent, time: TimeFilter, now: Date): boolean {
  if (time === "all") return true;
  const days = eventDaysAway(event, now);
  if (days === null) return false; // undated events only show under "all"
  switch (time) {
    case "today": return days === 0;
    case "week": return days >= 0 && days <= 6; // today + the next 6 days
    case "upcoming": return days >= 0;
    case "past": return days < 0;
  }
}

/** Title, description, location and subject name/code, case-insensitive. */
export function filterEvents(
  events: readonly CampusEvent[],
  subjectsById: ReadonlyMap<string, Subject>,
  { query, category, time }: EventFilters,
  now: Date = new Date(),
): CampusEvent[] {
  const q = query.trim().toLowerCase();
  return events.filter((event) => {
    if (category !== "all" && event.category !== category) return false;
    if (!matchesTime(event, time, now)) return false;
    if (!q) return true;
    const subject = event.subjectId ? subjectsById.get(event.subjectId) : undefined;
    const haystack = [event.title, event.description, event.location, subject?.name, subject?.code]
      .filter((v): v is string => typeof v === "string")
      .join("\n")
      .toLowerCase();
    return haystack.includes(q);
  });
}

const cmp = (a: number, b: number) => (a < b ? -1 : a > b ? 1 : 0);
/** All-day sorts before any timed event on the same date. */
const startMinutes = (e: CampusEvent) => (e.startTime ? timeToMinutes(e.startTime) ?? -1 : -1);

/**
 * "Nearest date first": today and later in ascending order, then past events from the most recent
 * backwards, then events with no usable date. Ties: start time, title, creation time.
 */
export function sortEvents(events: readonly CampusEvent[], now: Date = new Date()): CampusEvent[] {
  const group = (e: CampusEvent) => {
    const days = eventDaysAway(e, now);
    return days === null ? 2 : days >= 0 ? 0 : 1;
  };
  return [...events].sort((a, b) => {
    const ga = group(a);
    const gb = group(b);
    if (ga !== gb) return ga - gb;
    if (ga !== 2) {
      const da = eventDaysAway(a, now) as number;
      const db = eventDaysAway(b, now) as number;
      // upcoming: smaller distance first; past: smaller |distance| (more recent) first
      const byDate = ga === 0 ? cmp(da, db) : cmp(db, da);
      if (byDate) return byDate;
      const byTime = ga === 0 ? cmp(startMinutes(a), startMinutes(b)) : cmp(startMinutes(b), startMinutes(a));
      if (byTime) return byTime;
    }
    return a.title.localeCompare(b.title, "id", { sensitivity: "base" }) || a.createdAt.localeCompare(b.createdAt);
  });
}

export type EventDateTone = "today" | "soon" | "past" | "normal" | "none";
export interface EventDateInfo { label: string; tone: EventDateTone }

/** "Besok · Rab, 18 Nov", "3 hari lalu · Sab, 14 Nov"; "Belum ada tanggal" for broken legacy records. */
export function eventDateInfo(event: CampusEvent, now: Date = new Date()): EventDateInfo {
  const key = eventDate(event);
  const days = eventDaysAway(event, now);
  if (!key || days === null) return { label: "Belum ada tanggal", tone: "none" };
  const date = formatDateID(key, { weekday: "short", day: "numeric", month: "short", year: "numeric" });
  if (days === 0) return { label: `Hari ini · ${date}`, tone: "today" };
  if (days === 1) return { label: `Besok · ${date}`, tone: "soon" };
  if (days === -1) return { label: `Kemarin · ${date}`, tone: "past" };
  if (days > 1) return { label: `${days} hari lagi · ${date}`, tone: days <= 3 ? "soon" : "normal" };
  return { label: `${-days} hari lalu · ${date}`, tone: "past" };
}

export function eventTimeLabel(event: Pick<CampusEvent, "startTime" | "endTime">): string {
  if (event.startTime && event.endTime) return `${event.startTime} - ${event.endTime}`;
  return event.startTime ?? "Seharian";
}

export function categoryLabel(category: EventCategory): string {
  return EVENT_CATEGORY_LABELS[category];
}

/* ---------------- form <-> record ---------------- */

export interface EventFormValues {
  title: string;
  description: string;
  category: EventCategory;
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  subjectId: string;
}

export const EMPTY_EVENT_FORM: EventFormValues = {
  title: "", description: "", category: "lainnya", date: "", startTime: "", endTime: "", location: "", subjectId: "",
};

/** A subject id that no longer exists is shown as "no subject" (the select can't represent it). */
export function eventToFormValues(event: CampusEvent, subjectIds: ReadonlySet<string>): EventFormValues {
  return {
    title: event.title,
    description: event.description ?? "",
    category: (EVENT_CATEGORIES as readonly string[]).includes(event.category) ? event.category : "lainnya",
    date: eventDate(event) ?? "",
    startTime: event.startTime ?? "",
    endTime: event.startTime ? event.endTime ?? "" : "",
    location: event.location ?? "",
    subjectId: event.subjectId && subjectIds.has(event.subjectId) ? event.subjectId : "",
  };
}

export type EventFormErrors = Partial<Record<"title" | "date" | "startTime" | "endTime", string>>;

export function validateEventForm(values: EventFormValues): EventFormErrors {
  const errors: EventFormErrors = {};
  if (!values.title.trim()) errors.title = "Nama event wajib diisi.";
  if (!values.date) errors.date = "Tanggal wajib diisi.";
  else if (!parseDateKey(values.date)) errors.date = "Tanggal tidak valid.";
  if (values.startTime && !isValidTime(values.startTime)) errors.startTime = "Jam mulai tidak valid.";
  if (values.endTime && !isValidTime(values.endTime)) errors.endTime = "Jam selesai tidak valid.";
  if (!errors.startTime && !errors.endTime && values.endTime) {
    const start = timeToMinutes(values.startTime);
    const end = timeToMinutes(values.endTime);
    if (start === null) errors.startTime = "Isi jam mulai dulu kalau ada jam selesai.";
    else if (end !== null && end <= start) errors.endTime = "Jam selesai harus setelah jam mulai.";
  }
  return errors;
}

const blankToUndefined = (v: string) => (v.trim() === "" ? undefined : v.trim());
const timeOrUndefined = (v: string) => (v === "" ? undefined : v);

export function createEvent(values: EventFormValues, now: Date = new Date()): CampusEvent {
  const stamp = now.toISOString();
  const startTime = timeOrUndefined(values.startTime);
  return {
    id: generateId(),
    createdAt: stamp,
    updatedAt: stamp,
    title: values.title.trim(),
    description: blankToUndefined(values.description),
    // `type` is always derived from the category (see domain.eventTypeFromCategory).
    type: eventTypeFromCategory(values.category),
    category: values.category,
    location: blankToUndefined(values.location),
    date: values.date,
    startTime,
    endTime: startTime ? timeOrUndefined(values.endTime) : undefined,
    subjectId: blankToUndefined(values.subjectId),
  };
}

/** Which form controls the user actually changed, as opposed to merely displayed. `type` has no control: it follows `category`. */
export interface EventFormTouched { category: boolean }
export const EVENT_UNTOUCHED: EventFormTouched = { category: false };

/** Original stored values of enum fields normalization could not recognize (e.g. category "hologram", type "party"). */
export interface PreservedEventFields { category?: unknown; type?: unknown }

/**
 * Which unknown stored values must survive a save. `getRaw` returns the original stored value of a
 * field, or undefined if it was recognized. `type` is derived from `category`, so touching the category
 * counts as touching both: neither is preserved and a deliberate choice is saved even when it equals the
 * fallback shown. Leave the category alone and both unknown values are carried over as they were.
 */
export function eventFieldsToPreserve(
  touched: EventFormTouched,
  getRaw: (field: "category" | "type") => unknown,
): PreservedEventFields {
  const out: PreservedEventFields = {};
  if (touched.category) return out;
  const category = getRaw("category");
  if (category !== undefined) out.category = category;
  const type = getRaw("type");
  if (type !== undefined) out.type = type;
  return out;
}

// Unknown values are by definition outside the unions; this is the one place that writes them back on purpose.
const asCategory = (v: unknown) => v as CampusEvent["category"];
const asType = (v: unknown) => v as CampusEvent["type"];

/**
 * Applies a form to the freshest copy of a record. Spreads the old record first so unknown fields
 * survive, and always bumps `updatedAt`.
 *  - category touched: category = the choice, type = derived from it.
 *  - category untouched: category and type stay as stored (unknown ones come back via `preserved`).
 *    A legacy `type` such as "deadline" is therefore not rewritten by an unrelated edit.
 */
export function applyEventEdit(
  event: CampusEvent,
  values: EventFormValues,
  now: Date = new Date(),
  preserved: PreservedEventFields = {},
  touched: EventFormTouched = EVENT_UNTOUCHED,
): CampusEvent {
  const startTime = timeOrUndefined(values.startTime);
  return {
    ...event,
    title: values.title.trim(),
    description: blankToUndefined(values.description),
    category: touched.category ? values.category : preserved.category !== undefined ? asCategory(preserved.category) : event.category,
    type: touched.category ? eventTypeFromCategory(values.category) : preserved.type !== undefined ? asType(preserved.type) : event.type,
    location: blankToUndefined(values.location),
    date: values.date,
    startTime,
    endTime: startTime ? timeOrUndefined(values.endTime) : undefined,
    subjectId: blankToUndefined(values.subjectId),
    updatedAt: now.toISOString(),
  };
}
