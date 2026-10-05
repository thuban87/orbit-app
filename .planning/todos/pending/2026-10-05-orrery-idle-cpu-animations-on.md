---
created: 2026-10-05T07:00:00.000Z
title: Orrery idle costs ~2/3 of a core with animations on
area: orrery
severity: minor
files:

  - src/components/orrery/v2/ (ambient tick, pulses, lit body shader, nebula/twinkle)

source: 38.7 Plan 16 release soak (38.7-DEVICE-PASS.md G6 table); owner ruling CPU-1 (2026-10-05)
---

## Problem

On the 38.7 release build (Pixel 6 Pro, animations on, Size 120 / All Contacts idle), the UI thread runs at
~66–67 % of one core with ~8 % GC. The 38.7 spike measured ~42 % before Plans 09–15 added the ambient visuals.
No gate applies (context only), but it costs battery.

## Solution

In a later phase, profile the ambient tick on a release build. Start with the GC (likely the budget-40 pulses,
D-68), then the lit body shader (Plan 10) and the nebula/twinkle. Measure once, on the 6 Pro, release only.
