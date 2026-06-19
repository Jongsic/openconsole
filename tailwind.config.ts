import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#6c2bd9",
          fg: "#f5f0ff",
        },
      },
    },
  },
  plugins: [],
};

export default config;
