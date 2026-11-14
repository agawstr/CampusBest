"use client";

import { Clock, MapPin, Pencil, Repeat, Trash2, User, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { recurrenceNote, subjectTitle, timeRange } from "@/lib/schedule";
import type { ScheduleItem, Subject } from "@/types";

const FALLBACK_COLOR = "#9AAAC2";

interface ScheduleItemCardProps {
  item: ScheduleItem;
  subject?: Subject;
  onEdit: (item: ScheduleItem) => void;
  onDelete: (item: ScheduleItem) => void;
}

export function ScheduleItemCard({ item, subject, onEdit, onDelete }: ScheduleItemCardProps) {
  const note = recurrenceNote(item);
  const title = subjectTitle(subject);
  const online = item.mode === "online";

  return (
    <div className="glass flex h-full flex-col rounded-control p-3.5 shadow-soft" style={{ borderLeft: `4px solid ${subject?.color ?? FALLBACK_COLOR}` }}>
      <p className="flex items-center gap-1.5 text-sm font-semibold">
        <Clock className="h-3.5 w-3.5 shrink-0 text-muted" aria-hidden />
        {timeRange(item)}
      </p>
      <p className="mt-1 break-words font-semibold leading-snug">{title}</p>
      {subject?.code && <p className="text-xs text-muted">{subject.code}</p>}

      <div className="mt-2 space-y-1 text-xs text-muted">
        {subject?.lecturer && (
          <p className="flex items-center gap-1.5"><User className="h-3.5 w-3.5 shrink-0" aria-hidden /><span className="break-words">{subject.lecturer}</span></p>
        )}
        <p className="flex items-center gap-1.5">
          {online ? <Video className="h-3.5 w-3.5 shrink-0" aria-hidden /> : <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />}
          <span className="break-words">{online ? "Online" : "Offline"}{item.room ? ` · ${item.room}` : ""}</span>
        </p>
        {note && (
          <p className="flex items-center gap-1.5"><Repeat className="h-3.5 w-3.5 shrink-0" aria-hidden />{note}</p>
        )}
      </div>

      <div className="-mb-1 -mr-1 mt-auto flex justify-end gap-0.5 pt-2">
        <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Edit jadwal ${title}`} onClick={() => onEdit(item)}>
          <Pencil className="h-4 w-4" aria-hidden />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-danger" aria-label={`Hapus jadwal ${title}`} onClick={() => onDelete(item)}>
          <Trash2 className="h-4 w-4" aria-hidden />
        </Button>
      </div>
    </div>
  );
}
