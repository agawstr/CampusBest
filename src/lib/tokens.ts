/**
 * Design tokens (TypeScript mirror).
 * Colors live in globals.css as CSS variables so both themes can swap them
 * without re-rendering. This file holds tokens that JS needs (motion) plus a
 * documented reference for the rest.
 */
export const colors = {
  dark: { bg: "#0B1020", surface: "#111A2E", card: "#172238", accent: "#65B8FF", fg: "#F3F6FC", muted: "#9AAAC2" },
  light: { bg: "#F4F7FC", surface: "#E9EFF9", card: "#FFFFFF", accent: "#1F7AE0", fg: "#0F1A2E", muted: "#5B6B85" },
} as const;

export const typography = {
  family: "Plus Jakarta Sans",
  scale: { xs: "0.75rem", sm: "0.875rem", base: "1rem", lg: "1.125rem", xl: "1.375rem", "2xl": "1.75rem", "3xl": "2.25rem" },
  weights: { regular: 400, medium: 500, semibold: 600, bold: 700 },
} as const;

export const spacing = { 1: "4px", 2: "8px", 3: "12px", 4: "16px", 6: "24px", 8: "32px", 12: "48px" } as const;
export const radius = { control: 14, card: 22, sheet: 28, pill: 999 } as const;

export const duration = { fast: 0.15, base: 0.25, slow: 0.45 } as const;
export const easing = {
  smooth: [0.22, 1, 0.36, 1] as [number, number, number, number],
  standard: [0.4, 0, 0.2, 1] as [number, number, number, number],
};

export const spring = { type: "spring", stiffness: 420, damping: 34 } as const;
