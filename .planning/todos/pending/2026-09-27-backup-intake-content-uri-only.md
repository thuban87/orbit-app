---
created: 2026-09-27T20:00:00.000Z
title: Backup intake (Choose backup file + share-into-Orbit) accepts only content:// links
area: backup
severity: minor
files:

  - src/backup/ (restore intake path)
  - orbit-backup-document-picker native module (Kotlin)

source: 38.4 D-71 (owner, 2026-09-27); Plan 22 out-of-scope finding 2 + D-48/D-60 investigation (38.4-NATIVE-CONFIG-INVESTIGATION.md)
---

## Problem

`orbit-backup-document-picker` opens whatever URI it is handed with no scheme check. A raw `file://` path from an
old file manager (Android 7–9) depends on READ_EXTERNAL_STORAGE, and another app could hand Orbit a path into
Orbit's own private files as a "backup" (it is copied to cache then rejected as non-backup JSON — nothing leaks).

## Solution

Accept only `content://` URIs at intake (reject others with the normal "not a backup" message). This is also the
precondition for ever removing the storage permissions kept by D-60. Needs a Kotlin change + native build.
