"use client";

import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/providers/theme-provider";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const next = theme === "dark" ? "terang" : "gelap";
  return (
    <Button variant="secondary" size="icon" onClick={toggleTheme} aria-label={`Ganti ke mode ${next}`} title={`Mode ${next}`}>
      {/* Both icons render; CSS shows the right one, so SSR and client markup always match. */}
      <Sun className="hidden h-[18px] w-[18px] [[data-theme=dark]_&]:block" aria-hidden />
      <Moon className="block h-[18px] w-[18px] [[data-theme=dark]_&]:hidden" aria-hidden />
    </Button>
  );
}
