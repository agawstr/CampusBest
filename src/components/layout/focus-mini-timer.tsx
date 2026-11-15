"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Timer } from "lucide-react";
import { useFocusClock } from "@/hooks/use-focus-clock";
import { formatClock, remainingMs } from "@/lib/focus";
import { cn } from "@/lib/utils";
import { useFocusTimer } from "@/providers/focus-timer-provider";

/** A small link back to the timer, shown on every page except /focus while a phase is running or paused. */
export function FocusMiniTimer() {
  const pathname = usePathname();
  const { ready, timer, settings } = useFocusTimer();
  const running = timer.status === "running";
  const nowMs = useFocusClock(ready && running);

  if (!ready || timer.status === "idle" || pathname === "/focus" || pathname.startsWith("/focus/")) return null;

  const label = timer.mode === "focus" ? "Fokus" : "Istirahat";
  return (
    <Link
      href="/focus"
      aria-label={`${label} ${running ? "berjalan" : "dijeda"}, sisa ${formatClock(remainingMs(timer, settings, nowMs))}. Buka timer fokus`}
      className="glass flex h-10 items-center gap-2 rounded-full px-3.5 text-sm font-semibold transition-colors duration-fast hover:bg-fg/10"
    >
      <Timer className={cn("h-4 w-4", running ? "text-accent" : "text-muted")} aria-hidden />
      <span className="tabular-nums">{formatClock(remainingMs(timer, settings, nowMs))}</span>
      <span className="hidden text-xs font-medium text-muted sm:inline">{running ? label : `${label} · dijeda`}</span>
    </Link>
  );
}
