"use client";

import { useId, useState } from "react";
import { AlertCircle, CalendarClock, ChevronDown, ExternalLink, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, SegmentedControl } from "@/components/ui/field";
import { OptionPicker, type PickerOption } from "@/components/ui/option-picker";
import { formatDateID } from "@/lib/date";
import { CHOICE_MIXED, CHOICE_NEW, CHOICE_NONE, choiceFromValue, choiceToValue, type DupAction, type ImportItem, type ItemState } from "@/lib/import/preview";
import { safeUrl } from "@/lib/import/text";
import type { TaskFormStatus } from "@/lib/tasks";
import { cn } from "@/lib/utils";
import type { Subject } from "@/types";

const STATUS_OPTIONS: { value: TaskFormStatus; label: string }[] = [
  { value: "todo", label: "Belum mulai" },
  { value: "in_progress", label: "Dikerjakan" },
  { value: "completed", label: "Selesai" },
];
const DUP_OPTIONS: { value: DupAction; label: string }[] = [
  { value: "skip", label: "Lewati" },
  { value: "import", label: "Tetap impor" },
];

interface SubjectPickerProps {
  subjects: readonly Subject[];
  /** The name a "new" subject would get; empty hides the "Buat baru" entry. */
  sourceName: string;
  value: string;
  onChange: (value: string) => void;
  allowUnresolved: boolean;
  allowNone?: boolean;
  /** Set when this row's items currently have different subjects. */
  mixedLabel?: string;
  id?: string;
  ariaLabel?: string;
  invalid?: boolean;
}

/** Subject chooser for the import previews: a short searchable sheet instead of the native full-screen list. */
export function SubjectPicker({ subjects, sourceName, value, onChange, allowUnresolved, allowNone = true, mixedLabel, id, ariaLabel, invalid }: SubjectPickerProps) {
  const options: PickerOption[] = [];
  if (mixedLabel) options.push({ value: CHOICE_MIXED, label: mixedLabel, disabled: true });
  if (allowUnresolved) options.push({ value: "", label: "Pilih mata kuliah…", disabled: true });
  if (allowNone) options.push({ value: CHOICE_NONE, label: "Tanpa mata kuliah" });
  if (sourceName) options.push({ value: CHOICE_NEW, label: `Buat baru: ${sourceName}` });
  for (const s of subjects) options.push({ value: s.id, label: s.code ? `${s.code} · ${s.name}` : s.name });
  return (
    <OptionPicker id={id} ariaLabel={ariaLabel} invalid={invalid} value={value} onChange={onChange} options={options}
      placeholder="Pilih mata kuliah…" title="Pilih mata kuliah" />
  );
}

function deadlineLabel(item: ImportItem): string {
  const date = item.deadline.trim();
  if (!date) return "Tanpa deadline";
  const nice = formatDateID(date, { weekday: "short", day: "numeric", month: "short", year: "numeric" });
  const time = item.deadlineTime.trim();
  return `${nice || date}${time ? `, ${time}` : ""}`;
}

interface Props {
  state: ItemState;
  subjects: readonly Subject[];
  onChange: (patch: Partial<ImportItem>) => void;
  onRemove: () => void;
}

export function ImportItemCard({ state, subjects, onChange, onRemove }: Props) {
  const { item, errors, dup, ready } = state;
  const uid = useId();
  const [open, setOpen] = useState(false);
  const existingId = item.subject.kind === "existing" ? item.subject.subjectId : undefined;
  const subject = existingId ? subjects.find((s) => s.id === existingId) : undefined;
  const hasErr = Object.keys(errors).length > 0;
  const link = safeUrl(item.url.trim());
  const dimmed = !item.included || (dup !== undefined && item.dupAction === "skip");

  return (
    <li className={cn("glass-item rounded-card p-4 shadow-soft transition-opacity duration-fast", dimmed && "opacity-60", hasErr && item.included && "ring-1 ring-danger/50")}>
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={item.included}
          onChange={(e) => onChange({ included: e.target.checked })}
          aria-label={`Impor: ${item.title || "tugas tanpa judul"}`}
          className="mt-1 h-5 w-5 shrink-0 accent-[rgb(var(--accent))]"
        />
        <div className="min-w-0 flex-1">
          <p className="break-words font-semibold leading-snug">{item.title || <span className="text-danger">Tanpa judul</span>}</p>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs">
            {item.subject.kind === "existing" && subject ? (
              <span className="flex min-w-0 items-center gap-1.5 text-muted">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: subject.color }} aria-hidden />
                <span className="truncate">{subject.name}</span>
              </span>
            ) : item.subject.kind === "new" ? (
              <span className="rounded-full bg-success/15 px-2.5 py-1 font-medium text-success">Mata kuliah baru: {item.sourceSubject}</span>
            ) : item.subject.kind === "unresolved" ? (
              <span className="rounded-full bg-danger/15 px-2.5 py-1 font-medium text-danger">Pilih mata kuliah{item.subject.hint ? ` (${item.subject.hint})` : ""}</span>
            ) : (
              <span className="text-muted">Tanpa mata kuliah</span>
            )}
            <span className="flex items-center gap-1.5 text-muted">
              <CalendarClock className="h-3.5 w-3.5 shrink-0" aria-hidden />
              {deadlineLabel(item)}
            </span>
            {item.sourceStatus && (
              <span className="rounded-full bg-fg/10 px-2.5 py-1 font-medium text-muted">Di sumber: {item.sourceStatus}</span>
            )}
            {link && (
              <a href={link} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-accent hover:underline">
                <ExternalLink className="h-3.5 w-3.5" aria-hidden /> Tautan
              </a>
            )}
          </div>

          {dup && (
            <div className="mt-3 rounded-control border border-amber-500/40 bg-amber-500/10 p-3 text-xs">
              <p className="flex items-start gap-1.5 font-medium text-amber-600 dark:text-amber-400">
                <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />
                <span className="break-words">
                  {dup.kind === "existing" ? `Kayaknya sudah ada di Tasks: "${dup.title}".` : `Kembar dengan tugas lain di daftar ini: "${dup.title}".`}
                </span>
              </p>
              <div className="mt-2">
                <SegmentedControl<DupAction> label="Kalau kembar" value={item.dupAction} onChange={(v) => onChange({ dupAction: v })} options={DUP_OPTIONS} />
              </div>
            </div>
          )}

          {item.warnings.length > 0 && (
            <ul className="mt-2 space-y-0.5 text-xs text-amber-600 dark:text-amber-400">
              {item.warnings.map((w, i) => <li key={i}>{w}</li>)}
            </ul>
          )}
          {item.included && hasErr && (
            <ul role="alert" className="mt-2 space-y-0.5 text-xs text-danger">
              {Object.values(errors).map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          )}
          {item.included && !hasErr && !ready && dup && <p className="mt-2 text-xs text-muted">Akan dilewati.</p>}
        </div>

        <div className="flex shrink-0 gap-0.5">
          <Button variant="ghost" size="icon" className="h-9 w-9" aria-expanded={open} aria-label={`${open ? "Tutup" : "Edit"} ${item.title}`} onClick={() => setOpen((o) => !o)}>
            {open ? <ChevronDown className="h-4 w-4" aria-hidden /> : <Pencil className="h-4 w-4" aria-hidden />}
          </Button>
          <Button variant="ghost" size="icon" className="h-9 w-9 hover:text-danger" aria-label={`Buang ${item.title}`} onClick={onRemove}>
            <Trash2 className="h-4 w-4" aria-hidden />
          </Button>
        </div>
      </div>

      {open && (
        <div className="mt-4 grid gap-3 border-t border-fg/10 pt-4 sm:grid-cols-2">
          <Field label="Judul" htmlFor={`${uid}-t`} error={errors.title} className="sm:col-span-2">
            <Input id={`${uid}-t`} value={item.title} onChange={(e) => onChange({ title: e.target.value })} aria-invalid={Boolean(errors.title)} />
          </Field>
          <Field label="Mata kuliah" htmlFor={`${uid}-s`} error={errors.subject} className="sm:col-span-2">
            <SubjectPicker
              id={`${uid}-s`}
              subjects={subjects}
              sourceName={item.sourceSubject}
              value={choiceToValue(item.subject)}
              onChange={(v) => onChange({ subject: choiceFromValue(v) })}
              allowUnresolved={item.subject.kind === "unresolved"}
              invalid={Boolean(errors.subject)}
            />
          </Field>
          <Field label="Tanggal deadline" htmlFor={`${uid}-d`} error={errors.deadline}>
            <Input id={`${uid}-d`} type="date" value={item.deadline} onChange={(e) => onChange({ deadline: e.target.value, deadlineTime: e.target.value ? item.deadlineTime : "" })} aria-invalid={Boolean(errors.deadline)} />
          </Field>
          <Field label="Jam" htmlFor={`${uid}-h`} error={errors.deadlineTime}>
            <Input id={`${uid}-h`} type="time" value={item.deadlineTime} onChange={(e) => onChange({ deadlineTime: e.target.value })} disabled={!item.deadline} aria-invalid={Boolean(errors.deadlineTime)} />
          </Field>
          <Field label="URL (opsional)" htmlFor={`${uid}-u`} error={errors.url} className="sm:col-span-2">
            <Input id={`${uid}-u`} type="url" inputMode="url" value={item.url} onChange={(e) => onChange({ url: e.target.value })} placeholder="https://…" aria-invalid={Boolean(errors.url)} />
          </Field>
          <div className="sm:col-span-2">
            <p className="mb-1.5 text-sm font-medium">Status tugas</p>
            <SegmentedControl<TaskFormStatus> label="Status tugas" value={item.status} onChange={(v) => onChange({ status: v })} options={STATUS_OPTIONS} />
            {item.sourceStatus && <p className="mt-1.5 text-xs text-muted">Di sumber statusnya &quot;{item.sourceStatus}&quot;, tapi status tugas di sini kamu yang tentukan.</p>}
          </div>
        </div>
      )}
    </li>
  );
}
