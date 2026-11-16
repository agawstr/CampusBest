import type { Subject } from "@/types";

/**
 * Short labels for the calendar: a subject abbreviation (typed on the Subjects page, or made from the
 * name), and the "P" suffix for practicum (lab) sessions. Pure functions, no storage, no clock.
 * `Subject.code` is the official course code and is never used here.
 */

export const MAX_ABBR_LENGTH = 6;

/**
 * HOW A ROOM IS RECOGNISED AS A LAB (edit here to adjust):
 *  1. The room text has the word "lab", "laboratorium" or "praktikum" ("Lab Pembelajaran Gedung G - G1.5").
 *     Whole words only, so "Labuan" does not count.
 *  2. Or its room code (the last code such as G1.5 in the text, so a bare "G1.5" works) is in LAB_ROOM_CODES.
 * Nothing else counts: "Gedung G" or "Gedung F FILKOM - F3.17" is NOT a lab only because of its building letter.
 * LAB_ROOM_CODES is matched exactly (case-insensitive): "G1.5" does not match "G1.50" or "F3.5".
 */
export const LAB_ROOM_CODES: readonly string[] = ["G1.2", "G1.5"];
const LAB_WORD = /\b(?:lab|laboratorium|praktikum)\b/i;
const ROOM_CODE = /\b[A-Za-z]{1,3}\d+(?:\.\d+)*\b/g;

/** The last room code in the text ("Gedung F FILKOM - F3.17" -> "F3.17"), or null. */
export function roomCode(room: string | undefined | null): string | null {
  if (!room) return null;
  const all = room.match(ROOM_CODE);
  return all && all.length > 0 ? all[all.length - 1].toUpperCase() : null;
}

export function isLabRoom(room: string | undefined | null, codes: readonly string[] = LAB_ROOM_CODES): boolean {
  if (typeof room !== "string" || room.trim() === "") return false;
  if (LAB_WORD.test(room)) return true;
  const code = roomCode(room);
  return code !== null && codes.some((c) => c.trim().toUpperCase() === code);
}

const STOP_WORDS = new Set(["dan", "dengan", "untuk", "di", "ke", "pada", "yang", "atau", "dari", "of", "and", "the", "for", "in", "to", "a"]);
const isNumberWord = (w: string) => /^\d+$/.test(w) || /^(?:ii|iii|iv|v|vi|vii|viii|ix|x)$/i.test(w);

/**
 * Abbreviation made from a subject name when none was typed:
 * "Jaringan Saraf Tiruan" -> JST, "Pengembangan Aplikasi Perangkat Bergerak" -> PAPB,
 * "Pemrograman Web 2" -> PW2, "Machine Learning Operations (MLOps)" -> MLOPS (acronym in brackets), "Statistika" -> STAT.
 */
export function autoAbbreviation(name: string | undefined | null): string {
  const text = typeof name === "string" ? name.replace(/\s+/g, " ").trim() : "";
  if (!text) return "MK";
  // An acronym in brackets (at least two capitals, one word, up to 6 characters) wins.
  const bracket = text.match(/\(([A-Za-z0-9]{2,6})\)/);
  if (bracket && (bracket[1].match(/[A-Z]/g) ?? []).length >= 2) return bracket[1].toUpperCase();

  const words = text.replace(/\([^)]*\)/g, " ").split(/[^A-Za-z0-9]+/).filter(Boolean);
  const letters: string[] = [];
  const numbers: string[] = [];
  words.forEach((w, i) => {
    if (STOP_WORDS.has(w.toLowerCase())) return;
    if (i > 0 && isNumberWord(w)) numbers.push(w.toUpperCase());
    else letters.push(w);
  });
  if (letters.length === 0) return (numbers.join("") || "MK").slice(0, MAX_ABBR_LENGTH);
  const base = letters.length === 1 ? letters[0].slice(0, 4).toUpperCase() : letters.map((w) => w[0]).join("").toUpperCase();
  return (base.slice(0, MAX_ABBR_LENGTH - Math.min(numbers.join("").length, 2)) + numbers.join("")).slice(0, MAX_ABBR_LENGTH);
}

/** Typed abbreviation (trimmed), else the automatic one. Never `Subject.code`. */
export function subjectAbbreviation(subject: Pick<Subject, "name" | "abbr">): string {
  const typed = typeof subject.abbr === "string" ? subject.abbr.replace(/\s+/g, " ").trim() : "";
  return typed !== "" ? typed : autoAbbreviation(subject.name);
}

/** "JST" for a normal session, "JST P" for a practicum session (never "JST P P"). */
export function classLabel(abbr: string, lab: boolean): string {
  return lab && !/\sP$/.test(abbr) ? `${abbr} P` : abbr;
}

/** Compact name for tasks and events; the full title stays in `title`. */
export function shortenTitle(title: string | undefined | null, max = 12): string {
  const t = typeof title === "string" ? title.replace(/\s+/g, " ").trim() : "";
  if (t.length <= max) return t;
  return `${t.slice(0, Math.max(1, max - 1)).trimEnd()}…`;
}

/** What the Subjects form accepts for the abbreviation. */
export function validateAbbr(value: string): string | undefined {
  const t = value.replace(/\s+/g, " ").trim();
  if (t.length > MAX_ABBR_LENGTH) return `Singkatan maksimal ${MAX_ABBR_LENGTH} karakter.`;
  return undefined;
}
