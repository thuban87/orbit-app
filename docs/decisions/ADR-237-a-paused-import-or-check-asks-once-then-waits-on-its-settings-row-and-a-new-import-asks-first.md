# ADR-237: A Paused Import or Check Asks Once, Then Waits on Its Settings Row, and a New Import Asks First

**Status:** Accepted
**Date:** 2026-10-18
**Phase:** 38.12-lifecycle-import-settings-ux
**Source decisions:** D-105, D-111, D-56, D-150, D-160 (38.12-CONTEXT.md; ledger Q-11, Q-17, mid-execution ruling R6, device batch DIS)
**Reversibility:** reversible
**Migration:** 034
**Supersedes:** None
**Superseded by:** None

## Context

"Resume your check?" and "Resume your import?" popped up on every launch and every return to the foreground until the user resolved them. Starting a new import silently discarded a paused one, because `getResumableSession` discarded older sessions as a side effect of reading. The two prompts also had different copy and sizes.

## Decision

A paused check asks "Resume your check?" once, at the next launch or foreground after it was left (D-105). A paused import asks "Resume your import?" once, stating how many people are left and what Discard drops (D-111). After that the prompt never returns. Settings → Contacts & Relationships shows "Finish your check (N left)" on the Check linked contacts row, and "Finish your import (N left)" on the Import contacts row, until the work is finished or discarded.

The "asked once" marker is `resume_prompted_at` on `import_sessions` and `reconciliation_sessions` (migration 034). The prompt component writes it when it mounts, since the app renders only the active, unsuppressed prompt, and never the sweep. Both prompts gain "Not now". The photo-only import prompt keeps "Later" in place of Discard.

The prompts read through side-effect-free newest-session reads, `getNewestResumableImportSession` and `getNewestResumableReconcileSession`. A separate stale-cleanup call discards older pending sessions (D-56). The old discarding reads are gone. Both prompts share one layout, `ResumePromptSheet`.

Starting a new import while one is paused first asks "Finish your last import first?" with Resume or Discard. "Discard and start new" is styled destructive inside that one chooser (D-150). On the launch prompts Discard keeps its red outline (D-160). A corrupt, discard-only paused import gets a destructive confirm, "Discard your last import?".

## Alternatives Considered

- **No popup, only the Settings row** — rejected; the owner chose one popup, then the row (Q-11 A).
- **Keep the popup on every launch** — rejected (Q-11 C, Q-17 C).
- **The check pattern without asking before a new import** — rejected for "Same as check + ask first" (Q-17 B).
- **Plain Discard styling in the chooser** — rejected for destructive styling (R6), kept as built at the device batch (DIS).

## Consequences

### Positive

- A paused job is mentioned once and then waits where the user started it.
- A paused import is never discarded without the user choosing to.

### Negative

- A user who dismisses the one prompt has to find the Settings row to finish.

### Risks

- The marker is written on mount. A prompt that mounts while hidden would mark itself asked; App renders only the active, unsuppressed prompt to prevent that.

## Implementation

**Key files:**
- `src/db/migrations/034-snooze-review-memory-resume.ts` — part b, `resume_prompted_at` on both session tables.
- `src/db/resume-prompt-dao.ts` — mark and clear the asked-once marker for import and check.
- `src/db/import-session-read.ts` — `getNewestResumableImportSession`, `discardStaleImportSessions`, `importPeopleLeft`.
- `src/db/reconcile-session-read.ts` — `getNewestResumableReconcileSession`, `discardStaleReconcileSessions`, `countReconcileCardsLeft`.
- `src/services/import/contact-import-resume-sweep.ts` — the import resume sweep.
- `src/services/import/reconcile-resume-sweep.ts` — the check resume sweep.
- `src/components/ResumePromptSheet.tsx` — the shared prompt layout.
- `src/components/ResumeImportPrompt.tsx` — the import prompt, marker on mount.
- `src/components/ResumeReconcilePrompt.tsx` — the check prompt, marker on mount.
- `src/screens/SettingsContactsScreen.tsx` — the rows and the ask-first chooser.
- `src/screens/settings-contacts-model.ts` — `contactsRowSubtitle`, the "Finish your …" rows.
- `App.tsx` — renders only the active, unsuppressed prompt.

**Depends on:** ADR-065 (Durable Resumable Contact-Import Sessions with Failure-Isolated Photos); ADR-068 (User-Triggered, Source-Only Reconciliation with Durable Review)
**Required by:** None
