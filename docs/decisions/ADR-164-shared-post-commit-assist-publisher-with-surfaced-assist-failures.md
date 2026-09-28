# ADR-164: Shared Post-Commit Assist Publisher with Surfaced Assist Failures

**Status:** Accepted
**Date:** 2026-09-23
**Phase:** 38.3-audit-remediation-runtime-state
**Source decisions:** dossier Workstream D; 38.3-CONTEXT D-04, D-08, D-21; RG-023 with react-native/AUD-RN-013; review B-CR-01, B-WR-05
**Reversibility:** reversible
**Migration:** None
**Supersedes:** None
**Superseded by:** None

## Context

Each assist confirmation surface published a different subset of consequences: Compose skipped the assist queue and widget, while AssistBanner and PendingConfirmationsSheet skipped the shell refresh. Banner and sheet dropped write rejections silently (the Phase 21 IN-03 / RN-013 deferral), double taps could race, and a confirm of an already-closed assist could report success with no interaction written. Post-Log note saves also omitted the shell refresh.

## Decision

Every assist confirm and dismiss goes through one runner, `runAssistAction`, whose never-rejecting post-commit publisher performs widget notify, assist-queue refresh, and `bumpShellRefresh()`. Surfaces latch in-flight actions, catch rejections, and show an Alert; the ADR-071 future-date / clock-rollback guard has its own copy; the assist stays pending on failure. `markAssistLogged` resolves `logged`, `already-logged`, or `closed`, and `closed` is shown as "Already closed" rather than logged. A publish or re-read failure after a committed write is never reported as a failed write (D-04); the Post-Log note and "Create Memory Instead" paths publish the shell tick and treat only a rejected write as a failed save. The ADR-071 guard, handoff-time timestamp, and pending recheck are unchanged.

## Alternatives Considered

- **Keep RN-013 deferred** — rejected by the owner (D-08); silent failure left users believing an interaction was logged.
- **Per-surface publication** — rejected (D-21); the divergence was the bug.
- **Report a failed re-read as "Couldn't save"** — rejected (D-04, review B-CR-01); it invited a duplicate Memory.

## Consequences

### Positive

- All confirmation surfaces converge Digest, Home, queue, and widget after one committed write, and failures are visible.

### Negative

- New confirmation surfaces must use the runner rather than calling the DAO directly.

### Risks

- The widget leg of assist publication was owner-deferred to the widget phase and has no device pass.

## Implementation

**Key files:**
- `src/services/assist-commit.ts` — `runAssistAction` and the shared post-commit publisher.
- `src/components/AssistBanner.tsx` — latched, Alert-surfacing banner confirm/dismiss.
- `src/components/PendingConfirmationsSheet.tsx` — per-uid latches and failure Alerts.
- `src/components/AssistConfirmation.tsx` — no longer drops `onConfirm` rejections.
- `src/screens/ComposeScreen.tsx` — Compose confirmation through the shared runner.
- `src/stores/assist-store.ts` — latest-wins queue refresh.
- `src/db/interaction-assist-dao.ts` — `markAssistLogged` outcome (`logged` / `already-logged` / `closed`).
- `src/db/log-guards.ts` — distinguishable future-date guard error.
- `src/components/PostLogNoteEditor.tsx` — Post-Log shell publication and committed-Memory truth.
- `src/screens/post-log-note-logic.ts` — `commitThenReReadMemory` seam.

**Depends on:** ADR-070 (Durable Pending Interaction-Assist Lifecycle and Portable Opt-Out); ADR-071 (User-Attested Handoff-Time Interaction Logging Through the Sole Recency Writer); ADR-162 (Sweep-Ordered Foreground Refresh and Latest-Request Publication Authority)
**Required by:** None
