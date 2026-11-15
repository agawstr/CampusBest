"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AlertCircle, CheckCircle2, ClipboardPaste, Info } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { ChipGroup, Field, SegmentedControl, Select, Textarea } from "@/components/ui/field";
import { useStorage } from "@/hooks/use-storage";
import { commitImport, type CommitResult } from "@/lib/import/commit";
import {
  CHOICE_MIXED, buildItems, choiceFromValue, evaluate, groupSubjects, summarize,
  type ImportItem,
} from "@/lib/import/preview";
import { IMPORT_SOURCES, detectSource, getImportSource, runParser } from "@/lib/import/sources";
import { looksLikeSiam } from "@/lib/import/siam";
import { nameKey } from "@/lib/import/text";
import type { ImportSourceKey, ParseIssue } from "@/lib/import/types";
import { useToast } from "@/providers/toast-provider";
import { ImportItemCard, SubjectOptions } from "./import-item-card";
import { ScheduleImportView } from "./schedule-import-view";

interface Session {
  source: ImportSourceKey;
  items: ImportItem[];
  issues: ParseIssue[];
  ignored: number;
}

const SOURCE_OPTIONS = IMPORT_SOURCES.filter((s) => s.target === "tasks").map((s) => ({ value: s.key, label: s.label }));

type Target = "tasks" | "schedules";
const TARGET_OPTIONS: { value: Target; label: string }[] = [
  { value: "tasks", label: "Tugas" },
  { value: "schedules", label: "Jadwal kuliah (SIAM)" },
];

/** Two lanes under one page. Both stay mounted so switching the tab never loses what was pasted or edited. */
export function ImportView() {
  const [target, setTarget] = useState<Target>("tasks");
  // /import?sumber=siam opens the schedule tab (read on mount, no useSearchParams, so the page stays static).
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("sumber") === "siam") setTarget("schedules");
  }, []);

  return (
    <div className="pb-28 md:pb-8">
      <PageHeader
        title="Import"
        description={target === "tasks" ? "Tempel teks dari Google Classroom atau BRONE, cek hasilnya, lalu masukkan ke Tasks sekaligus." : "Tempel tabel jadwal dari SIAM, cek hasilnya, lalu masukkan ke Schedule sekaligus."}
      />
      <div className="mb-4">
        <SegmentedControl<Target> label="Yang diimpor" value={target} onChange={setTarget} options={TARGET_OPTIONS} />
      </div>
      <div hidden={target !== "tasks"}><TaskImport /></div>
      <div hidden={target !== "schedules"}><ScheduleImportView /></div>
    </div>
  );
}

function TaskImport() {
  const tasksStore = useStorage("tasks");
  const subjectsStore = useStorage("subjects");
  const { toast } = useToast();

  const [sourceKey, setSourceKey] = useState<ImportSourceKey>("brone");
  const [text, setText] = useState("");
  const [session, setSession] = useState<Session | null>(null);
  const [done, setDone] = useState<CommitResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const savingRef = useRef(false);

  const ready = tasksStore.isReady && subjectsStore.isReady;
  const subjects = subjectsStore.data;
  const tasks = tasksStore.data;
  const source = getImportSource(sourceKey);
  const guess = text.trim() ? detectSource(text) : null;

  // Recomputed from the live Tasks/Subjects, so a duplicate flag never goes stale.
  const states = useMemo(() => (session ? evaluate(session.items, tasks, subjects) : []), [session, tasks, subjects]);
  const summary = useMemo(() => summarize(states), [states]);
  const groups = useMemo(() => (session ? groupSubjects(session.items) : []), [session]);

  function runParse() {
    const result = runParser(source, text);
    setSession({ source: sourceKey, items: buildItems(result.drafts, subjects), issues: result.issues, ignored: result.ignored });
    setDone(null);
  }
  function handleParse() {
    if (session && session.items.length > 0) setConfirmOpen(true);
    else runParse();
  }

  function patchItem(key: string, patch: Partial<ImportItem>) {
    setSession((s) => (s ? { ...s, items: s.items.map((i) => (i.key === key ? { ...i, ...patch } : i)) } : s));
  }
  function removeItem(key: string) {
    setSession((s) => (s ? { ...s, items: s.items.filter((i) => i.key !== key) } : s));
  }
  function setIncluded(value: boolean) {
    setSession((s) => (s ? { ...s, items: s.items.map((i) => ({ ...i, included: value })) } : s));
  }
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
      const result = await commitImport(finalItems, session.source);
      setDone(result);
      setSession(null);
      setText("");
      toast({ title: `${result.tasksAdded} tugas masuk ke Tasks`, variant: "success" });
    } catch {
      // Nothing is cleared: the preview and every edit stay, so a retry is one click.
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
        <div>
          <p className="mb-1.5 text-sm font-medium">Sumber</p>
          <ChipGroup<ImportSourceKey> label="Sumber import" value={sourceKey} onChange={setSourceKey} options={SOURCE_OPTIONS} />
          <p className="mt-1.5 text-sm text-muted">{source.summary}</p>
        </div>

        <Field label="Teks dari sumber" htmlFor="import-text" hint={source.howTo}>
          <Textarea
            id="import-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Tempel teksnya di sini"
            className="min-h-48"
            spellCheck={false}
          />
        </Field>

        {!guess && text.trim() !== "" && looksLikeSiam(text) && (
          <p className="flex items-start gap-2 text-sm text-amber-600 dark:text-amber-400">
            <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span>Teksnya kelihatan seperti tabel jadwal SIAM. Kalau iya, pindah ke tab Jadwal kuliah.</span>
          </p>
        )}
        {guess && guess !== sourceKey && (
          <p className="flex items-start gap-2 text-sm text-amber-600 dark:text-amber-400">
            <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span>Teksnya kelihatan seperti dari {getImportSource(guess).label}. Kalau iya, ganti sumbernya dulu.</span>
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
                {done.tasksAdded} tugas berhasil diimpor{done.subjectsAdded > 0 ? `, plus ${done.subjectsAdded} mata kuliah baru` : ""}.
              </p>
              <p className="mt-1 text-sm text-muted">Tugasnya sudah muncul di Tasks, Kalender, dan Dashboard.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link href="/tasks" className="glass inline-flex h-9 items-center rounded-control px-3.5 text-sm font-semibold hover:bg-fg/10">Lihat Tasks</Link>
                <Link href="/calendar" className="glass inline-flex h-9 items-center rounded-control px-3.5 text-sm font-semibold hover:bg-fg/10">Lihat Kalender</Link>
              </div>
            </div>
          </div>
        </Card>
      )}

      {session && (
        <section className="mt-6 space-y-4" aria-label="Pratinjau import">
          {session.issues.length > 0 && (
            <Card className="border border-danger/30">
              <p className="flex items-center gap-2 font-semibold">
                <AlertCircle className="h-5 w-5 text-danger" aria-hidden />
                {session.issues.length} bagian tidak bisa dibaca
              </p>
              <p className="mt-1 text-sm text-muted">Bagian ini tidak ikut diimpor. Kalau penting, tambahkan manual di Tasks.</p>
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
            <Card>
              <EmptyState icon={ClipboardPaste} title="Belum ada tugas yang terbaca" description="Cek lagi teksnya dan pastikan sumbernya sudah benar, lalu baca ulang." />
            </Card>
          ) : (
            <>
              <Card className="space-y-4">
                <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                  <Stat label="Terbaca" value={summary.total} />
                  <Stat label="Siap diimpor" value={summary.ready} tone="text-success" />
                  <Stat label="Kembar (dilewati)" value={summary.skippedDuplicates} />
                  <Stat label="Perlu dibenahi" value={summary.needsFixing} tone={summary.needsFixing > 0 ? "text-danger" : undefined} />
                </div>
                {session.ignored > 0 && <p className="text-xs text-muted">{session.ignored} baris yang memang tidak perlu (misalnya &quot;Activity event&quot;) dilewati.</p>}
                {session.source === "google_classroom" && (
                  <p className="text-xs text-muted">Classroom tidak memberi deadline di format ini, jadi tugasnya masuk tanpa deadline. Isi lewat tombol edit kalau perlu.</p>
                )}
                {session.source === "brone" && <p className="text-xs text-muted">Jam dipakai persis seperti di teks (WIB), tanpa dikonversi.</p>}
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
                          <p className="text-xs text-muted">{g.count} tugas{g.hint ? ` · ${g.hint}` : ""}</p>
                        </div>
                        <Select
                          aria-label={`Mata kuliah untuk ${g.name}`}
                          value={g.value}
                          onChange={(e) => setGroupChoice(g.id, e.target.value)}
                        >
                          {g.value === CHOICE_MIXED && <option value={CHOICE_MIXED} disabled>Beda-beda per tugas</option>}
                          <SubjectOptions subjects={subjects} sourceName={g.name} allowUnresolved={g.value === ""} />
                        </Select>
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
                <p className="text-sm text-muted">{summary.excluded > 0 ? `${summary.excluded} tidak dipilih` : `${summary.total} tugas`}</p>
              </div>

              <ul className="space-y-3">
                {states.map((state) => (
                  <ImportItemCard
                    key={state.item.key}
                    state={state}
                    subjects={subjects}
                    onChange={(patch) => patchItem(state.item.key, patch)}
                    onRemove={() => removeItem(state.item.key)}
                  />
                ))}
              </ul>

              <div className="glass sticky bottom-[calc(6rem+env(safe-area-inset-bottom))] z-10 flex flex-wrap items-center justify-between gap-3 rounded-card p-3.5 shadow-float md:bottom-4">
                <p className="min-w-0 text-sm text-muted">
                  {summary.ready > 0
                    ? `${summary.ready} tugas siap masuk${summary.newSubjects > 0 ? `, ${summary.newSubjects} mata kuliah baru dibuat` : ""}.`
                    : "Belum ada tugas yang siap diimpor."}
                </p>
                <div className="flex gap-2">
                  <Button variant="ghost" onClick={() => setSession(null)} disabled={saving}>Batal</Button>
                  <Button onClick={handleImport} disabled={saving || summary.ready === 0}>
                    {saving ? "Mengimpor…" : `Impor ${summary.ready} tugas`}
                  </Button>
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
