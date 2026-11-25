import { addDays, startOfWeek, toDateKey } from "@/lib/date";
import type { FocusSession } from "@/types";

/** Consecutive local days with at least one recorded focus session, ending today or yesterday. */
export function computeFocusStreak(sessions: readonly FocusSession[], now: Date): number {
  const activeDays = new Set<string>();
  for (const s of sessions) {
    if (s.durationMinutes <= 0) continue;
    const dt = new Date(s.startedAt);
    if (!Number.isNaN(dt.getTime())) activeDays.add(toDateKey(dt));
  }
  if (activeDays.size === 0) return 0;

  let cursor = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (!activeDays.has(toDateKey(cursor))) {
    cursor = addDays(cursor, -1);
    if (!activeDays.has(toDateKey(cursor))) return 0;
  }

  let streak = 0;
  while (activeDays.has(toDateKey(cursor))) {
    streak++;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

/** Total focus minutes recorded in the current local week. */
export function focusThisWeekMinutes(sessions: readonly FocusSession[], now: Date, weekStartsOn: 0 | 1): number {
  const start = startOfWeek(now, weekStartsOn);
  const startKey = toDateKey(start);
  const endKey = toDateKey(addDays(start, 6));
  let total = 0;
  for (const s of sessions) {
    if (s.durationMinutes <= 0) continue;
    const dt = new Date(s.startedAt);
    if (Number.isNaN(dt.getTime())) continue;
    const key = toDateKey(dt);
    if (key >= startKey && key <= endKey) total += s.durationMinutes;
  }
  return total;
}

export const WEEKLY_TARGET_PRESETS = [
  { minutes: 180, label: "3 jam" },
  { minutes: 300, label: "5 jam" },
  { minutes: 600, label: "10 jam" },
] as const;
