---
phase: 11-actionable-notifications
plan: 03
subsystem: database
tags: [sqlite, dao, snooze, events, single-writer, mutex, notifications]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: "inWriteTransaction (shared non-reentrant mutex), SqlExecutor contract, node:sqlite test adapter, migration runner"
  - phase: 03-log
    provides: "events-dao recordEventCore (non-mutexed immutable-insert core) + reserved snooze/unsnooze EventType"
  - phase: 08-dashboard
    provides: "favourites-dao single-column ?-bound UPDATE + changes===1 guard idiom; dashboard-read.ts:33 SNOOZE STORAGE CONTRACT"
provides:
  - "snooze-dao: snoozeContact (set snooze_until per preset + immutable snooze event) and clearSnooze (NULL + always an unsnooze event), each in ONE inWriteTransaction"
  - "PRESET_MODIFIERS top-of-file tunable ({3d:+3 days, 1w:+7 days, 1m:+1 month}) — single source for preset lengths"
  - "First writer of contacts.snooze_until (local YYYY-MM-DD via date('now','localtime', <modifier>)) and first producer of snooze/unsnooze events — activates the dashboard snoozed count + 'snoozed' filter"
affects: [11-07-headless-actions, 11-09-profile-snooze-ui, 08-dashboard]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Compose two writes in ONE transaction via the non-mutexed core (recordEventCore) — never nest inWriteTransaction (permanent hang)"
    - "Derive a stored local date inside SQLite (date('now','localtime', ?)) rather than JS — calendar-correct '+1 month', local, never toISOString"
    - "Single-column ?-bound UPDATE + changes===1 loud-failure guard; never touch another DAO's column (last_contact stays recency-dao's)"

key-files:
  created:
    - src/db/snooze-dao.ts
    - src/db/snooze-dao.test.ts
  modified: []

key-decisions:
  - "snooze_until is computed by SQLite via date('now','localtime', <modifier>), not from the caller's `now` — keeps '+1 month' calendar-correct and local, honouring the bare-date() dashboard contract without JS month math or toISOString."
  - "clearSnooze's uid is REQUIRED and the unsnooze insert is unconditional (review item 10) — the events log is the only recovery mechanism, so every clear leaves an audit row even when the contact was never snoozed."
  - "The events row is composed with recordEventCore (non-mutexed core) inside the one inWriteTransaction — never the mutexed recordEvent wrapper, which would nest the non-reentrant mutex and hang permanently."

patterns-established:
  - "First writer of contacts.snooze_until: local YYYY-MM-DD string comparable via bare date(snooze_until) <= date('now','localtime') — a future snooze reads as still snoozed."
  - "Both the in-app profile presets (3d/1w/1m) and the headless +1-week action go through this one DAO — one writer, one contract."

requirements-completed: [NOTIF-03]

coverage:
  - id: D1
    description: "snoozeContact writes snooze_until = local date('now','localtime', <modifier>) per preset (3d/1w/1m) and inserts exactly one immutable snooze event, both in one transaction; modified_at bumped, last_contact untouched."
    requirement: "NOTIF-03"
    verification:
      - kind: unit
        ref: "src/db/snooze-dao.test.ts#snoozeContact — set snooze_until (local date) + immutable snooze event"
        status: pass
    human_judgment: false
  - id: D2
    description: "A future snooze reads as still snoozed under the bare date() dashboard storage contract (date(snooze_until) <= date('now','localtime') is false)."
    requirement: "NOTIF-03"
    verification:
      - kind: unit
        ref: "src/db/snooze-dao.test.ts#a future snooze reads as STILL snoozed under the bare date() dashboard contract"
        status: pass
    human_judgment: false
  - id: D3
    description: "clearSnooze NULLs snooze_until and ALWAYS inserts exactly one unsnooze event in the same transaction (item 10), even when the contact was never snoozed; last_contact untouched."
    requirement: "NOTIF-03"
    verification:
      - kind: unit
        ref: "src/db/snooze-dao.test.ts#clearSnooze — NULL snooze_until + ALWAYS an unsnooze event (item 10)"
        status: pass
    human_judgment: false
  - id: D4
    description: "A bad contactId throws + rolls back on both paths with nothing written (neither the contacts UPDATE nor the event)."
    requirement: "NOTIF-03"
    verification:
      - kind: unit
        ref: "src/db/snooze-dao.test.ts#throws + rolls back on a bad id"
        status: pass
    human_judgment: false

# Metrics
duration: ~15min
completed: 2026-08-16
status: complete
---

# Phase 11 Plan 03: snooze-dao — first writer of contacts.snooze_until Summary

**`snooze-dao` — the single mutexed writer of `contacts.snooze_until` and the first producer of the reserved `snooze`/`unsnooze` events: it writes a local `YYYY-MM-DD` snooze date (computed by SQLite so '+1 month' is calendar-correct and local) plus an immutable events row in ONE transaction, clears via NULL always leaving an unsnooze audit row, and never touches `last_contact`.**

## Performance

- **Duration:** ~15 min
- **Completed:** 2026-08-16
- **Tasks:** 1 (TDD)
- **Files created:** 2, **modified:** 0

## Accomplishments
- New `snooze-dao.ts` exporting `snoozeContact`, `clearSnooze`, and `PRESET_MODIFIERS`.
- `snoozeContact` runs inside ONE `inWriteTransaction`: computes the target date via `SELECT date('now','localtime', ?)` (bound preset modifier), `UPDATE contacts SET snooze_until = ?, modified_at = ? WHERE id = ?` with a `changes===1` guard, then composes `recordEventCore(... type: "snooze" ...)` in the same transaction.
- `clearSnooze` runs inside ONE `inWriteTransaction`: `UPDATE contacts SET snooze_until = NULL, modified_at = ? WHERE id = ?` (changes===1), then ALWAYS `recordEventCore(... type: "unsnooze" ...)` — `uid` is REQUIRED, the insert is unconditional (review item 10).
- `PRESET_MODIFIERS = { "3d": "+3 days", "1w": "+7 days", "1m": "+1 month" }` at the top of the file as the single preset-length tunable. The headless +1-week action (11-07) calls `snoozeContact(..., preset: "1w")`.
- Honours the dashboard-read SNOOZE STORAGE CONTRACT: `snooze_until` is a bare local `YYYY-MM-DD` comparable via `date(snooze_until) <= date('now','localtime')`, so a future snooze reads as still snoozed. This activates the previously-empty `countSnoozed` + 'snoozed' filter segment.
- `last_contact` is never written or referenced in any SQL (grep-verified — the only textual matches are the JSDoc documenting the invariant), so recency-dao stays its sole writer (DATA-04 intact).

## Task Commits

TDD task committed atomically (RED test → GREEN feat):

1. **Task 1 (RED): failing snooze-dao suite** - `d5890e0` (test)
2. **Task 1 (GREEN): snooze-dao implementation** - `be37474` (feat)

_No REFACTOR commit — the GREEN implementation needed no cleanup._

## Files Created/Modified
- `src/db/snooze-dao.ts` - `SnoozePreset` + `PRESET_MODIFIERS`, `SnoozeContactInput` / `ClearSnoozeInput`, `snoozeContact`, `clearSnooze`.
- `src/db/snooze-dao.test.ts` - 9 node:sqlite tests: PRESET_MODIFIERS map, per-preset snooze_until (3d/1w/1m), future-snooze-still-snoozed, one immutable snooze event + modified_at bump + last_contact untouched, bad-id rollback on snooze, clear NULLs + always one unsnooze event (incl. never-snoozed case), bad-id rollback on clear.

## Decisions Made
- **snooze_until computed by SQLite, not from `now`** — `date('now','localtime', <modifier>)` keeps '+1 month' calendar-correct and local without JS month-length math or `toISOString` (RESEARCH Pitfall 8).
- **clearSnooze always records an unsnooze event, `uid` required** (review item 10) — the events log is the only recovery mechanism, so the audit trail stays consistent even for a never-snoozed clear.
- **Event composed via `recordEventCore` (non-mutexed core)** inside the one transaction — the mutexed `recordEvent` wrapper would nest the non-reentrant mutex and hang permanently.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None. tsc, biome, colors, and the full suite were clean on the first GREEN run; biome applied a formatting-only line-wrap to the test file (no logic change).

## User Setup Required
None - pure data-layer DAO, no external service or migration. `contacts.snooze_until` has existed since migration 001; this plan only adds its first writer.

## Next Phase Readiness
- The headless notification snooze (11-07) has `snoozeContact(exec, { contactId, uid, preset: "1w", now })`.
- The in-app profile snooze presets + Clear affordance (11-09) have `snoozeContact` (3d/1w/1m) and `clearSnooze` (always an unsnooze audit row).
- The dashboard snoozed count + 'snoozed' filter (08-dashboard) now have a live writer.
- No blockers.

## Verification
- `npx vitest run src/db/snooze-dao.test.ts` — 9 passed.
- Full suite: `npm test` — 753 passed (60 files), no regressions (was 744 before this plan).
- `npx tsc --noEmit` clean; `npx biome check` clean on both new files; `npm run check:colors` clean.
- `grep -n "last_contact" src/db/snooze-dao.ts` — matches only in JSDoc comments; no SQL references the recency column.

## Self-Check: PASSED

- Both created files exist on disk (src/db/snooze-dao.ts, src/db/snooze-dao.test.ts, plus this 11-03-SUMMARY.md).
- Both task commits exist in git log (d5890e0, be37474).
- snooze-dao.ts references `last_contact` only in comments; every UPDATE sets only `snooze_until` + `modified_at`.

---
*Phase: 11-actionable-notifications*
*Completed: 2026-08-16*
