"use client";

import { createContext, useCallback, useContext, useMemo, useSyncExternalStore, type ReactNode } from "react";
import { storage } from "@/lib/storage";
import type { ThemeMode } from "@/types";

interface ThemeContextValue {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);
const listeners = new Set<() => void>();

const subscribe = (cb: () => void) => { listeners.add(cb); return () => { listeners.delete(cb); }; };
// The inline init script already set data-theme before hydration; the server snapshot only
// has to match the server HTML, and React reconciles to the real value afterwards.
const getSnapshot = (): ThemeMode =>
  document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
const getServerSnapshot = (): ThemeMode => "dark";

export function ThemeProvider({ children }: { children: ReactNode }) {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setTheme = useCallback((next: ThemeMode) => {
    const root = document.documentElement;
    root.setAttribute("data-theme", next);
    root.classList.toggle("dark", next === "dark");
    listeners.forEach((fn) => fn());
    void storage.update("settings", (s) => ({ ...s, theme: next }));
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, setTheme, toggleTheme: () => setTheme(theme === "dark" ? "light" : "dark") }),
    [theme, setTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside ThemeProvider");
  return ctx;
}
