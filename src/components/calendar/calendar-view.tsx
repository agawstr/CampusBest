"use client";

import { useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { SegmentedControl } from "@/components/ui/field";
import { useStorage } from "@/hooks/use-storage";
import {
  CALENDAR_KIND_LABELS, agendaForMonth, defaultSelectionFor, entriesByDate, entriesForDate, kindsPresent, monthGrid,
  monthOf, shiftMonth, type CalendarKind, type YearMonth,
} from "@/lib/calendar";
import { WEEKDAY_LABELS_ID, formatDateID, todayKey, weekdayOrder } from "@/lib/date";
import { cn } from "@/lib/utils";
import { CalendarEntryRow, KIND_DOT } from "./calendar-entry-row";

type ViewMode = "month" | "agenda";
const VIEW_OPTIONS: { value: ViewMode; label: string }[] = [
  { value: "month", label: "Bulan" },
  { value: "agenda", label: "Agenda" },
];
const KINDS: CalendarKind[] = ["class", "event", "task"];

function Skeleton() {
  return <div className="glass h-[420px] animate-pulse rounded-card" aria-hidden />;
}

export function CalendarView() {
  const schedulesStore = useStorage("schedules");
  const tasksStore = useStorage("tasks");
  const eventsStore = useStorage("events");
  const subjectsStore = useStorage("subjects");
  const settingsStore = useStorage("settings");

  const [ym, setYm] = useState<YearMonth>(() => monthOf(todayKey()) as YearMonth);
  const [selected, setSelected] = useState<string>(() => todayKey());
  const [mode, setMode] = useState<ViewMode>("month");

  const ready = [schedulesStore, tasksStore, eventsStore, subjectsStore, settingsStore].every((s) => s.isReady);
  const weekStartsOn = settingsStore.data.weekStartsOn;
  const schedules = schedulesStore.data;
  const tasks = tasksStore.data;
  const events = eventsStore.data;
  const subjects = subjectsStore.data;

  const cells = useMemo(() => monthGrid(ym.year, ym.month, weekStartsOn), [ym, weekStartsOn]);
  const byDate = useMemo(
    () => entriesByDate(cells, { schedules, tasks, events, subjects }),
    [cells, schedules, tasks, events, subjects],
  );
  const agenda = useMemo(() => agendaForMonth(cells, byDate), [cells, byDate]);
  const selectedEntries = useMemo(
    () => byDate.get(selected) ?? entriesForDate(selected, { schedules, tasks, events, subjects }),
    [byDate, selected, schedules, tasks, events, subjects],
  );

  const today = todayKey();
  const isCurrentMonth = monthOf(today)?.year === ym.year && monthOf(today)?.month === ym.month;
  const monthTitle = formatDateID(new Date(ym.year, ym.month, 1), { month: "long", year: "numeric" });
  const headers = weekdayOrder(weekStartsOn);

  function goTo(next: YearMonth) {
    setYm(next);
    setSelected(defaultSelectionFor(next, today));
  }
  function pick(dateKey: string) {
    setSelected(dateKey);
    // Tapping a greyed day of a neighbouring month moves the view there.
    const m = monthOf(dateKey);
    if (m && (m.year !== ym.year || m.month !== ym.month)) setYm(m);
  }

  const legend = (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted" aria-label="Keterangan warna">
      {KINDS.map((k) => (
        <li key={k} className="flex items-center gap-1.5">
          <span className={cn("h-2 w-2 rounded-full", KIND_DOT[k])} aria-hidden />
          {CALENDAR_KIND_LABELS[k]}
        </li>
      ))}
    </ul>
  );

  return (
    <>
      <PageHeader title="Calendar" description="Jadwal kuliah, deadline tugas, dan event kampus dalam satu kalender." />

      {!ready ? (
        <Skeleton />
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1">
              <Button variant="secondary" size="icon" aria-label="Bulan sebelumnya" onClick={() => goTo(shiftMonth(ym, -1))}>
                <ChevronLeft className="h-5 w-5" aria-hidden />
              </Button>
              <Button variant="secondary" size="icon" aria-label="Bulan berikutnya" onClick={() => goTo(shiftMonth(ym, 1))}>
                <ChevronRight className="h-5 w-5" aria-hidden />
              </Button>
            </div>
            <h2 className="min-w-0 flex-1 text-lg font-semibold capitalize" aria-live="polite">{monthTitle}</h2>
            <Button
              variant="secondary"
              size="sm"
              disabled={isCurrentMonth && selected === today}
              onClick={() => { const m = monthOf(today) as YearMonth; setYm(m); setSelected(today); }}
            >
              Hari ini
            </Button>
            <div className="w-full sm:w-52">
              <SegmentedControl<ViewMode> label="Tampilan kalender" value={mode} onChange={setMode} options={VIEW_OPTIONS} />
            </div>
          </div>

          {mode === "month" ? (
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
              <Card animate={false} className="p-3 sm:p-4">
                <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-muted" aria-hidden>
                  {headers.map((d) => <span key={d} className="py-1.5">{WEEKDAY_LABELS_ID[d].slice(0, 3)}</span>)}
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {cells.map((cell) => {
                    const entries = byDate.get(cell.key);
                    const kinds = kindsPresent(entries);
                    const isToday = cell.key === today;
                    const isSelected = cell.key === selected;
                    const count = entries?.length ?? 0;
                    return (
                      <button
                        key={cell.key}
                        type="button"
                        onClick={() => pick(cell.key)}
                        aria-pressed={isSelected}
                        aria-current={isToday ? "date" : undefined}
                        aria-label={`${formatDateID(cell.key, { day: "numeric", month: "long", year: "numeric" })}${isToday ? ", hari ini" : ""}, ${count > 0 ? `${count} aktivitas` : "tidak ada aktivitas"}`}
                        className={cn(
                          "flex h-14 flex-col items-center justify-start gap-1 rounded-control border pt-1.5 text-sm transition-colors duration-fast sm:h-[4.5rem] sm:pt-2",
                          isSelected ? "border-accent/60 bg-accent/15" : "border-transparent hover:bg-fg/[0.06]",
                          !cell.inMonth && "text-muted/50",
                        )}
                      >
                        <span
                          className={cn(
                            "grid h-7 w-7 place-items-center rounded-full font-medium",
                            isToday && "bg-accent text-accent-fg",
                          )}
                        >
                          {cell.day}
                        </span>
                        <span className="flex h-2 items-center gap-1" aria-hidden>
                          {kinds.map((k) => <span key={k} className={cn("h-1.5 w-1.5 rounded-full", KIND_DOT[k], !cell.inMonth && "opacity-50")} />)}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <div className="mt-3 border-t border-fg/10 pt-3">{legend}</div>
              </Card>

              <Card animate={false} className="self-start">
                <h3 className="font-semibold">
                  {formatDateID(selected, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                </h3>
                {selected === today && <p className="mt-0.5 text-xs text-accent">Hari ini</p>}
                {selectedEntries.length === 0 ? (
                  <EmptyState
                    icon={CalendarDays}
                    className="px-2 py-8"
                    title="Tidak ada aktivitas"
                    description="Belum ada kuliah, deadline, atau event di tanggal ini."
                  />
                ) : (
                  <ul className="mt-3 space-y-2.5">
                    {selectedEntries.map((e) => <CalendarEntryRow key={e.key} entry={e} />)}
                  </ul>
                )}
              </Card>
            </div>
          ) : (
            <Card animate={false}>
              {agenda.length === 0 ? (
                <EmptyState
                  icon={CalendarDays}
                  className="px-2 py-8"
                  title="Bulan ini masih kosong"
                  description="Belum ada kuliah, deadline, atau event di bulan ini."
                />
              ) : (
                <div className="space-y-5">
                  {agenda.map(({ date, entries }) => (
                    <section key={date} aria-label={formatDateID(date, { weekday: "long", day: "numeric", month: "long" })}>
                      <h3 className={cn("mb-2 text-sm font-semibold", date === today && "text-accent")}>
                        {formatDateID(date, { weekday: "long", day: "numeric", month: "long" })}
                        {date === today && <span className="ml-2 rounded-full bg-accent/15 px-2 py-0.5 text-xs font-medium">Hari ini</span>}
                      </h3>
                      <ul className="grid gap-2.5 md:grid-cols-2">
                        {entries.map((e) => <CalendarEntryRow key={e.key} entry={e} />)}
                      </ul>
                    </section>
                  ))}
                  <div className="border-t border-fg/10 pt-3">{legend}</div>
                </div>
              )}
            </Card>
          )}
        </>
      )}
    </>
  );
}
