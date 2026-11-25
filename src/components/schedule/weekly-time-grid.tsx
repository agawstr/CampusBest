"use client";

import type { CSSProperties } from "react";
import { Card } from "@/components/ui/card";
import { formatDateID, timeToMinutes } from "@/lib/date";
import { subjectTitle, type WeekDay } from "@/lib/schedule";
import { cn } from "@/lib/utils";
import type { ScheduleItem, Subject } from "@/types";

const HOUR_HEIGHT = 56; // px per hour
const FALLBACK_COLOR = "#9A9AA3";

interface WeeklyTimeGridProps {
  week: readonly WeekDay[];
  today: string;
  subjectsById: ReadonlyMap<string, Subject>;
  onSelect: (item: ScheduleItem) => void;
}

export function WeeklyTimeGrid({ week, today, subjectsById, onSelect }: WeeklyTimeGridProps) {
  // Show weekdays with classes, or Mon-Fri by default so the grid stays clean and readable.
  const activeDays = week.filter((d) => d.items.length > 0 || (d.date.getDay() >= 1 && d.date.getDay() <= 5));
  const days = activeDays.length > 0 ? activeDays : week.slice(0, 5);

  let minHour = 7;
  let maxHour = 18;
  for (const d of days) {
    for (const item of d.items) {
      const s = timeToMinutes(item.startTime);
      const e = timeToMinutes(item.endTime);
      if (s !== null) minHour = Math.min(minHour, Math.floor(s / 60));
      if (e !== null) maxHour = Math.max(maxHour, Math.ceil(e / 60));
    }
  }
  const hours = Array.from({ length: maxHour - minHour + 1 }, (_, i) => minHour + i);
  const totalHeight = (maxHour - minHour) * HOUR_HEIGHT;

  return (
    <Card className="overflow-x-auto p-3 sm:p-4">
      <div className="min-w-[620px]">
        {/* Day headers */}
        <div className="grid gap-1.5 pb-2" style={{ gridTemplateColumns: `3rem repeat(${days.length}, minmax(0, 1fr))` }}>
          <div />
          {days.map((day) => {
            const isToday = day.key === today;
            return (
              <div key={day.key} className={cn("rounded-control px-2 py-1.5 text-center", isToday && "bg-accent/15")}>
                <p className={cn("text-xs font-semibold", isToday ? "text-accent" : "text-fg")}>
                  {formatDateID(day.date, { weekday: "short" })}
                </p>
                <p className="text-[11px] text-muted">{formatDateID(day.date, { day: "numeric", month: "short" })}</p>
              </div>
            );
          })}
        </div>

        {/* Time grid body */}
        <div className="grid gap-1.5" style={{ gridTemplateColumns: `3rem repeat(${days.length}, minmax(0, 1fr))` }}>
          {/* Hour labels */}
          <div className="relative" style={{ height: totalHeight }}>
            {hours.slice(0, -1).map((h, i) => (
              <span
                key={h}
                className="absolute right-2 -translate-y-2 text-[10px] tabular-nums text-muted"
                style={{ top: i * HOUR_HEIGHT }}
              >
                {String(h).padStart(2, "0")}:00
              </span>
            ))}
          </div>

          {/* Day columns */}
          {days.map((day) => (
            <div
              key={day.key}
              className={cn(
                "relative rounded-control border border-fg/10 bg-surface/30",
                day.key === today && "border-accent/30 bg-accent/[0.04]",
              )}
              style={{ height: totalHeight }}
            >
              {/* Hour lines */}
              {hours.slice(1, -1).map((h, i) => (
                <div
                  key={h}
                  className="pointer-events-none absolute inset-x-0 border-t border-fg/[0.06]"
                  style={{ top: (i + 1) * HOUR_HEIGHT }}
                />
              ))}

              {/* Class blocks */}
              {day.items.map((item) => {
                const start = timeToMinutes(item.startTime);
                const end = timeToMinutes(item.endTime);
                if (start === null || end === null || end <= start) return null;
                const top = ((start - minHour * 60) / 60) * HOUR_HEIGHT;
                const height = Math.max(28, ((end - start) / 60) * HOUR_HEIGHT - 2);
                const subject = subjectsById.get(item.subjectId);
                const color = subject?.color ?? FALLBACK_COLOR;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onSelect(item)}
                    title={`${subjectTitle(subject)} (${item.startTime}–${item.endTime}${item.room ? ` · ${item.room}` : ""})`}
                    className="glass-item subject-tint absolute inset-x-1 overflow-hidden rounded-lg px-2 py-1 text-left transition-transform duration-fast hover:z-10 hover:scale-[1.02]"
                    style={{
                      top: top + 1,
                      height,
                      borderLeft: `3px solid ${color}`,
                      "--tint": color,
                    } as CSSProperties}
                  >
                    <p className="truncate text-[11px] font-semibold leading-tight">{subject?.abbr || subjectTitle(subject)}</p>
                    <p className="truncate text-[10px] tabular-nums text-muted">
                      {item.startTime}–{item.endTime}
                    </p>
                    {height >= 48 && item.room && (
                      <p className="truncate text-[10px] text-muted">{item.room}</p>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
