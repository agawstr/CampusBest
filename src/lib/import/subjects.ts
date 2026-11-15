import type { Subject } from "@/types";
import { nameKey } from "./text";

/**
 * Matching a subject name from the source (e.g. "Komputer Grafis") to the user's Subjects.
 *  - exact:   the names (or code, or "code name") are the same after ignoring case, accents and punctuation.
 *  - similar: not the same, but close enough that linking it may be right. The user must decide.
 *  - ambiguous: more than one Subject matches exactly. The user must decide.
 *  - none:    nothing close.
 * Only "exact" is ever applied automatically.
 */
export type SubjectMatch =
  | { kind: "exact"; subject: Subject }
  | { kind: "similar"; candidates: Subject[] }
  | { kind: "ambiguous"; candidates: Subject[] }
  | { kind: "none" };

function exactKeys(subject: Subject): string[] {
  const name = nameKey(subject.name);
  const code = subject.code ? nameKey(subject.code) : "";
  const keys = [name];
  if (code) keys.push(code, `${code} ${name}`, `${name} ${code}`);
  return keys.filter(Boolean);
}

function tokens(key: string): Set<string> {
  return new Set(key.split(" ").filter((w) => w.length > 1));
}

/** Containment of one name in the other, or most words shared. Both need some substance (>= 4 letters). */
function isSimilar(a: string, b: string): boolean {
  if (a.length < 4 || b.length < 4) return false;
  if (a.includes(b) || b.includes(a)) return true;
  const ta = tokens(a), tb = tokens(b);
  if (ta.size === 0 || tb.size === 0) return false;
  let shared = 0;
  ta.forEach((w) => { if (tb.has(w)) shared++; });
  return shared / Math.min(ta.size, tb.size) >= 0.75 && shared >= 2;
}

export function matchSubject(sourceName: string, subjects: readonly Subject[]): SubjectMatch {
  const key = nameKey(sourceName);
  if (!key) return { kind: "none" };
  const exact = subjects.filter((s) => exactKeys(s).includes(key));
  if (exact.length === 1) return { kind: "exact", subject: exact[0] };
  if (exact.length > 1) return { kind: "ambiguous", candidates: exact };
  const similar = subjects.filter((s) => isSimilar(key, nameKey(s.name)));
  return similar.length > 0 ? { kind: "similar", candidates: similar } : { kind: "none" };
}
