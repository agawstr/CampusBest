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
        <p className="eyebrow">{label}</p>
        <p className="text-silver mt-2 text-[2rem] font-bold leading-none tabular-nums tracking-tight">{value}</p>
        {hint && <p className="mt-1.5 text-xs text-muted">{hint}</p>}
      </div>
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-control icon-chip text-accent">
        <Icon className="h-5 w-5" aria-hidden />
      </span>
    </Card>
  );
}
