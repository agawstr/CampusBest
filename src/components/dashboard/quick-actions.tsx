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

/** Secondary shortcuts: a quiet row of pills under the headline numbers (the hint shows as a tooltip). */
export function QuickActions() {
  return (
    <nav aria-label="Aksi cepat" className="mt-6">
      <p className="eyebrow mb-2.5" aria-hidden>Aksi cepat</p>
      <div className="flex flex-wrap gap-2">
        {QUICK_ACTIONS.map((action) => {
          const Icon = ICONS[action.key];
          return (
            <Link
              key={action.key}
              href={action.href}
              title={action.hint}
              className="glass-item inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-medium text-fg/90 transition-colors duration-fast hover:bg-fg/10 hover:text-fg"
            >
              <Icon className="h-4 w-4 shrink-0 text-muted" aria-hidden />
              {action.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
