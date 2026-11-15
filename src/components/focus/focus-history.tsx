import { History } from "lucide-react";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { formatMinutes, sessionWhen, sortSessions } from "@/lib/focus";
import { cn } from "@/lib/utils";
import type { FocusSession, Subject, Task } from "@/types";

const LIMIT = 20;

interface Props {
  sessions: readonly FocusSession[];
  subjectsById: ReadonlyMap<string, Subject>;
  tasksById: ReadonlyMap<string, Task>;
  now: Date;
}

/** Newest first. A subject or task that was deleted later just has no label: the session stays. */
export function FocusHistory({ sessions, subjectsById, tasksById, now }: Props) {
  const list = sortSessions(sessions);
  return (
    <Card animate={false}>
      <h2 className="font-semibold">Riwayat</h2>
      {list.length === 0 ? (
        <EmptyState icon={History} title="Belum ada sesi" description="Sesi fokus yang kamu selesaikan, atau hentikan setelah minimal 1 menit, akan tercatat di sini." className="py-8" />
      ) : (
        <>
          <p className="mb-3 mt-0.5 text-xs text-muted">
            {list.length > LIMIT ? `${LIMIT} sesi terbaru dari ${list.length}` : `${list.length} sesi`}
          </p>
          <ul className="divide-y divide-fg/10">
            {list.slice(0, LIMIT).map((s) => {
              const subject = s.subjectId ? subjectsById.get(s.subjectId) : undefined;
              const task = s.taskId ? tasksById.get(s.taskId) : undefined;
              return (
                <li key={s.id} className="flex items-start justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium tabular-nums">{formatMinutes(s.durationMinutes)}</p>
                    <p className="mt-0.5 text-xs text-muted">{sessionWhen(s, now) || "Waktu tidak diketahui"}</p>
                    {(task || subject) && (
                      <p className="mt-1 truncate text-xs text-muted">
                        {[task?.title, subject ? (subject.code ? `${subject.code} · ${subject.name}` : subject.name) : null].filter(Boolean).join(" · ")}
                      </p>
                    )}
                  </div>
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2.5 py-1 text-xs font-medium",
                      s.completed ? "bg-success/15 text-success" : "bg-fg/10 text-muted",
                    )}
                  >
                    {s.completed ? "Selesai" : "Dihentikan"}
                  </span>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </Card>
  );
}
