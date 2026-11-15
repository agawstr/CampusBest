import { isValidTime, parseDateKey } from "../date";

export interface Line { n: number; text: string }

/** Zero-width characters and no-break spaces show up in copied web text; neither belongs in a title. */
const INVISIBLE = /[​-‍⁠﻿]/g;

/** Splits into trimmed, non-empty lines, remembering each line's 1-based number in the original text. */
export function splitLines(text: string): Line[] {
  const out: Line[] = [];
  const lines = String(text ?? "").replace(/\r\n?/g, "\n").split("\n");
  lines.forEach((raw, i) => {
    const t = raw.replace(INVISIBLE, "").replace(/ /g, " ").replace(/[^\S\t]+/g, " ").replace(/ ?\t[ \t]*/g, "\t").trim();
    if (t) out.push({ n: i + 1, text: t });
  });
  return out;
}

/** Normalizes for comparing names/titles: no case, no accents, no punctuation, single spaces. */
export function nameKey(value: string): string {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/** Only http(s) is accepted (blocks javascript:, data:, file: ...). Returns the URL as written, or null. */
export function safeUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const v = value.trim();
  if (!/^https?:\/\//i.test(v) || /\s/.test(v)) return null;
  try {
    const u = new URL(v);
    return u.protocol === "http:" || u.protocol === "https:" ? v : null;
  } catch {
    return null;
  }
}

/** For comparing URLs: host in lower case, no #fragment, no trailing slash. Falls back to the trimmed text. */
export function urlKey(value: string): string {
  const v = value.trim();
  try {
    const u = new URL(v);
    u.hash = "";
    const path = u.pathname.replace(/\/+$/, "");
    return `${u.protocol}//${u.host.toLowerCase()}${path}${u.search}`;
  } catch {
    return v;
  }
}

const BARE_URL = /^(.*\S)\s+(https?:\/\/\S+)$/i;
// The URL may contain one level of balanced parentheses, e.g. https://en.wikipedia.org/wiki/Foo_(bar) or javascript:alert(1).
const MD_LINK = /^\[(.+)\]\(\s*<?((?:[^\s()<>]|\([^\s()<>]*\))+)>?(?:\s+["'][^"']*["'])?\s*\)$/;

export interface LinkRead {
  title: string;
  url: string;
  /** True when the text had link syntax (a Markdown link). */
  linked: boolean;
  warnings: string[];
}

/** Single spaces, no surrounding space (a tab can survive splitLines, see below). */
function tidy(v: string): string { return v.replace(/\s+/g, " ").trim(); }

function trimUrlTail(url: string): string {
  let u = url.replace(/[.,;:!?]+$/, "");
  while (u.endsWith(")") && (u.match(/\(/g)?.length ?? 0) < (u.match(/\)/g)?.length ?? 0)) u = u.slice(0, -1);
  return u;
}

/**
 * Reads a title that may be a Markdown link `[title](url)` or may end with a bare URL.
 * A link whose URL isn't http(s) keeps its text and drops the URL (with a warning). URLs are never invented.
 */
export function readLink(text: string): LinkRead {
  const md = MD_LINK.exec(text);
  if (md) {
    const url = safeUrl(md[2]);
    return {
      title: tidy(md[1]), url: url ?? "", linked: true,
      warnings: url ? [] : ["Tautannya dibuang karena bukan alamat http/https."],
    };
  }
  const bare = BARE_URL.exec(text);
  if (bare) {
    const url = safeUrl(trimUrlTail(bare[2]));
    if (url) return { title: tidy(bare[1]), url, linked: false, warnings: [] };
  }
  return { title: tidy(text), url: "", linked: false, warnings: [] };
}

/** A line that is nothing but one http(s) URL (optionally in angle brackets). Returns the URL or null. */
export function lineUrl(text: string): string | null {
  const m = /^<?(https?:\/\/[^\s<>]+)>?$/i.exec(text);
  return m ? safeUrl(trimUrlTail(m[1])) : null;
}

/* ---------------- times ---------------- */

export type TimeRead = { time: string } | { error: string } | null;

/**
 * "23:59", "00:00", "7:05", "11:59 PM", "10:00 » 11:00" (first time wins). null = not a time line.
 * "00:00" is a valid time on purpose.
 */
export function readTime(text: string): TimeRead {
  const m = /^(\d{1,2})[:.](\d{2})(?:\s*(AM|PM))?(?:\s*(?:»|–|-|to)\s*\d{1,2}[:.]\d{2}(?:\s*(?:AM|PM))?)?$/i.exec(text);
  if (!m) return null;
  let hour = Number(m[1]);
  const minute = Number(m[2]);
  const ampm = m[3]?.toUpperCase();
  if (ampm) {
    if (hour < 1 || hour > 12) return { error: `Jam "${text}" tidak valid.` };
    hour = (hour % 12) + (ampm === "PM" ? 12 : 0);
  }
  const time = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  return isValidTime(time) ? { time } : { error: `Jam "${text}" tidak valid.` };
}

/* ---------------- dates ---------------- */

const MONTHS: Record<string, number> = {
  january: 1, jan: 1, januari: 1, february: 2, feb: 2, februari: 2, march: 3, mar: 3, maret: 3,
  april: 4, apr: 4, may: 5, mei: 5, june: 6, jun: 6, juni: 6, july: 7, jul: 7, juli: 7,
  august: 8, aug: 8, agu: 8, agt: 8, agustus: 8, september: 9, sep: 9, sept: 9,
  october: 10, oct: 10, okt: 10, oktober: 10, november: 11, nov: 11, nop: 11, december: 12, dec: 12, des: 12, desember: 12,
};

const WEEKDAYS: Record<string, number> = {
  sunday: 0, sun: 0, minggu: 0, monday: 1, mon: 1, senin: 1, tuesday: 2, tue: 2, tues: 2, selasa: 2,
  wednesday: 3, wed: 3, rabu: 3, thursday: 4, thu: 4, thur: 4, thurs: 4, kamis: 4, friday: 5, fri: 5, jumat: 5, "jum'at": 5,
  saturday: 6, sat: 6, sabtu: 6,
};

const RELATIVE_WORDS = new Set(["today", "tomorrow", "yesterday", "hari ini", "besok", "kemarin"]);

export type DateRead = { date: string; warnings: string[] } | { error: string } | null;

/**
 * "Monday, 16 November 2026", "16 Nov 2026", "Senin, 16 November 2026". English and Indonesian month and
 * weekday names. null = not a date line. A date that doesn't exist (31 November) is an error, and a weekday
 * that doesn't match the date only produces a warning. The result is a plain "YYYY-MM-DD" key: there is
 * no time zone conversion anywhere.
 */
export function readDate(text: string): DateRead {
  const m = /^(?:([A-Za-z']+(?: [A-Za-z]+)?),\s*)?(\d{1,2})\s+([A-Za-z]+)\.?,?\s+(\d{4})$/.exec(text);
  if (!m) return null;
  const month = MONTHS[m[3].toLowerCase()];
  if (!month) return null;
  const lead = m[1]?.toLowerCase();
  if (lead && !(lead in WEEKDAYS) && !RELATIVE_WORDS.has(lead)) return null;
  const day = Number(m[2]);
  const year = Number(m[4]);
  const key = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const parsed = parseDateKey(key);
  if (!parsed) return { error: `Tanggal "${text}" tidak ada di kalender.` };
  const warnings: string[] = [];
  if (lead && lead in WEEKDAYS && WEEKDAYS[lead] !== parsed.getDay()) {
    warnings.push(`Nama harinya ("${m[1]}") tidak cocok dengan tanggalnya, cek lagi ya.`);
  }
  return { date: key, warnings };
}
