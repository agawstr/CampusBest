"use client";

import { useMemo, useState } from "react";
import { BarChart3, CheckCircle2, Hourglass, ListChecks, Timer } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { SegmentedControl } from "@/components/ui/field";
import { StatCard } from "@/components/ui/stat-card";
import { useNow } from "@/hooks/use-now";
import { useStorage } from "@/hooks/use-storage";
import { formatMinutes } from "@/lib/focus";
import { buildStatistics, STATS_PERIOD_OPTIONS, type FocusStats, type StatsPeriod, type StatisticsModel } from "@/lib/statistics";

const PERIOD_PHRASE: Record<StatsPeriod, string> = { "7d": "7 hari terakhir", "30d": "30 hari terakhir", all: "semua waktu" };

function Bar({ percent, color, label }: { percent: number; color?: string; label: string }) {
  return (
    <div role="img" aria-label={label} className="h-2 overflow-hidden rounded-full bg-fg/10">
      <div className="h-full rounded-full bg-accent transition-[width] duration-slow ease-smooth" style={{ width: `${Math.max(0, Math.min(100, percent))}%`, backgroundColor: color }} />
    </div>
  );
}

function TaskCard({ model }: { model: StatisticsModel }) {
  const t = model.tasks;
  const share = (n: number) => (t.total === 0 ? 0 : (n / t.total) * 100);
  const parts = [
    { label: "Selesai", n: t.done, cls: "bg-success" },
    { label: "Dikerjakan", n: t.inProgress, cls: "bg-accent" },
    { label: "Belum mulai", n: t.todo, cls: "bg-fg/25" },
  ];
  return (
    <Card animate={false}>
      <h2 className="text-base font-semibold">Tugas</h2>
      {t.total === 0 ? (
        <p className="mt-3 text-sm text-muted">Tidak ada tugas pada periode ini.</p>
      ) : (
        <>
          <div role="img" aria-label={`${t.done} selesai, ${t.inProgress} dikerjakan, ${t.todo} belum mulai`} className="mt-4 flex h-3 overflow-hidden rounded-full bg-fg/10">
            {parts.map((p) => p.n > 0 && <div key={p.label} className={p.cls} style={{ width: `${share(p.n)}%` }} />)}
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            {parts.map((p) => (
              <div key={p.label}>
                <dt className="flex items-center gap-1.5 text-muted"><span className={`h-2 w-2 rounded-full ${p.cls}`} aria-hidden />{p.label}</dt>
                <dd className="text-lg font-semibold tabular-nums">{p.n}</dd>
              </div>
            ))}
            <div>
              <dt className="text-muted">Terlambat</dt>
              <dd className="text-lg font-semibold tabular-nums">{t.overdue}</dd>
            </div>
          </dl>
        </>
      )}
    </Card>
  );
}

function FocusChart({ focus }: { focus: FocusStats }) {
  const max = Math.max(0, ...focus.series.map((b) => b.minutes));
  const dense = focus.series.length > 12;
  return (
    <Card animate={false}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-semibold">Waktu fokus</h2>
        <p className="text-xs text-muted">{focus.seriesUnit === "week" ? "Per minggu, 12 minggu terakhir" : "Per hari"}</p>
      </div>
      {focus.sessions === 0 ? (
        <p className="mt-3 text-sm text-muted">Belum ada sesi fokus pada periode ini.</p>
      ) : (
        <>
          <ul className="mt-4 flex h-40 items-end gap-1" aria-label="Menit fokus per bagian waktu">
            {focus.series.map((b, i) => (
              <li key={b.key} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1" title={`${b.label}: ${formatMinutes(b.minutes)}, ${b.sessions} sesi`}>
                <div
                  className={b.minutes > 0 ? "w-full rounded-t-md bg-accent" : "w-full rounded-t-md bg-fg/10"}
                  style={{ height: b.minutes > 0 && max > 0 ? `${Math.max(4, (b.minutes / max) * 100)}%` : "2px" }}
                />
                <span className={`h-4 truncate text-[10px] text-muted ${dense && i % 5 !== 0 ? "invisible" : ""}`}>{b.label}</span>
                <span className="sr-only">{`${b.label}: ${formatMinutes(b.minutes)}, ${b.sessions} sesi`}</span>
              </li>
            ))}
          </ul>
          <dl className="mt-4 grid grid-cols-3 gap-3 text-sm">
            <div><dt className="text-muted">Rata-rata sesi</dt><dd className="font-semibold tabular-nums">{formatMinutes(focus.averageMinutes)}</dd></div>
            <div><dt className="text-muted">Sesi selesai</dt><dd className="font-semibold tabular-nums">{focus.completed}</dd></div>
            <div><dt className="text-muted">Hari aktif</dt><dd className="font-semibold tabular-nums">{focus.activeDays}</dd></div>
          </dl>
        </>
      )}
    </Card>
  );
}

function SubjectCard({ model }: { model: StatisticsModel }) {
  return (
    <Card animate={false}>
      <h2 className="text-base font-semibold">Per mata kuliah</h2>
      {model.bySubject.length === 0 ? (
        <p className="mt-3 text-sm text-muted">Belum ada tugas atau sesi fokus pada periode ini.</p>
      ) : (
        <ul className="mt-4 space-y-4">
          {model.bySubject.map((s) => (
            <li key={s.subjectId ?? "none"}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="flex min-w-0 items-center gap-2 font-medium">
                  {s.color && <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: s.color }} aria-hidden />}
                  <span className="truncate">{s.name}</span>
                </span>
                <span className="shrink-0 tabular-nums text-muted">{s.tasks > 0 ? `${s.doneTasks}/${s.tasks} tugas` : "Tanpa tugas"}</span>
              </div>
              {s.tasks > 0 && <div className="mt-1.5"><Bar percent={s.percent} color={s.color} label={`${s.percent}% tugas selesai`} /></div>}
              {s.focusMinutes > 0 && <p className="mt-1 text-xs text-muted">Fokus {formatMinutes(s.focusMinutes)}</p>}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function EventCard({ model }: { model: StatisticsModel }) {
  const e = model.events;
  const max = Math.max(1, ...e.byCategory.map((c) => c.count));
  return (
    <Card animate={false}>
      <h2 className="text-base font-semibold">Ujian & event</h2>
      <dl className="mt-3 grid grid-cols-3 gap-3 text-sm">
        <div><dt className="text-muted">Pada periode ini</dt><dd className="text-lg font-semibold tabular-nums">{e.total}</dd></div>
        <div><dt className="text-muted">Mendatang</dt><dd className="text-lg font-semibold tabular-nums">{e.upcoming}</dd></div>
        <div><dt className="text-muted">Ujian mendatang</dt><dd className="text-lg font-semibold tabular-nums">{e.upcomingExams}</dd></div>
      </dl>
      <p className="mt-1 text-xs text-muted">&ldquo;Mendatang&rdquo; dihitung dari hari ini, tidak ikut periode.</p>
      {e.byCategory.length === 0 ? (
        <p className="mt-3 text-sm text-muted">Tidak ada ujian atau event pada periode ini.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {e.byCategory.map((c) => (
            <li key={c.category}>
              <div className="flex justify-between text-sm"><span>{c.label}</span><span className="tabular-nums text-muted">{c.count}</span></div>
              <div className="mt-1"><Bar percent={(c.count / max) * 100} label={`${c.count} ${c.label}`} /></div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export function StatisticsView() {
  const tasks = useStorage("tasks");
  const subjects = useStorage("subjects");
  const events = useStorage("events");
  const sessions = useStorage("focusSessions");
  const settings = useStorage("settings");
  const now = useNow();
  const [period, setPeriod] = useState<StatsPeriod>("7d");

  const ready = [tasks, subjects, events, sessions, settings].every((s) => s.isReady) && now !== null;
  const model = useMemo(
    () => (ready && now
      ? buildStatistics(
        { tasks: tasks.data, subjects: subjects.data, events: events.data, focusSessions: sessions.data },
        period, now, settings.data.weekStartsOn === 0 ? 0 : 1)
      : null),
    [ready, now, tasks.data, subjects.data, events.data, sessions.data, settings.data.weekStartsOn, period],
  );

  return (
    <>
      <PageHeader title="Statistics" description="Ringkasan tugas, ujian, dan waktu fokusmu dari data yang sudah kamu catat." />
      {!model ? (
        <div className="space-y-4" aria-hidden>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[0, 1, 2, 3].map((i) => <div key={i} className="glass-item h-[104px] animate-pulse rounded-card" />)}
          </div>
          <div className="glass-item h-[220px] animate-pulse rounded-card" />
        </div>
      ) : !model.hasData ? (
        <Card>
          <EmptyState icon={BarChart3} title="Belum ada statistik" description="Statistik muncul setelah kamu mencatat tugas, ujian, atau sesi fokus." />
        </Card>
      ) : (
        <div className="space-y-4">
          <div className="max-w-xl">
            <SegmentedControl label="Periode" value={period} onChange={setPeriod} options={STATS_PERIOD_OPTIONS} />
          </div>
          <p className="text-sm text-muted">Menampilkan {PERIOD_PHRASE[period]}.</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Total tugas" value={model.tasks.total} hint={`${model.tasks.done} selesai, ${model.tasks.open} belum`} icon={ListChecks} delay={0} />
            <StatCard label="Tugas selesai" value={`${model.tasks.percent}%`} hint="Dari tugas pada periode ini" icon={CheckCircle2} delay={0.04} />
            <StatCard label="Waktu fokus" value={formatMinutes(model.focus.minutes)} hint="Waktu fokus yang tercatat" icon={Hourglass} delay={0.08} />
            <StatCard label="Sesi fokus" value={model.focus.sessions} hint={`${model.focus.completed} selesai penuh`} icon={Timer} delay={0.12} />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-4">
              <TaskCard model={model} />
              <SubjectCard model={model} />
            </div>
            <div className="space-y-4">
              <FocusChart focus={model.focus} />
              <EventCard model={model} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
