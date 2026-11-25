"use client";

import { useMemo, useState } from "react";
import { Flame, Pause, Play, RotateCcw, SkipForward } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { Field, Select } from "@/components/ui/field";
import { useFocusClock } from "@/hooks/use-focus-clock";
import { useStorage } from "@/hooks/use-storage";
import {
  FOCUS_MODES, FOCUS_MODE_LABELS, LONG_BREAK_EVERY, MIN_RECORD_MINUTES, elapsedMs, focusToday, formatClock, formatMinutes,
  progressOf, remainingMs, sanitizeLink, selectableTasks, type FocusLink,
} from "@/lib/focus";
import { computeFocusStreak, focusThisWeekMinutes, WEEKLY_TARGET_PRESETS } from "@/lib/focus-stats";
import { sortTasks } from "@/lib/tasks";
import { cn } from "@/lib/utils";
import { useFocusTimer } from "@/providers/focus-timer-provider";
import type { FocusSettings, FocusTimerState } from "@/types";
import { FocusHistory } from "./focus-history";
import { FocusSettingsCard } from "./focus-settings-card";
import { TimerRing } from "./timer-ring";

/** Isolated ticking ring so the rest of FocusView (history, settings, selects) doesn't re-render twice a second. */
function LiveTimerRing({
  timer,
  settings,
  ticking,
  caption,
  tone,
  active,
  modeLabel,
}: {
  timer: FocusTimerState;
  settings: FocusSettings;
  ticking: boolean;
  caption: string;
  tone: "accent" | "success";
  active: boolean;
  modeLabel: string;
}) {
  const nowMs = useFocusClock(ticking);
  const remaining = remainingMs(timer, settings, nowMs);
  const progress = progressOf(timer, settings, nowMs);
  return (
    <TimerRing
      progress={progress}
      clock={formatClock(remaining)}
      caption={caption}
      tone={tone}
      active={active}
      label={`${modeLabel}, ${Math.round(progress * 100)} persen`}
    />
  );
}

function Skeleton() {
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]" aria-hidden>
      <div className="glass-item h-[560px] animate-pulse rounded-card" />
      <div className="space-y-4">
        <div className="glass-item h-[120px] animate-pulse rounded-card" />
        <div className="glass-item h-[240px] animate-pulse rounded-card" />
      </div>
    </div>
  );
}

type Pending = "reset" | "skip" | null;

export function FocusView() {
  const { ready, timer, settings, start, pause, resume, reset, skip, setLink, saveSettings } = useFocusTimer();
  const subjectsStore = useStorage("subjects");
  const tasksStore = useStorage("tasks");
  const sessionsStore = useStorage("focusSessions");
  const appSettingsStore = useStorage("settings");
  const [pending, setPending] = useState<Pending>(null);
  const [pendingMinutes, setPendingMinutes] = useState(0);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const running = timer.status === "running";
  const active = timer.status !== "idle";

  const subjects = subjectsStore.data;
  const tasks = tasksStore.data;
  const sessions = sessionsStore.data;
  const dataReady = ready && subjectsStore.isReady && tasksStore.isReady && sessionsStore.isReady;

  const subjectsById = useMemo(() => new Map(subjects.map((s) => [s.id, s])), [subjects]);
  const tasksById = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);
  const choices = useMemo(() => selectableTasks(tasks, (list) => sortTasks(list, "deadline")), [tasks]);
  const link = useMemo(
    () => sanitizeLink({ subjectId: timer.subjectId, taskId: timer.taskId }, new Set(subjectsById.keys()), tasks),
    [timer.subjectId, timer.taskId, subjectsById, tasks],
  );
  const taskOptions = link.subjectId ? choices.filter((t) => t.subjectId === link.subjectId) : choices;

  const isFocus = timer.mode === "focus";
  const nowDate = new Date();
  const today = focusToday(sessions, nowDate);
  const streak = useMemo(() => computeFocusStreak(sessions, nowDate), [sessions]); // eslint-disable-line react-hooks/exhaustive-deps
  const weekStartsOn = appSettingsStore.data.weekStartsOn === 0 ? 0 : 1;
  const weekMinutes = useMemo(() => focusThisWeekMinutes(sessions, nowDate, weekStartsOn), [sessions, weekStartsOn]); // eslint-disable-line react-hooks/exhaustive-deps
  const targetMinutes = appSettingsStore.data.focusWeeklyTargetMinutes ?? 300;
  const targetPct = Math.min(100, Math.round((weekMinutes / Math.max(1, targetMinutes)) * 100));

  function changeSubject(value: string) {
    const subjectId = value || undefined;
    const task = link.taskId ? tasksById.get(link.taskId) : undefined;
    const keepTask = task !== undefined && (!subjectId || task.subjectId === subjectId);
    void setLink({ subjectId, taskId: keepTask ? task?.id : undefined });
  }
  function changeTask(value: string) {
    const task = value ? tasksById.get(value) : undefined;
    const taskSubject = task?.subjectId && subjectsById.has(task.subjectId) ? task.subjectId : undefined;
    void setLink({ subjectId: link.subjectId ?? taskSubject, taskId: task?.id });
  }

  function ask(kind: Exclude<Pending, null>) {
    const spent = Math.floor(elapsedMs(timer, settings, Date.now()) / 60_000);
    if (isFocus && active && spent >= MIN_RECORD_MINUTES) {
      setPending(kind);
      setPendingMinutes(spent);
      setConfirmOpen(true);
      return;
    }
    void (kind === "reset" ? reset() : skip());
  }

  const caption = !active ? "Siap mulai" : running ? "Sedang berjalan" : "Dijeda";
  const modeLabel = FOCUS_MODE_LABELS[timer.mode];
  const dots = timer.mode === "long_break" ? LONG_BREAK_EVERY : timer.cycle;
  const startLink: FocusLink = link;

  return (
    <>
      <PageHeader
        title="Focus"
        description="Timer Pomodoro untuk sesi belajar. Timernya tetap jalan walau kamu pindah halaman."
      />

      {!dataReady ? (
        <Skeleton />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <div className="space-y-4">
            <Card raised animate={false}>
              <div role="group" aria-label="Fase timer" className="flex flex-wrap justify-center gap-2">
                {FOCUS_MODES.map((m) => (
                  <span
                    key={m}
                    aria-current={m === timer.mode ? "step" : undefined}
                    className={cn(
                      "rounded-full border px-3.5 py-1.5 text-sm font-medium",
                      m === timer.mode ? "border-accent/40 bg-accent/15 text-accent shadow-[0_0_16px_-6px_rgb(var(--accent)/0.5)]" : "border-fg/10 text-muted",
                    )}
                  >
                    {FOCUS_MODE_LABELS[m]}
                  </span>
                ))}
              </div>

              <div className="mt-6">
                <LiveTimerRing
                  timer={timer}
                  settings={settings}
                  ticking={ready && running}
                  caption={caption}
                  tone={isFocus ? "accent" : "success"}
                  active={active}
                  modeLabel={modeLabel}
                />
              </div>

              <p className="mt-4 text-center text-sm text-muted" aria-live="polite">
                {isFocus
                  ? `Sesi fokus ke-${Math.min(timer.cycle + 1, LONG_BREAK_EVERY)} dari ${LONG_BREAK_EVERY}`
                  : timer.mode === "long_break"
                    ? `${LONG_BREAK_EVERY} sesi fokus selesai. Istirahat panjang dulu`
                    : "Istirahat sebentar"}
              </p>
              <div className="mt-2 flex justify-center gap-2" aria-hidden>
                {Array.from({ length: LONG_BREAK_EVERY }, (_, i) => (
                  <span key={i} className={cn("h-2 w-2 rounded-full", i < dots ? "bg-accent" : "bg-fg/15")} />
                ))}
              </div>

              <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                {!active && (
                  <Button size="lg" onClick={() => void start(startLink)}>
                    <Play className="h-5 w-5" aria-hidden />
                    Mulai
                  </Button>
                )}
                {running && (
                  <Button size="lg" onClick={() => void pause()}>
                    <Pause className="h-5 w-5" aria-hidden />
                    Jeda
                  </Button>
                )}
                {timer.status === "paused" && (
                  <Button size="lg" onClick={() => void resume()}>
                    <Play className="h-5 w-5" aria-hidden />
                    Lanjut
                  </Button>
                )}
                {active && (
                  <Button variant="secondary" size="lg" onClick={() => ask("reset")}>
                    <RotateCcw className="h-4 w-4" aria-hidden />
                    Reset
                  </Button>
                )}
                <Button variant="ghost" size="lg" onClick={() => ask("skip")}>
                  <SkipForward className="h-4 w-4" aria-hidden />
                  Lewati
                </Button>
              </div>

              <div className="mt-6 grid gap-3 border-t border-fg/10 pt-5 sm:grid-cols-2">
                <Field
                  label="Mata kuliah (opsional)"
                  htmlFor="focus-subject"
                  hint={active ? "Dikunci selama sesi berjalan." : undefined}
                >
                  <Select id="focus-subject" value={link.subjectId ?? ""} onChange={(e) => changeSubject(e.target.value)} disabled={active}>
                    <option value="">Tanpa mata kuliah</option>
                    {subjects.map((s) => <option key={s.id} value={s.id}>{s.code ? `${s.code} · ${s.name}` : s.name}</option>)}
                  </Select>
                </Field>
                <Field label="Tugas (opsional)" htmlFor="focus-task" hint={choices.length === 0 ? "Tidak ada tugas yang belum selesai." : undefined}>
                  <Select id="focus-task" value={link.taskId ?? ""} onChange={(e) => changeTask(e.target.value)} disabled={active}>
                    <option value="">Tanpa tugas</option>
                    {taskOptions.map((t) => {
                      const subject = t.subjectId ? subjectsById.get(t.subjectId) : undefined;
                      return <option key={t.id} value={t.id}>{subject && !link.subjectId ? `${t.title} · ${subject.code ?? subject.name}` : t.title}</option>;
                    })}
                  </Select>
                </Field>
              </div>
            </Card>

            <FocusHistory sessions={sessions} subjectsById={subjectsById} tasksById={tasksById} now={new Date()} />
          </div>

          <div className="space-y-4">
            <Card animate={false}>
              <h2 className="font-semibold tracking-tight">Hari ini</h2>
              <dl className="mt-3 grid grid-cols-2 gap-3">
                <div>
                  <dt className="eyebrow">Waktu fokus</dt>
                  <dd className="text-silver mt-1 text-3xl font-bold leading-none tabular-nums">{formatMinutes(today.minutes)}</dd>
                </div>
                <div>
                  <dt className="eyebrow">Sesi selesai</dt>
                  <dd className="text-silver mt-1 text-3xl font-bold leading-none tabular-nums">{today.completed}</dd>
                </div>
              </dl>
              {today.sessions > today.completed && (
                <p className="mt-2 text-xs text-muted">{today.sessions - today.completed} sesi dihentikan lebih awal ikut dihitung waktunya.</p>
              )}

              <div className="mt-4 space-y-3 border-t border-fg/10 pt-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1.5 font-medium">
                    <Flame className="h-4 w-4 text-accent" aria-hidden />
                    Streak belajar
                  </span>
                  <span className="font-semibold tabular-nums">{streak} hari beruntun</span>
                </div>
                <div>
                  <div className="flex items-baseline justify-between gap-2 text-xs">
                    <span className="text-muted">Target minggu ini</span>
                    <span className="font-medium tabular-nums">{formatMinutes(weekMinutes)} / {formatMinutes(targetMinutes)}</span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-fg/10">
                    <div className="h-full rounded-full bg-gradient-to-r from-accent/60 to-accent transition-[width] duration-slow ease-smooth" style={{ width: `${targetPct}%` }} />
                  </div>
                  <div className="mt-2 flex gap-1.5">
                    {WEEKLY_TARGET_PRESETS.map((p) => (
                      <button
                        key={p.minutes}
                        type="button"
                        onClick={() => void appSettingsStore.update((s) => ({ ...s, focusWeeklyTargetMinutes: p.minutes }))}
                        className={cn(
                          "rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors duration-fast",
                          targetMinutes === p.minutes ? "border-accent/50 bg-accent/15 text-accent" : "border-fg/10 text-muted hover:text-fg",
                        )}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </Card>
            <FocusSettingsCard settings={settings} onSave={saveSettings} />
          </div>
        </div>
      )}

      <ConfirmationDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={pending === "skip" ? "Lewati sesi fokus ini?" : "Reset sesi fokus ini?"}
        description={`Kamu sudah fokus ${pendingMinutes} menit. Sesi ini akan dicatat sebagai belum selesai${pending === "skip" ? " dan timer pindah ke istirahat" : ""}.`}
        confirmLabel={pending === "skip" ? "Lewati" : "Reset"}
        destructive
        onConfirm={async () => { if (pending === "skip") await skip(); else await reset(); }}
      />
    </>
  );
}
