import type { CSSProperties } from "react";
import { CalendarCheck, MapPin, User, Video } from "lucide-react";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import type { ClassStatus, TodayClass } from "@/lib/dashboard";
import { subjectTitle, timeRange } from "@/lib/schedule";
import { cn } from "@/lib/utils";
import type { Subject } from "@/types";
import { SectionHeader } from "./section-header";

const FALLBACK_COLOR = "#9A9AA3";

const STATUS_CHIP: Partial<Record<ClassStatus, { label: string; className: string }>> = {
  ongoing: { label: "Sedang berlangsung", className: "bg-accent/15 text-accent" },
  done: { label: "Selesai", className: "bg-fg/10 text-muted" },
};

interface TodayScheduleCardProps {
  classes: TodayClass[];
  subjectsById: ReadonlyMap<string, Subject>;
  /** Whether any schedule exists at all, to word the empty state. */
  hasSchedules: boolean;
  dayLabel: string;
}

/** The hero of the Dashboard. The class in progress (or else the first one still to come) leads; the rest stay in time order. */
export function TodayScheduleCard({ classes, subjectsById, hasSchedules, dayLabel }: TodayScheduleCardProps) {
  const ongoing = classes.findIndex((c) => c.status === "ongoing");
  const featuredIndex = ongoing >= 0 ? ongoing : classes.findIndex((c) => c.status === "upcoming");
  return (
    <Card raised animate={false} className="glass-hero !shadow-hero p-5 md:p-7">
      <SectionHeader size="hero" title="Jadwal hari ini" subtitle={dayLabel} href="/schedule" linkLabel="Buka jadwal" />
      {classes.length === 0 ? (
        <EmptyState
          icon={CalendarCheck}
          className="px-2 py-8"
          title={hasSchedules ? "Tidak ada kuliah hari ini" : "Belum ada jadwal kuliah"}
          description={
            hasSchedules
              ? "Hari ini kamu bebas kelas. Pas buat nyicil tugas atau istirahat."
              : "Tambahkan jadwal kuliahmu di Schedule, nanti kelas hari ini muncul di sini."
          }
        />
      ) : (
        <ul className="space-y-3">
          {classes.map(({ item, status }, index) => {
            const subject = subjectsById.get(item.subjectId);
            const chip = STATUS_CHIP[status];
            const online = item.mode === "online";
            const featured = index === featuredIndex;
            const color = subject?.color ?? FALLBACK_COLOR;
            return (
              <li
                key={item.id}
                className={cn(
                  "glass-item subject-tint grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-4 rounded-control",
                  featured ? "item-featured p-4 md:p-5" : "p-3.5",
                  status === "done" && "opacity-60",
                )}
                style={{ borderLeft: `4px solid ${color}`, "--tint": color } as CSSProperties}
              >
                <span className="sr-only">{timeRange(item)}</span>
                <div className="min-w-[3.25rem] text-right" aria-hidden>
                  <p className={cn("font-bold tabular-nums leading-none tracking-tight", featured ? "text-3xl" : "text-xl")}>{item.startTime}</p>
                  <p className="mt-1.5 text-xs tabular-nums text-muted">{item.endTime}</p>
                </div>
                <div className="min-w-0">
                  {chip && (
                    <span className={cn("mb-1.5 inline-block rounded-full px-2 py-0.5 text-xs font-medium", chip.className)}>{chip.label}</span>
                  )}
                  <p className={cn("break-words font-semibold leading-snug", featured && "text-lg")}>{subjectTitle(subject)}</p>
                  {subject?.code && <p className="text-xs text-muted">{subject.code}</p>}
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                    {subject?.lecturer && (
                      <span className="flex items-center gap-1.5"><User className="h-3.5 w-3.5 shrink-0" aria-hidden />{subject.lecturer}</span>
                    )}
                    <span className="flex items-center gap-1.5">
                      {online ? <Video className="h-3.5 w-3.5 shrink-0" aria-hidden /> : <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />}
                      {online ? "Online" : "Offline"}{item.room ? ` · ${item.room}` : ""}
                    </span>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
