import path from "node:path";
import { defineConfig } from "vitest/config";

/**
 * Live contract/smoke tier (`pnpm test:contract`). Runs ONLY `*.contract.test.ts`
 * in a node environment against a real backend. The suites themselves
 * `describe.skip` when no endpoint is configured (see src/contract/harness.ts),
 * so this run passes cleanly with no backend.
 */
export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  test: {
    environment: "node",
    globals: true,
    include: ["src/**/*.contract.test.{ts,tsx}"],
  },
});
