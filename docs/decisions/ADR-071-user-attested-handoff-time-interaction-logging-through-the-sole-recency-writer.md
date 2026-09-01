# ADR-071: User-Attested Handoff-Time Interaction Logging Through the Sole Recency Writer

**Status:** Accepted
**Date:** 2026-08-31
**Phase:** 21-interaction-assist-reach-out
**Source decisions:** dossier `21-interaction-assist-reach-out` clusters F, J, K, R, S, T, U, AJ
**Reversibility:** one-way
**Migration:** 014
**Supersedes:** None
**Superseded by:** None

## Context

Interaction Assist must turn a confirmed reach-out into permanent relationship history without inventing a second recency writer or a bespoke `last_contact` update — the single-writer recency spine (ADR-010) is the whole correctness story for status, gravity, and rarely-responds. Orbit cannot observe what happened inside the native app (`expo-sms` returns `unknown`; `tel:`/`mailto:` only report that some app could handle them), so "did you reach them?" can only be user attestation, not delivery verification. A concurrent merge (reparent) or purge (cascade) could also retire the target between handoff and confirmation.

## Decision

Confirmation writes exactly **one outbound interaction** through the authoritative `insertInteractionCore` + `recomputeLastContactCore` path, stamped with the assist's original `handoff_at` time (not the later confirmation time), never a direct `last_contact` write. The whole write re-reads the assist row **inside** the shared-mutex transaction and re-checks `status='pending'`, so a double-confirm is idempotent and a concurrent merge/purge cannot leave a stale FK. Call confirmation offers Yes / No answer / Don't log (No answer still writes a row with `connected=0`); Text/Email offer Yes / Don't log as pure attestation; an optional Notes expander (default closed) rides on any confirmation that writes an interaction. "Failed handoff" means only that the native launch threw — it writes no interaction.

## Alternatives Considered

- **Write `last_contact` (or the interaction) directly at handoff/confirm time** — rejected because it would fork the single-writer recency spine and desync status/gravity.
- **Stamp the interaction at confirmation time** — rejected because the contact happened at handoff; 2:00 PM call confirmed at 2:18 PM must read ~2:00 PM.
- **Claim delivered/sent/read** — rejected; Orbit cannot observe native outcomes, so confirmation is attestation only.
- **Resolve a stale contact id lazily at confirmation** — rejected because no survivor pointer exists in the schema; the in-transaction re-read avoids the TOCTOU entirely.

## Consequences

### Positive

- Assist logging inherits every existing interaction-derived calculation for free and can never corrupt recency.

### Negative

- Orbit's history is intentionally coarse (channel only, no endpoint/provider) and reflects user attestation, not verified delivery.

### Risks

- A device clock rolled backward so `handoff_at > now` trips the pre-transaction future-date guard (LOG-06); handlers must surface rather than swallow that rejection.

## Implementation

**Key files:**
- `src/db/interaction-assist-dao.ts` — `markAssistLogged` re-reads the row in-transaction, inserts one outbound interaction at `handoff_at`, recomputes recency, and flips the assist to `logged`.
- `src/components/AssistConfirmation.tsx` — the attestation controls (Yes / No answer / Don't log) and the optional Notes expander.
- `src/db/data-revision-dao.ts` — supplies the composable `insertInteractionCore`, `recomputeLastContactCore`, and `bumpDataRevisionCore` cores the assist writer runs in one transaction.

**Depends on:** ADR-010 (Single-Writer Interaction Recency Spine); ADR-024 (Editable Touchpoint History and Recomputed Recency)
**Required by:** None
