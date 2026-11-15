"use client";

import { Pencil, Pin, PinOff, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { isPinned, notePreview, noteTimeLabel } from "@/lib/notes";
import { cn } from "@/lib/utils";
import type { Note, Subject } from "@/types";

interface NoteCardProps {
  note: Note;
  subject?: Subject;
  now: Date;
  onEdit: (note: Note) => void;
  onDelete: (note: Note) => void;
  onTogglePin: (note: Note) => void;
}

export function NoteCard({ note, subject, now, onEdit, onDelete, onTogglePin }: NoteCardProps) {
  const pinned = isPinned(note);
  const preview = notePreview(note.content);
  const when = noteTimeLabel(note, now);

  return (
    <Card animate={false} className={cn("flex h-full flex-col p-4", pinned && "border border-accent/30")}>
      <div className="flex items-start gap-2">
        <button
          type="button"
          onClick={() => onEdit(note)}
          aria-label={`Buka catatan ${note.title}`}
          className="min-w-0 flex-1 rounded-lg text-left"
        >
          <span className="flex items-start gap-1.5">
            {pinned && <Pin className="mt-1 h-3.5 w-3.5 shrink-0 fill-current text-accent" aria-label="Disematkan" />}
            <span className="block break-words font-semibold leading-snug">{note.title}</span>
          </span>
          {preview ? (
            <span className="mt-1.5 line-clamp-5 block whitespace-pre-line break-words text-sm text-muted">{preview}</span>
          ) : (
            <span className="mt-1.5 block text-sm italic text-muted/70">Belum ada isi.</span>
          )}
        </button>

        <div className="flex shrink-0 gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            className={cn("h-9 w-9", pinned && "text-accent")}
            aria-label={pinned ? `Lepas sematan ${note.title}` : `Sematkan ${note.title}`}
            aria-pressed={pinned}
            onClick={() => onTogglePin(note)}
          >
            {pinned ? <PinOff className="h-4 w-4" aria-hidden /> : <Pin className="h-4 w-4" aria-hidden />}
          </Button>
          <Button variant="ghost" size="icon" className="h-9 w-9" aria-label={`Edit ${note.title}`} onClick={() => onEdit(note)}>
            <Pencil className="h-4 w-4" aria-hidden />
          </Button>
          <Button variant="ghost" size="icon" className="h-9 w-9 hover:text-danger" aria-label={`Hapus ${note.title}`} onClick={() => onDelete(note)}>
            <Trash2 className="h-4 w-4" aria-hidden />
          </Button>
        </div>
      </div>

      <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-3 text-xs text-muted">
        {subject && (
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: subject.color }} aria-hidden />
            <span className="truncate">{subject.name}</span>
          </span>
        )}
        {when && <span>{when}</span>}
      </div>
    </Card>
  );
}
