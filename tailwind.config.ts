import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "rgb(var(--color-ink) / <alpha-value>)",
        paper: "rgb(var(--color-paper) / <alpha-value>)",
        moss: "rgb(var(--color-moss) / <alpha-value>)",
        mint: "rgb(var(--color-mint) / <alpha-value>)",
        amber: "rgb(var(--color-amber) / <alpha-value>)",
        clay: "rgb(var(--color-clay) / <alpha-value>)",
        line: "rgb(var(--color-line) / <alpha-value>)"
      },
      boxShadow: {
        soft: "0 18px 60px rgba(15, 23, 42, 0.10)"
      }
    }
  },
  plugins: []
};

export default config;
