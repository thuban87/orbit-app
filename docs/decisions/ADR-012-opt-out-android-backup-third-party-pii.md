# ADR-012: Opt-Out Android Backup for Third-Party PII

**Status:** Accepted
**Date:** 2026-08-14
**Phase:** 02-data-foundation-status-engine
**Source decisions:** dossier `01-data` cluster G; 02-CONTEXT DATA-07
**Reversibility:** reversible
**Migration:** None
**Supersedes:** None
**Superseded by:** None

## Context

Orbit's SQLite store contains notes, contact details, and other third-party personal information. Android Auto Backup would copy that private app data through an OS-managed path that users cannot verify or control per application.

## Decision

The Android app sets `allowBackup=false`. User-directed export remains the intended backup path because it is explicit, visible, and user-controlled.

## Alternatives Considered

- **Plain Android Auto Backup** — Rejected because it places private data in third-party storage by default.
- **A custom BackupAgent gated by a setting** — Rejected because it remains opaque and runs on Android-controlled conditions.

## Consequences

### Positive

- The app-private SQLite store is excluded from Android's automatic backup channel.

### Negative

- Until user-directed export exists, device loss or uninstall can mean total local data loss.

### Risks

- Export becomes a load-bearing future capability and must cover the durable contact data contract.

## Implementation

**Key files:**
- `app.config.ts` — declares the Android `allowBackup` setting.
- `src/db/benchmark.ts` — supports the device verification run that confirmed the generated manifest posture.

**Depends on:** ADR-008 (Initial Contact Schema as a Cross-Phase Data Contract).
**Required by:** None.
