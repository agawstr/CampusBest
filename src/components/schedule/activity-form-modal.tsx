"use client";

import { useEffect, useId, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, SegmentedControl, Select, Textarea } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import {
  ACTIVITY_CATEGORIES, ACTIVITY_UNTOUCHED, MAX_LOCATION, MAX_NOTES, MAX_TITLE, activityToFormValues, categoryLabel,
  emptyActivityForm, validateActivityForm,
  type ActivityFormErrors, type ActivityFormTouched, type ActivityFormValues,
} from "@/lib/activities";
import { WEEKDAY_LABELS_ID, weekdayOrder } from "@/lib/date";
import { nextDateForWeekday, weekdayOf } from "@/lib/schedule";
import type { Activity, ActivityCategory, ActivityRecurrence } from "@/types";

const RECURRENCE_OPTIONS: { value: ActivityRecurrence; label: string }[] = [
  { value: "none", label: "Sekali" },
  { value: "weekly", label: "Mingguan" },
  { value: "biweekly", label: "2 mingguan" },
];
const DAY_OPTIONS = weekdayOrder(1);

interface ActivityFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** null = new activity. */
  item: Activity | null;
  onSubmit: (values: ActivityFormValues, touched: ActivityFormTouched) => Promise<void> | void;
}

export function ActivityFormModal({ open, onOpenChange, item, onSubmit }: ActivityFormModalProps) {
  const uid = useId();
  const formId = `${uid}-activity-form`;
  const [values, setValues] = useState<ActivityFormValues>(() => emptyActivityForm());
  const [touched, setTouched] = useState<ActivityFormTouched>(ACTIVITY_UNTOUCHED);
  const [errors, setErrors] = useState<ActivityFormErrors>({});
  const [saving, setSaving] = useState(false);

  // Reset only when the dialog opens, so the fields don't flash empty while it animates closed.
  useEffect(() => {
    if (!open) return;
    setValues(item ? activityToFormValues(item) : emptyActivityForm());
    setTouched(ACTIVITY_UNTOUCHED);
    setErrors({});
    setSaving(false);
  }, [open, item]);

  const set = <K extends keyof ActivityFormValues>(key: K, value: ActivityFormValues[K]) =>
    setValues((v) => ({ ...v, [key]: value }));
  const touch = (key: keyof ActivityFormTouched) => setTouched((t) => ({ ...t, [key]: true }));

  function changeRecurrence(next: ActivityRecurrence) {
    touch("recurrence");
    setValues((v) => {
      if (next === "weekly") {
        const wd = weekdayOf(v.date);
        return { ...v, recurrence: next, dayOfWeek: wd ?? v.dayOfWeek };
      }
      return { ...v, recurrence: next, date: v.date || nextDateForWeekday(v.dayOfWeek, new Date()) };
    });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (saving) return;
    const found = validateActivityForm(values);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    setSaving(true);
    try {
      await onSubmit(values, touched);
    } finally {
      setSaving(false);
    }
  }

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
      title={item ? "Edit kegiatan" : "Tambah kegiatan"}
      description={item ? "Ubah detail kegiatannya, lalu simpan." : "Catat kegiatan di luar kuliah, misalnya organisasi, olahraga, atau kerja."}
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Batal</Button>
          <Button type="submit" form={formId} disabled={saving}>{item ? "Simpan" : "Tambah"}</Button>
        </>
      }
    >
      <form id={formId} onSubmit={handleSubmit} noValidate className="space-y-4">
        <Field label="Judul" htmlFor={`${uid}-title`} error={errors.title}>
          <Input
            id={`${uid}-title`}
            value={values.title}
            maxLength={MAX_TITLE + 40}
            onChange={(e) => set("title", e.target.value)}
            placeholder="Contoh: Rapat himpunan"
            aria-invalid={Boolean(errors.title)}
          />
        </Field>

        <Field label="Kategori" htmlFor={`${uid}-category`}>
          <Select
            id={`${uid}-category`}
            value={values.category}
            onChange={(e) => { set("category", e.target.value as ActivityCategory); touch("category"); }}
          >
            {ACTIVITY_CATEGORIES.map((c) => <option key={c} value={c}>{categoryLabel(c)}</option>)}
          </Select>
        </Field>

        <div>
          <p className="mb-1.5 text-sm font-medium">Pengulangan</p>
          <SegmentedControl<ActivityRecurrence>
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
              onChange={(e) => { set("dayOfWeek", Number(e.target.value) as ActivityFormValues["dayOfWeek"]); touch("dayOfWeek"); }}
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
          <Field label="Jam selesai (opsional)" htmlFor={`${uid}-end`} error={errors.endTime}>
            <Input
              id={`${uid}-end`}
              type="time"
              value={values.endTime}
              onChange={(e) => set("endTime", e.target.value)}
              aria-invalid={Boolean(errors.endTime)}
            />
          </Field>
        </div>

        <Field label="Lokasi (opsional)" htmlFor={`${uid}-location`} error={errors.location}>
          <Input
            id={`${uid}-location`}
            value={values.location}
            maxLength={MAX_LOCATION + 40}
            onChange={(e) => set("location", e.target.value)}
            placeholder="Contoh: Sekretariat, GOR, Zoom"
          />
        </Field>

        <Field label="Catatan (opsional)" htmlFor={`${uid}-notes`} error={errors.notes}>
          <Textarea
            id={`${uid}-notes`}
            value={values.notes}
            maxLength={MAX_NOTES + 100}
            onChange={(e) => set("notes", e.target.value)}
            placeholder="Apa yang perlu dibawa atau diingat"
          />
        </Field>
      </form>
    </Modal>
  );
}
