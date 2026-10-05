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

## Resolution (2026-10-05, Phase 38.7 Plan 16, D-52)

Closed: it did not reproduce. Evidence (`.planning/phases/38.7-orrery-v2/38.7-DEVICE-PASS.md`):

- **Pixel 6 Pro, DEBUG** (`## ANR re-check (debug)`): `switch_stall.py --open-selector 3` showed the sheet 3/3, with
  `am_anr` 0, Davey 0 and `Skipped` 0. About 15 sheet opens and 6 switches (All Contacts included) over the session:
  no `am_anr`, no `am_crash`.
- **Pixel 6 Pro, release `68748e93`** (`### Choose System ANR (D-52, release)`): `--open-selector 3` showed the sheet
  3/3, with `am_anr` 0, Davey 0 and `Skipped` 0. Every switch-stall run was clean.
- **Pixel 3a, release smoke** (`### Pixel 3a release smoke`): All Contacts picked through the selector; no `am_anr`,
  no crash, same process throughout.

The likely mechanism (an unrelated screen render restarting the frame worklet) was removed in 38.7-03.
