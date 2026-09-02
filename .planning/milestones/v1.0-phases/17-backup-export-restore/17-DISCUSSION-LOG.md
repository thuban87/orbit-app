# Phase 17: Backup, Export & Restore - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-25
**Phase:** 17-backup-export-restore
**Areas discussed:** Custom-field clears and structure conflicts, Merge outcome visibility, Backup-health behavior, Encryption and manual-export flow, temporary navigation placement

---

## Custom-field clears and structure conflicts

| Option | Description | Selected |
|--------|-------------|----------|
| Clear is a real edit | Export a durable blank row and let its newer timestamp win. | ✓ |
| Blank is absence | Omit cleared values from reconciliation. | |
| Special field rule | Use a separate field-specific conflict rule. | |

**User's choice:** A newer explicit clear/blank overwrites an older populated local value.
**Notes:** Phase 16’s normalized, durable `NULL` row is intentional and must be exportable.

| Option | Description | Selected |
|--------|-------------|----------|
| Reject before writes | Reject a malformed backup with local data unchanged. | ✓ |
| Best effort | Restore valid records and skip malformed relationships. | |
| Replace-only tolerance | Permit malformed data only in Replace-all. | |

**User's choice:** Reject the whole restore before any write.
**Notes:** Duplicate normalized pairs and orphan relationships are invalid structure, never data to silently repair.

---

## Merge outcome visibility

| Option | Description | Selected |
|--------|-------------|----------|
| Concise totals | Show added, updated, newer-local-retained, and tombstone-deletion totals. | ✓ |
| Minimal success | Show only a success message and backup date. | |
| Detailed audit | Show per-contact and per-field changes. | |

**User's choice:** Concise outcome totals without sensitive per-record detail.
**Notes:** Replace-all adds local-replaced and pre-restore-backup status.

| Option | Description | Selected |
|--------|-------------|----------|
| Specific calm error | Explain the reason, say local data is unchanged, and return to selection/preview. | ✓ |
| Generic error | Say only that restore failed. | |
| Technical diagnostics | Expose a detailed diagnostic view. | |

**User's choice:** Specific, calm error with an explicit no-change guarantee.
**Notes:** Relevant reasons include wrong passphrase, damaged/incomplete file, newer app, and invalid structure.

---

## Backup-health behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Backup & Restore destination | Permanent health/action landing page plus a rare Dashboard nudge. | ✓ |
| Settings only | Keep backup health solely in Settings. | |
| Persistent Dashboard card | Show backup health on every Dashboard visit. | |

**User's choice:** Backup & Restore is the permanent health/action home; Dashboard nudges only when attention is warranted.
**Notes:** Nudge after meaningful data exists when there is no successful automatic backup, or changed data has gone 14+ days without one.

| Option | Description | Selected |
|--------|-------------|----------|
| Timestamped snapshots | Write/verify a new file, then prune eligible older automatic snapshots. | ✓ |
| One rewritten file | Overwrite one automatic backup file. | |
| Mixed scheme | Combine overwrite and snapshot behavior. | |

**User's choice:** Separate timestamped automatic snapshots; manual exports remain outside rotation.
**Notes:** Never prune the latest verified automatic snapshot.

| Option | Description | Selected |
|--------|-------------|----------|
| Integer day settings | User chooses arbitrary positive integer backup interval and retention days. | ✓ |
| Fixed cadence/count | Daily automatic backup and seven retained copies. | |
| Preset count choices | Choose from 1/3/7/14 retained files. | |

**User's choice:** Back up every N days (default 1) and keep backups for N days (default 7).
**Notes:** The old preset-count proposal is superseded. A due, changed-data check runs on foreground launch; missed launches produce one later snapshot, never catch-up files.

| Option | Description | Selected |
|--------|-------------|----------|
| Foreground-only v1 | Reusable due-backup service runs from launch sweep. | ✓ |
| Exact scheduler now | Request/implement exact scheduled backups now. | |
| Inexact background now | Add background work in this phase. | |

**User's choice:** Foreground-only v1, designed for later inexact-background integration.
**Notes:** Exact scheduling is deferred.

---

## Encryption and manual-export flow

| Option | Description | Selected |
|--------|-------------|----------|
| Match setting by default | Default encrypted when encryption is enabled, with a deliberate readable-JSON override. | ✓ |
| Always ask neutrally | Ask encrypted versus readable each export without a setting-based default. | |
| Always follow setting | Enforce the setting without an export-time override. | |

**User's choice:** Match the backup-protection setting by default, retaining a deliberate readable-JSON override.
**Notes:** Readable JSON remains the global default when optional encryption is not enabled.

---

## Temporary navigation placement

**User's choice:** Do not build or imply an existing navigation bar in this phase.
**Notes:** Backup & Restore is intended to become the fourth top-level destination in the next UI milestone. Phase 17 instead adds a temporary Dashboard link beside Orrery and Settings.

---

## the agent's Discretion

- Define a code-grounded meaningful-data threshold and safe positive-integer validation bounds.
- Select file-schema/KDF details, UI components, route names, and Android error/progress mechanics within the locked security and safety constraints.

## Deferred Ideas

- Bottom navigation implementation and final fourth-destination placement: next UI milestone.
- Sync infrastructure, transport, ordering, and E2EE: future sync milestone.
- Exact or inexact background automatic scheduling: future product/platform work.
