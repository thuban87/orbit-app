# ADR-167: Committed Participant Writes Preserve the Parent Draft and Never Replay

**Status:** Accepted
**Date:** 2026-09-23
**Phase:** 38.3-audit-remediation-runtime-state
**Source decisions:** dossier Workstream A; 38.3-CONTEXT D-04, D-17, D-18, D-19; RG-019 (reliability-testing/AUD-REL-006, REL-007, REL-008); review A-WR-03, A-WR-04
**Reversibility:** reversible
**Migration:** None
**Supersedes:** None
**Superseded by:** None

## Context

Editing an already-overridden participant field produced an empty patch and was silently dropped. After any participant add, remove, or edit, the Group Event editor reloaded and reseeded every parent field, discarding the unsaved parent draft. Add and reload shared one catch, so a committed add whose readback failed was reported as "Couldn't add", inviting a duplicate insertion.

## Decision

Both participant editors build patches through one pure builder: an overridden field whose value changed emits `{ follow: false, value }`, and `{ follow: true }` is emitted only when the draft explicitly follows; follow is never inferred from value equality (ADR-125). Participant add, remove, and edit commit on their own while the parent draft and its dirty baseline stay intact; only the initial load seeds the draft, and refreshes update participant state without reseeding parent fields. While the parent is dirty, following participants show the saved event's values. A committed add whose refresh fails closes the picker as success, and the event screen shows "Couldn't refresh this event" with a Retry that only re-reads. Removes are latched, committed removals stay hidden, and stale errors clear on the next action. The DAO duplicate-participant guard is unchanged.

## Alternatives Considered

- **Prompt save/discard before participant actions** — rejected (D-17) in favour of silent draft preservation.
- **Show unsaved draft values on following participants** — rejected (D-18); they would not match the database.
- **Keep the picker open with an "Added" state after a failed refresh** — rejected (D-19).
- **Infer follow from value equality** — rejected by ADR-125 and enforced by a test.

## Consequences

### Positive

- Participant work cannot cost the user their parent draft or duplicate a committed participant.

### Negative

- Group Event screens carry an explicit reducer separating draft, baseline, and refreshed event state.

### Risks

- Group Event writes do not notify the widget (review A-WR-06); this was deferred to the widget phase.

## Implementation

**Key files:**
- `src/logic/group-participant-patch.ts` — shared follow/field patch builders.
- `src/screens/EditParticipantScreen.tsx` — participant Save through the shared builders.
- `src/screens/EditGroupEventScreen.tsx` — draft-preserving reducer, refresh-only Retry, and remove latch.
- `src/screens/GroupEventDetailScreen.tsx` — committed-add success with an inline refresh error.
- `src/screens/group-event-refresh.ts` — `groupEventEditReducer` and latest-request refresh controller.

**Depends on:** ADR-125 (Three-Field Live Inheritance with Separate Local-Only Group Notes); ADR-127 (Canonical Event-First Group Logging and Explicit Child Edit Scope)
**Required by:** None
