import { GraduationCap } from "lucide-react";
import { APP_NAME } from "@/lib/brand";
import { cn } from "@/lib/utils";

export function Logo({ showText = true, className }: { showText?: boolean; className?: string }) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[14px] bg-gradient-to-br from-accent to-muted text-accent-fg shadow-glow">
        <GraduationCap className="h-5 w-5" aria-hidden />
      </span>
      {showText && <span className="text-[17px] font-bold tracking-tight">{APP_NAME}</span>}
    </div>
  );
}
