---
phase: 02-data-foundation-status-engine
plan: 04
subsystem: database
tags: [sqlite, status-engine, query-time, derived-never-stored, timezone, window-functions, tdd, data-05]

# Dependency graph
requires:
  - phase: 02-data-foundation-status-engine
    plan: 02
    provides: "Migration 1 schema (contacts.interval_days/last_contact/rarely_responds/archived_at, interactions.occurred_at/id/channel + idx_interactions_recency), openTestDb + nodeSqliteExecutor testkit"
  - phase: 02-data-foundation-status-engine
    plan: 03
    provides: "Single-writer recency DAO writes last_contact/occurred_at as LOCAL wall-clock strings — the stored-value-is-already-local contract this plan's SQL depends on"
provides:
  - "STABLE_MAX/WOBBLE_MAX/ROGUE_K thresholds — the query-time engine's single source, shared-by-convention with src/types.ts calculateStatus()"
  - "PROGRESS_SQL — continuous elapsed÷interval, day-granular at local midnight, no stored-column re-conversion (fixes the timezone double-conversion HIGH)"
  - "STATUS_SQL — 4-bucket CASE (stable/wobble/decay/rogue) + rarely_responds rogue path; derived-never-stored"
  - "STATUS_SCAN — dashboard scan excluding never-contacted + archived, ORDER BY progress DESC"
  - "NEWEST_PER_CONTACT (window form) + NEWEST_FOR_CONTACT (indexed head) — occurred_at DESC / id DESC tiebreak (Plan 06 benchmark targets)"
  - "statusOrder — rogue<decay<wobble<stable<snoozed JS sort rank"
affects: [02-05, 02-06, dashboard, orrery, log, ai, status-engine]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Derived-never-stored: status/progress are SQL string constants evaluated in the SELECT; the module issues no write (a test asserts no UPDATE/INSERT/ALTER)"
    - "Timezone asymmetry: date('now','localtime') on now (a true UTC instant) vs date(last_contact) with NO modifier (already-local stored value) — truncating both sides gives day-granular buckets without double-converting"
    - "Threshold single-source-by-convention: SQL can't import a TS fn, so STABLE_MAX/WOBBLE_MAX carry a header comment naming src/types.ts:112/:117 as the drift counterpart"
    - "Window ROW_NUMBER() OVER (PARTITION BY contact_id ORDER BY occurred_at DESC, id DESC) for the all-contacts newest scan; indexed ORDER BY ... LIMIT 1 for the single-contact head"
    - "Static SQL fragments interpolate only code-constants; the sole runtime value (contact_id) is ?-bound"

key-files:
  created:
    - src/db/status.ts
    - src/db/status.test.ts
    - src/db/queries.ts
    - src/db/queries.test.ts
  modified: []

key-decisions:
  - "DEPARTED from RESEARCH §Code Example 3: dropped the 'localtime' modifier on the STORED last_contact — that form double-converted an already-local value and day-shifted late-night rows a day early (review HIGH)"
  - "ROGUE_K = 3 (rogue at >= 3x interval) as a top-of-file tunable; rogue is also the rarely_responds path at progress >= 1.0"
  - "Threshold drift handled by documented convention (header comments both sides), not a shared export — SQL cannot import the TS calculateStatus() constants (review LOW, accepted mitigation)"
  - "STATUS_SQL alone buckets NULL last_contact as stable; kept a defensive comment because the only Phase-2 consumer STATUS_SCAN pre-filters NULL (review LOW)"

patterns-established:
  - "Derived-never-stored status: no status/progress column is ever written; a self-referential test greps the module source for write statements"
  - "Local-midnight day-granular progress with single-side localtime conversion"

requirements-completed: [DATA-05]

coverage:
  - id: D1
    description: "Query-time status buckets at 0.8 (wobble) / 1.0 (decay) / ROGUE_K (rogue) over continuous elapsed÷interval progress; rarely_responds promotes to rogue at progress>=1.0"
    requirement: "DATA-05"
    verification:
      - kind: unit
        ref: "src/db/status.test.ts#STATUS_SQL buckets (elapsed ÷ interval)"
        status: pass
      - kind: unit
        ref: "src/db/status.test.ts#rarely_responds → rogue non-time path"
        status: pass
    human_judgment: false
  - id: D2
    description: "Progress resolves day-granular at local midnight with NO stored-column re-conversion (near-midnight regression: stored 00:30:00 does not day-shift)"
    requirement: "DATA-05"
    verification:
      - kind: unit
        ref: "src/db/status.test.ts#day-granular resolution at local midnight"
        status: pass
      - kind: unit
        ref: "src/db/status.test.ts#derived-never-stored > does not re-convert the stored column"
        status: pass
    human_judgment: false
  - id: D3
    description: "Status is derived-never-stored — the status module issues no write statement"
    requirement: "DATA-05"
    verification:
      - kind: unit
        ref: "src/db/status.test.ts#derived-never-stored > status.ts issues no write statement"
        status: pass
    human_judgment: false
  - id: D4
    description: "STATUS_SCAN excludes never-contacted + archived and orders by progress DESC; NEWEST_PER_CONTACT / NEWEST_FOR_CONTACT resolve the occurred_at DESC / id DESC tiebreak; statusOrder ranks rogue first"
    requirement: "DATA-05"
    verification:
      - kind: unit
        ref: "src/db/queries.test.ts#STATUS_SCAN"
        status: pass
      - kind: unit
        ref: "src/db/queries.test.ts#NEWEST_PER_CONTACT"
        status: pass
      - kind: unit
        ref: "src/db/queries.test.ts#NEWEST_FOR_CONTACT"
        status: pass
      - kind: unit
        ref: "src/db/queries.test.ts#statusOrder"
        status: pass
    human_judgment: false

# Metrics
duration: 8min
completed: 2026-08-14
status: complete
---

# Phase 2 Plan 04: Query-Time Status Engine Summary

**Status and continuous progress are computed in the SELECT from `date('now','localtime')` and `interval_days` and never stored — with the stored, already-local `last_contact` deliberately NOT re-run through `localtime`, closing the review HIGH that day-shifted late-night rows.**

## Performance

- **Duration:** ~8 min
- **Tasks:** 2 (both TDD: RED → GREEN)
- **Files modified:** 4 created

## Accomplishments
- `src/db/status.ts`: shared thresholds (`STABLE_MAX`/`WOBBLE_MAX`/`ROGUE_K`) + `PROGRESS_SQL` + `STATUS_SQL`, derived-never-stored, with the timezone-asymmetry fix and a full comment trail for the three review findings (HIGH tz double-conversion, LOW threshold drift, LOW NULL-buckets-stable).
- `src/db/queries.ts`: `STATUS_SCAN` (excludes never-contacted + archived, progress DESC), `NEWEST_PER_CONTACT` (window form), `NEWEST_FOR_CONTACT` (indexed head, `?`-bound contact_id), and `statusOrder` extended with `rogue` first.
- 21 new tests (13 status + 8 queries), all green; full suite 112 passed. Plan verification greps all pass (no status column written; stored no-modifier form present; bare `date('now')` absent).

## Task Commits

1. **Task 1: status thresholds + SQL fragments (TDD)** — `7d325a4` (test RED) → `dd7fd99` (feat GREEN)
2. **Task 2: read queries — scan + newest-per-contact + sort (TDD)** — `9eafaaf` (test RED) → `a80df78` (feat GREEN)

_TDD: test → feat per task; no refactor commit needed (implementation clean on first GREEN)._

## Files Created/Modified
- `src/db/status.ts` — Query-time thresholds + PROGRESS_SQL/STATUS_SQL fragments; derived-never-stored; timezone-asymmetry documented.
- `src/db/status.test.ts` — Bucket boundaries, rarely_responds→rogue, day-granular equality, near-midnight regression, no-write assertion.
- `src/db/queries.ts` — STATUS_SCAN, NEWEST_PER_CONTACT, NEWEST_FOR_CONTACT, statusOrder.
- `src/db/queries.test.ts` — Never-contacted/archived exclusion, progress-DESC order, id-DESC tiebreak, statusOrder ranking.

## Decisions Made
- **Dropped the `'localtime'` modifier on the stored `last_contact`** (the plan's load-bearing correction to RESEARCH Code Example 3). The stored value is already local wall-clock (written by the Plan 03 DAO via `formatLocalDate()`); re-converting it would treat it as UTC and shift late-night rows a calendar day early. Only `now` — a true UTC instant — is converted. A named near-midnight regression test (`00:30:00` vs `23:30:00` same-day) proves no day-shift.
- **Threshold drift by documented convention, not a shared export.** SQL cannot import `calculateStatus()`'s inline `0.8`/`1.0`; header comments on both sides (`status.ts` ↔ `src/types.ts:112/:117`) name the counterpart so tuning one prompts the other.
- **Kept the "NULL buckets as stable" defensive comment.** `STATUS_SQL` alone would label never-contacted as stable; safe only because `STATUS_SCAN` pre-filters `last_contact IS NULL`. A future standalone caller is warned in-comment to filter first.

## Deviations from Plan

None - plan executed exactly as written. (The single-side `localtime` form was specified by the plan itself as the correction to RESEARCH Code Example 3, so it is not a deviation.)

## Issues Encountered
Biome import-ordering auto-fix applied to both test files after creation (safe, whitespace-only reordering); re-verified green.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Plan 05 (launch sweep) and Plan 06 (DATA-07 benchmarks) can now consume `STATUS_SCAN` and `NEWEST_PER_CONTACT`/`NEWEST_FOR_CONTACT` directly.
- No new runtime dependencies; all SQL is node:sqlite-tested and parameterized.

## Self-Check: PASSED
- FOUND: src/db/status.ts, src/db/status.test.ts, src/db/queries.ts, src/db/queries.test.ts
- FOUND commits: 7d325a4, dd7fd99, 9eafaaf, a80df78
- Full suite: 112 passed; tsc + biome clean; plan verification greps pass.

---
*Phase: 02-data-foundation-status-engine*
*Completed: 2026-08-14*
