"use client";

import { useMemo, useState } from "react";
import { NotebookPen, Plus, Search, SearchX, X } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { ChipGroup, Input, Select } from "@/components/ui/field";
import { useOpenFromQuery } from "@/hooks/use-open-from-query";
import { useStorage } from "@/hooks/use-storage";
import {
  NOTE_SORTS, NOTE_SORT_LABELS, applyNoteEdit, createNote, filterNotes, isPinned, sortNotes, togglePinned,
  type NoteFormValues, type NoteSort, type NoteSubjectFilter,
} from "@/lib/notes";
import { getStorageAdapter } from "@/lib/storage";
import { useToast } from "@/providers/toast-provider";
import type { Note } from "@/types";
import { NoteCard } from "./note-card";
import { NoteFormModal } from "./note-form-modal";

const SORT_OPTIONS = NOTE_SORTS.map((value) => ({ value, label: NOTE_SORT_LABELS[value] }));

function ListSkeleton() {
  return (
    <div className="grid gap-3 md:grid-cols-2" aria-hidden>
      {[0, 1, 2, 3].map((i) => <div key={i} className="glass-item h-[140px] animate-pulse rounded-card" />)}
    </div>
  );
}

export function NotesView() {
  const notesStore = useStorage("notes");
  const subjectsStore = useStorage("subjects");
  const { toast } = useToast();

  const [query, setQuery] = useState("");
  const [subject, setSubject] = useState<NoteSubjectFilter>("all");
  const [sort, setSort] = useState<NoteSort>("updated");

  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Note | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Note | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const notes = notesStore.data;
  const subjects = subjectsStore.data;
  const ready = notesStore.isReady && subjectsStore.isReady;
  const subjectsById = useMemo(() => new Map(subjects.map((s) => [s.id, s])), [subjects]);
  // A filter that points at a subject deleted in the meantime would hide everything: treat it as "all".
  const activeSubject: NoteSubjectFilter = subject === "all" || subject === "none" || subjectsById.has(subject) ? subject : "all";
  const visible = useMemo(
    () => sortNotes(filterNotes(notes, subjectsById, { query, subject: activeSubject }), sort),
    [notes, subjectsById, query, activeSubject, sort],
  );
  const now = new Date();
  const pinnedCount = notes.filter(isPinned).length;
  const filtering = query.trim() !== "" || activeSubject !== "all";

  function openCreate() { setEditing(null); setEditorOpen(true); }
  useOpenFromQuery(openCreate); // dashboard quick action: /notes?tambah=1
  function openEdit(note: Note) { setEditing(note); setEditorOpen(true); }
  function askDelete(note: Note) { setDeleteTarget(note); setDeleteOpen(true); }
  function resetFilters() { setQuery(""); setSubject("all"); }
  const fail = (description = "Penyimpanan browser penuh atau tidak bisa diakses. Coba lagi ya.") =>
    toast({ title: "Gagal menyimpan", description, variant: "error" });

  /**
   * LocalStorage that is blocked (private mode, site data disabled) makes the storage layer skip writes
   * without an error, which would look like a successful save. Check first so the user gets the error
   * and keeps their text. A full storage (quota) throws from the write itself and is caught below.
   */
  function ensureWritable() {
    if (!getStorageAdapter().isAvailable()) throw new Error("storage unavailable");
  }

  /** Returns true when saved. On failure the form stays open and keeps what the user typed. */
  async function handleSave(values: NoteFormValues): Promise<boolean> {
    try {
      ensureWritable();
      if (editing) {
        const id = editing.id;
        await notesStore.update((list) => list.map((n) => (n.id === id ? applyNoteEdit(n, values) : n)));
        toast({ title: "Catatan diperbarui", variant: "success" });
      } else {
        const note = createNote(values);
        await notesStore.update((list) => [...list, note]);
        toast({ title: "Catatan ditambahkan", variant: "success" });
      }
      setEditorOpen(false);
      return true;
    } catch {
      fail("Isi catatanmu masih ada di form, jadi coba simpan lagi ya.");
      return false;
    }
  }

  async function handleTogglePin(note: Note) {
    try {
      ensureWritable();
      await notesStore.update((list) => list.map((n) => (n.id === note.id ? togglePinned(n) : n)));
    } catch {
      fail();
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    const id = deleteTarget.id;
    try {
      ensureWritable();
      await notesStore.update((list) => list.filter((n) => n.id !== id));
      toast({ title: "Catatan dihapus" });
    } catch {
      fail("Catatannya belum terhapus. Coba lagi ya.");
    }
  }

  const addButton = (
    <Button onClick={openCreate}>
      <Plus className="h-4 w-4" aria-hidden />
      Tambah catatan
    </Button>
  );

  return (
    <>
      <PageHeader
        title="Notes"
        description="Catatan kuliahmu, dikelompokkan per mata kuliah. Sematkan yang paling sering kamu buka."
        actions={notes.length > 0 ? addButton : undefined}
      />

      {!ready ? (
        <ListSkeleton />
      ) : notes.length === 0 ? (
        <Card>
          <EmptyState
            icon={NotebookPen}
            title="Belum ada catatan"
            description="Tulis rangkuman materi, poin dari dosen, atau apa pun yang mau kamu ingat."
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
                placeholder="Cari judul, isi, atau mata kuliah"
                aria-label="Cari catatan"
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
              <label htmlFor="notes-subject-filter" className="w-20 shrink-0 text-xs text-muted">Mata kuliah</label>
              <Select
                id="notes-subject-filter"
                value={activeSubject}
                onChange={(e) => setSubject(e.target.value)}
                className="min-w-0 flex-1"
              >
                <option value="all">Semua mata kuliah</option>
                <option value="none">Tanpa mata kuliah</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>{s.code ? `${s.code} · ${s.name}` : s.name}</option>
                ))}
              </Select>
            </div>
            <div className="flex items-center gap-3">
              <span className="w-20 shrink-0 text-xs text-muted">Urutkan</span>
              <div className="min-w-0 flex-1">
                <ChipGroup label="Urutkan catatan" value={sort} onChange={setSort} options={SORT_OPTIONS} />
              </div>
            </div>
          </div>

          <p className="mb-3 mt-4 text-sm text-muted" aria-live="polite">
            {filtering
              ? `${visible.length} dari ${notes.length} catatan`
              : `${notes.length} catatan${pinnedCount > 0 ? `, ${pinnedCount} disematkan` : ""}`}
          </p>

          {visible.length === 0 ? (
            <Card>
              <EmptyState
                icon={SearchX}
                title="Tidak ada catatan yang cocok"
                description="Coba ubah kata kunci atau pilihan mata kuliahnya."
                action={<Button variant="secondary" onClick={resetFilters}>Reset filter</Button>}
              />
            </Card>
          ) : (
            <ul className="grid gap-3 md:grid-cols-2">
              {visible.map((note) => (
                <li key={note.id}>
                  <NoteCard
                    note={note}
                    subject={note.subjectId ? subjectsById.get(note.subjectId) : undefined}
                    now={now}
                    onEdit={openEdit}
                    onDelete={askDelete}
                    onTogglePin={handleTogglePin}
                  />
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <NoteFormModal open={editorOpen} onOpenChange={setEditorOpen} note={editing} subjects={subjects} onSubmit={handleSave} />
      <ConfirmationDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Hapus catatan ini?"
        description={deleteTarget ? `"${deleteTarget.title}" akan dihapus dan tidak bisa dikembalikan.` : ""}
        confirmLabel="Hapus"
        destructive
        onConfirm={handleDelete}
      />
    </>
  );
}
