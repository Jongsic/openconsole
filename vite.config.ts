import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  // Support sub-path deployment such as GitHub Pages project sites (e.g. VITE_BASE=/openconsole/)
  base: process.env.VITE_BASE || "/",
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  define: {
    // Shim "global" referenced by some libraries (e.g. AWS SDK)
    global: "globalThis",
  },
});
