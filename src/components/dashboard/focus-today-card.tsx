import { Card } from "@/components/ui/card";
import { formatMinutes, type FocusToday } from "@/lib/focus";
import { SectionHeader } from "./section-header";

/** Today's focus time and finished sessions. Read-only; the timer itself lives on /focus. */
export function FocusTodayCard({ focus }: { focus: FocusToday }) {
  return (
    <Card animate={false}>
      <SectionHeader title="Fokus hari ini" href="/focus" linkLabel="Buka" />
      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="eyebrow">Waktu fokus</dt>
          <dd className="mt-0.5 text-xl font-semibold tabular-nums">{formatMinutes(focus.minutes)}</dd>
        </div>
        <div>
          <dt className="eyebrow">Sesi selesai</dt>
          <dd className="mt-0.5 text-xl font-semibold tabular-nums">{focus.completed}</dd>
        </div>
      </dl>
      {focus.sessions === 0 && <p className="mt-3 text-sm text-muted">Belum ada sesi hari ini. Mulai dari halaman Focus.</p>}
    </Card>
  );
}
