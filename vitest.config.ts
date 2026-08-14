import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Pure-logic test runner (no DOM). Co-located tests: src/**/*.test.ts.
// passWithNoTests lives IN THE CONFIG so a later plan's bare `vitest run`
// never fails before the first test file lands.
export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["src/**/*.test.ts"],
    passWithNoTests: true,
  },
  resolve: {
    alias: {
      // Absolute resolved path so @/… imports resolve deterministically.
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
