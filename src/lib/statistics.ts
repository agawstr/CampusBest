import type { CampusEvent, EventCategory, FocusSession, Subject, Task } from "@/types";
import { isOverdue } from "./dashboard";
import { addDays, formatDateID, parseDateKey, startOfDay, startOfWeek, toDateKey } from "./date";
import { EVENT_CATEGORIES, EVENT_CATEGORY_LABELS, eventTypeFromCategory, getTaskDeadline, isTaskDone } from "./domain";

/**
 * Statistics are computed here from the real collections and nothing else: no storage access, no
 * writes, no sample data. `now` is injected so every rule can be tested.
 *
 * Which date puts an item into a period (7 or 30 days ending today, local time):
 *  - task:    its deadline; a task without a valid deadline uses the day it was created;
 *  - event:   its date;
 *  - session: the local day it started on (same rule as the Dashboard's "Fokus hari ini").
 * An item with no usable date appears only under "Semua". The period counts the past and today, so a
 * deadline later than today is not in "7 hari" or "30 hari" yet.
 */

export type StatsPeriod = "7d" | "30d" | "all";

export const STATS_PERIOD_OPTIONS: readonly { value: StatsPeriod; label: string }[] = [
  { value: "7d", label: "7 hari terakhir" },
  { value: "30d", label: "30 hari terakhir" },
  { value: "all", label: "Semua waktu" },
];

export const NO_SUBJECT_LABEL = "Tanpa mata kuliah";
export const ALL_PERIOD_WEEKS = 12;

export interface StatisticsData {
  tasks: readonly Task[];
  subjects: readonly Subject[];
  events: readonly CampusEvent[];
  focusSessions: readonly FocusSession[];
}

export interface DateWindow { from: string; to: string } // inclusive "YYYY-MM-DD" keys

/** null = no limit ("all"). */
export function periodWindow(period: StatsPeriod, now: Date): DateWindow | null {
  if (period === "all") return null;
  const days = period === "7d" ? 7 : 30;
  return { from: toDateKey(addDays(startOfDay(now), -(days - 1))), to: toDateKey(now) };
}

const inRange = (key: string | undefined, range: DateWindow | null) =>
  range === null ? true : key !== undefined && key >= range.from && key <= range.to;

/* ---------------- date keys per item ---------------- */

function taskDateKey(task: Task): string | undefined {
  const deadline = getTaskDeadline(task);
  if (deadline && parseDateKey(deadline)) return deadline;
  const created = Date.parse(task.createdAt);
  return Number.isFinite(created) ? toDateKey(new Date(created)) : undefined;
}

const eventDateKey = (event: CampusEvent): string | undefined => (parseDateKey(event.date) ? event.date : undefined);

function sessionStartMs(session: FocusSession): number | null {
  const t = Date.parse(session.startedAt);
  return Number.isFinite(t) ? t : null;
}

const sessionDateKey = (session: FocusSession): string | undefined => {
  const t = sessionStartMs(session);
  return t === null ? undefined : toDateKey(new Date(t));
};

/** Minutes really spent. Invalid or non-positive values count as 0 (the session itself is still counted). */
const sessionMinutes = (session: FocusSession) =>
  Number.isFinite(session.durationMinutes) && session.durationMinutes > 0 ? session.durationMinutes : 0;

/* ---------------- model ---------------- */

export interface TaskStats {
  total: number; done: number; open: number; todo: number; inProgress: number; overdue: number; percent: number;
}

export interface SubjectStat {
  /** null = tasks or sessions without a subject (or whose subject no longer exists). */
  subjectId: string | null;
  name: string;
  color?: string;
  tasks: number; doneTasks: number; percent: number; focusMinutes: number;
}

export interface EventStats {
  total: number;
  byCategory: { category: EventCategory; label: string; count: number }[];
  /** Always from today onwards, whatever the period. */
  upcoming: number;
  upcomingExams: number;
}

export interface FocusBucket { key: string; label: string; minutes: number; sessions: number }

export interface FocusStats {
  minutes: number; sessions: number; completed: number; averageMinutes: number; activeDays: number;
  series: FocusBucket[];
  seriesUnit: "day" | "week";
}

export interface StatisticsModel {
  period: StatsPeriod;
  range: DateWindow | null;
  /** Any data at all, ignoring the period. false = first-time empty state. */
  hasData: boolean;
  tasks: TaskStats;
  bySubject: SubjectStat[];
  events: EventStats;
  focus: FocusStats;
}

function taskStats(tasks: readonly Task[], now: Date): TaskStats {
  let done = 0, inProgress = 0, todo = 0, overdue = 0;
  for (const t of tasks) {
    if (isTaskDone(t)) done += 1;
    else if (t.status === "in_progress") inProgress += 1;
    else todo += 1;
    if (isOverdue(t, now)) overdue += 1;
  }
  const total = tasks.length;
  return { total, done, open: total - done, todo, inProgress, overdue, percent: total === 0 ? 0 : Math.round((done / total) * 100) };
}

function subjectStats(tasks: readonly Task[], sessions: readonly FocusSession[], subjects: readonly Subject[]): SubjectStat[] {
  const byId = new Map(subjects.map((s) => [s.id, s]));
  const rows = new Map<string | null, SubjectStat>();
  const row = (rawId: string | undefined): SubjectStat => {
    const id = rawId && byId.has(rawId) ? rawId : null;
    let r = rows.get(id);
    if (!r) {
      const subject = id === null ? undefined : byId.get(id);
      r = { subjectId: id, name: subject ? subject.name : NO_SUBJECT_LABEL, color: subject?.color, tasks: 0, doneTasks: 0, percent: 0, focusMinutes: 0 };
      rows.set(id, r);
    }
    return r;
  };
  for (const t of tasks) {
    const r = row(t.subjectId);
    r.tasks += 1;
    if (isTaskDone(t)) r.doneTasks += 1;
  }
  for (const s of sessions) {
    const minutes = sessionMinutes(s);
    if (minutes > 0) row(s.subjectId).focusMinutes += minutes;
  }
  const out = [...rows.values()].filter((r) => r.tasks > 0 || r.focusMinutes > 0);
  for (const r of out) r.percent = r.tasks === 0 ? 0 : Math.round((r.doneTasks / r.tasks) * 100);
  // Subjects first (most tasks, then most focus time, then name); the "no subject" row always last.
  return out.sort((a, b) => {
    if ((a.subjectId === null) !== (b.subjectId === null)) return a.subjectId === null ? 1 : -1;
    return b.tasks - a.tasks || b.focusMinutes - a.focusMinutes || a.name.localeCompare(b.name, "id");
  });
}

function eventStats(inPeriod: readonly CampusEvent[], all: readonly CampusEvent[], now: Date): EventStats {
  const counts = new Map<EventCategory, number>();
  for (const e of inPeriod) counts.set(e.category, (counts.get(e.category) ?? 0) + 1);
  const byCategory = EVENT_CATEGORIES.filter((c) => (counts.get(c) ?? 0) > 0)
    .map((category) => ({ category, label: EVENT_CATEGORY_LABELS[category], count: counts.get(category) as number }));
  const today = toDateKey(now);
  const upcomingList = all.filter((e) => {
    const key = eventDateKey(e);
    return key !== undefined && key >= today;
  });
  return {
    total: inPeriod.length,
    byCategory,
    upcoming: upcomingList.length,
    upcomingExams: upcomingList.filter((e) => eventTypeFromCategory(e.category) === "exam").length,
  };
}

function focusStats(sessions: readonly FocusSession[], period: StatsPeriod, now: Date, weekStartsOn: 0 | 1): FocusStats {
  let minutes = 0, completed = 0;
  const days = new Set<string>();
  for (const s of sessions) {
    minutes += sessionMinutes(s);
    if (s.completed) completed += 1;
    const key = sessionDateKey(s);
    if (key) days.add(key);
  }

  // Chart buckets: one per day for 7/30 days; for "Semua", the latest ALL_PERIOD_WEEKS weeks.
  const buckets: FocusBucket[] = [];
  const index = new Map<string, FocusBucket>();
  const seriesUnit: "day" | "week" = period === "all" ? "week" : "day";
  if (period === "all") {
    const thisWeek = startOfWeek(now, weekStartsOn);
    for (let i = ALL_PERIOD_WEEKS - 1; i >= 0; i--) {
      const start = addDays(thisWeek, -7 * i);
      buckets.push({ key: toDateKey(start), label: formatDateID(start, { day: "numeric", month: "short" }), minutes: 0, sessions: 0 });
    }
  } else {
    const count = period === "7d" ? 7 : 30;
    const today = startOfDay(now);
    for (let i = count - 1; i >= 0; i--) {
      const day = addDays(today, -i);
      const label = period === "7d" ? formatDateID(day, { weekday: "short" }) : formatDateID(day, { day: "numeric" });
      buckets.push({ key: toDateKey(day), label, minutes: 0, sessions: 0 });
    }
  }
  for (const b of buckets) index.set(b.key, b);
  for (const s of sessions) {
    const dayKey = sessionDateKey(s);
    const day = dayKey ? parseDateKey(dayKey) : null;
    if (!day) continue;
    const bucket = index.get(period === "all" ? toDateKey(startOfWeek(day, weekStartsOn)) : (dayKey as string));
    if (!bucket) continue;
    bucket.sessions += 1;
    bucket.minutes += sessionMinutes(s);
  }

  return {
    minutes,
    sessions: sessions.length,
    completed,
    averageMinutes: sessions.length === 0 ? 0 : Math.round(minutes / sessions.length),
    activeDays: days.size,
    series: buckets,
    seriesUnit,
  };
}

export function buildStatistics(
  data: StatisticsData,
  period: StatsPeriod,
  now: Date,
  weekStartsOn: 0 | 1 = 1,
): StatisticsModel {
  const range = periodWindow(period, now);
  const tasks = data.tasks.filter((t) => inRange(taskDateKey(t), range));
  const events = data.events.filter((e) => inRange(eventDateKey(e), range));
  const sessions = data.focusSessions.filter((s) => inRange(sessionDateKey(s), range));
  return {
    period,
    range,
    hasData: data.tasks.length + data.events.length + data.focusSessions.length > 0,
    tasks: taskStats(tasks, now),
    bySubject: subjectStats(tasks, sessions, data.subjects),
    events: eventStats(events, data.events, now),
    focus: focusStats(sessions, period, now, weekStartsOn),
  };
}
