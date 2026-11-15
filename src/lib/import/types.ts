/**
 * Bulk Import: shared types.
 *
 * Architecture (one module per concern, no React, no storage except commit.ts):
 *   text.ts        shared line/URL/date/time helpers
 *   classroom.ts   source parser: Google Classroom   -> TaskDraft[]
 *   brone.ts       source parser: BRONE (Moodle)     -> TaskDraft[]
 *   sources.ts     registry (IMPORT_SOURCES) + guarded runParser()
 *   subjects.ts    matching source subject names to Subjects
 *   duplicates.ts  duplicate detection against Tasks and inside the batch
 *   preview.ts     editable preview items, validation, conversion to Task
 *   commit.ts      the only file that writes (subjects first, then tasks)
 *
 * Bulk Import 2 (SIAM Format 1 and 2 -> Schedule) is a second lane next to the task lane, so the task code
 * above is untouched:
 *   siam.ts              source parser: SIAM table (format detected from the header) -> ScheduleDraft[]
 *   schedule-preview.ts  editable preview items, validation, duplicates, conversion to ScheduleItem
 *   commit.ts            also holds commitScheduleImport() (still the only file that writes)
 * It reuses text.ts, subjects.ts (matching) and the registry/guard pattern in sources.ts.
 */

export type ImportSourceKey = "google_classroom" | "brone";

/** What a source produces: tasks (Classroom, BRONE) or weekly class schedules (SIAM). */
export type ImportTarget = "tasks" | "schedules";

export type ScheduleImportSourceKey = "siam";
/** Which SIAM table layout was recognized from the header. 1 = Hari/Jam/Mata Kuliah/Kelas/Dosen/Ruang/Action, 2 = Hari/MK/Jam/Ruang. */
export type SiamFormat = 1 | 2;

/** One task as read from the pasted text, before the user has looked at it. Nothing here is invented. */
export interface TaskDraft {
  /** 1-based line number (in the pasted text, empty lines counted) where this item starts. */
  line: number;
  title: string;
  /** Subject name exactly as the source wrote it. "" when the text doesn't say. */
  subjectName: string;
  /** "YYYY-MM-DD" (local, no time zone conversion) or "" when the source has no deadline. */
  deadline: string;
  /** "HH:mm" or "". "00:00" is a real time, never "empty". */
  deadlineTime: string;
  /** Only an http(s) URL that was literally in the text, or "". */
  url: string;
  /** Status as the source shows it (e.g. "Turned in"), "" when absent. Informational only. */
  sourceStatus: string;
  /** Things worth a second look (kept, not errors). */
  warnings: string[];
}

/** A piece of text that could not be turned into a task, with the reason. */
export interface ParseIssue {
  line: number;
  text: string;
  reason: string;
}

export interface ParseResult {
  drafts: TaskDraft[];
  issues: ParseIssue[];
  /** Lines that are known noise (e.g. BRONE's "Activity event") and were skipped on purpose. */
  ignored: number;
}

export interface ImportSourceDef {
  key: ImportSourceKey;
  label: string;
  target: ImportTarget;
  /** One line under the source picker. */
  summary: string;
  /** How to copy the text from the source site. */
  howTo: string;
  /** Pure function: same text (and same `today`) in, same result out. Never throws. `today` is "YYYY-MM-DD", only used to pick the year of dates written without one. */
  parse: (text: string, today?: string) => ParseResult;
}

/** One class session as read from a SIAM row, before the user has looked at it. Nothing here is invented. */
export interface ScheduleDraft {
  /** 1-based line number in the pasted text. */
  line: number;
  /** 0 = Sunday ... 6 = Saturday (the app's convention). */
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  /** Subject name as the source wrote it (without a leading code, see subjectCode). */
  subjectName: string;
  /** Only when the cell literally had a code like "TIF1234 - Name". Otherwise "". */
  subjectCode: string;
  /** Format 1 only. Kept for display; Schedule has no class field. */
  className: string;
  /** Format 1 only. Used as the lecturer of a NEW subject, never written over an existing one. */
  lecturer: string;
  room: string;
  warnings: string[];
}

export interface ScheduleParseResult {
  drafts: ScheduleDraft[];
  issues: ParseIssue[];
  ignored: number;
  /** null when no recognizable header was found. */
  format: SiamFormat | null;
}

export interface ScheduleImportSourceDef {
  key: ScheduleImportSourceKey;
  label: string;
  target: "schedules";
  summary: string;
  howTo: string;
  parse: (text: string) => ScheduleParseResult;
}
