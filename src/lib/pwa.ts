import type { MetadataRoute } from "next";
import { APP_DESCRIPTION, APP_NAME } from "./brand";

/** Keep in sync with package.json and public/sw.js (scripts/batch10-logic-check.ts verifies all three). */
export const APP_VERSION = "0.11.0";

export const SW_URL = "/sw.js";
export const SW_SCOPE = "/";
export const OFFLINE_URL = "/offline.html";
export const THEME_COLOR = "#0B1020";
export const BACKGROUND_COLOR = "#0B1020";
export const START_URL = "/dashboard";

export function buildManifest(): MetadataRoute.Manifest {
  return {
    name: APP_NAME,
    short_name: APP_NAME,
    description: APP_DESCRIPTION,
    lang: "id",
    start_url: START_URL,
    scope: "/",
    display: "standalone",
    orientation: "any",
    theme_color: THEME_COLOR,
    background_color: BACKGROUND_COLOR,
    categories: ["education", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Tugas", url: "/tasks", icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }] },
      { name: "Jadwal", url: "/schedule", icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }] },
      { name: "Fokus", url: "/focus", icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }] },
    ],
  };
}

export type InstallMode = "installed" | "prompt" | "ios" | "manual";

export interface InstallEnv {
  userAgent: string;
  platform?: string;
  maxTouchPoints?: number;
  /** display-mode: standalone matches, or navigator.standalone === true (iOS). */
  standalone: boolean;
  /** A `beforeinstallprompt` event was captured (Chromium: Chrome/Edge/Samsung Internet, Android and desktop). */
  hasPromptEvent: boolean;
}

export function isIosDevice(env: Pick<InstallEnv, "userAgent" | "platform" | "maxTouchPoints">): boolean {
  if (/iPhone|iPad|iPod/i.test(env.userAgent)) return true;
  // iPadOS 13+ reports itself as a Mac but has a touch screen.
  return env.platform === "MacIntel" && (env.maxTouchPoints ?? 0) > 1;
}

/**
 * How the install flow should look. Support differs per browser: only Chromium-based browsers
 * fire `beforeinstallprompt`; iOS Safari has no prompt (Share > Add to Home Screen); Firefox
 * desktop and others may offer nothing, so we say "manual" instead of promising a button.
 */
export function installMode(env: InstallEnv): InstallMode {
  if (env.standalone) return "installed";
  if (env.hasPromptEvent) return "prompt";
  if (isIosDevice(env)) return "ios";
  return "manual";
}

export const IOS_INSTALL_STEPS = [
  "Buka CampusBest di Safari (bukan di dalam aplikasi lain).",
  "Ketuk tombol Bagikan (ikon kotak dengan panah ke atas).",
  "Pilih \"Tambah ke Layar Utama\", lalu ketuk Tambah.",
] as const;

export const MANUAL_INSTALL_HINT =
  "Browser ini tidak menyediakan tombol pasang otomatis. Cari opsi \"Pasang aplikasi\" atau \"Tambahkan ke layar utama\" di menu browser. Kalau tidak ada, browser ini kemungkinan belum mendukungnya.";

export interface OfflineCapability { feature: string; offline: boolean; note: string }

/**
 * What the app promises offline. "offline: true" only for what the design guarantees AFTER the page
 * has been opened once online; real-device verification is still pending (see docs/PROGRESS.md).
 */
export const OFFLINE_CAPABILITIES: OfflineCapability[] = [
  { feature: "Tasks, Subjects, Schedule, Calendar, Exams", offline: true, note: "Data ada di perangkat. Halaman harus pernah dibuka saat online." },
  { feature: "Notes dan Focus Timer", offline: true, note: "Tersimpan di perangkat; timer dihitung dari waktu, bukan dari koneksi." },
  { feature: "Import (tempel teks Classroom, BRONE, SIAM)", offline: true, note: "Teks ditempel manual, tidak ada permintaan jaringan." },
  { feature: "Halaman yang belum pernah dibuka", offline: false, note: "Butuh koneksi sekali untuk memuat." },
  { feature: "Pembaruan aplikasi dan font baru", offline: false, note: "Butuh koneksi." },
];

/** Whether the service worker should be registered at all (never in dev, where chunks change constantly). */
export function shouldRegisterServiceWorker(env: { nodeEnv: string | undefined; hasServiceWorker: boolean; secure: boolean }): boolean {
  return env.nodeEnv === "production" && env.hasServiceWorker && env.secure;
}
