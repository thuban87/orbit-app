---
phase: 04-contact-crud-lifecycle
plan: 09
subsystem: database
tags: [sqlite, purge, transaction, lifecycle, react-native, custom-fields]

# Dependency graph
requires:
  - phase: 04-08
    provides: ArchivedContactsScreen with the marked Plan-09 purge slot; listArchived/restoreContact lifecycle DAO
  - phase: 04-01
    provides: the `danger` theme token (#E5484D) on ThemePalette + space-dark preset
provides:
  - purgeContact — archived-guarded one-transaction fan-out delete of every owned child (incl. field_history) + the contact
  - computeImpact — per-child blast-radius counts + hasCustomValues boolean
  - impactSummaryLines — pure, omit-zero impact render helper (interactions/fuel/links only)
  - POST-COMMIT onPurgeExtensions adapter hook (Phases 5/11 register photo/notification cleanup)
  - Archived-list "Delete permanently" action + impact-summary single-confirm
affects: [05-photo, 06-events, 07-fuel, 11-notifications]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Write-boundary safety guard: assert precondition (archived_at IS NOT NULL) + assert exactly-one-row-deleted INSIDE the transaction, not only via UI routing"
    - "POST-COMMIT best-effort extension hook chained off inWriteTransaction().then() — never awaited inside the mutex/transaction"
    - "Pure, unit-tested render helper (impactSummaryLines) so omit-zero copy logic is testable without the UI"

key-files:
  created:
    - src/db/purge-dao.ts
    - src/db/purge-dao.test.ts
  modified:
    - src/screens/ArchivedContactsScreen.tsx

key-decisions:
  - "confirmPurge drops the unused `name` param (title is the fixed 'Delete permanently'); impactSummaryLines keeps `name` in its signature per the locked plan spec but references it via `void name` since the fragments never embed the name"
  - "purgeBody drops the ' and {parts}' clause when a contact owns no multi-row children, so the all-zero case stays grammatical"

patterns-established:
  - "Explicit fan-out delete (not FK cascade) so the blast radius is auditable and matches computeImpact's explicit COUNTs; field_history (no FK) deleted explicitly or it would orphan"
  - "Non-DB OS cleanup (photo unlink, notification cancel) runs post-commit as idempotent best-effort; a throwing adapter is logged, never fatal, never rolls back the commit"

requirements-completed: [CRUD-06]

coverage:
  - id: D1
    description: "purgeContact fans out every owned child (interactions, events, fuel, contact_custom_values, contact_links, field_history) + the contact in ONE transaction for an archived contact, leaving other contacts intact"
    requirement: CRUD-06
    verification:
      - kind: unit
        ref: "src/db/purge-dao.test.ts#deletes every owned row for an archived contact, leaving a second contact intact"
        status: pass
    human_judgment: false
  - id: D2
    description: "Write-boundary guard: a live (non-archived) or missing contact is REJECTED and NO rows are deleted; a mid-transaction failure rolls the whole fan-out back"
    requirement: CRUD-06
    verification:
      - kind: unit
        ref: "src/db/purge-dao.test.ts#REJECTS a live (non-archived) contact and deletes NOTHING (write-boundary guard)"
        status: pass
      - kind: unit
        ref: "src/db/purge-dao.test.ts#rolls the whole fan-out back when a delete fails mid-transaction"
        status: pass
    human_judgment: false
  - id: D3
    description: "computeImpact returns per-child counts + hasCustomValues boolean; impactSummaryLines is a pure omit-zero helper rendering interactions/fuel/links only (never custom values or events)"
    requirement: CRUD-06
    verification:
      - kind: unit
        ref: "src/db/purge-dao.test.ts#computeImpact — per-child counts + hasCustomValues (CRUD-06)"
        status: pass
      - kind: unit
        ref: "src/db/purge-dao.test.ts#impactSummaryLines — pure omit-zero render helper"
        status: pass
    human_judgment: false
  - id: D4
    description: "onPurgeExtensions adapter fires POST-COMMIT (contact already gone when it runs); a throwing adapter does not roll back the committed deletes"
    requirement: CRUD-06
    verification:
      - kind: unit
        ref: "src/db/purge-dao.test.ts#purgeContact — POST-COMMIT extension adapter (T-04-16)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Archived list offers a per-row 'Delete permanently' (colors.danger, no inline hex) → single Promise-wrapped destructive Alert showing the impact summary (interactions/fuel/links, omit-zero), then purges and reloads"
    requirement: CRUD-06
    verification:
      - kind: automated_ui
        ref: "npx tsc --noEmit (exit 0) + npm run check:colors src App.tsx (exit 0)"
        status: pass
      - kind: manual_procedural
        ref: "Device UAT: Delete permanently on an archived contact shows the impact summary and removes the contact; a live contact has no purge path"
        status: unknown
    human_judgment: true
    rationale: "The rendered impact copy, danger styling, and the single-confirm flow are UI-observable behaviours the automated gates cannot fully judge; phase-gate device UAT confirms them."

# Metrics
duration: 20min
completed: 2026-08-15
status: complete
---

# Phase 4 Plan 09: Purge Fan-Out & Impact-Summary Confirm Summary

**Irreversible whole-contact purge — an archived-guarded one-transaction explicit fan-out (interactions, events, fuel, custom values, links, field_history + the contact) with per-child impact counts, a POST-COMMIT best-effort cleanup hook, and a single danger-styled "Delete permanently" impact-summary confirm on the Archived list.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-08-15T01:44:00Z
- **Completed:** 2026-08-15T01:49:00Z
- **Tasks:** 2 (1 TDD)
- **Files modified:** 3 (2 created, 1 modified)

## Accomplishments
- `purgeContact` asserts `archived_at IS NOT NULL` and asserts exactly-one-contacts-row-deleted INSIDE its `inWriteTransaction` — a live or missing contact throws and deletes nothing, so the two-stage safety is structural, not just UI routing (T-04-12).
- Explicit fan-out delete of all six children (incl. `field_history`, which has no FK and never cascades) + the contact in ONE transaction — not relying on FK cascade, so the blast radius is auditable and matches `computeImpact`'s explicit COUNTs (T-04-13).
- `onPurgeExtensions` runs POST-COMMIT as idempotent best-effort in its own try/catch — never awaited inside the mutex/transaction; a throwing adapter is logged, not fatal, and cannot undo the commit (T-04-16). Phase 4 registers none; Phases 5/11 wire photo/notification cleanup.
- `impactSummaryLines` is a pure, unit-tested omit-zero helper rendering interactions/fuel/links only — `contact_custom_values` (single 0/1 row) and `events` (no Phase-4 writer) are deliberately not rendered as blast-radius counts.
- The Archived list gains a per-row "Delete permanently" styled via `colors.danger` (no inline hex) → a single Promise-wrapped destructive `Alert` with the locked impact copy, then `purgeContact` + reload.

## Task Commits

Each task was committed atomically:

1. **Task 1 (RED): failing purge-dao tests** - `9a94a03` (test)
2. **Task 1 (GREEN): purge fan-out DAO** - `50233ef` (feat)
3. **Task 2: Delete permanently + impact-summary confirm** - `385964b` (feat)

_Task 1 was TDD (test → feat)._

## Files Created/Modified
- `src/db/purge-dao.ts` - `computeImpact` (per-child counts + `hasCustomValues`), `impactSummaryLines` (pure omit-zero render helper), `purgeContact` (archived-guarded one-transaction fan-out + POST-COMMIT extension hook).
- `src/db/purge-dao.test.ts` - node:sqlite harness proving fan-out, archived-guard/live-rejection, missing-contact rejection, mid-transaction rollback, scope isolation, omit-zero rendering, and post-commit adapter (fires after commit + throwing adapter is best-effort). 11 tests.
- `src/screens/ArchivedContactsScreen.tsx` - per-row "Delete permanently" (danger token) + `confirmPurge`/`purgeBody` helpers + `doPurge` (computeImpact → confirm → purgeContact → reload).

## Decisions Made
- **`impactSummaryLines(name, impact)` keeps the plan's `name` parameter** for signature fidelity to the locked spec, but the fragments never embed the name (the screen owns the surrounding "Permanently delete {name} and …" sentence), so the implementation references it via `void name` to stay lint-clean under biome's `noUnusedFunctionParameters`.
- **`confirmPurge` takes only the message** (dropped an unused `name` param) — its title is the fixed "Delete permanently", so `name` was genuinely dead and biome flagged it.
- **`purgeBody` drops the "and {parts}" clause when there are no multi-row children** so a contact with zero interactions/fuel/links still reads grammatically ("Permanently delete {name}? This cannot be undone.").

## Deviations from Plan

None - plan executed exactly as written. (The two small helper-signature choices above are implementation details within the delegated bucket, not deviations from any locked behaviour: the DAO's public `impactSummaryLines(name, impact)` signature is preserved verbatim.)

## Issues Encountered
- biome's `noUnusedFunctionParameters` (recommended, warn) flagged the unused `name` in the initial `confirmPurge`; resolved by dropping the param and confirming the DAO's `impactSummaryLines` retains `name` via `void name`. All gates (tsc, biome, check:colors, full suite) pass.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- CRUD-06 complete; this is the final plan of Phase 4 (Contact CRUD & Lifecycle).
- **Phase 5 (photo)** and **Phase 11 (notifications)** must register the `onPurgeExtensions` adapter to unlink the photo file and cancel scheduled notifications post-commit — the hook is in place and Phase 4 passes none.
- **Phase 6 (events):** `computeImpact` already returns an `events` count that `impactSummaryLines` does NOT render (harmless at 0 today). When the events writer lands, the impact copy MUST surface the events count so purge never silently deletes event rows.
- Device UAT (phase gate, D5) still outstanding: confirm the impact summary + danger styling + single-confirm flow on-device.

---
*Phase: 04-contact-crud-lifecycle*
*Completed: 2026-08-15*

## Self-Check: PASSED
- All created/modified files present on disk (purge-dao.ts, purge-dao.test.ts, ArchivedContactsScreen.tsx, 04-09-SUMMARY.md).
- All task commits present in git history (9a94a03 test, 50233ef feat, 385964b feat).
- Full suite 343/343 pass; tsc exit 0; check:colors (src App.tsx) exit 0; biome clean.
