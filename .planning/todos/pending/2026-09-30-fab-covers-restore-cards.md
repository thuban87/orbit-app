---
created: 2026-09-30T21:00:00.000Z
title: The "+" FAB covers the end of the restore progress and error cards
area: backup
severity: minor
files:

  - src/screens/RestorePreviewScreen.tsx

source: 38.6 device pass S6; owner ruling D-40 (log for later), 2026-09-30
---

## Problem

On the Settings stack the shell "+" FAB sits over the bottom-right of the Restore preview's "Restoring backup…" card and of its error card (e.g. "Couldn't back up this device first because the backup is too large…"), hiding part of the last line. Evidence: `~/orbit-art/38.6/device-pass/d18/D-18__merge-fxwebp__applying.png`, `D-39__replace-all-n150__pre-restore-too-large.png`.

## Solution

Hide the FAB on the restore screens, or give their content the shell's bottom clearance (`useBottomClearance`).
