---
created: 2026-09-30T23:00:00.000Z
title: Orrery frames the system into a left strip while the assist banner shows
area: orrery
severity: minor
files:

  - src/components/orrery/orrery-obstacle-logic.ts

source: 38.6 device pass (D-38 re-check); owner ruling D-42 (logged for later), 2026-09-30
---

## Problem

While a "Did you reach …?" question is pending, the in-flow banner (D-38) makes the Orrery canvas shorter (411×541 dp on a Pixel 6 Pro). The camera-controls obstacle is a reserved 200 dp column (`CONTROL_WIDTH = 200`, `orrery-obstacle-logic.ts:32`), although the zoom buttons are about 54 dp wide. The largest free rectangle is then the 195×477 dp strip left of that column, which narrowly beats the full-width band above it, so the Sun sits at about a quarter of the screen width. Nothing is hidden under a button, and the Orrery re-centres once the question is answered. Evidence: `~/orbit-art/38.6/device-pass/d38/D-38__orrery__cold-mount-banner.png`, `D-38__orrery__obstacle-probe-banner.txt`.

## Solution

Reserve only the buttons' real width (measured, or a constant close to `CONTROL_MIN_TARGET` plus edge and gap) instead of the 200 dp column, then re-check framing with and without the banner on a 6 Pro-class and a 3a-class phone. Keep the existing obstacle tests and add the banner-height case.
