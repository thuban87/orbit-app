# ADR-150: Semantic Profile Hierarchy and Source-Owned Knowledge Editing

**Status:** Accepted
**Date:** 2026-09-19
**Phase:** 38.1-profile-presentation-polish
**Source decisions:** dossier §D–H; D-06, D-07 from phase CONTEXT.md
**Reversibility:** reversible
**Migration:** None
**Supersedes:** None
**Superseded by:** None

## Context

Profile headings duplicated nested labels and inferred state, including a false empty caption for saved knowledge. Some heading-level edit paths either led to a generic destination or did not expose a functional editor, while temporal knowledge had history data but did not present it on Profile.

## Decision

Profile headings identify sections only; semantic module bodies own values, empty states, and distinct subsections. Temporal knowledge projects one Most Recent item plus at most five non-current Previous items, with full history retained in its dedicated destination. Heading actions route to existing source-owned editors; Off Limits uses a scoped `FuelEditor` wrapper that filters reads, forces `off_limits` on writes, validates scoped deletes, and refreshes controlled items. Unbind moves from the body to the confirmed Profile overflow action without changing lifecycle semantics.

## Alternatives Considered

- **Make heading empty-state inference smarter** — Rejected because headings must not own content state.
- **Build a dedicated Off Limits editor model** — Rejected because the existing fuel model and editor already support the collection.
- **Retain body-level Manage actions** — Rejected in favor of a contextual heading action and separate view/edit behavior.

## Consequences

### Positive

- Profile preserves one semantic heading per section and makes existing knowledge editable without a schema or backup change.

### Negative

- New collection editors must preserve their source-owned data constraints at their write boundary.

### Risks

- A scoped editor must not expose or mutate a different fuel kind; the controller's mixed-kind test is the guard.

## Implementation

**Key files:**
- `src/components/profile/ProfileModuleHost.tsx` — owns identifier-only headings and heading actions.
- `src/components/profile/ThingsToRemember.tsx` — renders body-owned knowledge summaries and temporal sections.
- `src/db/profile-knowledge-read.ts` — reads bounded previous temporal values from the existing model.
- `src/profile/knowledge-presentation.ts` — classifies source-owned knowledge for Profile rendering.
- `src/screens/ContactProfileScreen.tsx` — dispatches Profile edit and overflow intents.
- `src/screens/OffLimitsEditorScreen.tsx` — hosts the scoped existing fuel editor.
- `src/screens/off-limits-editor-controller.ts` — enforces scoped fuel writes and reloads.
- `src/navigation/types.ts` — types Profile-origin editor routes.

**Depends on:** ADR-109 (Fixed-Hero Semantic Profile Composition and Focused Accessible Editors); ADR-110 (Coherent Local Profile Snapshot and Source-Owned Knowledge Projection); ADR-123 (Profile History Section Replacing the Vertical Timeline)
**Required by:** None
