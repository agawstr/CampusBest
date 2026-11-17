"use client";

import { useId, useState } from "react";
import { AlertCircle, CalendarClock, ChevronDown, MapPin, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, SegmentedControl, Select } from "@/components/ui/field";
import { WEEKDAY_LABELS_ID } from "@/lib/date";
import { choiceFromValue, choiceToValue } from "@/lib/import/preview";
import type { ScheduleDupAction, ScheduleImportItem, ScheduleItemState } from "@/lib/import/schedule-preview";
import { cn } from "@/lib/utils";
import type { ScheduleMode, Subject } from "@/types";
import { SubjectPicker } from "./import-item-card";

const DUP_OPTIONS: { value: ScheduleDupAction; label: string }[] = [
  { value: "skip", label: "Lewati" },
  { value: "import", label: "Tetap impor" },
];
const MODE_OPTIONS: { value: ScheduleMode; label: string }[] = [
  { value: "offline", label: "Offline" },
  { value: "online", label: "Online" },
];

interface Props {
  state: ScheduleItemState;
  subjects: readonly Subject[];
  onChange: (patch: Partial<ScheduleImportItem>) => void;
  onRemove: () => void;
}

export function ScheduleImportItemCard({ state, subjects, onChange, onRemove }: Props) {
  const { item, errors, dup, ready } = state;
  const uid = useId();
  const [open, setOpen] = useState(false);
  const existingId = item.subject.kind === "existing" ? item.subject.subjectId : undefined;
  const subject = existingId ? subjects.find((s) => s.id === existingId) : undefined;
  const hasErr = Object.keys(errors).length > 0;
  const dimmed = !item.included || (dup !== undefined && item.dupAction === "skip");
  const title = item.sourceSubject || "Tanpa nama";

  return (
    <li className={cn("glass-item rounded-card p-4 shadow-soft transition-opacity duration-fast", dimmed && "opacity-60", hasErr && item.included && "ring-1 ring-danger/50")}>
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={item.included}
          onChange={(e) => onChange({ included: e.target.checked })}
          aria-label={`Impor: ${title}, ${WEEKDAY_LABELS_ID[item.dayOfWeek] ?? ""} ${item.startTime}`}
          className="mt-1 h-5 w-5 shrink-0 accent-[rgb(var(--accent))]"
        />
        <div className="min-w-0 flex-1">
          <p className="break-words font-semibold leading-snug">{title}{item.className ? <span className="font-normal text-muted"> · Kelas {item.className}</span> : null}</p>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs">
            <span className="flex items-center gap-1.5 text-muted">
              <CalendarClock className="h-3.5 w-3.5 shrink-0" aria-hidden />
              {WEEKDAY_LABELS_ID[item.dayOfWeek] ?? "?"}, {item.startTime} - {item.endTime}
            </span>
            {item.room && (
              <span className="flex items-center gap-1.5 text-muted"><MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />{item.room}</span>
            )}
            {item.mode === "online" && <span className="rounded-full bg-fg/10 px-2.5 py-1 font-medium text-muted">Online</span>}
            {item.subject.kind === "existing" && subject ? (
              <span className="flex min-w-0 items-center gap-1.5 text-muted">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: subject.color }} aria-hidden />
                <span className="truncate">{subject.name}</span>
              </span>
            ) : item.subject.kind === "new" ? (
              <span className="rounded-full bg-success/15 px-2.5 py-1 font-medium text-success">Mata kuliah baru</span>
            ) : item.subject.kind === "unresolved" ? (
              <span className="rounded-full bg-danger/15 px-2.5 py-1 font-medium text-danger">Pilih mata kuliah{item.subject.hint ? ` (${item.subject.hint})` : ""}</span>
            ) : null}
            {item.lecturer && <span className="text-muted">Dosen: {item.lecturer}</span>}
          </div>

          {dup && (
            <div className="mt-3 rounded-control border border-amber-500/40 bg-amber-500/10 p-3 text-xs">
              <p className="flex items-start gap-1.5 font-medium text-amber-600 dark:text-amber-400">
                <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />
                <span className="break-words">
                  {dup.kind === "existing" ? `Kayaknya sudah ada di Schedule: "${dup.label}".` : `Kembar dengan jadwal lain di daftar ini: "${dup.label}".`}
                </span>
              </p>
              <div className="mt-2">
                <SegmentedControl<ScheduleDupAction> label="Kalau kembar" value={item.dupAction} onChange={(v) => onChange({ dupAction: v })} options={DUP_OPTIONS} />
              </div>
            </div>
          )}
          {item.warnings.length > 0 && (
            <ul className="mt-2 space-y-0.5 text-xs text-amber-600 dark:text-amber-400">{item.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
          )}
          {item.included && hasErr && (
            <ul role="alert" className="mt-2 space-y-0.5 text-xs text-danger">{Object.values(errors).map((e, i) => <li key={i}>{e}</li>)}</ul>
          )}
          {item.included && !hasErr && !ready && dup && <p className="mt-2 text-xs text-muted">Akan dilewati.</p>}
        </div>

        <div className="flex shrink-0 gap-0.5">
          <Button variant="ghost" size="icon" className="h-9 w-9" aria-expanded={open} aria-label={`${open ? "Tutup" : "Edit"} ${title}`} onClick={() => setOpen((o) => !o)}>
            {open ? <ChevronDown className="h-4 w-4" aria-hidden /> : <Pencil className="h-4 w-4" aria-hidden />}
          </Button>
          <Button variant="ghost" size="icon" className="h-9 w-9 hover:text-danger" aria-label={`Buang ${title}`} onClick={onRemove}>
            <Trash2 className="h-4 w-4" aria-hidden />
          </Button>
        </div>
      </div>

      {open && (
        <div className="mt-4 grid gap-3 border-t border-fg/10 pt-4 sm:grid-cols-3">
          <Field label="Mata kuliah" htmlFor={`${uid}-s`} error={errors.subject} className="sm:col-span-3">
            <SubjectPicker
              id={`${uid}-s`}
              subjects={subjects}
              sourceName={item.sourceSubject}
              value={choiceToValue(item.subject)}
              onChange={(v) => onChange({ subject: choiceFromValue(v) })}
              allowUnresolved={item.subject.kind === "unresolved"}
              allowNone={false}
              invalid={Boolean(errors.subject)}
            />
          </Field>
          <Field label="Hari" htmlFor={`${uid}-d`} error={errors.day}>
            <Select id={`${uid}-d`} value={String(item.dayOfWeek)} onChange={(e) => onChange({ dayOfWeek: Number(e.target.value) })}>
              {WEEKDAY_LABELS_ID.map((label, i) => <option key={label} value={i}>{label}</option>)}
            </Select>
          </Field>
          <Field label="Mulai" htmlFor={`${uid}-m`} error={errors.startTime}>
            <Input id={`${uid}-m`} type="time" value={item.startTime} onChange={(e) => onChange({ startTime: e.target.value })} aria-invalid={Boolean(errors.startTime)} />
          </Field>
          <Field label="Selesai" htmlFor={`${uid}-e`} error={errors.endTime}>
            <Input id={`${uid}-e`} type="time" value={item.endTime} onChange={(e) => onChange({ endTime: e.target.value })} aria-invalid={Boolean(errors.endTime)} />
          </Field>
          <Field label="Ruang (opsional)" htmlFor={`${uid}-r`} className="sm:col-span-2">
            <Input id={`${uid}-r`} value={item.room} onChange={(e) => onChange({ room: e.target.value })} />
          </Field>
          <div>
            <p className="mb-1.5 text-sm font-medium">Mode</p>
            <SegmentedControl<ScheduleMode> label="Mode kuliah" value={item.mode} onChange={(v) => onChange({ mode: v })} options={MODE_OPTIONS} />
          </div>
          <p className="text-xs text-muted sm:col-span-3">Jadwal ini berulang tiap minggu. Kelas dan dosen dari SIAM hanya ditampilkan di sini; dosen dipakai kalau mata kuliahnya dibuat baru.</p>
        </div>
      )}
    </li>
  );
}
