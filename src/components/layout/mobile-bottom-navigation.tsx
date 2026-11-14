"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { Ellipsis } from "lucide-react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { APP_NAME } from "@/lib/brand";
import { PRIMARY_NAV, SECONDARY_NAV, isActivePath } from "@/lib/navigation";
import { spring } from "@/lib/tokens";
import { cn } from "@/lib/utils";

const itemClass = "relative flex h-14 flex-1 flex-col items-center justify-center gap-0.5 rounded-full text-[11px] font-medium transition-colors duration-fast";

export function MobileBottomNavigation() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreActive = SECONDARY_NAV.some((i) => isActivePath(pathname, i.href));

  const Indicator = () => (
    <motion.span layoutId="mobile-active" transition={spring} className="absolute inset-0 rounded-full bg-accent/16 ring-1 ring-accent/30" />
  );

  return (
    <>
      <nav
        aria-label="Navigasi utama"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-4 md:hidden"
        style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
      >
        <div className="glass pointer-events-auto mx-auto flex max-w-md items-center gap-1 rounded-full p-1.5 shadow-float">
          {PRIMARY_NAV.map(({ key, href, label, icon: Icon }) => {
            const active = isActivePath(pathname, href);
            return (
              <Link key={key} href={href} aria-current={active ? "page" : undefined} className={cn(itemClass, active ? "text-accent" : "text-muted")}>
                {active && <Indicator />}
                <Icon className="relative h-5 w-5" aria-hidden />
                <span className="relative">{label}</span>
              </Link>
            );
          })}
          <button onClick={() => setMoreOpen(true)} aria-haspopup="dialog" className={cn(itemClass, moreActive ? "text-accent" : "text-muted")}>
            {moreActive && <Indicator />}
            <Ellipsis className="relative h-5 w-5" aria-hidden />
            <span className="relative">More</span>
          </button>
        </div>
      </nav>

      <BottomSheet open={moreOpen} onOpenChange={setMoreOpen} title="More" description={`Halaman lainnya di ${APP_NAME}.`}>
        <div className="grid grid-cols-3 gap-3">
          {SECONDARY_NAV.map(({ key, href, label, icon: Icon }) => {
            const active = isActivePath(pathname, href);
            return (
              <Link
                key={key}
                href={href}
                onClick={() => setMoreOpen(false)}
                className={cn(
                  "flex flex-col items-center gap-2 rounded-card border border-fg/10 px-2 py-4 text-sm font-medium transition-colors",
                  active ? "bg-accent/14 text-accent" : "bg-fg/[0.04] text-fg hover:bg-fg/[0.08]",
                )}
              >
                <Icon className="h-6 w-6" aria-hidden />
                {label}
              </Link>
            );
          })}
        </div>
      </BottomSheet>
    </>
  );
}
