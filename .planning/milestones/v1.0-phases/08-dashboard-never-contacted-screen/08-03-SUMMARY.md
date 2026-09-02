---
phase: 08-dashboard-never-contacted-screen
plan: 03
subsystem: database
tags: [sqlite, favourites, dao, transaction, reorder, drag]

# Dependency graph
requires:
  - phase: 08-dashboard-never-contacted-screen
    provides: "favourite_rank column (migration 001) + inWriteTransaction primitive + node:sqlite testkit"
provides:
  - "src/db/favourites-dao.ts — setFavouriteRank / clearFavouriteRank / rewriteFavouriteRanks (the ONLY new writer Phase 8 introduces)"
  - "src/logic/favourites-reorder-logic.ts — computeReorder pure drag→order function"
affects: [08-06-profile-star, 08-08-manage-favourites, favourites-read]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Single-column atomic writer mirroring setContactPhoto/clearContactPhoto (one inWriteTransaction, ?-bound UPDATE, changes===1 guard)"
    - "Batch transactional rewrite with pre-write guards (unique + count-match) + per-row scoped changes===1, never nesting the non-reentrant mutex"
    - "Pure *-logic.ts drag→order module extracted from the RN screen, node-tested"

key-files:
  created:
    - src/db/favourites-dao.ts
    - src/db/favourites-dao.test.ts
    - src/logic/favourites-reorder-logic.ts
    - src/logic/favourites-reorder-logic.test.ts
  modified: []

key-decisions:
  - "Out-of-range drag indices are CLAMPED into [0, length-1] (not thrown) so a stray gesture index cannot crash the reorder screen."
  - "rewriteFavouriteRanks enforces THREE guards inside one transaction (unique ids, count==live-favourite count, per-row scoped changes===1) — MEDIUM-2 mismatched-id-count guarantee."
  - "Empty orderedIds is an accepted no-op (both guards pass at 0===0), documented in-file so it is not mistaken for a missing guard (A-2)."

patterns-established:
  - "Favourites writer never touches the recency column — DATA-04 single-writer invariant intact by construction (grep-verified 0 references)."
  - "N raw UPDATEs inside ONE transaction for a batch rewrite; never call a wrapped single-write DAO in the loop (non-reentrant mutex → deadlock)."

requirements-completed: [DASH-06]

coverage:
  - id: D1
    description: "setFavouriteRank appends a favourite at MAX+1 (first → 0), bumps modified_at, leaves the recency column untouched; a bad id throws + rolls back."
    requirement: "DASH-06"
    verification:
      - kind: unit
        ref: "src/db/favourites-dao.test.ts#setFavouriteRank — append-at-end (MAX+1), guarded"
        status: pass
    human_judgment: false
  - id: D2
    description: "clearFavouriteRank NULLs favourite_rank, bumps modified_at, recency untouched; a bad id throws."
    requirement: "DASH-06"
    verification:
      - kind: unit
        ref: "src/db/favourites-dao.test.ts#clearFavouriteRank — NULL the rank, guarded"
        status: pass
    human_judgment: false
  - id: D3
    description: "rewriteFavouriteRanks writes rank 0..n-1 in ONE transaction and enforces the MEDIUM-2 guards — partial, over-long, duplicate, and stale (archived / never-favourite) lists all throw + roll back with no rank change persisted and no non-favourite/archived row ranked; empty list is an accepted no-op."
    requirement: "DASH-06"
    verification:
      - kind: unit
        ref: "src/db/favourites-dao.test.ts#rewriteFavouriteRanks — transactional 0..n-1, MEDIUM-2 guards"
        status: pass
    human_judgment: false
  - id: D4
    description: "computeReorder returns a new permuted id array for forward/backward/no-op moves, clamps out-of-range indices, and never mutates its input."
    requirement: "DASH-06"
    verification:
      - kind: unit
        ref: "src/logic/favourites-reorder-logic.test.ts#computeReorder — pure drag→order move"
        status: pass
    human_judgment: false

# Metrics
duration: 4min
completed: 2026-08-16
status: complete
---

# Phase 8 Plan 03: Favourites Write Layer Summary

**Transactional, guarded favourite mark/clear/reorder DAO (setFavouriteRank / clearFavouriteRank / rewriteFavouriteRanks) plus a pure node-tested computeReorder drag→order function — the only new writer Phase 8 adds, and it never touches the recency column.**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-08-16T04:28:08Z
- **Completed:** 2026-08-16T04:32:00Z
- **Tasks:** 2
- **Files modified:** 4 (all created)

## Accomplishments
- `favourites-dao.ts`: append-at-end mark (`favourite_rank = COALESCE(MAX,-1)+1`), NULL clear, and a transactional rank rewrite — each a single-column `?`-bound UPDATE with a `changes===1` loud-failure guard, mirroring `setContactPhoto`/`clearContactPhoto` exactly.
- `rewriteFavouriteRanks` enforces the MEDIUM-2 mismatched-id-count guarantee inside one `inWriteTransaction`: unique-id check, count-equals-current-live-favourites check, and per-row `WHERE id = ? AND favourite_rank IS NOT NULL AND archived_at IS NULL` scoping with `changes===1` — a partial / over-long / duplicate / stale list rolls back the whole batch and can never rank a non-favourite or archived row.
- `computeReorder`: pure, input-immutable, permutation-invariant drag→order array move with deterministic out-of-range clamping — ready to feed `rewriteFavouriteRanks` from the Manage-favourites drag-end.
- 26 node:sqlite / node tests green (15 DAO + 11 reorder), `tsc --noEmit` clean, Biome clean, `check:colors` clean.

## Task Commits

Each task was committed atomically:

1. **Task 1: favourites-dao.ts — mark/clear/reorder writers** - `b325cb7` (feat)
2. **Task 2: favourites-reorder-logic.ts — pure drag→order** - `8202e11` (feat)

_Note: implemented test-first; each task's test + implementation landed in one atomic feat commit._

## Files Created/Modified
- `src/db/favourites-dao.ts` - setFavouriteRank / clearFavouriteRank / rewriteFavouriteRanks; the sole new Phase-8 writer, recency column never referenced.
- `src/db/favourites-dao.test.ts` - node:sqlite proof: append, clear, transactional reorder order, bad-id rollback, recency-unchanged, and all three rewrite guards (partial / over-long / duplicate / stale-archived / stale-never-favourite / empty).
- `src/logic/favourites-reorder-logic.ts` - computeReorder pure drag→order function.
- `src/logic/favourites-reorder-logic.test.ts` - forward/backward/no-op moves, index clamping, permutation invariance, input-not-mutated.

## Decisions Made
- **Out-of-range drag indices clamp rather than throw** — a stray gesture index reorders to the nearest valid slot instead of crashing the reorder screen; tested both `from` and `to` clamping plus negative-index clamping.
- **Three-guard rewrite** (unique / count-match / per-row scoped changes===1) chosen so the "mismatched id count" guarantee holds against every failure mode, per review MEDIUM-2. Empty list left as an accepted no-op and documented in-file so a future reader does not mistake it for a missing guard (A-2).

## Deviations from Plan

None - plan executed exactly as written.

Two review-driven wording adjustments were made to satisfy the plan's own grep acceptance gates (not behavior changes): the DAO doc comments avoid the literal `last_contact` token (acceptance requires `grep -c last_contact` == 0; the recency column is described in prose instead), and the reorder module's doc comment says "no RN/native imports" rather than "react-native-free" (acceptance requires `grep -c "react-native\|expo-"` == 0). Both are documentation-only.

## Issues Encountered
None. Biome required a formatting pass on the test files (applied via `biome check --write`); tests remained green afterward.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Write layer is ready for Plan 06 (profile star toggle → setFavouriteRank / clearFavouriteRank) and Plan 08 (Manage-favourites drag → computeReorder → rewriteFavouriteRanks).
- DATA-04 single-writer recency invariant remains intact (grep-verified: favourites-dao never references the recency column).

## Self-Check: PASSED

All 4 created files present on disk; both task commits (`b325cb7`, `8202e11`) present in git history.

---
*Phase: 08-dashboard-never-contacted-screen*
*Completed: 2026-08-16*
