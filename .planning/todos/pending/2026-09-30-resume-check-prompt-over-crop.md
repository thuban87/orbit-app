---
created: 2026-09-30T21:00:00.000Z
title: "Resume your check?" pops over the crop screen after the photo picker
area: contacts-sync
severity: minor
files:

  - src/components/ResumeReconcilePrompt.tsx
  - src/screens/CropPhotoScreen.tsx

source: 38.6 device pass S11; owner ruling D-40 (log for later), 2026-09-30
---

## Problem

With a linked-contacts check open, returning from the system photo picker (an app foreground event) shows the "Resume your check?" prompt over the crop screen; choosing Resume would leave the photo edit.

## Solution

Do not fire the resume prompt on a return from the app's own picker (or while the crop/edit flow is on top).
