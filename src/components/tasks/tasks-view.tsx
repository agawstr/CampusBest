"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ClipboardPaste, ListChecks, Plus, Search, SearchX, X } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { ChipGroup, Input, Select } from "@/components/ui/field";
import { useOpenFromQuery } from "@/hooks/use-open-from-query";
import { useStorage } from "@/hooks/use-storage";
import { storage } from "@/lib/storage";
import { useToast } from "@/providers/toast-provider";
import { isTaskDone, TASK_PRIORITIES, TASK_PRIORITY_LABELS, TASK_STATUS_KIND_LABELS } from "@/lib/domain";
import {
  applyTaskEdit, createTask, fieldsToPreserve, filterTasks, sortTasks, toggleTaskDone,
  type PriorityFilter, type StatusFilter, type TaskFormTouched, type TaskFormValues, type TaskSort,
} from "@/lib/tasks";
import type { Task, TaskSubtask } from "@/types";
import { TaskFormModal } from "./task-form-modal";
import { TaskItem } from "./task-item";

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "Semua" },
  { value: "todo", label: TASK_STATUS_KIND_LABELS.todo },
  { value: "in_progress", label: TASK_STATUS_KIND_LABELS.in_progress },
  { value: "done", label: TASK_STATUS_KIND_LABELS.done },
];

const PRIORITY_OPTIONS: { value: PriorityFilter; label: string }[] = [
  { value: "all", label: "Semua" },
  ...[...TASK_PRIORITIES].reverse().map((value) => ({ value, label: TASK_PRIORITY_LABELS[value] })),
];

function ListSkeleton() {
  return (
    <div className="space-y-3" aria-hidden>
      {[0, 1, 2].map((i) => <div key={i} className="glass-item h-[88px] animate-pulse rounded-card" />)}
    </div>
  );
}

export function TasksView() {
  const tasksStore = useStorage("tasks");
  const subjectsStore = useStorage("subjects");
  const { toast } = useToast();

  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [priority, setPriority] = useState<PriorityFilter>("all");
  const [sort, setSort] = useState<TaskSort>("deadline");

  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Task | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const tasks = tasksStore.data;
  const subjects = subjectsStore.data;
  const ready = tasksStore.isReady && subjectsStore.isReady;
  const subjectsById = useMemo(() => new Map(subjects.map((s) => [s.id, s])), [subjects]);
  const visible = useMemo(
    () => sortTasks(filterTasks(tasks, subjectsById, { query, status, priority }), sort),
    [tasks, subjectsById, query, status, priority, sort],
  );
  const activeCount = tasks.filter((t) => !isTaskDone(t)).length;
  const filtering = query.trim() !== "" || status !== "all" || priority !== "all";
  const now = new Date();

  function openCreate() { setEditing(null); setEditorOpen(true); }
  useOpenFromQuery(openCreate); // dashboard quick action: /tasks?tambah=1
  function openEdit(task: Task) { setEditing(task); setEditorOpen(true); }
  function askDelete(task: Task) { setDeleteTarget(task); setDeleteOpen(true); }
  function resetFilters() { setQuery(""); setStatus("all"); setPriority("all"); }
  const fail = () => toast({ title: "Gagal menyimpan", description: "Penyimpanan browser penuh atau tidak bisa diakses. Coba lagi ya.", variant: "error" });

  /** Original stored status/priority of a task whose value normalization didn't recognize. Call inside update(). */
  const rawOf = (id: string) => (field: "status" | "priority") => storage.getCoercedRaw("tasks", id, field);

  async function handleSave(values: TaskFormValues, touched: TaskFormTouched, subtasks: TaskSubtask[]) {
    const cleanSubtasks = subtasks.length > 0 ? subtasks : undefined;
    try {
      if (editing) {
        const id = editing.id;
        // Runs inside update(), right after the collection is re-read, so the raw values are current.
        await tasksStore.update((list) =>
          list.map((t) => {
            if (t.id !== id) return t;
            const next = applyTaskEdit(t, values, new Date(), fieldsToPreserve(touched, rawOf(id)));
            if (cleanSubtasks) return { ...next, subtasks: cleanSubtasks };
            const { subtasks: _drop, ...rest } = next;
            void _drop;
            return rest;
          }),
        );
        toast({ title: "Tugas diperbarui", variant: "success" });
      } else {
        const base = createTask(values);
        const task = cleanSubtasks ? { ...base, subtasks: cleanSubtasks } : base;
        await tasksStore.update((list) => [...list, task]);
        toast({ title: "Tugas ditambahkan", variant: "success" });
      }
      setEditorOpen(false);
    } catch {
      fail();
    }
  }

  async function handleCycleStatus(task: Task) {
    const nowIso = new Date().toISOString();
    const nextStatus = isTaskDone(task) ? "todo" : task.status === "in_progress" ? "completed" : "in_progress";
    try {
      await tasksStore.update((list) =>
        list.map((t) => {
          if (t.id !== task.id) return t;
          const updated: Task = { ...t, status: nextStatus, updatedAt: nowIso };
          if (nextStatus === "completed") updated.completedAt = nowIso;
          else delete updated.completedAt;
          return updated;
        }),
      );
    } catch {
      fail();
    }
  }

  async function handleToggleSubtask(task: Task, subtaskId: string) {
    const nowIso = new Date().toISOString();
    try {
      await tasksStore.update((list) =>
        list.map((t) =>
          t.id === task.id
            ? {
                ...t,
                subtasks: (t.subtasks ?? []).map((s) => (s.id === subtaskId ? { ...s, done: !s.done } : s)),
                updatedAt: nowIso,
              }
            : t,
        ),
      );
    } catch {
      fail();
    }
  }

  async function handleToggle(task: Task) {
    try {
      await tasksStore.update((list) =>
        list.map((t) =>
          t.id === task.id
            ? toggleTaskDone(t, new Date(), fieldsToPreserve({ status: true, priority: false }, rawOf(t.id)))
            : t,
        ),
      );
    } catch {
      fail();
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    const id = deleteTarget.id;
    try {
      await tasksStore.update((list) => list.filter((t) => t.id !== id));
      toast({ title: "Tugas dihapus" });
    } catch {
      fail();
    }
  }

  const addButton = (
    <Button onClick={openCreate}>
      <Plus className="h-4 w-4" aria-hidden />
      Tambah tugas
    </Button>
  );

  return (
    <>
      <PageHeader
        title="Tasks"
        description="Kelola tugas berdasarkan mata kuliah dan prioritas."
        actions={
          <>
            <Link href="/import" className="glass-item inline-flex h-11 items-center gap-2 rounded-control px-4 text-sm font-semibold transition-colors duration-fast hover:bg-fg/10">
              <ClipboardPaste className="h-4 w-4" aria-hidden />
              Import
            </Link>
            {tasks.length > 0 ? addButton : null}
          </>
        }
      />

      {!ready ? (
        <ListSkeleton />
      ) : tasks.length === 0 ? (
        <Card>
          <EmptyState
            icon={ListChecks}
            title="Belum ada tugas"
            description="Catat tugas kuliahmu di sini lengkap dengan deadline dan prioritas, biar nggak ada yang kelewat."
            action={addButton}
          />
        </Card>
      ) : (
        <>
          <div className="space-y-3">
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
                <Input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Cari judul, deskripsi, atau mata kuliah"
                  aria-label="Cari tugas"
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
              <Select value={sort} onChange={(e) => setSort(e.target.value as TaskSort)} aria-label="Urutkan tugas" className="sm:w-52">
                <option value="deadline">Urut: Deadline terdekat</option>
                <option value="priority">Urut: Prioritas tertinggi</option>
              </Select>
            </div>

            <div className="flex items-center gap-3">
              <span className="w-16 shrink-0 text-xs text-muted">Status</span>
              <div className="min-w-0 flex-1">
                <ChipGroup label="Filter status" value={status} onChange={setStatus} options={STATUS_OPTIONS} />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="w-16 shrink-0 text-xs text-muted">Prioritas</span>
              <div className="min-w-0 flex-1">
                <ChipGroup label="Filter prioritas" value={priority} onChange={setPriority} options={PRIORITY_OPTIONS} />
              </div>
            </div>
          </div>

          <p className="mb-3 mt-4 text-sm text-muted" aria-live="polite">
            {filtering ? `${visible.length} dari ${tasks.length} tugas` : `${tasks.length} tugas, ${activeCount} belum selesai`}
          </p>

          {visible.length === 0 ? (
            <Card>
              <EmptyState
                icon={SearchX}
                title="Tidak ada tugas yang cocok"
                description="Coba ubah kata kunci atau filter yang sedang dipakai."
                action={<Button variant="secondary" onClick={resetFilters}>Reset filter</Button>}
              />
            </Card>
          ) : (
            <ul className="space-y-3">
              {visible.map((task) => (
                <li key={task.id}>
                  <TaskItem
                    task={task}
                    subject={task.subjectId ? subjectsById.get(task.subjectId) : undefined}
                    now={now}
                    onToggle={handleToggle}
                    onCycleStatus={handleCycleStatus}
                    onToggleSubtask={handleToggleSubtask}
                    onEdit={openEdit}
                    onDelete={askDelete}
                  />
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <TaskFormModal open={editorOpen} onOpenChange={setEditorOpen} task={editing} subjects={subjects} onSubmit={handleSave} />
      <ConfirmationDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Hapus tugas ini?"
        description={deleteTarget ? `"${deleteTarget.title}" akan dihapus dan tidak bisa dikembalikan.` : ""}
        confirmLabel="Hapus"
        destructive
        onConfirm={handleDelete}
      />
    </>
  );
}
