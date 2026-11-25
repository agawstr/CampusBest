import { EVENT_CATEGORY_LABELS, getTaskDeadline, isTaskDone } from "@/lib/domain";
import { todayKey } from "@/lib/date";
import type { Activity, CampusEvent, ScheduleItem, Subject, Task } from "@/types";

const ICS_DAYS = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"] as const;

function escapeIcs(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

function fmtDate(dateKey: string): string {
  return dateKey.replace(/-/g, "");
}

function fmtDateTime(dateKey: string, time: string): string {
  const [h = "00", m = "00"] = time.split(":");
  return `${fmtDate(dateKey)}T${h.padStart(2, "0")}${m.padStart(2, "0")}00`;
}

function addMinutes(time: string, mins: number): string {
  const [h = 0, m = 0] = time.split(":").map(Number);
  const total = Math.min(23 * 60 + 59, h * 60 + m + mins);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function nextDateForWeekday(dayOfWeek: number, fromKey: string): string {
  const [y, m, d] = fromKey.split("-").map(Number);
  const dt = new Date(y, (m ?? 1) - 1, d ?? 1);
  const diff = (dayOfWeek - dt.getDay() + 7) % 7;
  dt.setDate(dt.getDate() + diff);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

export interface IcsExportInput {
  schedules: readonly ScheduleItem[];
  tasks: readonly Task[];
  events: readonly CampusEvent[];
  subjects: readonly Subject[];
  activities: readonly Activity[];
}

export function buildCalendarIcs({ schedules, tasks, events, subjects, activities }: IcsExportInput): { content: string; count: number } {
  const subjectsById = new Map(subjects.map((s) => [s.id, s]));
  const today = todayKey();
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//CampusBest//Calendar Export//ID",
    "CALSCALE:GREGORIAN",
    "X-WR-CALNAME:CampusBest",
  ];
  let count = 0;

  for (const s of schedules) {
    const startKey = s.recurrence === "weekly" ? nextDateForWeekday(s.dayOfWeek, today) : s.date;
    if (!startKey) continue;
    const subj = subjectsById.get(s.subjectId);
    const title = subj ? subj.name : "Kuliah";
    lines.push(
      "BEGIN:VEVENT",
      `UID:schedule-${s.id}@campusbest`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${fmtDateTime(startKey, s.startTime)}`,
      `DTEND:${fmtDateTime(startKey, s.endTime)}`,
      `SUMMARY:${escapeIcs(title)}`,
    );
    if (s.room || s.mode === "online") {
      lines.push(`LOCATION:${escapeIcs(s.mode === "online" ? (s.room ? `Online · ${s.room}` : "Online") : s.room ?? "")}`);
    }
    if (s.recurrence === "weekly") {
      lines.push(`RRULE:FREQ=WEEKLY;BYDAY=${ICS_DAYS[s.dayOfWeek]}`);
    } else if (s.recurrence === "biweekly") {
      lines.push(`RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=${ICS_DAYS[s.dayOfWeek]}`);
    }
    lines.push("END:VEVENT");
    count++;
  }

  for (const a of activities) {
    const startKey = a.recurrence === "weekly" ? nextDateForWeekday(a.dayOfWeek, today) : a.date;
    if (!startKey) continue;
    const endTime = a.endTime || addMinutes(a.startTime, 60);
    lines.push(
      "BEGIN:VEVENT",
      `UID:activity-${a.id}@campusbest`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${fmtDateTime(startKey, a.startTime)}`,
      `DTEND:${fmtDateTime(startKey, endTime)}`,
      `SUMMARY:${escapeIcs(a.title)}`,
    );
    if (a.location) lines.push(`LOCATION:${escapeIcs(a.location)}`);
    if (a.notes) lines.push(`DESCRIPTION:${escapeIcs(a.notes)}`);
    if (a.recurrence === "weekly") {
      lines.push(`RRULE:FREQ=WEEKLY;BYDAY=${ICS_DAYS[a.dayOfWeek]}`);
    } else if (a.recurrence === "biweekly") {
      lines.push(`RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=${ICS_DAYS[a.dayOfWeek]}`);
    }
    lines.push("END:VEVENT");
    count++;
  }

  for (const e of events) {
    if (!e.date) continue;
    const cat = EVENT_CATEGORY_LABELS[e.category] ?? "Event";
    lines.push("BEGIN:VEVENT", `UID:event-${e.id}@campusbest`, `DTSTAMP:${stamp}`);
    if (e.startTime) {
      lines.push(`DTSTART:${fmtDateTime(e.date, e.startTime)}`);
      lines.push(`DTEND:${fmtDateTime(e.date, e.endTime || addMinutes(e.startTime, 60))}`);
    } else {
      lines.push(`DTSTART;VALUE=DATE:${fmtDate(e.date)}`);
    }
    lines.push(`SUMMARY:${escapeIcs(`[${cat}] ${e.title}`)}`);
    if (e.location) lines.push(`LOCATION:${escapeIcs(e.location)}`);
    if (e.description) lines.push(`DESCRIPTION:${escapeIcs(e.description)}`);
    lines.push("END:VEVENT");
    count++;
  }

  for (const t of tasks) {
    if (isTaskDone(t)) continue;
    const dl = getTaskDeadline(t);
    if (!dl) continue;
    const subj = t.subjectId ? subjectsById.get(t.subjectId) : undefined;
    lines.push("BEGIN:VEVENT", `UID:task-${t.id}@campusbest`, `DTSTAMP:${stamp}`);
    if (t.deadlineTime) {
      lines.push(`DTSTART:${fmtDateTime(dl, t.deadlineTime)}`);
      lines.push(`DTEND:${fmtDateTime(dl, addMinutes(t.deadlineTime, 30))}`);
    } else {
      lines.push(`DTSTART;VALUE=DATE:${fmtDate(dl)}`);
    }
    lines.push(`SUMMARY:${escapeIcs(`Deadline: ${t.title}${subj ? ` (${subj.name})` : ""}`)}`);
    if (t.description) lines.push(`DESCRIPTION:${escapeIcs(t.description)}`);
    lines.push("END:VEVENT");
    count++;
  }

  lines.push("END:VCALENDAR");
  return { content: `${lines.join("\r\n")}\r\n`, count };
}
