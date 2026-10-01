---
created: 2026-09-30T23:00:00.000Z
title: One-time Orrery memory/latency transient while disk copies are generated
area: orrery
severity: minor
files:

  - src/components/orrery/use-orrery-photo.ts
  - src/services/photos/orrery-derivative-store.ts

source: 38.6 D-41 (38.6-DEVICE-PASS.md "## D-41 on-disk Orrery derivative", "For the re-measure"), 2026-09-30
---

## Problem

D-41's 512 disk copies are made on the first Orrery open after a photo is written. That first open still runs the image manipulator for every >512 master, which (via Glide HARDWARE bitmaps that are not recycled until GC) produced the D-37 transient: about +23 % Graphics / +32 % GL at 20 s for 50 photos, back within limits by 70 s. It recurs after any bulk write (restore or import of many photo contacts) and after Android clears the app's cache dir under storage pressure. D-11 was judged on the steady state with copies present (it passes), so this is a known one-time cost, not a failure.

## Solution

Optional hardening, if it is ever seen to matter: generate copies off the Orrery open (for example after a restore/import finalize, rate-limited), or force a software (non-HARDWARE) decode in the downsample so buffers are released promptly. Measure with the D-11 method on the generation run specifically.
