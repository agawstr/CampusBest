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

export function TodayScheduleCard({ classes, subjectsById, hasSchedules, dayLabel }: TodayScheduleCardProps) {
  return (
    <Card animate={false}>
      <SectionHeader title="Jadwal hari ini" subtitle={dayLabel} href="/schedule" linkLabel="Buka jadwal" />
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
        <ul className="space-y-2.5">
          {classes.map(({ item, status }) => {
            const subject = subjectsById.get(item.subjectId);
            const chip = STATUS_CHIP[status];
            const online = item.mode === "online";
            return (
              <li
                key={item.id}
                className={cn("glass-item rounded-control p-3.5", status === "done" && "opacity-70")}
                style={{ borderLeft: `4px solid ${subject?.color ?? FALLBACK_COLOR}` }}
              >
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <p className="text-sm font-semibold">{timeRange(item)}</p>
                  {chip && <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", chip.className)}>{chip.label}</span>}
                </div>
                <p className="mt-1 break-words font-semibold leading-snug">{subjectTitle(subject)}</p>
                {subject?.code && <p className="text-xs text-muted">{subject.code}</p>}
                <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                  {subject?.lecturer && (
                    <span className="flex items-center gap-1.5"><User className="h-3.5 w-3.5 shrink-0" aria-hidden />{subject.lecturer}</span>
                  )}
                  <span className="flex items-center gap-1.5">
                    {online ? <Video className="h-3.5 w-3.5 shrink-0" aria-hidden /> : <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />}
                    {online ? "Online" : "Offline"}{item.room ? ` · ${item.room}` : ""}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
