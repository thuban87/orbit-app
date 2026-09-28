# ADR-159: Commit-Current Restore with Deterministic Pair Completion and No Legacy Repair

**Status:** Accepted
**Date:** 2026-09-23
**Phase:** 38.2-audit-remediation-data-security-lifecycle
**Source decisions:** dossier Workstream B; 38.2-CONTEXT D-10, D-21, and D-23; RG-009, RG-010, and RG-011
**Reversibility:** costly
**Migration:** None
**Supersedes:** None
**Superseded by:** None

## Context

Restore previously planned against destination state read before media staging, so newer local writes could be overwritten and tombstone-only changes could disappear. Merge could also leave the normalized global custom-field pair matrix incomplete, while pre-release-only damage did not justify a repair migration for the owner's test installs.

## Decision

The system stages incoming media first, then reads destination authority, plans conflicts, and applies the restore inside one serialized write transaction. Merge completes missing global custom-field pairs with deterministic UIDs derived from contact and definition UIDs, preserves existing values, persists tombstone-only evidence, and keeps the format-7 completeness guard. No migration or sweep repairs state written only by pre-38.2 builds; affected test installs are reset or re-seeded.

## Alternatives Considered

- **Plan from a pre-staging destination snapshot** — rejected because writes committed during staging could be lost or resurrected.
- **Seed pair UIDs randomly** — rejected because independent device repairs could collide during later UID reconciliation.
- **Ship migration 031 and legacy alias repair** — initially planned, then rejected by owner decision D-23 because Orbit had no shipped users.
- **Bump the backup format** — rejected because format 7 already carries the UIDs needed to resolve targets safely.

## Consequences

### Positive

- Restore applies over the state it actually commits against and preserves deletion evidence even without a live-row change.
- Merge results remain exportable and restorable without weakening normalized-pair completeness.

### Negative

- Restore planning and writes remain coupled inside a long, serialized transaction after media staging.

### Risks

- State produced by pre-38.2 test builds is intentionally not repaired and must not be mistaken for supported production history.

## Implementation

**Key files:**
- `src/backup/restore-apply.ts` — stages media, plans and applies under the write lock, persists tombstones, and completes global pairs.
- `src/backup/reconciliation.ts` — validates destination identity collisions and computes restore outcomes.
- `src/db/pair-matrix.ts` — derives deterministic pair identities and inserts only missing NULL pairs.
- `src/services/backup/restore-completion.ts` — publishes committed appearance and reports incomplete recovery honestly.
- `src/services/photos/background-reconcile-sweep.ts` — protects in-flight staging and rechecks committed references before cleanup.

**Depends on:** ADR-001 (Normalized Custom-Field Values); ADR-056 (Tombstone-Backed UID Reconciliation for Portable Restores); ADR-058 (Optional Encrypted Backups and Previewed Local Restoration); ADR-158 (Canonical Photo Ownership Across Masters, Staging, and Derivatives)
**Required by:** None
