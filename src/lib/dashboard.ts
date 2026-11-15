import type { CampusEvent, ScheduleItem, Subject, Task } from "@/types";
import { isTaskDone } from "./domain";
import { formatDateID, timeToMinutes, toDateKey } from "./date";
import { filterEvents, sortEvents } from "./events";
import { scheduleOnDate } from "./schedule";
import { deadlineInfo, sortTasks } from "./tasks";

/**
 * Everything the dashboard shows is computed here from the real collections, using the rules the
 * feature libraries already own (sortTasks/deadlineInfo, scheduleOnDate, filterEvents/sortEvents).
 * Nothing is stored and nothing is written. `now` is injected so every rule can be tested.
 */

export interface DashboardData {
  tasks: readonly Task[];
  subjects: readonly Subject[];
  schedules: readonly ScheduleItem[];
  events: readonly CampusEvent[];
}

/* ---------------- greeting ---------------- */

/** 04:00-10:59 pagi, 11:00-14:59 siang, 15:00-17:59 sore, otherwise malam. */
export function greetingFor(now: Date): string {
  const h = now.getHours();
  if (h >= 4 && h < 11) return "Selamat pagi";
  if (h >= 11 && h < 15) return "Selamat siang";
  if (h >= 15 && h < 18) return "Selamat sore";
  return "Selamat malam";
}

export function dateLine(now: Date): string {
  return formatDateID(now, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

/* ---------------- tasks ---------------- */

/** Not finished and past its deadline (a deadline without a time ends at 23:59 that day). */
export function isOverdue(task: Task, now: Date): boolean {
  return !isTaskDone(task) && deadlineInfo(task, now)?.tone === "overdue";
}

export interface TaskProgress { total: number; done: number; open: number; overdue: number; percent: number }

export function taskProgress(tasks: readonly Task[], now: Date): TaskProgress {
  const total = tasks.length;
  const done = tasks.filter(isTaskDone).length;
  return {
    total,
    done,
    open: total - done,
    overdue: tasks.filter((t) => isOverdue(t, now)).length,
    percent: total === 0 ? 0 : Math.round((done / total) * 100),
  };
}

export interface Limited<T> { items: T[]; total: number }

/** Unfinished tasks, nearest deadline first: overdue ones lead, tasks without a deadline come last. */
export function upcomingTasks(tasks: readonly Task[], limit = 5): Limited<Task> {
  const open = tasks.filter((t) => !isTaskDone(t));
  return { items: sortTasks(open, "deadline").slice(0, limit), total: open.length };
}

/* ---------------- schedule ---------------- */

export type ClassStatus = "upcoming" | "ongoing" | "done";
export interface TodayClass { item: ScheduleItem; status: ClassStatus }

/** Starts inclusive, ends exclusive: at exactly the end time the class counts as finished. */
export function classStatus(item: Pick<ScheduleItem, "startTime" | "endTime">, now: Date): ClassStatus {
  const minutes = now.getHours() * 60 + now.getMinutes();
  const start = timeToMinutes(item.startTime);
  const end = timeToMinutes(item.endTime);
  if (end !== null && minutes >= end) return "done";
  if (start !== null && minutes >= start) return "ongoing";
  return "upcoming";
}

/** Today's sessions by the Batch 3 rules (weekly, biweekly from its anchor, one-off on its date). */
export function todayClasses(schedules: readonly ScheduleItem[], now: Date): TodayClass[] {
  return scheduleOnDate(schedules, toDateKey(now)).map((item) => ({ item, status: classStatus(item, now) }));
}

/* ---------------- events ---------------- */

/** Today and later, nearest first (same rule as the Exams page's "Mendatang" filter). */
export function upcomingEvents(
  events: readonly CampusEvent[],
  subjects: readonly Subject[],
  now: Date,
  limit = 5,
): Limited<CampusEvent> {
  const byId = new Map(subjects.map((s) => [s.id, s]));
  const upcoming = filterEvents(events, byId, { query: "", category: "all", time: "upcoming" }, now);
  return { items: sortEvents(upcoming, now).slice(0, limit), total: upcoming.length };
}

/* ---------------- everything ---------------- */

export interface DashboardStats {
  totalTasks: number;
  openTasks: number;
  doneTasks: number;
  overdueTasks: number;
  subjects: number;
  upcomingEvents: number;
}

export interface DashboardModel {
  greeting: string;
  dateLine: string;
  stats: DashboardStats;
  progress: TaskProgress;
  today: TodayClass[];
  tasks: Limited<Task>;
  events: Limited<CampusEvent>;
}

export function buildDashboard(data: DashboardData, now: Date, limit = 5): DashboardModel {
  const progress = taskProgress(data.tasks, now);
  const events = upcomingEvents(data.events, data.subjects, now, limit);
  return {
    greeting: greetingFor(now),
    dateLine: dateLine(now),
    stats: {
      totalTasks: progress.total,
      openTasks: progress.open,
      doneTasks: progress.done,
      overdueTasks: progress.overdue,
      subjects: data.subjects.length,
      upcomingEvents: events.total,
    },
    progress,
    today: todayClasses(data.schedules, now),
    tasks: upcomingTasks(data.tasks, limit),
    events,
  };
}
