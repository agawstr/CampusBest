"use client";

import { Button } from "./button";
import { Modal } from "./modal";

interface ConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void | Promise<void>;
}

export function ConfirmationDialog({
  open, onOpenChange, title, description,
  confirmLabel = "Konfirmasi", cancelLabel = "Batal", destructive = false, onConfirm,
}: ConfirmationDialogProps) {
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>{cancelLabel}</Button>
          <Button
            variant={destructive ? "danger" : "primary"}
            onClick={async () => { await onConfirm(); onOpenChange(false); }}
          >
            {confirmLabel}
          </Button>
        </>
      }
    />
  );
}
