"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertCircle, ArrowRight, BookOpen, CheckCircle2, ClipboardCheck, ClipboardPaste, Clock, ListChecks, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import { CompactStats, StatCard } from "@/components/ui/stat-card";
import { useNow } from "@/hooks/use-now";
import { useStorage } from "@/hooks/use-storage";
import { buildDashboard } from "@/lib/dashboard";
import { APP_NAME, APP_TAGLINE } from "@/lib/brand";
import { formatDateID, parseDateKey, toDateKey } from "@/lib/date";
import { EVENT_CATEGORY_LABELS } from "@/lib/domain";
import { ActivitiesCard } from "./activities-card";
import { FocusTodayCard } from "./focus-today-card";
import { QuickActions } from "./quick-actions";
import { StatsPopup, type StatsPopupKind } from "./stats-popup";
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
  const [popup, setPopup] = useState<StatsPopupKind>(null);

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

  const soonExam = useMemo(() => {
    if (!model || !now) return null;
    const todayDate = parseDateKey(toDateKey(now));
    if (!todayDate) return null;
    const dayDiff = (key: string) => {
      const target = parseDateKey(key);
      return target ? Math.round((target.getTime() - todayDate.getTime()) / 86_400_000) : null;
    };
    const exam = model.events.items.find((e) => {
      if (e.category !== "uts" && e.category !== "uas" && e.category !== "quiz") return false;
      const diff = dayDiff(e.date);
      return diff !== null && diff >= 0 && diff <= 7;
    });
    if (!exam) return null;
    return { exam, diff: dayDiff(exam.date) ?? 0 };
  }, [model, now]);

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
          {soonExam && (
            <Link
              href="/exams"
              className="glass glass-raised flex items-center justify-between gap-3 rounded-card border border-danger/35 px-4 py-3 text-sm transition-colors duration-fast hover:border-danger/60"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="shrink-0 rounded-full bg-danger/15 px-2.5 py-1 text-xs font-bold tabular-nums text-danger">
                  {soonExam.diff === 0 ? "Hari ini" : `H-${soonExam.diff}`}
                </span>
                <p className="min-w-0 truncate font-medium">
                  {EVENT_CATEGORY_LABELS[soonExam.exam.category]} · {soonExam.exam.title}
                </p>
              </div>
              <ArrowRight className="h-4 w-4 shrink-0 text-muted" aria-hidden />
            </Link>
          )}

          {tasks.length === 0 && schedules.length === 0 && subjects.length === 0 && (
            <Card raised className="p-5">
              <div className="flex items-start gap-3">
                <span className="icon-chip grid h-10 w-10 shrink-0 place-items-center rounded-control text-accent" aria-hidden>
                  <Sparkles className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="text-base font-semibold tracking-tight">Baru mulai pakai {APP_NAME}?</h2>
                  <p className="mt-0.5 text-sm text-muted">Isi jadwal dan tugasmu dalam semenit lewat fitur impor cepat, tanpa ketik satu-satu.</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Link
                      href="/import"
                      className="btn-metal inline-flex h-9 items-center gap-2 rounded-control px-3.5 text-sm font-semibold text-accent-fg shadow-glow transition-[transform,filter] duration-fast ease-smooth hover:brightness-110 active:scale-[0.97]"
                    >
                      <ClipboardPaste className="h-4 w-4" aria-hidden />
                      Impor SIAM / Classroom / BRONE
                      <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                    </Link>
                    <Link
                      href="/subjects"
                      className="glass-item inline-flex h-9 items-center gap-2 rounded-control px-3.5 text-sm font-semibold text-fg transition-[background-color,transform] duration-fast ease-smooth hover:bg-fg/10 active:scale-[0.97]"
                    >
                      <BookOpen className="h-4 w-4" aria-hidden />
                      Tambah mata kuliah manual
                    </Link>
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* 1. Hero: today's classes */}
          <TodayScheduleCard
            classes={model.today}
            subjectsById={subjectsById}
            hasSchedules={schedules.length > 0}
            dayLabel={formatDateID(now, { weekday: "long", day: "numeric", month: "long" })}
          />

          {/* 2. Interactive headline stats + compact context */}
          <div className="grid grid-cols-3 gap-3 sm:gap-4">
            <StatCard
              dense
              label="Belum selesai"
              value={model.stats.openTasks}
              hint="Masih perlu dikerjakan"
              icon={Clock}
              delay={0.04}
              onClick={() => setPopup("open")}
            />
            <StatCard
              dense
              label="Terlambat"
              value={model.stats.overdueTasks}
              hint={model.stats.overdueTasks > 0 ? "Lewat deadline, belum selesai" : "Tidak ada yang terlambat"}
              icon={AlertCircle}
              tone={model.stats.overdueTasks > 0 ? "danger" : "default"}
              delay={0.08}
              onClick={() => setPopup("overdue")}
            />
            <StatCard
              dense
              label="Ujian & event"
              value={model.stats.upcomingEvents}
              hint="Hari ini dan mendatang"
              icon={ClipboardCheck}
              delay={0.12}
              onClick={() => setPopup("events")}
            />
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

      {model && now && (
        <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          <div className="space-y-4">
            <UpcomingTasksCard tasks={model.tasks} subjectsById={subjectsById} allTasks={tasks.length} now={now} />
            <ActivitiesCard activities={model.activities} hasActivities={model.hasActivities} />
          </div>
          <div className="space-y-4">
            <TaskProgressCard progress={model.progress} />
            <FocusTodayCard focus={model.focus} />
            <UpcomingEventsCard events={model.events} subjectsById={subjectsById} now={now} />
          </div>
        </div>
      )}

      {/* Shortcuts sit quietly at the bottom */}
      <QuickActions />

      {now && (
        <StatsPopup
          kind={popup}
          onClose={() => setPopup(null)}
          tasks={tasks}
          events={events}
          subjects={subjects}
          subjectsById={subjectsById}
          now={now}
        />
      )}
    </>
  );
}
