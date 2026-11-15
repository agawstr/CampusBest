"use client";

import { useMemo } from "react";
import { AlertCircle, BookOpen, CheckCircle2, ClipboardCheck, Clock, ListChecks } from "lucide-react";
import { StatCard } from "@/components/ui/stat-card";
import { useNow } from "@/hooks/use-now";
import { useStorage } from "@/hooks/use-storage";
import { buildDashboard } from "@/lib/dashboard";
import { APP_NAME, APP_TAGLINE } from "@/lib/brand";
import { formatDateID } from "@/lib/date";
import { QuickActions } from "./quick-actions";
import { TaskProgressCard } from "./task-progress-card";
import { TodayScheduleCard } from "./today-schedule-card";
import { UpcomingEventsCard } from "./upcoming-events-card";
import { UpcomingTasksCard } from "./upcoming-tasks-card";

function Skeleton() {
  return (
    <div className="space-y-4" aria-hidden>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="glass h-[104px] animate-pulse rounded-card" />)}
      </div>
      <div className="glass h-[220px] animate-pulse rounded-card" />
    </div>
  );
}

export function DashboardView() {
  const tasksStore = useStorage("tasks");
  const subjectsStore = useStorage("subjects");
  const schedulesStore = useStorage("schedules");
  const eventsStore = useStorage("events");
  const now = useNow();

  const tasks = tasksStore.data;
  const subjects = subjectsStore.data;
  const schedules = schedulesStore.data;
  const events = eventsStore.data;
  const ready = [tasksStore, subjectsStore, schedulesStore, eventsStore].every((s) => s.isReady) && now !== null;

  const subjectsById = useMemo(() => new Map(subjects.map((s) => [s.id, s])), [subjects]);
  const model = useMemo(
    () => (ready && now ? buildDashboard({ tasks, subjects, schedules, events }, now) : null),
    [ready, now, tasks, subjects, schedules, events],
  );

  return (
    <>
      <header className="mb-6 md:mb-8">
        <p className="text-xs font-semibold uppercase tracking-wider text-accent">{APP_NAME} · {APP_TAGLINE}</p>
        <h1 className="mt-1.5 text-[1.75rem] font-bold leading-tight tracking-tight md:text-3xl">
          {model ? model.greeting : <><span className="sr-only">Dashboard</span><span className="inline-block h-8 w-48 animate-pulse rounded-lg bg-fg/10 align-middle" aria-hidden /></>}
        </h1>
        <p className="mt-1.5 min-h-[1.5rem] text-sm text-muted md:text-base">{model ? model.dateLine : ""}</p>
      </header>

      <QuickActions />

      <div className="mt-6">
        {!model || !now ? (
          <Skeleton />
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <StatCard label="Total tugas" value={model.stats.totalTasks} hint="Semua tugas yang tercatat" icon={ListChecks} delay={0} />
              <StatCard label="Belum selesai" value={model.stats.openTasks} hint="Masih perlu dikerjakan" icon={Clock} delay={0.04} />
              <StatCard label="Sudah selesai" value={model.stats.doneTasks} hint="Tugas yang beres" icon={CheckCircle2} delay={0.08} />
              <StatCard label="Terlambat" value={model.stats.overdueTasks} hint={model.stats.overdueTasks > 0 ? "Lewat deadline, belum selesai" : "Tidak ada yang terlambat"} icon={AlertCircle} delay={0.12} />
              <StatCard label="Mata kuliah" value={model.stats.subjects} hint="Yang terdaftar" icon={BookOpen} delay={0.16} />
              <StatCard label="Ujian & event" value={model.stats.upcomingEvents} hint="Hari ini dan mendatang" icon={ClipboardCheck} delay={0.2} />
            </div>

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
              <div className="space-y-4">
                <TodayScheduleCard
                  classes={model.today}
                  subjectsById={subjectsById}
                  hasSchedules={schedules.length > 0}
                  dayLabel={formatDateID(now, { weekday: "long", day: "numeric", month: "long" })}
                />
                <UpcomingTasksCard tasks={model.tasks} subjectsById={subjectsById} allTasks={tasks.length} now={now} />
              </div>
              <div className="space-y-4">
                <TaskProgressCard progress={model.progress} />
                <UpcomingEventsCard events={model.events} subjectsById={subjectsById} now={now} />
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
