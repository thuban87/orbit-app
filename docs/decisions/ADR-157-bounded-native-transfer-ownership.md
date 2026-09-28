# ADR-157: Bounded Native Transfer Ownership

**Status:** Accepted
**Date:** 2026-09-23
**Phase:** 38.2-audit-remediation-data-security-lifecycle
**Source decisions:** dossier Workstream A; 38.2-CONTEXT D-19; RG-002, RG-003, RG-004; Plan 15 owner checkpoint
**Reversibility:** costly
**Migration:** None
**Supersedes:** None
**Superseded by:** None

## Context

Backup providers, photo URLs, and Custom AI endpoints can stall, overproduce, or complete after their initiating screen or request has gone away. Unbounded native or JS reads can exhaust memory, retain partial sensitive files, or settle the same request more than once.

## Decision

The system gives every external transfer an explicit owner, cancellation path, bounded resource policy, and deterministic cleanup. Backup ingress copies off the JS thread with a 100 MiB byte ceiling and 30-second no-progress deadline but no total acquisition deadline; photo URL work has a 45-second deadline and screen-lifetime cancellation; Custom AI responses are read once with 1 MiB success and 16 KiB error-body caps while preserving the existing HTTPS, DNS, proxy, MIME, and redirect controls.

## Alternatives Considered

- **Read provider or response bodies without explicit bounds** — rejected because hostile or malformed sources can exhaust memory or hold resources indefinitely.
- **Copy backup input on the JS thread** — rejected because provider I/O and large JSON copies would block the app and blur ownership of partial files.
- **Apply a total backup acquisition deadline** — rejected at the D-19 checkpoint because legitimate remote providers may take an unknown time before yielding a stream; only no-progress after acquisition is timed.

## Consequences

### Positive

- Oversized, stalled, cancelled, and abandoned transfers fail without applying data or retaining partial app-owned files.
- Native requests settle exactly once and remain owned through body consumption.

### Negative

- Orbit can reject a photo-heavy backup that it was able to export until restore uses less memory.

### Risks

- Provider behavior outside the tested Android paths can still delay acquisition before a readable stream exists.

## Implementation

**Key files:**
- `modules/orbit-backup-document-picker/android/src/main/java/expo/modules/orbitbackupdocumentpicker/BoundedBackupCopier.kt` — enforces native backup byte and no-progress bounds.
- `src/screens/backup-restore-document.ts` — checks the app-owned restore copy before JS reads it.
- `src/services/photos/url-image.ts` — owns photo URL cancellation, deadline, and partial-file cleanup.
- `modules/orbit-secure-fetch/android/src/main/java/expo/modules/orbitsecurefetch/SecureResponseReader.kt` — bounds and atomically settles Custom response bodies.
- `modules/orbit-secure-fetch/android/src/main/java/expo/modules/orbitsecurefetch/OrbitSecureFetchModule.kt` — retains native call ownership through response consumption.
- `src/ai/secure-fetch.ts` — maps native bounded-transfer outcomes to sanitized application errors.

**Depends on:** ADR-020 (Library-Only Photo Capture with Themed In-App Cropping and One-Time URL Download); ADR-051 (Public-HTTPS Custom AI Egress Guard); ADR-057 (Full-State Versioned Backups with Verified Manual and Foreground SAF Snapshots)
**Required by:** None
