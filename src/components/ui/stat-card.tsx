import { ChevronRight, type LucideIcon } from "lucide-react";
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
  /** Makes the card clickable to open a detail popup. */
  onClick?: () => void;
}

/** A headline number. */
export function StatCard({ label, value, hint, icon: Icon, delay, tone = "default", dense = false, onClick }: StatCardProps) {
  const danger = tone === "danger";
  const content = (
    <Card
      delay={delay}
      className={cn(
        "flex h-full flex-col justify-between gap-3",
        dense ? "p-3.5 sm:p-5" : "p-5",
        onClick && "transition-[border-color,transform] duration-fast ease-smooth group-hover:border-accent/40 group-active:scale-[0.985]",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className={cn("eyebrow", dense && "min-h-[2.1em] text-[10px] leading-tight tracking-[0.06em] sm:min-h-0 sm:text-[11px] sm:tracking-[0.08em]")}>{label}</p>
        <span className={cn("h-10 w-10 shrink-0 place-items-center rounded-control", dense ? "hidden sm:grid" : "grid", danger ? "bg-danger/15 text-danger" : "icon-chip text-accent")}>
          <Icon className="h-5 w-5" aria-hidden />
        </span>
      </div>
      <div className="min-w-0">
        <div className="flex items-end justify-between gap-1">
          <p className={cn("font-bold leading-none tabular-nums tracking-tight", dense ? "text-[2rem] sm:text-[2.5rem]" : String(value).length > 6 ? "text-[1.6rem] sm:text-[1.75rem]" : "text-[2.25rem] sm:text-[2.5rem]", danger ? "text-danger" : "text-silver")}>{value}</p>
          {onClick && <ChevronRight className="mb-0.5 h-4 w-4 shrink-0 text-muted transition-transform duration-fast group-hover:translate-x-0.5 group-hover:text-fg" aria-hidden />}
        </div>
        {hint && <p className={cn("text-xs text-muted", dense ? "max-sm:sr-only sm:mt-2" : "mt-2")}>{hint}</p>}
      </div>
    </Card>
  );

  if (!onClick) return content;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${label}: ${value}. Lihat daftar`}
      className="group block h-full w-full rounded-card text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70 focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
    >
      {content}
    </button>
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
