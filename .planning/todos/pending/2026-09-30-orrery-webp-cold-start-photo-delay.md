---
created: 2026-09-30T23:00:00.000Z
title: Orrery cold start shows 1024 WebP photos ~4 s later than 512 JPEG, even with disk copies
area: orrery
severity: minor
files:

  - src/components/orrery/use-orrery-photo.ts
  - src/services/photos/orrery-derivative-store.ts

source: 38.6 D-41 re-measure (38.6-DEVICE-PASS.md "## D-41 re-measure", cold-start observation), 2026-09-30
---

## Problem

With every Orrery copy already on disk (D-41), a cold-start Orrery open still shows the 50 fixture photos about 4 s later for the WebP 1024 library than for the JPEG 512 library: last probed planet photo at 9.7 s vs 5.6 s after the tab tap, all photos arriving in one frame about 5.4 s after the bodies (UI-observable, `screenrecord` at 10 fps on the Pixel 6 Pro; `~/orbit-art/38.6/device-pass/d11-r3/d11-webp1024-run1.mp4` vs `d11-jpeg512-run1.mp4`). Return visits are equal (photos arrive with the bodies). Memory is within D-11. The hit path should read only the master's signature (`photoFileStat`) and the 512 copy, so the extra time has not been explained.

## Solution

Trace the hit path on device (timestamps around the signature read, the copy read via `Skia.Data.fromURI`, decode, and publish) to find where the ~4 s goes (for example a serialized queue the hits still wait behind, or the display-revision read). Fix only if it is a cheap ordering issue; re-measure cold start with the same fixtures.
