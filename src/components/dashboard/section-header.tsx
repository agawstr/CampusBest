import Link from "next/link";
import { ChevronRight } from "lucide-react";

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  href?: string;
  linkLabel?: string;
  /** "hero" is the larger heading used once per screen. */
  size?: "default" | "hero";
}

export function SectionHeader({ title, subtitle, href, linkLabel, size = "default" }: SectionHeaderProps) {
  return (
    <div className={size === "hero" ? "mb-4 flex items-start justify-between gap-3 md:mb-5" : "mb-3 flex items-start justify-between gap-3"}>
      <div className="min-w-0">
        <h2 className={size === "hero" ? "text-silver text-xl font-bold tracking-tight md:text-2xl" : "text-[0.95rem] font-semibold tracking-tight"}>{title}</h2>
        {subtitle && <p className={size === "hero" ? "mt-1 text-sm text-muted" : "mt-0.5 text-xs text-muted"}>{subtitle}</p>}
      </div>
      {href && linkLabel && (
        <Link href={href} className="flex shrink-0 items-center gap-0.5 rounded-lg px-1 py-0.5 text-sm font-medium text-muted transition-colors duration-fast hover:text-fg">
          {linkLabel}
          <ChevronRight className="h-4 w-4" aria-hidden />
        </Link>
      )}
    </div>
  );
}
