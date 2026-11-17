"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AlertCircle, CalendarDays, CheckCircle2, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, Textarea } from "@/components/ui/field";
import { useStorage } from "@/hooks/use-storage";
import { commitScheduleImport, type ScheduleCommitResult } from "@/lib/import/commit";
import { CHOICE_MIXED, choiceFromValue } from "@/lib/import/preview";
import {
  buildScheduleItems, evaluateSchedule, groupScheduleSubjects, summarizeSchedule, type ScheduleImportItem,
} from "@/lib/import/schedule-preview";
import { looksLikeSiam } from "@/lib/import/siam";
import { SCHEDULE_SOURCES, detectSource, runScheduleParser } from "@/lib/import/sources";
import { nameKey } from "@/lib/import/text";
import type { ParseIssue, SiamFormat } from "@/lib/import/types";
import { useToast } from "@/providers/toast-provider";
import { SubjectPicker } from "./import-item-card";
import { ScheduleImportItemCard } from "./schedule-import-item-card";

interface Session { items: ScheduleImportItem[]; issues: ParseIssue[]; ignored: number; format: SiamFormat | null }

const source = SCHEDULE_SOURCES[0];

export function ScheduleImportView() {
  const schedulesStore = useStorage("schedules");
  const subjectsStore = useStorage("subjects");
  const { toast } = useToast();

  const [text, setText] = useState("");
  const [session, setSession] = useState<Session | null>(null);
  const [done, setDone] = useState<ScheduleCommitResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const savingRef = useRef(false);

  const ready = schedulesStore.isReady && subjectsStore.isReady;
  const subjects = subjectsStore.data;
  const schedules = schedulesStore.data;
  const wrongSource = text.trim() !== "" && !looksLikeSiam(text) && detectSource(text) !== null;

  // Recomputed from the live Schedule/Subjects, so a duplicate flag never goes stale.
  const states = useMemo(() => (session ? evaluateSchedule(session.items, schedules, subjects) : []), [session, schedules, subjects]);
  const summary = useMemo(() => summarizeSchedule(states), [states]);
  const groups = useMemo(() => (session ? groupScheduleSubjects(session.items) : []), [session]);

  function runParse() {
    const result = runScheduleParser(source, text);
    setSession({ items: buildScheduleItems(result.drafts, subjects), issues: result.issues, ignored: result.ignored, format: result.format });
    setDone(null);
  }
  function handleParse() {
    if (session && session.items.length > 0) setConfirmOpen(true);
    else runParse();
  }
  const patchItem = (key: string, patch: Partial<ScheduleImportItem>) =>
    setSession((s) => (s ? { ...s, items: s.items.map((i) => (i.key === key ? { ...i, ...patch } : i)) } : s));
  const removeItem = (key: string) => setSession((s) => (s ? { ...s, items: s.items.filter((i) => i.key !== key) } : s));
  const setIncluded = (value: boolean) => setSession((s) => (s ? { ...s, items: s.items.map((i) => ({ ...i, included: value })) } : s));
  function setGroupChoice(groupId: string, value: string) {
    const choice = choiceFromValue(value);
    setSession((s) => (s ? { ...s, items: s.items.map((i) => (nameKey(i.sourceSubject) === groupId ? { ...i, subject: choice } : i)) } : s));
  }

  async function handleImport() {
    if (!session || savingRef.current) return;
    const finalItems = states.filter((s) => s.ready).map((s) => s.item);
    if (finalItems.length === 0) return;
    savingRef.current = true;
    setSaving(true);
    try {
      const result = await commitScheduleImport(finalItems);
      setDone(result);
      setSession(null);
      setText("");
      toast({ title: `${result.schedulesAdded} jadwal masuk ke Schedule`, variant: "success" });
    } catch {
      toast({ title: "Belum bisa mengimpor", description: "Penyimpanan di browser lagi bermasalah atau penuh. Datamu aman, coba lagi ya.", variant: "error" });
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  const allIncluded = session ? session.items.length > 0 && session.items.every((i) => i.included) : false;

  return (
    <div>
      <Card className="space-y-4">
        <p className="text-sm text-muted">{source.summary}</p>
        <Field label="Teks dari SIAM" htmlFor="siam-text" hint={source.howTo}>
          <Textarea id="siam-text" value={text} onChange={(e) => setText(e.target.value)} placeholder="Tempel tabel jadwalnya di sini" className="min-h-48 font-mono text-xs" spellCheck={false} />
        </Field>
        {wrongSource && (
          <p className="flex items-start gap-2 text-sm text-amber-600 dark:text-amber-400">
            <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span>Teksnya kelihatan seperti daftar tugas, bukan tabel jadwal SIAM. Kalau iya, pindah ke tab Tugas.</span>
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <Button onClick={handleParse} disabled={!ready || text.trim() === ""}>{session ? "Baca ulang" : "Baca teks"}</Button>
          {text && <Button variant="ghost" onClick={() => setText("")}>Kosongkan</Button>}
        </div>
      </Card>

      {done && (
        <Card className="mt-6">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-success" aria-hidden />
            <div className="min-w-0">
              <p className="font-semibold">
                {done.schedulesAdded} jadwal berhasil diimpor{done.subjectsAdded > 0 ? `, plus ${done.subjectsAdded} mata kuliah baru` : ""}.
              </p>
              <p className="mt-1 text-sm text-muted">Jadwalnya berulang tiap minggu dan sudah muncul di Schedule, Kalender, dan Dashboard. Jadwal lamamu tidak diubah.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link href="/schedule" className="glass-item inline-flex h-9 items-center rounded-control px-3.5 text-sm font-semibold hover:bg-fg/10">Lihat Schedule</Link>
                <Link href="/calendar" className="glass-item inline-flex h-9 items-center rounded-control px-3.5 text-sm font-semibold hover:bg-fg/10">Lihat Kalender</Link>
              </div>
            </div>
          </div>
        </Card>
      )}

      {session && (
        <section className="mt-6 space-y-4" aria-label="Pratinjau import jadwal">
          {session.issues.length > 0 && (
            <Card className="border border-danger/30">
              <p className="flex items-center gap-2 font-semibold">
                <AlertCircle className="h-5 w-5 text-danger" aria-hidden />
                {session.issues.length} bagian tidak bisa dibaca
              </p>
              <p className="mt-1 text-sm text-muted">Bagian ini tidak ikut diimpor. Kalau penting, tambahkan manual di Schedule.</p>
              <ul className="mt-3 max-h-64 space-y-2 overflow-y-auto text-sm">
                {session.issues.map((issue, i) => (
                  <li key={i} className="rounded-control bg-fg/[0.05] px-3 py-2">
                    <p className="text-danger">{issue.reason}</p>
                    {issue.text && (
                      <p className="mt-0.5 break-words text-xs text-muted">
                        {issue.line > 0 ? `Baris ${issue.line}: ` : ""}{issue.text.length > 140 ? `${issue.text.slice(0, 140)}…` : issue.text}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {session.items.length === 0 ? (
            <Card><EmptyState icon={CalendarDays} title="Belum ada jadwal yang terbaca" description="Pastikan baris judul kolom ikut tersalin, lalu baca ulang." /></Card>
          ) : (
            <>
              <Card className="space-y-4">
                <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                  <Stat label="Terbaca" value={summary.total} />
                  <Stat label="Siap diimpor" value={summary.ready} tone="text-success" />
                  <Stat label="Kembar (dilewati)" value={summary.skippedDuplicates} />
                  <Stat label="Perlu dibenahi" value={summary.needsFixing} tone={summary.needsFixing > 0 ? "text-danger" : undefined} />
                </div>
                {session.format && (
                  <p className="text-xs text-muted">
                    Terdeteksi SIAM Format {session.format}
                    {session.format === 1 ? " (Hari, Jam, Mata Kuliah, Kelas, Dosen, Ruang; kolom Action diabaikan)" : " (Hari, MK, Jam, Ruang)"}.
                    Jam dipakai persis seperti di teks (WIB), semua jadwal berulang tiap minggu.
                  </p>
                )}
                {session.format === 2 && <p className="text-xs text-muted">Format 2 tidak punya kolom dosen dan kelas, jadi keduanya dibiarkan kosong.</p>}
              </Card>

              {groups.length > 0 && (
                <Card className="space-y-3">
                  <div>
                    <p className="font-semibold">Mata kuliah</p>
                    <p className="text-sm text-muted">Yang cocok persis sudah otomatis dihubungkan. Sisanya kamu yang tentukan, nggak ada yang dibuat diam-diam.</p>
                  </div>
                  <div className="space-y-3">
                    {groups.map((g) => (
                      <div key={g.id} className="grid gap-1.5 sm:grid-cols-[1fr_minmax(0,16rem)] sm:items-center sm:gap-3">
                        <div className="min-w-0">
                          <p className="break-words text-sm font-medium">{g.name}</p>
                          <p className="text-xs text-muted">{g.count} sesi{g.hint ? ` · ${g.hint}` : ""}</p>
                        </div>
                        <SubjectPicker
                          ariaLabel={`Mata kuliah untuk ${g.name}`}
                          subjects={subjects}
                          sourceName={g.name}
                          value={g.value}
                          onChange={(v) => setGroupChoice(g.id, v)}
                          allowUnresolved={g.value === ""}
                          allowNone={false}
                          mixedLabel={g.value === CHOICE_MIXED ? "Beda-beda per sesi" : undefined}
                        />
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              <div className="flex items-center justify-between gap-3 px-1">
                <label className="flex cursor-pointer items-center gap-2.5 text-sm font-medium">
                  <input type="checkbox" checked={allIncluded} onChange={(e) => setIncluded(e.target.checked)} className="h-5 w-5 accent-[rgb(var(--accent))]" />
                  Pilih semua
                </label>
                <p className="text-sm text-muted">{summary.excluded > 0 ? `${summary.excluded} tidak dipilih` : `${summary.total} sesi`}</p>
              </div>

              <ul className="space-y-3">
                {states.map((state) => (
                  <ScheduleImportItemCard key={state.item.key} state={state} subjects={subjects} onChange={(patch) => patchItem(state.item.key, patch)} onRemove={() => removeItem(state.item.key)} />
                ))}
              </ul>

              <div className="glass sticky bottom-[calc(6rem+env(safe-area-inset-bottom))] z-10 flex flex-wrap items-center justify-between gap-3 rounded-card p-3.5 shadow-float md:bottom-4">
                <p className="min-w-0 text-sm text-muted">
                  {summary.ready > 0
                    ? `${summary.ready} jadwal siap masuk${summary.newSubjects > 0 ? `, ${summary.newSubjects} mata kuliah baru dibuat` : ""}.`
                    : "Belum ada jadwal yang siap diimpor."}
                </p>
                <div className="flex gap-2">
                  <Button variant="ghost" onClick={() => setSession(null)} disabled={saving}>Batal</Button>
                  <Button onClick={handleImport} disabled={saving || summary.ready === 0}>{saving ? "Mengimpor…" : `Impor ${summary.ready} jadwal`}</Button>
                </div>
              </div>
            </>
          )}
        </section>
      )}

      <ConfirmationDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Baca ulang teksnya?"
        description="Hasil baca yang sekarang, termasuk editan yang sudah kamu buat, bakal diganti."
        confirmLabel="Baca ulang"
        onConfirm={runParse}
      />
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="rounded-control bg-fg/[0.05] px-3 py-2.5">
      <p className={`text-2xl font-bold ${tone ?? ""}`}>{value}</p>
      <p className="text-xs text-muted">{label}</p>
    </div>
  );
}
