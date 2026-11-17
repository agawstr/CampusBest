import { MapPin, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { activityDetail, activityTimeRange, dayLabelFor, type AgendaActivity } from "@/lib/activities";
import { cn } from "@/lib/utils";
import { SectionHeader } from "./section-header";

interface ActivitiesCardProps {
  activities: AgendaActivity[];
  hasActivities: boolean;
}

/** Kegiatan Lain: today and the next 6 days. Read-only; editing happens on the Schedule page. */
export function ActivitiesCard({ activities, hasActivities }: ActivitiesCardProps) {
  return (
    <Card animate={false}>
      <SectionHeader title="Kegiatan lain" subtitle="Hari ini dan 6 hari ke depan" href="/schedule?tab=lain" linkLabel="Buka kegiatan" />
      {activities.length === 0 ? (
        <EmptyState
          icon={Users}
          className="px-2 py-8"
          title={hasActivities ? "Tidak ada kegiatan dalam seminggu ini" : "Belum ada kegiatan lain"}
          description={hasActivities ? "Kegiatan di luar kuliah yang akan datang muncul di sini." : "Catat organisasi, olahraga, atau kerja di Schedule, tab Kegiatan Lain."}
        />
      ) : (
        <ul className="space-y-2.5">
          {activities.map(({ item, date, daysFromToday, status }) => (
            <li
              key={`${item.id}:${date}`}
              className={cn("glass rounded-control p-3.5", status === "done" && "opacity-70")}
              style={{ borderLeft: "4px solid #8B5CF6" }}
            >
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <p className="text-sm font-semibold">{activityTimeRange(item)}</p>
                <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", daysFromToday === 0 ? "bg-accent/15 text-accent" : "bg-fg/10 text-muted")}>
                  {dayLabelFor(daysFromToday, date)}
                </span>
                {status === "ongoing" && <span className="rounded-full bg-accent/15 px-2 py-0.5 text-xs font-medium text-accent">Sedang berlangsung</span>}
                {status === "done" && <span className="rounded-full bg-fg/10 px-2 py-0.5 text-xs font-medium text-muted">Selesai</span>}
              </div>
              <p className="mt-1 break-words font-semibold leading-snug">{item.title}</p>
              <p className="mt-1 flex items-center gap-1.5 break-words text-xs text-muted">
                {item.location && <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />}
                {activityDetail(item)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
