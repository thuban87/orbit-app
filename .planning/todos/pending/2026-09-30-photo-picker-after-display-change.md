---
created: 2026-09-30T21:00:00.000Z
title: Photo picker fails after a font-size or display-size change until the app restarts
area: photos
severity: minor
files:

  - src/components/PhotoSourcePicker.tsx

source: 38.6 device pass S10; owner ruling D-40 (log for later), 2026-09-30
---

## Problem

After changing the system font size or display size while Orbit is running, choosing a photo shows "Couldn't open your photos. Please try again." until the app is restarted. Android recreates the activity in the same process and the picker's launch path does not survive that. Pre-existing native-module behaviour (expo-image-picker).

## Solution

Investigate expo-image-picker after activity recreation (stale activity reference or launcher registration); low priority.
