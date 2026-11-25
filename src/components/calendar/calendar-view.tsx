"use client";

import { useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Download } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { SegmentedControl } from "@/components/ui/field";
import { useStorage } from "@/hooks/use-storage";
import {
  CALENDAR_KIND_LABELS, agendaForMonth, defaultSelectionFor, entriesByDate, entriesForDate, monthGrid,
  monthOf, previewEntries, shiftMonth, type CalendarKind, type YearMonth,
} from "@/lib/calendar";
import { WEEKDAY_LABELS_ID, formatDateID, todayKey, weekdayOrder } from "@/lib/date";
import { downloadTextFile } from "@/lib/download";
import { buildCalendarIcs } from "@/lib/ics";
import { cn } from "@/lib/utils";
import { useToast } from "@/providers/toast-provider";
import { CalendarEntryRow, KIND_DOT, KIND_TONE } from "./calendar-entry-row";

type ViewMode = "month" | "agenda";
const VIEW_OPTIONS: { value: ViewMode; label: string }[] = [
  { value: "month", label: "Bulan" },
  { value: "agenda", label: "Agenda" },
];
const KINDS: CalendarKind[] = ["class", "event", "task", "activity"];
// Inside a day cell. Below `lg`: compact chips (short label + start time), 2 on phones, 3 from `sm`.
// From `lg`: full titles, 2 from `lg`, 3 from `xl` (unchanged since 0.12.1).
const TITLES_MOBILE = 2;
const TITLES_LG = 2;
const TITLES_XL = 3;

function Skeleton() {
  return <div className="glass-item h-[420px] animate-pulse rounded-card" aria-hidden />;
}

export function CalendarView() {
  const schedulesStore = useStorage("schedules");
  const tasksStore = useStorage("tasks");
  const eventsStore = useStorage("events");
  const subjectsStore = useStorage("subjects");
  const activitiesStore = useStorage("activities");
  const settingsStore = useStorage("settings");
  const { toast } = useToast();

  const [ym, setYm] = useState<YearMonth>(() => monthOf(todayKey()) as YearMonth);
  const [selected, setSelected] = useState<string>(() => todayKey());
  const [mode, setMode] = useState<ViewMode>("month");

  const ready = [schedulesStore, tasksStore, eventsStore, subjectsStore, activitiesStore, settingsStore].every((s) => s.isReady);
  const weekStartsOn = settingsStore.data.weekStartsOn;
  const schedules = schedulesStore.data;
  const tasks = tasksStore.data;
  const events = eventsStore.data;
  const subjects = subjectsStore.data;
  const activities = activitiesStore.data;

  const cells = useMemo(() => monthGrid(ym.year, ym.month, weekStartsOn), [ym, weekStartsOn]);
  const byDate = useMemo(
    () => entriesByDate(cells, { schedules, tasks, events, subjects, activities }),
    [cells, schedules, tasks, events, subjects, activities],
  );
  const agenda = useMemo(() => agendaForMonth(cells, byDate), [cells, byDate]);
  const selectedEntries = useMemo(
    () => byDate.get(selected) ?? entriesForDate(selected, { schedules, tasks, events, subjects, activities }),
    [byDate, selected, schedules, tasks, events, subjects, activities],
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

  function handleExportIcs() {
    const { content, count } = buildCalendarIcs({ schedules, tasks, events, subjects, activities });
    if (count === 0) {
      toast({ title: "Belum ada agenda untuk diekspor", description: "Tambahkan jadwal, tugas ber-deadline, atau event dulu ya." });
      return;
    }
    try {
      downloadTextFile({ filename: `campusbest-kalender-${today}.ics`, content, mime: "text/calendar" });
      toast({ title: "Kalender diekspor (.ics)", description: `${count} agenda siap diimpor ke Google/Apple Calendar.`, variant: "success" });
    } catch {
      toast({ title: "Gagal mengekspor", description: "Browser tidak bisa memulai unduhan.", variant: "error" });
    }
  }

  return (
    <>
      <PageHeader
        title="Calendar"
        description="Jadwal kuliah, deadline tugas, event kampus, dan kegiatan lain dalam satu kalender."
        actions={
          ready ? (
            <Button variant="secondary" size="sm" onClick={handleExportIcs}>
              <Download className="h-4 w-4" aria-hidden />
              Export .ics
            </Button>
          ) : null
        }
      />

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
            <h2 className="text-silver min-w-0 flex-1 text-xl font-bold capitalize tracking-tight" aria-live="polite">{monthTitle}</h2>
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
              <Card animate={false} className="p-2 sm:p-4 lg:p-3 xl:p-4">
                <div className="grid grid-cols-7 gap-0.5 text-center text-[10px] font-semibold uppercase tracking-[0.08em] text-muted sm:gap-1 sm:text-xs lg:gap-0.5 xl:gap-1" aria-hidden>
                  {headers.map((d) => <span key={d} className="py-1.5">{WEEKDAY_LABELS_ID[d].slice(0, 3)}</span>)}
                </div>
                <div className="grid grid-cols-7 gap-0.5 sm:gap-1 lg:gap-0.5 xl:gap-1">
                  {cells.map((cell) => {
                    const entries = byDate.get(cell.key);
                    const isToday = cell.key === today;
                    const isSelected = cell.key === selected;
                    const count = entries?.length ?? 0;
                    const { shown } = previewEntries(entries, TITLES_XL);
                    const moreLg = previewEntries(entries, TITLES_LG).more;
                    const moreXl = previewEntries(entries, TITLES_XL).more;
                    const moreMobile = previewEntries(entries, TITLES_MOBILE).more;
                    return (
                      <button
                        key={cell.key}
                        type="button"
                        onClick={() => pick(cell.key)}
                        aria-pressed={isSelected}
                        aria-current={isToday ? "date" : undefined}
                        aria-label={`${formatDateID(cell.key, { day: "numeric", month: "long", year: "numeric" })}${isToday ? ", hari ini" : ""}, ${count > 0 ? `${count} aktivitas` : "tidak ada aktivitas"}`}
                        className={cn(
                          "flex h-[6rem] min-w-0 flex-col items-center justify-start gap-0.5 overflow-hidden rounded-control border px-px pt-1 text-sm transition-colors duration-fast sm:h-[6.5rem] sm:px-1 sm:pt-1.5 lg:h-[6.75rem] lg:items-stretch lg:gap-0.5 lg:px-0.5 lg:pt-1.5 xl:px-1 xl:h-[8.25rem]",
                          isToday && "bg-fg/[0.05]",
                          isSelected ? "border-accent/60 bg-accent/15 shadow-[inset_0_1px_0_rgb(255_255_255/0.12),0_0_18px_-6px_rgb(var(--accent)/0.4)]" : "border-transparent hover:bg-fg/[0.06]",
                          !cell.inMonth && "text-muted/50",
                        )}
                      >
                        <span
                          className={cn(
                            "grid h-6 w-6 shrink-0 place-items-center rounded-full text-[13px] font-medium sm:h-7 sm:w-7 sm:text-sm lg:self-start",
                            isToday && "bg-accent text-accent-fg",
                            isToday && "btn-metal shadow-glow",
                          )}
                        >
                          {cell.day}
                        </span>
                        {shown.length > 0 && (
                          <span className="flex w-full min-w-0 flex-col gap-0.5 lg:hidden" aria-hidden>
                            {shown.map((e, i) => (
                              <span
                                key={e.key}
                                title={e.title}
                                className={cn(
                                  "flex min-w-0 flex-col items-center rounded px-px py-px text-center sm:flex-row sm:justify-between sm:gap-1 sm:px-1",
                                  KIND_TONE[e.kind],
                                  !cell.inMonth && "opacity-50",
                                  e.done && "line-through opacity-60",
                                  i >= TITLES_MOBILE && "hidden sm:flex",
                                )}
                              >
                                <span className="block w-full min-w-0 truncate text-[9px] font-semibold leading-[11px] tracking-tighter min-[360px]:text-[10px] min-[360px]:tracking-normal sm:w-auto sm:text-[11px] sm:leading-3">{e.shortTitle}</span>
                                {e.shortTime && <span className="block text-[9px] leading-[10px] opacity-80 sm:shrink-0 sm:text-[10px] sm:leading-3">{e.shortTime}</span>}
                              </span>
                            ))}
                            {moreMobile > 0 && <span className="block whitespace-nowrap text-[9px] leading-[10px] text-muted sm:hidden">+{moreMobile}</span>}
                            {moreXl > 0 && <span className="hidden whitespace-nowrap text-[10px] leading-3 text-muted sm:block">+{moreXl} lagi</span>}
                          </span>
                        )}
                        {shown.length > 0 && (
                          <span className={cn("hidden min-w-0 flex-col gap-0.5 text-left lg:flex", !cell.inMonth && "opacity-50")} aria-hidden>
                            {shown.map((e, i) => (
                              <span
                                key={e.key}
                                title={e.title}
                                className={cn(
                                  "block truncate rounded px-1 text-[11px] font-medium leading-4",
                                  KIND_TONE[e.kind],
                                  "shadow-[inset_0_1px_0_rgb(255_255_255/0.1)]",
                                  e.done && "line-through opacity-60",
                                  i >= TITLES_LG && "hidden xl:block",
                                )}
                              >
                                {e.title}
                              </span>
                            ))}
                            {moreLg > 0 && (
                              <span className="block whitespace-nowrap px-0.5 text-[10px] leading-4 text-muted xl:hidden">+{moreLg}</span>
                            )}
                            {moreXl > 0 && (
                              <span className="hidden whitespace-nowrap px-1 text-[11px] leading-4 text-muted xl:block">+{moreXl} lagi</span>
                            )}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
                <div className="mt-3 border-t border-fg/10 pt-3">{legend}</div>
              </Card>

              <Card raised animate={false} className="self-start">
                <h3 className="font-semibold tracking-tight">
                  {formatDateID(selected, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                </h3>
                {selected === today && <p className="mt-0.5 text-xs text-accent">Hari ini</p>}
                {selectedEntries.length === 0 ? (
                  <EmptyState
                    icon={CalendarDays}
                    className="px-2 py-8"
                    title="Tidak ada aktivitas"
                    description="Belum ada kuliah, deadline, event, atau kegiatan di tanggal ini."
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
                  description="Belum ada kuliah, deadline, event, atau kegiatan di bulan ini."
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
