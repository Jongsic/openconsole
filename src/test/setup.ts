import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Initialize i18n once for the whole test run so `t()` returns real strings.
import "@/i18n";

afterEach(() => {
  cleanup();
});
