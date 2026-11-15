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
 * Real copied text from the Classroom page can also be a block of link-only lines that share ONE URL
 * (one block per assignment), e.g.
 *   [assignment](URL)  [Modul 9 - DataStore Room](URL)  [Praktikum PAPB - TIF F 2026](URL)  [Turned in](URL)
 * The first line is a type label ("assignment") and is skipped, then comes the title, then the class
 * (used as the subject), optionally a due date such as [Monday, Nov 9](URL), and the status.
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
// English labels as seen in the pasted text. If nothing else follows, the label itself is kept as the title (never lost).
const TYPE_LABELS = new Set(["assignment", "material", "question"]);
const isTypeLabel = (t: string) => TYPE_LABELS.has(t.trim().toLowerCase());

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const WEEKDAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const DATE_LINE = /^(?:([A-Za-z]{3,9}),?\s+)?([A-Za-z]{3,9})\s+(\d{1,2})$/;

/** Day number since 1970-01-01 for a civil date (pure arithmetic: no Date object, so no time zone or clock involved). */
function dayNumber(y: number, m: number, d: number): number {
  const yy = m <= 2 ? y - 1 : y;
  const era = Math.floor(yy / 400);
  const yoe = yy - era * 400;
  const doy = Math.floor((153 * (m + (m > 2 ? -3 : 9)) + 2) / 5) + d - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}
const weekdayOf = (n: number) => (((n + 4) % 7) + 7) % 7; // 1970-01-01 was a Thursday (4); 0 = Sunday
const daysInMonth = (y: number, m: number) => dayNumber(m === 12 ? y + 1 : y, m === 12 ? 1 : m + 1, 1) - dayNumber(y, m, 1);

/**
 * "Monday, Nov 9" -> { isDate: true, key: "2026-11-09" }. Classroom omits the year, so it is taken from the
 * weekday: the year (previous, this or next, relative to `today`) in which that day really falls on that
 * weekday and is closest to today. Without a weekday, or without `today`, the year cannot be known, so no
 * date is invented ({ isDate: true, key: "" }).
 */
export function readClassroomDate(text: string, today?: string): { isDate: boolean; key: string } {
  const m = DATE_LINE.exec(text.trim());
  if (!m) return { isDate: false, key: "" };
  const mon = MONTHS.indexOf(m[2].slice(0, 3).toLowerCase()) + 1;
  const day = Number(m[3]);
  if (mon < 1 || day < 1 || day > 31) return { isDate: false, key: "" };
  const wd = m[1] ? WEEKDAYS.indexOf(m[1].slice(0, 3).toLowerCase()) : -1;
  if (m[1] && wd < 0) return { isDate: false, key: "" };
  const t = today ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(today) : null;
  if (wd < 0 || !t) return { isDate: true, key: "" };
  const [ty, tm, td] = [Number(t[1]), Number(t[2]), Number(t[3])];
  const todayN = dayNumber(ty, tm, td);
  let best: { y: number; dist: number } | null = null;
  for (const y of [ty - 1, ty, ty + 1]) {
    if (day > daysInMonth(y, mon)) continue;
    const n = dayNumber(y, mon, day);
    if (weekdayOf(n) !== wd) continue;
    const dist = Math.abs(n - todayN);
    if (!best || dist < best.dist) best = { y, dist };
  }
  if (!best) return { isDate: true, key: "" };
  return { isDate: true, key: `${best.y}-${String(mon).padStart(2, "0")}-${String(day).padStart(2, "0")}` };
}

/** A line that is exactly one Markdown link, nothing else (no number prefix). */
const LINK_ONLY = /^\[([^\]]+)\]\((\S+?)\)$/;

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

interface Pending { line: number; title: string; label: string; url: string; subject: string; deadline: string; warnings: string[] }

export function parseClassroom(text: string, today?: string): ParseResult {
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
    if (!cur.title) cur.title = cur.label; // only a type label was seen: keep it as the title rather than lose the entry
    const warnings = [...cur.warnings];
    if (!cur.subject) warnings.push("Nama mata kuliah tidak ada di teks.");
    drafts.push({
      line: cur.line, title: cur.title, subjectName: cur.subject, deadline: cur.deadline, deadlineTime: "",
      url: cur.url, sourceStatus: status, warnings,
    });
    st.cur = null;
  };

  const start = (l: Line, rawTitle: string) => {
    const link = readLink(rawTitle);
    if (!link.title) { issue(l, "Judul tugasnya kosong."); return; }
    // "[assignment](URL)" is a type label; the real title is on a following line with the same URL.
    const isLabel = link.linked && isTypeLabel(link.title);
    st.cur = { line: l.n, title: isLabel ? "" : link.title, label: isLabel ? link.title : "", url: link.url, subject: "", deadline: "", warnings: link.warnings };
  };

  for (const l of lines) {
    const t = l.text;

    if (isClassroomStatus(t)) {
      if (st.cur) flush(t);
      else issue(l, "Status ini tidak punya tugas di atasnya.");
      st.awaitingTitle = false;
      continue;
    }

    // Link-only line with the SAME URL as the task being built = another field of that assignment.
    const only = LINK_ONLY.exec(t);
    if (only && st.cur && st.cur.url && readLink(t).url === st.cur.url) {
      const piece = readLink(t).title;
      const cur = st.cur;
      if (isClassroomStatus(piece)) { flush(piece); st.awaitingTitle = false; continue; }
      if (isTypeLabel(piece)) continue;
      const date = readClassroomDate(piece, today);
      if (date.isDate) {
        if (date.key && !cur.deadline) cur.deadline = date.key;
        else if (!date.key) cur.warnings.push(`Tanggal "${piece}" tanpa nama hari, jadi tidak diisi.`);
        continue;
      }
      if (!cur.title) cur.title = piece;
      else if (!cur.subject) cur.subject = piece;
      else issue(l, "Baris tambahan di tugas ini, tidak dikenali.");
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
  parse: (text, today) => parseClassroom(text, today),
};
