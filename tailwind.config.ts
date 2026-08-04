import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#070B14",
        panel: "#0E1524",
        panel2: "#141D30",
        edge: "#1E2A42",
        amber: "#FFB020",
        sos: "#FF3B4E",
        safe: "#22D3A7",
        muted: "#8497B8",
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
