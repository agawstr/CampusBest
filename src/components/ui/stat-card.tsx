import type { LucideIcon } from "lucide-react";
import { Card } from "./card";

interface StatCardProps {
  label: string;
  value: string | number;
  hint?: string;
  icon: LucideIcon;
  delay?: number;
}

export function StatCard({ label, value, hint, icon: Icon, delay }: StatCardProps) {
  return (
    <Card delay={delay} className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm text-muted">{label}</p>
        <p className="mt-1.5 text-3xl font-bold tabular-nums tracking-tight">{value}</p>
        {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
      </div>
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-control bg-accent/15 text-accent">
        <Icon className="h-5 w-5" aria-hidden />
      </span>
    </Card>
  );
}
