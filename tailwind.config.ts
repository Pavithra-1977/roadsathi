import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "rgb(var(--ink) / <alpha-value>)",
        panel: "rgb(var(--panel) / <alpha-value>)",
        panel2: "rgb(var(--panel2) / <alpha-value>)",
        edge: "rgb(var(--edge) / <alpha-value>)",
        amber: "rgb(var(--amber) / <alpha-value>)",
        sos: "rgb(var(--sos) / <alpha-value>)",
        safe: "rgb(var(--safe) / <alpha-value>)",
        muted: "rgb(var(--muted) / <alpha-value>)",
      },
      fontFamily: {
        sans: ["ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "Helvetica Neue", "Arial", "sans-serif"],
      },
      keyframes: {
        pulseRing: {
          "0%": { transform: "scale(0.7)", opacity: "0.9" },
          "100%": { transform: "scale(2.2)", opacity: "0" },
        },
        rise: {
          "0%": { transform: "translateY(8px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
      },
      animation: {
        pulseRing: "pulseRing 2s cubic-bezier(0.2,0.6,0.3,1) infinite",
        rise: "rise .35s ease-out both",
      },
    },
  },
  plugins: [],
};
export default config;
