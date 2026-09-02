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
