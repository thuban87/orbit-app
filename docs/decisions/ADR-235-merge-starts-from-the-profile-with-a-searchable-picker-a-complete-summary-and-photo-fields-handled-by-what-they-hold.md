# ADR-235: Merge Starts from the Profile with a Searchable Picker, a Complete Summary, and Photo Fields Handled by What They Hold

**Status:** Accepted
**Date:** 2026-10-18
**Phase:** 38.12-lifecycle-import-settings-ux
**Source decisions:** D-99 (flow half), D-43, D-44, D-131, D-129 (Merge conflicts half), D-146, D-166 (38.12-CONTEXT.md; ledger Q-06, Q-30, mid-execution ruling R2, device batch NKP); carried D-22
**Reversibility:** reversible
**Migration:** None
**Supersedes:** None
**Superseded by:** None

## Context

Merge was reachable only from a linked card in Check linked contacts, so Orbit-only duplicates could not be merged. Its survivor picker was a plain list with no search, and loading or error looked like an empty list. The summary left out memories, relationships, current state, custom values, contact links and assists, and MergeConflicts ran its own SQL. A merge failed when the absorbed person had text in a photo-type custom field, and Merge conflicts showed a photo path as raw text.

## Decision

Merge starts from the Profile ⋯ "Merge with another contact…" for any live person (ADR-233), as well as from Check linked contacts (D-99). Step one embeds the shared `ContactPickerList`, with search and a header Cancel. It shows this person first, never lists Bin contacts, and has its own loading and error states (D-43).

The merge summary counts every table `mergeContacts` reparents, including memories, relationships, current state, custom values, contact links and pending assists. Each line shows only when its count is non-zero, and the audit trails are not listed (D-44). The conflict read lives in a DAO, `readMergeConflictData` (D-44).

A photo-type conflict is a photo choice only when both values are stored photo paths. Any text on either side makes it a text choice, where a stored path reads "Photo" (D-129). During the merge only a stored photo path takes the rehome path, and text in a photo field moves as an ordinary raw TEXT custom value (D-131).

The survivor keeps its own Profile layout, background and Orrery overrides (D-146). The summary lists what of the absorbed person's is dropped under "Not kept from <absorbed name>:" (D-146, D-166). A merge from a Profile ends on the survivor's Profile, and one started in Settings ends back in Settings (ADR-241).

Merge never links automatically from name or birthday evidence (D-22).

## Alternatives Considered

- **A Merge link on Edit Contact**, or **no Profile entry** — rejected for ⋯ (Q-06).
- **Leave photo fields as they are in Merge conflicts** (fix only the failure) — rejected; the owner chose to present them as photos and show text as text (Q-30 B).
- **Carry the absorbed person's presentation over** — not chosen; the survivor's is kept and the dropped items are listed (R2).
- **"Not kept from <absorbed> (<survivor>'s stay)"** — the built wording; the owner chose the shorter line at the device batch (NKP).

## Consequences

### Positive

- Any two live people can be merged, linked or not.
- The summary states everything the merge moves and what it drops.

### Negative

- None recorded.

### Risks

- A new table that `mergeContacts` reparents must also be added to `MergeImpactCounts`, or the summary undercounts again.

## Implementation

**Key files:**
- `src/screens/SurvivorSelectScreen.tsx` — the picker step on `ContactPickerList`.
- `src/screens/survivor-select-logic.ts` — `mergePickerRows` (no first person, no Bin).
- `src/screens/MergeConflictsScreen.tsx` — renders photo and text conflict kinds.
- `src/screens/merge-conflict-logic.ts` — conflict resolution by kind.
- `src/db/merge-conflicts-read.ts` — `readMergeConflictData`, `MergeCustomConflictKind`.
- `src/components/MergeImpactSummary.tsx` — the summary and the "Not kept from" block.
- `src/components/merge-impact-lines.ts` — `mergeImpactLines`, `mergeDroppedLines`.
- `src/db/merge-impact-read.ts` — counts over every reparented table and the dropped items.
- `src/db/merge-dao.ts` — text in a photo field moves as a raw custom value; presentation kept from the survivor.
- `src/services/photos/merge-photo-rehome.ts` — only stored photo paths are rehomed.

**Depends on:** ADR-069 (Atomic Tombstone-Backed Orbit Contact Merge); ADR-001 (Normalized Custom-Field Values)
**Required by:** None
