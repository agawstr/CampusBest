import Link from "next/link";
import { CalendarDays, ClipboardCheck, Clock, MapPin } from "lucide-react";
import { CATEGORY_TONE, DATE_TONE } from "@/components/events/event-item";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import type { Limited } from "@/lib/dashboard";
import { EVENT_CATEGORY_LABELS } from "@/lib/domain";
import { eventDateInfo, eventTimeLabel } from "@/lib/events";
import { cn } from "@/lib/utils";
import type { CampusEvent, Subject } from "@/types";
import { SectionHeader } from "./section-header";

interface UpcomingEventsCardProps {
  events: Limited<CampusEvent>;
  subjectsById: ReadonlyMap<string, Subject>;
  now: Date;
}

export function UpcomingEventsCard({ events, subjectsById, now }: UpcomingEventsCardProps) {
  const more = events.total - events.items.length;
  return (
    <Card animate={false}>
      <SectionHeader title="Ujian & event mendatang" subtitle="Hari ini dan seterusnya" href="/exams" linkLabel="Semua event" />
      {events.items.length === 0 ? (
        <EmptyState
          icon={ClipboardCheck}
          className="px-2 py-8"
          title="Belum ada ujian atau event mendatang"
          description="UTS, UAS, quiz, atau seminar yang kamu catat di Exams akan muncul di sini."
        />
      ) : (
        <>
          <ul className="space-y-2.5">
            {events.items.map((event) => {
              const subject = event.subjectId ? subjectsById.get(event.subjectId) : undefined;
              const date = eventDateInfo(event, now);
              return (
                <li key={event.id} className="glass-item rounded-control p-3.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", CATEGORY_TONE[event.category] ?? CATEGORY_TONE.lainnya)}>
                      {EVENT_CATEGORY_LABELS[event.category] ?? EVENT_CATEGORY_LABELS.lainnya}
                    </span>
                    {subject && (
                      <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: subject.color }} aria-hidden />
                        <span className="truncate">{subject.name}</span>
                      </span>
                    )}
                  </div>
                  <p className="mt-1.5 break-words font-semibold leading-snug">{event.title}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                    <span className={cn("flex items-center gap-1.5", DATE_TONE[date.tone])}>
                      <CalendarDays className="h-3.5 w-3.5 shrink-0" aria-hidden />
                      {date.label}
                    </span>
                    <span className="flex items-center gap-1.5 text-muted">
                      <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden />
                      {eventTimeLabel(event)}
                    </span>
                    {event.location && (
                      <span className="flex min-w-0 items-center gap-1.5 text-muted">
                        <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
                        <span className="break-words">{event.location}</span>
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
          {more > 0 && (
            <p className="mt-3 text-center text-sm text-muted">
              <Link href="/exams" className="font-medium text-accent hover:underline">+{more} event lainnya</Link>
            </p>
          )}
        </>
      )}
    </Card>
  );
}
