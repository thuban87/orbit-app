# ADR-209: Backup Format 8 Converts v7 Files with the Migration Mapping, and Merge Keeps the Lower Allow AI

**Status:** Accepted
**Date:** 2026-10-15
**Phase:** 38.10-fuel-retirement-things-to-remember
**Source decisions:** D-55, D-123 (38.10-CONTEXT.md; ledger Q-08; execute-phase ruling after plan 04); carried D-13
**Reversibility:** costly
**Migration:** None
**Supersedes:** ADR-117 (partial — the restore text "a fresh insert takes the column DEFAULT 0, and the merge/update arm explicitly sets allow_ai = 0" dies; restore still never raises an item's AI permission, and the per-interaction default-off gate survives)
**Superseded by:** None

## Context

Format-7 backups carry a `fuel[]` array and fuel tombstones; after migration 033 the app has no fuel table, and Off Limits and gift ideas must survive a restore of an older file. ADR-117 described a restore that forced `allow_ai = 0` on every merged interaction, but since Phase 36 serialized `allow_ai` the code had not matched that text (D-123).

## Decision

We will raise `BACKUP_FORMAT_VERSION` from 7 to 8 (D-55). Format 8 carries `offLimits[]` and no `fuel[]`; memory and current-state rows carry their interaction link (`interactionUid`, `linkSource`), the `groupNoteCopy` / `fromShare` / `noteAiLocked` markers, and dated current state; soft-delete stamps are not on the wire. A v7 file is converted on parse by `convertV7ToV8`, registered as `FORWARD_MIGRATIONS[7]`, using the same row mapping, contentless-skip rule, uid re-mint and tombstone conversion as migration 033 (ADR-208); an equivalence test proves migration and converter give the same rows by uid. On a Merge conflict a memory or interaction keeps `MIN(local, incoming)` `allow_ai`, so a restore never raises permission; a row new to the phone keeps the backup's own value; lock and Group-Note-copy markers still force 0 (D-123). 38.12 decides separately whether it shares v8.

## Alternatives Considered

- **Keep format 7 and drop fuel on restore** — rejected: Off Limits and gift ideas from older backups would be lost (Q-08, "Bump to v8").
- **Restore every row AI-off (ADR-117's text)** — not kept: the owner ruled to keep plan 04's MIN rule, which never raises permission and preserves a user's existing consent on rows new to the phone (D-123).

## Consequences

### Positive

- A real v7 automatic backup restored correctly by Merge and by Replace on the device (plan 19).

### Negative

- The v7 converter is permanent forward-migration code and sits on the no-fuel allowlist.

### Risks

- D-122 (accepted residual): an edit to an undone item in the same wall-clock second as its Undo can let an older backup's tombstone win a later Merge.

## Implementation

**Key files:**
- `src/backup/types.ts` — `BACKUP_FORMAT_VERSION = 8`.
- `src/backup/v7-legacy-conversion.ts` — `convertV7ToV8`.
- `src/backup/v7-v8-migration-equivalence.test.ts` — migration 033 equals converter plus Replace, by uid.
- `src/backup/backup-schema.ts` — format-8 validation and the forward chain.
- `src/backup/export-manifest.ts` — exports `offLimits` and the link and marker fields.
- `src/backup/restore-apply.ts` — `off_limits` entity, link passes, the MIN `allow_ai` Merge rule.
- `src/backup/reconciliation.ts` — format-8 entity reconciliation.
- `src/services/backup/backup-service.ts` — restore preview shows the file's own format version.

**Depends on:** ADR-208 (Migration 033 Copies and Verifies Every Fuel Row); ADR-057 (Full-State Versioned Backups); ADR-117 (Per-Interaction Allow-AI Consent Gate)
**Required by:** None
