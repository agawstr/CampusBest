"use client";

import { useEffect, useId, useState, type FormEvent } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import {
  MAX_CREDITS, MAX_SEMESTER, SUBJECT_COLORS, emptySubjectForm, subjectToFormValues, validateSubjectForm,
  type SubjectFormErrors, type SubjectFormValues,
} from "@/lib/subjects";
import { cn } from "@/lib/utils";
import type { Subject } from "@/types";
import { autoAbbreviation, classLabel } from "@/lib/course-label";

interface SubjectFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** null = new subject. */
  subject: Subject | null;
  /** Color suggested for a new subject. */
  suggestedColor: string;
  onSubmit: (values: SubjectFormValues) => Promise<void> | void;
}

export function SubjectFormModal({ open, onOpenChange, subject, suggestedColor, onSubmit }: SubjectFormModalProps) {
  const uid = useId();
  const formId = `${uid}-subject-form`;
  const [values, setValues] = useState<SubjectFormValues>(() => emptySubjectForm(suggestedColor));
  const [errors, setErrors] = useState<SubjectFormErrors>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setValues(subject ? subjectToFormValues(subject) : emptySubjectForm(suggestedColor));
    setErrors({});
    setSaving(false);
    // `suggestedColor` is read once per open on purpose, so the pick doesn't change while the form is open.
  }, [open, subject]);

  const set = <K extends keyof SubjectFormValues>(key: K, value: SubjectFormValues[K]) =>
    setValues((v) => ({ ...v, [key]: value }));

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const found = validateSubjectForm(values);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    setSaving(true);
    try {
      await onSubmit(values);
    } finally {
      setSaving(false);
    }
  }

  // A color that isn't in the palette (older data) stays selectable so editing never silently changes it.
  const swatches: { value: string; label: string }[] = SUBJECT_COLORS.some((c) => c.value.toLowerCase() === values.color.toLowerCase())
    ? [...SUBJECT_COLORS]
    : [...SUBJECT_COLORS, { value: values.color, label: "Warna saat ini" }];

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={subject ? "Edit mata kuliah" : "Tambah mata kuliah"}
      description={subject ? "Ubah detail mata kuliah, lalu simpan." : "Isi nama dulu, sisanya boleh menyusul."}
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Batal</Button>
          <Button type="submit" form={formId} disabled={saving}>{subject ? "Simpan" : "Tambah"}</Button>
        </>
      }
    >
      <form id={formId} onSubmit={handleSubmit} noValidate className="space-y-4">
        <Field label="Nama mata kuliah" htmlFor={`${uid}-name`} error={errors.name}>
          <Input
            id={`${uid}-name`}
            value={values.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="Contoh: Basis Data"
            aria-invalid={Boolean(errors.name)}
          />
        </Field>

        <Field
          label="Singkatan (opsional)"
          htmlFor={`${uid}-abbr`}
          error={errors.abbr}
          hint={`Dipakai di Calendar HP. Kosong = otomatis (${autoAbbreviation(values.name)}). Jadwal di ruang lab otomatis jadi "${classLabel((values.abbr ?? "").trim() || autoAbbreviation(values.name), true)}".`}
        >
          <Input
            id={`${uid}-abbr`}
            value={values.abbr ?? ""}
            onChange={(e) => set("abbr", e.target.value)}
            placeholder="JST"
            autoCapitalize="characters"
            aria-invalid={Boolean(errors.abbr)}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Kode (opsional)" htmlFor={`${uid}-code`}>
            <Input id={`${uid}-code`} value={values.code} onChange={(e) => set("code", e.target.value)} placeholder="IF2140" />
          </Field>
          <Field label="Semester (opsional)" htmlFor={`${uid}-semester`} error={errors.semester}>
            <Input
              id={`${uid}-semester`}
              type="number"
              inputMode="numeric"
              min={1}
              max={MAX_SEMESTER}
              value={values.semester}
              onChange={(e) => set("semester", e.target.value)}
              placeholder="3"
              aria-invalid={Boolean(errors.semester)}
            />
          </Field>
        </div>

        <Field label="Dosen (opsional)" htmlFor={`${uid}-lecturer`}>
          <Input id={`${uid}-lecturer`} value={values.lecturer} onChange={(e) => set("lecturer", e.target.value)} placeholder="Nama dosen pengampu" />
        </Field>

        <Field label="SKS (opsional)" htmlFor={`${uid}-credits`} error={errors.credits}>
          <Input
            id={`${uid}-credits`}
            type="number"
            inputMode="numeric"
            min={1}
            max={MAX_CREDITS}
            value={values.credits}
            onChange={(e) => set("credits", e.target.value)}
            placeholder="3"
            aria-invalid={Boolean(errors.credits)}
          />
        </Field>

        <div>
          <p className="mb-2 text-sm font-medium">Warna</p>
          <div role="radiogroup" aria-label="Warna mata kuliah" className="flex flex-wrap gap-2.5">
            {swatches.map((c) => {
              const active = c.value.toLowerCase() === values.color.toLowerCase();
              return (
                <button
                  key={c.value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  aria-label={c.label}
                  title={c.label}
                  onClick={() => set("color", c.value)}
                  className={cn(
                    "grid h-9 w-9 place-items-center rounded-full text-[#0B1020] transition-shadow duration-fast",
                    active && "ring-2 ring-fg ring-offset-2 ring-offset-card",
                  )}
                  style={{ backgroundColor: c.value }}
                >
                  {active && <Check className="h-4 w-4" strokeWidth={3} aria-hidden />}
                </button>
              );
            })}
          </div>
        </div>
      </form>
    </Modal>
  );
}
