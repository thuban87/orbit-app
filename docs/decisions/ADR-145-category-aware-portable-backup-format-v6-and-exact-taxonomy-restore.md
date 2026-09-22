# ADR-145: Category-Aware Portable Backup Format v6 and Exact Taxonomy Restore

**Status:** Accepted
**Date:** 2026-09-15
**Phase:** 37.1-category-management
**Source decisions:** dossier `phase-37.1-category-management-dossier.md` §O; `37.1-REVIEWS.md` owner ruling 2026-09-16; `37.1-03-SUMMARY.md`
**Reversibility:** costly
**Migration:** None
**Supersedes:** ADR-063 (partial)
**Superseded by:** ADR-148 (partial)

## Context

Backup v5 carried category rows and relationships but could not represent a category deletion through its closed tombstone vocabulary. A same-version wire-shape change would violate the established explicit-forward-migration contract, while merge and Replace-all must preserve a deliberately empty taxonomy without reseeding defaults.

## Decision

The system uses portable backup format v6 with category tombstones and a minimal v5-to-v6 relabel step. Merge applies a winning category tombstone through the runtime category fallout core with NULL reassignment only, and Replace-all restores exactly the incoming ordered category taxonomy, including zero rows, while preventing stale tombstones or older dependents from resurrecting deleted intent.

## Alternatives Considered

- **Add category tombstones to format v5** — rejected because a portable wire-shape change requires an explicit forward version migration.
- **Retain a broad v5 compatibility harness or synthesize deletion evidence** — rejected by owner ruling because no v5 backups exist in the wild and the change is intentionally minimal.
- **Merge factory seed rows back into restored taxonomies** — rejected because backups represent the user's actual taxonomy, including zero categories.
- **Raw category deletion during restore** — rejected because it can strand FK and ref-token dependents outside the canonical fallout contract.

## Consequences

### Positive

- Portable restores preserve deliberate category deletion and cannot silently resurrect older category rules or references.
- Replace-all reproduces the selected taxonomy rather than factory defaults.

### Negative

- The backup version chain and schema validation must remain forward-compatible through v6.

### Risks

- An incorrect survivor/tombstone repair order could delete live state or retain stale deletion evidence.

## Implementation

**Key files:**
- `src/backup/types.ts` — declares backup format v6.
- `src/backup/backup-schema.ts` — validates category tombstones and advances prior manifests through the minimal relabel.
- `src/backup/export-manifest.ts` — exports current category identity and deletion evidence.
- `src/backup/reconciliation.ts` — resolves category tombstone survival and suppresses only proven obsolete dependents.
- `src/backup/restore-apply.ts` — applies merge and exact Replace-all category restoration through ordered transactional work.
- `src/db/categories-dao.ts` — supplies the transaction-composable category fallout core reused by restore.

**Depends on:** ADR-057 (Full-State Versioned Backups with Verified Manual and Foreground SAF Snapshots); ADR-063 (Versioned Lifecycle Backup and Dormant-Cadence Restore); ADR-143 (Lock-Time-Revalidated Atomic Category Deletion and System Fallout)
**Required by:** ADR-148 (Portable Your Week Period and Group-Deduplicated Activity Aggregation).
