---
created: 2026-09-30
source: 38.6 convergence cycle 1 (L7 finding)
---
# Automatic-backup failures are all reported as a folder problem

`src/services/backup-sweep.ts:77` records every `writeVerifiedSnapshot` failure as `backupFolderAccessible: 0` / "Unable to access the backup folder." — including an encrypted backup exceeding the 8 MiB cap (`encryption.ts:23`). The health card then says "Backup folder needs reconnecting". No path tells the user about the size limit. Out of scope for 38.6; triage later.
