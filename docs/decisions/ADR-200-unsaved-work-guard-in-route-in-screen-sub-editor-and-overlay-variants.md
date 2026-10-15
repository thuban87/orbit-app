# ADR-200: Unsaved-Work Guard in Route, In-Screen Sub-Editor and Overlay Variants

**Status:** Accepted
**Date:** 2026-10-11
**Phase:** 38.9-ux-standards
**Source decisions:** D-13, D-14, D-15, D-33, D-34, D-61, D-68 (38.9-CONTEXT.md; ledger Q-07, Q-08 + confirmation, Batch 9, Batch 10); carried D-03
**Reversibility:** reversible
**Migration:** None
**Supersedes:** None
**Superseded by:** None

## Context

Back threw away typed work on Add Contact (E-01) and Log Interaction (F-01), on Capture, on the Update Contact and custom-field editors, on + → Memory and on the pending-confirmation note. Six route forms already had `useDiscardKeepGuard`, but it was a native Alert reading "Discard", and it had no notion of an inner editor. The phase-01 dossier already asked for "Discard changes" / "Keep editing" (D-01-016) and for Back to close the topmost transient first (D-01-021).

## Decision

Every form with meaningful unsaved changes gets the guard; an untouched form leaves at once. The prompt is the themed "Discard changes?" with **Keep editing** / **Discard changes**, through the single-flight `confirmDiscard()` (D-13). Back (header, system key, gesture) first closes the innermost sheet or in-screen sub-editor and prompts only if typed text would be lost. `decideGuardOnRemove` has four outcomes (allow, prompt-and-leave, close sub-editor, prompt-and-close), and sub-editor outcomes apply only to GO_BACK/POP, so a RESET or NAVIGATE never closes a sub-editor (D-14). An editor's own Cancel follows the same rule through `requestClose` (D-61), and folding an Edit Contact section that holds a typed draft prompts first (D-68). Dirty means changed against the form's seed: Add Contact compares with its seed values, so a defaulted fresh form is never dirty; Log Interaction snapshots after `seed()`, is off while the contact picker shows, and every save sets the bypass before it navigates (D-15). The overlay variant guards the pending-confirmation note; Capture's BackHandler closes an open New-contact sheet first and prompts for a typed note instead of discarding and leaving the app (D-33). Backup schedule day counts save when the field is left (and when the app goes to the background), an invalid count shows its inline error and is not saved, and the "Save schedule" button is gone; AI Writing Style keeps its Save, gains the guard and shows a "Saved" snackbar (D-34). Review fixes added a save-in-flight hold (`busyRef`, `settleHold()`), documented in `docs/systems/ux-standards.md`.

## Alternatives Considered

- **Capture saves the typed note on Back** — Rejected; same rule as every form (Q-07).
- **Keep Save + guard on Backup schedule** — Rejected by the owner: day counts save on change (Q-08).
- **Save-on-change for AI Writing Style** — Rejected: "prose that they might want to undo so that should have a save button" (Q-08).
- **Cancel closes a typed editor without asking** — Rejected (Batch 9, D-61).
- **Guard the fuel editor** — Rejected by the owner; it is retired in 38.10 (Batch 10, no D-ID).

## Consequences

### Positive

- One rule for Back, Cancel and fold across routes, sub-editors and sheets; Phase 39 consumes E-01/F-01 as built (D-03).

### Negative

- Editors that keep typing privately must report `{open, dirty}` to their host (`onDraftStateChange`, `onCancelRequest`, a `closeDraft` ref).

### Risks

- A form whose dirty check does not compare against its seed will prompt on an untouched form; the Off Limits, Things to Remember and MemoryHistory editors were not guarded here and are left to 38.10.

## Implementation

**Key files:**
- `src/navigation/discard-keep-guard.ts` — `useDiscardKeepGuard`, `decideGuardOnRemove`, `requestClose`, `confirmDiscard`.
- `src/screens/CreateContactScreen.tsx` — the Add Contact guard from first render.
- `src/screens/create-contact-logic.ts` — the seed state, `isCreateFormDirty` and `pickCreateSubEditor`.
- `src/screens/LogInteractionScreen.tsx` — the Log Interaction guard and save bypass.
- `src/screens/log-interaction-logic.ts` — `isLogInteractionDirty`.
- `src/screens/EditContactScreen.tsx` — open drafts hold Back and section folds.
- `src/screens/UpdateContactScreen.tsx` — innermost-first close of the row and custom-field editors.
- `src/screens/update-contact-chooser-logic.ts` — `resolveUpdateEditorClose` and row dirty state.
- `src/screens/CustomFieldsScreen.tsx` — the field editor as an in-screen sub-editor.
- `src/screens/MemoryScreen.tsx` — the + → Memory draft guard.
- `src/screens/AIPersonalizationScreen.tsx` — the Writing Style guard and "Saved" snackbar.
- `src/screens/ai-personalization-logic.ts` — the token-gated load/save baseline.
- `src/screens/CaptureScreen.tsx` — the Capture BackHandler.
- `src/screens/capture-back-logic.ts` — `resolveCaptureBack`.
- `src/components/PendingConfirmationsSheet.tsx` — the overlay guard on typed notes.
- `src/components/pending-confirmations-sheet-logic.ts` — note dirty tracking and close prompting.
- `src/screens/BackupSettingsScreen.tsx` — the schedule saves on leave; Save button removed.
- `src/screens/backup-settings-logic.ts` — `createBackupDayController` and `subscribeBackgroundLeaveFlush`.
- `src/navigation/editor-cancel-contract.test.ts` — every editor Cancel goes through `requestClose`.

**Depends on:** ADR-198 (Themed Dialogs Through One Imperative Host, an Overlay Registry, and Snackbars Above Overlays); ADR-109 (Fixed-Hero Semantic Profile Composition and Focused Accessible Editors)
**Required by:** ADR-201 (Shared Child Header with a Chevron Back and a Person Line on Every Pushed Screen); ADR-219 (Per-Section Editors Replace the Things to Remember and Memory Screens, with Card Edit Mode and a Section Add Button)
