# ADR-242: Backup Format 9 Carries Favourites — Merge Restore Unions Them, Replace-All Takes the Backup's, and the Bin Is Never Favourited

**Status:** Accepted
**Date:** 2026-10-18
**Phase:** 38.12-lifecycle-import-settings-ux
**Source decisions:** D-112, D-113, D-156 (38.12-CONTEXT.md; ledger Q-18, Q-19, device-pass ruling R9); carried D-23
**Reversibility:** costly
**Migration:** None
**Supersedes:** None
**Superseded by:** None

## Context

Backups did not carry favourites: the export SELECT omitted the rank and the restore upsert never wrote it. A Replace-all restore therefore unfavourited everyone, against ADR-057 and ADR-138's full-state rule and dossier 15's "backups carry full non-secret state" (todo `2026-09-30-backlog-favourites-in-backups`). The wire format was 8 (ADR-209).

## Decision

Backups carry favourite membership as a 0/1 `favourite` marker on each contact. It is binary (ADR-075) with no order, and absent reads as 0 (D-112). `BACKUP_FORMAT_VERSION` goes 8 → 9 with a forward step that sets `favourite` to 0 on every contact. An older file restores with no favourites, and an older app refuses a v9 file with "update first". Export and both restore modes write it. The v7 converter still emits 8, and its output flows through the new 8 → 9 step. There is no SQLite migration, because the rank column exists. The export SQL aliases the membership as `favouriteMember` and maps it to the wire key in code.

On a **Merge** restore a person is a favourite if either the phone or the backup marks them, and a restore never unfavourites anyone (D-113). Missing marks are appended after the phone's highest rank, like the favourites DAO. A Merge whose only change is a backup favourite is no longer a no-op: it writes the mark and bumps `data_revision`. A **Replace-all** restore takes the backup's favourites exactly, ranked in backup order. Neither mode bumps `modified_at`.

A Merge restore never makes a person in the Bin a favourite (D-156). That is D-34's Bin guard applied over a literal reading of D-113, and live people keep the union.

## Alternatives Considered

- **Slip favourites into format 8 without a bump** — rejected; an older app would silently drop them (Q-18 B).
- **Defer and say so** — rejected (Q-18 C).
- **Carry favourites and their order** — the todo's wording; dropped, since favourites have no user-facing order (ADR-075).
- **On a Merge restore keep the phone's state, or take the backup's** — rejected for the union, which never unfavourites (Q-19 B, C).
- **Favourite a Bin person when the backup marks them** — the literal reading of D-113; the owner accepted the built Bin exclusion (R9).

## Consequences

### Positive

- A Replace-all restore no longer unfavourites everyone.
- A v9 file cannot be half-restored by an older app.

### Negative

- Every v8 or older backup restores with no favourites.

### Risks

- A future wire change must bump past 9 and add its own forward step.

## Implementation

**Key files:**
- `src/backup/types.ts` — `BACKUP_FORMAT_VERSION = 9`.
- `src/backup/backup-schema.ts` — the v8 → v9 forward step and the `favourite` marker check.
- `src/backup/export-manifest.ts` — exports favourite membership.
- `src/backup/restore-apply.ts` — Replace-all takes the backup's favourites; Merge unions them; never a Bin person.
- `src/backup/restore-roundtrip.test.ts` — the v9 round trip.
- `src/backup/backup-schema.test.ts` — the v8 → v9 conversion.

**Depends on:** ADR-057 (Full-State Versioned Backups with Verified Manual and Foreground SAF Snapshots); ADR-138 (Complete Portable Backup Format v5); ADR-209 (Backup Format 8 Converts v7 Files with the Migration Mapping, and Merge Keeps the Lower Allow AI); ADR-075 (Binary Favourite Membership Without a User-Facing Order)
**Required by:** None
