---
phase: 27-dashboard-list-view
plan: 03
subsystem: database
tags: [sqlite, dashboard, list-view, deterministic-selection, icons, vitest]
requires:
  - phase: 27-dashboard-list-view
    provides: ListRow tracer and shared semantic icon registry
  - phase: 24.1-contact-knowledge-foundation
    provides: Memories, relationships, current-state storage and registry visibility choke points
provides:
  - Bounded per-contact batch knowledge candidates for Dashboard line 3
  - Pure deterministic line-3 selection with stable completeness prompts
  - Shared favorite icon mapping to the star pair
affects: [27-04, 27-05, 27-06, 28-dashboard-card-view]
actuals:
  tokens: 7425
  tasks: 3
  commits: 5
tech-stack:
  added: []
  patterns:
    - Per-contact SQLite ROW_NUMBER windows with TypeScript visibility re-cap.
    - Pure line-3 selection ties over stable persisted id and creation time.
key-files:
  created:
    - src/db/dashboard-knowledge-read.ts
    - src/db/dashboard-knowledge-read.test.ts
    - src/logic/list-row-selection.ts
    - src/logic/list-row-selection.test.ts
  modified:
    - src/components/icons/icon-registry.ts
key-decisions:
  - "The batch reader over-fetches each per-contact source window, applies the existing registry-default-aware visibility choke points, then re-caps in TypeScript."
  - "Completeness prompts use the dossier and UI-SPEC canon verbatim, indexed by a stable contact id hash."
  - "The semantic favorite registry maps globally to star-outline/star, so future consumers inherit the star without a second icon source."
patterns-established:
  - "Dashboard list knowledge reads bind every contact id and never issue a database query from a row renderer."
  - "Adaptive-context priority selection is React Native-free and deterministic despite input ordering."
requirements-completed: [LISTV-03, LISTV-04]
coverage:
  - id: D1
    description: Bounded three-source candidate read with registry-aware visibility and current-state history protection.
    requirement: LISTV-03
    verification:
      - kind: integration
        ref: src/db/dashboard-knowledge-read.test.ts#dashboard line-3 knowledge read
        status: pass
    human_judgment: false
  - id: D2
    description: Deterministic imminent/pinned/useful/prompt selector with stable identity ties and canonical prompt copy.
    requirement: LISTV-03
    verification:
      - kind: unit
        ref: src/logic/list-row-selection.test.ts#selectLine3
        status: pass
    human_judgment: false
  - id: D3
    description: Single semantic favorite star registry mapping for the forthcoming ListRow consumer.
    requirement: LISTV-04
    verification:
      - kind: unit
        ref: src/components/icons/icon-registry.test.ts
        status: pass
    human_judgment: false
duration: 7min
completed: 2026-09-06
status: complete
---

# Phase 27 Plan 03: Deterministic List Knowledge Primitives Summary

**Dashboard List now has a bounded registry-safe knowledge read, a stable line-3 selector and prompt system, plus one shared semantic favorite star source.**

## Performance

- **Duration:** 7 min
- **Started:** 2026-09-06T02:35:05Z
- **Completed:** 2026-09-06T02:41:39Z
- **Tasks:** 3/3
- **Files modified:** 5

## Accomplishments

- Added one batched query per knowledge source with deterministic per-contact `ROW_NUMBER` bounds, registry-aware visibility filtering, visibility headroom, and a final per-contact cap.
- Added a node-testable selector that ranks imminent, pinned, and ordinary knowledge before a stable gentle completeness prompt; birthdays cannot surface.
- Changed the shared semantic favorite mapping from heart to star without adding an icon fork or touching Card View.

## Task Commits

1. **Task 1: Star the favourite — single-source registry change** — `c199194` (`feat`)
2. **Task 2: Batch line-3 knowledge read (contact_id IN), RED** — `264eb66` (`test`)
3. **Task 2: Batch line-3 knowledge read (contact_id IN), GREEN** — `21a720e` (`feat`)
4. **Task 3: Deterministic line-3 selection + stable completeness prompts, RED** — `9874724` (`test`)
5. **Task 3: Deterministic line-3 selection + stable completeness prompts, GREEN** — `e33fcf6` (`feat`)

## Files Created/Modified

- `src/db/dashboard-knowledge-read.ts` — bounded three-source Dashboard candidate batch read.
- `src/db/dashboard-knowledge-read.test.ts` — visibility, lifecycle, empty input, multi-contact and starvation regressions.
- `src/logic/list-row-selection.ts` — pure priority selector and stable prompt canon.
- `src/logic/list-row-selection.test.ts` — priority, birthday, identity-tie, and copy-contract coverage.
- `src/components/icons/icon-registry.ts` — global semantic favorite star pair.

## Decisions Made

- Registry-default visibility is the authoritative TypeScript filter; SQL does not assume a null `hidden` value is visible.
- The reader keeps bounded over-fetch headroom before visibility filtering, so a future hidden-by-default type cannot consume all visible candidates.
- The selector uses local-calendar date strings for its 30-day imminent window and stable persisted identity for all ties.

## Verification

- `npx vitest run src/db/dashboard-knowledge-read.test.ts src/logic/list-row-selection.test.ts src/components/icons/icon-registry.test.ts` — 19 tests passed.
- `npx tsc --noEmit` — passed.
- `npm run check:colors` — passed.

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None.

## Next Phase Readiness

Plan 27-04 can load candidates once per Dashboard query generation, call `selectLine3`, and pass the result into ListRow without per-row database reads. The favorite semantic name now resolves globally to the star pair for its row consumer.

## Self-Check: PASSED

- Found all five implementation and test files.
- Found task commits `c199194`, `264eb66`, `21a720e`, `9874724`, and `e33fcf6`.
