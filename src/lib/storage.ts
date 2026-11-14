import type { StorageName, StorageSchema } from "@/types";
import { DEFAULT_SETTINGS, normalizeCollection, normalizeSettings, restoreCoerced, type CoercionMap } from "./normalize";
import {
  LEGACY_STORAGE_KEYS, LEGACY_STORAGE_PREFIX, MIGRATION_FLAG_KEY, STORAGE_KEYS, STORAGE_PREFIX,
} from "./storage-keys";

// Re-exported so existing imports from "@/lib/storage" keep working.
export { DEFAULT_SETTINGS, LEGACY_STORAGE_KEYS, MIGRATION_FLAG_KEY, STORAGE_KEYS };

const STORAGE_NAMES = Object.keys(STORAGE_KEYS) as StorageName[];

/** Factory so callers never share a mutable default instance. */
export function getDefault<K extends StorageName>(name: K): StorageSchema[K] {
  return (name === "settings" ? { ...DEFAULT_SETTINGS } : []) as StorageSchema[K];
}

/**
 * Backend contract. Async on purpose so an IndexedDB or Supabase adapter can
 * replace LocalStorageAdapter via setStorageAdapter() without changing callers.
 */
export interface StorageAdapter {
  isAvailable(): boolean;
  getRaw(key: string): Promise<unknown>;
  setRaw(key: string, value: unknown): Promise<void>;
  remove(key: string): Promise<void>;
  /** Optional. Lets clearAll() also sweep stray keys that share the app prefixes. */
  listKeys?(): Promise<string[]>;
}

/* ---------------- legacy migration: campusmate_* -> campusbest_* ---------------- */

type KeyValueStore = Pick<Storage, "getItem" | "setItem">;

export interface MigrationReport {
  /** True when the flag was already set, so nothing was inspected. */
  alreadyDone: boolean;
  copied: StorageName[];
  /** New key already existed, so the legacy value was left alone and not copied. */
  keptExisting: StorageName[];
  failed: StorageName[];
}

/**
 * Copy-only migration. Rules:
 *  - a legacy value is copied only when the new key does not exist yet (never overwrites);
 *  - the raw string is copied as is (no parse / re-serialize), so nothing unknown is lost;
 *  - legacy keys are never modified or removed;
 *  - the flag is written only when every copy succeeded, so a failure (e.g. quota) is retried next load.
 * Takes the store as a parameter so it can be tested without a browser.
 */
export function migrateLegacyKeys(store: KeyValueStore): MigrationReport {
  const report: MigrationReport = { alreadyDone: false, copied: [], keptExisting: [], failed: [] };
  try {
    if (store.getItem(MIGRATION_FLAG_KEY) !== null) {
      report.alreadyDone = true;
      return report;
    }
    for (const name of STORAGE_NAMES) {
      try {
        const legacy = store.getItem(LEGACY_STORAGE_KEYS[name]);
        if (legacy === null) continue;
        if (store.getItem(STORAGE_KEYS[name]) !== null) { report.keptExisting.push(name); continue; }
        store.setItem(STORAGE_KEYS[name], legacy);
        report.copied.push(name);
      } catch {
        report.failed.push(name);
      }
    }
    if (report.failed.length === 0) {
      store.setItem(
        MIGRATION_FLAG_KEY,
        JSON.stringify({ version: 1, migratedAt: new Date().toISOString(), copied: report.copied, keptExisting: report.keptExisting }),
      );
    }
  } catch {
    // Storage blocked or full: stay silent, the app keeps working and retries on the next load.
  }
  return report;
}

let migrationAttempted = false;
function ensureMigrated() {
  if (migrationAttempted || typeof window === "undefined") return;
  migrationAttempted = true;
  try { migrateLegacyKeys(window.localStorage); } catch { /* storage unavailable */ }
}

export class LocalStorageAdapter implements StorageAdapter {
  isAvailable() {
    if (typeof window === "undefined") return false;
    try {
      const k = `${STORAGE_PREFIX}_probe__`;
      window.localStorage.setItem(k, "1");
      window.localStorage.removeItem(k);
      return true;
    } catch {
      return false;
    }
  }
  async getRaw(key: string): Promise<unknown> {
    if (!this.isAvailable()) return null;
    ensureMigrated();
    const raw = window.localStorage.getItem(key);
    if (raw === null) return null;
    try {
      return JSON.parse(raw);
    } catch {
      // Unparseable value: keep a copy before a later write can replace it.
      try {
        const backup = `${key}__corrupt`;
        if (window.localStorage.getItem(backup) === null) window.localStorage.setItem(backup, raw);
      } catch { /* best effort */ }
      return null;
    }
  }
  async setRaw(key: string, value: unknown): Promise<void> {
    if (!this.isAvailable()) return;
    ensureMigrated();
    window.localStorage.setItem(key, JSON.stringify(value));
  }
  async remove(key: string): Promise<void> {
    if (!this.isAvailable()) return;
    window.localStorage.removeItem(key);
  }
  async listKeys(): Promise<string[]> {
    if (!this.isAvailable()) return [];
    const keys: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k) keys.push(k);
    }
    return keys;
  }
}

let adapter: StorageAdapter = new LocalStorageAdapter();
export function setStorageAdapter(next: StorageAdapter) { adapter = next; }
export function getStorageAdapter() { return adapter; }

/* ---------------- change notification (same tab + other tabs) ---------------- */
type Listener = () => void;
const listeners = new Map<StorageName, Set<Listener>>();
let crossTabBound = false;

function notify(name: StorageName) {
  listeners.get(name)?.forEach((fn) => fn());
}

function bindCrossTab() {
  if (crossTabBound || typeof window === "undefined") return;
  crossTabBound = true;
  window.addEventListener("storage", (e) => {
    // key === null means localStorage.clear() ran in another tab.
    if (e.key === null) { STORAGE_NAMES.forEach(notify); return; }
    const name = STORAGE_NAMES.find((n) => STORAGE_KEYS[n] === e.key);
    if (name) notify(name);
  });
}

/* ---------------- read / write ---------------- */

/**
 * Entries that were in storage but can't be represented as typed records (corrupt or from a newer
 * build). They are set aside on read and appended back on write, so a save never drops them.
 */
const orphans = new Map<StorageName, unknown[]>();
/** Unrecognized enum values (e.g. status "archived") from the last read, restored on write unless the user edited them. */
const coercions = new Map<StorageName, CoercionMap>();

function load<K extends StorageName>(name: K, raw: unknown): StorageSchema[K] {
  if (name === "settings") return normalizeSettings(raw) as StorageSchema[K];
  const result = normalizeCollection(name as Exclude<StorageName, "settings">, raw);
  if (result.orphans.length) orphans.set(name, result.orphans);
  else orphans.delete(name);
  coercions.set(name, result.coerced);
  return result.items as StorageSchema[K];
}

/** Per-collection queue: concurrent update() calls in this tab run one after another instead of racing. */
const queues = new Map<StorageName, Promise<unknown>>();

export const storage = {
  /** Reads never write: missing or corrupt data falls back to normalized defaults in memory only. */
  async read<K extends StorageName>(name: K): Promise<StorageSchema[K]> {
    return load(name, await adapter.getRaw(STORAGE_KEYS[name]));
  },
  async write<K extends StorageName>(name: K, value: StorageSchema[K]): Promise<void> {
    const extra = name === "settings" ? undefined : orphans.get(name);
    const restored = Array.isArray(value) ? restoreCoerced(value, coercions.get(name)) : value;
    const toSave = extra?.length && Array.isArray(restored) ? [...restored, ...extra] : restored;
    await adapter.setRaw(STORAGE_KEYS[name], toSave);
    notify(name);
  },
  /** Same signature as before. Calls on the same collection are serialized, so read-modify-write can't interleave in one tab. */
  update<K extends StorageName>(
    name: K,
    fn: (current: StorageSchema[K]) => StorageSchema[K],
  ): Promise<StorageSchema[K]> {
    const run = (queues.get(name) ?? Promise.resolve()).then(async () => {
      const next = fn(await storage.read(name));
      await storage.write(name, next);
      return next;
    });
    queues.set(name, run.catch(() => undefined));
    return run;
  },
  /**
   * Read-only. The value originally stored for a field that normalization replaced with a safe fallback
   * (e.g. task status "archived" shown as "todo"), as of the most recent read of that collection.
   * undefined when the field was recognized. Edit code uses it to carry an untouched unknown value forward.
   */
  getCoercedRaw(name: StorageName, id: string, field: string): unknown {
    return coercions.get(name)?.get(id)?.[field]?.raw;
  },
  async remove(name: StorageName): Promise<void> {
    await adapter.remove(STORAGE_KEYS[name]);
    orphans.delete(name);
    coercions.delete(name);
    notify(name);
  },
  /** Removes both prefixes (campusbest_ and campusmate_), the migration flag, and any stray keys under those prefixes. */
  async clearAll(): Promise<void> {
    const keys = new Set<string>([
      ...Object.values(STORAGE_KEYS),
      ...Object.values(LEGACY_STORAGE_KEYS),
      MIGRATION_FLAG_KEY,
    ]);
    const existing = (await adapter.listKeys?.()) ?? [];
    for (const k of existing) {
      if (k.startsWith(STORAGE_PREFIX) || k.startsWith(LEGACY_STORAGE_PREFIX)) keys.add(k);
    }
    await Promise.all([...keys].map((k) => adapter.remove(k)));
    orphans.clear();
    coercions.clear();
    STORAGE_NAMES.forEach(notify);
  },
  subscribe(name: StorageName, fn: Listener): () => void {
    bindCrossTab();
    const set = listeners.get(name) ?? new Set<Listener>();
    set.add(fn);
    listeners.set(name, set);
    return () => { set.delete(fn); };
  },
};

/* ---------------- basic self-test (own keys, never touches user data) ---------------- */
export interface SelfTestResult { name: string; passed: boolean; detail?: string }

/** In-memory Storage stand-in so the migration can be exercised without touching real data. */
function memoryStore(seed: Record<string, string> = {}) {
  const data = new Map(Object.entries(seed));
  return {
    data,
    getItem: (k: string) => (data.has(k) ? (data.get(k) as string) : null),
    setItem: (k: string, v: string) => { data.set(k, v); },
  };
}

export async function runStorageSelfTest(): Promise<SelfTestResult[]> {
  const key = `${STORAGE_PREFIX}_selftest`;
  const results: SelfTestResult[] = [];
  const check = async (name: string, fn: () => Promise<boolean> | boolean) => {
    try { results.push({ name, passed: await fn() }); }
    catch (e) { results.push({ name, passed: false, detail: e instanceof Error ? e.message : String(e) }); }
  };

  await check("LocalStorage tersedia", async () => adapter.isAvailable());
  await check("Semua key memakai prefix campusbest_", () =>
    STORAGE_NAMES.length === 7 && STORAGE_NAMES.every((n) => STORAGE_KEYS[n].startsWith(STORAGE_PREFIX)));
  await check("Tulis dan baca ulang", async () => {
    await adapter.setRaw(key, { a: 1, b: ["x"] });
    const v = (await adapter.getRaw(key)) as { a?: number } | null;
    return v?.a === 1;
  });
  await check("Hapus nilai", async () => {
    await adapter.remove(key);
    return (await adapter.getRaw(key)) === null;
  });
  await check("Membaca tidak menimpa data", async () => {
    const before = window.localStorage.getItem(STORAGE_KEYS.tasks);
    await storage.read("tasks");
    return before === window.localStorage.getItem(STORAGE_KEYS.tasks);
  });
  await check("Migrasi data lama (simulasi, hanya menyalin)", () => {
    const legacyTasks = '[{"id":"t1","title":"Tugas lama"}]';
    const store = memoryStore({
      [LEGACY_STORAGE_KEYS.tasks]: legacyTasks,
      [LEGACY_STORAGE_KEYS.notes]: "[]",
      [STORAGE_KEYS.notes]: '[{"id":"n1"}]', // already exists: must not be overwritten
    });
    const first = migrateLegacyKeys(store);
    const second = migrateLegacyKeys(store);
    return (
      store.getItem(STORAGE_KEYS.tasks) === legacyTasks &&
      store.getItem(LEGACY_STORAGE_KEYS.tasks) === legacyTasks &&
      store.getItem(STORAGE_KEYS.notes) === '[{"id":"n1"}]' &&
      first.copied.length === 1 && first.keptExisting.length === 1 &&
      second.alreadyDone && store.getItem(MIGRATION_FLAG_KEY) !== null
    );
  });
  return results;
}
