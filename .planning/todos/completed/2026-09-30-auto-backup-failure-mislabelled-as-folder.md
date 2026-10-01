---
created: 2026-09-30
source: 38.6 convergence cycle 1 (L7 finding)
---
# Automatic-backup failures are all reported as a folder problem

`src/services/backup-sweep.ts:77` records every `writeVerifiedSnapshot` failure as `backupFolderAccessible: 0` / "Unable to access the backup folder." — including an encrypted backup exceeding the 8 MiB cap (`encryption.ts:23`). The health card then says "Backup folder needs reconnecting". No path tells the user about the size limit. Out of scope for 38.6; triage later.

## Resolved 38.6 (D-39)

Fixed by `02a6659` (and `9aa5316` for the passphrase-change path): an over-cap encrypted backup now returns a distinct `too-large` outcome; the launch sweep records "The latest automatic backup was too large to create." without touching the folder-accessible flag, and the health card reads "Your backup is too large". On the device (38.6 device pass, `## Task 5 device re-checks`): the manual encrypted export says "Your backup is too large to create. Nothing was shared." and Replace-all says "Couldn't back up this device first because the backup is too large. Your local data hasn't changed." The health-card path is unit-tested only (the launch sweep cannot be triggered on demand). Other write failures still report the folder, as before.
