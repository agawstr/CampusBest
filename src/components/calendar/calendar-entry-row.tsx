import { CalendarDays, ClipboardList, GraduationCap, type LucideIcon } from "lucide-react";
import { CALENDAR_KIND_LABELS, type CalendarEntry, type CalendarKind } from "@/lib/calendar";
import { cn } from "@/lib/utils";

export const KIND_DOT: Record<CalendarKind, string> = {
  class: "bg-accent",
  event: "bg-success",
  task: "bg-amber-500",
};

const KIND_ICON: Record<CalendarKind, LucideIcon> = {
  class: GraduationCap,
  event: CalendarDays,
  task: ClipboardList,
};

const KIND_TONE: Record<CalendarKind, string> = {
  class: "bg-accent/15 text-accent",
  event: "bg-success/15 text-success",
  task: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
};

function timeLabel(entry: CalendarEntry): string {
  if (entry.kind === "task") return entry.startTime ? `Batas ${entry.startTime}` : "Seharian";
  if (entry.startTime && entry.endTime) return `${entry.startTime} - ${entry.endTime}`;
  return entry.startTime ?? "Seharian";
}

export function CalendarEntryRow({ entry }: { entry: CalendarEntry }) {
  const Icon = KIND_ICON[entry.kind];
  return (
    <li
      className="glass flex items-start gap-3 rounded-control p-3.5"
      style={entry.color ? { borderLeft: `4px solid ${entry.color}` } : undefined}
    >
      <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-full", KIND_TONE[entry.kind])} aria-hidden>
        <Icon className="h-[18px] w-[18px]" />
      </span>
      <div className="min-w-0 flex-1">
        <p className={cn("break-words font-semibold leading-snug", entry.done && "text-muted line-through")}>{entry.title}</p>
        <p className="mt-0.5 text-xs text-muted">
          {CALENDAR_KIND_LABELS[entry.kind]} · {timeLabel(entry)}{entry.done ? " · Selesai" : ""}
        </p>
        {entry.detail && <p className="mt-0.5 break-words text-xs text-muted">{entry.detail}</p>}
      </div>
    </li>
  );
}
