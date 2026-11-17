"use client";

import { Clock, MapPin, Pencil, Repeat, StickyNote, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { activityRecurrenceNote, activityTimeRange, categoryLabel } from "@/lib/activities";
import type { Activity } from "@/types";

interface ActivityCardProps {
  item: Activity;
  onEdit: (item: Activity) => void;
  onDelete: (item: Activity) => void;
}

export function ActivityCard({ item, onEdit, onDelete }: ActivityCardProps) {
  const note = activityRecurrenceNote(item);
  return (
    <div className="glass flex h-full flex-col rounded-control p-3.5 shadow-soft" style={{ borderLeft: "4px solid #8B5CF6" }}>
      <p className="flex items-center gap-1.5 text-sm font-semibold">
        <Clock className="h-3.5 w-3.5 shrink-0 text-muted" aria-hidden />
        {activityTimeRange(item)}
      </p>
      <p className="mt-1 break-words font-semibold leading-snug">{item.title}</p>
      <p className="text-xs text-muted">{categoryLabel(item.category)}</p>

      <div className="mt-2 space-y-1 text-xs text-muted">
        {item.location && (
          <p className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden /><span className="break-words">{item.location}</span></p>
        )}
        {note && <p className="flex items-center gap-1.5"><Repeat className="h-3.5 w-3.5 shrink-0" aria-hidden />{note}</p>}
        {item.notes && (
          <p className="flex items-start gap-1.5"><StickyNote className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden /><span className="line-clamp-3 whitespace-pre-line break-words">{item.notes}</span></p>
        )}
      </div>

      <div className="-mb-1 -mr-1 mt-auto flex justify-end gap-0.5 pt-2">
        <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Edit kegiatan ${item.title}`} onClick={() => onEdit(item)}>
          <Pencil className="h-4 w-4" aria-hidden />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-danger" aria-label={`Hapus kegiatan ${item.title}`} onClick={() => onDelete(item)}>
          <Trash2 className="h-4 w-4" aria-hidden />
        </Button>
      </div>
    </div>
  );
}
