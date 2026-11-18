import { Card } from "@/components/ui/card";
import type { TaskProgress } from "@/lib/dashboard";
import { SectionHeader } from "./section-header";

export function TaskProgressCard({ progress }: { progress: TaskProgress }) {
  const { total, done, open, overdue, percent } = progress;
  return (
    <Card animate={false}>
      <SectionHeader title="Progres tugas" href="/tasks" linkLabel="Buka" />
      {total === 0 ? (
        <p className="py-4 text-sm text-muted">Belum ada tugas. Progresnya mulai kelihatan setelah kamu menambahkan tugas.</p>
      ) : (
        <>
          <div className="flex items-end justify-between gap-3">
            <p className="text-silver text-5xl font-bold tabular-nums leading-none tracking-tight">{percent}%</p>
            <p className="pb-1 text-sm text-muted">selesai</p>
          </div>
          <div
            className="mt-4 h-2.5 overflow-hidden rounded-full bg-fg/10 shadow-[inset_0_1px_2px_rgb(0_0_0/0.35)]"
            role="progressbar"
            aria-label="Persentase tugas selesai"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
          >
            <div className="h-full rounded-full bg-gradient-to-r from-accent/60 to-accent shadow-[0_0_12px_-2px_rgb(var(--accent)/0.5)] transition-[width] duration-slow" style={{ width: `${percent}%` }} />
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="eyebrow">Selesai</dt>
              <dd className="mt-0.5 text-xl font-semibold tabular-nums">{done}</dd>
            </div>
            <div>
              <dt className="eyebrow">Belum selesai</dt>
              <dd className="mt-0.5 text-xl font-semibold tabular-nums">{open}</dd>
            </div>
          </dl>
          {overdue > 0 && <p className="mt-3 text-sm font-medium text-danger">{overdue} tugas sudah lewat deadline</p>}
        </>
      )}
    </Card>
  );
}
