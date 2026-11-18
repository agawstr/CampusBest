"use client";

import { useMemo, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, Plus, Users } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { useOpenFromQuery } from "@/hooks/use-open-from-query";
import { useStorage } from "@/hooks/use-storage";
import {
  activityFieldsToPreserve, activityNeedsDate, applyActivityEdit, buildActivityWeek, createActivity,
  type ActivityFormTouched, type ActivityFormValues,
} from "@/lib/activities";
import { addDays, formatDateID, startOfWeek, todayKey } from "@/lib/date";
import { formatWeekRange } from "@/lib/schedule";
import { storage } from "@/lib/storage";
import { cn } from "@/lib/utils";
import { useToast } from "@/providers/toast-provider";
import type { Activity } from "@/types";
import { ActivityCard } from "./activity-card";
import { ActivityFormModal } from "./activity-form-modal";

function Skeleton() {
  return (
    <div className="space-y-3" aria-hidden>
      {[0, 1, 2].map((i) => <div key={i} className="glass-item h-[120px] animate-pulse rounded-card" />)}
    </div>
  );
}

/** "Kegiatan Lain" tab: CRUD for activities outside classes. Reads and writes only the activities collection. */
export function ActivitiesPanel({ tabs }: { tabs: ReactNode }) {
  const activitiesStore = useStorage("activities");
  const settingsStore = useStorage("settings");
  const { toast } = useToast();

  const [weekOffset, setWeekOffset] = useState(0);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Activity | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Activity | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const activities = activitiesStore.data;
  const ready = activitiesStore.isReady && settingsStore.isReady;
  const weekStartsOn = settingsStore.data.weekStartsOn;

  const weekStart = useMemo(() => addDays(startOfWeek(new Date(), weekStartsOn), weekOffset * 7), [weekStartsOn, weekOffset]);
  const week = useMemo(() => buildActivityWeek(activities, weekStart), [activities, weekStart]);
  const undated = useMemo(() => activities.filter(activityNeedsDate), [activities]);
  const today = todayKey();
  const weekCount = week.reduce((n, d) => n + d.items.length, 0);
  const weekSummary = [
    weekOffset === 0 ? "Minggu ini" : weekOffset === 1 ? "Minggu depan" : weekOffset === -1 ? "Minggu lalu" : null,
    weekCount > 0 ? `${weekCount} kegiatan` : "Tidak ada kegiatan",
  ].filter(Boolean).join(" · ");

  function openCreate() { setEditing(null); setEditorOpen(true); }
  useOpenFromQuery(openCreate); // dashboard link: /schedule?tab=lain&tambah=1
  function openEdit(item: Activity) { setEditing(item); setEditorOpen(true); }
  function askDelete(item: Activity) { setDeleteTarget(item); setDeleteOpen(true); }
  const fail = () => toast({ title: "Gagal menyimpan", description: "Penyimpanan browser penuh atau tidak bisa diakses. Coba lagi ya.", variant: "error" });

  const rawOf = (id: string) => (field: "category" | "recurrence" | "dayOfWeek") => storage.getCoercedRaw("activities", id, field);

  async function handleSave(values: ActivityFormValues, touched: ActivityFormTouched) {
    try {
      if (editing) {
        const id = editing.id;
        await activitiesStore.update((list) =>
          list.map((a) => (a.id === id ? applyActivityEdit(a, values, new Date(), activityFieldsToPreserve(touched, rawOf(id))) : a)),
        );
        toast({ title: "Kegiatan diperbarui", variant: "success" });
      } else {
        const item = createActivity(values);
        await activitiesStore.update((list) => [...list, item]);
        toast({ title: "Kegiatan ditambahkan", variant: "success" });
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
      await activitiesStore.update((list) => list.filter((a) => a.id !== id));
      toast({ title: "Kegiatan dihapus" });
    } catch {
      fail();
    }
  }

  const addButton = (
    <Button onClick={openCreate}>
      <Plus className="h-4 w-4" aria-hidden />
      Tambah kegiatan
    </Button>
  );

  return (
    <>
      <PageHeader
        title="Schedule"
        description="Kegiatan di luar kuliah: organisasi, olahraga, kerja, dan lainnya."
        actions={activities.length > 0 ? addButton : undefined}
      />

      {tabs}

      {!ready ? (
        <Skeleton />
      ) : activities.length === 0 ? (
        <Card>
          <EmptyState
            icon={Users}
            title="Belum ada kegiatan lain"
            description="Catat kegiatan di luar kuliahmu di sini, sekali saja, mingguan, atau dua mingguan."
            action={addButton}
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
                    <h2 className={cn("font-semibold tracking-tight", isToday && "text-accent")}>{formatDateID(day.date, { weekday: "long" })}</h2>
                    <span className="text-sm text-muted">{formatDateID(day.date, { day: "numeric", month: "short" })}</span>
                    {isToday && <span className="rounded-full bg-accent/15 px-2 py-0.5 text-xs font-medium text-accent shadow-[0_0_14px_-4px_rgb(var(--accent)/0.5)]">Hari ini</span>}
                  </div>
                  {day.items.length === 0 ? (
                    <p className="rounded-control border border-dashed border-fg/10 px-3 py-4 text-center text-xs text-muted">Tidak ada kegiatan</p>
                  ) : (
                    <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-1">
                      {day.items.map((item) => (
                        <li key={item.id}><ActivityCard item={item} onEdit={openEdit} onDelete={askDelete} /></li>
                      ))}
                    </ul>
                  )}
                </section>
              );
            })}
          </div>

          {undated.length > 0 && (
            <section className="mt-8">
              <h2 className="font-semibold tracking-tight">Perlu tanggal</h2>
              <p className="mb-3 mt-1 text-sm text-muted">
                Kegiatan ini belum punya tanggal, jadi belum muncul di minggu atau kalender mana pun. Edit untuk melengkapinya.
              </p>
              <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {undated.map((item) => (
                  <li key={item.id}><ActivityCard item={item} onEdit={openEdit} onDelete={askDelete} /></li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      <ActivityFormModal open={editorOpen} onOpenChange={setEditorOpen} item={editing} onSubmit={handleSave} />
      <ConfirmationDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Hapus kegiatan ini?"
        description={deleteTarget ? `Kegiatan "${deleteTarget.title}" akan dihapus dan tidak bisa dikembalikan.` : ""}
        confirmLabel="Hapus"
        destructive
        onConfirm={handleDelete}
      />
    </>
  );
}
