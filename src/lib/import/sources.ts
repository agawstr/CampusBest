import { broneSource } from "./brone";
import { classroomSource } from "./classroom";
import { siamSource } from "./siam";
import type { ImportSourceDef, ImportSourceKey, ParseResult, ScheduleImportSourceDef, ScheduleParseResult } from "./types";

/**
 * Registry of import sources. To add one (e.g. SIAM in Bulk Import 2), write a parser module that returns
 * a ParseResult and add its definition here; the UI lists whatever is registered for the target it handles.
 */
export const IMPORT_SOURCES: readonly ImportSourceDef[] = [classroomSource, broneSource];

export function getImportSource(key: ImportSourceKey): ImportSourceDef {
  const found = IMPORT_SOURCES.find((s) => s.key === key);
  if (!found) throw new Error(`Unknown import source: ${key}`);
  return found;
}

/** Sources that produce class schedules (Bulk Import 2). A separate list: the task lane above doesn't change. */
export const SCHEDULE_SOURCES: readonly ScheduleImportSourceDef[] = [siamSource];

/** Pasted text above this size is refused (a few thousand lines of agenda is far below it). */
export const MAX_IMPORT_CHARS = 200_000;
/** More tasks than this in one paste are cut off, with a note. */
export const MAX_IMPORT_ITEMS = 500;

const empty = (reason: string): ParseResult => ({ drafts: [], issues: [{ line: 0, text: "", reason }], ignored: 0 });

/** Runs a parser with the guard rails: empty text, huge text, parser failure, nothing found. Never throws. */
export function runParser(source: ImportSourceDef, text: string): ParseResult {
  if (typeof text !== "string" || text.trim() === "") return empty("Teksnya masih kosong. Tempel dulu teks dari sumbernya.");
  if (text.length > MAX_IMPORT_CHARS) return empty("Teksnya terlalu panjang. Pecah jadi beberapa bagian, lalu impor satu per satu.");
  let result: ParseResult;
  try {
    result = source.parse(text);
  } catch {
    return empty("Teksnya tidak bisa dibaca. Cek lagi apakah sumber yang dipilih sudah benar.");
  }
  if (result.drafts.length > MAX_IMPORT_ITEMS) {
    const extra = result.drafts.length - MAX_IMPORT_ITEMS;
    result = {
      ...result,
      drafts: result.drafts.slice(0, MAX_IMPORT_ITEMS),
      issues: [...result.issues, { line: 0, text: "", reason: `Terlalu banyak tugas. ${extra} tugas terakhir tidak ikut dibaca, impor sisanya di putaran berikutnya.` }],
    };
  }
  if (result.drafts.length === 0 && result.issues.length === 0) {
    return empty(`Tidak ada tugas yang bisa dibaca dari teks ini. Cek apakah kamu memilih sumber ${source.label} yang benar.`);
  }
  return result;
}

/** A cheap guess about which source the text came from, used only to hint at a wrong choice (never switches by itself). */
export function detectSource(text: string): ImportSourceKey | null {
  if (/Assignment is due/i.test(text)) return "brone";
  if (/\bTurned in\b|\bhttps?:\/\/classroom\.google\.com\//i.test(text)) return "google_classroom";
  return null;
}

/** More schedule rows than this in one paste are cut off, with a note (a semester has far fewer). */
export const MAX_SCHEDULE_ITEMS = 300;

const emptySchedule = (reason: string): ScheduleParseResult => ({ drafts: [], issues: [{ line: 0, text: "", reason }], ignored: 0, format: null });

/** Same guard rails as runParser, for the schedule lane. Never throws. */
export function runScheduleParser(source: ScheduleImportSourceDef, text: string): ScheduleParseResult {
  if (typeof text !== "string" || text.trim() === "") return emptySchedule("Teksnya masih kosong. Tempel dulu tabel jadwal dari SIAM.");
  if (text.length > MAX_IMPORT_CHARS) return emptySchedule("Teksnya terlalu panjang. Pecah jadi beberapa bagian, lalu impor satu per satu.");
  let result: ScheduleParseResult;
  try {
    result = source.parse(text);
  } catch {
    return emptySchedule("Teksnya tidak bisa dibaca. Cek lagi apakah yang ditempel tabel jadwal dari SIAM.");
  }
  if (result.drafts.length > MAX_SCHEDULE_ITEMS) {
    const extra = result.drafts.length - MAX_SCHEDULE_ITEMS;
    result = {
      ...result,
      drafts: result.drafts.slice(0, MAX_SCHEDULE_ITEMS),
      issues: [...result.issues, { line: 0, text: "", reason: `Terlalu banyak baris. ${extra} baris terakhir tidak ikut dibaca, impor sisanya di putaran berikutnya.` }],
    };
  }
  if (result.drafts.length === 0 && result.issues.length === 0) {
    return { ...result, issues: [{ line: 0, text: "", reason: "Tidak ada jadwal yang bisa dibaca dari teks ini." }] };
  }
  return result;
}
