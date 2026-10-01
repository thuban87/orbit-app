---
created: 2026-08-26T18:44:17.517Z
title: Validate restore progress with imported photo library
area: testing
severity: minor
files:

  - src/screens/RestorePreviewScreen.tsx
  - src/screens/RestoreResultScreen.tsx

audit_acknowledged:
  milestone: v1.0
  at: 2026-09-02
---

## Problem

Phase 17 restore applies complete too quickly with the disposable one-contact fixtures to
visually confirm the intermediate applying/progress treatment. The actual restore result
paths are green, but this device observation needs an import-sized photo library.

## Solution

During the contact-import phase, create or import roughly 50 disposable contacts with
photos, record the restore flow while applying a backup, and confirm visible progress plus
Back-interruption behavior before the aggregate result screen.

## Resolved 38.6

Checked on the Pixel 6 Pro in the 38.6 device pass (Plan 07, Task 2; `38.6-DEVICE-PASS.md` `## D-18`). Merge of 50 WebP 1024 photo contacts: the "Restoring backup…" card showed at +2.2 s and +4.5 s with the apply and Back buttons disabled; result after 7.3 s. Replace-all of 111 photos: the applying state showed on every poll from +4.3 s to +20.3 s; a hardware Back at +2.0 s was ignored and the result followed on its own after 22.9 s. A third run (61 photos) matched. Recordings: `~/orbit-art/38.6/device-pass/d18/`. No bug. The FAB covering the end of the card is logged separately (`2026-09-30-fab-covers-restore-cards.md`).
