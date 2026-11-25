"use client";

import { useStorage } from "@/hooks/use-storage";

/**
 * Renders either the breathing Liquid Glass ambient glow (default) or the user's
 * custom gallery wallpaper with an adjustable readability dim scrim.
 */
export function AppBackdrop() {
  const { data: settings } = useStorage("settings");
  const wallpaper = settings.wallpaper;
  const dim = settings.wallpaperDim ?? 0.52;

  if (wallpaper) {
    const safeDim = Math.min(0.85, Math.max(0.2, dim));
    return (
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden>
        <div
          className="absolute inset-0 bg-cover bg-center transition-opacity duration-slow ease-smooth"
          style={{ backgroundImage: `url("${wallpaper}")` }}
        />
        <div
          className="absolute inset-0 bg-bg"
          style={{ opacity: `var(--wallpaper-dim, ${safeDim})` }}
        />
      </div>
    );
  }

  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden>
      <div className="app-backdrop ambient-breathe absolute -inset-[8%]" />
    </div>
  );
}
