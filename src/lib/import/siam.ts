import { isValidTime, timeToMinutes } from "../date";
import { nameKey, splitLines } from "./text";
import type { ParseIssue, ScheduleDraft, ScheduleImportSourceDef, ScheduleParseResult, SiamFormat } from "./types";

/**
 * SIAM class schedule, pasted as a Markdown table (pipes) or as tab-separated text (copied from the page).
 * Two layouts, told apart by the header row (never by guessing from the data):
 *   Format 1: Hari | Jam | Mata Kuliah | Kelas | Dosen | Ruang | Action   ("Action" is ignored)
 *   Format 2: Hari | MK | Jam | Ruang
 * Columns are found by their header NAME, so a different column order still reads correctly.
 * Pure: no clock, no storage. The time is used as written (WIB), the weekday comes from the day name
 * (0 = Sunday); no Date object is involved, so no time zone can shift anything.
 */

const DAYS: Record<string, number> = {
  minggu: 0, ahad: 0, senin: 1, selasa: 2, rabu: 3, kamis: 4, jumat: 5, sabtu: 6,
  sun: 0, sunday: 0, mon: 1, monday: 1, tue: 2, tues: 2, tuesday: 2, wed: 3, wednesday: 3,
  thu: 4, thur: 4, thurs: 4, thursday: 4, fri: 5, friday: 5, sat: 6, saturday: 6,
};

/** "Senin", "SENIN", "Jum'at" -> 0..6, or null. */
export function readWeekday(text: string): number | null {
  const key = text.replace(/[’'`´]/g, "").trim().toLowerCase();
  return key in DAYS ? DAYS[key] : null;
}

// Optional seconds (":00") because the real SIAM page writes "07:00:00 - 08:40:00".
const TIME_RANGE = /^(\d{1,2})[:.](\d{2})(?:[:.]\d{2})?\s*(?:-|–|—|»|s\/d|sd|sampai|to)\s*(\d{1,2})[:.](\d{2})(?:[:.]\d{2})?(?:\s*WIB)?$/i;

export type RangeRead = { start: string; end: string } | { error: string } | null;

/** "07.00 - 08.40", "07:00-08:40", "07:00:00 - 08:40:00", "7.00 s/d 8.40 WIB". null = not a time range at all. */
export function readTimeRange(text: string): RangeRead {
  const m = TIME_RANGE.exec(text.trim());
  if (!m) return null;
  const pad = (h: string, mi: string) => `${h.padStart(2, "0")}:${mi}`;
  const start = pad(m[1], m[2]);
  const end = pad(m[3], m[4]);
  if (!isValidTime(start) || !isValidTime(end)) return { error: `Jam "${text}" tidak valid.` };
  if ((timeToMinutes(end) ?? 0) <= (timeToMinutes(start) ?? 0)) return { error: `Jam selesai harus setelah jam mulai ("${text}").` };
  return { start, end };
}

/* ---------------- table plumbing ---------------- */

type Column = "hari" | "jam" | "mk" | "kelas" | "dosen" | "ruang" | "action";
const HEADER_NAMES: Record<string, Column> = {
  hari: "hari", jam: "jam", "mata kuliah": "mk", matakuliah: "mk", mk: "mk", kelas: "kelas",
  dosen: "dosen", "dosen pengampu": "dosen", ruang: "ruang", ruangan: "ruang", action: "action", aksi: "action",
};

/** Cells of a table row, or null when the line has neither pipes nor tabs. */
function splitRow(text: string): string[] | null {
  if (text.includes("|")) {
    let t = text.trim();
    if (t.startsWith("|")) t = t.slice(1);
    if (t.endsWith("|") && !t.endsWith("\\|")) t = t.slice(0, -1);
    return t.split(/(?<!\\)\|/).map((c) => c.replace(/\\\|/g, "|").trim());
  }
  if (text.includes("\t")) return text.split("\t").map((c) => c.trim());
  return null;
}

const isSeparatorRow = (cells: string[]) => cells.length > 0 && cells.every((c) => /^:?-{2,}:?$/.test(c) || c === "");

/** Plain text of a cell: no <br>, no Markdown emphasis or links, single spaces. A lone dash means "empty". */
function cleanCell(cell: string): string {
  let v = cell
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/(\*\*|__|`)/g, "");
  v = v.split("\n").map((p) => p.replace(/\s+/g, " ").trim()).filter(Boolean).join(", ");
  return /^[-–—]+$/.test(v) ? "" : v;
}

function readHeader(cells: string[]): Map<Column, number> | null {
  const map = new Map<Column, number>();
  cells.forEach((c, i) => {
    const col = HEADER_NAMES[nameKey(cleanCell(c))];
    if (col && !map.has(col)) map.set(col, i);
  });
  return map.has("hari") && map.has("jam") && map.has("mk") ? map : null;
}

/** Format 1 has a "Mata Kuliah" column, Format 2 an "MK" column. */
function formatOf(cells: string[], cols: Map<Column, number>): SiamFormat {
  const mkCell = nameKey(cleanCell(cells[cols.get("mk") as number] ?? ""));
  return mkCell === "mk" ? 2 : 1;
}

const CODE_FIRST = /^([A-Za-z]{2,6}\s?\d{3,6})\s*[-–:]\s*(.+)$/;
const CODE_PAREN_FIRST = /^\(\s*([A-Za-z]{2,6}\s?\d{3,6})\s*\)\s*(.+)$/; // "(CIF65318) Jaringan Saraf Tiruan" (real SIAM)
const CODE_LAST = /^(.+?)\s*\(\s*([A-Za-z]{2,6}\s?\d{3,6})\s*\)$/;

/** Splits a code off only when the cell literally contains one; the name is never altered otherwise. */
function splitSubject(text: string): { name: string; code: string } {
  const a = CODE_FIRST.exec(text);
  if (a) return { name: a[2].trim(), code: a[1].replace(/\s+/g, "").toUpperCase() };
  const pf = CODE_PAREN_FIRST.exec(text);
  if (pf) return { name: pf[2].trim(), code: pf[1].replace(/\s+/g, "").toUpperCase() };
  const b = CODE_LAST.exec(text);
  if (b) return { name: b[1].trim(), code: b[2].replace(/\s+/g, "").toUpperCase() };
  return { name: text, code: "" };
}

const ONLINE_ROOM = /\b(online|daring|zoom|meet|teams|google meet|e-?learning|brone)\b/i;
export const isOnlineRoom = (room: string) => ONLINE_ROOM.test(room);

/** Quick check used for a "wrong source" hint: does the text contain a SIAM-style header row? */
export function looksLikeSiam(text: string): boolean {
  return splitLines(text).some((l) => {
    const cells = splitRow(l.text);
    return cells !== null && readHeader(cells) !== null;
  });
}

export function parseSiam(text: string): ScheduleParseResult {
  const lines = splitLines(text);
  const drafts: ScheduleDraft[] = [];
  const issues: ParseIssue[] = [];
  let ignored = 0;
  let format: SiamFormat | null = null;
  let cols: Map<Column, number> | null = null;
  let headerWithoutSeparators = false;

  const issue = (line: number, raw: string, reason: string) => issues.push({ line, text: raw, reason });

  for (const { n, text: raw } of lines) {
    const cells = splitRow(raw);
    if (!cells) {
      if (!cols && /^hari\b.*\bjam\b/i.test(nameKey(raw))) headerWithoutSeparators = true;
      ignored++;
      continue;
    }
    const header = readHeader(cells);
    if (header) {
      cols = header;
      const f = formatOf(cells, header);
      if (format === null) format = f;
      else if (format !== f) issue(n, raw, "Format tabel berubah di tengah teks. Baris sesudahnya dibaca dengan format yang baru.");
      format = f;
      continue;
    }
    if (isSeparatorRow(cells)) continue;
    if (!cols) { ignored++; continue; }

    const get = (c: Column) => cleanCell(cells[cols!.get(c) ?? -1] ?? "");
    const hariText = get("hari"), jamText = get("jam"), mkText = get("mk");
    if (!hariText && !jamText && !mkText) continue; // an empty row

    const day = readWeekday(hariText);
    if (day === null) { issue(n, raw, hariText ? `Hari "${hariText}" tidak dikenali.` : "Kolom hari kosong."); continue; }
    if (!mkText) { issue(n, raw, "Nama mata kuliah kosong."); continue; }
    const range = readTimeRange(jamText);
    if (range === null) { issue(n, raw, jamText ? `Jam "${jamText}" tidak bisa dibaca. Format yang dikenali: 07.00 - 08.40.` : "Kolom jam kosong."); continue; }
    if ("error" in range) { issue(n, raw, range.error); continue; }

    const { name, code } = splitSubject(mkText);
    const room = get("ruang");
    const warnings: string[] = [];
    if (!room) warnings.push("Ruangnya kosong di sumber.");
    drafts.push({
      line: n, dayOfWeek: day, startTime: range.start, endTime: range.end,
      subjectName: name, subjectCode: code,
      className: format === 1 ? get("kelas") : "", lecturer: format === 1 ? get("dosen") : "",
      room, warnings,
    });
  }

  if (!cols) {
    issue(0, "", headerWithoutSeparators
      ? "Kolom tabelnya tidak terpisah (tidak ada tanda | atau tab). Salin ulang tabelnya langsung dari SIAM, atau tempel versi Markdown-nya."
      : "Header tabel tidak ditemukan. Pastikan baris judul kolom ikut tersalin: Hari, Jam, Mata Kuliah (atau MK), dan seterusnya.");
  }
  return { drafts, issues, ignored, format };
}

export const siamSource: ScheduleImportSourceDef = {
  key: "siam",
  label: "SIAM",
  target: "schedules",
  summary: "Jadwal kuliah dari SIAM. Format 1 (Hari, Jam, Mata Kuliah, Kelas, Dosen, Ruang) dan Format 2 (Hari, MK, Jam, Ruang) dikenali otomatis dari judul kolomnya.",
  howTo: "Buka halaman jadwal di SIAM, blok seluruh tabelnya termasuk baris judul kolom, salin, lalu tempel di sini. Teks Markdown dengan tanda | juga bisa.",
  parse: parseSiam,
};
