# ADR-213: Moving Entries Between Things to Remember Sections

**Status:** Accepted
**Date:** 2026-10-15
**Phase:** 38.10-fuel-retirement-things-to-remember
**Source decisions:** D-06, D-84, D-85, D-93, D-103, D-108, D-118 (38.10-CONTEXT.md; ledger Q-28, Q-29; plan-phase A5; plan-check C3, cycle 2 Q1; convergence c8 Q-P9)
**Reversibility:** costly
**Migration:** 033
**Supersedes:** None
**Superseded by:** None

## Context

Entries land in the wrong section (a migrated fact, a share sent to the default section), and ROADMAP 999.6 asked that an entry can be moved where it belongs (D-06). The sections live in three tables (ADR-207).

## Decision

We will let any entry move between Memories, Thought of Them, Gift Ideas, Last Talked About and Off Limits (D-84). Within memory types a move is a type change; into or out of Last Talked About or Off Limits it copies to the other table and removes the original in one transaction. Custom fields and Imported are not targets. A move that would drop fields first shows a confirm listing what will be removed (D-85). A move into Off Limits switches AI off for good; if the entry was linked to an interaction, that note's Allow AI is switched off and locked (`interactions.note_ai_locked`) in the same transaction, and no route can turn it back on (D-93, D-103). Moves into or out of Last Talked About and Off Limits offer Undo that restores the entry with its previous fields; the AI-off effect and any note lock stay after Undo (D-118). A moved share keeps its came-from-a-share marker so it still counts for the share picker's recency (D-108).

## Alternatives Considered

- **Moves only among memory types** — rejected (Q-28, "All sections").
- **Move silently, dropping what does not fit** — rejected (Q-29, "Warn, then move").
- **Leave a linked note's AI setting alone on a move into Off Limits** — rejected (A5, C3).
- **No Undo for cross-table moves** — rejected (c8 Q-P9).

## Consequences

### Positive

- Misfiled entries are fixable without retyping; Off Limits moves only ever narrow AI access.

### Negative

- A round-trip move out of memories and back recreates an `import`-provenance memory as `user` (review IN-05, skipped; reachable only for legacy rows).

### Risks

- The note lock is set-only; a mistaken move into Off Limits keeps the note AI-off permanently.

## Implementation

**Key files:**
- `src/db/knowledge-move-dao.ts` — move, batch move and Undo cores, `fieldsDroppedByMove`.
- `src/db/recency-dao.ts` — `editTouchpointFullCore` sets `note_ai_locked` and clamps `allow_ai`.
- `src/components/MoveEntrySheet.tsx` — the move sheet and drop confirm.
- `src/logic/move-entry-logic.ts` — targets, confirm text, move and Undo snackbars.
- `src/db/migrations/033-knowledge-homes.ts` — `note_ai_locked` and `from_share` columns with CHECKs.

**Depends on:** ADR-207 (Knowledge Homes After Fuel); ADR-211 (Linked Interaction Notes Through "Also Save To")
**Required by:** ADR-216 (A Share Saves at Once to Thought of Them, with an Interactive Confirmation Card and the List Picker)
