import type { AppSettings, StorageName, StorageSchema } from "@/types";

/** Storage keys required by the spec. */
export const STORAGE_KEYS: Record<StorageName, string> = {
  subjects: "campusmate_subjects",
  tasks: "campusmate_tasks",
  schedules: "campusmate_schedules",
  events: "campusmate_events",
  notes: "campusmate_notes",
  focusSessions: "campusmate_focus_sessions",
  settings: "campusmate_settings",
};

export const DEFAULT_SETTINGS: AppSettings = {
  theme: "dark",
  sidebarCollapsed: false,
  weekStartsOn: 1,
  schemaVersion: 1,
};

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
}

export class LocalStorageAdapter implements StorageAdapter {
  isAvailable() {
    if (typeof window === "undefined") return false;
    try {
      const k = "__campusmate_probe__";
      window.localStorage.setItem(k, "1");
      window.localStorage.removeItem(k);
      return true;
    } catch {
      return false;
    }
  }
  async getRaw(key: string): Promise<unknown> {
    if (!this.isAvailable()) return null;
    const raw = window.localStorage.getItem(key);
    if (raw === null) return null;
    try { return JSON.parse(raw); } catch { return null; }
  }
  async setRaw(key: string, value: unknown): Promise<void> {
    if (!this.isAvailable()) return;
    window.localStorage.setItem(key, JSON.stringify(value));
  }
  async remove(key: string): Promise<void> {
    if (!this.isAvailable()) return;
    window.localStorage.removeItem(key);
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
    const entry = (Object.entries(STORAGE_KEYS) as [StorageName, string][]).find(([, k]) => k === e.key);
    if (entry) notify(entry[0]);
  });
}

function normalize<K extends StorageName>(name: K, value: unknown): StorageSchema[K] {
  if (name === "settings") {
    const obj = value && typeof value === "object" && !Array.isArray(value) ? value : {};
    return { ...DEFAULT_SETTINGS, ...(obj as object) } as StorageSchema[K];
  }
  return (Array.isArray(value) ? value : getDefault(name)) as StorageSchema[K];
}

export const storage = {
  /** Reads never write: missing or corrupt data falls back to defaults in memory only. */
  async read<K extends StorageName>(name: K): Promise<StorageSchema[K]> {
    return normalize(name, await adapter.getRaw(STORAGE_KEYS[name]));
  },
  async write<K extends StorageName>(name: K, value: StorageSchema[K]): Promise<void> {
    await adapter.setRaw(STORAGE_KEYS[name], value);
    notify(name);
  },
  async update<K extends StorageName>(
    name: K,
    fn: (current: StorageSchema[K]) => StorageSchema[K],
  ): Promise<StorageSchema[K]> {
    const next = fn(await storage.read(name));
    await storage.write(name, next);
    return next;
  },
  async remove(name: StorageName): Promise<void> {
    await adapter.remove(STORAGE_KEYS[name]);
    notify(name);
  },
  async clearAll(): Promise<void> {
    await Promise.all((Object.keys(STORAGE_KEYS) as StorageName[]).map((n) => storage.remove(n)));
  },
  subscribe(name: StorageName, fn: Listener): () => void {
    bindCrossTab();
    const set = listeners.get(name) ?? new Set<Listener>();
    set.add(fn);
    listeners.set(name, set);
    return () => { set.delete(fn); };
  },
};

/* ---------------- basic self-test (own key, never touches user data) ---------------- */
export interface SelfTestResult { name: string; passed: boolean; detail?: string }

export async function runStorageSelfTest(): Promise<SelfTestResult[]> {
  const key = "campusmate__selftest";
  const results: SelfTestResult[] = [];
  const check = async (name: string, fn: () => Promise<boolean>) => {
    try { results.push({ name, passed: await fn() }); }
    catch (e) { results.push({ name, passed: false, detail: e instanceof Error ? e.message : String(e) }); }
  };

  await check("LocalStorage tersedia", async () => adapter.isAvailable());
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
  return results;
}
