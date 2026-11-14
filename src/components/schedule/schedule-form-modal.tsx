"use client";

import { useEffect, useId, useState, type FormEvent } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Field, Input, SegmentedControl, Select } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { WEEKDAY_LABELS_ID, weekdayOrder } from "@/lib/date";
import { SCHEDULE_MODE_LABELS } from "@/lib/domain";
import {
  SCHEDULE_UNTOUCHED, emptyScheduleForm, nextDateForWeekday, scheduleToFormValues, validateScheduleForm, weekdayOf,
  type ScheduleFormErrors, type ScheduleFormTouched, type ScheduleFormValues,
} from "@/lib/schedule";
import type { ScheduleItem, ScheduleMode, ScheduleRecurrence, Subject } from "@/types";

const RECURRENCE_OPTIONS: { value: ScheduleRecurrence; label: string }[] = [
  { value: "weekly", label: "Mingguan" },
  { value: "biweekly", label: "2 mingguan" },
  { value: "none", label: "Sekali" },
];
const MODE_OPTIONS: { value: ScheduleMode; label: string }[] = [
  { value: "offline", label: SCHEDULE_MODE_LABELS.offline },
  { value: "online", label: SCHEDULE_MODE_LABELS.online },
];
const DAY_OPTIONS = weekdayOrder(1);

interface ScheduleFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** null = new schedule. */
  item: ScheduleItem | null;
  subjects: readonly Subject[];
  /** `touched` tells which enum-like fields the user changed, so untouched unknown stored values can be kept. */
  onSubmit: (values: ScheduleFormValues, touched: ScheduleFormTouched) => Promise<void> | void;
}

export function ScheduleFormModal({ open, onOpenChange, item, subjects, onSubmit }: ScheduleFormModalProps) {
  const uid = useId();
  const formId = `${uid}-schedule-form`;
  const [values, setValues] = useState<ScheduleFormValues>(() => emptyScheduleForm());
  const [touched, setTouched] = useState<ScheduleFormTouched>(SCHEDULE_UNTOUCHED);
  const [errors, setErrors] = useState<ScheduleFormErrors>({});
  const [saving, setSaving] = useState(false);

  // Reset only when the dialog opens, so the fields don't flash empty while it animates closed.
  useEffect(() => {
    if (!open) return;
    setValues(item ? scheduleToFormValues(item, new Set(subjects.map((s) => s.id))) : emptyScheduleForm());
    setTouched(SCHEDULE_UNTOUCHED);
    setErrors({});
    setSaving(false);
    // `subjects` is read once per open so changes from other tabs don't reset the form.
  }, [open, item]);

  const set = <K extends keyof ScheduleFormValues>(key: K, value: ScheduleFormValues[K]) =>
    setValues((v) => ({ ...v, [key]: value }));
  const touch = (key: keyof ScheduleFormTouched) => setTouched((t) => ({ ...t, [key]: true }));

  function changeRecurrence(next: ScheduleRecurrence) {
    touch("recurrence");
    setValues((v) => {
      if (next === "weekly") {
        // Keep the same weekday the date had, so switching back and forth doesn't move the class.
        const wd = weekdayOf(v.date);
        return { ...v, recurrence: next, dayOfWeek: wd ?? v.dayOfWeek };
      }
      return { ...v, recurrence: next, date: v.date || nextDateForWeekday(v.dayOfWeek, new Date()) };
    });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const found = validateScheduleForm(values);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    setSaving(true);
    try {
      await onSubmit(values, touched);
    } finally {
      setSaving(false);
    }
  }

  const orphan = Boolean(item && item.subjectId && !subjects.some((s) => s.id === item.subjectId));
  const dated = values.recurrence !== "weekly";
  const dateWeekday = dated ? weekdayOf(values.date) : null;
  const dateHint =
    dateWeekday === null ? undefined
    : values.recurrence === "biweekly" ? `Berulang tiap 2 minggu, setiap hari ${WEEKDAY_LABELS_ID[dateWeekday]}, mulai tanggal ini.`
    : `Hari ${WEEKDAY_LABELS_ID[dateWeekday]}.`;

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={item ? "Edit jadwal" : "Tambah jadwal"}
      description={item ? "Ubah detail jadwal kuliahnya, lalu simpan." : "Atur kapan dan di mana kuliahmu berlangsung."}
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Batal</Button>
          <Button type="submit" form={formId} disabled={saving}>{item ? "Simpan" : "Tambah"}</Button>
        </>
      }
    >
      <form id={formId} onSubmit={handleSubmit} noValidate className="space-y-4">
        <Field
          label="Mata kuliah"
          htmlFor={`${uid}-subject`}
          error={errors.subjectId}
          hint={
            subjects.length === 0 ? (
              <>Belum ada mata kuliah. <Link href="/subjects" className="font-medium text-accent hover:underline">Tambah dulu di sini</Link>.</>
            ) : orphan ? "Mata kuliah sebelumnya sudah dihapus. Pilih yang baru ya." : undefined
          }
        >
          <Select
            id={`${uid}-subject`}
            value={values.subjectId}
            onChange={(e) => set("subjectId", e.target.value)}
            aria-invalid={Boolean(errors.subjectId)}
          >
            <option value="">Pilih mata kuliah</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>{s.code ? `${s.code} · ${s.name}` : s.name}</option>
            ))}
          </Select>
        </Field>

        <div>
          <p className="mb-1.5 text-sm font-medium">Pengulangan</p>
          <SegmentedControl<ScheduleRecurrence>
            label="Pengulangan"
            value={values.recurrence}
            onChange={changeRecurrence}
            options={RECURRENCE_OPTIONS}
          />
        </div>

        {dated ? (
          <Field
            label={values.recurrence === "none" ? "Tanggal" : "Tanggal mulai"}
            htmlFor={`${uid}-date`}
            error={errors.date}
            hint={dateHint}
          >
            <Input
              id={`${uid}-date`}
              type="date"
              value={values.date}
              onChange={(e) => { set("date", e.target.value); touch("date"); }}
              aria-invalid={Boolean(errors.date)}
            />
          </Field>
        ) : (
          <Field label="Hari" htmlFor={`${uid}-day`}>
            <Select
              id={`${uid}-day`}
              value={String(values.dayOfWeek)}
              onChange={(e) => { set("dayOfWeek", Number(e.target.value) as ScheduleFormValues["dayOfWeek"]); touch("dayOfWeek"); }}
            >
              {DAY_OPTIONS.map((d) => <option key={d} value={d}>{WEEKDAY_LABELS_ID[d]}</option>)}
            </Select>
          </Field>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label="Jam mulai" htmlFor={`${uid}-start`} error={errors.startTime}>
            <Input
              id={`${uid}-start`}
              type="time"
              value={values.startTime}
              onChange={(e) => set("startTime", e.target.value)}
              aria-invalid={Boolean(errors.startTime)}
            />
          </Field>
          <Field label="Jam selesai" htmlFor={`${uid}-end`} error={errors.endTime}>
            <Input
              id={`${uid}-end`}
              type="time"
              value={values.endTime}
              onChange={(e) => set("endTime", e.target.value)}
              aria-invalid={Boolean(errors.endTime)}
            />
          </Field>
        </div>

        <Field label="Ruangan (opsional)" htmlFor={`${uid}-room`}>
          <Input
            id={`${uid}-room`}
            value={values.room}
            onChange={(e) => set("room", e.target.value)}
            placeholder={values.mode === "online" ? "Contoh: Zoom, Google Meet" : "Contoh: Gedung A 3.02"}
          />
        </Field>

        <div>
          <p className="mb-1.5 text-sm font-medium">Mode kuliah</p>
          <SegmentedControl<ScheduleMode>
            label="Mode kuliah"
            value={values.mode}
            onChange={(v) => { set("mode", v); touch("mode"); }}
            options={MODE_OPTIONS}
          />
        </div>
      </form>
    </Modal>
  );
}
