"use client";

import type { ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { duration, easing } from "@/lib/tokens";

interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
}

export function Modal({ open, onOpenChange, title, description, children, footer }: ModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild>
              <motion.div
                className="fixed inset-0 z-50 bg-black/55 backdrop-blur-sm"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                transition={{ duration: duration.base }}
              />
            </Dialog.Overlay>
            <div className="pointer-events-none fixed inset-0 z-50 grid place-items-center p-4">
              <Dialog.Content asChild>
                <motion.div
                  className="glass pointer-events-auto max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-sheet bg-card p-6 shadow-float"
                  initial={{ opacity: 0, scale: 0.96, y: 8 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.97, y: 4 }}
                  transition={{ duration: duration.base, ease: easing.smooth }}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <Dialog.Title className="text-lg font-semibold">{title}</Dialog.Title>
                      {description && <Dialog.Description className="mt-1 text-sm text-muted">{description}</Dialog.Description>}
                    </div>
                    <Dialog.Close aria-label="Tutup" className="rounded-lg p-1.5 text-muted transition-colors hover:bg-fg/10 hover:text-fg">
                      <X className="h-5 w-5" />
                    </Dialog.Close>
                  </div>
                  {children && <div className="mt-5">{children}</div>}
                  {footer && <div className="mt-6 flex justify-end gap-2">{footer}</div>}
                </motion.div>
              </Dialog.Content>
            </div>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
