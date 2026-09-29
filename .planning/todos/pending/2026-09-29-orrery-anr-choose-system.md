---
created: 2026-09-29T17:00:00.000Z
title: Orbit "isn't responding" on the Orrery when opening Choose System
area: orrery
severity: major
files:

  - src/screens/OrreryScreen.tsx

source: 38.5 D-28 gap list G1; owner ruling D-51 (G1-LATER), UAT 2026-09-29
---

## Problem

The 38.5 device pass hit two `am_anr` events ("Input dispatching timed out, waited 5 s") on the UI thread when opening
Choose System on the Orrery. This was the Pixel 3a on a **debug** build. No Orrery source changed in 38.5. Image:
`~/orbit-art/38.5/device-pass/owner/G1_orrery-anr.jpg`.

## Solution

First check whether it happens on a release build and on the Pixel 6 Pro. A debug build on the Pixel 3a may be the
whole story. If it still happens, profile the Choose System open path on the JS and UI threads.
