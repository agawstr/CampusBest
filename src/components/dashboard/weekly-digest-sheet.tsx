"use client";

import { useMemo } from "react";
import Link from "next/link";
import { CheckCircle2, ChevronRight, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ResponsiveSheet } from "@/components/ui/responsive-sheet";
import { buildWeeklyDigest, formatDigestText } from "@/lib/digest";
import { cn } from "@/lib/utils";
import { useToast } from "@/providers/toast-provider";
import type { Activity, CampusEvent, Subject, Task } from "@/types";

interface WeeklyDigestSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tasks: readonly Task[];
  events: readonly CampusEvent[];
  activities: readonly Activity[];
  subjects: readonly Subject[];
  now: Date;
}

export function WeeklyDigestSheet({ open, onOpenChange, tasks, events, activities, subjects, now }: WeeklyDigestSheetProps) {
  const { toast } = useToast();
  const digest = useMemo(
    () => buildWeeklyDigest({ tasks, events, activities, subjects }, now),
    [tasks, events, activities, subjects, now],
  );

  async function copySummary() {
    try {
      await navigator.clipboard.writeText(formatDigestText(digest));
      toast({ title: "Rangkuman disalin", description: "Siap ditempel ke WhatsApp atau catatan.", variant: "success" });
    } catch {
      toast({ title: "Gagal menyalin", description: "Browser memblokir akses clipboard.", variant: "error" });
    }
  }

  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Rangkuman 7 hari"
      description={`Tugas, ujian, presentasi, dan kegiatan di luar jadwal kelas (${digest.rangeLabel}).`}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-xs text-muted">{digest.total} agenda terangkum</p>
        <Button variant="secondary" size="sm" onClick={() => void copySummary()}>
          <Copy className="h-3.5 w-3.5" aria-hidden />
          Salin teks
        </Button>
      </div>

      <div className="max-h-[55dvh] space-y-4 overflow-y-auto pr-0.5">
        {digest.groups.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center text-sm text-muted">
            <CheckCircle2 className="h-7 w-7 text-success" aria-hidden />
            <p>Minggu ini bersih! Tidak ada deadline, ujian, atau kegiatan dalam 7 hari ke depan.</p>
          </div>
        ) : (
          digest.groups.map((group) => (
            <section key={group.key}>
              <h3 className={cn("eyebrow mb-2", group.key === "overdue" && "text-danger")}>{group.label}</h3>
              <ul className="space-y-1.5">
                {group.items.map((item) => (
                  <li key={item.id}>
                    <Link
                      href={item.href}
                      onClick={() => onOpenChange(false)}
                      className={cn(
                        "glass-item flex items-center gap-3 rounded-control px-3 py-2.5 transition-colors duration-fast hover:bg-fg/10",
                        item.urgent && "border-danger/40",
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <span
                          className={cn(
                            "inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold",
                            item.urgent
                              ? "bg-danger/15 text-danger"
                              : item.kind === "activity"
                                ? "bg-activity/15 text-activity"
                                : "bg-accent/15 text-accent",
                          )}
                        >
                          {item.badge}
                        </span>
                        <p className="mt-1 truncate text-sm font-medium">{item.title}</p>
                        {item.meta && <p className="truncate text-xs text-muted">{item.meta}</p>}
                      </div>
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}
      </div>
    </ResponsiveSheet>
  );
}
