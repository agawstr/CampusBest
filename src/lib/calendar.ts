import type { CampusEvent, ScheduleItem, Subject, Task } from "@/types";
import { EVENT_CATEGORY_LABELS, getTaskDeadline, isTaskDone } from "./domain";
import { addDays, isValidTime, parseDateKey, timeToMinutes, toDateKey } from "./date";
import { scheduleOnDate } from "./schedule";

/**
 * The calendar owns no data. It reads schedules, tasks and events straight from their own
 * collections and turns them into display entries on the fly, so nothing is duplicated or can go stale.
 */
export type CalendarKind = "class" | "task" | "event";

export const CALENDAR_KIND_LABELS: Record<CalendarKind, string> = {
  class: "Kuliah", task: "Deadline tugas", event: "Event",
};

export interface CalendarEntry {
  /** Unique per entry and date (a recurring class has one entry per day it occurs). */
  key: string;
  kind: CalendarKind;
  date: string;
  /** Id of the record in its own collection. */
  sourceId: string;
  title: string;
  /** Subject name, plus a short descriptor such as the room or the location. */
  detail?: string;
  /** Events only: the category as shown to the user ("UTS", "Quiz", ...), so it is recognizable on the calendar. */
  categoryLabel?: string;
  startTime?: string;
  endTime?: string;
  /** Subject color, when the source has a subject. */
  color?: string;
  done?: boolean;
}

export interface CalendarSources {
  schedules: readonly ScheduleItem[];
  tasks: readonly Task[];
  events: readonly CampusEvent[];
  subjects: readonly Subject[];
}

const KIND_ORDER: Record<CalendarKind, number> = { class: 0, event: 1, task: 2 };

/** Timed entries first by start time; untimed ones (all-day) after them. Ties: kind, then title. */
function compareEntries(a: CalendarEntry, b: CalendarEntry): number {
  const ma = a.startTime ? timeToMinutes(a.startTime) ?? 1440 : 1440;
  const mb = b.startTime ? timeToMinutes(b.startTime) ?? 1440 : 1440;
  if (ma !== mb) return ma - mb;
  if (a.kind !== b.kind) return KIND_ORDER[a.kind] - KIND_ORDER[b.kind];
  return a.title.localeCompare(b.title, "id", { sensitivity: "base" });
}

/** Everything that happens on one date, from all three sources. */
export function entriesForDate(dateKey: string, src: CalendarSources): CalendarEntry[] {
  if (!parseDateKey(dateKey)) return [];
  const subjectsById = new Map(src.subjects.map((s) => [s.id, s]));
  const out: CalendarEntry[] = [];

  for (const item of scheduleOnDate(src.schedules, dateKey)) {
    const subject = subjectsById.get(item.subjectId);
    out.push({
      key: `class:${item.id}:${dateKey}`,
      kind: "class",
      date: dateKey,
      sourceId: item.id,
      title: subject ? subject.name : "Mata kuliah dihapus",
      detail: [item.room, item.mode === "online" ? "Online" : null].filter(Boolean).join(" · ") || undefined,
      startTime: item.startTime,
      endTime: item.endTime,
      color: subject?.color,
    });
  }

  for (const task of src.tasks) {
    if (getTaskDeadline(task) !== dateKey) continue;
    const subject = task.subjectId ? subjectsById.get(task.subjectId) : undefined;
    out.push({
      key: `task:${task.id}:${dateKey}`,
      kind: "task",
      date: dateKey,
      sourceId: task.id,
      title: task.title,
      detail: subject?.name,
      // The deadline time is the moment it is due, shown as the entry's time.
      startTime: task.deadlineTime && isValidTime(task.deadlineTime) ? task.deadlineTime : undefined,
      color: subject?.color,
      done: isTaskDone(task),
    });
  }

  for (const event of src.events) {
    if (event.date !== dateKey) continue;
    const subject = event.subjectId ? subjectsById.get(event.subjectId) : undefined;
    out.push({
      key: `event:${event.id}:${dateKey}`,
      kind: "event",
      date: dateKey,
      sourceId: event.id,
      title: event.title,
      categoryLabel: EVENT_CATEGORY_LABELS[event.category],
      detail: [event.location, subject?.name].filter(Boolean).join(" · ") || undefined,
      startTime: event.startTime,
      endTime: event.endTime,
      color: subject?.color,
    });
  }

  return out.sort(compareEntries);
}

/* ---------------- month grid ---------------- */

export interface MonthCell { key: string; day: number; inMonth: boolean }

/** `month` is 0-11. Whole weeks only (4-6 rows), starting on `weekStartsOn`. */
export function monthGrid(year: number, month: number, weekStartsOn: 0 | 1 = 1): MonthCell[] {
  const first = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const lead = (first.getDay() - weekStartsOn + 7) % 7;
  const rows = Math.ceil((lead + daysInMonth) / 7);
  const start = addDays(first, -lead);
  return Array.from({ length: rows * 7 }, (_, i) => {
    const d = addDays(start, i);
    return { key: toDateKey(d), day: d.getDate(), inMonth: d.getMonth() === month && d.getFullYear() === year };
  });
}

export interface YearMonth { year: number; month: number }

/** Moves by whole months, wrapping the year. */
export function shiftMonth({ year, month }: YearMonth, delta: number): YearMonth {
  const d = new Date(year, month + delta, 1);
  return { year: d.getFullYear(), month: d.getMonth() };
}

export function monthOf(dateKey: string): YearMonth | null {
  const d = parseDateKey(dateKey);
  return d ? { year: d.getFullYear(), month: d.getMonth() } : null;
}

/** Entries for every date in the grid (including the greyed days of neighbouring months), by date key. */
export function entriesByDate(cells: readonly MonthCell[], src: CalendarSources): Map<string, CalendarEntry[]> {
  const map = new Map<string, CalendarEntry[]>();
  for (const cell of cells) {
    const list = entriesForDate(cell.key, src);
    if (list.length) map.set(cell.key, list);
  }
  return map;
}

/** Which kinds appear in a list, in a fixed order, for the dots under a day number. */
export function kindsPresent(entries: readonly CalendarEntry[] | undefined): CalendarKind[] {
  if (!entries?.length) return [];
  return (["class", "event", "task"] as const).filter((k) => entries.some((e) => e.kind === k));
}

/** Agenda: only the days of the given month that have something, in date order. */
export function agendaForMonth(
  cells: readonly MonthCell[],
  byDate: ReadonlyMap<string, CalendarEntry[]>,
): { date: string; entries: CalendarEntry[] }[] {
  return cells
    .filter((c) => c.inMonth)
    .map((c) => ({ date: c.key, entries: byDate.get(c.key) ?? [] }))
    .filter((d) => d.entries.length > 0);
}

/** The date to select after moving to another month: today if it is in that month, else the 1st. */
export function defaultSelectionFor(target: YearMonth, todayKey: string): string {
  const t = monthOf(todayKey);
  if (t && t.year === target.year && t.month === target.month) return todayKey;
  return toDateKey(new Date(target.year, target.month, 1));
}
