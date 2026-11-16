"use client";

import { Moon, Sun } from "lucide-react";
import { Card } from "@/components/ui/card";
import { SegmentedControl } from "@/components/ui/field";
import { useStorage } from "@/hooks/use-storage";
import { saveWeekStartsOn, weekStartFromValue, weekStartToValue, WEEK_START_OPTIONS } from "@/lib/settings";
import { cn } from "@/lib/utils";
import { useTheme } from "@/providers/theme-provider";
import { useToast } from "@/providers/toast-provider";

const THEMES = [
  { value: "dark", label: "Gelap", icon: Moon },
  { value: "light", label: "Terang", icon: Sun },
] as const;

/** Theme (unchanged behaviour: ThemeProvider saves it) and the week start used by Schedule, Calendar, Statistics. */
export function AppearanceCard() {
  const { theme, setTheme } = useTheme();
  const { toast } = useToast();
  const settings = useStorage("settings");

  return (
    <Card>
      <h2 className="text-base font-semibold">Tampilan</h2>
      <p className="mt-1 text-sm text-muted">Pilihanmu tersimpan dan dipakai lagi saat halaman dibuka ulang.</p>

      <h3 className="mt-4 text-sm font-medium">Tema</h3>
      <div className="mt-2 grid grid-cols-2 gap-2" role="radiogroup" aria-label="Tema">
        {THEMES.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={theme === value}
            onClick={() => setTheme(value)}
            className={cn(
              "flex h-12 items-center justify-center gap-2 rounded-control border text-sm font-semibold transition-colors duration-fast",
              theme === value ? "border-accent/50 bg-accent/15 text-accent" : "border-fg/10 text-muted hover:text-fg",
            )}
          >
            <Icon className="h-4 w-4" aria-hidden /> {label}
          </button>
        ))}
      </div>

      <h3 className="mt-5 text-sm font-medium">Minggu dimulai hari</h3>
      <p className="mt-0.5 text-xs text-muted">Dipakai di Jadwal, Kalender, dan Statistics.</p>
      <div className="mt-2 max-w-xs">
        <SegmentedControl
          label="Minggu dimulai hari"
          value={weekStartToValue(settings.data.weekStartsOn)}
          options={WEEK_START_OPTIONS}
          onChange={async (v) => {
            try { await saveWeekStartsOn(weekStartFromValue(v)); }
            catch { toast({ title: "Gagal menyimpan", description: "Penyimpanan browser tidak bisa diakses. Coba lagi ya.", variant: "error" }); }
          }}
        />
      </div>
    </Card>
  );
}
