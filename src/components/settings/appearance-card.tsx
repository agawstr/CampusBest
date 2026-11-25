"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { ImagePlus, Moon, Sun, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SegmentedControl } from "@/components/ui/field";
import { useStorage } from "@/hooks/use-storage";
import { colors } from "@/lib/tokens";
import { saveWeekStartsOn, weekStartFromValue, weekStartToValue, WEEK_START_OPTIONS } from "@/lib/settings";
import { compressWallpaperFile } from "@/lib/wallpaper";
import { cn } from "@/lib/utils";
import { useTheme } from "@/providers/theme-provider";
import { useToast } from "@/providers/toast-provider";

const THEMES = [
  { value: "dark", label: "Gelap", icon: Moon },
  { value: "light", label: "Terang", icon: Sun },
] as const;

const ACCENTS = [
  { value: "silver", label: "Silver", dot: "#E4E4EA" },
  { value: "ice", label: "Ice Blue", dot: "#93C5FD" },
  { value: "mint", label: "Mint", dot: "#6EE7B7" },
  { value: "violet", label: "Violet", dot: "#C4B5FD" },
] as const;

/** Theme (unchanged behaviour: ThemeProvider saves it) and the week start used by Schedule, Calendar, Statistics. */
export function AppearanceCard() {
  const { theme, setTheme, accent, setAccent } = useTheme();
  const { toast } = useToast();
  const settings = useStorage("settings");
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const wallpaper = settings.data.wallpaper;
  const wallpaperDim = settings.data.wallpaperDim ?? 0.52;

  async function handlePickWallpaper(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    try {
      const dataUrl = await compressWallpaperFile(file);
      await settings.update((s) => ({ ...s, wallpaper: dataUrl }));
      toast({ title: "Wallpaper dipasang", variant: "success" });
    } catch {
      toast({ title: "Gagal memasang wallpaper", description: "Pastikan file berupa gambar dan penyimpanan browser cukup.", variant: "error" });
    } finally {
      setUploading(false);
    }
  }

  async function handleRemoveWallpaper() {
    try {
      await settings.update((s) => {
        const { wallpaper: _drop, ...rest } = s;
        void _drop;
        return rest;
      });
      toast({ title: "Wallpaper dihapus" });
    } catch {
      toast({ title: "Gagal menghapus wallpaper", variant: "error" });
    }
  }

  return (
    <Card>
      <h2 className="text-[0.95rem] font-semibold tracking-tight">Tampilan</h2>
      <p className="mt-1 text-sm text-muted">Pilihanmu tersimpan dan dipakai lagi saat halaman dibuka ulang.</p>

      <h3 className="mt-4 text-sm font-medium">Tema</h3>
      <div className="mt-2 grid grid-cols-2 gap-2" role="radiogroup" aria-label="Tema">
        {THEMES.map(({ value, label, icon: Icon }) => {
          const c = colors[value];
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={theme === value}
              onClick={() => setTheme(value)}
              className={cn(
                "flex flex-col items-stretch gap-2 rounded-control border p-2 text-sm font-semibold transition-colors duration-fast",
                theme === value ? "border-accent/50 bg-accent/15 text-accent shadow-[0_0_20px_-8px_rgb(var(--accent)/0.5)]" : "border-fg/10 text-muted hover:text-fg",
              )}
            >
              <span className="block h-14 overflow-hidden rounded-lg border border-fg/10" style={{ background: c.bg }} aria-hidden>
                <span className="flex h-full gap-1.5 p-1.5">
                  <span className="w-1/4 rounded" style={{ background: c.surface }} />
                  <span className="flex flex-1 flex-col gap-1">
                    <span className="h-2 w-2/3 rounded-full" style={{ background: c.accent }} />
                    <span className="flex-1 rounded" style={{ background: c.card }} />
                  </span>
                </span>
              </span>
              <span className="flex items-center justify-center gap-2 pb-0.5"><Icon className="h-4 w-4" aria-hidden /> {label}</span>
            </button>
          );
        })}
      </div>

      <h3 className="mt-5 text-sm font-medium">Aksen warna</h3>
      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4" role="radiogroup" aria-label="Aksen warna">
        {ACCENTS.map((item) => {
          const active = accent === item.value;
          return (
            <button
              key={item.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setAccent(item.value)}
              className={cn(
                "flex items-center justify-center gap-2 rounded-control border px-3 py-2.5 text-sm font-medium transition-colors duration-fast",
                active ? "border-accent/50 bg-accent/15 text-accent" : "border-fg/10 text-muted hover:text-fg",
              )}
            >
              <span className="h-3 w-3 shrink-0 rounded-full border border-fg/20" style={{ backgroundColor: item.dot }} aria-hidden />
              {item.label}
            </button>
          );
        })}
      </div>

      <h3 className="mt-5 text-sm font-medium">Wallpaper latar</h3>
      <p className="mt-0.5 text-xs text-muted">Pilih foto dari galeri untuk efek kaca transparan di seluruh aplikasi (tersimpan lokal).</p>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => void handlePickWallpaper(e)}
      />
      <div className="mt-2.5 flex flex-wrap items-center gap-2.5">
        <Button variant="secondary" size="sm" disabled={uploading} onClick={() => fileRef.current?.click()}>
          <ImagePlus className="h-4 w-4" aria-hidden />
          {uploading ? "Memproses…" : wallpaper ? "Ganti wallpaper" : "Pilih dari galeri"}
        </Button>
        {wallpaper && (
          <Button variant="ghost" size="sm" className="hover:text-danger" onClick={() => void handleRemoveWallpaper()}>
            <Trash2 className="h-4 w-4" aria-hidden />
            Hapus
          </Button>
        )}
      </div>
      {wallpaper && (
        <div className="mt-3 space-y-2.5">
          <div className="relative h-24 w-full max-w-xs overflow-hidden rounded-control border border-fg/15">
            <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${wallpaper})` }} />
            <div className="absolute inset-0 bg-bg" style={{ opacity: wallpaperDim }} />
            <div className="relative flex h-full items-end p-2.5">
              <span className="glass rounded-lg px-2.5 py-1 text-xs font-medium">Pratinjau kaca</span>
            </div>
          </div>
          <label className="block max-w-xs">
            <span className="flex justify-between text-xs text-muted">
              <span>Kegelapan lapisan latar</span>
              <span className="tabular-nums">{Math.round(wallpaperDim * 100)}%</span>
            </span>
            <input
              type="range"
              min={25}
              max={85}
              step={5}
              value={Math.round(wallpaperDim * 100)}
              onChange={(e) => void settings.update((s) => ({ ...s, wallpaperDim: Number(e.target.value) / 100 }))}
              className="mt-1 w-full accent-[rgb(var(--accent))]"
            />
          </label>
        </div>
      )}

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
