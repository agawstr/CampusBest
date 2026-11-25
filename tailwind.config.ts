import type { Config } from "tailwindcss";

const c = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

const config: Config = {
  darkMode: ["class"],
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: c("bg"),
        surface: c("surface"),
        card: c("card"),
        accent: c("accent"),
        "accent-fg": c("accent-fg"),
        fg: c("fg"),
        muted: c("muted"),
        danger: c("danger"),
        success: c("success"),
        activity: c("kind-activity"),
      },
      fontFamily: { sans: ["var(--font-sans)", "system-ui", "sans-serif"] },
      borderRadius: {
        control: "var(--radius-control)",
        card: "var(--radius-card)",
        sheet: "var(--radius-sheet)",
      },
      boxShadow: {
        soft: "var(--shadow-soft)",
        raised: "var(--shadow-raised)",
        float: "var(--shadow-float)",
        hero: "var(--shadow-hero)",
        glow: "var(--shadow-glow)",
      },
      transitionDuration: { fast: "120ms", base: "180ms", slow: "260ms" },
      transitionTimingFunction: { smooth: "cubic-bezier(0.22, 1, 0.36, 1)" },
    },
  },
  plugins: [],
};
export default config;
