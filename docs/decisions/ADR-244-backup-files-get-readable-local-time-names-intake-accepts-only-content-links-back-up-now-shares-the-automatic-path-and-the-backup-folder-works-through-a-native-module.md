# ADR-244: Backup Files Get Readable Local-Time Names, Intake Accepts Only content:// Links, Back Up Now Shares the Automatic Path, and the Backup Folder Works Through a Native Module

**Status:** Accepted
**Date:** 2026-10-18
**Phase:** 38.12-lifecycle-import-settings-ux
**Source decisions:** D-116, D-136, D-117, D-115, D-62, D-143, D-158, D-63, D-149, D-124, D-64, D-65 (38.12-CONTEXT.md; ledger Q-21, Q-22, mid-execution rulings Q8, R5, device batch DRV)
**Reversibility:** reversible
**Migration:** None
**Supersedes:** ADR-155 (partial — the staged-export name pattern `orbit-backup-<epoch>.json` dies: staged exports take the readable `orbit-backup-<local date-time>` name and old names stay recognised; sharing only with the chosen app, and revoking the grant when the export is retired, survive)
**Superseded by:** None

## Context

Backup files carried epoch or UTC-style names, and Backup settings showed the literal "Selected backup folder". Its hero always said one kept backup. Backup intake accepted any URI scheme (todo `2026-09-27-backup-intake-content-uri-only`). The needs-attention card offered only "Manage backups". The export dialog had no Cancel, and the passphrase field had no show/hide. On device, automatic backups to a Google Drive folder failed, because the library's storage-access calls did not work with that provider.

## Decision

**Names (D-116, D-136).** Manual exports are named `orbit-backup-<YYYY-MM-DD-HHMM>.json` and automatic backups keep their own prefix, `orbit-auto-…`. Both are built from local time with the `formatLocalDate` family, never `toISOString().split`. One module, `backup-file-names.ts`, owns the builders, the collision suffix (`-2`, `-3` within a run), the ownership matchers and name-to-time parsing. Old name shapes stay recognised forever, so old automatic backups are still pruned, expired and re-encrypted. Pruning and re-encryption match only the automatic prefix, so a manual export saved in the backup folder is never touched. Re-encryption keeps each file's own time. The native share guard accepts old and new staged names.

**Intake (D-117).** Choose backup file and share-into-Orbit accept only `content://` links. Anything else gets the normal "not a backup" message, through the existing failure path in the native `BackupIngressRequests`.

**Back up now (D-115).** A stale or too-large warning card offers "Back up now". It writes, verifies and records health through `runAutomaticBackupNow`, the same function the launch sweep uses, then confirms with a snackbar. A card with no folder, or a lost one, offers "Choose a folder", which opens the picker in place through the one shared chooser.

**Folder (D-62, D-143, D-158).** Backup settings shows the folder's real display name, from a native lookup that works for any document provider, Google Drive included. No data repair is needed (D-30). The hero shows the real number of kept backups. Every automatic-backup create, write, read, list and delete goes through Orbit's own native backup module, which opens streams through `ContentResolver`, so any provider works.

**Pages (D-63, D-149, D-124, D-64, D-65).** The export dialog offers Cancel beside the two export choices, and with encryption on the encrypted export is the primary button. The restore passphrase field has a show/hide control. Page titles match their hub and link labels, and Backup settings opens at the section it was asked for. Backup icons come from the icon registry.

## Alternatives Considered

- **Show the picked file's name instead of readable names** — rejected (D-122, ADR-243).
- **Seconds in the name** — the research option; minute precision with a collision suffix was built.
- **Keep the library's storage-access path and repair Drive failures case by case** — rejected; the owner accepted the native module (DRV).
- **A generic folder caption for non-local providers** — rejected; "all my backups go to drive" (Q8).

## Consequences

### Positive

- Backup files are readable in any file manager, and a manual export in the backup folder is safe from pruning.
- Automatic backups work on Google Drive.

### Negative

- Two name shapes, old and new, must be recognised indefinitely.

### Risks

- A Drive folder can report "needs reconnecting" while the Drive app has auth errors; it recovered after re-choosing the folder and was not reproduced.

## Implementation

**Key files:**
- `src/backup/backup-file-names.ts` — every backup file name.
- `src/backup/auto-backup-policy.ts` — retention by the automatic prefix, old and new names.
- `src/services/backup/share-export.ts` — staged export names.
- `src/services/backup/backup-service.ts` — re-encryption names, collision handling.
- `src/services/backup/saf-storage.ts` — folder operations through the native module.
- `src/services/backup/backup-now.ts` — `runAutomaticBackupNow`, `chooseAutomaticBackupFolder`.
- `src/services/backup-sweep.ts` — the launch sweep uses the same write path.
- `src/screens/BackupScreen.tsx` — warning action, export dialog, passphrase show/hide, icons.
- `src/screens/BackupSettingsScreen.tsx` — folder name, kept count, section scroll.
- `src/screens/backup-health-logic.ts` — `backupWarningAction`, `keptBackupsLine`.
- `src/screens/backup-settings-logic.ts` — `backupFolderDisplayName`, the native name lookup.
- `src/components/icons/icon-registry.ts` — backup and show/hide keys.
- `modules/orbit-backup-share/android/src/main/java/expo/modules/orbitbackupshare/OrbitBackupShareModule.kt` — staged-name guard.
- `modules/orbit-backup-document-picker/android/src/main/java/expo/modules/orbitbackupdocumentpicker/BackupIngressRequests.kt` — `content://` allowlist.
- `modules/orbit-backup-document-picker/android/src/main/java/expo/modules/orbitbackupdocumentpicker/OrbitBackupDocumentPickerModule.kt` — folder create, write, read, list, delete and display name.
- `modules/orbit-backup-document-picker/android/src/main/java/expo/modules/orbitbackupdocumentpicker/BackupFolderText.kt` — bounded stream helpers.

**Depends on:** ADR-057 (Full-State Versioned Backups with Verified Manual and Foreground SAF Snapshots); ADR-155 (Backup Share Grants Only the Chosen App); ADR-157 (Bounded Native Transfer Ownership)
**Required by:** None
