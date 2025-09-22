import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  // Add this `safelist` array to ensure your dynamic color classes are included
  safelist: ["text-purple-600", "text-green-400", "text-white"],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
      },
      fontFamily: {
        // Updated to use the Funnel Display font
        sans: ["var(--font-funnel-display)"],
      },
    },
  },
  plugins: [],
};
export default config;
