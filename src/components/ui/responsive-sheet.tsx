"use client";

import { useEffect, useState, type ReactNode } from "react";
import { BottomSheet } from "./bottom-sheet";
import { Modal } from "./modal";

interface ResponsiveSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children?: ReactNode;
}

/** Modal on desktop (md+), BottomSheet on mobile. */
export function ResponsiveSheet(props: ResponsiveSheetProps) {
  const [desktop, setDesktop] = useState(true);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const update = () => setDesktop(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  if (desktop) return <Modal {...props} />;
  return <BottomSheet {...props} />;
}
