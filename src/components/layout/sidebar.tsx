"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useStorage } from "@/hooks/use-storage";
import { APP_NAME, APP_TAGLINE } from "@/lib/brand";
import { NAV_ITEMS, isActivePath } from "@/lib/navigation";
import { spring } from "@/lib/tokens";
import { cn } from "@/lib/utils";
import { Logo } from "./logo";

/**
 * md–lg (tablet): compact icon rail. lg+: full sidebar, collapsible by the user.
 * Collapsed state is stored in campusbest_settings.
 */
export function Sidebar() {
  const pathname = usePathname();
  const { data: settings, update } = useStorage("settings");
  const collapsed = settings.sidebarCollapsed;

  return (
    <aside
      className={cn(
        "glass glass-plain sticky top-0 z-40 hidden h-dvh shrink-0 flex-col border-y-0 border-l-0 px-3 py-5 transition-[width] duration-base ease-smooth md:flex",
        collapsed ? "w-[84px]" : "w-[84px] lg:w-[272px]",
      )}
    >
      <Link href="/dashboard" className={cn("mb-8 rounded-control px-1.5", collapsed ? "mx-auto" : "lg:px-2")} aria-label={APP_NAME}>
        <Logo showText={false} className={cn(!collapsed && "lg:hidden")} />
        {!collapsed && <Logo className="hidden lg:flex" />}
      </Link>

      <nav aria-label="Navigasi utama" className="flex flex-1 flex-col gap-1">
        {NAV_ITEMS.map(({ key, href, label, icon: Icon }) => {
          const active = isActivePath(pathname, href);
          return (
            <Link
              key={key}
              href={href}
              title={label}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex h-11 items-center gap-3 rounded-control px-3.5 text-sm font-medium transition-colors duration-fast",
                active ? "text-accent" : "text-muted hover:bg-fg/[0.06] hover:text-fg",
                collapsed && "justify-center px-0",
                !collapsed && "justify-center lg:justify-start lg:px-3.5",
              )}
            >
              {active && (
                <motion.span
                  layoutId="sidebar-active"
                  transition={spring}
                  className="nav-pill absolute inset-0 rounded-control"
                />
              )}
              <Icon className="relative h-5 w-5 shrink-0" aria-hidden />
              <span className={cn("relative", collapsed ? "hidden" : "hidden lg:inline")}>{label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-4 space-y-3">
        {!collapsed && (
          <p className="hidden px-2 text-xs leading-relaxed text-muted lg:block">{APP_TAGLINE}</p>
        )}
        <button
          onClick={() => update((s) => ({ ...s, sidebarCollapsed: !s.sidebarCollapsed }))}
          aria-label={collapsed ? "Perluas sidebar" : "Ciutkan sidebar"}
          className="hidden h-10 w-full items-center justify-center gap-2 rounded-control text-sm text-muted transition-colors hover:bg-fg/[0.06] hover:text-fg lg:flex"
        >
          {collapsed ? <PanelLeftOpen className="h-5 w-5" /> : <><PanelLeftClose className="h-5 w-5" /><span>Ciutkan</span></>}
        </button>
      </div>
    </aside>
  );
}
