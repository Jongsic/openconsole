import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#6c2bd9",
          /** Subtle brand wash for selected/active surfaces. */
          fg: "#f3eeff",
          /** Slightly deeper wash for hover on selected surfaces. */
          tint: "#ebe3fd",
        },
      },
    },
  },
  plugins: [],
};

export default config;
