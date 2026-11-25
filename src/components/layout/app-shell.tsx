import type { ReactNode } from "react";
import { AppBackdrop } from "./app-backdrop";
import { Header } from "./header";
import { MobileBottomNavigation } from "./mobile-bottom-navigation";
import { Sidebar } from "./sidebar";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-dvh overflow-x-clip">
      <AppBackdrop />
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header />
        {/* Bottom padding clears the floating pill nav + safe area on mobile. */}
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-[calc(7.5rem+env(safe-area-inset-bottom))] pt-2 md:px-8 md:pb-12">
          {children}
        </main>
      </div>
      <MobileBottomNavigation />
    </div>
  );
}
