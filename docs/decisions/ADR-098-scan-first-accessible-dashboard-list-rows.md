# ADR-098: Scan-First, Accessible Dashboard List Rows

**Status:** Accepted
**Date:** 2026-09-02
**Phase:** 27-dashboard-list-view
**Source decisions:** dossier `phase-06-dashboard-list-view` §§A–N, Q–T; 27-CONTEXT D-04, D-06–D-11
**Reversibility:** reversible
**Migration:** None
**Supersedes:** None
**Superseded by:** None

## Context

Dashboard state and controls already define one local, scoped result universe, but the List renderer needed a dense working surface without reimplementing query semantics. It also needed relationship state and row actions to remain understandable without colour, while sparse contacts still need useful, stable context.

## Decision

The system uses full-width, scan-first three-line Dashboard List rows over the shared Dashboard projection. Rows show identity, local-calendar recency and category, then deterministic visible contact knowledge or a stable completeness prompt; they use a same-weight status border plus a non-interactive status glyph, with a neutral glyph-less state for unevaluated contacts and a neutral snooze override. The always-visible star is binary Favourite membership, not an ordering control.

## Alternatives Considered

- **Mini-profile List rows** — expose richer metadata in the working list. Rejected because List must remain meaningfully denser than Card and Profile.
- **Colour-only relationship status** — reduce row decoration. Rejected because status must remain accessible without colour.
- **Random or AI-generated sparse-contact copy** — vary the third line. Rejected because prompts must stay stable and this phase introduces no AI-generated row prose.
- **Status changes that mutate domain state while snoozed** — hide overdue state in storage. Rejected because snooze is a renderer-level presentation override.

## Consequences

### Positive

- One renderer consumes the shared local Dashboard universe without per-row database reads.
- Rows expose status, snooze, Favourite state, and gesture-equivalent actions through accessible text and controls.

### Negative

- The compact row has deliberate limits on metadata, density tuning, and status-icon artwork.

### Risks

- Malformed persisted timestamps must fail closed at the presentation boundary rather than throw during row rendering.
- Knowledge candidates must remain visible-surface safe and bounded before selection.

## Implementation

**Key files:**
- `src/components/ListRow.tsx` — renders the tokenized three-line row, status treatment, star, and accessible actions.
- `src/components/list-row-content.ts` — formats recency, status narration, and compact search explanations safely.
- `src/components/icons/status-display-label.ts` — supplies the single colour-free status label source.
- `src/db/dashboard-read.ts` — projects row recency and snooze inputs from the shared Dashboard query.
- `src/db/dashboard-knowledge-read.ts` — batches bounded, registry-safe line-three candidates.
- `src/logic/list-row-selection.ts` — selects deterministic knowledge or completeness-prompt content.
- `src/screens/HomeScreen.tsx` — loads and passes row content without giving the renderer a database read path.

**Depends on:** ADR-075 (Binary Favourite Membership Without a User-Facing Order); ADR-093 (Scoped Composable Dashboard Population and Filter Model); ADR-094 (Eligibility-Scoped Semantic Dashboard Search)
**Required by:** None
