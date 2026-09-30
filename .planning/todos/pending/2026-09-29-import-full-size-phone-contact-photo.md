---
created: 2026-09-29T12:00:00.000Z
title: Import the full-size phone contact photo instead of the thumbnail
area: import
severity: minor
files:

  - modules/orbit-contact-picker/android/src/main/java/expo/modules/orbitcontactpicker/OrbitContactPickerModule.kt
  - src/services/import/import-photo.ts

source: 38.6 D-22 (owner, 2026-09-29; research finding F-4)
---

## Problem

The native contact picker copies `Photo.DATA15` (the contact's thumbnail, ~96–144 px) before falling back to the
full photo. Under 38.6 D-10's never-upscale rule, imported photos are stored at that small size, so the 1024 WebP
master brings them no extra sharpness.

## Solution idea

Prefer the high-res display photo (`PHOTO_FILE_ID` / `openContactPhotoInputStream(..., preferHighres=true)`), falling
back to the thumbnail. Needs a native module change and a native rebuild; owner-scheduled.
