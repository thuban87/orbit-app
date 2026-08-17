import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Pure-logic test runner (no DOM). Co-located tests: src/**/*.test.ts(x).
// The .tsx glob lets a component's PURE helper (e.g. ContactCard's ringVisual,
// 12-01) be unit-tested from a co-located .test.tsx WITHOUT rendering — the node
// env transforms tsx via esbuild; tests must stay render-free (no DOM shipped).
// passWithNoTests lives IN THE CONFIG so a later plan's bare `vitest run`
// never fails before the first test file lands.
export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    passWithNoTests: true,
  },
  resolve: {
    alias: {
      // Absolute resolved path so @/… imports resolve deterministically.
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
