# ADR-063: Versioned Lifecycle Backup and Dormant-Cadence Restore

**Status:** Accepted
**Date:** 2026-08-27
**Phase:** 18.2-bound-unbound-lifecycle
**Source decisions:** dossier `18-contact-data-normalization` cluster R; 18.2-CONTEXT.md locked backup and restore decisions; 18.2-09-SUMMARY.md
**Reversibility:** costly
**Migration:** None
**Supersedes:** ADR-060 (partial)
**Superseded by:** None

## Context

Backup format v2 preserved the normalized contact-method graph but could not represent Bound/Unbound state or a never-assigned cadence. A restore also cannot apply a valid newer Unbound row with NULL cadence over a local positive cadence, because the lifecycle schema deliberately forbids clearing an assigned cadence.

## Decision

The system uses backup format v3 to carry `trackingEnabled`, nullable `intervalDays`, and lifecycle settings. Portable migrations advance v1 and v2 inputs to v3; restore rejects self-contained invalid lifecycle cells before opening its write transaction and retains a local assigned cadence as dormant when a valid newer Unbound merge winner has NULL cadence.

## Alternatives Considered

- **Add lifecycle fields to format v2 without a version bump** — Rejected because a portable wire-shape change requires an explicit forward migration.
- **Reject every valid merge that would clear an assigned cadence** — Rejected because retaining the local positive cadence preserves the winner’s Unbound state without violating the one-way invariant.
- **Allow restore SQL to clear cadence** — Rejected because it would violate the durable lifecycle trigger and lose useful dormant configuration.

## Consequences

### Positive

- Full exports and restores preserve Bound/Unbound state losslessly across v1, v2, and v3 inputs.
- Invalid backup graphs fail before local mutation, while valid conflicts retain relationship information conservatively.

### Negative

- Backup compatibility must maintain the v2-to-v3 migration and pre-transaction merge-planning path.

### Risks

- A restore implementation that bypasses schema validation or merge planning could silently drop lifecycle state or trip the cadence trigger.

## Implementation

**Key files:**
- `src/backup/types.ts` — declares backup format v3 and lifecycle-bearing contact records.
- `src/backup/export-manifest.ts` — exports `tracking_enabled` and nullable cadence.
- `src/backup/backup-schema.ts` — migrates v1/v2 inputs forward and validates lifecycle cells.
- `src/backup/restore-apply.ts` — resolves dormant-cadence merge conflicts before transactional writes.
- `src/db/migrations/011-contact-lifecycle-schema.ts` — provides the durable cadence constraints restored rows must satisfy.

**Depends on:** ADR-057 (Full-State Versioned Backups with Verified Manual and Foreground SAF Snapshots); ADR-060 (Versioned Portable Method Graph and Collision-Normalized Restoration); ADR-062 (Bound/Unbound Lifecycle and One-Way Cadence Assignment)
**Required by:** None.
