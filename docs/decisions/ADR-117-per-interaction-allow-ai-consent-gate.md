# ADR-117: Per-Interaction Allow-AI Consent Gate, Default-Off and Fail-Closed on Restore

**Status:** Accepted
**Date:** 2026-09-02
**Phase:** 32-interaction-history-insights
**Source decisions:** D-04 (32-CONTEXT.md) from dossier E-05, §V, §W
**Reversibility:** one-way
**Migration:** 025
**Supersedes:** None
**Superseded by:** None

## Context

Before this phase no per-interaction AI-permission existed, and AI context read only `channel, quality, connected` from an interaction — never the note (`ai-context-read.ts`). History & Insights makes interaction notes prominent and correctable, so a note could plausibly become AI input; widening what the AI feature transmits is an owner decision (owner resolution E-05, 2026-09-01). A consent gate had to exist and be provably fail-closed before any note can ever be transmitted.

## Decision

Migration 025 adds `interactions.allow_ai` as `INTEGER NOT NULL DEFAULT 0 CHECK(allow_ai IN (0,1))` — a durable per-interaction consent flag defaulting **OFF**. Consent is per child interaction and participant-editable; there is no event-level Allow-AI value and no inheritance, and a Phase-12 Group Note is never transmitted regardless of any participant's flag (ADR-078). Phase 32 consumes the flag in two places only: Interaction Detail shows a restrained "shared with AI" sparkle strictly when `allow_ai === 1` (nothing when OFF), and the Edit Interaction route can flip it (so a note allowed in error can be withdrawn, or a withheld note later permitted). Restore is fail-closed on **both** write paths — a fresh insert takes the column `DEFAULT 0`, and the merge/update arm explicitly sets `allow_ai = 0` — so no restored backup can leave an interaction silently AI-permissive. Note transmission itself remains out of scope here (owned by a later AI phase); this ADR builds only the gate.

## Alternatives Considered

- **Default the toggle ON** — Rejected; it silently widens AI egress and reverses the owner resolution (a stop-and-ask trip-wire).
- **An event-level or inherited Allow-AI value** — Rejected; consent is per note, so each child interaction carries its own state with no inheritance.
- **Rely on the column `DEFAULT 0` alone for restore** — Rejected; SQLite's `DEFAULT` fires only on fresh INSERT, so a field-less backup row winning `ON CONFLICT` reconciliation would keep an existing `allow_ai=1`, hence the explicit `allow_ai=0` in the merge arm.
- **Transmit notes now behind the flag** — Rejected; transmission is a separate later decision, and building only the gate keeps this phase's egress surface unchanged.

## Consequences

### Positive

- A durable, default-off, fail-closed consent gate exists before any interaction note can reach AI.
- The flag is editable, so consent is fully reversible per interaction.

### Negative

- The gate is inert until a later phase wires note transmission; the sparkle is its only visible effect in Phase 32.

### Risks

- A future serializer that emits `allow_ai` must preserve the two-path fail-closed guarantee, or restore could re-open AI permission; the restore tests pin both paths.

## Implementation

**Key files:**
- `src/db/migrations/025-interaction-history-schema.ts` — adds `allow_ai NOT NULL DEFAULT 0 CHECK(0,1)`.
- `src/db/recency-dao.ts` — writes `allow_ai` through the sole recency writer.
- `src/db/ai-context-read.ts` — still never selects `note`; the gate must exist before that can change.
- `src/backup/restore-apply.ts` — forces `allow_ai=0` on the `ON CONFLICT(uid) DO UPDATE` arm; fresh insert relies on `DEFAULT 0`.
- `src/db/interaction-edit-read.ts` — reads `allow_ai` to seed the edit form.
- `src/screens/edit-interaction-logic.ts` — carries `allow_ai` into the `editTouchpointFull` input.
- `src/components/history/interaction-detail-logic.ts` — `showSparkle` is strictly `allow_ai === 1`.
- `src/components/history/InteractionDetail.tsx` — renders the restrained sparkle only when ON.
- `src/components/TouchpointRefineForm.tsx` — the OFF-by-default Allow-AI toggle at log time.

**Depends on:** ADR-078 (Negative-Constraint Off-Limits and Gated Recent-Interaction AI Context); ADR-050 (Closed AI Prompt Egress Allowlist and Opt-In Field Sharing); ADR-010 (Single-Writer Interaction Recency Spine)
**Required by:** None
