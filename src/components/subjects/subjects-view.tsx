"use client";

import { useMemo, useState } from "react";
import { BookOpen, Plus } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { useStorage } from "@/hooks/use-storage";
import { useToast } from "@/providers/toast-provider";
import {
  applySubjectEdit, countTasksBySubject, createSubject, defaultSubjectColor, sortSubjects,
  type SubjectFormValues,
} from "@/lib/subjects";
import type { Subject } from "@/types";
import { SubjectCard } from "./subject-card";
import { SubjectFormModal } from "./subject-form-modal";

export function SubjectsView() {
  const subjectsStore = useStorage("subjects");
  const tasksStore = useStorage("tasks");
  const { toast } = useToast();

  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Subject | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Subject | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const subjects = subjectsStore.data;
  const ready = subjectsStore.isReady && tasksStore.isReady;
  const sorted = useMemo(() => sortSubjects(subjects), [subjects]);
  const counts = useMemo(() => countTasksBySubject(tasksStore.data), [tasksStore.data]);

  function openCreate() { setEditing(null); setEditorOpen(true); }
  function openEdit(subject: Subject) { setEditing(subject); setEditorOpen(true); }
  function askDelete(subject: Subject) { setDeleteTarget(subject); setDeleteOpen(true); }
  const fail = () => toast({ title: "Gagal menyimpan", description: "Penyimpanan browser penuh atau tidak bisa diakses. Coba lagi ya.", variant: "error" });

  async function handleSave(values: SubjectFormValues) {
    try {
      if (editing) {
        const id = editing.id;
        await subjectsStore.update((list) => list.map((s) => (s.id === id ? applySubjectEdit(s, values) : s)));
        toast({ title: "Mata kuliah diperbarui", variant: "success" });
      } else {
        const subject = createSubject(values);
        await subjectsStore.update((list) => [...list, subject]);
        toast({ title: "Mata kuliah ditambahkan", variant: "success" });
      }
      setEditorOpen(false);
    } catch {
      fail();
    }
  }

  /** Only the subject is removed. Tasks that pointed at it are left exactly as they are. */
  async function handleDelete() {
    if (!deleteTarget) return;
    const id = deleteTarget.id;
    try {
      await subjectsStore.update((list) => list.filter((s) => s.id !== id));
      toast({ title: "Mata kuliah dihapus" });
    } catch {
      fail();
    }
  }

  const linkedTasks = deleteTarget ? counts.get(deleteTarget.id)?.total ?? 0 : 0;
  const addButton = (
    <Button onClick={openCreate}>
      <Plus className="h-4 w-4" aria-hidden />
      Tambah mata kuliah
    </Button>
  );

  return (
    <>
      <PageHeader
        title="Subjects"
        description="Daftar mata kuliah, dosen, dan SKS."
        actions={subjects.length > 0 ? addButton : undefined}
      />

      {!ready ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-hidden>
          {[0, 1, 2].map((i) => <div key={i} className="glass h-40 animate-pulse rounded-card" />)}
        </div>
      ) : subjects.length === 0 ? (
        <Card>
          <EmptyState
            icon={BookOpen}
            title="Belum ada mata kuliah"
            description="Tambahkan mata kuliah semester ini, lalu hubungkan tugas-tugasmu ke sana."
            action={addButton}
          />
        </Card>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {sorted.map((subject) => (
            <li key={subject.id} className="flex">
              <SubjectCard subject={subject} counts={counts.get(subject.id)} onEdit={openEdit} onDelete={askDelete} />
            </li>
          ))}
        </ul>
      )}

      <SubjectFormModal
        open={editorOpen}
        onOpenChange={setEditorOpen}
        subject={editing}
        suggestedColor={defaultSubjectColor(subjects.length)}
        onSubmit={handleSave}
      />
      <ConfirmationDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Hapus mata kuliah ini?"
        description={
          deleteTarget
            ? `"${deleteTarget.name}" akan dihapus.${linkedTasks > 0 ? ` ${linkedTasks} tugas yang terkait tidak ikut dihapus, hanya tidak lagi terhubung ke mata kuliah ini.` : ""}`
            : ""
        }
        confirmLabel="Hapus"
        destructive
        onConfirm={handleDelete}
      />
    </>
  );
}
