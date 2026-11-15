/**
 * Quick actions on the dashboard. "Add" actions open the existing form modal of the target page
 * (Tasks, Schedule, Exams) via `?tambah=1`, so there is no second copy of any form or save logic.
 */
export const ADD_PARAM = "tambah";

export type QuickActionKey = "task" | "schedule" | "event" | "calendar";

export interface QuickAction {
  key: QuickActionKey;
  label: string;
  hint: string;
  href: string;
}

export const QUICK_ACTIONS: readonly QuickAction[] = [
  { key: "task", label: "Tambah tugas", hint: "Catat tugas baru", href: `/tasks?${ADD_PARAM}=1` },
  { key: "schedule", label: "Tambah jadwal", hint: "Atur jadwal kuliah", href: `/schedule?${ADD_PARAM}=1` },
  { key: "event", label: "Tambah event", hint: "UTS, quiz, seminar", href: `/exams?${ADD_PARAM}=1` },
  { key: "calendar", label: "Lihat kalender", hint: "Semua agenda", href: "/calendar" },
];

/** `search` is a location.search string such as "?tambah=1&x=2". */
export function wantsAdd(search: string): boolean {
  return new URLSearchParams(search).has(ADD_PARAM);
}

/** The same query string without the add flag ("" when nothing else is left), so a refresh doesn't reopen the form. */
export function withoutAddParam(search: string): string {
  const params = new URLSearchParams(search);
  params.delete(ADD_PARAM);
  const rest = params.toString();
  return rest ? `?${rest}` : "";
}
