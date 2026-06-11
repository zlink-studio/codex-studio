import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "#17201d",
        paper: "#f4f7f2",
        moss: "#41564b",
        mint: "#c7ded2",
        amber: "#d99238",
        clay: "#b86b4b",
        line: "#d7ded2"
      },
      boxShadow: {
        soft: "0 18px 50px rgba(23, 32, 29, 0.12)"
      }
    }
  },
  plugins: []
};

export default config;
