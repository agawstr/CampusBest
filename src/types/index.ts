import type {
  AppSettings, CampusEvent, FocusSession, Note, ScheduleItem, Subject, Task,
} from "./models";

export * from "./models";

/** Logical name -> value type. Add new collections here. */
export interface StorageSchema {
  subjects: Subject[];
  tasks: Task[];
  schedules: ScheduleItem[];
  events: CampusEvent[];
  notes: Note[];
  focusSessions: FocusSession[];
  settings: AppSettings;
}

export type StorageName = keyof StorageSchema;
