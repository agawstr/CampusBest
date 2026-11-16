import type { StorageName } from "@/types";
import {
  BACKUP_NAMES, buildBackup, planImport, planIsNoop, verifyBackupMatches,
  type BackupFile, type ImportMode, type ImportPlan, type ParsedBackup, type Snapshot,
} from "./backup";
import { getStorageAdapter, storage, STORAGE_KEYS } from "./storage";

/**
 * The only code that reads or writes storage for backup and restore. It goes through the existing
 * StorageAdapter (no new key, no change to the storage manager) and it writes in a way that can be undone:
 *
 *   1. re-read everything and refuse if it changed since the preview;
 *   2. Replace only: build a backup of the current data, verify it, and hand it to `deliverBackup`
 *      (the download). If any of that fails, nothing has been written and the import stops;
 *   3. write the keys that change, one by one, then read every one back and compare;
 *   4. if a write throws or a read-back differs, put every touched key back exactly as it was, and check that too.
 *
 * LocalStorage has no transactions, so step 4 is the best that can be done; the result says plainly whether the
 * rollback itself succeeded.
 */

export type ImportErrorCode =
  | "storage_unavailable" | "stale" | "backup_failed" | "backup_invalid" | "write_failed";

export interface ImportFailure {
  ok: false;
  code: ImportErrorCode;
  message: string;
  /** write_failed only: every touched key is back to what it was. */
  rolledBack?: boolean;
  /** write_failed only, when rolledBack is false: keys that could not be restored. */
  rollbackFailed?: StorageName[];
}
export interface ImportSuccess {
  ok: true;
  mode: ImportMode;
  plan: ImportPlan;
  /** true when there was nothing to change (no write, no backup). */
  noChanges: boolean;
  /** Replace with changes: the name of the backup file that was handed to the download. */
  backupFilename?: string;
}
export type ImportResult = ImportSuccess | ImportFailure;

const key = (name: StorageName) => STORAGE_KEYS[name];

/** Raw stored value of every storage name (null = absent). Reading never writes. */
export async function readSnapshot(): Promise<Snapshot> {
  const adapter = getStorageAdapter();
  const out = {} as Snapshot;
  for (const name of BACKUP_NAMES) out[name] = (await adapter.getRaw(key(name))) ?? null;
  return out;
}

const fingerprint = (s: Snapshot) => JSON.stringify(BACKUP_NAMES.map((n) => s[n]));

export class BackupBuildError extends Error {
  constructor(message: string) { super(message); this.name = "BackupBuildError"; }
}

/** Builds the backup file for a snapshot and proves it carries exactly that snapshot. Throws BackupBuildError. */
export function backupFromSnapshot(snapshot: Snapshot, now: Date): BackupFile {
  const file = buildBackup(snapshot, now);
  const problem = verifyBackupMatches(file.content, snapshot);
  if (problem) throw new BackupBuildError(problem);
  return file;
}

/** Backup of what is stored now (the Export button). Throws BackupBuildError. */
export async function createBackupFile(now: Date = new Date()): Promise<BackupFile> {
  if (!getStorageAdapter().isAvailable()) throw new BackupBuildError("Penyimpanan browser tidak bisa diakses.");
  return backupFromSnapshot(await readSnapshot(), now);
}

async function restore(touched: StorageName[], before: Snapshot): Promise<StorageName[]> {
  const adapter = getStorageAdapter();
  const failed: StorageName[] = [];
  for (const name of [...touched].reverse()) {
    try {
      if (before[name] === null) await adapter.remove(key(name));
      else await adapter.setRaw(key(name), before[name]);
    } catch { /* judged below by what is actually stored */ }
    try {
      // A key only counts as stuck if what is stored differs from what was there before.
      const back = (await adapter.getRaw(key(name))) ?? null;
      if (JSON.stringify(back) !== JSON.stringify(before[name])) failed.push(name);
    } catch {
      failed.push(name);
    }
  }
  return failed;
}

export interface ApplyArgs {
  backup: ParsedBackup;
  mode: ImportMode;
  /** The snapshot the preview was computed from. If storage differs now, the import is refused. */
  previewed: Snapshot;
  /** Replace only. Must really deliver the file (start the download); throwing cancels the Replace. */
  deliverBackup: (file: BackupFile) => void | Promise<void>;
  now?: Date;
}

export async function applyImport({ backup, mode, previewed, deliverBackup, now = new Date() }: ApplyArgs): Promise<ImportResult> {
  const adapter = getStorageAdapter();
  if (!adapter.isAvailable()) return { ok: false, code: "storage_unavailable", message: "Penyimpanan browser tidak bisa diakses, jadi tidak ada yang diubah." };

  let before: Snapshot;
  try { before = await readSnapshot(); }
  catch { return { ok: false, code: "storage_unavailable", message: "Data di perangkat tidak bisa dibaca, jadi tidak ada yang diubah." }; }
  if (fingerprint(before) !== fingerprint(previewed)) {
    return { ok: false, code: "stale", message: "Data di perangkat berubah sejak pratinjau (mungkin dari tab lain). Tidak ada yang diubah; pilih file lagi untuk pratinjau terbaru." };
  }

  const plan = planImport(before, backup, mode);
  if (planIsNoop(plan)) return { ok: true, mode, plan, noChanges: true };

  let backupFilename: string | undefined;
  if (mode === "replace") {
    let file: BackupFile;
    try { file = backupFromSnapshot(before, now); }
    catch (e) { return { ok: false, code: "backup_invalid", message: `Cadangan otomatis gagal dibuat, jadi Ganti dibatalkan. ${e instanceof Error ? e.message : ""}`.trim() }; }
    try { await deliverBackup(file); }
    catch { return { ok: false, code: "backup_failed", message: "Cadangan otomatis tidak bisa diunduh, jadi Ganti dibatalkan. Data di perangkat tidak diubah." }; }
    backupFilename = file.filename;
  }

  const touched: StorageName[] = [];
  let problem: string | null = null;
  try {
    for (const name of BACKUP_NAMES) {
      if (!(name in plan.writes)) continue;
      touched.push(name);
      await adapter.setRaw(key(name), plan.writes[name]);
    }
    for (const name of touched) {
      const back = (await adapter.getRaw(key(name))) ?? null;
      if (JSON.stringify(back) !== JSON.stringify(plan.writes[name])) { problem = `Pembacaan ulang "${name}" tidak sama dengan yang ditulis.`; break; }
    }
  } catch (e) {
    problem = e instanceof Error ? e.message || "write error" : "write error";
  }

  if (problem !== null) {
    const stuck = await restore(touched, before);
    return stuck.length === 0
      ? { ok: false, code: "write_failed", rolledBack: true, message: "Penulisan data gagal (penyimpanan penuh atau terblokir). Semua data dikembalikan seperti semula." }
      : { ok: false, code: "write_failed", rolledBack: false, rollbackFailed: stuck, message: "Penulisan data gagal dan sebagian data belum bisa dikembalikan otomatis. Pulihkan dari file cadangan yang diunduh." };
  }

  // Refresh the storage layer's in-memory view (set-aside entries, coerced values) from what is now stored.
  try { await Promise.all((BACKUP_NAMES as readonly StorageName[]).map((n) => storage.read(n))); } catch { /* the page reloads after an import anyway */ }

  return { ok: true, mode, plan, noChanges: false, backupFilename };
}
