"use client";

import { CalendarDays, Clock, MapPin, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EVENT_CATEGORY_LABELS } from "@/lib/domain";
import { eventDateInfo, eventTimeLabel, type EventDateTone } from "@/lib/events";
import { cn } from "@/lib/utils";
import type { CampusEvent, EventCategory, Subject } from "@/types";

/** Exams read as more serious than seminars, so UTS/UAS stand out and the rest stay calm. */
export const CATEGORY_TONE: Record<EventCategory, string> = {
  uts: "bg-danger/15 text-danger",
  uas: "bg-danger/15 text-danger",
  quiz: "bg-accent/15 text-accent",
  praktikum: "bg-accent/15 text-accent",
  presentasi: "bg-success/15 text-success",
  seminar: "bg-success/15 text-success",
  lainnya: "bg-fg/10 text-muted",
};

export const DATE_TONE: Record<EventDateTone, string> = {
  today: "text-accent font-medium",
  soon: "text-accent",
  normal: "text-muted",
  past: "text-muted",
  none: "text-danger",
};

interface EventItemProps {
  event: CampusEvent;
  subject?: Subject;
  now: Date;
  onEdit: (event: CampusEvent) => void;
  onDelete: (event: CampusEvent) => void;
}

export function EventItem({ event, subject, now, onEdit, onDelete }: EventItemProps) {
  const date = eventDateInfo(event, now);
  const past = date.tone === "past";

  return (
    <Card animate={false} className={cn("p-4", past && "opacity-75")}>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn("rounded-full px-2.5 py-1 text-xs font-medium", CATEGORY_TONE[event.category] ?? CATEGORY_TONE.lainnya)}>
              {EVENT_CATEGORY_LABELS[event.category] ?? EVENT_CATEGORY_LABELS.lainnya}
            </span>
            {subject && (
              <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: subject.color }} aria-hidden />
                <span className="truncate">{subject.name}</span>
              </span>
            )}
          </div>

          <p className="mt-2 break-words font-semibold leading-snug">{event.title}</p>
          {event.description && <p className="mt-1 line-clamp-2 break-words text-sm text-muted">{event.description}</p>}

          <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs">
            <span className={cn("flex items-center gap-1.5", DATE_TONE[date.tone])}>
              <CalendarDays className="h-3.5 w-3.5 shrink-0" aria-hidden />
              {date.label}
            </span>
            {date.tone !== "none" && (
              <span className="flex items-center gap-1.5 text-muted">
                <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden />
                {eventTimeLabel(event)}
              </span>
            )}
            {event.location && (
              <span className="flex min-w-0 items-center gap-1.5 text-muted">
                <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
                <span className="break-words">{event.location}</span>
              </span>
            )}
          </div>
        </div>

        <div className="flex shrink-0 gap-0.5">
          <Button variant="ghost" size="icon" className="h-9 w-9" aria-label={`Edit ${event.title}`} onClick={() => onEdit(event)}>
            <Pencil className="h-4 w-4" aria-hidden />
          </Button>
          <Button variant="ghost" size="icon" className="h-9 w-9 hover:text-danger" aria-label={`Hapus ${event.title}`} onClick={() => onDelete(event)}>
            <Trash2 className="h-4 w-4" aria-hidden />
          </Button>
        </div>
      </div>
    </Card>
  );
}
