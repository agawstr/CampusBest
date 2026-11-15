import Link from "next/link";
import { CheckCircle2, Clock } from "lucide-react";
import { DEADLINE_TONE, PRIORITY_TONE } from "@/components/tasks/task-item";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { TASK_PRIORITY_LABELS, TASK_STATUS_KIND_LABELS } from "@/lib/domain";
import type { Limited } from "@/lib/dashboard";
import { deadlineInfo, taskStatusKind } from "@/lib/tasks";
import { cn } from "@/lib/utils";
import type { Subject, Task } from "@/types";
import { SectionHeader } from "./section-header";

interface UpcomingTasksCardProps {
  tasks: Limited<Task>;
  subjectsById: ReadonlyMap<string, Subject>;
  /** Number of tasks that exist at all, to word the empty state. */
  allTasks: number;
  now: Date;
}

export function UpcomingTasksCard({ tasks, subjectsById, allTasks, now }: UpcomingTasksCardProps) {
  const more = tasks.total - tasks.items.length;
  return (
    <Card animate={false}>
      <SectionHeader title="Tugas terdekat" subtitle="Yang belum selesai, deadline paling dekat dulu" href="/tasks" linkLabel="Semua tugas" />
      {tasks.items.length === 0 ? (
        <EmptyState
          icon={allTasks === 0 ? Clock : CheckCircle2}
          className="px-2 py-8"
          title={allTasks === 0 ? "Belum ada tugas" : "Semua tugas sudah selesai"}
          description={allTasks === 0 ? "Catat tugasmu di halaman Tasks biar deadline-nya kepantau." : "Mantap, nggak ada tugas yang menunggu. Santai dulu."}
        />
      ) : (
        <>
          <ul className="space-y-2.5">
            {tasks.items.map((task) => {
              const subject = task.subjectId ? subjectsById.get(task.subjectId) : undefined;
              const deadline = deadlineInfo(task, now);
              const overdue = deadline?.tone === "overdue";
              return (
                <li key={task.id} className={cn("glass rounded-control p-3.5", overdue && "border border-danger/40")}>
                  <div className="flex flex-wrap items-center gap-2">
                    {overdue && <span className="rounded-full bg-danger/15 px-2 py-0.5 text-xs font-semibold text-danger">Terlambat</span>}
                    <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", PRIORITY_TONE[task.priority] ?? PRIORITY_TONE.medium)}>
                      {TASK_PRIORITY_LABELS[task.priority] ?? TASK_PRIORITY_LABELS.medium}
                    </span>
                    <span className="rounded-full bg-fg/10 px-2 py-0.5 text-xs text-muted">{TASK_STATUS_KIND_LABELS[taskStatusKind(task)]}</span>
                  </div>
                  <p className="mt-1.5 break-words font-semibold leading-snug">{task.title}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                    {subject && (
                      <span className="flex min-w-0 items-center gap-1.5 text-muted">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: subject.color }} aria-hidden />
                        <span className="truncate">{subject.name}</span>
                      </span>
                    )}
                    <span className={cn("flex items-center gap-1.5", deadline ? DEADLINE_TONE[deadline.tone] : "text-muted")}>
                      <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden />
                      {deadline ? deadline.label : "Tanpa deadline"}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
          {more > 0 && (
            <p className="mt-3 text-center text-sm text-muted">
              <Link href="/tasks" className="font-medium text-accent hover:underline">+{more} tugas lainnya</Link>
            </p>
          )}
        </>
      )}
    </Card>
  );
}
