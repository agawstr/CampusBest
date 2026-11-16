import type { StorageSchema } from "@/types";
import { APP_DESCRIPTION, APP_NAME, APP_TAGLINE } from "./brand";
import { APP_VERSION } from "./pwa";
import { getStorageAdapter, storage } from "./storage";

/**
 * Logic behind the Settings page. There is no settings store of its own: every preference lives in the
 * existing `settings` record (theme, weekStartsOn, focus), written through storage.update so the other
 * fields (focusTimer, unknown fields) are carried over untouched.
 */

export class SettingsStorageError extends Error {
  constructor() {
    super("storage unavailable");
    this.name = "SettingsStorageError";
  }
}

function ensureWritable(): void {
  if (!getStorageAdapter().isAvailable()) throw new SettingsStorageError();
}

/* ---------------- week start ---------------- */

export type WeekStart = 0 | 1;
export const WEEK_START_OPTIONS = [
  { value: "1", label: "Senin" },
  { value: "0", label: "Minggu" },
] as const;

export const weekStartToValue = (v: WeekStart): "0" | "1" => (v === 0 ? "0" : "1");
export const weekStartFromValue = (v: string): WeekStart => (v === "0" ? 0 : 1);

/** Schedule, Calendar and Statistics already read `settings.weekStartsOn`; this is the only place that sets it. */
export async function saveWeekStartsOn(value: WeekStart): Promise<void> {
  ensureWritable();
  await storage.update("settings", (s) => ({ ...s, weekStartsOn: value }));
}

/* ---------------- app info ---------------- */

export interface AppInfo { name: string; tagline: string; description: string; version: string }

/** The version comes from APP_VERSION (lib/pwa.ts), which batch10 checks against package.json and public/sw.js. */
export function getAppInfo(): AppInfo {
  return { name: APP_NAME, tagline: APP_TAGLINE, description: APP_DESCRIPTION, version: APP_VERSION };
}

/* ---------------- what "Hapus semua data" removes ---------------- */

export type DataCounts = Record<"subjects" | "tasks" | "schedules" | "events" | "notes" | "focusSessions", number>;

export const DATA_COUNT_LABELS: Record<keyof DataCounts, string> = {
  subjects: "mata kuliah",
  tasks: "tugas",
  schedules: "jadwal",
  events: "ujian & event",
  notes: "catatan",
  focusSessions: "sesi fokus",
};

export function countData(data: Pick<StorageSchema, keyof DataCounts>): DataCounts {
  return {
    subjects: data.subjects.length,
    tasks: data.tasks.length,
    schedules: data.schedules.length,
    events: data.events.length,
    notes: data.notes.length,
    focusSessions: data.focusSessions.length,
  };
}

/** "12 tugas, 5 mata kuliah, 3 catatan". Empty collections are left out; "" when there is nothing. */
export function describeCounts(counts: DataCounts): string {
  return (Object.keys(DATA_COUNT_LABELS) as (keyof DataCounts)[])
    .filter((k) => counts[k] > 0)
    .map((k) => `${counts[k]} ${DATA_COUNT_LABELS[k]}`)
    .join(", ");
}
