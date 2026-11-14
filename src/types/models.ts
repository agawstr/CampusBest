export type ID = string;

export interface BaseEntity {
  id: ID;
  createdAt: string; // ISO date
  updatedAt: string;
}

export interface Subject extends BaseEntity {
  name: string;
  code?: string;
  lecturer?: string;
  credits?: number;
  /** Semester number, e.g. 3. */
  semester?: number;
  color: string;
}

export type TaskPriority = "low" | "medium" | "high";
/**
 * "done" is the Phase 1 value and stays valid forever; "completed" is the Phase 2 value.
 * Always test with isTaskDone() (lib/domain) instead of comparing to one of them.
 */
export type TaskStatus = "todo" | "in_progress" | "done" | "completed";

export interface Task extends BaseEntity {
  title: string;
  description?: string;
  subjectId?: ID;
  /** Phase 1 field, kept for compatibility. Prefer `deadline` (read via getTaskDeadline()). */
  dueDate?: string;
  /** "YYYY-MM-DD", local date. Filled from `dueDate` on read when missing. */
  deadline?: string;
  /** "HH:mm", local time. Optional. */
  deadlineTime?: string;
  priority: TaskPriority;
  status: TaskStatus;
  completedAt?: string;
}

export type ScheduleMode = "offline" | "online";
/** "none" = one-off session, "weekly" = every week (the Phase 1 behaviour), "biweekly" = every other week. */
export type ScheduleRecurrence = "none" | "weekly" | "biweekly";

export interface ScheduleItem extends BaseEntity {
  subjectId: ID;
  /** 0 = Sunday ... 6 = Saturday. Same meaning as Phase 1, never rewritten. */
  dayOfWeek: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  startTime: string; // "HH:mm"
  endTime: string;
  room?: string;
  mode: ScheduleMode;
  recurrence: ScheduleRecurrence;
  /**
   * "YYYY-MM-DD", local date. Added in Batch 3, optional so Phase 1/Batch 1 records stay valid.
   *  - recurrence "none": the one date the session happens (required for it to show up anywhere).
   *  - recurrence "biweekly": the anchor, i.e. the first session; every 14 days from it.
   *  - recurrence "weekly": not used (weekly follows `dayOfWeek`).
   * For "none" and "biweekly" the weekday comes from this date; `dayOfWeek` is kept in sync on save.
   */
  date?: string;
}

export type EventType = "event" | "exam" | "deadline" | "other";

export type EventCategory = "uts" | "uas" | "quiz" | "presentasi" | "praktikum" | "seminar" | "lainnya";

export interface CampusEvent extends BaseEntity {
  title: string;
  description?: string;
  /** Phase 1 field, kept and normalized. `category` is the finer-grained Phase 2 field. */
  type: EventType;
  category: EventCategory;
  location?: string;
  date: string; // "YYYY-MM-DD"
  startTime?: string;
  endTime?: string;
  subjectId?: ID;
}

export interface Note extends BaseEntity {
  title: string;
  content: string;
  subjectId?: ID;
  pinned?: boolean;
}

export interface FocusSession extends BaseEntity {
  subjectId?: ID;
  taskId?: ID;
  startedAt: string;
  durationMinutes: number;
  completed: boolean;
}

export type ThemeMode = "dark" | "light";

export interface AppSettings {
  theme: ThemeMode;
  sidebarCollapsed: boolean;
  weekStartsOn: 0 | 1;
  schemaVersion: number; // current: 2 (see lib/normalize.ts)
}
