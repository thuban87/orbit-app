---
phase: 06-interaction-log-status-impact
plan: 02
subsystem: database
tags: [sqlite, events, timeline, dao, react-native, immutable-log]

# Dependency graph
requires:
  - phase: 06-01
    provides: one-tap touchpoint writer (recordTouchpoint) + the profile Log-contact action the timeline now reads back
  - phase: 03-crud
    provides: archiveContact/restoreContact lifecycle + purge fan-out + the inWriteTransaction non-reentrant primitive + recency-dao *Core composition pattern
provides:
  - Immutable insert-only events writer (events-dao.ts) — EventType (archive|restore|snooze|unsnooze) + recordEvent (mutexed) + recordEventCore (non-mutexed composition primitive)
  - archive/restore now emit real lifecycle events composed inside their existing single transaction, archived-state-guarded so only a real transition emits one
  - Purge surfaces the events count in impactSummaryLines (and still deletes events explicitly)
  - listTimeline — interleaved touchpoints + read-only events, newest-first with a deterministic cross-table tiebreak
  - TimelineRow presentational component + the profile's real timeline surface (stub retired)
affects: [interaction-log, timeline-edit-delete-plan-03, status-impact, snooze-phase]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Immutable insert-only DAO: expose recordEvent/recordEventCore, NO update/edit path — the only removal is the contact FK / purge fan-out"
    - "*Core composition: a non-mutexed core recordEventCore composed inside a caller's existing inWriteTransaction (never nest the non-reentrant mutex, never open a second transaction)"
    - "Archived-state-guarded UPDATE (WHERE ... archived_at IS NULL / IS NOT NULL) so a no-op/wrong-state transition matches 0 rows, throws, and writes no spurious event"
    - "UNION ALL interleave with a static kind_order discriminator as the FINAL ORDER BY key; row identity is ${kind}-${id}, never the bare id (independent PK sequences)"

key-files:
  created:
    - src/db/events-dao.ts
    - src/db/events-dao.test.ts
    - src/db/timeline-read.ts
    - src/db/timeline-read.test.ts
    - src/components/TimelineRow.tsx
  modified:
    - src/db/contacts-dao.ts
    - src/db/contacts-dao.test.ts
    - src/db/purge-dao.ts
    - src/db/purge-dao.test.ts
    - src/screens/ContactProfileScreen.tsx

key-decisions:
  - "Events DAO is insert-only — events are 'a record of what the app did' (dossier §immutable); no update/edit function exists"
  - "Ship the C2-#1 archived-state guard: a redundant archive/restore now THROWS instead of silently re-stamping (owner-approved; tightens Phase-4 semantics)"
  - "Keep purge's explicit DELETE FROM events (dossier [log → crud]); FK cascade is decorative since FKs are off inside the transaction"
  - "kind_order (touchpoint=1, event=0) is the deterministic final tiebreak for a full occurred_at+id cross-table collision; touchpoint sorts before event"

patterns-established:
  - "Immutable lifecycle-event log composed into existing lifecycle transactions via a non-mutexed *Core"
  - "Cross-table timeline identity keyed by ${kind}-${id} to survive independent PK sequences"

requirements-completed: [LOG-02]

coverage:
  - id: D1
    description: "Immutable insert-only events writer (recordEvent mutexed + recordEventCore non-mutexed) with the archive|restore|snooze|unsnooze vocabulary; no update/edit path"
    requirement: "LOG-02"
    verification:
      - kind: unit
        ref: "src/db/events-dao.test.ts#recordEvent/recordEventCore (4 tests)"
        status: pass
      - kind: other
        ref: "grep -c 'UPDATE events' src/db/events-dao.ts (code) = 0"
        status: pass
    human_judgment: false
  - id: D2
    description: "archiveContact emits one 'archive' event and restoreContact one 'restore' event inside their existing single transaction; archived-state guard writes zero events on a no-op/wrong-state transition; last_contact untouched"
    requirement: "LOG-02"
    verification:
      - kind: unit
        ref: "src/db/contacts-dao.test.ts#emits exactly one immutable 'archive'/'restore' event + no-op-transition zero-events (4 new tests)"
        status: pass
      - kind: other
        ref: "grep 'last_contact =' src/db — recency-dao.ts sole writer (single-writer DATA-04 intact)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Purge surfaces the events count in impactSummaryLines (omit-zero) and still removes events explicitly; archive→event→purge→gone round-trip"
    requirement: "LOG-02"
    verification:
      - kind: unit
        ref: "src/db/purge-dao.test.ts#impactSummaryLines events cases + archive→event→purge round-trip"
        status: pass
    human_judgment: false
  - id: D4
    description: "listTimeline interleaves touchpoints + read-only events newest-first (occurred_at DESC, id DESC, kind_order DESC); deterministic on an equal-occurred_at+equal-id cross-table pair; contact-scoped; empty → []"
    requirement: "LOG-02"
    verification:
      - kind: unit
        ref: "src/db/timeline-read.test.ts#interleave order, cross-table collision, scoping, empty (6 tests)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Profile renders the real interleaved timeline via TimelineRow (touchpoint vs read-only Archived/Restored), honest empty state, colours via theme tokens; stub retired"
    requirement: "LOG-02"
    verification:
      - kind: unit
        ref: "npx tsc --noEmit + npm run check:colors + npx biome check src (all clean)"
        status: pass
      - kind: manual_procedural
        ref: "on-device Pixel UAT: timeline newest-first, archive/restore events read-only, empty state, purge-impact events count"
        status: unknown
    human_judgment: true
    rationale: "Native render + visual distinctness + on-device navigation/refresh behaviour is not asserted by node:sqlite tests; deferred to on-device UAT per plan verification"

# Metrics
duration: 12min
completed: 2026-08-15
status: complete
---

# Phase 6 Plan 02: Events Writer + Interleaved Timeline Summary

**Immutable insert-only events DAO (archive/restore composed inside the existing lifecycle transaction, archived-state-guarded against spurious events) plus the profile's real interleaved touchpoint+event timeline with a deterministic cross-table tiebreak.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-08-15T20:00:00Z (approx)
- **Completed:** 2026-08-15T20:11:00Z
- **Tasks:** 3
- **Files modified:** 10 (5 created, 5 modified)

## Accomplishments
- Net-new `events-dao.ts`: immutable, insert-only writer grounding the dossier v1 vocabulary; `recordEventCore` is the non-mutexed composition primitive, `recordEvent` the mutexed wrapper — no update/edit path exists.
- Retrofitted `archiveContact`/`restoreContact` to emit real `archive`/`restore` events inside their ONE existing `inWriteTransaction`; added the C2-#1 archived-state guard so a no-op/wrong-state transition matches 0 rows, throws, and writes no spurious event. `last_contact` remains single-writer (DATA-04 intact).
- Purge now surfaces the events count in `impactSummaryLines` and still deletes events explicitly (dossier [log → crud]); added an archive→event→purge→gone round-trip test.
- `listTimeline` UNION-ALL interleave with a static `kind_order` final tiebreak makes an equal-occurred_at+equal-id cross-table collision deterministic; `TimelineRow` renders touchpoints vs read-only events distinctly; the profile stub is replaced with the real list loaded in the single unified `load()`.

## Task Commits

Each task was committed atomically:

1. **Task 1: events-dao.ts — immutable insert-only writer + vocabulary + test** — `bb29544` (feat)
2. **Task 2: retrofit archive/restore to emit events + surface events count in purge** — `5a1de51` (feat)
3. **Task 3: interleaved timeline read + TimelineRow + profile wiring** — `9ae3f85` (feat)

_TDD tasks 1 and 2 were committed as one feat commit each (test + implementation together, RED verified before GREEN)._

## Files Created/Modified
- `src/db/events-dao.ts` (created) — immutable events writer: EventType + recordEvent/recordEventCore; insert-only.
- `src/db/events-dao.test.ts` (created) — node:sqlite: one immutable row, core composes in an open transaction, archive/restore verbatim, detail NULL default.
- `src/db/timeline-read.ts` (created) — listTimeline + TimelineItem discriminated union; UNION-ALL, ?-bound, no transaction.
- `src/db/timeline-read.test.ts` (created) — interleave order, id-DESC tiebreak, cross-table collision, metadata passthrough, scoping, empty.
- `src/components/TimelineRow.tsx` (created) — pure presentational touchpoint-vs-event row; theme-token colours; testID `timeline-row-${kind}-${id}`.
- `src/db/contacts-dao.ts` (modified) — archive/restore emit events via recordEventCore; archived-state guard; deferral note retired; last_contact untouched.
- `src/db/contacts-dao.test.ts` (modified) — event-emission + no-op-transition zero-event cases.
- `src/db/purge-dao.ts` (modified) — impactSummaryLines events line; PurgeImpact/header notes updated; deletion logic unchanged.
- `src/db/purge-dao.test.ts` (modified) — updated impact cases + archive→event→purge round-trip.
- `src/screens/ContactProfileScreen.tsx` (modified) — real timeline in the unified load(); honest empty state; stub retired.

## Decisions Made
- Events DAO is insert-only by design; no `UPDATE events` in code (immutability contract).
- Shipped the C2-#1 archived-state guard (owner-approved default): redundant archive/restore now throws rather than silently re-stamping — required so the durable event log never records a false transition.
- Kept purge's explicit `DELETE FROM events` (dossier decision); did not rely on FK cascade (decorative with FKs off in the transaction).
- `kind_order` (touchpoint=1, event=0) as the deterministic final ORDER BY key; `${kind}-${id}` row identity for React key + testID.

## Deviations from Plan

None - plan executed exactly as written. (The C2-#1 archived-state guard and its behaviour change were specified in the plan and owner-approved; not a deviation.)

## Issues Encountered
- Biome flagged import ordering on the new imports (type-in-import position and alpha order). Resolved with `biome check --write`; final `biome check src` is clean across 128 files.

## Verification Results
- `npx vitest run` — 39 files, **451 tests passed** (baseline was 435; +16 new). Includes events-dao, contacts-dao, purge-dao, timeline-read suites.
- `npx tsc --noEmit` — clean (exit 0).
- `npm run check:colors` — clean (exit 0); every colour resolves through theme tokens.
- `npx biome check src` — clean, 128 files, no fixes.
- Single-writer grep — only `src/db/recency-dao.ts` contains a `last_contact =` SET; contacts-dao mentions are comments/reads.
- On-device (Pixel) UAT — deferred to the phase verification step (native render, read-only visual distinctness, purge-impact copy).

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- LOG-02 complete: the events writer (archive/restore) and the read half both landed; snooze/unsnooze are reserved in the vocabulary with no producer yet (later phase).
- Plan 03 can hang edit/delete affordances off `TimelineRow`'s touchpoint branch — it is purely presentational with no DAO import, as designed.
- On-device UAT is the only outstanding verification for this plan's UI surface.

## Self-Check: PASSED

All created files present on disk (events-dao.ts, events-dao.test.ts, timeline-read.ts, timeline-read.test.ts, TimelineRow.tsx, 06-02-SUMMARY.md) and all three task commits (bb29544, 5a1de51, 9ae3f85) exist in git history.

---
*Phase: 06-interaction-log-status-impact*
*Completed: 2026-08-15*
