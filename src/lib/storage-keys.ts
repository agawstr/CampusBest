import type { StorageName } from "@/types";

/**
 * Key definitions live in their own dependency-free module so the pre-hydration
 * theme script and the storage layer always agree on them.
 */
export const STORAGE_PREFIX = "campusbest_";
/** Phase 1 prefix (when the app was still called CampusMate). Read-only: never written, never deleted by migration. */
export const LEGACY_STORAGE_PREFIX = "campusmate_";

const SUFFIX: Record<StorageName, string> = {
  subjects: "subjects",
  tasks: "tasks",
  schedules: "schedules",
  events: "events",
  notes: "notes",
  focusSessions: "focus_sessions",
  settings: "settings",
};

function build(prefix: string): Record<StorageName, string> {
  const out = {} as Record<StorageName, string>;
  (Object.keys(SUFFIX) as StorageName[]).forEach((name) => { out[name] = `${prefix}${SUFFIX[name]}`; });
  return out;
}

export const STORAGE_KEYS = build(STORAGE_PREFIX);
export const LEGACY_STORAGE_KEYS = build(LEGACY_STORAGE_PREFIX);

/** Present once the copy-only migration from the legacy prefix has completed. */
export const MIGRATION_FLAG_KEY = `${STORAGE_PREFIX}migration_v1`;
