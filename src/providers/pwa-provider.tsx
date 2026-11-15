"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { WifiOff } from "lucide-react";
import { installMode, shouldRegisterServiceWorker, SW_SCOPE, SW_URL, type InstallMode } from "@/lib/pwa";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

interface PwaState {
  mode: InstallMode;
  online: boolean;
  updateReady: boolean;
  /** true once a service worker controls this page (offline shell is active). */
  offlineReady: boolean;
  promptInstall: () => Promise<"accepted" | "dismissed" | "unavailable">;
  applyUpdate: () => void;
}

const PwaContext = createContext<PwaState | null>(null);

export function usePwa(): PwaState {
  const ctx = useContext(PwaContext);
  if (!ctx) throw new Error("usePwa must be used inside <PwaProvider>");
  return ctx;
}

/**
 * Registers the service worker and exposes install/update/online state.
 * Touches no storage: the service worker only uses Cache Storage, and nothing here reads or writes app data.
 */
export function PwaProvider({ children }: { children: ReactNode }) {
  const [online, setOnline] = useState(true);
  const [updateReady, setUpdateReady] = useState(false);
  const [offlineReady, setOfflineReady] = useState(false);
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [standalone, setStandalone] = useState(false);
  const [env, setEnv] = useState({ userAgent: "", platform: "", maxTouchPoints: 0 });
  const waitingRef = useRef<ServiceWorker | null>(null);
  const reloadingRef = useRef(false);

  useEffect(() => {
    setOnline(navigator.onLine);
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    const mq = window.matchMedia("(display-mode: standalone)");
    const readStandalone = () => setStandalone(mq.matches || (navigator as Navigator & { standalone?: boolean }).standalone === true);
    readStandalone();
    mq.addEventListener?.("change", readStandalone);
    setEnv({ userAgent: navigator.userAgent, platform: navigator.platform, maxTouchPoints: navigator.maxTouchPoints });
    const onPrompt = (e: Event) => { e.preventDefault(); setPromptEvent(e as BeforeInstallPromptEvent); };
    const onInstalled = () => { setPromptEvent(null); readStandalone(); };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
      mq.removeEventListener?.("change", readStandalone);
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  useEffect(() => {
    if (!shouldRegisterServiceWorker({
      nodeEnv: process.env.NODE_ENV,
      hasServiceWorker: "serviceWorker" in navigator,
      secure: window.isSecureContext,
    })) return;

    let cancelled = false;
    const track = (reg: ServiceWorkerRegistration) => {
      const markWaiting = (sw: ServiceWorker | null) => {
        // A waiting worker while a controller exists = an update; on first install there is no controller yet.
        if (sw && navigator.serviceWorker.controller) { waitingRef.current = sw; setUpdateReady(true); }
      };
      markWaiting(reg.waiting);
      reg.addEventListener("updatefound", () => {
        const installing = reg.installing;
        if (!installing) return;
        installing.addEventListener("statechange", () => { if (installing.state === "installed") markWaiting(reg.waiting ?? installing); });
      });
    };

    const onControllerChange = () => {
      setOfflineReady(true);
      if (reloadingRef.current) window.location.reload(); // only after the user asked for the update
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
    if (navigator.serviceWorker.controller) setOfflineReady(true);

    const register = () => {
      navigator.serviceWorker
        .register(SW_URL, { scope: SW_SCOPE, updateViaCache: "none" })
        .then((reg) => {
          if (cancelled) return;
          track(reg);
          reg.update().catch(() => {});
          navigator.serviceWorker.ready.then(() => !cancelled && setOfflineReady(true)).catch(() => {});
        })
        .catch(() => { /* unsupported or blocked: the app works as a normal website */ });
    };
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });

    return () => {
      cancelled = true;
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
      window.removeEventListener("load", register);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!promptEvent) return "unavailable" as const;
    await promptEvent.prompt();
    const { outcome } = await promptEvent.userChoice;
    setPromptEvent(null);
    return outcome;
  }, [promptEvent]);

  const applyUpdate = useCallback(() => {
    const waiting = waitingRef.current;
    if (!waiting) return;
    reloadingRef.current = true;
    waiting.postMessage({ type: "SKIP_WAITING" });
  }, []);

  const mode = installMode({ ...env, standalone, hasPromptEvent: promptEvent !== null });
  const value = useMemo<PwaState>(
    () => ({ mode, online, updateReady, offlineReady, promptInstall, applyUpdate }),
    [mode, online, updateReady, offlineReady, promptInstall, applyUpdate],
  );

  return (
    <PwaContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 top-[calc(0.5rem+env(safe-area-inset-top))] z-[70] flex flex-col items-center gap-2 px-4"
        aria-live="polite"
      >
        {!online && (
          <div role="status" className="glass pointer-events-auto flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium">
            <WifiOff className="h-4 w-4 text-accent" aria-hidden /> Kamu offline. Data tetap tersimpan di perangkat.
          </div>
        )}
        {updateReady && (
          <div role="status" className="glass pointer-events-auto flex items-center gap-3 rounded-full py-1.5 pl-4 pr-1.5 text-sm font-medium">
            Versi baru tersedia
            <button
              type="button"
              onClick={applyUpdate}
              className="rounded-full bg-accent px-3 py-1.5 text-xs font-semibold text-accent-fg"
            >
              Perbarui
            </button>
          </div>
        )}
      </div>
    </PwaContext.Provider>
  );
}
