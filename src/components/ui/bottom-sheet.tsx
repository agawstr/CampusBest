"use client";

import type { ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { AnimatePresence, motion } from "framer-motion";
import { duration, easing } from "@/lib/tokens";

interface BottomSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children?: ReactNode;
}

export function BottomSheet({ open, onOpenChange, title, description, children }: BottomSheetProps) {
  function clearStuckBodyLock() {
    if (!document.querySelector('[role="dialog"]')) {
      document.body.style.pointerEvents = "";
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence onExitComplete={clearStuckBodyLock}>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild>
              <motion.div
                className="fixed inset-0 z-50 scrim"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, pointerEvents: "none" }}
                transition={{ duration: duration.base }}
              />
            </Dialog.Overlay>
            <Dialog.Content asChild>
              <motion.div
                className="glass-strong fixed inset-x-0 bottom-0 z-50 mx-auto w-full max-w-xl rounded-t-sheet px-5 pt-3 shadow-float will-change-transform"
                style={{ paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom))" }}
                initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%", pointerEvents: "none" }}
                transition={{ duration: duration.slow, ease: easing.smooth }}
                drag="y"
                dragConstraints={{ top: 0, bottom: 0 }}
                dragElastic={{ top: 0, bottom: 0.4 }}
                onDragEnd={(_, info) => { if (info.offset.y > 90 || info.velocity.y > 500) onOpenChange(false); }}
              >
                <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-fg/20" aria-hidden />
                <Dialog.Title className="text-lg font-semibold">{title}</Dialog.Title>
                {description && <Dialog.Description className="mt-1 text-sm text-muted">{description}</Dialog.Description>}
                <div className="mt-4">{children}</div>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
