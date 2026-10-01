---
created: 2026-09-30T21:00:00.000Z
title: Contacts Grid stays at 3 columns at font scale exactly 1.4
area: dashboard
severity: minor
files:

  - src/components/grid-card-geometry.ts

source: 38.6 device pass S13; owner ruling D-40 (log for later), 2026-09-30
---

## Problem

The Grid switches to 2 columns at `fontScale >= 1.4`, but Android reports 1.3999999… for the 1.4 setting, so the Grid stays at 3 columns; 1.41 and above give 2. Pre-existing since Phase 28.

## Solution

Compare against a tolerance (e.g. `>= 1.4 - 1e-3`) or round the scale first; add the 1.3999999 case to the geometry test.
