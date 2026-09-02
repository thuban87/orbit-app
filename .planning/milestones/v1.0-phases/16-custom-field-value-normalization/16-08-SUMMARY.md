---
phase: 16-custom-field-value-normalization
plan: "08"
subsystem: documentation
tags: [adr, sqlite, migration-006, custom-fields]
requires:
  - phase: 16-01
    provides: migration 006 normalized value representation
  - phase: 16-07
    provides: automated and Pixel validation of the migration
provides:
  - ADR-001, the immutable decision record for normalized custom-field values.
  - Current custom-field invariants and a historical HANDOFF supersession note.
affects: [phase-17, future-custom-field-work]
requirements-completed: [CFN-01, CFN-02]
key-files:
  created:
    - docs/decisions/ADR-001-normalized-custom-field-values.md
  modified:
    - CLAUDE.md
    - HANDOFF.md
key-decisions:
  - The UNIQUE pair constraint guarantees at-most-one current row; complete-pair coverage is maintained by seeding and UPSERT self-heal, not a lower-bound SQLite constraint.
  - Orphan-column history is a bounded audit trace, not recovery or backup.
  - Graph/ADR registry generation remains deferred because the repository does not yet contain the required bridge tooling.
completed: 2026-08-24
status: complete
---

# Phase 16 Plan 08: Decision Documentation Summary

**The project documentation now records migration 006 as the authoritative normalized custom-field model without rewriting the historic v1 decision record.**

## Accomplishments

- Created immutable ADR-001 with the normalized row schema, per-value identity, pair UPSERT, timestamp provenance, fail-closed migration, and D-06a orphan snapshot-and-proceed behavior.
- Recorded the rejected dual-read/dual-write, JSON-value, and dynamic-DDL alternatives.
- Documented the critical non-obvious consequences: at-most-one versus completeness, the sole matrix-seeding contact creation path, bounded permanent-delete photo orphans, bounded `field_history`, and Phase 17's still-open backup/conflict decisions.
- Updated `CLAUDE.md` storage-model invariants to cite migration 006 / ADR-001 while retaining parser, transaction-snapshot, and launch-sweep requirements.
- Appended a dated Phase 16 supersession note to `HANDOFF.md` §14; its historical text remains intact.

## Verification

- ADR exists and contains the required Rejected Alternatives plus dual-read/dual-write wording.
- `CLAUDE.md` contains `ADR-001`, `migration 006`, and supersession language.
- `HANDOFF.md` contains the appended migration 006 / ADR-001 supersession note.
- `git diff --check` passed.

## Explicitly Deferred

The ADR registry and graph build were not generated. This repository has no
`adr-registry.ts`, graph normalizer, `gen:adr-registry`, or `graph:build` tooling;
porting that infrastructure is outside the migration phase. Migration 006 already
cites ADR-001 so the future bridge can create the edge once available.

---
*Phase: 16-custom-field-value-normalization*
*Completed: 2026-08-24*
