# Phase 37 — Deferred / Out-of-Scope Items

## Pre-existing (not introduced by any Plan-37 work)

- **`src/components/orrery/orrery-controls-render.test.tsx` fails to transform**
  — `SyntaxError: Unexpected token 'typeof'` (0 tests run). The offending
  `...(await original<typeof import("react")>())` on line ~13 predates Plan 37
  (present at commit `8116dd9`, file last modified 7 days ago in `5d38954`,
  Phase 29). Unrelated to the Settings/profile/app-settings changes in this
  phase. Discovered during Plan 37-03's full-suite run (3569 tests pass, this
  one suite fails at the transform stage). Belongs to whoever owns the orrery
  test transform config — not fixed here per the executor scope boundary.
