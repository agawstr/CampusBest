import { cn } from "@/lib/utils";

const RADIUS = 88;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

interface TimerRingProps {
  /** 0 (just started) to 1 (done). */
  progress: number;
  /** "25:00" */
  clock: string;
  caption: string;
  tone: "accent" | "success";
  active: boolean;
  /** Spoken description of the progress, e.g. "Fokus, 40 persen". */
  label: string;
}

/** The timer face. The ring is decoration plus a progressbar for screen readers; the digits are the timer. */
export function TimerRing({ progress, clock, caption, tone, active, label }: TimerRingProps) {
  const pct = Math.round(progress * 100);
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[300px]">
      <svg viewBox="0 0 200 200" className="h-full w-full -rotate-90" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
        <circle cx="100" cy="100" r={RADIUS} fill="none" strokeWidth="10" className="stroke-fg/10" />
        <circle
          cx="100" cy="100" r={RADIUS} fill="none" strokeWidth="10" strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={CIRCUMFERENCE * (1 - progress)}
          className={cn("transition-[stroke-dashoffset] duration-slow ease-linear motion-reduce:transition-none", tone === "accent" ? "stroke-accent" : "stroke-success", !active && progress === 0 && "opacity-0")}
        />
      </svg>
      <div className="glass-item absolute inset-[11%] rounded-full" aria-hidden />
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <p role="timer" className="text-silver text-[3.25rem] font-bold leading-none tabular-nums tracking-tight sm:text-7xl">{clock}</p>
        <p className="mt-2 text-sm text-muted">{caption}</p>
      </div>
    </div>
  );
}
