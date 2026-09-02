---
phase: 02-data-foundation-status-engine
plan: 03
subsystem: database
tags: [sqlite, recency, single-writer, mutex, concurrency, transactions, tdd, data-04]

# Dependency graph
requires:
  - phase: 02-data-foundation-status-engine
    plan: 02
    provides: "Migration 1 schema (contacts.last_contact/rarely_responds, interactions.occurred_at/connected), openTestDb + nodeSqliteExecutor testkit, localDateTime()"
  - phase: 02-data-foundation-status-engine
    plan: 01
    provides: "SqlExecutor contract, runMigrations, node:sqlite testkit"
provides:
  - "withMutex — the ONE shared module-level promise-chain that serializes every last_contact write (foreground + Phase-11/12 headless)"
  - "recency-dao — THE single writer of contacts.last_contact: recordTouchpoint / editTouchpoint / deleteTouchpoint / createContactWithInteraction"
  - "recomputeLastContact SQL invariant: last_contact = MAX(occurred_at) over current rows, connected-only for rarely_responds, NULL when none"
  - "Local wall-clock timestamp write contract for occurred_at/last_contact (DATA-05 status reads these as already-local)"
affects: [02-04, 02-05, 02-06, status-engine, crud, log, notifications, widget, merge]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Module-level promise-chain mutex (chain.then(fn, fn); chain = run.catch(()=>{})) — one instance per JS runtime, zero deps"
    - "Hand-rolled BEGIN/try-COMMIT/catch-ROLLBACK+rethrow inside withMutex; never expo withTransactionAsync (P3/P4)"
    - "Single correlated UPDATE recomputes last_contact = MAX over current rows; rarely_responds connected-only filter expressed in SQL, no separate read"
    - "All values bound with ? (T-02-06); injected uid/now inputs keep the DAO deterministic and side-effect-free"

key-files:
  created:
    - src/db/mutex.ts
    - src/db/mutex.test.ts
    - src/db/recency-dao.ts
    - src/db/recency-dao.test.ts
  modified: []

key-decisions:
  - "recency-dao.ts is declared in its header as THE ONLY writer of contacts.last_contact; the recompute UPDATE lives nowhere else (verified by grep)"
  - "recompute is a MAX over CURRENT rows via correlated subquery — not last-write-wins — so any insert/edit/delete is correct without special-casing the touched row"
  - "rarely_responds connected-only filter (contacts.rarely_responds = 0 OR i.connected = 1) is IN the SQL, so no separate flag read; no qualifying row yields NULL"
  - "editTouchpoint edits the recency-relevant fields (occurred_at, connected via COALESCE); cosmetic-field edits are out of DATA-04 scope and belong to the CRUD/log phase, which will route recency-affecting writes through here"
  - "DAO accepts caller-supplied uid + now (local wall-clock) rather than minting them — deterministic tests, and it upholds the local-timestamp contract by storing given strings verbatim (no date math, no toISOString)"

patterns-established:
  - "inWriteTransaction(exec, body) helper: withMutex + hand-rolled BEGIN/COMMIT/ROLLBACK — the reuse point every recency write and future headless writer shares"
  - "recomputeLastContact(exec, contactId, now): the single recompute call every mutation ends with"

requirements-completed: [DATA-04]

coverage:
  - id: R1
    description: "recordTouchpoint: newer occurred_at advances last_contact; older leaves it unchanged (MAX over current rows, not last-write-wins)"
    requirement: "DATA-04"
    verification:
      - kind: unit
        ref: "src/db/recency-dao.test.ts#advances last_contact when a newer occurred_at is recorded"
        status: pass
      - kind: unit
        ref: "src/db/recency-dao.test.ts#leaves last_contact unchanged when an OLDER occurred_at is recorded"
        status: pass
    human_judgment: false
  - id: R2
    description: "editTouchpoint lowering the newest row moves last_contact to the next-highest current row"
    requirement: "DATA-04"
    verification:
      - kind: unit
        ref: "src/db/recency-dao.test.ts#moves last_contact back to the next-highest row when an edit lowers the newest"
        status: pass
    human_judgment: false
  - id: R3
    description: "deleteTouchpoint recomputes to remaining MAX; deleting the only row sets last_contact NULL"
    requirement: "DATA-04"
    verification:
      - kind: unit
        ref: "src/db/recency-dao.test.ts#recomputes to the remaining max when the newest row is deleted"
        status: pass
      - kind: unit
        ref: "src/db/recency-dao.test.ts#sets last_contact NULL when the only interaction is deleted"
        status: pass
    human_judgment: false
  - id: R4
    description: "rarely_responds contact: MAX over connected rows only; a non-connecting attempt does not move recency; only-non-connecting → NULL"
    requirement: "DATA-04"
    verification:
      - kind: unit
        ref: "src/db/recency-dao.test.ts#counts only connected rows and ignores a later non-connecting attempt"
        status: pass
      - kind: unit
        ref: "src/db/recency-dao.test.ts#keeps last_contact NULL for a rarely_responds contact with only non-connecting attempts"
        status: pass
      - kind: unit
        ref: "src/db/recency-dao.test.ts#counts non-connecting rows for a NORMAL (not rarely_responds) contact"
        status: pass
    human_judgment: false
  - id: R5
    description: "createContactWithInteraction writes contact + first interaction in one transaction; 'not yet' path writes no interaction and leaves last_contact NULL"
    requirement: "DATA-04"
    verification:
      - kind: unit
        ref: "src/db/recency-dao.test.ts#creates a contact and its first interaction in one step, setting last_contact"
        status: pass
      - kind: unit
        ref: "src/db/recency-dao.test.ts#writes no interaction and leaves last_contact NULL on the 'not yet / don't know' path"
        status: pass
    human_judgment: false
  - id: R6
    description: "A forced failure inside a write rolls the whole transaction back (no row, no last_contact change)"
    requirement: "DATA-04"
    verification:
      - kind: unit
        ref: "src/db/recency-dao.test.ts#rolls back the whole write when the interaction insert fails"
        status: pass
    human_judgment: false
  - id: R7
    description: "Concurrent writes serialize through the shared mutex: both land, final last_contact is the true MAX"
    requirement: "DATA-04"
    verification:
      - kind: unit
        ref: "src/db/recency-dao.test.ts#serializes concurrent writes so both land and last_contact is the true MAX"
        status: pass
      - kind: unit
        ref: "src/db/mutex.test.ts#runs queued operations strictly one after another"
        status: pass
    human_judgment: false
  - id: R8
    description: "Mutex rejection isolation: a rejected op does not break the chain; values/errors propagate to the caller"
    requirement: "DATA-04"
    verification:
      - kind: unit
        ref: "src/db/mutex.test.ts#keeps the chain alive after a rejected operation"
        status: pass
      - kind: unit
        ref: "src/db/mutex.test.ts#still serializes the operation queued after a rejection"
        status: pass
    human_judgment: false
  - id: R9
    description: "occurred_at round-trips as the same local wall-clock string (no UTC day shift); last_contact inherits it (DATA-05 contract)"
    requirement: "DATA-04"
    verification:
      - kind: unit
        ref: "src/db/recency-dao.test.ts#round-trips occurred_at as the same local string, with no UTC day shift"
        status: pass
    human_judgment: false
  - id: R10
    description: "recency-dao is the sole writer of last_contact; no expo transaction wrapper is called in the DAO"
    requirement: "DATA-04"
    verification:
      - kind: static
        ref: "grep -rln 'last_contact = (' src/db | grep -v recency-dao → empty"
        status: pass
      - kind: static
        ref: "grep -cE 'withTransactionAsync\\(|withExclusiveTransactionAsync\\(' src/db/recency-dao.ts → 0"
        status: pass
    human_judgment: false

# Metrics
duration: 5min
completed: 2026-08-14
status: complete
---

# Phase 2 Plan 03: Single-writer recency spine + shared mutex Summary

**`recency-dao.ts` is now THE ONLY module that writes `contacts.last_contact`: every record/edit/delete/create recomputes it as `MAX(occurred_at)` over the contact's CURRENT interaction rows (connected-only for "Rarely responds") via one correlated UPDATE, inside a hand-rolled BEGIN/COMMIT/ROLLBACK transaction serialized through the ONE shared `withMutex` promise-chain — proven node-side with an 18-case (5 mutex + 13 DAO) test covering MAX recompute, connected-only, NULL, atomic multi-row create, rollback, concurrency serialization, and the local wall-clock round-trip.**

## Performance
- **Duration:** ~5 min
- **Started:** 2026-08-14T22:16:32Z
- **Completed:** 2026-08-14T22:21Z
- **Tasks:** 2
- **Files modified:** 4 (4 created, 0 modified)

## Accomplishments
- `src/db/mutex.ts` — `withMutex<T>(fn)`: one module-level `chain` promise; `run = chain.then(fn, fn)` runs the op regardless of the prior outcome, `chain = run.catch(() => {})` keeps a rejection from breaking the chain, and `run` propagates the value/error to the caller. One instance per JS runtime, imported by foreground AND the future headless writers so they share the single mutex. Zero dependencies (RESEARCH rejects `async-mutex`).
- `src/db/recency-dao.ts` — the single-writer recency DAO. Exports `recordTouchpoint`, `editTouchpoint`, `deleteTouchpoint`, `createContactWithInteraction`, each `(exec, input)`. A private `inWriteTransaction` helper wraps every write in `withMutex(...)` + a hand-rolled `BEGIN` / try-`COMMIT` / catch-`ROLLBACK().catch()`+rethrow. A private `recomputeLastContact` issues the ONE correlated UPDATE setting `last_contact = (SELECT MAX(i.occurred_at) FROM interactions i WHERE i.contact_id = contacts.id AND (contacts.rarely_responds = 0 OR i.connected = 1))` + `modified_at`. Every value bound with `?`.
- `src/db/mutex.test.ts` — 5 cases: strict serialization (interleaving log + deferred gate), chain survives a rejection, serialization still holds after a rejection, and value/error propagation.
- `src/db/recency-dao.test.ts` — 13 cases driven through the REAL migration-1 fixture + REAL DAO: newer-advances / older-unchanged, edit-lowers-newest, delete-newest / delete-only, connected-only + non-connecting-ignored + normal-counts-non-connecting, atomic create + "not yet" NULL, rollback-on-duplicate-uid, concurrent-writes-serialize, and the evening-local-time round-trip.

## Task Commits
Each task was committed atomically:
1. **Task 1: shared promise-chain write mutex** — `6aecf40` (feat)
2. **Task 2: single-writer recency DAO** — `b989781` (feat)

_Plan-level `tdd` tags: for each task the failing test was written and run RED first (Task 1 failed on the missing `@/db/mutex` module; Task 2's cases were authored against the not-yet-existent DAO), then the implementation made it GREEN. Because Biome enforces spaces-over-tabs and reformatted the new files, the RED test and GREEN implementation for each task are committed together as one `feat(...)` commit rather than split RED/GREEN commits — `tdd_mode` is false at the phase level (init), so the plan-level MVP+TDD gate does not apply._

## Files Created/Modified
- `src/db/mutex.ts` — shared module-level promise-chain mutex (`withMutex`)
- `src/db/mutex.test.ts` — serialization + rejection-isolation + propagation proof
- `src/db/recency-dao.ts` — THE single writer of `contacts.last_contact`
- `src/db/recency-dao.test.ts` — MAX-recompute + connected-only + NULL + atomicity + rollback + serialization + timestamp round-trip proof

## Decisions Made
- **`recency-dao.ts` is THE ONLY writer of `contacts.last_contact`**, declared in its header and verified by grep — the recompute UPDATE appears nowhere else in `src/db`. This is the load-bearing cross-phase invariant every touchpoint route (CRUD, log, notifications, widget) will reuse.
- **Recompute is a MAX over CURRENT rows via a correlated subquery, not last-write-wins.** Correcting or deleting a non-newest row must not move recency, and lowering the newest row must move it back to the next-highest remaining row — a single UPDATE handles every mutation without special-casing which row changed.
- **The rarely_responds connected-only filter is expressed IN THE SQL** (`contacts.rarely_responds = 0 OR i.connected = 1`), correlating the contact flag with interaction rows without a separate read; no qualifying row yields NULL.
- **`editTouchpoint` scopes to the recency-relevant fields** (`occurred_at`, and `connected` via COALESCE to preserve the stored value when omitted). Cosmetic-field edits (note/quality/channel) are out of DATA-04's recency scope and belong to the CRUD/log phase, which will route any recency-affecting write back through this DAO.
- **The DAO accepts caller-supplied `uid` + `now` (local wall-clock) rather than minting them.** This keeps tests deterministic and, critically, upholds the local-timestamp contract: the DAO stores the strings it is given verbatim and copies them into `last_contact` via SQL `MAX` — it does no date math and never calls `toISOString()` / bare `date('now')`.

## Deviations from Plan
None — plan executed exactly as written. All four file paths, the four DAO exports, the `(exec, input)` signature, the correlated-subquery recompute, the hand-rolled-transaction-inside-`withMutex` shape, and the timestamp write-contract header + round-trip test match the plan and RESEARCH §Code Example 2. Biome applied formatting-only safe fixes (tabs→spaces, line wrapping) to all four new files before their commits; no logic changed. The plan's inline RESEARCH snippet used placeholder column names (`rarely`, `connected`) with an explicit "shown inline for clarity / pass rarely via a CTE or read the flag first" note; the real correlated-subquery form against the true columns (`contacts.rarely_responds`, `i.connected`) is what the plan's own prose in the `<action>` block specifies, and is what was implemented.

## Issues Encountered
- Biome enforces spaces (the repo style); the initially tab-indented new files were normalized with `biome check --write` (safe/formatting fixes only) before each commit, matching Plan 02's precedent. The pre-existing `biome.json` `recommended`-field deprecation INFO is out of scope (unrelated config file, noted in Plans 01/02) and was left untouched.

## Verification
- `npx vitest run` — 8 files / 91 tests pass (18 new: 5 in `mutex.test.ts`, 13 in `recency-dao.test.ts`).
- `npx tsc --noEmit` — clean.
- `npx biome check .` — clean (only the out-of-scope `biome.json` deprecation INFO).
- `grep -rln "last_contact = (" src/db | grep -v recency-dao` → empty (recency-dao is the sole writer).
- `grep -cE "withTransactionAsync\(|withExclusiveTransactionAsync\(" src/db/recency-dao.ts` → 0 (no expo transaction wrapper called).

## Next Phase Readiness
- Plan 04 (DATA-05 status) can read `contacts.last_contact` as an already-local wall-clock string (`date(last_contact, 'localtime')` truncates idempotently) — the recency writer upholds the contract as long as callers pass local timestamps.
- The `inWriteTransaction` + shared `withMutex` pattern is the reuse point for Phases 11/12 headless notification/widget writers — they import the SAME `mutex.ts` so their writes serialize with the foreground.
- Node:sqlite (3.51.2) is a semantics harness only. Plan 06 still owes the on-device assertions on the Pixel (PRAGMA-before-transaction ordering, FK cascade, `date('now','localtime')`), which cover this DAO's transactions on Android/bionic too (P1/P6).

## Known Stubs
None — every exported function is fully wired against the migration-1 tables and asserted end to end. `editTouchpoint`'s field scope is a documented DATA-04-scope decision, not a stub.

## Threat Flags
None — no new network endpoint, auth path, file access, or schema change was introduced; this plan reads/writes only the existing migration-1 `contacts` and `interactions` tables. The plan's threat register (T-02-06 parameterization, T-02-07 mutex/hand-rolled txn, T-02-08 MAX-current-rows/connected-only) is fully mitigated and asserted.

## Self-Check: PASSED

---
*Phase: 02-data-foundation-status-engine*
*Completed: 2026-08-14*
