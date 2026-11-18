"use client";

import { useMemo } from "react";
import { AlertCircle, BookOpen, CheckCircle2, ClipboardCheck, Clock, ListChecks } from "lucide-react";
import { CompactStats, StatCard } from "@/components/ui/stat-card";
import { useNow } from "@/hooks/use-now";
import { useStorage } from "@/hooks/use-storage";
import { buildDashboard } from "@/lib/dashboard";
import { APP_NAME, APP_TAGLINE } from "@/lib/brand";
import { formatDateID } from "@/lib/date";
import { ActivitiesCard } from "./activities-card";
import { FocusTodayCard } from "./focus-today-card";
import { QuickActions } from "./quick-actions";
import { TaskProgressCard } from "./task-progress-card";
import { TodayScheduleCard } from "./today-schedule-card";
import { UpcomingEventsCard } from "./upcoming-events-card";
import { UpcomingTasksCard } from "./upcoming-tasks-card";

function Skeleton() {
  return (
    <div className="space-y-4" aria-hidden>
      <div className="glass-item h-[280px] animate-pulse rounded-card" />
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        {[0, 1, 2].map((i) => <div key={i} className="glass-item h-[112px] animate-pulse rounded-card sm:h-[148px]" />)}
      </div>
      <div className="glass-item h-[64px] animate-pulse rounded-card" />
    </div>
  );
}

export function DashboardView() {
  const tasksStore = useStorage("tasks");
  const subjectsStore = useStorage("subjects");
  const schedulesStore = useStorage("schedules");
  const eventsStore = useStorage("events");
  const focusStore = useStorage("focusSessions");
  const activitiesStore = useStorage("activities");
  const now = useNow();

  const tasks = tasksStore.data;
  const subjects = subjectsStore.data;
  const schedules = schedulesStore.data;
  const events = eventsStore.data;
  const focusSessions = focusStore.data;
  const activities = activitiesStore.data;
  const ready = [tasksStore, subjectsStore, schedulesStore, eventsStore, focusStore, activitiesStore].every((s) => s.isReady) && now !== null;

  const subjectsById = useMemo(() => new Map(subjects.map((s) => [s.id, s])), [subjects]);
  const model = useMemo(
    () => (ready && now ? buildDashboard({ tasks, subjects, schedules, events, focusSessions, activities }, now) : null),
    [ready, now, tasks, subjects, schedules, events, focusSessions, activities],
  );

  return (
    <>
      <header className="mb-6 md:mb-8">
        <p className="eyebrow text-accent">{APP_NAME} · {APP_TAGLINE}</p>
        <h1 className="text-silver mt-2 text-[1.9rem] font-bold leading-tight tracking-tight md:text-4xl">
          {model ? model.greeting : <><span className="sr-only">Dashboard</span><span className="inline-block h-9 w-52 animate-pulse rounded-lg bg-fg/10 align-middle" aria-hidden /></>}
        </h1>
        <p className="mt-1.5 min-h-[1.5rem] text-sm text-muted md:text-base">{model ? model.dateLine : ""}</p>
      </header>

      {!model || !now ? (
        <Skeleton />
      ) : (
        <div className="space-y-4">
          {/* 1. Hero: today's classes */}
          <TodayScheduleCard
            classes={model.today}
            subjectsById={subjectsById}
            hasSchedules={schedules.length > 0}
            dayLabel={formatDateID(now, { weekday: "long", day: "numeric", month: "long" })}
          />

          {/* 2. The three numbers that need attention, then the three that are just context */}
          <div className="grid grid-cols-3 gap-3 sm:gap-4">
            <StatCard dense label="Belum selesai" value={model.stats.openTasks} hint="Masih perlu dikerjakan" icon={Clock} delay={0.04} />
            <StatCard
              dense
              label="Terlambat"
              value={model.stats.overdueTasks}
              hint={model.stats.overdueTasks > 0 ? "Lewat deadline, belum selesai" : "Tidak ada yang terlambat"}
              icon={AlertCircle}
              tone={model.stats.overdueTasks > 0 ? "danger" : "default"}
              delay={0.08}
            />
            <StatCard dense label="Ujian & event" value={model.stats.upcomingEvents} hint="Hari ini dan mendatang" icon={ClipboardCheck} delay={0.12} />
          </div>
          <CompactStats
            delay={0.16}
            items={[
              { label: "Total tugas", value: model.stats.totalTasks, hint: "Semua tugas yang tercatat", icon: ListChecks },
              { label: "Sudah selesai", value: model.stats.doneTasks, hint: "Tugas yang beres", icon: CheckCircle2 },
              { label: "Mata kuliah", value: model.stats.subjects, hint: "Yang terdaftar", icon: BookOpen },
            ]}
          />
        </div>
      )}

      {/* 3. Shortcuts stay available, but quietly */}
      <QuickActions />

      {model && now && (
        <div className="mt-8 grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          <div className="space-y-4">
            <ActivitiesCard activities={model.activities} hasActivities={model.hasActivities} />
            <UpcomingTasksCard tasks={model.tasks} subjectsById={subjectsById} allTasks={tasks.length} now={now} />
          </div>
          <div className="space-y-4">
            <TaskProgressCard progress={model.progress} />
            <FocusTodayCard focus={model.focus} />
            <UpcomingEventsCard events={model.events} subjectsById={subjectsById} now={now} />
          </div>
        </div>
      )}
    </>
  );
}
