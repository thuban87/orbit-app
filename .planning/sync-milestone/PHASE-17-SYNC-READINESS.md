# Phase 17 — Sync-Readiness Decisions (v1.0)

**Status:** locked owner decisions, folded into `ROADMAP.md` and `REQUIREMENTS.md` on 2026-08-24.
**Companion:** `SYNC-MILESTONE-INVESTIGATION.md` scopes the later v2.0 milestone.
**Required reading:** planners must first read the parked
`../phases/17-backup-export-restore/17-CONTEXT.md`, then run a fresh Phase 17 discussion after
Phase 16 has completed. This note is a concise index, not substitute implementation context.

## Phase boundary and ordering

- Phase 16 is **Custom Field Value Normalization**. It converts dynamic value columns to a
  normalized row model in migration 006, preserving behavior and establishing stable field/value
  identity. It intentionally comes before the UI/UX milestone and before backup planning.
- Phase 17 is **Backup, Export & Restore**. It remains fully local: no Turso/libSQL adapter,
  account, network sync, or sync-ordering clock.
- Phase 17 owns migration **007** for generic tombstones. The prior Phase-16 document's
  migration-006 and contact-only scope are superseded.

## Reconciliation and tombstones

Phase 17 builds a standalone, tested local reconciliation core that the later sync milestone can
reuse. It must key logical rows on `uid`, resolve child parents by uid then local integer id, choose
the newer `modified_at` for mutable-row collisions, and recompute derived `contacts.last_contact`
from interactions rather than merge it as a scalar. The caller supplies participating row sets; the
core must not assume that every v1 backup row will later be shared.

Tombstones are wave 0 because they are required for correct v1 Merge as well as sync readiness:

- Every hard-deleted mergeable logical entity receives an indefinitely retained tombstone in the
  same SQLite transaction. This includes contact purge and hard-deleted child entities; transient
  `field_history` is excluded. Quarantine is not deletion, but permanent custom-field-definition
  expiry is.
- The generic additive-safe v1 shape is `entity_type`, `entity_uid`, and `deleted_at`, with a
  unique logical key. `revision` and `device_id` remain additive v2 questions.
- Export includes tombstones. An old tombstone-less backup still restores normally.
- A newer tombstone prevents resurrection; if the row and tombstone tie at v1's second precision,
  the tombstone wins. Put that comparison in one helper so v2 can later use a server revision.

## Backup decisions that protect the sync path

- Backup exports/restores full non-secret state; future device-local-vs-synced scope is labeled,
  not enforced. Likely device-local candidates include schedules, widget state, view preferences,
  `ring_seq`, favourite layout/order, and snooze state.
- Backup-at-rest encryption and future sync E2EE are distinct systems with separate lifecycles.
  Do not derive or couple either key to the other.
- Restore previews first, defaults to Merge, and offers explicit-confirmation Replace-all. Replace-all
  writes and verifies a fresh automatic backup first when a destination is configured.

The complete locked UX, encryption, and recovery decisions are in the parked Phase 17 context.
