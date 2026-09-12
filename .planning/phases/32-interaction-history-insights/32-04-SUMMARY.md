---
phase: 32-interaction-history-insights
plan: 04
subsystem: interaction-history
tags: [react-native, navigation, recency-spine, edit-route, tdd, sqlite-read]

requires:
  - phase: 32-interaction-history-insights
    provides: "Plan 01 migration 025 (interactions.duration/allow_ai) + editTouchpointFull setting duration/allow_ai + extended TouchpointRefineForm (Tone/channel/duration/Allow-AI)"
provides:
  - "readInteractionForEdit(exec, contactId, interactionId): ReadOnlyExecutor single-row load of every editable field (note + duration + allow_ai), scoped by id AND contact_id, null when unpaired"
  - "edit-interaction-logic: buildEditInput -> editTouchpointFull, canSave gate, isOccurredAtRejected (reuses the DAO's rejectFutureOccurredAt), seedRefineValue, resolveSave (failure preserves state)"
  - "EditInteractionScreen — the ONE canonical Edit Interaction route wrapping the extended TouchpointRefineForm, saving through editTouchpointFull only"
  - "EditInteraction route ({ contactId, interactionId }) registered in Dashboard, Orrery, AND Settings stacks"
  - "FUTURE_DATETIME_MESSAGE relocated to node-safe touchpoint-refine-logic (single copy, re-exported from TouchpointRefineForm)"
affects: [phase-32-plan-07-detail-sheet, phase-32-plan-08-profile-history-integration]

actuals:
  tokens: 7136
  tasks: 2
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Thin RN edit-screen shell over a node-tested -logic module + a single-row contact-scoped ReadOnlyExecutor read (mirrors EditContactScreen)"
    - "UX-only future-date guard that reuses (not re-implements) the DAO's rejectFutureOccurredAt, so the inline flag AGREES with the write authority"

key-files:
  created:
    - src/db/interaction-edit-read.ts
    - src/db/interaction-edit-read.test.ts
    - src/screens/edit-interaction-logic.ts
    - src/screens/edit-interaction-logic.test.ts
    - src/screens/EditInteractionScreen.tsx
  modified:
    - src/navigation/types.ts
    - src/navigation/tabs/DashboardStack.tsx
    - src/navigation/tabs/OrreryStack.tsx
    - src/navigation/tabs/SettingsStack.tsx
    - src/components/touchpoint-refine-logic.ts
    - src/components/TouchpointRefineForm.tsx

key-decisions:
  - "readInteractionForEdit lives in Plan 04 (dep 32-01), not Plan 03 — it is a distinct single-row-by-id read needing migration 025's duration/allow_ai columns, kept here to avoid a Plan-04->Plan-03 wave cascade"
  - "The UI future-date check is UX-only inline feedback; the DAO's rejectFutureOccurredAt inside editTouchpointFull remains the authority — isOccurredAtRejected wraps that same guard so they agree by construction"
  - "FUTURE_DATETIME_MESSAGE relocated to the pure touchpoint-refine-logic module (re-exported from the form) so the single shipped copy is importable by the node-tested edit logic without loading react-native"
  - "Post-save refresh uses notifyWidgetDataChanged() + focused re-reads (the established interaction-write idiom); derived consumers (heatmap, Intensity, Last Interaction, Status, Gravity) recompute from the moved recency at read time"

requirements-completed: [HIST-12, HIST-14]

coverage:
  - id: D1
    description: "Contact-scoped single-row interaction-load read returns note + duration + allow_ai; a mismatched contactId returns null; opens no write transaction"
    requirement: "HIST-12"
    verification:
      - kind: unit
        ref: "src/db/interaction-edit-read.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "Edit logic builds the editTouchpointFull input (duration nullable, allow_ai 0/1), gates save, and the future-date UX guard AGREES with the DAO's rejectFutureOccurredAt"
    requirement: "HIST-14"
    verification:
      - kind: unit
        ref: "src/screens/edit-interaction-logic.test.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "A failed save preserves the full form value (same reference) and never signals completion; success completes"
    requirement: "HIST-12"
    verification:
      - kind: unit
        ref: "src/screens/edit-interaction-logic.test.ts (resolveSave)"
        status: pass
    human_judgment: false
  - id: D4
    description: "EditInteraction route registered in ALL THREE Profile-hosting stacks (Dashboard/Orrery/Settings); typechecks; no set-based interactions write in the screen; screen saves via editTouchpointFull"
    requirement: "HIST-12"
    verification:
      - kind: unit
        ref: "npx tsc --noEmit; grep EditInteraction in the three stacks; grep 'UPDATE interactions' returns nothing"
        status: pass
      - kind: manual_procedural
        ref: "device UAT: open a contact Profile from the Settings tab (Archived -> Profile), edit an interaction, confirm the route resolves and saves (Pixel; deferred to phase gate)"
        status: unknown
    human_judgment: true
    rationale: "The .tsx screen rendering + on-device navigation resolution is device-UAT; node tests cover the pure logic + the read. Physical Pixel not attached this run."

duration: 15min
completed: 2026-09-11
status: complete
---

# Phase 32 Plan 04: Canonical Edit Interaction route Summary

**The one canonical Edit Interaction route (`EditInteractionScreen`) wraps the extended `TouchpointRefineForm` and saves every editable field through `editTouchpointFull` — the sole recency writer — seeded by a new contact-scoped single-row read, with a UX-only future-date guard that reuses (never re-implements) the DAO's authority, registered in all three Profile-hosting stacks.**

## Performance

- **Duration:** ~15 min
- **Tasks:** 2 (Task 1 TDD: RED → GREEN)
- **Commits:** 3 (1 test + 2 feat) — docs commit separate

## Accomplishments
- Added `readInteractionForEdit(exec, contactId, interactionId)` (`src/db/interaction-edit-read.ts`): a `ReadOnlyExecutor` (no transaction) single-row read that SELECTs every editable column — occurred_at, channel, direction, connected, quality, note, and migration-025 duration/allow_ai — scoped by `id = ? AND contact_id = ?`, returning null when the pair does not match. Resolves the review HIGH: Plan 04 previously had no read to seed the note + new columns. It is a distinct single-row read, NOT Plan 03's date-indexed history projection.
- Added `edit-interaction-logic.ts` (node-tested): `buildEditInput` → `editTouchpointFull` input (nullable duration, 0/1 allow_ai), `canSave`, `isOccurredAtRejected` (wraps the DAO's `rejectFutureOccurredAt` so the inline flag AGREES with the write authority), `seedRefineValue`, and `resolveSave` modeling failure-preserves-state / success-completes. No SQL, no interactions write.
- Added `EditInteractionScreen.tsx`: loads via the read, renders the extended `TouchpointRefineForm` controlled, and on Save calls `editTouchpointFull` only (no set-based write). Failure preserves the full form and stays on screen; success returns to the caller and nudges the widget. Own Back chrome + discard-keep guard; primary `Save changes` action uses `accent`/`onAccent` tokens (all colours via theme tokens; `check:colors` green).
- Registered `EditInteraction { contactId, interactionId }` as a typed param AND a `Stack.Screen` in Dashboard, Orrery, AND Settings — the three stacks that host Profile (Archived → Profile in Settings) — resolving the review HIGH about the Settings gap; React Navigation throws on an unregistered route name.

## Task Commits

1. **Task 1 (tdd) RED** — `1b37989` (test) — failing specs for the read + logic module.
2. **Task 1 (tdd) GREEN** — `df3b063` (feat) — read + logic module + FUTURE_DATETIME_MESSAGE relocation.
3. **Task 2** — `d5631ff` (feat) — EditInteractionScreen + all-stack route registration.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Relocated FUTURE_DATETIME_MESSAGE to a node-safe module**
- **Found during:** Task 1 (writing the logic test).
- **Issue:** The plan requires the node-tested `edit-interaction-logic` to reuse the SHIPPED `FUTURE_DATETIME_MESSAGE` (single copy, no divergent string). The constant lived in `TouchpointRefineForm.tsx`, which imports `@react-native-community/datetimepicker` (Flow syntax) and cannot load in the node/vitest env — a runtime import there fails to parse. Empirically confirmed with a throwaway probe test.
- **Fix:** Moved the `const FUTURE_DATETIME_MESSAGE` definition into the pure, node-safe sibling `src/components/touchpoint-refine-logic.ts` and re-exported it from `TouchpointRefineForm.tsx` (`export { FUTURE_DATETIME_MESSAGE }`). Mechanical relocation only — no behaviour change, no decision reversal. It remains a single copy; the form's public export path (`@/components/TouchpointRefineForm`) is unchanged; the sole existing definer/user was that form (grep-verified).
- **Files modified:** `src/components/touchpoint-refine-logic.ts`, `src/components/TouchpointRefineForm.tsx`.
- **Verification:** the existing `touchpoint-refine-logic.test.ts` stays green; the new logic test asserts the re-exported copy is identical to the shipped one; full suite 3021 pass.
- **Committed in:** `df3b063`.

**2. [Rule 1 - Bug, test-only] Nullish-coalescing swallowed explicit null in a test helper**
- **Found during:** Task 1 GREEN run.
- **Issue:** the read test's `interaction()` helper used `overrides.note ?? default`, so an explicit `note: null` fixture fell through to the default string — a test bug, not source.
- **Fix:** switched nullable overrides to the `"key" in overrides` idiom so explicit null/undefined round-trips.
- **Committed in:** `df3b063`.

**Total deviations:** 2 auto-fixed (1x Rule 3 relocation, 1x Rule 1 test-helper). No scope creep; no decision reversal.

## Prohibitions honoured
- No set-based `UPDATE interactions` in the screen (grep-clean); the sole write path is `editTouchpointFull` (D-05 / ADR-010 / ADR-024).
- The future-date guard is not re-implemented: `isOccurredAtRejected` reuses `rejectFutureOccurredAt`; the UI check is UX-only and tested to agree with the DAO.
- No second future-date rejection string authored — the single shipped `FUTURE_DATETIME_MESSAGE` is reused.
- Duration edited here is descriptive only; it feeds `editTouchpointFull` as a column and nothing in Status/Gravity/Intensity.

## Known Stubs
None. No stubs, skipped tests, or unrun verifications introduced.

## Issues Encountered
- Pre-existing, out-of-scope: `src/components/orrery/orrery-controls-render.test.tsx` still fails to LOAD (`SyntaxError: Unexpected token 'typeof'`, a `vi.mock` generic under the Vite loader). It imports none of this plan's files and predates this phase (logged in Plan 01). Not fixed.

## User Setup Required
None.

## Next Phase Readiness
- Plan 07 (Detail Sheet) and Plan 08 (Profile history integration) can now `navigate("EditInteraction", { contactId, interactionId })` from any Profile origin — the route resolves in Dashboard, Orrery, and Settings.
- Device UAT of an actual edit save (incl. from a Settings-originated Profile) is deferred to the phase gate (physical Pixel not attached this run); the read + logic are node-proven and the screen typechecks + passes the colour gate.

## Self-Check: PASSED
- Created files verified on disk: interaction-edit-read.ts, edit-interaction-logic.ts, EditInteractionScreen.tsx (+ two test files).
- Commits verified in git log: 1b37989, df3b063, d5631ff.
- Full suite: 3021 pass; only the pre-existing unrelated orrery-controls-render load failure remains.

---
*Phase: 32-interaction-history-insights*
*Completed: 2026-09-11*
