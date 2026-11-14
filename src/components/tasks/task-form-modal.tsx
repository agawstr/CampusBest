"use client";

import { useEffect, useId, useState, type FormEvent } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Field, Input, SegmentedControl, Select, Textarea } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { TASK_PRIORITY_LABELS, TASK_PRIORITIES } from "@/lib/domain";
import {
  EMPTY_TASK_FORM, UNTOUCHED, taskToFormValues, validateTaskForm,
  type TaskFormErrors, type TaskFormStatus, type TaskFormTouched, type TaskFormValues,
} from "@/lib/tasks";
import type { Subject, Task, TaskPriority } from "@/types";

const PRIORITY_OPTIONS = TASK_PRIORITIES.map((value) => ({ value, label: TASK_PRIORITY_LABELS[value] }));
const STATUS_OPTIONS: { value: TaskFormStatus; label: string }[] = [
  { value: "todo", label: "Belum mulai" },
  { value: "in_progress", label: "Dikerjakan" },
  { value: "completed", label: "Selesai" },
];

interface TaskFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** null = new task. */
  task: Task | null;
  subjects: readonly Subject[];
  /** `touched` tells which of status/priority the user clicked, so untouched unknown stored values can be kept. */
  onSubmit: (values: TaskFormValues, touched: TaskFormTouched) => Promise<void> | void;
}

export function TaskFormModal({ open, onOpenChange, task, subjects, onSubmit }: TaskFormModalProps) {
  const uid = useId();
  const formId = `${uid}-task-form`;
  const [values, setValues] = useState<TaskFormValues>(EMPTY_TASK_FORM);
  const [touched, setTouched] = useState<TaskFormTouched>(UNTOUCHED);
  const [errors, setErrors] = useState<TaskFormErrors>({});
  const [saving, setSaving] = useState(false);

  // Reset only when the dialog opens (not while it animates closed), so the fields don't flash empty.
  useEffect(() => {
    if (!open) return;
    setValues(task ? taskToFormValues(task, new Set(subjects.map((s) => s.id))) : EMPTY_TASK_FORM);
    setTouched(UNTOUCHED);
    setErrors({});
    setSaving(false);
    // `subjects` is deliberately not a dependency: it is read once per open so edits in other tabs don't reset the form.
  }, [open, task]);

  const set = <K extends keyof TaskFormValues>(key: K, value: TaskFormValues[K]) =>
    setValues((v) => ({ ...v, [key]: value }));

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const found = validateTaskForm(values);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    setSaving(true);
    try {
      await onSubmit(values, touched);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={task ? "Edit tugas" : "Tambah tugas"}
      description={task ? "Ubah detail tugasmu, lalu simpan." : "Catat tugas baru biar nggak kelupaan."}
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Batal</Button>
          <Button type="submit" form={formId} disabled={saving}>{task ? "Simpan" : "Tambah"}</Button>
        </>
      }
    >
      <form id={formId} onSubmit={handleSubmit} noValidate className="space-y-4">
        <Field label="Judul" htmlFor={`${uid}-title`} error={errors.title}>
          <Input
            id={`${uid}-title`}
            value={values.title}
            onChange={(e) => set("title", e.target.value)}
            placeholder="Contoh: Laporan praktikum bab 3"
            aria-invalid={Boolean(errors.title)}
          />
        </Field>

        <Field label="Deskripsi (opsional)" htmlFor={`${uid}-desc`}>
          <Textarea
            id={`${uid}-desc`}
            value={values.description}
            onChange={(e) => set("description", e.target.value)}
            placeholder="Catatan singkat, link, atau detail lain"
          />
        </Field>

        <Field
          label="Mata kuliah"
          htmlFor={`${uid}-subject`}
          hint={subjects.length === 0 ? (
            <>Belum ada mata kuliah. <Link href="/subjects" className="font-medium text-accent hover:underline">Tambah dulu di sini</Link>.</>
          ) : undefined}
        >
          <Select id={`${uid}-subject`} value={values.subjectId} onChange={(e) => set("subjectId", e.target.value)}>
            <option value="">Tanpa mata kuliah</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>{s.code ? `${s.code} · ${s.name}` : s.name}</option>
            ))}
          </Select>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Tanggal deadline" htmlFor={`${uid}-date`} error={errors.deadline}>
            <Input
              id={`${uid}-date`}
              type="date"
              value={values.deadline}
              onChange={(e) => setValues((v) => ({ ...v, deadline: e.target.value, deadlineTime: e.target.value ? v.deadlineTime : "" }))}
              aria-invalid={Boolean(errors.deadline)}
            />
          </Field>
          <Field label="Jam" htmlFor={`${uid}-time`} error={errors.deadlineTime}>
            <Input
              id={`${uid}-time`}
              type="time"
              value={values.deadlineTime}
              onChange={(e) => set("deadlineTime", e.target.value)}
              disabled={!values.deadline}
              aria-invalid={Boolean(errors.deadlineTime)}
            />
          </Field>
        </div>

        <div>
          <p className="mb-1.5 text-sm font-medium">Prioritas</p>
          <SegmentedControl<TaskPriority>
            label="Prioritas"
            value={values.priority}
            onChange={(v) => { set("priority", v); setTouched((t) => ({ ...t, priority: true })); }}
            options={PRIORITY_OPTIONS}
          />
        </div>

        <div>
          <p className="mb-1.5 text-sm font-medium">Status</p>
          <SegmentedControl<TaskFormStatus>
            label="Status"
            value={values.status}
            onChange={(v) => { set("status", v); setTouched((t) => ({ ...t, status: true })); }}
            options={STATUS_OPTIONS}
          />
        </div>
      </form>
    </Modal>
  );
}
