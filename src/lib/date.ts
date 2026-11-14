/**
 * Local-time date helpers (no dependencies). Dates are stored as "YYYY-MM-DD" keys and times as
 * "HH:mm", both in the user's local time zone. Never use toISOString() for a date key: it is UTC
 * and shifts the day for users ahead of or behind UTC (e.g. WIB, UTC+7).
 */
export const WEEKDAY_LABELS_ID = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"] as const;

const pad = (n: number) => String(n).padStart(2, "0");

export function toDateKey(date: Date = new Date()): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export const todayKey = () => toDateKey();

/** Parses a "YYYY-MM-DD" key as local midnight. Returns null for malformed or impossible dates. */
export function parseDateKey(key: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(y, mo - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== mo - 1 || date.getDate() !== d) return null;
  return date;
}

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** DST-safe: moves the calendar day, not a number of milliseconds. */
export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

/** Whole calendar days from `fromKey` to `toKey` (negative when `toKey` is earlier). null if either is invalid. */
export function diffInDays(fromKey: string, toKey: string): number | null {
  const a = parseDateKey(fromKey);
  const b = parseDateKey(toKey);
  if (!a || !b) return null;
  const utc = (d: Date) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.round((utc(b) - utc(a)) / 86_400_000);
}

/** Days from today until `key` (0 = today, negative = past). */
export function daysUntil(key: string, from: Date = new Date()): number | null {
  return diffInDays(toDateKey(from), key);
}

export function startOfWeek(date: Date, weekStartsOn: 0 | 1 = 1): Date {
  const offset = (date.getDay() - weekStartsOn + 7) % 7;
  return addDays(startOfDay(date), -offset);
}

/** Weekday indexes (0 = Sunday) in display order, e.g. [1,2,3,4,5,6,0] when the week starts on Monday. */
export function weekdayOrder(weekStartsOn: 0 | 1 = 1): number[] {
  return Array.from({ length: 7 }, (_, i) => (weekStartsOn + i) % 7);
}

export function isValidTime(value: unknown): value is string {
  return typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

/** "HH:mm" -> minutes since midnight, or null if invalid. */
export function timeToMinutes(value: string): number | null {
  if (!isValidTime(value)) return null;
  return Number(value.slice(0, 2)) * 60 + Number(value.slice(3));
}

/** Combines a date key and an optional "HH:mm" (default 23:59, i.e. end of that day) into a local Date. */
export function toDateTime(dateKey: string, time?: string): Date | null {
  const day = parseDateKey(dateKey);
  if (!day) return null;
  const minutes = time && isValidTime(time) ? (timeToMinutes(time) as number) : 23 * 60 + 59;
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), Math.floor(minutes / 60), minutes % 60);
}

export function formatDateID(value: Date | string, options: Intl.DateTimeFormatOptions = { day: "numeric", month: "long", year: "numeric" }): string {
  const date = typeof value === "string" ? parseDateKey(value) : value;
  return date ? new Intl.DateTimeFormat("id-ID", options).format(date) : "";
}
