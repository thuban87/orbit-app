# ADR-141: Explicit-Host Dual-Home Backup Navigation

**Status:** Accepted
**Date:** 2026-09-02
**Phase:** 37-settings-personalization
**Source decisions:** phase-37 Settings & Personalization dossier §I; 37-CONTEXT D-08; 37-07 plan and summary
**Reversibility:** costly
**Migration:** None
**Supersedes:** None
**Superseded by:** ADR-146 (partial)

## Context

Data & Backup needed a Settings entry point while the Backup tab remained an intentional alternate home. The existing Backup screens self-fetch local state, but two mounts can otherwise infer the wrong origin, drain a shared native backup twice, or return a completed restore into the wrong stack.

## Decision

The system mounts one canonical Backup screen tree in both the Backup tab and Settings stack. Each stack passes an explicit `BackupHost`; pure host helpers select the post-restore destination and label, root-versus-child chrome, and the sole shared-backup consumer. An omitted host fails closed to the established Backup-tab behavior, while the Settings host returns to the Settings hub. The Backup tab remains until a later owner-approved removal.

## Alternatives Considered

- **Duplicate the Backup screens for Settings** — Maintain two copies. Rejected because restored-state and recovery behavior would drift.
- **Infer the host from navigation state** — Inspect parents at runtime. Rejected because nested-state inference has no reliable identity or safe fallback.
- **Remove the Backup tab immediately** — Make Settings its only home. Rejected because tab removal is explicitly deferred.

## Consequences

### Positive

- Settings gains Data & Backup without a second restore implementation.
- Restore completion and native shared-backup consumption remain deterministic for both hosts.

### Negative

- Every host-dependent screen and reset path must receive the explicit host contract.

### Risks

- A Settings mount that consumes the singleton alongside the tab can drain a shared backup twice; the host helper has one tested consumer rule.

## Implementation

**Key files:**
- `src/screens/backup-dualhome-logic.ts` — declares hosts and the pure return, chrome, and consumption rules.
- `src/navigation/tabs/SettingsStack.tsx` — mounts the canonical Backup tree with the Settings host.
- `src/navigation/tabs/BackupStack.tsx` — mounts the same tree with the Backup-tab host.
- `src/screens/BackupScreen.tsx` — applies host-aware chrome and shared-backup consumption.
- `src/screens/RestorePreviewScreen.tsx` — resets a successful restore to the host-appropriate root.
- `src/screens/RestoreResultScreen.tsx` — returns to the host-appropriate destination after restore.

**Depends on:** ADR-080 (Four-Tab Bottom Navigation Shell with Per-Tab Stacks)
**Required by:** ADR-146 (Digest-Centered Five-Tab Shell and Semantic Root Routing)
