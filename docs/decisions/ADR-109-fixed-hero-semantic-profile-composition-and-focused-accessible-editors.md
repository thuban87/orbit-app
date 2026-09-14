# ADR-109: Fixed-Hero Semantic Profile Composition and Focused Accessible Editors

**Status:** Accepted
**Date:** 2026-09-02
**Phase:** 31-profile-experience
**Source decisions:** dossier `phase-10-profile-experience-dossier.md` §§A–C, E, G, J–N, U–AN; 31-CONTEXT.md D-04, D-08, D-11, D-12; 31-05 through 31-08 and 31-10 through 31-14 summaries; 31-UAT.md
**Reversibility:** reversible
**Migration:** None
**Supersedes:** None
**Superseded by:** None

## Context

Profile must be richer than a database form without becoming an unrestricted page builder or duplicating every workflow it can launch. Its structure also has to remain stable for accessibility, large text, missing contact methods, and the later replacement of Interaction History internals.

## Decision

Profile uses a fixed-structure, normally scrolling Hero followed by a closed semantic body. The Hero always owns identity, Favorite, Message, Call, and one overflow; unavailable direct actions remain visible with an explanation. The body supports only top-level modules and one owned child level, constrained variants, deterministic packing, and semantic IDs rather than component names. Interaction History keeps a stable module identity while its Phase 31 renderer remains intentionally bounded.

Layout and template editing runs in focused Profile-owned overlay sheets. Editors keep a complete in-memory draft until explicit Save, guard meaningful dismissal, provide live preview, and route drag plus named Move actions through the same legal-order reducer. The underlay becomes interaction- and accessibility-inert while a topmost sheet is open. Knowledge cards remain compact, source-owned views; Off Limits is visible as local caution content with no inferred AI permission or sparkle. The separate Profile AI-draft entry is absent under ADR-079.

## Alternatives Considered

- **Make the Hero a movable layout module** — Rejected because identity and direct-action geometry must remain predictable.
- **Offer arbitrary coordinates or deeper nesting** — Rejected because Profile is a constrained semantic document, not a page builder.
- **Persist every drag or switch immediately** — Rejected because partial edits need atomic Save/Cancel behavior.
- **Require precise drag as the only reorder control** — Rejected because accessible named movement must be equivalent.
- **Hide unavailable Message or Call actions** — Rejected because doing so shifts the Hero and obscures why an action is unavailable.
- **Build the final History experience in this phase** — Rejected to preserve the Phase 32 replacement seam.
- **Keep a direct Profile AI-draft action** — Rejected by ADR-079; Compose is the sole suggestion invocation surface.

## Consequences

### Positive

- Persisted layouts survive renderer refactors and the later History upgrade.
- Users can customize substantial Profile structure without creating invalid hierarchy or inaccessible drag-only state.
- Empty, malformed, hidden, and unavailable content remains truthful and recoverable.

### Negative

- Every new Profile module must join the closed registry and declare its legal parent and variants.
- Focused sheet workflows need explicit dirty, pending, Back, and accessibility behavior.

### Risks

- Shared sheet geometry can clip footer actions under large text; expanded behavior must remain additive for existing consumers.
- Gesture state that is not published at terminal release can save a stale order or crop.
- A renderer that infers AI permission from visibility, kind, or provenance can silently widen meaning or egress.

## Implementation

**Key files:**
- `src/screens/ContactProfileScreen.tsx` — owns the fixed Hero, semantic host, overflow, overlays, and origin-aware Back behavior.
- `src/profile/module-registry.ts` — defines closed module identities, hierarchy, factory order, and supported variants.
- `src/components/profile/ProfileHero.tsx` — renders stable identity and separately derived Message and Call capability.
- `src/components/profile/ProfileModuleHost.tsx` — renders the resolved semantic body and durable collapse interaction.
- `src/profile/layout-editor-reducer.ts` — applies legal drag and accessible movement through one reducer.
- `src/profile/layout-editor-session.ts` — owns draft, dirty, save, cancel, and failure-retention state.
- `src/components/profile/ProfileLayoutEditor.tsx` — presents the focused layout workflow and live preview.
- `src/components/profile/ProfileTemplateManager.tsx` — manages reusable layout templates and assignments.
- `src/components/ui/Sheet.tsx` — supplies additive expanded, scrollable, modal-accessible overlay behavior.
- `src/navigation/types.ts` — preserves typed Profile origins without carrying presentation drafts.

**Depends on:** ADR-079 (On-Demand AI Transparency and Compose-Only Three-Suggestion Invocation); ADR-086 (Semantic Icons and Accessible Interaction Primitives); ADR-088 (Additive Contact-Knowledge Schema and Application-Owned Memory Registry)
**Required by:** None
