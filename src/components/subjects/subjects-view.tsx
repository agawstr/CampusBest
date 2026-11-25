"use client";

import { useMemo, useState } from "react";
import { BookOpen, Plus } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { ChipGroup, SegmentedControl } from "@/components/ui/field";
import { useStorage } from "@/hooks/use-storage";
import { useToast } from "@/providers/toast-provider";
import {
  applySubjectEdit, countTasksBySubject, createSubject, defaultSubjectColor, sortSubjects,
  type SubjectFormValues,
} from "@/lib/subjects";
import type { Subject } from "@/types";
import { GpaPanel } from "./gpa-panel";
import { SubjectCard } from "./subject-card";
import { SubjectFormModal } from "./subject-form-modal";

type SubjectsTab = "list" | "gpa";
const TAB_OPTIONS: readonly { value: SubjectsTab; label: string }[] = [
  { value: "list", label: "Mata kuliah" },
  { value: "gpa", label: "IPK & IPS" },
];

export function SubjectsView() {
  const subjectsStore = useStorage("subjects");
  const tasksStore = useStorage("tasks");
  const { toast } = useToast();

  const [tab, setTab] = useState<SubjectsTab>("list");
  const [semesterFilter, setSemesterFilter] = useState<string>("all");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Subject | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Subject | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const subjects = subjectsStore.data;
  const ready = subjectsStore.isReady && tasksStore.isReady;
  const sorted = useMemo(() => sortSubjects(subjects), [subjects]);
  const counts = useMemo(() => countTasksBySubject(tasksStore.data), [tasksStore.data]);
  const semesterOptions = useMemo(() => {
    const nums = Array.from(new Set(subjects.map((s) => s.semester).filter((n): n is number => n !== undefined))).sort((a, b) => b - a);
    if (nums.length === 0) return [];
    return [{ value: "all", label: "Semua" }, ...nums.map((n) => ({ value: String(n), label: `Sem ${n}` }))];
  }, [subjects]);
  const visible = useMemo(
    () => (semesterFilter === "all" ? sorted : sorted.filter((s) => String(s.semester) === semesterFilter)),
    [sorted, semesterFilter],
  );

  async function handleAttendance(subject: Subject, action: "attended" | "absent" | "reset") {
    const nowIso = new Date().toISOString();
    try {
      await subjectsStore.update((list) =>
        list.map((s) => {
          if (s.id !== subject.id) return s;
          const prev = s.attendance ?? { attended: 0, absent: 0, maxAbsences: 3 };
          const next =
            action === "reset"
              ? { attended: 0, absent: 0, maxAbsences: prev.maxAbsences ?? 3 }
              : action === "attended"
                ? { ...prev, attended: prev.attended + 1 }
                : { ...prev, absent: prev.absent + 1 };
          return { ...s, attendance: next, updatedAt: nowIso };
        }),
      );
    } catch {
      fail();
    }
  }

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
        description="Daftar mata kuliah, dosen, SKS, dan kalkulator IPK / IPS."
        actions={tab === "list" && subjects.length > 0 ? addButton : undefined}
      />

      <div className="mb-5 max-w-xs">
        <SegmentedControl<SubjectsTab> label="Tampilan mata kuliah" value={tab} onChange={setTab} options={TAB_OPTIONS} />
      </div>

      {tab === "gpa" ? (
        <GpaPanel />
      ) : !ready ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-hidden>
          {[0, 1, 2].map((i) => <div key={i} className="glass-item h-40 animate-pulse rounded-card" />)}
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
        <>
          {semesterOptions.length > 0 && (
            <div className="mb-4">
              <ChipGroup label="Filter semester" value={semesterFilter} onChange={setSemesterFilter} options={semesterOptions} />
            </div>
          )}
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {visible.map((subject) => (
              <li key={subject.id} className="flex">
                <SubjectCard
                  subject={subject}
                  counts={counts.get(subject.id)}
                  onEdit={openEdit}
                  onDelete={askDelete}
                  onAttendance={handleAttendance}
                />
              </li>
            ))}
          </ul>
        </>
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
