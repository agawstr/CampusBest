"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { CalendarClock, ChevronLeft, ChevronRight, ClipboardPaste, Plus } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { useOpenFromQuery } from "@/hooks/use-open-from-query";
import { useStorage } from "@/hooks/use-storage";
import { addDays, formatDateID, startOfWeek, todayKey } from "@/lib/date";
import { storage } from "@/lib/storage";
import {
  applyScheduleEdit, buildWeek, createSchedule, formatWeekRange, needsDate, scheduleFieldsToPreserve, subjectTitle,
  type ScheduleFormTouched, type ScheduleFormValues,
} from "@/lib/schedule";
import { cn } from "@/lib/utils";
import { useToast } from "@/providers/toast-provider";
import type { ScheduleItem } from "@/types";
import { ScheduleFormModal } from "./schedule-form-modal";
import { ScheduleItemCard } from "./schedule-item-card";

function Skeleton() {
  return (
    <div className="space-y-3" aria-hidden>
      {[0, 1, 2].map((i) => <div key={i} className="glass-item h-[120px] animate-pulse rounded-card" />)}
    </div>
  );
}

export function CourseSchedulePanel({ tabs }: { tabs: ReactNode }) {
  const schedulesStore = useStorage("schedules");
  const subjectsStore = useStorage("subjects");
  const settingsStore = useStorage("settings");
  const { toast } = useToast();

  /** Weeks away from the current week. Kept as an offset so a change of week-start setting still lands on "this week". */
  const [weekOffset, setWeekOffset] = useState(0);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<ScheduleItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ScheduleItem | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const schedules = schedulesStore.data;
  const subjects = subjectsStore.data;
  const ready = schedulesStore.isReady && subjectsStore.isReady && settingsStore.isReady;
  const subjectsById = useMemo(() => new Map(subjects.map((s) => [s.id, s])), [subjects]);
  const weekStartsOn = settingsStore.data.weekStartsOn;

  const weekStart = useMemo(() => addDays(startOfWeek(new Date(), weekStartsOn), weekOffset * 7), [weekStartsOn, weekOffset]);
  const week = useMemo(() => buildWeek(schedules, weekStart), [schedules, weekStart]);
  const undated = useMemo(() => schedules.filter(needsDate), [schedules]);
  const today = todayKey();
  const weekCount = week.reduce((n, d) => n + d.items.length, 0);
  const weekSummary = [
    weekOffset === 0 ? "Minggu ini" : weekOffset === 1 ? "Minggu depan" : weekOffset === -1 ? "Minggu lalu" : null,
    weekCount > 0 ? `${weekCount} sesi kuliah` : "Tidak ada sesi kuliah",
  ].filter(Boolean).join(" · ");

  function openCreate() { setEditing(null); setEditorOpen(true); }
  useOpenFromQuery(openCreate); // dashboard quick action: /schedule?tambah=1
  function openEdit(item: ScheduleItem) { setEditing(item); setEditorOpen(true); }
  function askDelete(item: ScheduleItem) { setDeleteTarget(item); setDeleteOpen(true); }
  const fail = () => toast({ title: "Gagal menyimpan", description: "Penyimpanan browser penuh atau tidak bisa diakses. Coba lagi ya.", variant: "error" });

  /** Original stored mode/recurrence/dayOfWeek that normalization didn't recognize. Call inside update(). */
  const rawOf = (id: string) => (field: "mode" | "recurrence" | "dayOfWeek") => storage.getCoercedRaw("schedules", id, field);

  async function handleSave(values: ScheduleFormValues, touched: ScheduleFormTouched) {
    try {
      if (editing) {
        const id = editing.id;
        // Runs inside update(), right after the collection is re-read, so the raw values are current.
        await schedulesStore.update((list) =>
          list.map((s) => (s.id === id ? applyScheduleEdit(s, values, new Date(), scheduleFieldsToPreserve(touched, rawOf(id))) : s)),
        );
        toast({ title: "Jadwal diperbarui", variant: "success" });
      } else {
        const item = createSchedule(values);
        await schedulesStore.update((list) => [...list, item]);
        toast({ title: "Jadwal ditambahkan", variant: "success" });
      }
      setEditorOpen(false);
    } catch {
      fail();
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    const id = deleteTarget.id;
    try {
      await schedulesStore.update((list) => list.filter((s) => s.id !== id));
      toast({ title: "Jadwal dihapus" });
    } catch {
      fail();
    }
  }

  const addButton = (
    <Button onClick={openCreate}>
      <Plus className="h-4 w-4" aria-hidden />
      Tambah jadwal
    </Button>
  );
  const subjectsLink = (
    <Link
      href="/subjects"
      className="inline-flex h-11 items-center justify-center rounded-control btn-metal px-5 text-sm font-semibold text-accent-fg shadow-glow transition hover:brightness-110"
    >
      Tambah mata kuliah dulu
    </Link>
  );

  return (
    <>
      <PageHeader
        title="Schedule"
        description="Jadwal kuliah mingguanmu, lengkap dengan dosen dan ruangan."
        actions={
          <>
            <Link href="/import?sumber=siam" className="glass-item inline-flex h-11 items-center gap-2 rounded-control px-4 text-sm font-semibold transition-colors duration-fast hover:bg-fg/10">
              <ClipboardPaste className="h-4 w-4" aria-hidden />
              Import SIAM
            </Link>
            {schedules.length > 0 && addButton}
          </>
        }
      />

      {tabs}

      {!ready ? (
        <Skeleton />
      ) : schedules.length === 0 ? (
        <Card>
          <EmptyState
            icon={CalendarClock}
            title="Belum ada jadwal kuliah"
            description={
              subjects.length === 0
                ? "Tambahkan mata kuliahmu dulu, habis itu atur jadwalnya di sini."
                : "Atur jadwal kuliahmu di sini, mingguan, dua mingguan, atau sekali saja."
            }
            action={subjects.length === 0 ? subjectsLink : addButton}
          />
        </Card>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1">
              <Button variant="secondary" size="icon" aria-label="Minggu sebelumnya" onClick={() => setWeekOffset((o) => o - 1)}>
                <ChevronLeft className="h-5 w-5" aria-hidden />
              </Button>
              <Button variant="secondary" size="icon" aria-label="Minggu berikutnya" onClick={() => setWeekOffset((o) => o + 1)}>
                <ChevronRight className="h-5 w-5" aria-hidden />
              </Button>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-silver text-lg font-bold tracking-tight" aria-live="polite">{formatWeekRange(weekStart)}</p>
              <p className="text-xs text-muted">{weekSummary}</p>
            </div>
            <Button variant="secondary" size="sm" disabled={weekOffset === 0} onClick={() => setWeekOffset(0)}>
              Minggu ini
            </Button>
          </div>

          <div className="grid gap-5 2xl:grid-cols-7 2xl:gap-3">
            {week.map((day) => {
              const isToday = day.key === today;
              return (
                <section key={day.key} aria-label={formatDateID(day.date, { weekday: "long", day: "numeric", month: "long" })} className="min-w-0">
                  <div className="mb-2 flex items-center gap-2">
                    <h2 className={cn("font-semibold tracking-tight", isToday && "text-accent")}>
                      {formatDateID(day.date, { weekday: "long" })}
                    </h2>
                    <span className="text-sm text-muted">{formatDateID(day.date, { day: "numeric", month: "short" })}</span>
                    {isToday && <span className="rounded-full bg-accent/15 px-2 py-0.5 text-xs font-medium text-accent shadow-[0_0_14px_-4px_rgb(var(--accent)/0.5)]">Hari ini</span>}
                  </div>
                  {day.items.length === 0 ? (
                    <p className="rounded-control border border-dashed border-fg/10 px-3 py-4 text-center text-xs text-muted">Tidak ada kelas</p>
                  ) : (
                    <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-1">
                      {day.items.map((item) => (
                        <li key={item.id}>
                          <ScheduleItemCard item={item} subject={subjectsById.get(item.subjectId)} onEdit={openEdit} onDelete={askDelete} />
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              );
            })}
          </div>

          {undated.length > 0 && (
            <section className="mt-8">
              <h2 className="font-semibold">Perlu tanggal</h2>
              <p className="mb-3 mt-1 text-sm text-muted">
                Jadwal ini belum punya tanggal, jadi belum muncul di minggu atau kalender mana pun. Edit untuk melengkapinya.
              </p>
              <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {undated.map((item) => (
                  <li key={item.id}>
                    <ScheduleItemCard item={item} subject={subjectsById.get(item.subjectId)} onEdit={openEdit} onDelete={askDelete} />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      <ScheduleFormModal open={editorOpen} onOpenChange={setEditorOpen} item={editing} subjects={subjects} onSubmit={handleSave} />
      <ConfirmationDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Hapus jadwal ini?"
        description={deleteTarget ? `Jadwal "${subjectTitle(subjectsById.get(deleteTarget.subjectId))}" akan dihapus dan tidak bisa dikembalikan.` : ""}
        confirmLabel="Hapus"
        destructive
        onConfirm={handleDelete}
      />
    </>
  );
}
