"use client";

import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import {
  EMPTY_NOTE_FORM, noteToFormValues, validateNoteForm,
  type NoteFormErrors, type NoteFormValues,
} from "@/lib/notes";
import type { Note, Subject } from "@/types";

interface NoteFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** null = new note. */
  note: Note | null;
  subjects: readonly Subject[];
  /** Resolve true when the note was saved. false = saving failed: the modal stays open with the text intact. */
  onSubmit: (values: NoteFormValues) => Promise<boolean>;
}

const NEW_KEY = "new";

export function NoteFormModal({ open, onOpenChange, note, subjects, onSubmit }: NoteFormModalProps) {
  const uid = useId();
  const formId = `${uid}-note-form`;
  const [values, setValues] = useState<NoteFormValues>(EMPTY_NOTE_FORM);
  const [errors, setErrors] = useState<NoteFormErrors>({});
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [restored, setRestored] = useState(false);

  /**
   * Text of a save that failed, per note ("new" or the note id). It only lives in memory: if the dialog is
   * closed by accident (Esc, click outside) after a failed save, reopening the same note brings the text back.
   * "Batal" and a successful save clear it.
   */
  const drafts = useRef(new Map<string, NoteFormValues>());
  const key = note?.id ?? NEW_KEY;

  // Reset only when the dialog opens, so the fields don't flash empty while it animates closed.
  useEffect(() => {
    if (!open) return;
    const draft = drafts.current.get(key);
    setValues(draft ?? (note ? noteToFormValues(note, new Set(subjects.map((s) => s.id))) : EMPTY_NOTE_FORM));
    setRestored(Boolean(draft));
    setErrors({});
    setSaving(false);
    setSaveFailed(false);
    // `subjects` is read once per open so changes from other tabs don't reset the form.
  }, [open, note]);

  const set = <K extends keyof NoteFormValues>(field: K, value: NoteFormValues[K]) => {
    setValues((v) => ({ ...v, [field]: value }));
    if (saveFailed) setSaveFailed(false);
  };

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (saving) return;
    const found = validateNoteForm(values);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    setSaving(true);
    try {
      const saved = await onSubmit(values);
      if (saved) {
        drafts.current.delete(key);
      } else {
        drafts.current.set(key, values);
        setSaveFailed(true);
      }
    } catch {
      // The view handles its own errors; this is only a safety net so the text is never dropped.
      drafts.current.set(key, values);
      setSaveFailed(true);
    } finally {
      setSaving(false);
    }
  }

  function cancel() {
    drafts.current.delete(key);
    onOpenChange(false);
  }

  /** Ctrl/Cmd + Enter saves from inside the text box. */
  function handleKeyDown(e: KeyboardEvent<HTMLFormElement>) {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      e.currentTarget.requestSubmit();
    }
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={note ? "Edit catatan" : "Tambah catatan"}
      description={note ? "Ubah isi catatannya, lalu simpan." : "Tulis apa saja yang mau kamu ingat dari kuliah."}
      footer={
        <>
          <Button variant="ghost" onClick={cancel}>Batal</Button>
          <Button type="submit" form={formId} disabled={saving}>{note ? "Simpan" : "Tambah"}</Button>
        </>
      }
    >
      <form id={formId} onSubmit={handleSubmit} onKeyDown={handleKeyDown} noValidate className="space-y-4">
        {restored && !saveFailed && (
          <p role="status" className="rounded-control bg-accent/10 px-3 py-2 text-xs text-accent">
            Tulisan yang belum tersimpan tadi sudah dikembalikan. Coba simpan lagi ya.
          </p>
        )}

        <Field label="Judul" htmlFor={`${uid}-title`} error={errors.title}>
          <Input
            id={`${uid}-title`}
            value={values.title}
            onChange={(e) => set("title", e.target.value)}
            placeholder="Contoh: Rangkuman Normalisasi"
            aria-invalid={Boolean(errors.title)}
          />
        </Field>

        <Field label="Isi catatan" htmlFor={`${uid}-content`}>
          <Textarea
            id={`${uid}-content`}
            value={values.content}
            onChange={(e) => set("content", e.target.value)}
            placeholder="Tulis di sini. Teks biasa saja, enter untuk baris baru."
            className="min-h-56"
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

        {saveFailed && (
          <p role="alert" className="rounded-control bg-danger/10 px-3 py-2 text-sm text-danger">
            Catatanmu belum tersimpan, mungkin penyimpanan browser penuh atau tidak bisa diakses. Tulisanmu masih aman di sini, jadi coba simpan lagi ya.
          </p>
        )}
      </form>
    </Modal>
  );
}
