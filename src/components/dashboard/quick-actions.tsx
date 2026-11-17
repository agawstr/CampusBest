import Link from "next/link";
import { CalendarClock, CalendarDays, ClipboardCheck, ListChecks, NotebookPen, type LucideIcon } from "lucide-react";
import { QUICK_ACTIONS, type QuickActionKey } from "@/lib/quick-actions";

const ICONS: Record<QuickActionKey, LucideIcon> = {
  task: ListChecks,
  schedule: CalendarClock,
  event: ClipboardCheck,
  note: NotebookPen,
  calendar: CalendarDays,
};

export function QuickActions() {
  return (
    <nav aria-label="Aksi cepat" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {QUICK_ACTIONS.map((action) => {
        const Icon = ICONS[action.key];
        return (
          <Link
            key={action.key}
            href={action.href}
            className="glass-item flex items-center last:odd:col-span-2 sm:last:odd:col-span-1 gap-3 rounded-card p-3.5 shadow-soft transition-colors duration-fast hover:bg-fg/[0.06] sm:p-4"
          >
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-control bg-accent/15 text-accent">
              <Icon className="h-5 w-5" aria-hidden />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold leading-tight">{action.label}</span>
              <span className="mt-0.5 hidden text-xs text-muted sm:block">{action.hint}</span>
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
