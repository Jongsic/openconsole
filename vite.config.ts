/// <reference types="vitest/config" />
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
  test: {
    // Default (`pnpm test`) is the offline unit/component tier: jsdom + mocked apis.
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    // Run every *.test.ts/tsx EXCEPT the live contract suite, which talks to a
    // real backend and is run separately via `pnpm test:contract`.
    include: ["src/**/*.test.{ts,tsx}"],
    exclude: ["**/node_modules/**", "**/dist/**", "src/**/*.contract.test.{ts,tsx}"],
    // Contract tests run in node (no DOM); they self-tag with this glob so a
    // dedicated run picks up the node environment without a per-file pragma.
    environmentMatchGlobs: [["src/contract/**", "node"]],
  },
});
