# ADR-161: Durable Post-Commit Import Recovery and AI-Off Provenance

**Status:** Accepted
**Date:** 2026-09-23
**Phase:** 38.2-audit-remediation-data-security-lifecycle
**Source decisions:** dossier Workstreams A and C; 38.2-CONTEXT D-07 and D-14; RG-007 and RG-012
**Reversibility:** costly
**Migration:** None
**Supersedes:** None
**Superseded by:** None

## Context

A contact import can commit the relationship row before its photo master succeeds, and accepted provider snapshots can contain sensitive notes and raw photo copies. Retrying the entire import risks duplicate contacts, while discarding all session state loses the only retry input; imported notes also must not inherit a permissive global AI default.

## Decision

The system treats an imported contact commit and its photo completion as separate durable outcomes. Outstanding staged photos remain tied to the committed row across process death, surface through the existing Import Complete flow, and support photo-only Retry or one explicit Skip remaining photos action under canonical photo ownership checks. Purge and foreground retirement remove workflow copies only when no live import or external link owns them, and every newly created imported-note Memory stores `allow_ai = 0` regardless of the general default; existing rows are never reset automatically.

## Alternatives Considered

- **Retry the full contact import after photo failure** — rejected because the contact already committed and replay could duplicate data.
- **Discard photo input immediately after contact commit** — rejected because it removes the only safe recovery path after process death.
- **Apply the general Memory AI default or reset existing imported notes** — rejected by D-07 because imported provenance must start AI-off and retrospective blanket changes would override user choices.

## Consequences

### Positive

- A safe contact commit survives photo failure while the user retains an explicit bounded recovery or discard path.
- Imported freeform notes remain outside AI context until individually enabled.

### Negative

- Completed import sessions can remain resumable while photo work is outstanding, and purge must retire several workflow origins explicitly.

### Risks

- Resume or cleanup code that ignores active screen/session ownership can delete not-yet-published staging or interrupt a live picker flow.

## Implementation

**Key files:**
- `src/services/import/import-photo-retry.ts` — retries only outstanding photo work under canonical identity and generation guards.
- `src/db/import-session-dao.ts` — commits retry publication, staging retirement, and explicit skip transitions.
- `src/db/import-session-read.ts` — derives resumable sessions and photo-outstanding completion state.
- `src/services/import/contact-import-resume-sweep.ts` — surfaces live recovery and retires detached workflow copies safely.
- `src/db/imported-contact-dao.ts` — creates imported-note Memories with stored AI permission off.
- `src/services/import/source-consolidation.ts` — retires unused staging and preserves AI-off import provenance.
- `src/screens/ImportCompleteScreen.tsx` — exposes photo-only Retry and Skip remaining photos.

**Depends on:** ADR-065 (Durable Resumable Contact-Import Sessions with Failure-Isolated Photos); ADR-091 (Imported Contact Notes as AI-Off Typed Memories); ADR-158 (Canonical Photo Ownership Across Masters, Staging, and Derivatives)
**Required by:** ADR-168 (Truthful Read Phases for Import, Review, and Settings Screens)
