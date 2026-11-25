"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CalendarDays, CheckCircle2, ChevronRight, Clock, MapPin } from "lucide-react";
import { CATEGORY_TONE, DATE_TONE } from "@/components/events/event-item";
import { DEADLINE_TONE, PRIORITY_TONE } from "@/components/tasks/task-item";
import { SegmentedControl } from "@/components/ui/field";
import { ResponsiveSheet } from "@/components/ui/responsive-sheet";
import { isOverdue } from "@/lib/dashboard";
import { EVENT_CATEGORY_LABELS, isTaskDone, TASK_PRIORITY_LABELS } from "@/lib/domain";
import { eventDateInfo, eventTimeLabel, filterEvents, sortEvents } from "@/lib/events";
import { deadlineInfo, sortTasks } from "@/lib/tasks";
import { cn } from "@/lib/utils";
import type { CampusEvent, Subject, Task } from "@/types";

export type StatsPopupKind = "open" | "overdue" | "events" | null;
type TaskTab = "open" | "overdue";

const TASK_TABS: readonly { value: TaskTab; label: string }[] = [
  { value: "open", label: "Belum selesai" },
  { value: "overdue", label: "Terlambat" },
];

interface StatsPopupProps {
  kind: StatsPopupKind;
  onClose: () => void;
  tasks: readonly Task[];
  events: readonly CampusEvent[];
  subjects: readonly Subject[];
  subjectsById: ReadonlyMap<string, Subject>;
  now: Date;
}

export function StatsPopup({ kind, onClose, tasks, events, subjects, subjectsById, now }: StatsPopupProps) {
  const [tab, setTab] = useState<TaskTab>("open");

  useEffect(() => {
    if (kind === "open" || kind === "overdue") setTab(kind);
  }, [kind]);

  const openTasks = useMemo(() => sortTasks(tasks.filter((t) => !isTaskDone(t)), "deadline"), [tasks]);
  const overdueTasks = useMemo(() => openTasks.filter((t) => isOverdue(t, now)), [openTasks, now]);
  const upcomingEventList = useMemo(() => {
    const upcoming = filterEvents(events, subjectsById, { query: "", category: "all", time: "upcoming" }, now);
    return sortEvents(upcoming, now);
  }, [events, subjectsById, now, subjects]);

  const isEvents = kind === "events";
  const shownTasks = tab === "overdue" ? overdueTasks : openTasks;
  const title = isEvents ? "Ujian & event mendatang" : tab === "overdue" ? "Tugas terlambat" : "Tugas belum selesai";
  const description = isEvents
    ? "Klik item untuk melihat detail di halaman Exams & Events."
    : "Klik tugas untuk mengelolanya di halaman Tasks.";

  return (
    <ResponsiveSheet open={kind !== null} onOpenChange={(o) => { if (!o) onClose(); }} title={title} description={description}>
      {!isEvents && (
        <div className="mb-4">
          <SegmentedControl<TaskTab> label="Filter daftar tugas" value={tab} onChange={setTab} options={TASK_TABS} />
        </div>
      )}

      <div className="max-h-[55dvh] overflow-y-auto pr-0.5">
        {isEvents ? (
          upcomingEventList.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted">Tidak ada ujian atau event mendatang.</p>
          ) : (
            <ul className="space-y-2">
              {upcomingEventList.map((ev) => {
                const subject = ev.subjectId ? subjectsById.get(ev.subjectId) : undefined;
                const date = eventDateInfo(ev, now);
                return (
                  <li key={ev.id}>
                    <Link
                      href="/exams"
                      onClick={onClose}
                      className="glass-item flex items-center gap-3 rounded-control p-3 transition-colors duration-fast hover:bg-fg/10"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", CATEGORY_TONE[ev.category] ?? CATEGORY_TONE.lainnya)}>
                            {EVENT_CATEGORY_LABELS[ev.category] ?? EVENT_CATEGORY_LABELS.lainnya}
                          </span>
                          {subject && <span className="truncate text-xs text-muted">{subject.name}</span>}
                        </div>
                        <p className="mt-1 truncate text-sm font-semibold">{ev.title}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted">
                          <span className={cn("flex items-center gap-1", DATE_TONE[date.tone])}>
                            <CalendarDays className="h-3 w-3 shrink-0" aria-hidden />
                            {date.label}
                          </span>
                          {ev.startTime && <span>{eventTimeLabel(ev)}</span>}
                          {ev.location && (
                            <span className="flex items-center gap-1 truncate">
                              <MapPin className="h-3 w-3 shrink-0" aria-hidden />
                              {ev.location}
                            </span>
                          )}
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted" aria-hidden />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )
        ) : shownTasks.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center text-sm text-muted">
            <CheckCircle2 className="h-7 w-7 text-success" aria-hidden />
            <p>{tab === "overdue" ? "Tidak ada tugas yang terlambat." : "Semua tugas sudah selesai!"}</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {shownTasks.map((task) => {
              const subject = task.subjectId ? subjectsById.get(task.subjectId) : undefined;
              const deadline = deadlineInfo(task, now);
              const overdue = deadline?.tone === "overdue";
              return (
                <li key={task.id}>
                  <Link
                    href="/tasks"
                    onClick={onClose}
                    className={cn(
                      "glass-item flex items-center gap-3 rounded-control p-3 transition-colors duration-fast hover:bg-fg/10",
                      overdue && "border-danger/40",
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {overdue && <span className="rounded-full bg-danger/15 px-2 py-0.5 text-[11px] font-semibold text-danger">Terlambat</span>}
                        <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", PRIORITY_TONE[task.priority] ?? PRIORITY_TONE.medium)}>
                          {TASK_PRIORITY_LABELS[task.priority] ?? TASK_PRIORITY_LABELS.medium}
                        </span>
                      </div>
                      <p className="mt-1 truncate text-sm font-semibold">{task.title}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs">
                        {subject && (
                          <span className="flex min-w-0 items-center gap-1.5 text-muted">
                            <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: subject.color }} aria-hidden />
                            <span className="truncate">{subject.name}</span>
                          </span>
                        )}
                        <span className={cn("flex items-center gap-1", deadline ? DEADLINE_TONE[deadline.tone] : "text-muted")}>
                          <Clock className="h-3 w-3 shrink-0" aria-hidden />
                          {deadline ? deadline.label : "Tanpa deadline"}
                        </span>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted" aria-hidden />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </ResponsiveSheet>
  );
}
