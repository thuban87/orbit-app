---
phase: 15-weekly-digest
plan: 01
subsystem: database
tags: [sqlite, digest, read-only-dao, status-engine, node-sqlite, vitest, timezone]

# Dependency graph
requires:
  - phase: 08-dashboard
    provides: countNeverContacted (dashboard-read.ts) — the backlog count, reused verbatim
  - phase: 09-orrery
    provides: PROGRESS_SQL / STATUS_SQL / REASON_SQL / ROGUE_K (status.ts) — the single shared rogue/status engine, read never recomputed
provides:
  - "readRetrospective — per-person, all-touchpoints, 7-day-inclusive reached-this-week read"
  - "readOverlooked — STATUS_SQL='rogue' read with the mute filter omitted (muted rogue present), split by REASON in logic"
  - "readGentleLine — good/fine/hard tally over a wider effortful window + distinct hard people"
  - "digest-logic.ts pure transforms + five owner-tunable thresholds (windowModifier, dayTag, splitOverlooked, capGroup, shouldShowEffortful, isAllQuiet)"
affects: [15-02 digest screen, 15-02 digest schedule/notification, 16-backup-export]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Read-only digest DAO: async getAllAsync/getFirstAsync only, no transaction, no network; import status.ts SQL constants, never re-derive"
    - "Overlooked = inverse of decay-suppression: query STATUS_SQL='rogue' directly, OMIT reminders_off, pre-filter last_contact IS NOT NULL"
    - "Window via windowModifier(integer tunable) → date('now','localtime','-N days'); bare date(stored); never toISOString"
    - "Pure src/logic/*-logic.ts transforms + top-of-file tunables for node-side threshold proof"

key-files:
  created:
    - src/logic/digest-logic.ts
    - src/logic/digest-logic.test.ts
    - src/db/digest-read.ts
    - src/db/digest-read.test.ts
  modified: []

key-decisions:
  - "Seed the digest-read node:sqlite tests with migration001 ONLY (creates contacts + interactions — the only tables these reads touch); migrations 002-004 add app_settings columns the reads never read. Matches the closest analog, dashboard-read.test.ts."
  - "readGentleLine returns a neutral {hard, total, people} tally; the show decision stays in shouldShowEffortful (screen), so the DAO makes no policy judgment."
  - "splitOverlooked/capGroup are generic over row shape so the same transforms serve the OverlookedRow list without a coupling to the DAO row type."

patterns-established:
  - "Digest reads interpolate ONLY code-constants (status fragments) + an integer-derived window modifier; zero user free-text reaches SQL (T-15-01 mitigation)."
  - "Evening-boundary dayTag assertion is the UTC-safety proof (no comment-fragile grep)."

requirements-completed: [DGST-02, DGST-03]

coverage:
  - id: D1
    description: "readRetrospective — one row per non-archived contact with ANY interaction in the trailing 7-day inclusive window (no connected/direction predicate), collapsed to MAX(occurred_at), most-recent-first"
    requirement: DGST-02
    verification:
      - kind: unit
        ref: "src/db/digest-read.test.ts#readRetrospective"
        status: pass
    human_judgment: false
  - id: D2
    description: "readOverlooked — STATUS_SQL='rogue' with the mute filter OMITTED (muted rogue present), archived + never-contacted excluded, ordered most-slipped-first; reason drives Drifting vs Gone quiet"
    requirement: DGST-02
    verification:
      - kind: unit
        ref: "src/db/digest-read.test.ts#readOverlooked"
        status: pass
    human_judgment: false
  - id: D3
    description: "readGentleLine — good/fine/hard tally over the wider effortful window (archived + NULL excluded) + distinct hard people; neutral tally, show decision deferred"
    requirement: DGST-03
    verification:
      - kind: unit
        ref: "src/db/digest-read.test.ts#readGentleLine"
        status: pass
    human_judgment: false
  - id: D4
    description: "digest-logic pure transforms + tunables: windowModifier (integer-guarded), dayTag (UTC-safe local weekday), splitOverlooked (reason-only), capGroup (cap+overflow), shouldShowEffortful (conservative dual gate), isAllQuiet"
    requirement: DGST-03
    verification:
      - kind: unit
        ref: "src/logic/digest-logic.test.ts"
        status: pass
    human_judgment: false
  - id: D5
    description: "Backlog count parity — countNeverContacted (dashboard-read.ts) reused verbatim, matches the seeded non-archived never-contacted population"
    requirement: DGST-02
    verification:
      - kind: unit
        ref: "src/db/digest-read.test.ts#backlog parity"
        status: pass
    human_judgment: false

# Metrics
duration: 6min
completed: 2026-08-23
status: complete
---

# Phase 15 Plan 01: Weekly Digest Reads + Logic Summary

**Three node-proven read-only digest DAOs (retrospective / overlooked / gentle line) plus a pure transform module, wiring the shared status-engine constants and a conservative effortful gate — with the overlooked read built as the deliberate inverse of the decay-suppression predicate so muted rogue contacts still surface.**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-08-23T22:35:00Z
- **Completed:** 2026-08-23T22:41:33Z
- **Tasks:** 2
- **Files created:** 4

## Accomplishments
- `src/db/digest-read.ts` — the three read-only queries: `readRetrospective` (all-touchpoints, 7-day inclusive, per-person, most-recent-first), `readOverlooked` (`STATUS_SQL='rogue'` with the mute filter omitted, `last_contact IS NOT NULL` guard, ordered most-slipped-first), and `readGentleLine` (good/fine/hard tally over the wider effortful window + distinct hard people).
- `src/logic/digest-logic.ts` — five owner-tunable thresholds at the top of the file and six pure transforms: `windowModifier`, `dayTag`, `splitOverlooked`, `capGroup`, `shouldShowEffortful` (conservative dual gate), `isAllQuiet`.
- 32 vitest cases (18 logic + 14 node:sqlite DAO), all green; `tsc --noEmit`, `check:colors`, and biome all clean on the four touched files.
- The muted-rogue-present DAO assertion behaviourally proves the overlooked read does NOT reuse the decay-suppression predicate; the evening-boundary `dayTag` assertion proves UTC-safety — neither relies on a comment-fragile grep.

## Task Commits

Each task was committed atomically (TDD: failing test authored first and RED confirmed, then implementation, committed together as one `feat` per task):

1. **Task 1: Pure digest logic + tunables** - `799a1b6` (feat)
2. **Task 2: The three read-only DAOs** - `173c51e` (feat)

**Plan metadata:** _(this docs commit)_

## Files Created/Modified
- `src/logic/digest-logic.ts` - Tunables (RETROSPECTIVE_WINDOW_DAYS, EFFORTFUL_WINDOW_DAYS, GROUP_CAP, EFFORTFUL_MIN_HARD, EFFORTFUL_MIN_FRACTION) + the six pure transforms.
- `src/logic/digest-logic.test.ts` - 18 cases covering the dual gate, reason-only split, cap/overflow, and the UTC-safe day tag.
- `src/db/digest-read.ts` - The three read-only DAOs importing PROGRESS/STATUS/REASON from status.ts and windowModifier from digest-logic.ts.
- `src/db/digest-read.test.ts` - 14 node:sqlite cases (migration001 seed) proving window edges, all-touchpoints, muted-rogue-present, reason split, gentle tally, and backlog parity.

## Decisions Made
- **Test seed uses migration001 only.** The three reads touch exactly `contacts` and `interactions`, both created by migration001; migrations 002-004 only add `app_settings` columns the digest reads never read. This matches the strongest analog (`dashboard-read.test.ts`, which seeds migration001 alone) and keeps the harness minimal. The plan text suggested "001-004"; migration001 is the correct minimal seed for a contacts/interactions read and is an implementation detail in the executor's bucket. No behavioural coverage is lost.
- **readGentleLine stays neutral.** It returns `{hard, total, people}` and defers the show/hide policy to `shouldShowEffortful` (screen), keeping the DAO free of threshold policy.
- **Generic transforms.** `splitOverlooked`/`capGroup` are generic over row shape (constrained only to `{reason}` where needed) so they compose with the DAO row types without importing them.

## Deviations from Plan

None affecting behaviour. The only variance from the plan's literal wording is the test seed scope (migration001 vs "001-004"), documented under Decisions Made — a harness detail, not a correctness change; every specified acceptance test is present and green.

## Issues Encountered
None. Biome reported import-sort/format nits on first write, auto-fixed with `biome check --write`; tests re-confirmed green afterward.

## Next Phase Readiness
- The digest data engine is complete and node-proven. Plan 15-02 (the `DigestScreen.tsx` + WEEKLY schedule + migration 005 `digest_enabled` + Settings/dashboard entries) can consume these three reads plus `countNeverContacted` directly.
- Screen-side composition still needs: `dayTag` applied to each retrospective row, `splitOverlooked`+`capGroup` over `readOverlooked`, `shouldShowEffortful` over `readGentleLine`, and `isAllQuiet` fed all four counts.
- No blockers. The migration-005 escalation is already owner-ruled (CONTEXT §Persistence) and belongs to 15-02.

## Self-Check: PASSED

All four source/test files and the SUMMARY exist on disk; both task commits (`799a1b6`, `173c51e`) are present in git history.

---
*Phase: 15-weekly-digest*
*Completed: 2026-08-23*
