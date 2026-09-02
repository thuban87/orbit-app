# ADR-079: On-Demand AI Transparency and Compose-Only Three-Suggestion Invocation

**Status:** Accepted
**Date:** 2026-09-01
**Phase:** milestone-2 pre-build audit (oa-audit-dossiers)
**Source decisions:** dossier `phase-16-ai-configuration-prompting` §AE, §AF, §AG; `phase-14-messaging-ai-compose` §P, §Q, §R; `phase-10-profile-experience` §C; owner ratification 2026-09-01
**Reversibility:** reversible
**Migration:** None
**Supersedes:** ADR-052 (partial — acknowledgement and Profile entry)
**Superseded by:** None

## Context

ADR-052 made the user acknowledge the exact resolved prompt on first send and gave the Profile a direct AI-draft entry, explicitly rejecting Compose-only invocation. The milestone-2 dossiers instead specify a lightweight first-setup disclosure with review available on demand, a Profile hero limited to Message and Call, and a three-suggestion comparison surface rather than a single draft dropped into the editor (audit finding E-06). The owner ratified all three on 2026-09-01.

## Decision

First successful AI setup shows a lightweight disclosure naming the active connection's real data path — OpenRouter plus the selected underlying model provider, the selected direct provider, or the configured custom endpoint — instead of a durable exact-prompt first-send acknowledgement. Full inspection stays available on demand: Settings exposes "Preview What Orbit Sends" over the whole prompt system, optionally resolved for a contact chosen through the canonical picker, while Compose exposes a per-generation contact-specific review reading "Sharing N items with AI about <contact>". The Profile no longer offers a direct AI-draft entry; AI is reached via Message → Compose → "Draft with AI" or "Rewrite with AI", reversing ADR-052's rejection of Compose-only invocation. A normal request returns three suggestions on a comparison surface that leaves the editor untouched until the user chooses one.

## Alternatives Considered

- **Keep ADR-052's durable exact-prompt first-send acknowledgement** — Rejected because a mandatory full-prompt audit at first send is heavier than the transparency it buys, and on-demand review answers the same question better.
- **Keep the Profile AI-draft entry** — Rejected by the owner: Message → Draft with AI is two taps and keeps one AI invocation path.
- **One prompt inspector serving both Settings and Compose** — Rejected because the two surfaces answer different questions and merging them yields a giant prompt dump everywhere.
- **Return one suggestion and overwrite the editor** — Rejected because it destroys the user's existing text and forces a second request to see any alternative.
- **Require a separate "give me options" request for alternatives** — Rejected because three alternatives are the standard contract, not an upsell.

## Consequences

### Positive

- Setup stays light while transparency deepens: the user can inspect the global prompt system, a contact-resolved example, or the exact per-generation contact payload whenever they want.
- One invocation path means Compose owns generation, review, and the editable draft, with no competing Profile result surface.
- The original editor contents survive every generation, so Rewrite always keeps a path back to the original text.

### Negative

- Three transparency surfaces must be built and kept truthful against the resolved prompt instead of one acknowledgement dialog.
- Users who browsed the Profile expecting a one-tap AI draft gain an extra tap.

### Risks

- A review surface that drifts from the bytes actually sent is worse than none; both inspectors must resolve from the same prompt construction, and neither may ever display credentials.
- Retiring the acknowledgement leaves the `ai_ack_*` settings columns without a writer; a partially removed acknowledgement path could gate generation on a value nothing sets.

## Implementation

**Key files:**
- `src/logic/ai-suggestion-logic.ts` — keeps cancellation, timeout, and stale-result protection; returns three suggestions and drops the acknowledgement gate.
- `src/screens/ComposeScreen.tsx` — hosts adaptive Draft/Rewrite invocation, the contact-specific review, and the three-suggestion comparison surface.
- `src/screens/ContactProfileScreen.tsx` — loses the direct AI-draft entry; Message is the route to AI.
- `src/navigation/ai-suggestion-navigation.ts` — the profile-originated consume-once AI request intent it carries is retired.
- `src/db/app-settings-dao.ts` — its `ai_ack_*` acknowledgement columns become unused; removal is a plan-phase choice.

**Depends on:** ADR-078 (Negative-Constraint Off Limits and Gated Recent-Interaction AI Context); ADR-049 (BYO-Key AI Configuration and Credential Boundary)
**Required by:** _None._
