---
phase: 07-conversational-fuel
plan: 03
subsystem: database
tags: [sqlite, fuel, ai-provenance, confirm-flip, react-native]

# Dependency graph
requires:
  - phase: 07-01
    provides: fuel-dao (core/wrapper split, both-keys assertOneChange, FuelSource), FuelEditor, ContactProfileScreen unified load()
  - phase: 07-02
    provides: getRankedFuel (source='ai' + off_limits + blank-text in-query exclusion), FuelItem.source, RankedFuelLine
provides:
  - "confirmFuel/confirmFuelCore — one-UPDATE source flip 'ai'→'manual' (no migration, no new column)"
  - "AI-unconfirmed row treatment in FuelEditor (Suggested by AI pill + helper + Confirm/Dismiss)"
  - "ContactProfileScreen onConfirm wiring → confirmFuel then unified load()"
affects: [phase-14-ai-suggestions]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Provenance-via-source-flip: confirming an AI suggestion is a single unconditional UPDATE of source='manual' — no confirmation timestamp, no schema change; the flip is the whole mechanism"
    - "Mutexed-wrapper/non-mutexed-core split reused for confirmFuel (mirrors editFuel/deleteFuel + contact-links updateLink)"

key-files:
  created: []
  modified:
    - src/db/fuel-dao.ts
    - src/db/fuel-dao.test.ts
    - src/components/FuelEditor.tsx
    - src/screens/ContactProfileScreen.tsx

key-decisions:
  - "Confirm = single UPDATE fuel SET source='manual', modified_at=? WHERE id=? AND contact_id=? (locked owner decision 2026-08-15) — NO migration, NO ai_confirmed_at column; provenance intentionally erased on confirm"
  - "Dismiss reuses the existing onDelete path (deleteFuel + permanent-delete confirm Alert), not a distinct writer"
  - "AI-unconfirmed rows remain editable before confirmation (edit keeps source='ai'); only Confirm flips to 'manual'"

patterns-established:
  - "The 'unconfirmed AI' state IS exactly source='ai' — no separate flag; getRankedFuel's existing source!='ai' exclusion is what confirmation lifts"

requirements-completed: [FUEL-06]

coverage:
  - id: D1
    description: "confirmFuel flips source 'ai'→'manual' in one scoped UPDATE, bumps modified_at, preserves all other columns"
    requirement: FUEL-06
    verification:
      - kind: unit
        ref: "src/db/fuel-dao.test.ts#flips source to 'manual', bumps modified_at, and leaves every other column untouched"
        status: pass
    human_judgment: false
  - id: D2
    description: "confirmFuel is both-keys scoped — a wrong contactId changes 0 rows and throws (rolls back)"
    requirement: FUEL-06
    verification:
      - kind: unit
        ref: "src/db/fuel-dao.test.ts#throws (rolls back) when the contactId does not match the row's contact (0 changes)"
        status: pass
    human_judgment: false
  - id: D3
    description: "An unconfirmed source='ai' row is excluded from getRankedFuel and only ranks after confirmFuel flips it to 'manual'"
    requirement: FUEL-06
    verification:
      - kind: unit
        ref: "src/db/fuel-dao.test.ts#makes an unconfirmed 'ai' row rank only after confirmation (getRankedFuel gate)"
        status: pass
    human_judgment: false
  - id: D4
    description: "No schema change — no new column, no migration under src/db/migrations/"
    requirement: FUEL-06
    verification:
      - kind: other
        ref: "git status --short src/db/migrations/ (empty)"
        status: pass
    human_judgment: false
  - id: D5
    description: "source='ai' rows render distinct (borderStrong + 'Suggested by AI' pill + helper + Confirm(accent)/Dismiss(textSecondary)); Confirm→confirmFuel→load(), Dismiss→deleteFuel→load()"
    requirement: FUEL-06
    verification:
      - kind: manual_procedural
        ref: "on-device UAT (phase gate): seed a source='ai' row, verify distinct render, tap Confirm → item loses badge and joins ranked line; tap Dismiss → removed"
        status: unknown
    human_judgment: true
    rationale: "Visual distinctness + tap-through Confirm/Dismiss on the Pixel is UI-observable only; no automated component test exists for FuelEditor. Deferred to on-device UAT per plan (do not build/launch here)."

# Metrics
duration: 5min
completed: 2026-08-15
status: complete
---

# Phase 7 Plan 3: AI-unconfirmed state + confirm-flip Summary

**confirmFuel flips an AI suggestion's `source` 'ai'→'manual' in one scoped UPDATE (no migration, no new column), and FuelEditor renders `source='ai'` rows as a distinct "Suggested by AI" card with Confirm/Dismiss — closing the provenance seam so a hallucination never reads as user-authored nor feeds a prompt until vouched for.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-08-16T00:08Z
- **Completed:** 2026-08-16T00:13Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- `confirmFuelCore`/`confirmFuel` added to `fuel-dao.ts`: a single `UPDATE fuel SET source='manual', modified_at=? WHERE id=? AND contact_id=?`, scoped by both keys with `assertOneChange`, non-mutexed core + mutexed wrapper (mirrors editFuel/deleteFuel). No migration, no new column — the flip erases the "was AI-proposed" provenance by design (locked owner decision 2026-08-15), documented in a header note against a future "restore provenance" bug-fix.
- `FuelEditor.tsx`: `source==='ai'` rows now render a `borderStrong` outline + "Suggested by AI" pill (`border`/`textSecondary`) + helper "Confirm to use this — it won't be sent to AI until you do." + Confirm (`accent`) / Dismiss (`textSecondary`). Confirm routes to a new `onConfirm(id)`; Dismiss reuses `onDelete(id)`. Existing tokens only, no net-new.
- `ContactProfileScreen.tsx`: `doConfirmFuel` → `confirmFuel` then the SINGLE unified `load()`; after the flip the now-`manual` row re-reads through `getRankedFuel` and begins ranking, with no ranking computed in the UI.
- 3 new node tests prove the flip, both-keys scoping (wrong-contactId → throws), and the getRankedFuel gate (excluded while 'ai', included after confirm).

## Task Commits

1. **Task 1 (RED): failing tests for confirmFuel** - `b3a78f7` (test)
2. **Task 1 (GREEN): confirmFuel source flip** - `83ad5d5` (feat)
3. **Task 2: AI-unconfirmed row treatment + Confirm/Dismiss** - `901c0fb` (feat)

_TDD Task 1 has RED (test) + GREEN (feat) commits._

## Files Created/Modified
- `src/db/fuel-dao.ts` - Added `ConfirmFuelInput`, `confirmFuelCore` (scoped source-flip UPDATE + assertOneChange), `confirmFuel` (mutexed wrapper), header note on the locked owner decision.
- `src/db/fuel-dao.test.ts` - Added `confirmFuel` describe block (3 tests) + `getRankedFuel` import for the gate test.
- `src/components/FuelEditor.tsx` - `onConfirm` prop; `isAiUnconfirmed` render branch (borderStrong, pill, helper, Confirm/Dismiss); header doc for the AI-unconfirmed state.
- `src/screens/ContactProfileScreen.tsx` - `confirmFuel` import; `doConfirmFuel` callback; `onConfirm` wired to `FuelEditor`.

## Decisions Made
- None beyond the locked owner decision the plan already specified (source-flip, no migration, provenance intentionally not preserved). Followed exactly.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## Verification Results
- `npx vitest run src/db/fuel-dao.test.ts` — 11/11 pass (3 new confirmFuel cases).
- `npx vitest run` (full) — 562/562 pass across 48 files.
- `npx tsc --noEmit` — clean.
- `npm run check:colors` — clean (border/borderStrong/textSecondary/accent only; no net-new token).
- `npx biome check src` — 152 files, no fixes needed.
- `git status --short src/db/migrations/` — empty (no column, no migration 2). Single-writer intact: confirmFuel wraps confirmFuelCore in one `inWriteTransaction`; the core opens no transaction.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- FUEL-06 mechanism complete and node-tested. No producer of `source='ai'` rows exists yet — Phase 14 (AI suggestions) will write them; the render + confirm-flip + prompt-exclusion are all in place to receive them.
- **Outstanding on-device UAT (D5, phase gate):** seed a `source='ai'` row on the Pixel, verify the distinct render, tap Confirm (row loses badge, joins ranked line) and Dismiss (removed). Deferred per plan — not run here.

## Self-Check: PASSED

All 4 modified files + SUMMARY.md present on disk; all 3 task commits (`b3a78f7`, `83ad5d5`, `901c0fb`) found in `git log`. Full suite green (562 tests, tsc, check:colors, biome); no migration change.

---
*Phase: 07-conversational-fuel*
*Completed: 2026-08-15*
