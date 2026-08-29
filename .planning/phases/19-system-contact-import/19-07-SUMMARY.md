---
phase: 19-system-contact-import
plan: 07
subsystem: ui
tags: [react-native, expo-image, contact-import, duplicate-review]
requires:
  - phase: 19-04
    provides: durable import routes and staged-photo preview resolver
  - phase: 19-05
    provides: advisory duplicate evidence outcomes
  - phase: 19-06
    provides: per-row import-as-new seam
  - phase: 19-10
    provides: post-commit imported-photo persistence
provides:
  - Reusable colourless duplicate candidate card grid with multi-select actions
  - Durable bulk duplicate-review workspace with staged incoming-photo previews
  - Single-import duplicate interrupt with explicit link/import/skip resolution
affects: [phase-20-reconciliation, import-complete]
actuals:
  tokens: 8233
  tasks: 3
  commits: 5
tech-stack:
  added: []
  patterns:
    - Caller-resolved staged-photo URI passed to namespace-agnostic card grid
    - Advisory duplicate outcomes require explicit link choice before a write
key-files:
  created:
    - src/components/ConfidenceChip.tsx
    - src/components/CandidateCardGrid.tsx
    - src/screens/DuplicateReviewScreen.tsx
  modified:
    - src/screens/ImportReviewScreen.tsx
    - src/navigation/RootNavigator.tsx
key-decisions:
  - "Confidence labels use only surfaceElevated and textSecondary, never semantic outcome hues or scores."
  - "Duplicate-review imports reuse importRowAsNew so staged photos persist after the atomic contact write."
  - "Phase 19 hides the generic Apply recommendation grid action because needs-review rows have no eligible targets."
patterns-established:
  - "Pass a pre-resolved photoUri to shared UI; raw import-staging paths never reach Avatar."
requirements-completed: [IMP-03]
coverage:
  - id: D1
    description: Reusable duplicate card grid and colourless confidence chip
    requirement: IMP-03
    verification:
      - kind: other
        ref: "npx tsc --noEmit --pretty false; npm run check:colors; npx biome check scoped files"
        status: pass
    human_judgment: true
    rationale: Visual card-grid layout and touch interactions require device review.
  - id: D2
    description: Durable bulk and single-import duplicate resolution flows
    requirement: IMP-03
    verification:
      - kind: other
        ref: "npx tsc --noEmit --pretty false; npm run check:colors; npx biome check scoped files"
        status: pass
    human_judgment: true
    rationale: Native navigation and duplicate-resolution actions require device review.
duration: 30min
completed: 2026-08-29
status: complete
---

# Phase 19 Plan 07: Duplicate Resolution UI Summary

**Reusable two-up candidate cards and explicit duplicate-resolution flows now turn advisory evidence into colourless, score-free user choices.**

## Performance

- **Duration:** 30 min
- **Completed:** 2026-08-29T14:25:56Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments

- Added a reusable `FlatList numColumns={2}` card grid with staged-photo-safe direct images, initials fallback, multi-select action sheet, and per-card failure state.
- Added DuplicateReviewScreen, including atomic Link / Import as New / Skip resolution, durable category and phone-region reads, candidate deletion tolerance, and session-finalization/navigation semantics.
- Added the single-import interrupt: deterministic links resolve terminally, ambiguous candidates require a choice, and Import as New remains on the shared photo-aware seam.

## Task Commits

1. **Task 1: ConfidenceChip + CandidateCardGrid** — `f77ff3f` (feat), `48f6757` (fix)
2. **Task 2: DuplicateReviewScreen bulk workspace** — `fd001dc` (feat)
3. **Task 3: Single-import duplicate interrupt** — `12ec05f` (feat), `76294c0` (fix)

## Files Created/Modified

- `src/components/ConfidenceChip.tsx` — five enumerated colourless advisory labels.
- `src/components/CandidateCardGrid.tsx` — reusable 2-up candidate grid and caller-selected bulk actions.
- `src/screens/DuplicateReviewScreen.tsx` — durable ambiguous-row review workflow.
- `src/screens/ImportReviewScreen.tsx` — single-contact duplicate interrupt and resolution writes.
- `src/navigation/RootNavigator.tsx` — real DuplicateReview route registration.

## Decisions Made

- Staged import photos are resolved in the review caller and rendered as direct `expo-image` URIs; `Avatar` only receives `photo={null}` for initials.
- Link-to-existing always invokes the named atomic DAO and never writes the existing contact name.
- The grid retains Apply recommendation for Phase 20, but DuplicateReview exposes only Link to Existing, Import as New, and Skip.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Lint correctness] Corrected the grid action cleanup callback**

- **Found during:** Task 2 verification
- **Issue:** The callback passed to `forEach` returned `Set.delete`'s boolean, violating the repository's Biome rule.
- **Fix:** Converted it to a side-effect-only callback and formatted the grid.
- **Files modified:** `src/components/CandidateCardGrid.tsx`
- **Committed in:** `48f6757`

**2. [Rule 1 - Interaction safety] Disabled duplicate-interrupt actions during writes**

- **Found during:** Task 3 verification
- **Issue:** An interrupt action could be tapped again while its durable write was in progress.
- **Fix:** Added a saving guard around Import as New and disabled resolution actions while saving.
- **Files modified:** `src/screens/ImportReviewScreen.tsx`
- **Committed in:** `76294c0`

## Issues Encountered

- The repository-wide `npx biome check` remains red on pre-existing unrelated diagnostics (137 errors across generated files, plugins, modules, and `.gsd/`). The five plan files pass scoped Biome verification, TypeScript, and `check:colors`.

## User Setup Required

None.

## Next Phase Readiness

Phase 20 can reuse `CandidateCardGrid` and enable its generic Apply recommendation action for outcome sets that include eligible New person cards. Device UAT remains required for the bulk grid and single-import interrupt.

## Self-Check: PASSED

- Created component and screen files exist on disk.
- All five implementation commits are present in git history.
