---
created: 2026-09-30T21:00:00.000Z
title: "[BACKLOG] Carry favourites (and their order) in backups"
area: backup
severity: minor
files:

  - src/backup/backup-schema.ts
  - src/backup/restore-apply.ts

source: 38.6 device pass S8; owner ruling D-40 (backlog item), 2026-09-30
---

## Problem

`favourite_rank` is not in the backup format, so a Replace-all restore (or a restore onto a new phone) drops every favourite, and the favourites widget loses its tiles. Seen on the device in 38.6 (the favourites were put back by hand).

## Solution

Backlog item, not scheduled: add favourites and their order to the backup manifest and restore them on Replace-all (Merge rule to decide). A backup-format change is an owner decision (format version bump, migration of older backups).
