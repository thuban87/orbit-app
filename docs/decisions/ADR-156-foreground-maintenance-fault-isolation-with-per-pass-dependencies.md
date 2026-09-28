# ADR-156: Foreground Maintenance Fault Isolation with Per-Pass Dependencies

**Status:** Accepted
**Date:** 2026-09-23
**Phase:** 38.2-audit-remediation-data-security-lifecycle
**Source decisions:** dossier Workstream D; 38.2-CONTEXT D-18; RG-016
**Reversibility:** reversible
**Migration:** None
**Supersedes:** None
**Superseded by:** None

## Context

Orbit runs several unrelated recovery and maintenance jobs at launch and foreground. A recoverable image or hook failure could previously block healthy data from rendering, starve later work, or let automatic backup run after same-pass recovery failed.

## Decision

The system uses a sequential foreground maintenance registry with per-hook fault isolation, stable hook IDs, and explicit same-pass prerequisites. Independent hooks continue after a failure, queued foreground reruns are preserved, and automatic backup is skipped only when a declared recovery prerequisite failed or remained incomplete in that pass; migrations and theme hydration remain fail-closed.

## Alternatives Considered

- **Abort the whole maintenance pass** — rejected because one recoverable artifact must not starve unrelated cleanup or hide healthy relationship data.
- **Persist a backup hold while recovery work exists** — rejected because stale state could suppress backups indefinitely; D-18 requires a fresh per-pass result.
- **Run hooks in parallel or on timers** — rejected because ordering is load-bearing and maintenance remains foreground-only.

## Consequences

### Positive

- Recoverable maintenance faults are contained without weakening migration or integrity gates.
- Dependencies such as recovery-before-backup are explicit and recomputed each pass.

### Negative

- Hook registration order, IDs, and prerequisite declarations become part of the maintenance contract.

### Risks

- A future recovery producer registered after the drain must also become a backup prerequisite or incomplete state could be exported.

## Implementation

**Key files:**
- `src/services/launch-sweep.ts` — runs isolated sequential hooks with same-pass prerequisites and coalesced reruns.
- `src/services/bootstrap-sequence.ts` — keeps migration and theme readiness fail-closed while containing recoverable image faults.
- `src/services/photos/background-reconcile-sweep.ts` — reports incomplete candidate recovery without stopping unrelated candidates.
- `src/services/photos/restore-photo-finalize-sweep.ts` — reports unrecovered journal work to the maintenance runner.
- `src/services/backup-sweep.ts` — declares recovery prerequisites for automatic backup.
- `App.tsx` — registers the ordered bootstrap and foreground maintenance sequence.

**Depends on:** ADR-009 (Crash-Safe Forward-Only SQLite Migrations); ADR-057 (Full-State Versioned Backups with Verified Manual and Foreground SAF Snapshots)
**Required by:** ADR-162 (Sweep-Ordered Foreground Refresh and Latest-Request Publication Authority)
