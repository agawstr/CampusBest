"use client";

import { forwardRef } from "react";
import { motion, type HTMLMotionProps } from "framer-motion";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-control font-semibold transition-colors duration-fast disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary: "btn-metal text-accent-fg shadow-glow hover:brightness-110",
        secondary: "glass-item text-fg hover:bg-fg/10",
        ghost: "text-muted hover:bg-fg/[0.07] hover:text-fg",
        danger: "bg-danger text-white hover:brightness-110",
      },
      size: { sm: "h-9 px-3.5 text-sm", md: "h-11 px-5 text-sm", lg: "h-12 px-6 text-base", icon: "h-10 w-10" },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps extends HTMLMotionProps<"button">, VariantProps<typeof buttonVariants> {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, type = "button", ...props }, ref) => (
    <motion.button
      ref={ref}
      type={type}
      whileTap={{ scale: 0.96 }}
      transition={{ duration: 0.12 }}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  ),
);
Button.displayName = "Button";
