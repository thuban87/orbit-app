# Phase 34 — Deferred / Out-of-Scope Items

Discoveries logged during execution that are NOT caused by the current plan's
changes and are therefore out of scope (per executor SCOPE BOUNDARY).

## From 34-02 execution (2026-09-12)

- **Pre-existing test-suite LOAD failure — `src/components/orrery/orrery-controls-render.test.tsx`.**
  `npx vitest run` reports `SyntaxError: Unexpected token 'typeof'` while
  transforming this file (line 13: `...(await original<typeof import("react")>())`).
  This is a transform/syntax issue in the vitest pipeline, not a failed
  assertion. The file is unmodified by 34-02 (last touched in commit `5d38954`,
  Phase 29-11) and is unrelated to the memory-registry / interaction-vocabulary /
  ai-context-read files this plan changes. All 3160 individual tests pass; only
  this one suite fails to load. Left for a dedicated fix (likely a vitest/esbuild
  transform config for generic call-type-arguments in `.test.tsx`).
