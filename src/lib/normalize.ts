import type {
  AppSettings, CampusEvent, FocusSession, Note, ScheduleItem, StorageName, Subject, Task,
} from "@/types";
import { isValidTime } from "./date";
import { normalizeFocusSettings, normalizeTimerState } from "./focus";
import {
  EVENT_CATEGORIES, EVENT_TYPES, SCHEDULE_MODES, SCHEDULE_RECURRENCES, TASK_PRIORITIES, TASK_STATUSES,
  eventTypeFromCategory, inferEventCategory,
} from "./domain";

/**
 * Normalization runs on every read. Rules:
 *  - Never destructive: unknown fields on a record are kept as they are (`{ ...raw, ...known }`).
 *  - Missing or invalid known fields get a safe in-memory fallback. Nothing is written back until
 *    the user saves something, and legacy fields (dueDate, type, dayOfWeek, status "done") stay put.
 *  - Entries that are not objects at all can't be typed. They are returned as `orphans` so the
 *    storage layer can append them back on write instead of losing them.
 */
export const SCHEMA_VERSION = 2;

export const DEFAULT_SETTINGS: AppSettings = {
  theme: "dark",
  sidebarCollapsed: false,
  weekStartsOn: 1,
  schemaVersion: SCHEMA_VERSION,
};

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => typeof v === "object" && v !== null && !Array.isArray(v);

const str = (v: unknown, fallback: string) => (typeof v === "string" ? v : fallback);
const optStr = (v: unknown) => (typeof v === "string" && v.trim() !== "" ? v : undefined);
const optTime = (v: unknown) => (isValidTime(v) ? v : undefined);
const oneOf = <T extends string>(v: unknown, list: readonly T[], fallback: T): T =>
  typeof v === "string" && (list as readonly string[]).includes(v) ? (v as T) : fallback;
function optNum(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v);
  return undefined;
}

const EPOCH = "1970-01-01T00:00:00.000Z";

function base(raw: Rec, prefix: string, index: number) {
  const id = typeof raw.id === "number" ? String(raw.id) : optStr(raw.id);
  const updatedAt = optStr(raw.updatedAt);
  const createdAt = optStr(raw.createdAt) ?? updatedAt ?? EPOCH;
  // Deterministic fallback id so the same record keeps the same id across reads.
  return { id: id ?? `${prefix}-legacy-${index}`, createdAt, updatedAt: updatedAt ?? createdAt };
}

export function normalizeTask(raw: Rec, index = 0): Task {
  return {
    ...raw,
    ...base(raw, "task", index),
    title: str(raw.title, "Tanpa judul"),
    description: optStr(raw.description),
    subjectId: optStr(raw.subjectId),
    dueDate: optStr(raw.dueDate),
    deadline: optStr(raw.deadline) ?? optStr(raw.dueDate),
    deadlineTime: optTime(raw.deadlineTime),
    priority: oneOf(raw.priority, TASK_PRIORITIES, "medium"),
    status: oneOf(raw.status, TASK_STATUSES, "todo"),
    completedAt: optStr(raw.completedAt),
    url: optStr(raw.url),
    importSource: optStr(raw.importSource),
  };
}

export function normalizeSubject(raw: Rec, index = 0): Subject {
  return {
    ...raw,
    ...base(raw, "subject", index),
    name: str(raw.name, "Tanpa nama"),
    code: optStr(raw.code),
    abbr: optStr(raw.abbr),
    lecturer: optStr(raw.lecturer),
    credits: optNum(raw.credits),
    semester: optNum(raw.semester),
    color: str(raw.color, "#65B8FF"),
  };
}

export function normalizeSchedule(raw: Rec, index = 0): ScheduleItem {
  const day = optNum(raw.dayOfWeek);
  return {
    ...raw,
    ...base(raw, "schedule", index),
    subjectId: str(raw.subjectId, ""),
    // 0 = Sunday, exactly as in Phase 1. An invalid value falls back to Monday in memory only.
    dayOfWeek: (day !== undefined && Number.isInteger(day) && day >= 0 && day <= 6 ? day : 1) as ScheduleItem["dayOfWeek"],
    startTime: optTime(raw.startTime) ?? "08:00",
    endTime: optTime(raw.endTime) ?? "09:00",
    room: optStr(raw.room),
    mode: oneOf(raw.mode, SCHEDULE_MODES, "offline"),
    // Phase 1 schedules were weekly by definition.
    recurrence: oneOf(raw.recurrence, SCHEDULE_RECURRENCES, "weekly"),
    // Batch 3. Not validated here on purpose (like Task.deadline): a malformed value stays in the record so a
    // save of the collection can't drop it, and lib/schedule treats it as "no usable date" (needsDate).
    date: optStr(raw.date),
  };
}

export function normalizeEvent(raw: Rec, index = 0): CampusEvent {
  const title = str(raw.title, "Tanpa judul");
  const rawType = typeof raw.type === "string" && (EVENT_TYPES as readonly string[]).includes(raw.type)
    ? (raw.type as CampusEvent["type"])
    : undefined;
  const category = oneOf(raw.category, EVENT_CATEGORIES, inferEventCategory(title));
  return {
    ...raw,
    ...base(raw, "event", index),
    title,
    description: optStr(raw.description),
    type: rawType ?? eventTypeFromCategory(category),
    category,
    location: optStr(raw.location),
    date: str(raw.date, ""),
    startTime: optTime(raw.startTime),
    endTime: optTime(raw.endTime),
    subjectId: optStr(raw.subjectId),
  };
}

export function normalizeNote(raw: Rec, index = 0): Note {
  return {
    ...raw,
    ...base(raw, "note", index),
    title: str(raw.title, "Tanpa judul"),
    content: str(raw.content, ""),
    subjectId: optStr(raw.subjectId),
    pinned: typeof raw.pinned === "boolean" ? raw.pinned : undefined,
  };
}

export function normalizeFocusSession(raw: Rec, index = 0): FocusSession {
  const b = base(raw, "focus", index);
  return {
    ...raw,
    ...b,
    subjectId: optStr(raw.subjectId),
    taskId: optStr(raw.taskId),
    startedAt: optStr(raw.startedAt) ?? b.createdAt,
    endedAt: optStr(raw.endedAt),
    durationMinutes: optNum(raw.durationMinutes) ?? 0,
    completed: typeof raw.completed === "boolean" ? raw.completed : false,
  };
}

export function normalizeSettings(value: unknown): AppSettings {
  const raw: Rec = isRec(value) ? value : {};
  const version = optNum(raw.schemaVersion);
  const out: AppSettings = {
    ...DEFAULT_SETTINGS,
    ...raw,
    theme: raw.theme === "light" ? "light" : "dark",
    sidebarCollapsed: typeof raw.sidebarCollapsed === "boolean" ? raw.sidebarCollapsed : DEFAULT_SETTINGS.sidebarCollapsed,
    weekStartsOn: raw.weekStartsOn === 0 ? 0 : 1,
    // Never downgrade a version written by a newer build.
    schemaVersion: Math.max(version ?? 0, SCHEMA_VERSION),
  };
  // Phase 3 Batch 2 (optional, additive). Absent or unusable values leave the key out entirely.
  const focus = normalizeFocusSettings(raw.focus);
  const focusTimer = normalizeTimerState(raw.focusTimer);
  if (focus) out.focus = focus; else delete out.focus;
  if (focusTimer) out.focusTimer = focusTimer; else delete out.focusTimer;
  return out;
}

type CollectionName = Exclude<StorageName, "settings">;
const NORMALIZERS: Record<CollectionName, (raw: Rec, index: number) => unknown> = {
  subjects: normalizeSubject,
  tasks: normalizeTask,
  schedules: normalizeSchedule,
  events: normalizeEvent,
  notes: normalizeNote,
  focusSessions: normalizeFocusSession,
};

/**
 * A field whose stored value wasn't recognized (e.g. status "archived" from a newer build) is shown
 * with a safe fallback in memory, but the original value is remembered here so a save can put it back.
 */
export interface CoercedField { raw: unknown; fallback: unknown; updatedAt: string }
/** record id -> field -> coercion */
export type CoercionMap = Map<string, Record<string, CoercedField>>;

const ENUM_FIELDS: Record<CollectionName, readonly string[]> = {
  subjects: [],
  tasks: ["status", "priority"],
  schedules: ["mode", "recurrence", "dayOfWeek"],
  events: ["type", "category"],
  notes: [],
  focusSessions: [],
};

export interface NormalizedCollection { items: unknown[]; orphans: unknown[]; coerced: CoercionMap }

/**
 * Before saving, puts back the original value of every coerced field the user hasn't touched.
 * "Touched" = the field changed, or the record's updatedAt moved (edits bump updatedAt).
 */
export function restoreCoerced(items: unknown[], coerced: CoercionMap | undefined): unknown[] {
  if (!coerced || coerced.size === 0) return items;
  return items.map((item) => {
    if (!isRec(item) || typeof item.id !== "string") return item;
    const fields = coerced.get(item.id);
    if (!fields) return item;
    const out: Rec = { ...item };
    for (const [field, c] of Object.entries(fields)) {
      if (out[field] === c.fallback && out.updatedAt === c.updatedAt) out[field] = c.raw;
    }
    return out;
  });
}

export function normalizeCollection(name: CollectionName, raw: unknown): NormalizedCollection {
  const coerced: CoercionMap = new Map();
  if (raw === null || raw === undefined) return { items: [], orphans: [], coerced };
  // Something other than an array is unexpected: keep it aside untouched rather than discard it.
  if (!Array.isArray(raw)) return { items: [], orphans: [raw], coerced };

  const normalize = NORMALIZERS[name];
  const items: unknown[] = [];
  const orphans: unknown[] = [];
  raw.forEach((entry, index) => {
    if (!isRec(entry)) { orphans.push(entry); return; }
    const item = normalize(entry, index) as Rec;
    items.push(item);
    for (const field of ENUM_FIELDS[name]) {
      if (entry[field] !== undefined && entry[field] !== item[field]) {
        const id = item.id as string;
        coerced.set(id, { ...coerced.get(id), [field]: { raw: entry[field], fallback: item[field], updatedAt: item.updatedAt as string } });
      }
    }
  });
  return { items, orphans, coerced };
}
