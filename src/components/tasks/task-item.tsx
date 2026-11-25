"use client";

import { Check, Clock, ExternalLink, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { isTaskDone, TASK_PRIORITY_LABELS, TASK_STATUS_KIND_LABELS } from "@/lib/domain";
import { safeUrl } from "@/lib/import/text";
import { deadlineInfo, taskStatusKind } from "@/lib/tasks";
import { cn } from "@/lib/utils";
import type { Subject, Task, TaskPriority } from "@/types";

export const PRIORITY_TONE: Record<TaskPriority, string> = {
  high: "bg-danger/15 text-danger",
  medium: "bg-accent/15 text-accent",
  low: "bg-fg/10 text-muted",
};

export const DEADLINE_TONE = { overdue: "text-danger", soon: "text-accent", normal: "text-muted" } as const;

interface TaskItemProps {
  task: Task;
  subject?: Subject;
  now: Date;
  onToggle: (task: Task) => void;
  onCycleStatus?: (task: Task) => void;
  onToggleSubtask?: (task: Task, subtaskId: string) => void;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
}

export function TaskItem({ task, subject, now, onToggle, onCycleStatus, onToggleSubtask, onEdit, onDelete }: TaskItemProps) {
  const done = isTaskDone(task);
  const kind = taskStatusKind(task);
  const deadline = deadlineInfo(task, now);
  const link = safeUrl(task.url);
  const subtasks = task.subtasks ?? [];
  const subDone = subtasks.filter((s) => s.done).length;

  return (
    <Card surface="item" className="p-4">
      <div className="flex items-start gap-3">
        <button
          type="button"
          role="checkbox"
          aria-checked={done}
          aria-label={`Selesai: ${task.title}`}
          onClick={() => onToggle(task)}
          className="-m-2 mt-0 shrink-0 rounded-full p-2"
        >
          <span
            className={cn(
              "grid h-6 w-6 place-items-center rounded-full border-2 transition-colors duration-fast",
              done ? "border-success bg-success text-accent-fg" : "border-fg/30 hover:border-accent",
            )}
          >
            {done && <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden />}
          </span>
        </button>

        <div className="min-w-0 flex-1">
          <p className={cn("break-words font-semibold leading-snug", done && "text-muted line-through")}>{task.title}</p>
          {task.description && <p className="mt-1 line-clamp-2 break-words text-sm text-muted">{task.description}</p>}

          <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs">
            <span className={cn("rounded-full px-2.5 py-1 font-medium", PRIORITY_TONE[task.priority] ?? PRIORITY_TONE.medium)}>
              {TASK_PRIORITY_LABELS[task.priority] ?? TASK_PRIORITY_LABELS.medium}
            </span>
            {onCycleStatus ? (
              <button
                type="button"
                onClick={() => onCycleStatus(task)}
                title="Klik untuk ganti status"
                className={cn(
                  "rounded-full px-2.5 py-1 font-medium transition-colors duration-fast",
                  kind === "done"
                    ? "bg-success/15 text-success hover:bg-success/25"
                    : kind === "in_progress"
                      ? "bg-accent/15 text-accent hover:bg-accent/25"
                      : "bg-fg/10 text-muted hover:bg-fg/15 hover:text-fg",
                )}
              >
                {TASK_STATUS_KIND_LABELS[kind]}
              </button>
            ) : kind === "in_progress" ? (
              <span className="rounded-full bg-fg/10 px-2.5 py-1 font-medium">{TASK_STATUS_KIND_LABELS.in_progress}</span>
            ) : null}
            {subject && (
              <span className="flex min-w-0 items-center gap-1.5 text-muted">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: subject.color }} aria-hidden />
                <span className="truncate">{subject.name}</span>
              </span>
            )}
            {deadline && (
              <span className={cn("flex items-center gap-1.5", DEADLINE_TONE[deadline.tone])}>
                <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden />
                {deadline.label}
              </span>
            )}
            {link && (
              <a href={link} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-accent hover:underline">
                <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden />
                Buka tautan
              </a>
            )}
          </div>

          {subtasks.length > 0 && (
            <div className="mt-3 space-y-1.5 border-t border-fg/10 pt-2.5">
              <div className="flex items-center justify-between text-[11px] text-muted">
                <span>Checklist</span>
                <span className="tabular-nums">{subDone}/{subtasks.length}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-fg/10">
                <div
                  className="h-full rounded-full bg-accent transition-[width] duration-base ease-smooth"
                  style={{ width: `${Math.round((subDone / subtasks.length) * 100)}%` }}
                />
              </div>
              <ul className="space-y-1 pt-0.5">
                {subtasks.map((st) => (
                  <li key={st.id}>
                    <button
                      type="button"
                      onClick={() => onToggleSubtask?.(task, st.id)}
                      className="flex w-full items-center gap-2 rounded-md py-0.5 text-left text-xs transition-colors hover:text-fg"
                    >
                      <span
                        className={cn(
                          "grid h-4 w-4 shrink-0 place-items-center rounded border transition-colors",
                          st.done ? "border-success bg-success text-accent-fg" : "border-fg/30",
                        )}
                      >
                        {st.done && <Check className="h-2.5 w-2.5" strokeWidth={3} aria-hidden />}
                      </span>
                      <span className={cn("min-w-0 flex-1 break-words", st.done ? "text-muted line-through" : "text-fg/90")}>{st.title}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="flex shrink-0 gap-0.5">
          <Button variant="ghost" size="icon" className="h-9 w-9" aria-label={`Edit ${task.title}`} onClick={() => onEdit(task)}>
            <Pencil className="h-4 w-4" aria-hidden />
          </Button>
          <Button variant="ghost" size="icon" className="h-9 w-9 hover:text-danger" aria-label={`Hapus ${task.title}`} onClick={() => onDelete(task)}>
            <Trash2 className="h-4 w-4" aria-hidden />
          </Button>
        </div>
      </div>
    </Card>
  );
}
