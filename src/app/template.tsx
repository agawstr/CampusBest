"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { duration, easing } from "@/lib/tokens";

/** A template re-mounts on every navigation, which gives us a page transition. */
export default function Template({ children }: { children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: duration.base, ease: easing.smooth }}
    >
      {children}
    </motion.div>
  );
}
