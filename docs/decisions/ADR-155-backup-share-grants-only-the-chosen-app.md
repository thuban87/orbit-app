# ADR-155: Backup Share Grants Only the Chosen App

**Status:** Accepted
**Date:** 2026-09-25
**Phase:** 38.2-audit-remediation-data-security-lifecycle
**Source decisions:** Owner decision 2026-09-25 (option a) after 38.2-16 device UAT RG-014
**Reversibility:** reversible
**Migration:** None
**Supersedes:** None
**Superseded by:** None

## Context

Manual backup export stages a file under `cache/backup-exports` and shares it through the system chooser. expo-sharing granted read access only to packages that resolve the *chooser* intent (the system chooser itself), leaving receivers with the chooser's temporary grant. On a Pixel 6 Pro, Google Drive stalled at "Preparing to upload files" for Orbit's share while Gmail (which reads immediately) worked. A lapsed temporary grant was the suspected cause for background-reading targets.

## Decision

Outbound backup sharing uses a local module (`orbit-backup-share`) that shares only staged exports matching `orbit-backup-<epoch>.json` in `cache/backup-exports`, and grants read access to exactly the package the user picks, learned from the chooser's `EXTRA_CHOSEN_COMPONENT` callback. The grant is revoked when the staged export is retired (next export or the 24-hour sweep).

## Alternatives Considered

- **Grant every app that can receive the share** — rejected by the owner; exposes a possibly readable backup to apps the user never chose.
- **Save through the system file picker for Drive instead of sharing** — rejected by the owner in favour of fixing the share path.

## Consequences

### Positive

- The chosen app holds a read grant that outlives its receiving activity (verified on device: `UriPermission ... targetPkg=com.google.android.apps.docs`), so background-reading targets are not cut off.
- No app other than the chosen one gains access; the grant ends with the staged file.
- Verified 2026-09-25: this grant alone did NOT clear the Drive stall; the Drive upload remains under investigation (38.2-UAT RG-014).

### Negative

- A small native module now owns outbound backup sharing; expo-sharing remains only for its FileProvider.

### Risks

- A grant persists until revocation or reboot if the app is killed before retirement; the file itself is still retired by the next export or the 24-hour sweep.

## Implementation

**Key files:**
- `modules/orbit-backup-share/android/src/main/java/expo/modules/orbitbackupshare/OrbitBackupShareModule.kt` — staged-export-only chooser share and revoke.
- `modules/orbit-backup-share/android/src/main/java/expo/modules/orbitbackupshare/ChosenShareTargetReceiver.kt` — grants the chosen package.
- `src/services/backup/share-export.ts` — share adapter and revoke-before-delete retirement.

**Depends on:** None
**Required by:** None
