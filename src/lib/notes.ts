import type { Note, Subject } from "@/types";
import { daysUntil, formatDateID, toDateKey } from "./date";
import { generateId } from "./id";

/* ---------------- view helpers ---------------- */

/** "all" = every note, "none" = notes without a (still existing) subject, otherwise a subject id. */
export type NoteSubjectFilter = "all" | "none" | (string & {});
export type NoteSort = "updated" | "created" | "title";

export interface NoteFilters {
  query: string;
  subject: NoteSubjectFilter;
}

export const NOTE_SORT_LABELS: Record<NoteSort, string> = {
  updated: "Terakhir diubah",
  created: "Terbaru dibuat",
  title: "Judul A-Z",
};
export const NOTE_SORTS = ["updated", "created", "title"] as const satisfies readonly NoteSort[];

export const isPinned = (note: Pick<Note, "pinned">): boolean => note.pinned === true;

/**
 * The subject a note really belongs to. A subjectId that points at a deleted subject counts as
 * "no subject" (the record itself is not touched, same as Tasks/Events).
 */
export function noteSubject(
  note: Pick<Note, "subjectId">,
  subjectsById: ReadonlyMap<string, Subject>,
): Subject | undefined {
  return note.subjectId ? subjectsById.get(note.subjectId) : undefined;
}

/** Title, content and subject name/code, case-insensitive, plus the subject filter. */
export function filterNotes(
  notes: readonly Note[],
  subjectsById: ReadonlyMap<string, Subject>,
  { query, subject }: NoteFilters,
): Note[] {
  const q = query.trim().toLowerCase();
  return notes.filter((note) => {
    const own = noteSubject(note, subjectsById);
    if (subject === "none" && own) return false;
    if (subject !== "all" && subject !== "none" && own?.id !== subject) return false;
    if (!q) return true;
    const haystack = [note.title, note.content, own?.name, own?.code]
      .filter((v): v is string => typeof v === "string")
      .join("\n")
      .toLowerCase();
    return haystack.includes(q);
  });
}

const time = (iso: string) => {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : 0;
};

/**
 * Pinned notes always come first. Inside each group: "updated" = most recently edited first,
 * "created" = newest first, "title" = A-Z (case-insensitive, Indonesian collation).
 * Ties fall back to the other timestamp, then title, then id, so the order never flickers.
 */
export function sortNotes(notes: readonly Note[], sort: NoteSort = "updated"): Note[] {
  const byTitle = (a: Note, b: Note) => a.title.localeCompare(b.title, "id", { sensitivity: "base" });
  return [...notes].sort((a, b) => {
    const pin = Number(isPinned(b)) - Number(isPinned(a));
    if (pin !== 0) return pin;
    if (sort === "title") {
      return byTitle(a, b) || time(b.updatedAt) - time(a.updatedAt) || a.id.localeCompare(b.id);
    }
    const first = sort === "created" ? "createdAt" : "updatedAt";
    const second = sort === "created" ? "updatedAt" : "createdAt";
    return (
      time(b[first]) - time(a[first]) ||
      time(b[second]) - time(a[second]) ||
      byTitle(a, b) ||
      a.id.localeCompare(b.id)
    );
  });
}

/** First part of the content for a card, cut at a word boundary where possible. Newlines are kept (cards use whitespace-pre-line). */
export function notePreview(content: string, max = 280): string {
  const text = content.replace(/\r\n?/g, "\n").trim();
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const space = cut.lastIndexOf(" ");
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

/** "Diubah hari ini", "Diubah kemarin", "Diubah 3 Nov 2026". Empty when the record has no real timestamp (legacy data). */
export function noteTimeLabel(note: Pick<Note, "updatedAt">, now: Date = new Date()): string {
  const t = Date.parse(note.updatedAt);
  if (!Number.isFinite(t) || t <= 0) return "";
  const when = new Date(t);
  const days = daysUntil(toDateKey(when), now);
  if (days === 0) return "Diubah hari ini";
  if (days === -1) return "Diubah kemarin";
  return `Diubah ${formatDateID(when, { day: "numeric", month: "short", year: "numeric" })}`;
}

/* ---------------- form <-> record ---------------- */

export interface NoteFormValues {
  title: string;
  content: string;
  /** "" = no subject. */
  subjectId: string;
}

export const EMPTY_NOTE_FORM: NoteFormValues = { title: "", content: "", subjectId: "" };

/** A subject id that no longer exists is shown as "no subject" (the select can't represent it). */
export function noteToFormValues(note: Note, subjectIds: ReadonlySet<string>): NoteFormValues {
  return {
    title: note.title,
    content: note.content,
    subjectId: note.subjectId && subjectIds.has(note.subjectId) ? note.subjectId : "",
  };
}

export type NoteFormErrors = Partial<Record<"title", string>>;

/** Only the title is required. Content may be empty (a title-only reminder is a fine note). */
export function validateNoteForm(values: NoteFormValues): NoteFormErrors {
  const errors: NoteFormErrors = {};
  if (!values.title.trim()) errors.title = "Judul catatan wajib diisi.";
  return errors;
}

const blankToUndefined = (v: string) => (v.trim() === "" ? undefined : v.trim());
/** Content keeps its inner formatting; only trailing whitespace goes, and a blank body becomes "". */
const cleanContent = (v: string) => v.replace(/\r\n?/g, "\n").trimEnd();

export function createNote(values: NoteFormValues, now: Date = new Date()): Note {
  const stamp = now.toISOString();
  return {
    id: generateId(),
    createdAt: stamp,
    updatedAt: stamp,
    title: values.title.trim(),
    content: cleanContent(values.content),
    subjectId: blankToUndefined(values.subjectId),
    pinned: false,
  };
}

/**
 * Applies a form to the freshest copy of a record. Spreads the old record first so unknown fields and
 * `pinned` survive, and always bumps `updatedAt`. Note has no enum fields, so nothing needs the
 * getCoercedRaw preservation that Tasks/Schedule/Events use.
 */
export function applyNoteEdit(note: Note, values: NoteFormValues, now: Date = new Date()): Note {
  return {
    ...note,
    title: values.title.trim(),
    content: cleanContent(values.content),
    subjectId: blankToUndefined(values.subjectId),
    updatedAt: now.toISOString(),
  };
}

/** Pin or unpin. It is an edit like any other, so `updatedAt` moves too. */
export function togglePinned(note: Note, now: Date = new Date()): Note {
  return { ...note, pinned: !isPinned(note), updatedAt: now.toISOString() };
}
