"use client";

import { useMemo, useRef, useState, type ChangeEvent } from "react";
import { AlertTriangle, CheckCircle2, Download, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SegmentedControl } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { MAX_BACKUP_CHARS, parseBackup, planImport, planIsNoop, type ImportMode, type ParseOutcome, type Snapshot } from "@/lib/backup";
import { applyImport, createBackupFile, readSnapshot, type ImportResult } from "@/lib/backup-store";
import { downloadTextFile } from "@/lib/download";
import { useToast } from "@/providers/toast-provider";

const MODE_OPTIONS = [
  { value: "merge", label: "Gabung" },
  { value: "replace", label: "Ganti semuanya" },
] as const;

interface Picked { fileName: string; outcome: ParseOutcome; snapshot: Snapshot | null }

function formatWhen(iso?: string): string {
  const t = iso ? Date.parse(iso) : NaN;
  if (!Number.isFinite(t)) return "tidak diketahui";
  return new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(t));
}

/** Export everything to a JSON file, or restore from one (merge or replace). All logic lives in lib/backup*.ts. */
export function BackupCard() {
  const { toast } = useToast();
  const fileInput = useRef<HTMLInputElement>(null);
  const [exporting, setExporting] = useState(false);
  const [picked, setPicked] = useState<Picked | null>(null);
  const [mode, setMode] = useState<ImportMode>("merge");
  const [understood, setUnderstood] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<Extract<ImportResult, { ok: false }> | null>(null);
  const [done, setDone] = useState<Extract<ImportResult, { ok: true }> | null>(null);

  const plan = useMemo(
    () => (picked?.outcome.ok && picked.snapshot ? planImport(picked.snapshot, picked.outcome.backup, mode) : null),
    [picked, mode],
  );

  const close = () => {
    if (busy) return;
    if (done) { window.location.reload(); return; } // everything re-reads the restored data
    setPicked(null); setFailure(null); setUnderstood(false); setMode("merge");
  };

  async function exportNow() {
    setExporting(true);
    try {
      const file = await createBackupFile();
      downloadTextFile(file);
      const total = Object.values(file.counts).reduce((a, b) => a + b, 0);
      toast({ title: "Cadangan diunduh", description: `${file.filename} (${total} data). Simpan file ini di tempat yang aman.`, variant: "success" });
    } catch {
      toast({ title: "Cadangan gagal dibuat", description: "Tidak ada file yang dibuat. Data kamu tidak berubah.", variant: "error" });
    } finally {
      setExporting(false);
    }
  }

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // lets the same file be chosen again
    if (!file) return;
    setFailure(null); setDone(null); setUnderstood(false); setMode("merge");
    if (file.size > MAX_BACKUP_CHARS) {
      setPicked({ fileName: file.name, outcome: { ok: false, errors: ["File terlalu besar untuk jadi cadangan CampusBest."] }, snapshot: null });
      return;
    }
    try {
      const outcome = parseBackup(await file.text());
      setPicked({ fileName: file.name, outcome, snapshot: outcome.ok ? await readSnapshot() : null });
    } catch {
      setPicked({ fileName: file.name, outcome: { ok: false, errors: ["File tidak bisa dibaca."] }, snapshot: null });
    }
  }

  async function runImport() {
    if (!picked?.outcome.ok || !picked.snapshot) return;
    setBusy(true); setFailure(null);
    try {
      const result = await applyImport({ backup: picked.outcome.backup, mode, previewed: picked.snapshot, deliverBackup: downloadTextFile });
      if (result.ok) setDone(result); else setFailure(result);
    } catch {
      setFailure({ ok: false, code: "write_failed", message: "Terjadi kesalahan tak terduga. Muat ulang halaman dan periksa datamu." });
    } finally {
      setBusy(false);
    }
  }

  const ready = picked?.outcome.ok && plan;
  const replace = mode === "replace";
  const noop = plan ? planIsNoop(plan) : false;
  const canRun = !!ready && !busy && !noop && (!replace || understood);

  return (
    <Card delay={0.1}>
      <h2 className="text-base font-semibold">Cadangan data</h2>
      <p className="mt-1 text-sm text-muted">Simpan semua datamu ke satu file JSON, atau pulihkan dari file cadangan. Timer yang sedang berjalan tidak ikut.</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="secondary" onClick={exportNow} disabled={exporting}><Download className="h-4 w-4" aria-hidden /> {exporting ? "Menyiapkan…" : "Ekspor data"}</Button>
        <Button variant="secondary" onClick={() => fileInput.current?.click()}><Upload className="h-4 w-4" aria-hidden /> Impor dari file</Button>
        <input ref={fileInput} type="file" accept=".json,application/json" className="hidden" onChange={onFile} aria-label="Pilih file cadangan CampusBest" />
      </div>

      <Modal
        open={picked !== null}
        onOpenChange={(o) => { if (!o) close(); }}
        title={done ? "Data dipulihkan" : "Impor data"}
        description={picked ? picked.fileName : undefined}
        footer={done ? (
          <Button onClick={() => window.location.reload()}>Muat ulang aplikasi</Button>
        ) : picked?.outcome.ok ? (
          <>
            <Button variant="ghost" onClick={close} disabled={busy}>Batal</Button>
            <Button variant={replace ? "danger" : "primary"} onClick={runImport} disabled={!canRun}>
              {busy ? "Memproses…" : noop ? "Tidak ada perubahan" : replace ? "Unduh backup & ganti data" : "Gabungkan data"}
            </Button>
          </>
        ) : <Button onClick={close}>Tutup</Button>}
      >
        {picked && !picked.outcome.ok && (
          <div role="alert" className="space-y-2 text-sm">
            <p className="flex items-center gap-2 font-medium text-danger"><AlertTriangle className="h-4 w-4 shrink-0" aria-hidden /> File ini tidak bisa diimpor.</p>
            <ul className="list-disc space-y-1 pl-5 text-muted">{picked.outcome.errors.map((m) => <li key={m}>{m}</li>)}</ul>
            <p className="text-muted">Data di perangkat ini tidak diubah.</p>
          </div>
        )}

        {done && (
          <div className="space-y-2 text-sm">
            <p className="flex items-center gap-2 font-medium"><CheckCircle2 className="h-4 w-4 shrink-0 text-success" aria-hidden /> {done.noChanges ? "Tidak ada yang perlu diubah." : done.mode === "replace" ? "Semua data diganti dengan isi file." : "Data berhasil digabung."}</p>
            {done.backupFilename && <p className="text-muted">Backup data lama sudah diunduh: <span className="font-medium text-fg">{done.backupFilename}</span>. Simpan baik-baik.</p>}
            <p className="text-muted">Aplikasi dimuat ulang supaya semua halaman memakai data terbaru.</p>
          </div>
        )}

        {ready && !done && plan && picked?.outcome.ok && (
          <div className="space-y-4 text-sm">
            <p className="text-muted">Dibuat {formatWhen(picked.outcome.backup.meta.exportedAt)} oleh CampusBest {picked.outcome.backup.meta.appVersion ?? "?"}.</p>
            <SegmentedControl label="Cara impor" value={mode} onChange={(m) => { setMode(m); setUnderstood(false); setFailure(null); }} options={MODE_OPTIONS} />
            <p className="text-muted">
              {replace
                ? "Semua data di perangkat diganti persis dengan isi file, termasuk pengaturan. Timer yang sedang berjalan tidak berubah. Sebelum ada yang diganti, backup data saat ini diunduh otomatis; kalau backup gagal, tidak ada yang diganti."
                : "Data di perangkat dipertahankan, data dari file ditambahkan. Kalau id sama, yang updatedAt-nya lebih baru dipakai; kalau sama, tidak ada, atau hanya salah satu yang punya, data di perangkat tetap (yang punya updatedAt dianggap lebih baru dari yang tidak). Pengaturan tidak diubah."}
            </p>

            <ul className="divide-y divide-fg/10 rounded-control border border-fg/10">
              {plan.collections.map((c) => (
                <li key={c.name} className="px-3 py-2">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="font-medium">{c.label}</span>
                    <span className="tabular-nums text-muted">{c.current} → <span className="font-semibold text-fg">{c.resulting}</span></span>
                  </div>
                  <p className="text-xs text-muted">
                    {replace
                      ? `${c.incoming} di file`
                      : [`${c.added} baru`, `${c.updated} diperbarui`, `${c.unchanged} sama`, c.keptCurrent > 0 ? `${c.keptCurrent} tetap pakai data perangkat` : "", c.skipped > 0 ? `${c.skipped} dilewati` : ""].filter(Boolean).join(", ")}
                  </p>
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted">{plan.settings === "replaced" ? "Pengaturan: diganti dengan isi file." : replace ? "Pengaturan: sama dengan file." : "Pengaturan: tidak diubah."}</p>

            {[...picked.outcome.warnings, ...plan.warnings].length > 0 && (
              <ul className="space-y-1 rounded-control border border-accent/30 bg-accent/10 px-3 py-2 text-xs">
                {[...picked.outcome.warnings, ...plan.warnings].map((w) => <li key={w} className="flex gap-2"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" aria-hidden />{w}</li>)}
              </ul>
            )}

            {replace && !noop && (
              <label className="flex cursor-pointer items-start gap-2 text-sm">
                <input type="checkbox" className="mt-1 h-4 w-4 accent-[rgb(var(--accent))]" checked={understood} onChange={(e) => setUnderstood(e.target.checked)} disabled={busy} />
                <span>Saya mengerti data di perangkat ini akan diganti, dan file backup-nya akan diunduh lebih dulu.</span>
              </label>
            )}

            {failure && (
              <div role="alert" className="rounded-control border border-danger/40 bg-danger/10 px-3 py-2 text-sm">
                <p className="font-medium text-danger">{failure.code === "write_failed" && failure.rolledBack ? "Gagal, data dikembalikan." : "Gagal."}</p>
                <p className="mt-1">{failure.message}</p>
                {failure.code === "write_failed" && failure.rolledBack === false && failure.rollbackFailed && <p className="mt-1 text-xs text-muted">Bagian yang belum kembali: {failure.rollbackFailed.join(", ")}.</p>}
              </div>
            )}
          </div>
        )}
      </Modal>
    </Card>
  );
}
