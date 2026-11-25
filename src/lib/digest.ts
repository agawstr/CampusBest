import { activityAgenda, categoryLabel } from "@/lib/activities";
import { addDays, formatDateID, parseDateKey, toDateKey } from "@/lib/date";
import { EVENT_CATEGORY_LABELS, getTaskDeadline, isTaskDone } from "@/lib/domain";
import { isOverdue } from "@/lib/dashboard";
import type { Activity, CampusEvent, Subject, Task } from "@/types";

export interface DigestEntry {
  id: string;
  kind: "task" | "event" | "activity";
  title: string;
  badge: string;
  meta?: string;
  href: "/tasks" | "/exams" | "/schedule";
  urgent?: boolean;
}

export interface DigestGroup {
  key: string;
  label: string;
  items: DigestEntry[];
}

export interface WeeklyDigest {
  groups: DigestGroup[];
  total: number;
  rangeLabel: string;
}

export function buildWeeklyDigest(
  data: {
    tasks: readonly Task[];
    events: readonly CampusEvent[];
    activities: readonly Activity[];
    subjects: readonly Subject[];
  },
  now: Date,
): WeeklyDigest {
  const subjectsById = new Map(data.subjects.map((s) => [s.id, s]));
  const todayKey = toDateKey(now);
  const tomorrowKey = toDateKey(addDays(now, 1));
  const endDate = addDays(now, 6);
  const endKey = toDateKey(endDate);

  const byDay = new Map<string, DigestEntry[]>();
  const push = (key: string, entry: DigestEntry) => {
    const arr = byDay.get(key) ?? [];
    arr.push(entry);
    byDay.set(key, arr);
  };

  // 1. Open tasks: overdue + next 7 days
  for (const t of data.tasks) {
    if (isTaskDone(t)) continue;
    const dl = getTaskDeadline(t);
    if (!dl) continue;
    const subj = t.subjectId ? subjectsById.get(t.subjectId)?.name : undefined;
    const meta = [subj, t.deadlineTime ? `pukul ${t.deadlineTime}` : null].filter(Boolean).join(" · ") || undefined;
    if (isOverdue(t, now)) {
      push("overdue", { id: `task-${t.id}`, kind: "task", title: t.title, badge: "Tugas terlambat", meta, href: "/tasks", urgent: true });
    } else if (dl >= todayKey && dl <= endKey) {
      push(dl, { id: `task-${t.id}`, kind: "task", title: t.title, badge: "Tugas", meta, href: "/tasks" });
    }
  }

  // 2. Events (UTS/UAS/Quiz/Presentasi/Praktikum/Seminar/Lainnya) in next 7 days
  for (const e of data.events) {
    if (!e.date || e.date < todayKey || e.date > endKey) continue;
    const subj = e.subjectId ? subjectsById.get(e.subjectId)?.name : undefined;
    const badge = EVENT_CATEGORY_LABELS[e.category] ?? "Event";
    const meta = [subj, e.startTime, e.location].filter(Boolean).join(" · ") || undefined;
    const urgent = e.category === "uts" || e.category === "uas";
    push(e.date, { id: `event-${e.id}`, kind: "event", title: e.title, badge, meta, href: "/exams", urgent });
  }

  // 3. Activities (di luar jadwal kelas) in next 7 days
  for (const a of activityAgenda(data.activities, now, 7)) {
    const meta = [a.item.startTime, a.item.location].filter(Boolean).join(" · ") || undefined;
    push(a.date, {
      id: `act-${a.date}-${a.item.id}`,
      kind: "activity",
      title: a.item.title,
      badge: categoryLabel(a.item.category),
      meta,
      href: "/schedule",
    });
  }

  const groups: DigestGroup[] = [];
  const overdueItems = byDay.get("overdue");
  if (overdueItems?.length) {
    groups.push({ key: "overdue", label: "Terlambat", items: overdueItems });
  }

  for (let i = 0; i < 7; i++) {
    const dt = addDays(now, i);
    const key = toDateKey(dt);
    const items = byDay.get(key);
    if (!items?.length) continue;
    const datePart = formatDateID(dt, { weekday: "long", day: "numeric", month: "short" });
    const label = key === todayKey ? `Hari ini · ${datePart}` : key === tomorrowKey ? `Besok · ${datePart}` : datePart;
    groups.push({ key, label, items });
  }

  const total = groups.reduce((sum, g) => sum + g.items.length, 0);
  const startLabel = formatDateID(parseDateKey(todayKey) ?? now, { day: "numeric", month: "short" });
  const endLabel = formatDateID(endDate, { day: "numeric", month: "short" });

  return { groups, total, rangeLabel: `${startLabel} – ${endLabel}` };
}

export function formatDigestText(digest: WeeklyDigest): string {
  if (digest.total === 0) return `Rangkuman CampusBest (${digest.rangeLabel}): tidak ada deadline, ujian, atau kegiatan dalam 7 hari ke depan.`;
  const lines: string[] = [`Rangkuman 7 Hari (${digest.rangeLabel})`, ""];
  for (const g of digest.groups) {
    lines.push(`${g.label}:`);
    for (const item of g.items) {
      lines.push(`- [${item.badge}] ${item.title}${item.meta ? ` (${item.meta})` : ""}`);
    }
    lines.push("");
  }
  return lines.join("\n").trim();
}
