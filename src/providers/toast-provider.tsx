"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import { duration, easing } from "@/lib/tokens";
import { cn } from "@/lib/utils";

type ToastVariant = "default" | "success" | "error";
interface ToastInput { title: string; description?: string; variant?: ToastVariant; duration?: number }
interface ToastItem extends ToastInput { id: number }

const ToastContext = createContext<{ toast: (t: ToastInput) => void } | null>(null);

const ICONS = { default: Info, success: CheckCircle2, error: AlertCircle } as const;
const TONES = { default: "text-accent", success: "text-success", error: "text-danger" } as const;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(0);

  const dismiss = useCallback((id: number) => setItems((l) => l.filter((t) => t.id !== id)), []);
  const toast = useCallback((input: ToastInput) => {
    const id = nextId.current++;
    setItems((l) => [...l.slice(-2), { ...input, id }]);
    window.setTimeout(() => dismiss(id), input.duration ?? 4000);
  }, [dismiss]);

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-4 bottom-[calc(7rem+env(safe-area-inset-bottom))] z-[60] flex flex-col items-center gap-2 md:inset-x-auto md:bottom-6 md:right-6 md:items-end"
      >
        <AnimatePresence initial={false}>
          {items.map((t) => {
            const variant = t.variant ?? "default";
            const Icon = ICONS[variant];
            return (
              <motion.div
                key={t.id}
                layout
                initial={{ opacity: 0, y: 12, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={{ duration: duration.base, ease: easing.smooth }}
                className="glass glass-raised pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-control p-3.5 shadow-raised"
              >
                <Icon className={cn("mt-0.5 h-5 w-5 shrink-0", TONES[variant])} aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{t.title}</p>
                  {t.description && <p className="mt-0.5 text-sm text-muted">{t.description}</p>}
                </div>
                <button onClick={() => dismiss(t.id)} aria-label="Tutup notifikasi" className="rounded-md p-1 text-muted transition-colors hover:text-fg">
                  <X className="h-4 w-4" />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside ToastProvider");
  return ctx;
}
