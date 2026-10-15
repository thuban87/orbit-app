# ADR-218: Things to Remember on the Profile — Section Order, Heading Actions, Empty Add, Pin, and Hide from Profile Switched Off

**Status:** Accepted
**Date:** 2026-10-15
**Phase:** 38.10-fuel-retirement-things-to-remember
**Source decisions:** D-21, D-22, D-24, D-44, D-68, D-70, D-71, D-72, D-87, D-112, D-127, D-133, D-134, D-148, D-152 (38.10-CONTEXT.md; ledger Q-03b, Q-17, Q-20, Q-30, Q-46, Q-47; convergence c1 Q-P1; plan-19 sign-off and re-check; code review IN-05); carried D-10, D-17
**Reversibility:** reversible
**Migration:** None
**Supersedes:** ADR-150 (partial — "heading actions route to existing source-owned editors" dies: each section now has one per-section heading action; heading-only titles and the Most Recent + five Previous projection survive)
**Superseded by:** None

## Context

The Profile's Things to Remember had raw ids on its entry sheet, a dead Pin and Hide (the Profile ignored the action), pencils that went to four different editors, Pinned capped at three and excluded from its own section, and no section for the new Gift Ideas and Thought of Them types. The owner's rule of thumb: regularly changed → an Add button; rarely changed → a pencil to that section's own editor (Q-46).

## Decision

We will show the sections in this order: Pinned, Last Talked About, Key People, Current Location, Memories, Thought of Them, Gift Ideas, Custom Fields, Off Limits, Imported from Contacts App (D-44); saved layouts gain missing sections at their factory position at read time, never written back. A section with entries shows one heading action: Add for Last Talked About, Thought of Them, Gift Ideas and Memories; a pencil for Current Location, Key People, Off Limits, Custom Fields and Imported; none for Pinned (D-72). An empty section shows a short line and an "Add …" action to that section's add form (D-68). Pin and Unpin work from the Profile through the partial-patch writers, offered only where the table has a pin column (memories and key people) (D-21, D-22, D-70). Pinned shows every pinned item with no cap and no View all (D-112); pinned items also stay in their own section and carry a pushpin icon instead of the word "Pinned" (D-133). A section shows its newest entries ignoring pins: a meaningful date first by that date, then newest added (D-148, D-152). The entry sheet reads Edit, Pin, Unpin, Close; a link entry shows its URL with Open (D-24, D-87). Off Limits starts open but can still be folded (D-127). Hide from Profile is hidden everywhere in the UI by `HIDE_FROM_PROFILE_ENABLED = false`; the stored `hidden` flag is kept but ignored for display, so every item shows until the feature returns (D-70, D-134); whether to keep Hide at all is deferred (D-71).

## Alternatives Considered

- **An Add button and a pencil on every section** — rejected as "stupidly redundant" (Q-46).
- **An Add button on Current Location on the Profile** — rejected; the Add/Edit forms answer was not to be extended to the Profile (Q-46).
- **Wire Hide, or remove the hidden flag** — not chosen: fix Pin, take the dead Hide action off, and leave hiding for later (Q-47); D-134 then hid every Hide control without deleting data.
- **Keep the three-item Pinned cap / Pinned-only placement** — reversed by D-112 and D-133 (the Phase-31 exclusion).

## Consequences

### Positive

- Each section's action matches how often it changes; nothing on the Profile routes to the retired editor screen.

### Negative

- While the switch is off, previously hidden memories and key people show everywhere: on the Profile, in search, as Orrery satellites (ADR-105's "stops appearing when hidden" is paused, not removed) and in Message Focus (ADR-214, D-142).

### Risks

- Flipping `HIDE_FROM_PROFILE_ENABLED` back on restores the old rule on every display surface at once; the kept code paths must be re-checked then.

## Implementation

**Key files:**
- `src/profile/knowledge-presentation.ts` — `headingActionFor`, `childHasEntries`, entry links, pin markers.
- `src/profile/module-registry.ts` — `thought-of-them` and `gift-ideas` modules in D-44 order.
- `src/profile/resolve-presentation.ts` — read-time completion of missing sections.
- `src/db/profile-knowledge-read.ts` — the new collections, uncapped Pinned, newest-first sections.
- `src/components/profile/ThingsToRemember.tsx` — heading and empty actions, entry sheet, pushpins.
- `src/screens/ContactProfileScreen.tsx` — Pin/Unpin and routing of the actions.
- `src/screens/contact-profile-logic.ts` — destinations per affordance.
- `src/db/memory-registry.ts` — `HIDE_FROM_PROFILE_ENABLED`.
- `src/db/memories-read.ts` — `resolveVisibility` short-circuits to show.
- `src/db/relationships-read.ts` — `resolveRelationshipVisibility` short-circuits to show.

**Depends on:** ADR-150 (Semantic Profile Hierarchy and Source-Owned Knowledge Editing); ADR-110 (Coherent Local Profile Snapshot and Source-Owned Knowledge Projection); ADR-207 (Knowledge Homes After Fuel)
**Required by:** None
