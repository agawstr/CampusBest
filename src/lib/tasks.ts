import type { Subject, Task, TaskPriority } from "@/types";
import { getTaskDeadline, isTaskDone, TASK_PRIORITIES, type TaskStatusKind } from "./domain";
import { daysUntil, formatDateID, isValidTime, parseDateKey, toDateTime } from "./date";
import { generateId } from "./id";

/* ---------------- view helpers ---------------- */

export type StatusFilter = "all" | TaskStatusKind;
export type PriorityFilter = "all" | TaskPriority;
export type TaskSort = "deadline" | "priority";

export interface TaskFilters {
  query: string;
  status: StatusFilter;
  priority: PriorityFilter;
}

/** done/completed -> "done"; in_progress stays; everything else (todo, unknown values shown as todo) -> "todo". */
export function taskStatusKind(task: Pick<Task, "status">): TaskStatusKind {
  if (isTaskDone(task)) return "done";
  return task.status === "in_progress" ? "in_progress" : "todo";
}

export function filterTasks(
  tasks: readonly Task[],
  subjectsById: ReadonlyMap<string, Subject>,
  { query, status, priority }: TaskFilters,
): Task[] {
  const q = query.trim().toLowerCase();
  return tasks.filter((task) => {
    if (status !== "all" && taskStatusKind(task) !== status) return false;
    if (priority !== "all" && task.priority !== priority) return false;
    if (!q) return true;
    const subject = task.subjectId ? subjectsById.get(task.subjectId) : undefined;
    const haystack = [task.title, task.description, subject?.name, subject?.code]
      .filter((v): v is string => typeof v === "string")
      .join("\n")
      .toLowerCase();
    return haystack.includes(q);
  });
}

const PRIORITY_RANK: Record<TaskPriority, number> = { high: 0, medium: 1, low: 2 };
const cmp = (a: number, b: number) => (a < b ? -1 : a > b ? 1 : 0);

/** Milliseconds of the deadline, or Infinity when there is none (or it is malformed), so those sort last. */
function deadlineMs(task: Task): number {
  const key = getTaskDeadline(task);
  if (!key) return Infinity;
  const date = toDateTime(key, task.deadlineTime);
  return date ? date.getTime() : Infinity;
}

/** Finished tasks always sink to the bottom; ties fall back to the other criterion, then creation time. */
export function sortTasks(tasks: readonly Task[], sort: TaskSort): Task[] {
  return [...tasks].sort((a, b) => {
    const doneDiff = cmp(Number(isTaskDone(a)), Number(isTaskDone(b)));
    if (doneDiff) return doneDiff;
    const byDeadline = cmp(deadlineMs(a), deadlineMs(b));
    const byPriority = cmp(PRIORITY_RANK[a.priority] ?? 1, PRIORITY_RANK[b.priority] ?? 1);
    const [first, second] = sort === "deadline" ? [byDeadline, byPriority] : [byPriority, byDeadline];
    return first || second || a.createdAt.localeCompare(b.createdAt);
  });
}

export type DeadlineTone = "overdue" | "soon" | "normal";
export interface DeadlineInfo { label: string; tone: DeadlineTone }

/** Short deadline text for a task row. null when there is no usable deadline. */
export function deadlineInfo(task: Task, now: Date = new Date()): DeadlineInfo | null {
  const key = getTaskDeadline(task);
  if (!key) return null;
  const due = toDateTime(key, task.deadlineTime);
  const days = daysUntil(key, now);
  if (!due || days === null) return null;

  const date = formatDateID(key, { weekday: "short", day: "numeric", month: "short" });
  const when = task.deadlineTime && isValidTime(task.deadlineTime) ? `${date}, ${task.deadlineTime}` : date;
  if (isTaskDone(task)) return { label: when, tone: "normal" };

  const overdue = due.getTime() < now.getTime();
  let relative: string;
  if (days === 0) relative = "Hari ini";
  else if (days === 1) relative = "Besok";
  else if (days === -1) relative = "Kemarin";
  else if (days > 1) relative = `${days} hari lagi`;
  else relative = `${-days} hari lalu`;

  return { label: `${relative} · ${when}`, tone: overdue ? "overdue" : days <= 1 ? "soon" : "normal" };
}

/* ---------------- form <-> record ---------------- */

export type TaskFormStatus = "todo" | "in_progress" | "completed";

export interface TaskFormValues {
  title: string;
  description: string;
  subjectId: string;
  deadline: string;
  deadlineTime: string;
  priority: TaskPriority;
  status: TaskFormStatus;
}

export const EMPTY_TASK_FORM: TaskFormValues = {
  title: "", description: "", subjectId: "", deadline: "", deadlineTime: "", priority: "medium", status: "todo",
};

/** A subject id that no longer exists is shown as "no subject" (the select can't represent it). */
export function taskToFormValues(task: Task, subjectIds: ReadonlySet<string>): TaskFormValues {
  const deadline = getTaskDeadline(task) ?? "";
  return {
    title: task.title,
    description: task.description ?? "",
    subjectId: task.subjectId && subjectIds.has(task.subjectId) ? task.subjectId : "",
    deadline,
    deadlineTime: deadline ? task.deadlineTime ?? "" : "",
    priority: (TASK_PRIORITIES as readonly string[]).includes(task.priority) ? task.priority : "medium",
    status: isTaskDone(task) ? "completed" : task.status === "in_progress" ? "in_progress" : "todo",
  };
}

export type TaskFormErrors = Partial<Record<"title" | "deadline" | "deadlineTime", string>>;

export function validateTaskForm(values: TaskFormValues): TaskFormErrors {
  const errors: TaskFormErrors = {};
  if (!values.title.trim()) errors.title = "Judul tugas wajib diisi.";
  if (values.deadline && !parseDateKey(values.deadline)) errors.deadline = "Tanggal deadline tidak valid.";
  if (values.deadlineTime && !isValidTime(values.deadlineTime)) errors.deadlineTime = "Jam deadline tidak valid.";
  return errors;
}

const blankToUndefined = (v: string) => (v.trim() === "" ? undefined : v.trim());

export function createTask(values: TaskFormValues, now: Date = new Date()): Task {
  const stamp = now.toISOString();
  const done = values.status === "completed";
  return {
    id: generateId(),
    createdAt: stamp,
    updatedAt: stamp,
    title: values.title.trim(),
    description: blankToUndefined(values.description),
    subjectId: blankToUndefined(values.subjectId),
    deadline: blankToUndefined(values.deadline),
    deadlineTime: values.deadline ? blankToUndefined(values.deadlineTime) : undefined,
    priority: values.priority,
    status: values.status,
    completedAt: done ? stamp : undefined,
  };
}

/** Which form fields the user actually interacted with (clicked), as opposed to merely displayed. */
export interface TaskFormTouched { status: boolean; priority: boolean }
export const UNTOUCHED: TaskFormTouched = { status: false, priority: false };

/**
 * Original stored values of enum fields that normalization could not recognize (e.g. status "archived",
 * priority "urgent"), to be written back instead of the in-memory fallback.
 */
export interface PreservedFields { status?: unknown; priority?: unknown }

/**
 * Decides which unknown stored values must survive a save: those of fields the user did not touch.
 * `getRaw` returns the original stored value of a field, or undefined if it was recognized.
 * A field the user touched is never preserved, so a deliberate choice (even "Belum mulai") is saved.
 */
export function fieldsToPreserve(
  touched: TaskFormTouched,
  getRaw: (field: "status" | "priority") => unknown,
): PreservedFields {
  const out: PreservedFields = {};
  if (!touched.status) { const raw = getRaw("status"); if (raw !== undefined) out.status = raw; }
  if (!touched.priority) { const raw = getRaw("priority"); if (raw !== undefined) out.priority = raw; }
  return out;
}

// Unknown values are by definition outside the union; this is the one place that writes them back on purpose.
const asStatus = (v: unknown) => v as Task["status"];
const asPriority = (v: unknown) => v as Task["priority"];

/**
 * Applies a form to the freshest copy of a record. Spreads the old record first so unknown fields
 * survive, and always bumps `updatedAt` (the storage layer relies on that to know the user edited it).
 * Clearing the deadline also clears legacy `dueDate`, otherwise normalization would bring it back.
 * `preserved` carries unknown status/priority values the user did not touch (see fieldsToPreserve);
 * bumping `updatedAt` would otherwise disarm the storage layer's own restore for them.
 */
export function applyTaskEdit(
  task: Task,
  values: TaskFormValues,
  now: Date = new Date(),
  preserved: PreservedFields = {},
): Task {
  const stamp = now.toISOString();
  const wasDone = isTaskDone(task);
  const wantsDone = values.status === "completed";
  const hasDeadline = values.deadline.trim() !== "";
  const keepStatus = preserved.status !== undefined;
  return {
    ...task,
    title: values.title.trim(),
    description: blankToUndefined(values.description),
    subjectId: blankToUndefined(values.subjectId),
    deadline: hasDeadline ? values.deadline : undefined,
    dueDate: hasDeadline ? task.dueDate : undefined,
    deadlineTime: hasDeadline ? blankToUndefined(values.deadlineTime) : undefined,
    priority: preserved.priority !== undefined ? asPriority(preserved.priority) : values.priority,
    // Keep a legacy "done" as it is when the user leaves the task finished.
    status: keepStatus ? asStatus(preserved.status) : wantsDone ? (wasDone ? task.status : "completed") : values.status,
    completedAt: keepStatus ? task.completedAt : wantsDone ? (wasDone ? task.completedAt ?? stamp : stamp) : undefined,
    updatedAt: stamp,
  };
}

/** The checkbox is an explicit status change, so only an unknown priority needs to be carried along. */
export function toggleTaskDone(task: Task, now: Date = new Date(), preserved: PreservedFields = {}): Task {
  const stamp = now.toISOString();
  const priority = preserved.priority !== undefined ? asPriority(preserved.priority) : task.priority;
  return isTaskDone(task)
    ? { ...task, priority, status: "todo", completedAt: undefined, updatedAt: stamp }
    : { ...task, priority, status: "completed", completedAt: stamp, updatedAt: stamp };
}
