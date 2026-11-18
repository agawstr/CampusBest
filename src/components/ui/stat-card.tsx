import type { LucideIcon } from "lucide-react";
import { Card } from "./card";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string | number;
  hint?: string;
  icon: LucideIcon;
  delay?: number;
  /** "danger" colours the value and icon; the number itself decides when to use it. */
  tone?: "default" | "danger";
  /** For three-across layouts on phones: smaller padding, no icon, hint only for screen readers. */
  dense?: boolean;
}

/** A headline number. */
export function StatCard({ label, value, hint, icon: Icon, delay, tone = "default", dense = false }: StatCardProps) {
  const danger = tone === "danger";
  return (
    <Card delay={delay} className={cn("flex flex-col justify-between gap-3", dense ? "p-3.5 sm:p-5" : "p-5")}>
      <div className="flex items-start justify-between gap-2">
        <p className={cn("eyebrow", dense && "min-h-[2.1em] text-[10px] leading-tight tracking-[0.06em] sm:min-h-0 sm:text-[11px] sm:tracking-[0.08em]")}>{label}</p>
        <span className={cn("h-10 w-10 shrink-0 place-items-center rounded-control", dense ? "hidden sm:grid" : "grid", danger ? "bg-danger/15 text-danger" : "icon-chip text-accent")}>
          <Icon className="h-5 w-5" aria-hidden />
        </span>
      </div>
      <div className="min-w-0">
        <p className={cn("font-bold leading-none tabular-nums tracking-tight", dense ? "text-[2rem] sm:text-[2.5rem]" : String(value).length > 6 ? "text-[1.6rem] sm:text-[1.75rem]" : "text-[2.25rem] sm:text-[2.5rem]", danger ? "text-danger" : "text-silver")}>{value}</p>
        {hint && <p className={cn("text-xs text-muted", dense ? "max-sm:sr-only sm:mt-2" : "mt-2")}>{hint}</p>}
      </div>
    </Card>
  );
}

export interface CompactStat {
  label: string;
  value: string | number;
  hint?: string;
  icon: LucideIcon;
}

/** The three secondary numbers as one quiet strip, so the headline cards stay the focus. */
export function CompactStats({ items, delay }: { items: CompactStat[]; delay?: number }) {
  return (
    <Card delay={delay} className="p-0">
      <dl className="grid grid-cols-3 divide-x divide-fg/10">
        {items.map(({ label, value, hint, icon: Icon }) => (
          <div key={label} title={hint} className="grid min-w-0 grid-cols-1 items-center px-3 py-3 sm:grid-cols-[auto_minmax(0,1fr)] sm:gap-x-3 sm:px-5 sm:py-3.5">
            <Icon className="hidden h-4 w-4 shrink-0 text-muted sm:row-span-2 sm:block" aria-hidden />
            <dt className="eyebrow text-[10px] leading-tight tracking-[0.05em] sm:truncate sm:text-[11px] sm:tracking-[0.08em]">{label}</dt>
            <dd className="mt-0.5 text-xl font-semibold tabular-nums leading-none sm:text-2xl">{value}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}
