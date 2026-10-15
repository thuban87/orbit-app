# ADR-211: Linked Interaction Notes Through "Also Save To"

**Status:** Accepted
**Date:** 2026-10-15
**Phase:** 38.10-fuel-retirement-things-to-remember
**Source decisions:** D-37, D-38, D-40, D-42, D-49, D-95, D-96, D-98, D-102, D-107, D-113, D-117 (38.10-CONTEXT.md; ledger Q-33, Q-36, Q-37, Q-38, Q-42; plan-phase A7/A7b, P3; plan-check C2, R2; convergence c1 Q-P2, c6 Q-P8)
**Reversibility:** costly
**Migration:** 033
**Supersedes:** ADR-132 (partial — Quick Log "can subsequently save exactly one Interaction Note or basic Memory", and the Add Note sheet's "Create Memory Instead", die; Quick Log stays an immediate current-time write)
**Superseded by:** None

## Context

Logging a call and remembering what was talked about meant logging the interaction, then separately adding a Last Talked About entry through Update Contact (owner, Q-04). The Add Note sheet offered "Create Memory Instead", which replaced the note rather than keeping both.

## Decision

We will let an interaction note also be saved to one section — Last Talked About, Gift Ideas, Thought of Them or Memories — from Log Interaction, the Add Note sheet and + → Group Log (D-38, D-40, D-42, D-95, D-96). The entry is **linked**: one text in two places, written in the same transaction with the interaction's date and time; editing either side updates both; History shows one row tagged with the section; tapping the entry opens the interaction (EditInteraction, EditParticipant or GroupEventDetail), with Edit, Pin and Unpin on long-press (D-37, D-107); deleting the interaction leaves a standalone entry. A linked note has one Allow AI switch covering every place it appears (D-49). "Create Memory Instead" is removed (D-42). A Group Note saved to a section gives every participant a copy linked to their own interaction row (D-96); copies are always AI-off with a locked switch, keyed on the copy's own origin so the lock survives unlinking (D-98, D-102). Clearing a Group Note detaches its copies as ordinary entries (D-113); editing one person's copy detaches only that copy (D-117). A participant's own linked note may not be cleared while linked (`LinkedNoteBlankError`).

## Alternatives Considered

- **Copy the note instead of linking** — rejected (Q-33, "Linked").
- **Only Last Talked About as a destination** — rejected (Q-36, "All TTR sections").
- **Leave the Log Interaction control to 38.14** — rejected (Q-37, "38.10 end to end").
- **Keep "Create Memory Instead"** — rejected (Q-38).
- **Several sections per note** — rejected: "they cover pretty different things" (D-95).
- **Group Note copies follow D-49's one switch** — rejected: Group Notes never egress (ADR-078, ADR-136) (P3).
- **Refuse clearing a Group Note with copies; propagate copy edits to the Group Note** — replaced by detach (D-113, D-117).

## Consequences

### Positive

- One write captures both the interaction and what to remember; History is not duplicated.

### Negative

- ADR-125's "Group Note is stored once on the parent" now has per-participant Things to Remember copies; they are not participant notes and never egress.

### Risks

- Text sync crosses two tables; every entry-side edit of a note link must route through the interaction writer (`editInteractionNoteCore`), never write the entry alone.

## Implementation

**Key files:**
- `src/db/linked-entry-dao.ts` — linked inserts, propagation, Group Note copies and detach.
- `src/db/recency-dao.ts` — `recordTouchpointWithLinkedEntry`, `saveNoteWithLinkedEntry`, `editInteractionNoteCore`.
- `src/db/group-events-dao.ts` — `updateGroupEventCore`, `alsoSaveTo` on Group Log, unlink on detach/dissolve.
- `src/db/history-read.ts` — `linkedSections` on interaction records; linked entries skipped as knowledge rows.
- `src/logic/also-save-to-logic.ts` — the one destination rule and snackbar copy.
- `src/components/AlsoSaveToPicker.tsx` — the one-section chip row.
- `src/screens/LogInteractionScreen.tsx` — Also save to on detailed logging.
- `src/components/PostLogNoteEditor.tsx` — Also save to on the Add Note sheet; Create Memory Instead removed.
- `src/screens/GroupLogScreen.tsx` — Also save to on the Group Note.
- `src/logic/linked-entry-route.ts` — where a linked entry opens.
- `src/logic/ai-lock.ts` — lock reasons for Group Note copies and locked notes.
- `src/components/history/HistoryStreamRows.tsx` — section tags on interaction rows.

**Depends on:** ADR-210 (Dated Last Talked About and Current Location); ADR-117 (Per-Interaction Allow-AI Consent Gate); ADR-125 (Three-Field Live Inheritance with Separate Local-Only Group Notes); ADR-132 (Focused Rapid Capture Workflows)
**Required by:** None
