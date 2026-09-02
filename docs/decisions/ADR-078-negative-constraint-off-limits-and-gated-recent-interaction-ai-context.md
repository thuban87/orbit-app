# ADR-078: Negative-Constraint Off Limits and Gated Recent-Interaction AI Context

**Status:** Accepted
**Date:** 2026-09-01
**Phase:** milestone-2 pre-build audit (oa-audit-dossiers)
**Source decisions:** dossier `phase-03-contact-knowledge-foundation` §M, §N; `phase-14-messaging-ai-compose` §M, §N, §O; `phase-16-ai-configuration-prompting` §W, §X, §Y, §Z, §AB; `phase-12-group-interaction-logging` §H; `phase-13-rapid-capture-update-flows` §N; `phase-11-interaction-history-insights` §V, §W (amended 2026-09-01); owner ratification 2026-09-01
**Reversibility:** costly
**Migration:** None in this ADR; a future migration adds the per-interaction Allow-AI column, numbered at plan time.
**Supersedes:** ADR-050 (partial — Off Limits and permitted interaction notes); ADR-036 (partial — Off Limits visible on the Research side)
**Superseded by:** None

## Context

ADR-050 closed AI egress to an allowlist that explicitly excluded off-limits fuel and all interaction prose, and ADR-036 kept `off_limits` material off the Compose surface entirely. The milestone-2 dossiers instead treat Off Limits as a conversational meaning the model must honour and treat recent interactions as near-term continuity the draft needs, which the closed allowlist cannot express (audit findings E-05 and the Phase 3 §N / Phase 16 §Y conflict). The owner ratified the widened egress and the gate that bounds it on 2026-09-01.

## Decision

AI-enabled Off Limits items are transmitted as negative "avoid this topic" constraints, included reliably rather than dropped by positive relevance ranking, and never as positive context; an AI-disabled Off Limits item is never sent, even to enforce its own avoidance. AI context also carries a compact projection of the contact's three most recent interactions — date/time, channel, and Tone where present — and an interaction's note is included only when that interaction's per-interaction Allow AI toggle is ON; the toggle defaults OFF and its new-items-only type default is managed in the Phase 16 permission manager. Group Notes, the Phase 12 event-level shared record, are never transmitted to AI under any participant's Allow AI value. Off Limits items are visible to the human on the Compose Research side as a differentiated "Avoid" group and can never be selected as Message Focus.

## Alternatives Considered

- **Keep ADR-050's exclusion of all off-limits material** — Rejected because a model that cannot see the avoid-topics cannot avoid them, and the Phase 3 §N semantics are a product commitment.
- **Send AI-disabled Off Limits items purely so the model can enforce avoidance** — Rejected because it would secretly transmit information the user declined to share.
- **Transmit interaction notes as ordinary permitted prose** — Rejected because free-text notes need their own explicit per-item consent, not a blanket type permission.
- **Duplicate the Group Note into each participant's transmitted context** — Rejected because a shared event record is other participants' data and is never AI-eligible.
- **Allow an Off Limits item as Message Focus** — Rejected because centring a message on an avoid-topic contradicts the item's meaning.
- **Ask the user to authorize the whole payload on every Draft or Rewrite** — Rejected because permission management belongs to the contact surfaces and the Phase 16 permission manager, not to repeated Compose dialogs.

## Consequences

### Positive

- The prompt can state what to avoid, so an off-limits topic stops being invisible to the model that would otherwise raise it.
- Drafts gain near-term conversational continuity without the prompt turning into full history analytics.
- Every widened class of outbound data keeps an explicit user-controlled gate: item permission for Off Limits, per-interaction Allow AI for notes, and an absolute ban for Group Notes.

### Negative

- The closed `PromptContext` contract grows two new shapes — a negative-constraint section and a bounded interaction projection — each of which must be inspectable.
- Interaction notes need durable per-row permission state that must survive save, remain editable, and be carried by backup/restore.

### Risks

- A default-ON or type-default-retroactive implementation of Allow AI would open existing notes the user never allowed; the default is OFF and type-default changes affect new items only.
- Rendering off-limits text into the positive context section instead of the constraint section would transmit an avoid-topic as conversation fuel — the inverse of the decision.
- Contact-derived values remain untrusted; the constraint section is as injectable as the positive one and stays delimited and bounded.

## Implementation

**Key files:**
- `src/db/ai-context-read.ts` — projects permitted context, the negative Off Limits constraints, and the latest-three interaction projection.
- `src/db/fuel-read.ts` — supplies the ranked eligible items and must keep off-limits rows out of the positive selection.
- `src/ai/prompt-types.ts` — extends the closed outbound contract with the avoidance-constraint and recent-interaction shapes.
- `src/ai/prompt-template.ts` — renders avoidance constraints as negative instructions distinct from positive context.
- `src/screens/ComposeScreen.tsx` — shows Off Limits as the Research-side `Avoid` group and withholds `Add to AI` from those rows.

**Depends on:** ADR-049 (BYO-Key AI Configuration and Credential Boundary); ADR-029 (In-Query Fuel Eligibility and a Shared Ranked Projection)
**Required by:** _None._
