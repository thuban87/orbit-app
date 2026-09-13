---
phase: 34-rapid-capture-update-flows
plan: 06
subsystem: ui
tags: [quick-log, snackbar, memory, interaction-note, capture, zustand, react-native]

# Dependency graph
requires:
  - phase: 34-02
    provides: "reconciled Memory registry — DEFAULT_MEMORY_TYPE_KEY 'general' displays 'Memory' (D-11)"
  - phase: 34-04
    provides: "Log Interaction screen + shared TouchpointRefineForm; readInteractionForEdit / editTouchpointFull edit path"
provides:
  - "post-log-note-logic.resolvePostLogSave — pure Note-XOR-Memory branch resolver (node-tested)"
  - "SnackbarMessage.secondaryAction? — additive two-action snackbar (Undo + Add Note)"
  - "runQuickLog success snackbar Add Note secondary action + RunQuickLogDeps.openPostLogEditor dep"
  - "PostLogNoteEditor — post-log editor saving an Interaction Note OR a basic Memory, with Edit Memory into the full MemoryEditor"
affects: [rapid-capture, quick-log, memory-editor, snackbar-callers]

# Actuals (#2632)
actuals:
  tokens: 7700
  tasks: 4
  commits: 4

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure react-native-free branch resolver owns a mutually-exclusive persistence decision; UI + command compose it"
    - "Additive optional field on a shared store type keeps every existing caller untouched (secondaryAction)"
    - "Editor-owned single-flight save guard (savingRef) distinct from the command's write guard (pendingRef)"

key-files:
  created:
    - src/screens/post-log-note-logic.ts
    - src/screens/post-log-note-logic.test.ts
    - src/stores/snackbar-store.test.ts
    - src/components/PostLogNoteEditor.tsx
  modified:
    - src/stores/snackbar-store.ts
    - src/components/Snackbar.tsx
    - src/services/quick-log-command.ts
    - src/services/quick-log-command.test.ts
    - src/screens/HomeScreen.tsx
    - src/components/UniversalFab.tsx

key-decisions:
  - "Post-log capture is additive: the interaction is written immediately, then the note/Memory is a separate post-hoc write bound to the created interactionId — the immediate-write contract is never made conditional on the note."
  - "Note vs Memory is decided by the pure resolvePostLogSave, returning exactly one target (note|memory|missing|noop); text is never duplicated into both."
  - "Add-Note-after-Undo is handled by re-reading the interaction; a missing row yields 'missing' and a friendly error, never an edit of a deleted row."
  - "Snackbar action colour stays colors.accent for both actions (matching the shipped Undo) rather than switching to accentText, to avoid restyling the existing shipped action."
  - "Quick Log keeps channel:'unspecified' — the Default Interaction Channel preference remains unadopted pending owner sign-off (flagged assumption carried forward)."

patterns-established:
  - "Pure logic module + node test for a correctness core, composed by both a service and a component"
  - "Optional secondaryAction on a shared snackbar type for multi-action transient feedback"

requirements-completed: [CAPT-05, CAPT-13]

coverage:
  - id: D1
    description: "resolvePostLogSave maps an editor save to exactly one intent (note|memory|missing|noop); Memory keyed by DEFAULT_MEMORY_TYPE_KEY; missing-interaction returns 'missing'; empty text is a no-op"
    requirement: CAPT-05
    verification:
      - kind: unit
        ref: "src/screens/post-log-note-logic.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "Snackbar carries an optional secondaryAction rendered after the primary; single-action callers unchanged; 6s auto-dismiss intact"
    requirement: CAPT-05
    verification:
      - kind: unit
        ref: "src/stores/snackbar-store.test.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "runQuickLog success snackbar offers Undo AND Add Note bound to the created interactionId; immediate write, timestamp, no-duration, single-flight, channel:'unspecified' preserved; failure omits Add Note"
    requirement: CAPT-05
    verification:
      - kind: unit
        ref: "src/services/quick-log-command.test.ts"
        status: pass
    human_judgment: false
  - id: D4
    description: "PostLogNoteEditor saves a Note or a basic Memory (never both), guards its own Save against double-tap, handles a missing (undone) interaction, offers Edit Memory into the full MemoryEditor; wired from HomeScreen + UniversalFab"
    requirement: CAPT-05
    verification:
      - kind: manual_procedural
        ref: "On-device UAT: Quick Log → Add Note → Save writes Interaction Note; re-run → Create Memory Instead writes a Memory; Edit Memory opens full editor; double-tapped Save writes once"
        status: unknown
    human_judgment: true
    rationale: "UI-observable behaviour (Sheet render, double-tap timing, MemoryEditor navigation) requires on-device verification; no RN component render test in scope."
  - id: D5
    description: "Quick Log preselects the contact when the invoking context identifies one (Profile/Dashboard/FAB-after-picker) — CAPT-13 confirmed"
    requirement: CAPT-13
    verification:
      - kind: manual_procedural
        ref: "runQuickLog receives contactId directly from resolveFabTarget / selectPickerContact / onLogInteraction; confirm no picker prompt when context supplies a contact"
        status: unknown
    human_judgment: true
    rationale: "Preselection was already implemented upstream; 34-06 only confirms it and threads contactId into the post-log editor. On-device confirmation belongs to end-of-phase UAT."

# Metrics
duration: 7min
completed: 2026-09-12
status: complete
---

# Phase 34 Plan 06: Post-log Note/Memory capture for Quick Log Summary

**Quick Log's success snackbar now offers Add Note beside Undo, opening a post-log editor that saves EITHER an Interaction Note OR a basic Memory (never both) with an Edit Memory path into the full MemoryEditor — all without touching the immediate-write / Undo / single-flight contract.**

## Performance

- **Duration:** 7 min
- **Tasks:** 4 (all committed atomically)
- **Tests:** 17 plan-relevant tests pass (post-log-note-logic 7, snackbar-store 4, quick-log-command 6); full suite 3263 tests pass.

## Task Commits

Each task was committed atomically:

1. **Task 1 (tracer, TDD): post-log-note-logic.ts — Note-XOR-Memory branch** - `bdb0c27` (feat)
2. **Task 2 (TDD): two-action snackbar (optional secondaryAction)** - `97b7ac0` (feat)
3. **Task 3 (TDD): Add Note secondary action in runQuickLog** - `f09471f` (feat)
4. **Task 4: PostLogNoteEditor + caller wiring** - `7fd3b02` (feat)

**Plan metadata:** (this SUMMARY + STATE/ROADMAP) committed separately.

## Files Created/Modified

- `src/screens/post-log-note-logic.ts` - Pure `resolvePostLogSave` returning exactly one persistence intent (note|memory|missing|noop); react-native-free, imports only DEFAULT_MEMORY_TYPE_KEY.
- `src/screens/post-log-note-logic.test.ts` - Covers mutual exclusion, key-not-name memory, empty no-op, missing-interaction, whitespace trim.
- `src/stores/snackbar-store.ts` - Added optional `secondaryAction?: SnackbarAction` to `SnackbarMessage`.
- `src/stores/snackbar-store.test.ts` - New: single-action back-compat, optional secondaryAction, 6s auto-dismiss, immediate dismiss.
- `src/components/Snackbar.tsx` - Renders the secondary action Pressable after the primary; each dismisses on press.
- `src/services/quick-log-command.ts` - `QuickLogSnackbar.secondaryAction?`, `RunQuickLogDeps.openPostLogEditor`; success snackbar sets Add Note bound to the created interactionId; channel/timestamp/single-flight preserved.
- `src/services/quick-log-command.test.ts` - Asserts Undo + Add Note on success, Add Note invokes openPostLogEditor with the created id, failure omits Add Note, single-flight holds.
- `src/components/PostLogNoteEditor.tsx` - New Sheet editor: own savingRef guard, re-reads interaction for the note branch, routes through resolvePostLogSave to editTouchpointFull or addMemory, Create Memory Instead + Edit Memory into full MemoryEditor; all colour via theme tokens.
- `src/screens/HomeScreen.tsx` - postLogTarget state, openPostLogEditor dep, mounts PostLogNoteEditor.
- `src/components/UniversalFab.tsx` - postLogTarget state, openPostLogEditor dep, mounts PostLogNoteEditor in both return paths.

## Decisions Made

See `key-decisions` frontmatter. Notable: the note text is captured AFTER the immediate write (never a pre-submit form); the resolver guarantees no text duplication across Note and Memory; the editor owns a save guard distinct from runQuickLog's pendingRef.

## Deviations from Plan

None - plan executed exactly as written. All four tasks implemented per their action blocks; all acceptance criteria met.

## Issues Encountered

**Pre-existing, out-of-scope test failure (NOT caused by this plan):**
`src/components/orrery/orrery-controls-render.test.tsx` fails to load with
`SyntaxError: Unexpected token 'typeof'` (whole-suite parse error, not an assertion).
It is untouched by 34-06's commits and is attributable to a pre-existing uncommitted
`tsconfig.json` change in the working tree (removed `.expo/types` / `expo-env.d.ts`
from `include`), which the execution constraints explicitly forbid modifying. Full
suite otherwise: `1 failed | 348 passed` suites, all 3263 individual tests pass.
Documented in `deferred-items.md`; reconcile with Phase 30.

## Flagged Assumptions (carried forward)

- **Quick Log channel (RESEARCH A2):** Quick Log keeps `channel:'unspecified'` rather than adopting the Default Interaction Channel preference. Unchanged pending owner sign-off; not altered silently.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- CAPT-05 (post-log Note/Memory capture) and CAPT-13 (preselection confirmed) are implemented and node-tested; on-device UAT for D4/D5 remains for end-of-phase verification.
- The two-action snackbar is available for any future multi-action transient feedback.
- No blockers introduced. Remaining phase-34 plans (34-07, 34-08) are unaffected by this additive work.

## Self-Check: PASSED

All created files present on disk (post-log-note-logic.ts + test, snackbar-store.test.ts, PostLogNoteEditor.tsx, this SUMMARY) and all four task commits (bdb0c27, 97b7ac0, f09471f, 7fd3b02) present in git history.

---
*Phase: 34-rapid-capture-update-flows*
*Completed: 2026-09-12*
