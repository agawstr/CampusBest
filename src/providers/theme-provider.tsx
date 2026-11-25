"use client";

import { createContext, useCallback, useContext, useMemo, useSyncExternalStore, type ReactNode } from "react";
import { storage } from "@/lib/storage";
import type { AccentPreset, ThemeMode } from "@/types";

interface ThemeContextValue {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
  accent: AccentPreset;
  setAccent: (accent: AccentPreset) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);
const listeners = new Set<() => void>();

const subscribe = (cb: () => void) => { listeners.add(cb); return () => { listeners.delete(cb); }; };
// The inline init script already set data-theme/data-accent before hydration; the server snapshot only
// has to match the server HTML, and React reconciles to the real value afterwards.
const getSnapshot = (): ThemeMode =>
  document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
const getServerSnapshot = (): ThemeMode => "dark";

const getAccentSnapshot = (): AccentPreset => {
  const a = document.documentElement.getAttribute("data-accent");
  return a === "ice" || a === "mint" || a === "violet" ? a : "silver";
};
const getAccentServerSnapshot = (): AccentPreset => "silver";

export function ThemeProvider({ children }: { children: ReactNode }) {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const accent = useSyncExternalStore(subscribe, getAccentSnapshot, getAccentServerSnapshot);

  const setTheme = useCallback((next: ThemeMode) => {
    const root = document.documentElement;
    root.setAttribute("data-theme", next);
    root.classList.toggle("dark", next === "dark");
    listeners.forEach((fn) => fn());
    void storage.update("settings", (s) => ({ ...s, theme: next }));
  }, []);

  const setAccent = useCallback((next: AccentPreset) => {
    document.documentElement.setAttribute("data-accent", next);
    listeners.forEach((fn) => fn());
    void storage.update("settings", (s) => ({ ...s, accent: next }));
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, setTheme, toggleTheme: () => setTheme(theme === "dark" ? "light" : "dark"), accent, setAccent }),
    [theme, setTheme, accent, setAccent],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside ThemeProvider");
  return ctx;
}
