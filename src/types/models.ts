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
  color: string;
}

export type TaskPriority = "low" | "medium" | "high";
export type TaskStatus = "todo" | "in_progress" | "done";

export interface Task extends BaseEntity {
  title: string;
  description?: string;
  subjectId?: ID;
  dueDate?: string;
  priority: TaskPriority;
  status: TaskStatus;
  completedAt?: string;
}

export interface ScheduleItem extends BaseEntity {
  subjectId: ID;
  dayOfWeek: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  startTime: string; // "HH:mm"
  endTime: string;
  room?: string;
}

export type EventType = "event" | "exam" | "deadline" | "other";

export interface CampusEvent extends BaseEntity {
  title: string;
  description?: string;
  type: EventType;
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
  schemaVersion: number;
}
