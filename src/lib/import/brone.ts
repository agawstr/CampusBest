import type { ImportSourceDef, ParseIssue, ParseResult, TaskDraft } from "./types";
import { lineUrl, readDate, readLink, readTime, splitLines, type Line } from "./text";

/**
 * BRONE (Moodle): text copied from the agenda page.
 *
 *   Monday, 16 November 2026                                   <- date; applies to every task below until the next date
 *   23:59                                                      <- time of the next task ("00:00" is a real time)
 *   Activity event                                             <- noise, ignored
 *   Proyek Iterasi 1: Halaman Cover & AI Disclaimer            <- title (link / URL line optional)
 *   Assignment is due · Komputer Grafis                        <- ends the task, gives the subject
 *
 * Times are kept exactly as written (WIB, Asia/Jakarta): the text is never converted to another zone.
 * Each task needs its own time line. A task with no time line is imported without a time (and a warning),
 * not given the previous task's time. Two tasks with the same date and time but different titles are two tasks.
 */

const NOISE = new Set(["activity event", "»", "«", "go to activity", "show more", "show less"]);

/** "Assignment is due · Komputer Grafis" -> the subject (maybe ""). null when the line isn't this kind of line. */
function readAssignmentLine(text: string): { subject: string } | null {
  const m = /^Assignment is due\s*(?:[·•|:–-]\s*(.*))?$/i.exec(text);
  return m ? { subject: (m[1] ?? "").trim() } : null;
}

/** Other Moodle event kinds look like "Quiz closes · Course". They aren't tasks, so they're reported, not imported. */
function readOtherEventLine(text: string): string | null {
  const m = /^([A-Za-z][^·•]{1,40}?)\s+[·•]\s+.+$/.exec(text);
  return m ? m[1].trim() : null;
}

interface Pending { line: number; title: string; url: string; warnings: string[] }

export function parseBrone(text: string): ParseResult {
  const lines = splitLines(text);
  const drafts: TaskDraft[] = [];
  const issues: ParseIssue[] = [];

  // State lives in one object so the closures below and the loop agree on its type.
  const st: {
    ignored: number;
    date: string | null; dateWarnings: string[]; dateBroken: boolean;
    time: string | null;
    pending: Pending | null;
    /** The task finished by the previous line, which may still receive a URL line. */
    last: TaskDraft | null;
  } = { ignored: 0, date: null, dateWarnings: [], dateBroken: false, time: null, pending: null, last: null };

  const issue = (l: Line, reason: string) => issues.push({ line: l.n, text: l.text, reason });
  const NO_TYPE = 'Judul ini tidak diikuti baris "Assignment is due".';
  const dropPending = (why: string) => {
    if (st.pending) issues.push({ line: st.pending.line, text: st.pending.title, reason: why });
    st.pending = null;
  };

  for (const l of lines) {
    const t = l.text;

    if (NOISE.has(t.toLowerCase())) { st.ignored++; continue; }

    const d = readDate(t);
    if (d) {
      dropPending(NO_TYPE);
      st.last = null;
      st.time = null;
      if ("error" in d) { st.date = null; st.dateBroken = true; st.dateWarnings = []; issue(l, d.error); }
      else { st.date = d.date; st.dateBroken = false; st.dateWarnings = d.warnings; }
      continue;
    }

    const tm = readTime(t);
    if (tm) {
      dropPending(NO_TYPE);
      st.last = null;
      if ("error" in tm) { st.time = null; issue(l, tm.error); }
      else st.time = tm.time;
      continue;
    }

    const url = lineUrl(t);
    if (url) {
      if (st.pending && !st.pending.url) st.pending.url = url;
      else if (st.last && !st.last.url) st.last.url = url;
      else issue(l, "URL ini tidak punya judul tugas di dekatnya, jadi diabaikan.");
      st.last = null;
      continue;
    }

    const assignment = readAssignmentLine(t);
    if (assignment) {
      st.last = null;
      const p = st.pending;
      if (!p) { issue(l, 'Baris "Assignment is due" ini tidak punya judul tugas di atasnya.'); continue; }
      st.pending = null;
      if (!st.date) {
        issues.push({
          line: p.line, text: p.title,
          reason: st.dateBroken ? "Tanggal di atas tugas ini tidak valid, jadi tugasnya tidak bisa dibaca." : "Belum ada baris tanggal di atas tugas ini.",
        });
        st.time = null;
        continue;
      }
      const warnings = [...p.warnings, ...st.dateWarnings];
      if (st.time === null) warnings.push("Jamnya tidak ditemukan di teks, jadi tugas ini diimpor tanpa jam.");
      if (!assignment.subject) warnings.push("Nama mata kuliah tidak ada di teks.");
      const draft: TaskDraft = {
        line: p.line, title: p.title, subjectName: assignment.subject, deadline: st.date, deadlineTime: st.time ?? "",
        url: p.url, sourceStatus: "", warnings,
      };
      drafts.push(draft);
      st.last = draft;
      st.time = null; // every task needs its own time line
      continue;
    }

    // Anything else is a title, unless a title is already waiting for its "Assignment is due" line.
    if (st.pending) {
      const kind = readOtherEventLine(t);
      if (kind) {
        issues.push({ line: st.pending.line, text: st.pending.title, reason: `Jenis agendanya "${kind}", bukan "Assignment is due", jadi dilewati.` });
        st.pending = null;
        st.time = null;
        continue;
      }
      dropPending(NO_TYPE);
    }
    st.last = null;
    const link = readLink(t);
    if (!link.title) { issue(l, "Judulnya kosong."); continue; }
    st.pending = { line: l.n, title: link.title, url: link.url, warnings: link.warnings };
  }
  dropPending(NO_TYPE);
  return { drafts, issues, ignored: st.ignored };
}

export const broneSource: ImportSourceDef = {
  key: "brone",
  label: "BRONE",
  target: "tasks",
  summary: "Tugas beserta tanggal dan jam deadline dari halaman agenda BRONE (Moodle).",
  howTo: "Buka halaman agenda di BRONE, blok daftar agendanya (dari tanggal pertama sampai terakhir), salin, lalu tempel di sini.",
  parse: parseBrone,
};
