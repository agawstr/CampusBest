"use client";

import { BookOpen, Pencil, RotateCcw, Trash2, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { SubjectTaskCount } from "@/lib/subjects";
import { cn } from "@/lib/utils";
import type { Subject } from "@/types";

interface SubjectCardProps {
  subject: Subject;
  counts?: SubjectTaskCount;
  delay?: number;
  onEdit: (subject: Subject) => void;
  onDelete: (subject: Subject) => void;
  onAttendance?: (subject: Subject, action: "attended" | "absent" | "reset") => void;
}

export function SubjectCard({ subject, counts, delay, onEdit, onDelete, onAttendance }: SubjectCardProps) {
  const chips = [
    subject.semester !== undefined ? `Semester ${subject.semester}` : null,
    subject.credits !== undefined ? `${subject.credits} SKS` : null,
  ].filter((v): v is string => v !== null);
  const att = subject.attendance ?? { attended: 0, absent: 0, maxAbsences: 3 };
  const maxAbs = att.maxAbsences ?? 3;
  const remaining = Math.max(0, maxAbs - att.absent);
  const warnAbs = att.absent >= maxAbs;

  return (
    <Card surface="item" delay={delay} className="flex w-full flex-col p-4">
      <div className="flex items-start gap-3">
        <span
          className="grid h-11 w-11 shrink-0 place-items-center rounded-control text-[#0A0A0C]"
          style={{ backgroundColor: subject.color }}
          aria-hidden
        >
          <BookOpen className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="break-words font-semibold leading-snug">{subject.name}</h2>
          {(subject.code || subject.abbr) && (
            <p className="mt-0.5 text-xs text-muted">{[subject.code, subject.abbr ? `Singkatan: ${subject.abbr}` : null].filter(Boolean).join(" · ")}</p>
          )}
        </div>
        <div className="flex shrink-0 gap-0.5">
          <Button variant="ghost" size="icon" className="h-9 w-9" aria-label={`Edit ${subject.name}`} onClick={() => onEdit(subject)}>
            <Pencil className="h-4 w-4" aria-hidden />
          </Button>
          <Button variant="ghost" size="icon" className="h-9 w-9 hover:text-danger" aria-label={`Hapus ${subject.name}`} onClick={() => onDelete(subject)}>
            <Trash2 className="h-4 w-4" aria-hidden />
          </Button>
        </div>
      </div>

      {subject.lecturer && (
        <p className="mt-3 flex items-center gap-2 text-sm text-muted">
          <User className="h-4 w-4 shrink-0" aria-hidden />
          <span className="truncate">{subject.lecturer}</span>
        </p>
      )}

      {chips.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          {chips.map((chip) => (
            <span key={chip} className="rounded-full bg-fg/10 px-2.5 py-1 font-medium">{chip}</span>
          ))}
        </div>
      )}

      <p className="mt-auto pt-4 text-sm text-muted">
        {counts && counts.total > 0
          ? `${counts.active} tugas aktif${counts.done > 0 ? `, ${counts.done} selesai` : ""}`
          : "Belum ada tugas"}
      </p>

      {onAttendance && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-fg/10 pt-3 text-xs">
          <span className={cn("tabular-nums", warnAbs ? "font-semibold text-danger" : "text-muted")}>
            Hadir {att.attended} · Absen {att.absent}/{maxAbs}
            {warnAbs ? " (batas!)" : ` · sisa ${remaining}×`}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onAttendance(subject, "attended")}
              className="rounded-md bg-fg/[0.07] px-2 py-1 font-medium text-fg transition-colors hover:bg-fg/15"
            >
              + Hadir
            </button>
            <button
              type="button"
              onClick={() => onAttendance(subject, "absent")}
              className="rounded-md bg-danger/10 px-2 py-1 font-medium text-danger transition-colors hover:bg-danger/20"
            >
              + Absen
            </button>
            {(att.attended > 0 || att.absent > 0) && (
              <button
                type="button"
                onClick={() => onAttendance(subject, "reset")}
                aria-label={`Reset kehadiran ${subject.name}`}
                title="Reset kehadiran"
                className="rounded-md p-1 text-muted transition-colors hover:text-fg"
              >
                <RotateCcw className="h-3.5 w-3.5" aria-hidden />
              </button>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}
