import type { ImportSourceDef, ParseIssue, ParseResult, TaskDraft } from "./types";
import { lineUrl, readLink, splitLines, type Line } from "./text";

/**
 * Google Classroom: text copied from the assignments page.
 *
 *   1. [Modul Praktikum 10: Extreme Learning Machine](https://classroom.google.com/...)   <- number + title (link optional)
 *   https://classroom.google.com/...                                                      <- URL on its own line (optional)
 *   Pemrosesan Bahasa Alami                                                               <- subject
 *   Turned in                                                                             <- source status (optional)
 *
 * The source has no deadline in this format, so none is made up. A status such as "Turned in" is shown
 * to the user as information; it never decides the status of the Task.
 */

const STATUSES = [
  "turned in", "handed in", "submitted", "assigned", "missing", "done", "returned", "graded",
  "marked as done", "not turned in", "late", "done late", "turned in late", "handed in late",
  "diserahkan", "ditugaskan", "terlambat", "selesai", "dinilai", "dikembalikan", "belum diserahkan",
];
const STATUS_SET = new Set(STATUSES);

export function isClassroomStatus(text: string): boolean {
  return STATUS_SET.has(text.trim().toLowerCase().replace(/\s+/g, " ").replace(/[.:]$/, ""));
}

/** "1. Title", "1) Title", "1<TAB>Title", optionally behind a bullet. Returns the rest, or null. */
const NUMBERED = /^(?:[-*•]\s+)?\d{1,4}(?:[.)]\s+|\t+\s*)(.+)$/;
const NUMBER_ONLY = /^\d{1,4}[.)]?$/;

interface Marker { rest: string }

/** A line that starts a task: has a number prefix or is a Markdown link. */
function readMarker(text: string): Marker | null {
  const numbered = NUMBERED.exec(text);
  if (numbered) return { rest: numbered[1].trim() };
  const bullet = /^[-*•]\s+(\[.+\]\(.+\))$/.exec(text);
  if (bullet) return { rest: bullet[1] };
  if (readLink(text).linked) return { rest: text };
  return null;
}

interface Pending { line: number; title: string; url: string; subject: string; warnings: string[] }

export function parseClassroom(text: string): ParseResult {
  const lines = splitLines(text);
  const drafts: TaskDraft[] = [];
  const issues: ParseIssue[] = [];
  // When any line is clearly a numbered/linked title, plain lines are never titles: they are subject lines.
  const markerMode = lines.some((l) => NUMBER_ONLY.test(l.text) || readMarker(l.text) !== null);

  // State lives in one object so the closures below and the loop agree on its type.
  const st: { cur: Pending | null; awaitingTitle: boolean } = { cur: null, awaitingTitle: false };

  const issue = (l: Line, reason: string) => issues.push({ line: l.n, text: l.text, reason });

  const flush = (status = "") => {
    const cur = st.cur;
    if (!cur) return;
    const warnings = [...cur.warnings];
    if (!cur.subject) warnings.push("Nama mata kuliah tidak ada di teks.");
    drafts.push({
      line: cur.line, title: cur.title, subjectName: cur.subject, deadline: "", deadlineTime: "",
      url: cur.url, sourceStatus: status, warnings,
    });
    st.cur = null;
  };

  const start = (l: Line, rawTitle: string) => {
    const link = readLink(rawTitle);
    if (!link.title) { issue(l, "Judul tugasnya kosong."); return; }
    st.cur = { line: l.n, title: link.title, url: link.url, subject: "", warnings: link.warnings };
  };

  for (const l of lines) {
    const t = l.text;

    if (isClassroomStatus(t)) {
      if (st.cur) flush(t);
      else issue(l, "Status ini tidak punya tugas di atasnya.");
      st.awaitingTitle = false;
      continue;
    }

    const urlOnly = lineUrl(t);
    if (urlOnly) {
      if (st.cur && !st.cur.url) st.cur.url = urlOnly;
      else if (st.cur) issue(l, "Tugas ini sudah punya URL, yang kedua diabaikan.");
      else issue(l, "URL ini tidak punya judul tugas di atasnya.");
      continue;
    }

    if (NUMBER_ONLY.test(t)) { flush(); st.awaitingTitle = true; continue; }

    const marker = readMarker(t);
    if (marker) {
      flush();
      st.awaitingTitle = false;
      start(l, marker.rest);
      continue;
    }

    // Plain text.
    if (st.awaitingTitle) { st.awaitingTitle = false; start(l, t); continue; }
    if (markerMode) {
      if (st.cur && !st.cur.subject) st.cur.subject = t;
      else if (st.cur) issue(l, "Baris tambahan setelah nama mata kuliah, tidak dikenali.");
      else issue(l, "Baris ini ada di luar daftar tugas, tidak dikenali.");
      continue;
    }
    // No numbers or links anywhere: the layout is title, subject, [status], title, subject, ...
    if (!st.cur) start(l, t);
    else if (!st.cur.subject) st.cur.subject = t;
    else { flush(); start(l, t); }
  }
  flush();
  return { drafts, issues, ignored: 0 };
}

export const classroomSource: ImportSourceDef = {
  key: "google_classroom",
  label: "Google Classroom",
  target: "tasks",
  summary: "Judul tugas, link, mata kuliah, dan status dari halaman tugas Classroom.",
  howTo: "Buka halaman tugas di Google Classroom, blok daftar tugasnya, salin, lalu tempel di sini.",
  parse: parseClassroom,
};
