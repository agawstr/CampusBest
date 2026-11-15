"use client";

import { useEffect, useId, useState, type FormEvent } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { EVENT_CATEGORIES, EVENT_CATEGORY_LABELS } from "@/lib/domain";
import {
  EMPTY_EVENT_FORM, EVENT_UNTOUCHED, eventToFormValues, validateEventForm,
  type EventFormErrors, type EventFormTouched, type EventFormValues,
} from "@/lib/events";
import type { CampusEvent, EventCategory, Subject } from "@/types";

interface EventFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** null = new event. */
  event: CampusEvent | null;
  subjects: readonly Subject[];
  /** `touched.category` tells whether the user picked a category, so an untouched unknown stored value can be kept. */
  onSubmit: (values: EventFormValues, touched: EventFormTouched) => Promise<void> | void;
}

export function EventFormModal({ open, onOpenChange, event, subjects, onSubmit }: EventFormModalProps) {
  const uid = useId();
  const formId = `${uid}-event-form`;
  const [values, setValues] = useState<EventFormValues>(EMPTY_EVENT_FORM);
  const [touched, setTouched] = useState<EventFormTouched>(EVENT_UNTOUCHED);
  const [errors, setErrors] = useState<EventFormErrors>({});
  const [saving, setSaving] = useState(false);

  // Reset only when the dialog opens, so the fields don't flash empty while it animates closed.
  useEffect(() => {
    if (!open) return;
    setValues(event ? eventToFormValues(event, new Set(subjects.map((s) => s.id))) : EMPTY_EVENT_FORM);
    setTouched(EVENT_UNTOUCHED);
    setErrors({});
    setSaving(false);
    // `subjects` is read once per open so changes from other tabs don't reset the form.
  }, [open, event]);

  const set = <K extends keyof EventFormValues>(key: K, value: EventFormValues[K]) =>
    setValues((v) => ({ ...v, [key]: value }));

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const found = validateEventForm(values);
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
      title={event ? "Edit event" : "Tambah event"}
      description={event ? "Ubah detail ujian atau event-nya, lalu simpan." : "Catat ujian atau kegiatan kampus biar nggak kelewat."}
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Batal</Button>
          <Button type="submit" form={formId} disabled={saving}>{event ? "Simpan" : "Tambah"}</Button>
        </>
      }
    >
      <form id={formId} onSubmit={handleSubmit} noValidate className="space-y-4">
        <Field label="Nama event" htmlFor={`${uid}-title`} error={errors.title}>
          <Input
            id={`${uid}-title`}
            value={values.title}
            onChange={(e) => set("title", e.target.value)}
            placeholder="Contoh: UTS Basis Data"
            aria-invalid={Boolean(errors.title)}
          />
        </Field>

        <Field label="Kategori" htmlFor={`${uid}-category`}>
          <Select
            id={`${uid}-category`}
            value={values.category}
            onChange={(e) => { set("category", e.target.value as EventCategory); setTouched({ category: true }); }}
          >
            {EVENT_CATEGORIES.map((c) => <option key={c} value={c}>{EVENT_CATEGORY_LABELS[c]}</option>)}
          </Select>
        </Field>

        <Field label="Tanggal" htmlFor={`${uid}-date`} error={errors.date}>
          <Input
            id={`${uid}-date`}
            type="date"
            value={values.date}
            onChange={(e) => set("date", e.target.value)}
            aria-invalid={Boolean(errors.date)}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Jam mulai (opsional)" htmlFor={`${uid}-start`} error={errors.startTime}>
            <Input
              id={`${uid}-start`}
              type="time"
              value={values.startTime}
              onChange={(e) => setValues((v) => ({ ...v, startTime: e.target.value, endTime: e.target.value ? v.endTime : "" }))}
              aria-invalid={Boolean(errors.startTime)}
            />
          </Field>
          <Field label="Jam selesai (opsional)" htmlFor={`${uid}-end`} error={errors.endTime}>
            <Input
              id={`${uid}-end`}
              type="time"
              value={values.endTime}
              onChange={(e) => set("endTime", e.target.value)}
              disabled={!values.startTime}
              aria-invalid={Boolean(errors.endTime)}
            />
          </Field>
        </div>

        <Field label="Lokasi (opsional)" htmlFor={`${uid}-location`}>
          <Input
            id={`${uid}-location`}
            value={values.location}
            onChange={(e) => set("location", e.target.value)}
            placeholder="Contoh: Aula Gedung B"
          />
        </Field>

        <Field
          label="Mata kuliah (opsional)"
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

        <Field label="Deskripsi (opsional)" htmlFor={`${uid}-desc`}>
          <Textarea
            id={`${uid}-desc`}
            value={values.description}
            onChange={(e) => set("description", e.target.value)}
            placeholder="Materi yang keluar, yang perlu dibawa, atau catatan lain"
          />
        </Field>
      </form>
    </Modal>
  );
}
