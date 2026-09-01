# ADR-073: Merge-Reparented, Purge-Cascaded Interaction Assists

**Status:** Accepted
**Date:** 2026-08-31
**Phase:** 21-interaction-assist-reach-out
**Source decisions:** dossier `21-interaction-assist-reach-out` clusters AA, AB (data-layer half)
**Reversibility:** one-way
**Migration:** 014
**Supersedes:** None
**Superseded by:** None

## Context

A contact can be merged or purged while an assist is still pending. Phase 20's merge writes no survivor pointer — it reparents child tables to the survivor, tombstones only the absorbed uid, then hard-deletes the absorbed `contacts` row — and merge and purge write identical `{contact, uid}` tombstones, so a stale `contact_id` cannot be resolved to a survivor after the fact and "merged" cannot be told from "purged" by tombstone alone. A merged target's confirmed interaction must land on the survivor; a purged identity must never be resurrected or gain an orphan interaction.

## Decision

The `interaction_assists` table joins Phase 20's existing merge reparent loop, so a pending assist is moved to the survivor **inside** the merge transaction and later confirmation logs against the survivor with no lazy survivor lookup. On purge, the assist is removed with the identity via the migration-014 `contact_id ... ON DELETE CASCADE`, so a purged target's assist can never resolve. Handling both at deletion time — reparent on merge, cascade on purge — sidesteps the merge-vs-purge tombstone ambiguity entirely rather than detecting it at confirmation.

## Alternatives Considered

- **Lazy survivor lookup at confirmation time** — rejected because no survivor pointer exists in the schema and merge/purge tombstones are indistinguishable.
- **`ON DELETE CASCADE` for merge too** — rejected because it would delete the assist and defeat the redirect-to-survivor requirement.
- **Add `interaction_assists` to purge's explicit fan-out** — considered; assists are device-local, transient, and excluded from the portable/merge schema, so the FK cascade is accepted as a documented exception to purge's "explicit fan-out, not FK cascade" principle.

## Consequences

### Positive

- Merge redirect and purge removal are both settled at deletion time inside the owning transaction; confirmation stays a simple in-transaction re-read.

### Negative

- Purge removes assists by FK cascade rather than the explicit, auditable fan-out the rest of purge uses, so the exception must stay documented.

### Risks

- Any future assist-adjacent child table must be added to the merge reparent loop too, or a merge would strand it; the reparent is not automatic.

## Implementation

**Key files:**
- `src/db/merge-dao.ts` — reparents pending `interaction_assists` to the survivor before deleting the absorbed contact.
- `src/db/purge-dao.ts` — relies on the migration-014 FK cascade to remove a purged contact's assists (documented exception to the explicit fan-out).
- `src/db/migrations/014-interaction-assists.ts` — declares `contact_id ... REFERENCES contacts(id) ON DELETE CASCADE` that backs the purge path.

**Depends on:** ADR-069 (Atomic Tombstone-Backed Orbit Contact Merge); ADR-068 (User-Triggered, Source-Only Reconciliation with Durable Review); ADR-018 (Archive-Gated Contact Purge with Explicit Fan-Out)
**Required by:** None
