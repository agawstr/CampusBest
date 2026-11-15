"use client";

import { useMemo, useState } from "react";
import { ClipboardCheck, Plus, Search, SearchX, X } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { ChipGroup, Input } from "@/components/ui/field";
import { useOpenFromQuery } from "@/hooks/use-open-from-query";
import { useStorage } from "@/hooks/use-storage";
import { EVENT_CATEGORIES, EVENT_CATEGORY_LABELS } from "@/lib/domain";
import {
  applyEventEdit, createEvent, eventDaysAway, eventFieldsToPreserve, filterEvents, sortEvents,
  type CategoryFilter, type EventFormTouched, type EventFormValues, type TimeFilter,
} from "@/lib/events";
import { storage } from "@/lib/storage";
import { useToast } from "@/providers/toast-provider";
import type { CampusEvent } from "@/types";
import { EventFormModal } from "./event-form-modal";
import { EventItem } from "./event-item";

const CATEGORY_OPTIONS: { value: CategoryFilter; label: string }[] = [
  { value: "all", label: "Semua" },
  ...EVENT_CATEGORIES.map((value) => ({ value, label: EVENT_CATEGORY_LABELS[value] })),
];

const TIME_OPTIONS: { value: TimeFilter; label: string }[] = [
  { value: "all", label: "Semua" },
  { value: "today", label: "Hari ini" },
  { value: "week", label: "7 hari ke depan" },
  { value: "upcoming", label: "Mendatang" },
  { value: "past", label: "Sudah lewat" },
];

function ListSkeleton() {
  return (
    <div className="space-y-3" aria-hidden>
      {[0, 1, 2].map((i) => <div key={i} className="glass h-[112px] animate-pulse rounded-card" />)}
    </div>
  );
}

export function EventsView() {
  const eventsStore = useStorage("events");
  const subjectsStore = useStorage("subjects");
  const { toast } = useToast();

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [time, setTime] = useState<TimeFilter>("all");

  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<CampusEvent | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CampusEvent | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const events = eventsStore.data;
  const subjects = subjectsStore.data;
  const ready = eventsStore.isReady && subjectsStore.isReady;
  const subjectsById = useMemo(() => new Map(subjects.map((s) => [s.id, s])), [subjects]);
  const now = new Date();
  const visible = useMemo(
    () => sortEvents(filterEvents(events, subjectsById, { query, category, time }, now), now),
    // `now` changes every render; the list only needs to be recomputed when the inputs change.
    [events, subjectsById, query, category, time],
  );
  const upcomingCount = events.filter((e) => (eventDaysAway(e, now) ?? -1) >= 0).length;
  const filtering = query.trim() !== "" || category !== "all" || time !== "all";

  function openCreate() { setEditing(null); setEditorOpen(true); }
  useOpenFromQuery(openCreate); // dashboard quick action: /exams?tambah=1
  function openEdit(event: CampusEvent) { setEditing(event); setEditorOpen(true); }
  function askDelete(event: CampusEvent) { setDeleteTarget(event); setDeleteOpen(true); }
  function resetFilters() { setQuery(""); setCategory("all"); setTime("all"); }
  const fail = () => toast({ title: "Gagal menyimpan", description: "Penyimpanan browser penuh atau tidak bisa diakses. Coba lagi ya.", variant: "error" });

  /** Original stored category/type of an event whose value normalization didn't recognize. Call inside update(). */
  const rawOf = (id: string) => (field: "category" | "type") => storage.getCoercedRaw("events", id, field);

  async function handleSave(values: EventFormValues, touched: EventFormTouched) {
    try {
      if (editing) {
        const id = editing.id;
        // Runs inside update(), right after the collection is re-read, so the raw values are current.
        await eventsStore.update((list) =>
          list.map((e) => (e.id === id ? applyEventEdit(e, values, new Date(), eventFieldsToPreserve(touched, rawOf(id)), touched) : e)),
        );
        toast({ title: "Event diperbarui", variant: "success" });
      } else {
        const event = createEvent(values);
        await eventsStore.update((list) => [...list, event]);
        toast({ title: "Event ditambahkan", variant: "success" });
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
      await eventsStore.update((list) => list.filter((e) => e.id !== id));
      toast({ title: "Event dihapus" });
    } catch {
      fail();
    }
  }

  const addButton = (
    <Button onClick={openCreate}>
      <Plus className="h-4 w-4" aria-hidden />
      Tambah event
    </Button>
  );

  return (
    <>
      <PageHeader
        title="Exams & Events"
        description="Pantau jadwal ujian, quiz, dan kegiatan kampus. Semuanya otomatis muncul di Calendar."
        actions={events.length > 0 ? addButton : undefined}
      />

      {!ready ? (
        <ListSkeleton />
      ) : events.length === 0 ? (
        <Card>
          <EmptyState
            icon={ClipboardCheck}
            title="Belum ada ujian atau event"
            description="Catat UTS, UAS, quiz, presentasi, atau seminar di sini. Tanggalnya langsung muncul di Calendar."
            action={addButton}
          />
        </Card>
      ) : (
        <>
          <div className="space-y-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
              <Input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Cari nama, deskripsi, lokasi, atau mata kuliah"
                aria-label="Cari event"
                className="pl-10 pr-10 [&::-webkit-search-cancel-button]:hidden"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  aria-label="Hapus pencarian"
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-muted hover:text-fg"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-3">
              <span className="w-16 shrink-0 text-xs text-muted">Kategori</span>
              <div className="min-w-0 flex-1">
                <ChipGroup label="Filter kategori" value={category} onChange={setCategory} options={CATEGORY_OPTIONS} />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="w-16 shrink-0 text-xs text-muted">Waktu</span>
              <div className="min-w-0 flex-1">
                <ChipGroup label="Filter waktu" value={time} onChange={setTime} options={TIME_OPTIONS} />
              </div>
            </div>
          </div>

          <p className="mb-3 mt-4 text-sm text-muted" aria-live="polite">
            {filtering ? `${visible.length} dari ${events.length} event` : `${events.length} event, ${upcomingCount} mendatang`}
          </p>

          {visible.length === 0 ? (
            <Card>
              <EmptyState
                icon={SearchX}
                title="Tidak ada event yang cocok"
                description="Coba ubah kata kunci atau filter yang sedang dipakai."
                action={<Button variant="secondary" onClick={resetFilters}>Reset filter</Button>}
              />
            </Card>
          ) : (
            <ul className="space-y-3">
              {visible.map((event) => (
                <li key={event.id}>
                  <EventItem
                    event={event}
                    subject={event.subjectId ? subjectsById.get(event.subjectId) : undefined}
                    now={now}
                    onEdit={openEdit}
                    onDelete={askDelete}
                  />
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <EventFormModal open={editorOpen} onOpenChange={setEditorOpen} event={editing} subjects={subjects} onSubmit={handleSave} />
      <ConfirmationDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Hapus event ini?"
        description={deleteTarget ? `"${deleteTarget.title}" akan dihapus dan tidak bisa dikembalikan.` : ""}
        confirmLabel="Hapus"
        destructive
        onConfirm={handleDelete}
      />
    </>
  );
}
