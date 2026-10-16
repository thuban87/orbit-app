# ADR-206: Glossary — Canonical Terms Kept, Retired Forms Enforced, Plain-Word Rewrites, and a Shared Plural Helper

**Status:** Accepted
**Date:** 2026-10-11
**Phase:** 38.9-ux-standards
**Source decisions:** D-21, D-22, D-41, D-42, D-49, D-56, D-63, D-74, D-75 (38.9-CONTEXT.md; ledger Q-15, Q-16, Q-17, Batch 7, Batch 9; phase code review WR-03; fix-pass verification IN-02)
**Reversibility:** reversible
**Migration:** None
**Supersedes:** None
**Superseded by:** None

## Context

One concept had several names: "Dashboard" and "Contacts", "Log Contact" and "Log Interaction", "Wobbling" and "Wobbly", "Group Event" and "Event", "Not Contacted" and "Not yet contacted" and "Never Contacted", "Favourites" and "Favorites". Developer wording ("Follows event", "overridden", "participant record", "Sensitive Operations", "Tombstones", "Reset Overrides") reached users, and two private pluralise helpers left counts reading "1 contacts".

## Decision

No decided term is renamed: Bound / Unbound and "Orbit participation", Transmit, Group Log, Dissolve, Stable / Wobbly / Decaying / Rogue, Interaction Assist and Quarantine stay, and `src/constants/glossary.ts` records them as canonical label constants (D-41, D-21). Retired user-visible forms are enforced: "Dashboard" → "Contacts", "Log Contact" → "Log Interaction", "Wobbling" → "Wobbly", and "Event(s)" is the user-facing noun (D-22). "Never Contacted" is the single label on the Digest Horizon, the Contacts population filter, card and status labels, the "N never contacted →" line and Systems/Orrery labels (D-42, D-56). User-visible text uses American "Favorite(s)", including the widget label; persisted identifiers (`favourites`, `OrbitFavourites`, `orbit://favourites`) stay (D-49). Surrounding developer wording is rewritten in plain words, except decided metric names such as Gravity; the Systems, category and template "override" labels become plain words while the milestone-2 D-09-088 edit/reset operation is unchanged (D-41, D-63). The owner approved the executor's wording where D-22/D-41 left it open (D-74). The overflow label "Make this a group interaction", recorded `[DECIDED]` in the Phase 11/12 dossiers, becomes "Make this an event", and "group interaction" is retired app-wide (D-75; a partial supersession of that dossier label, not of any ADR). A TypeScript-AST contract walks string literals, template pieces and JSX text over `src` and `app.config.ts` for retired forms, guards against renaming decided terms, and keeps the persisted identifiers. Every user-visible count goes through `plural(n, one, many?)` / `pluralWord` (D-21).

## Alternatives Considered

- **Rename some decided terms** — Rejected; each would reverse a recorded decision (Q-15).
- **A different word than "Never Contacted"** — Rejected; it would reverse the phase-38 dossier (Q-16).
- **British "Favourite(s)"** — Rejected (Q-17).
- **Keep "Make this a group interaction"** — Rejected at fix-pass verification (D-75).
- **Grep-based copy checks** — Not chosen; the AST walk skips comments and identifiers.

## Consequences

### Positive

- One word per concept, enforced by a test rather than by review.

### Negative

- Every copy change that touches a retired form must also update the contract allowlists, which fail on stale entries.

### Risks

- Developer-wording forms (D-41) are checked only in the files 38.9 converted; screens outside that list can still carry them until their area phase rewrites them.

## Implementation

**Key files:**
- `src/constants/glossary.ts` — the canonical label constants.
- `src/constants/glossary-contract.test.ts` — retired forms, the no-rename guard and persisted identifiers.
- `src/utils/plural.ts` — `plural` and `pluralWord`.
- `src/screens/ai-permissions-logic.ts` — private plural helper replaced.
- `src/db/purge-dao.ts` — private plural helper replaced (import only).
- `src/components/control-surface/control-labels.ts` — population labels from the glossary.
- `src/components/history/InteractionDetail.tsx` — "Make this an event".
- `src/components/group/GroupTitlePromptSheet.tsx` — "Make this an event" and event wording.
- `src/screens/SystemsManagementScreen.tsx` — `RESET_MANUAL_CHANGES_ACTION` replaces "Reset Overrides".
- `src/profile/template-manager-model.ts` — `describeAssignmentKind` plain-word captions.
- `app.config.ts` — the widget picker label "Orbit — Favorites".

**Depends on:** ADR-132 (Focused Rapid Capture Workflows); ADR-075 (Binary Favourite Membership Without a User-Facing Order)
**Required by:** ADR-226 (Archive Becomes the Bin, and Move to Bin Confirms First with No Undo); ADR-228 (Truthful Relationship Overview — Never Contacted, Honest Unbound Reasons, Plain Definitions and a Custom Frequency Row)
