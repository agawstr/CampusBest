import type { StorageName } from "@/types";
import { APP_NAME } from "./brand";
import { DEFAULT_SETTINGS } from "./normalize";
import { APP_VERSION } from "./pwa";

/**
 * Backup (export) and restore (import) of everything CampusBest stores. This file is pure: it never touches
 * storage, the browser, or the clock (`now` comes in). lib/backup-store.ts reads and writes.
 *
 * Principles:
 *  - Work on the RAW stored values, not the normalized ones, so legacy fields, unknown fields and entries the
 *    app could not type all survive an export and a restore untouched.
 *  - The running Focus Timer (`settings.focusTimer`) is never exported and never restored.
 *  - Validation is strict about the shape of the file and lenient about the content of records (the app's own
 *    normalizer already copes with old or odd records when they are read).
 *  - The preview and the write are computed by the same `planImport`, so what you see is what is written.
 */

export const BACKUP_FORMAT = "campusbest-backup";
export const BACKUP_FORMAT_VERSION = 1;
/** Highest settings schemaVersion this build understands. A file from a newer schema is refused. */
export const SUPPORTED_SCHEMA_VERSION = DEFAULT_SETTINGS.schemaVersion;
/** Larger than LocalStorage can hold anyway (about 5 MB); a bigger file is not one of ours. */
export const MAX_BACKUP_CHARS = 8 * 1024 * 1024;

/** Collections every backup file must carry (unchanged since format version 1). */
export const COLLECTION_NAMES = ["subjects", "tasks", "schedules", "events", "notes", "focusSessions"] as const;
/**
 * Collections added later. Backups made before they existed don't have them, so a missing one is NOT an error:
 * it is reported as absent and left untouched on this device (never read as "empty"). A present one must be a list.
 */
export const OPTIONAL_COLLECTION_NAMES = ["activities"] as const;
export const ALL_COLLECTION_NAMES = [...COLLECTION_NAMES, ...OPTIONAL_COLLECTION_NAMES] as const;
export type CollectionName = (typeof ALL_COLLECTION_NAMES)[number];
const isOptionalName = (name: CollectionName): boolean => (OPTIONAL_COLLECTION_NAMES as readonly string[]).includes(name);
export const BACKUP_NAMES: readonly StorageName[] = [...ALL_COLLECTION_NAMES, "settings"];

export const COLLECTION_LABELS: Record<CollectionName, string> = {
  subjects: "Mata kuliah",
  tasks: "Tugas",
  schedules: "Jadwal",
  events: "Ujian & event",
  notes: "Catatan",
  focusSessions: "Sesi fokus",
  activities: "Kegiatan lain",
};

/** Raw stored value per storage name. `null` = the key does not exist. */
export type Snapshot = Record<StorageName, unknown>;

type Rec = Record<string, unknown>;
export const isPlainObject = (v: unknown): v is Rec => typeof v === "object" && v !== null && !Array.isArray(v);

/* ---------------- small helpers ---------------- */

/** Structural equality, independent of key order. */
export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b || a === null || b === null || typeof a !== "object") return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((x, i) => deepEqual(x, b[i]));
  const ka = Object.keys(a as Rec), kb = Object.keys(b as Rec);
  return ka.length === kb.length && ka.every((k) => Object.prototype.hasOwnProperty.call(b, k) && deepEqual((a as Rec)[k], (b as Rec)[k]));
}

const idOf = (item: unknown): string | undefined =>
  isPlainObject(item) && typeof item.id === "string" && item.id !== "" ? item.id : undefined;

function stamp(item: unknown): number | undefined {
  if (!isPlainObject(item) || typeof item.updatedAt !== "string") return undefined;
  const t = Date.parse(item.updatedAt);
  return Number.isFinite(t) ? t : undefined;
}

/**
 * Merge rule when both sides have a record with the same id:
 *  1. both have a valid updatedAt: the later one wins; equal -> the one already on this device stays;
 *  2. only one has a valid updatedAt: that one wins;
 *  3. neither has one: the one already on this device stays.
 * `incoming` wins only when this returns true.
 */
export function incomingWins(incoming: unknown, current: unknown): boolean {
  const a = stamp(incoming), b = stamp(current);
  if (a !== undefined && b !== undefined) return a > b;
  return a !== undefined && b === undefined;
}

const stripTimer = (settings: Rec): Rec => {
  const { focusTimer: _ignored, ...rest } = settings;
  void _ignored;
  return rest;
};

const pad = (n: number) => String(n).padStart(2, "0");

/** campusbest-backup-2026-11-15-1030.json, in local time. */
export function backupFilename(now: Date): string {
  return `campusbest-backup-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}.json`;
}

/* ---------------- export ---------------- */

export interface BackupFile { filename: string; content: string; mime: string; counts: Record<CollectionName, number> }

const asArray = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

/** The value a backup carries for settings: the stored object without the running timer ({} when none). */
const settingsForBackup = (raw: unknown): Rec => (isPlainObject(raw) ? stripTimer(raw) : {});

export function buildBackup(snapshot: Snapshot, now: Date): BackupFile {
  const data: Rec = {};
  const counts = {} as Record<CollectionName, number>;
  for (const name of ALL_COLLECTION_NAMES) {
    const list = asArray(snapshot[name]);
    data[name] = list;
    counts[name] = list.length;
  }
  data.settings = settingsForBackup(snapshot.settings);
  const file = {
    app: APP_NAME,
    format: BACKUP_FORMAT,
    formatVersion: BACKUP_FORMAT_VERSION,
    schemaVersion: SUPPORTED_SCHEMA_VERSION,
    appVersion: APP_VERSION,
    exportedAt: now.toISOString(),
    counts,
    data,
  };
  return { filename: backupFilename(now), content: JSON.stringify(file, null, 2), mime: "application/json", counts };
}

/* ---------------- validation ---------------- */

export interface CollectionInfo { total: number; recognized: number; unrecognized: number; duplicateIds: number }

export interface ParsedBackup {
  meta: { appVersion?: string; exportedAt?: string; schemaVersion: number; formatVersion: number };
  data: Record<CollectionName, unknown[]>;
  /** Optional collections the file does not contain at all (an older backup). Their data is [] here but they are never written or cleared. */
  absent: CollectionName[];
  /** Without focusTimer. */
  settings: Rec;
  info: Record<CollectionName, CollectionInfo>;
}

export type ParseOutcome =
  | { ok: true; backup: ParsedBackup; warnings: string[] }
  | { ok: false; errors: string[] };

const isInt = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v);

/** Validates the whole file. Nothing is written here; every problem is reported at once. */
export function parseBackup(text: string): ParseOutcome {
  if (typeof text !== "string" || text.trim() === "") return { ok: false, errors: ["File kosong."] };
  if (text.length > MAX_BACKUP_CHARS) return { ok: false, errors: ["File terlalu besar untuk jadi cadangan CampusBest."] };

  let raw: unknown;
  try { raw = JSON.parse(text.charCodeAt(0) === 0xfeff ? text.slice(1) : text); }
  catch { return { ok: false, errors: ["File ini bukan JSON yang valid. Mungkin rusak atau terpotong."] }; }

  if (!isPlainObject(raw)) return { ok: false, errors: ["Isi file bukan cadangan CampusBest."] };
  const errors: string[] = [];
  const warnings: string[] = [];

  if (raw.app !== APP_NAME || raw.format !== BACKUP_FORMAT) errors.push("Ini bukan file cadangan CampusBest.");
  if (!isInt(raw.formatVersion) || raw.formatVersion < 1) errors.push("Versi format cadangan tidak terbaca.");
  else if (raw.formatVersion > BACKUP_FORMAT_VERSION) errors.push("Cadangan ini dibuat oleh versi CampusBest yang lebih baru. Perbarui aplikasi dulu.");
  if (!isInt(raw.schemaVersion) || raw.schemaVersion < 1) errors.push("Versi skema data tidak terbaca.");
  else if (raw.schemaVersion > SUPPORTED_SCHEMA_VERSION) errors.push("Data di cadangan ini memakai skema yang lebih baru dari aplikasi ini. Perbarui aplikasi dulu.");

  const dataRaw = raw.data;
  if (!isPlainObject(dataRaw)) {
    errors.push("Bagian data tidak ada di file ini.");
    return { ok: false, errors };
  }

  const data = {} as Record<CollectionName, unknown[]>;
  const info = {} as Record<CollectionName, CollectionInfo>;
  const absent: CollectionName[] = [];
  for (const name of ALL_COLLECTION_NAMES) {
    const list = dataRaw[name];
    if (isOptionalName(name) && list === undefined) {
      absent.push(name);
      data[name] = [];
      info[name] = { total: 0, recognized: 0, unrecognized: 0, duplicateIds: 0 };
      continue;
    }
    if (!Array.isArray(list)) { errors.push(`Data "${COLLECTION_LABELS[name]}" tidak ada atau bukan daftar.`); continue; }
    data[name] = list;
    const seen = new Set<string>();
    let recognized = 0, duplicateIds = 0;
    for (const item of list) {
      const id = idOf(item);
      if (id === undefined) continue;
      recognized += 1;
      if (seen.has(id)) duplicateIds += 1; else seen.add(id);
    }
    info[name] = { total: list.length, recognized, unrecognized: list.length - recognized, duplicateIds };
    if (info[name].unrecognized > 0) warnings.push(`${COLLECTION_LABELS[name]}: ${info[name].unrecognized} entri tidak punya id yang valid. Saat Ganti dibawa apa adanya, saat Gabung dilewati.`);
    if (duplicateIds > 0) warnings.push(`${COLLECTION_LABELS[name]}: ${duplicateIds} id muncul lebih dari sekali di file ini.`);
  }
  if (!isPlainObject(dataRaw.settings)) errors.push("Data pengaturan tidak ada atau bukan objek.");

  if (errors.length > 0) return { ok: false, errors };

  if (isPlainObject(raw.counts)) {
    for (const name of ALL_COLLECTION_NAMES) {
      if (absent.includes(name)) continue;
      const claimed = (raw.counts as Rec)[name];
      if (isInt(claimed) && claimed !== data[name].length) warnings.push(`${COLLECTION_LABELS[name]}: jumlah di header (${claimed}) berbeda dari isi file (${data[name].length}). File mungkin diubah.`);
    }
  }
  for (const name of absent) warnings.push(`${COLLECTION_LABELS[name]}: tidak ada di file ini (cadangan dari versi lama). Data ini di perangkat tidak diubah.`);
  if ((raw.schemaVersion as number) < SUPPORTED_SCHEMA_VERSION) warnings.push("Cadangan ini dari versi skema lama. Datanya tetap dibaca dengan aturan kompatibilitas yang sama seperti data lama di aplikasi.");

  return {
    ok: true,
    warnings,
    backup: {
      meta: {
        appVersion: typeof raw.appVersion === "string" ? raw.appVersion : undefined,
        exportedAt: typeof raw.exportedAt === "string" ? raw.exportedAt : undefined,
        schemaVersion: raw.schemaVersion as number,
        formatVersion: raw.formatVersion as number,
      },
      data,
      absent,
      settings: stripTimer(dataRaw.settings as Rec),
      info,
    },
  };
}

/**
 * Checks that a backup we just built really carries this snapshot: it parses, passes validation, and every
 * collection and the settings (minus the timer) come back identical. Used before a Replace is allowed to start.
 */
export function verifyBackupMatches(content: string, snapshot: Snapshot): string | null {
  const parsed = parseBackup(content);
  if (!parsed.ok) return parsed.errors[0];
  for (const name of ALL_COLLECTION_NAMES) {
    if (!deepEqual(parsed.backup.data[name], asArray(snapshot[name]))) return `Isi cadangan untuk "${COLLECTION_LABELS[name]}" tidak sama dengan data di perangkat.`;
  }
  if (!deepEqual(parsed.backup.settings, settingsForBackup(snapshot.settings))) return "Isi cadangan untuk pengaturan tidak sama dengan data di perangkat.";
  return null;
}

/* ---------------- merge / replace plan ---------------- */

export type ImportMode = "merge" | "replace";

export interface CollectionPlan {
  name: CollectionName;
  label: string;
  /** Records on this device now (all entries, including ones the app can't type). */
  current: number;
  /** Entries in the file. */
  incoming: number;
  /** Entries on this device after the import. */
  resulting: number;
  /** Merge only: */
  added: number;
  updated: number;
  unchanged: number;
  /** Same id on both sides and the device copy was kept (newer, equal, or no way to tell). */
  keptCurrent: number;
  /** Entries without a valid id, left out of a merge. */
  skipped: number;
  /** The file has no such collection (older backup): nothing is changed for it, merge or replace. */
  absent?: boolean;
}

export interface ImportPlan {
  mode: ImportMode;
  collections: CollectionPlan[];
  /** What would be written. A name is present only when its stored value really changes. */
  writes: Partial<Record<StorageName, unknown>>;
  settings: "unchanged" | "replaced";
  warnings: string[];
  totals: { current: number; incoming: number; resulting: number };
}

function mergeCollection(name: CollectionName, currentRaw: unknown, incoming: readonly unknown[]): { next: unknown[]; plan: CollectionPlan } {
  // A stored value that is not a list is kept as one opaque entry, like the storage layer keeps it.
  const current: unknown[] = Array.isArray(currentRaw) ? currentRaw : currentRaw === null || currentRaw === undefined ? [] : [currentRaw];
  const next = [...current];
  const index = new Map<string, number>();
  current.forEach((item, i) => { const id = idOf(item); if (id !== undefined && !index.has(id)) index.set(id, i); });

  // The same id twice inside the file: the same rule picks one.
  const picked = new Map<string, unknown>();
  let skipped = 0;
  for (const item of incoming) {
    const id = idOf(item);
    if (id === undefined) { skipped += 1; continue; }
    const seen = picked.get(id);
    if (seen === undefined || incomingWins(item, seen)) picked.set(id, item);
  }

  let added = 0, updated = 0, unchanged = 0, keptCurrent = 0;
  for (const [id, item] of picked) {
    const at = index.get(id);
    if (at === undefined) { next.push(item); added += 1; continue; }
    if (deepEqual(next[at], item)) unchanged += 1;
    else if (incomingWins(item, next[at])) { next[at] = item; updated += 1; }
    else keptCurrent += 1;
  }
  return {
    next,
    plan: { name, label: COLLECTION_LABELS[name], current: current.length, incoming: incoming.length, resulting: next.length, added, updated, unchanged, keptCurrent, skipped },
  };
}

const sameStored = (next: unknown, stored: unknown): boolean => {
  // An absent key and an empty list/object are the same thing to the app; don't create a key for nothing.
  if (stored === null || stored === undefined) return (Array.isArray(next) && next.length === 0) || (isPlainObject(next) && Object.keys(next).length === 0);
  return deepEqual(next, stored);
};

/**
 * Computes the result of an import without writing anything.
 *  - merge:   per collection, by id (see incomingWins). Settings stay as they are on this device.
 *  - replace: every collection becomes exactly the file's list (entries without an id included). Settings become
 *             the file's settings, with this device's running timer carried over untouched.
 */
export function planImport(snapshot: Snapshot, backup: ParsedBackup, mode: ImportMode): ImportPlan {
  const collections: CollectionPlan[] = [];
  const writes: Partial<Record<StorageName, unknown>> = {};
  const warnings: string[] = [];

  for (const name of ALL_COLLECTION_NAMES) {
    const incoming = backup.data[name];
    const currentRaw = snapshot[name];
    let next: unknown[];
    let plan: CollectionPlan;
    if (backup.absent?.includes(name)) {
      // Not in the file: leave what is on this device exactly as it is (an old backup must never wipe newer data).
      const current = Array.isArray(currentRaw) ? currentRaw.length : currentRaw === null || currentRaw === undefined ? 0 : 1;
      collections.push({ name, label: COLLECTION_LABELS[name], current, incoming: 0, resulting: current, added: 0, updated: 0, unchanged: 0, keptCurrent: 0, skipped: 0, absent: true });
      continue;
    }
    if (mode === "merge") {
      ({ next, plan } = mergeCollection(name, currentRaw, incoming));
    } else {
      next = [...incoming];
      const current = Array.isArray(currentRaw) ? currentRaw.length : currentRaw === null || currentRaw === undefined ? 0 : 1;
      plan = { name, label: COLLECTION_LABELS[name], current, incoming: incoming.length, resulting: next.length, added: 0, updated: 0, unchanged: 0, keptCurrent: 0, skipped: 0 };
    }
    collections.push(plan);
    if (!sameStored(next, currentRaw)) writes[name] = next;
  }

  let settings: ImportPlan["settings"] = "unchanged";
  if (mode === "replace") {
    const timer = isPlainObject(snapshot.settings) && "focusTimer" in snapshot.settings ? { focusTimer: snapshot.settings.focusTimer } : {};
    const next: Rec = { ...backup.settings, ...timer };
    if (!sameStored(next, snapshot.settings)) { writes.settings = next; settings = "replaced"; }
  }

  // Absent collections are left out of the comparison: they are not part of what the file would replace.
  const sum = (pick: (c: CollectionPlan) => number) => collections.reduce((n, c) => n + (c.absent ? 0 : pick(c)), 0);
  const totals = { current: sum((c) => c.current), incoming: sum((c) => c.incoming), resulting: sum((c) => c.resulting) };

  if (mode === "replace") {
    if (totals.incoming === 0 && totals.current > 0) warnings.push("File ini tidak berisi data sama sekali. Mengganti akan mengosongkan semua data di perangkat ini.");
    else if (totals.incoming < totals.current) warnings.push(`File ini berisi lebih sedikit data (${totals.incoming}) daripada yang ada di perangkat (${totals.current}). Selisihnya akan hilang dari perangkat ini.`);
  }
  return { mode, collections, writes, settings, warnings, totals };
}

/** true when applying the plan would change nothing. */
export const planIsNoop = (plan: ImportPlan): boolean => Object.keys(plan.writes).length === 0;
