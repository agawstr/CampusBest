"use client";

import type { ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";

interface BottomSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children?: ReactNode;
}

export function BottomSheet({ open, onOpenChange, title, description, children }: BottomSheetProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="animate-overlay-in fixed inset-0 z-50 scrim" />
        <Dialog.Content
          className="glass-strong animate-sheet-in fixed inset-x-0 bottom-0 z-50 mx-auto max-h-[85dvh] w-full max-w-xl overflow-y-auto rounded-t-sheet px-5 pt-3 shadow-float will-change-transform"
          style={{ paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom))" }}
        >
          <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-fg/20" aria-hidden />
          <div className="flex items-start justify-between gap-3">
            <div>
              <Dialog.Title className="text-lg font-semibold">{title}</Dialog.Title>
              {description && <Dialog.Description className="mt-1 text-sm text-muted">{description}</Dialog.Description>}
            </div>
            <Dialog.Close aria-label="Tutup" className="rounded-lg p-1.5 text-muted transition-colors hover:bg-fg/10 hover:text-fg">
              <X className="h-5 w-5" />
            </Dialog.Close>
          </div>
          <div className="mt-4">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
