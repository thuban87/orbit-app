# Phase 32 — Deferred / Out-of-scope discoveries

Items found during execution that are NOT caused by this phase's changes and are
therefore out of scope (deviation SCOPE BOUNDARY). Logged, not fixed.

## Pre-existing test-suite load failure — `src/components/orrery/orrery-controls-render.test.tsx`

- **Symptom:** `SyntaxError: Unexpected token 'typeof'` at suite load → the suite
  reports 0 tests and counts as a failed test FILE (not a failed test case).
- **Cause:** the test uses `...(await original<typeof import("react")>())` inside a
  `vi.mock` factory; the active Vite config-loader (`configLoader: 'native'`, which
  vitest already warns about at startup) fails to transform that TypeScript generic.
- **Not caused by Plan 32-01:** this file imports only orrery logic/stores/theme and
  orrery components — none of the files 32-01 changed. Discovered during the 32-01
  full-suite run.
- **Owner call / later phase:** resolve via the vitest/Vite config (e.g. set
  `"type": "module"` on the config or switch config loader) — a tooling change, not a
  Phase-32 data-layer concern.

## Pre-existing uncommitted change — `tsconfig.json`

- `tsconfig.json` was already modified in the working tree before Plan 32-01 started
  (present in the session-start `git status`). It is unrelated to this plan and was
  deliberately NOT staged in any 32-01 commit.
