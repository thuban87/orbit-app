---
phase: 13-orrery
plan: 02
subsystem: logic
tags: [orrery, geometry, hit-test, drift, reorder, ring_seq, pure-logic]
status: complete
requires:
  - "STABLE_MAX / WOBBLE_MAX / ROGUE_K from src/db/status.ts (single-sourced status cutoffs)"
  - "ProfileStatus from src/db/contact-status-read.ts"
  - "favourites-reorder-logic convention (copy-not-mutate, clamp-not-throw)"
provides:
  - "orrery-geometry-logic: progressToAngle, polarToXY, ringRadius, drawnRadius, evenSpreadAngle, hitTest, shortestAngleDelta, deriveOrreryMetrics"
  - "OrreryMetrics interface (the shared measured-canvas metrics object; canonical ringInner/effectiveGap pair)"
  - "OrreryBody interface (hit-test input)"
  - "ring-reorder-logic: computeRingReorder (drag→order for ring_seq)"
  - "tunable geometry constants: SUN_RADIUS, SUN_GLOW_RADIUS, RING_GAP_SEED, MIN_GAP, PLANET_RADIUS, HIT_RADIUS, MORPH_MS, DECAY_DRIFT_SPAN, ROGUE_DRIFT_SPAN"
affects:
  - "13-05 (OrreryScreen render + hit-test consume deriveOrreryMetrics + drawnRadius + hitTest)"
  - "13-07 (morph interpolates shortestAngleDelta; drag-release rank map divides by C.effectiveGap; ring-drag persists computeRingReorder → rewriteRingSeq)"
  - "13-03 (ring-seq-dao's rewriteRingSeq is fed by computeRingReorder)"
tech-stack:
  added: []
  patterns:
    - "pure RN/Skia/expo-free *-logic.ts module, node-tested first (TDD RED→GREEN)"
    - "single measured-canvas metrics object threaded to every consumer (H2), one canonical spacing pair (C2-6)"
    - "positive MIN_GAP floor guarantees a safe > 0 divisor for the downstream drag-release rank map (C2-4)"
    - "status cutoffs imported from status.ts, never re-typed (Pitfall 1)"
    - "angle map isolated in one swappable fn so device tuning is a body-only edit (A2)"
    - "reorder math cloned verbatim from favourites-reorder-logic (proven copy/clamp/permutation contract)"
key-files:
  created:
    - src/logic/orrery-geometry-logic.ts
    - src/logic/orrery-geometry-logic.test.ts
    - src/logic/ring-reorder-logic.ts
    - src/logic/ring-reorder-logic.test.ts
  modified: []
decisions:
  - "deriveOrreryMetrics exposes ONLY the canonical ringInner/effectiveGap spacing keys (C2-6) — RING_INNER_SEED/RING_GAP_SEED are module-private inputs, never surfaced on the object, so no consumer can read a raw fixed gap in one place and the compressed gap in another"
  - "effectiveGap = max(MIN_GAP, min(RING_GAP_SEED, (DRIFT_MAX − ringInner)/max(bodyCount−1,1))): the min compresses on overflow, the max(MIN_GAP,…) floor keeps it > 0 on any canvas incl. transient-zero (C2-4) so the 13-07 drag-release division is domain-safe"
  - "DRIFT_MAX is an absolute drawn-radius bound (min(cx,cy) − PLANET_RADIUS − 8); drawnRadius hard-clamps base+push to it so a far rank + rogue push stays on-screen + tappable (ORR-04)"
  - "STABLE_MAX intentionally NOT imported — this module receives an already-computed ProfileStatus and never buckets a raw progress, so only WOBBLE_MAX/ROGUE_K (decay-band sizing) are needed; importing an unused STABLE_MAX would fail biome noUnusedImports. The binding rule — never re-type the cutoffs — is honored (grep shows no local copy)"
  - "MIN_GAP=8, DECAY_DRIFT_SPAN=40, ROGUE_DRIFT_SPAN=80 seeded as top-of-file tunables (A3 drift curve is linear across the decay band, flat max for rogue — only the clamp is load-bearing)"
  - "computeRingReorder cloned verbatim from computeReorder (rename only), top-of-file comment re-pointed at ring_seq/rewriteRingSeq"
metrics:
  duration_min: 5
  tasks: 2
  files: 4
  tests_added: 45
completed: 2026-08-18
---

# Phase 13 Plan 02: Pure Geometry-Logic + Ring-Reorder-Logic Summary

The pure, node-tested geometry and reorder math the orrery renders from — angle↔time, radius, drift + on-screen clamp, coordinate hit-testing, even-spread, the shortest-path morph delta, the shared measured-canvas responsive metrics (`deriveOrreryMetrics`), and the `ring_seq` drag→order computation — implemented as two RN-free `*-logic.ts` modules following the repo's `favourites-reorder-logic` convention, tested node-side first (TDD RED→GREEN).

## What was built

- **`src/logic/orrery-geometry-logic.ts`** (Task 1) — `progressToAngle` (0→top, clockwise, wraps each interval, negative-safe), `polarToXY` (clockwise-from-top on a y-grows-down screen), `ringRadius(rank, C)`, `drawnRadius(progress, rank, status, C)` (stable/wobble on-ring, decay drifts linearly across `[WOBBLE_MAX, ROGUE_K)`, rogue furthest, all hard-clamped to `C.DRIFT_MAX`), `evenSpreadAngle`, `hitTest` (nearest within HIT_RADIUS, last-drawn wins ties, null on miss/empty), `shortestAngleDelta` (normalises to `[−π, π]` — Pitfall 2), and `deriveOrreryMetrics(canvasWidth, canvasHeight, bodyCount)` — the single measured-canvas metrics object every consumer threads.
- **`src/logic/ring-reorder-logic.ts`** (Task 2) — `computeRingReorder(orderedIds, from, to)`, cloned verbatim from `favourites-reorder-logic` (copy-not-mutate, permutation-invariant, out-of-range clamp-not-throw, `from===to` no-op), feeding the 13-03 `rewriteRingSeq` writer from the 13-07 radial-drag-end.

## How the must-haves are met

- **progressToAngle** maps 0→top, 0.5→bottom (6 o'clock), and wraps each interval via `progress − floor(progress)`. Kept a single swappable fn (A2) so a 13-08 device-UAT tuning call is a body-only edit.
- **drawnRadius** pushes stable/wobble onto their ring, drifts decay outward across the band, drifts rogue furthest, and **never exceeds `C.DRIFT_MAX`** (asserted: a rank-10 rogue clamps exactly to the bound).
- **deriveOrreryMetrics** returns ONE object with a SINGLE canonical spacing pair — `ringInner` / `effectiveGap` (C2-6: no `RING_INNER`/`RING_GAP` alias; the seeds are module-private). On overflow it compresses `effectiveGap` proportionally so `ringInner + (n−1)·effectiveGap ≤ DRIFT_MAX`. `effectiveGap` is floored to a positive `MIN_GAP` (C2-4) so a short/degenerate/transient-zero canvas can never yield `≤ 0` — the 13-07 `(releaseRadius − ringInner)/effectiveGap` rank map can never divide by zero/negative. Tests cover small-count (`=== RING_GAP_SEED`), large-count overflow (compressed, furthest ring ≤ DRIFT_MAX), `deriveOrreryMetrics(0,0,5)` and a below-sun-size canvas (`=== MIN_GAP`, > 0), and the no-alias-key assertion.
- **hitTest** returns the nearest body within HIT_RADIUS (last-drawn wins ties) or null.
- **computeRingReorder** returns a new permutation with the moved id at the target rank; input never mutated; out-of-range indices clamped; never throws.
- **Status cutoffs single-sourced** — `WOBBLE_MAX`/`ROGUE_K` imported from `@/db/status`; grep confirms no local re-declaration.

## Verification

- `npx vitest run src/logic/orrery-geometry-logic.test.ts src/logic/ring-reorder-logic.test.ts` — 45/45 green (34 geometry + 11 reorder).
- `npx tsc --noEmit` clean; `npm run check:colors` green; `biome check` clean.
- Both modules RN/Skia/expo-free (grep: the only match is the "RN/Skia/expo-free" comment); import only from `@/db/status` + a `type`-only `@/db/contact-status-read`.

## Requirements

Plan frontmatter lists ORR-01, ORR-04, ORR-06. These pure modules **contribute to** those requirements but do not fully deliver them (ORR-01 needs the 13-05 render, ORR-04 the `rogueExtinguished` token + render, ORR-06 the ring-seq-dao + Settings picker + drag). Following the convention 13-01 established (it listed ORR-05/06 in frontmatter but left them unchecked in REQUIREMENTS.md), REQUIREMENTS.md is left unchanged — the requirements are marked complete only when the phase fully delivers them.

## Deviations from Plan

**1. [Rule 3 — blocking issue] `STABLE_MAX` not imported despite the guardrail listing all three cutoffs.**
- **Found during:** Task 1 (biome gate).
- **Issue:** The plan/guardrail says "import STABLE_MAX/WOBBLE_MAX/ROGUE_K." But this module receives an already-computed `ProfileStatus` and never buckets a raw `progress`; only `WOBBLE_MAX`/`ROGUE_K` (decay-band sizing) are used. Importing an unused `STABLE_MAX` fails biome `noUnusedImports` and would block the commit hook.
- **Resolution:** Imported only the two used cutoffs. The **binding** rule — never *re-type* the status cutoffs — is fully honored (grep shows no local copy of 0.8/1.0/3 as status constants). A top-of-file comment documents why STABLE_MAX is absent. No numeric threshold is duplicated.

No other deviations — plan executed as written.

## Known Stubs

None. Both modules are complete pure functions with full test coverage; no placeholder data or unwired paths.

## Self-Check: PASSED

- Files exist: `src/logic/orrery-geometry-logic.ts`, `src/logic/orrery-geometry-logic.test.ts`, `src/logic/ring-reorder-logic.ts`, `src/logic/ring-reorder-logic.test.ts` — all present.
- Commits exist: `12715cd` (RED geometry), `cc9833e` (GREEN geometry), `187c1ce` (RED reorder), `3006b0b` (GREEN reorder) — all in `git log`.
- 45/45 tests green; tsc + check:colors + biome clean.
