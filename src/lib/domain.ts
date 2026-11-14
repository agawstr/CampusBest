import type {
  EventCategory, EventType, ScheduleMode, ScheduleRecurrence, Task, TaskPriority, TaskStatus,
} from "@/types";

export const TASK_STATUSES = ["todo", "in_progress", "done", "completed"] as const satisfies readonly TaskStatus[];
export const TASK_PRIORITIES = ["low", "medium", "high"] as const satisfies readonly TaskPriority[];
export const SCHEDULE_MODES = ["offline", "online"] as const satisfies readonly ScheduleMode[];
export const SCHEDULE_RECURRENCES = ["none", "weekly", "biweekly"] as const satisfies readonly ScheduleRecurrence[];
export const EVENT_TYPES = ["event", "exam", "deadline", "other"] as const satisfies readonly EventType[];
export const EVENT_CATEGORIES = [
  "uts", "uas", "quiz", "presentasi", "praktikum", "seminar", "lainnya",
] as const satisfies readonly EventCategory[];

export const EVENT_CATEGORY_LABELS: Record<EventCategory, string> = {
  uts: "UTS",
  uas: "UAS",
  quiz: "Quiz",
  presentasi: "Presentasi",
  praktikum: "Praktikum",
  seminar: "Seminar",
  lainnya: "Lainnya",
};

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = { low: "Rendah", medium: "Sedang", high: "Tinggi" };

/** Status as the UI groups it: "done" and "completed" are the same thing to the user. */
export type TaskStatusKind = "todo" | "in_progress" | "done";
export const TASK_STATUS_KIND_LABELS: Record<TaskStatusKind, string> = {
  todo: "Belum mulai",
  in_progress: "Dikerjakan",
  done: "Selesai",
};

export const SCHEDULE_MODE_LABELS: Record<ScheduleMode, string> = { offline: "Offline", online: "Online" };

export const SCHEDULE_RECURRENCE_LABELS: Record<ScheduleRecurrence, string> = {
  none: "Sekali saja",
  weekly: "Tiap minggu",
  biweekly: "Dua minggu sekali",
};

/** Both the Phase 1 ("done") and Phase 2 ("completed") values count as finished. */
export function isTaskDone(task: Pick<Task, "status">): boolean {
  return task.status === "done" || task.status === "completed";
}

/** Deadline date ("YYYY-MM-DD"), reading the new field first and falling back to Phase 1's `dueDate`. */
export function getTaskDeadline(task: Pick<Task, "deadline" | "dueDate">): string | undefined {
  return task.deadline || task.dueDate || undefined;
}

/** Event categories that count as an exam-like moment. */
const EXAM_LIKE: readonly EventCategory[] = ["uts", "uas", "quiz", "praktikum"];

export function eventTypeFromCategory(category: EventCategory): EventType {
  return EXAM_LIKE.includes(category) ? "exam" : "other";
}

/** Best-effort category guess for Phase 1 events, which only had `type`. Falls back to "lainnya". */
export function inferEventCategory(title: string): EventCategory {
  const t = title.toLowerCase();
  if (/\buts\b|tengah semester/.test(t)) return "uts";
  if (/\buas\b|akhir semester/.test(t)) return "uas";
  if (/\bquiz\b|\bkuis\b/.test(t)) return "quiz";
  if (/presentasi/.test(t)) return "presentasi";
  if (/praktikum/.test(t)) return "praktikum";
  if (/seminar/.test(t)) return "seminar";
  return "lainnya";
}
