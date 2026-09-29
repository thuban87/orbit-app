---
created: 2026-09-29T17:00:00.000Z
title: Your Week "Interactions" label wraps mid-word at font scale 1.15
area: digest
severity: minor
files:

  - src/components/digest/YourWeekSection.tsx

source: 38.5 D-28 gap list G3; owner ruling D-53 (G3-LATER), UAT 2026-09-29
---

## Problem

On the Pixel 3a at font scale 1.15, the Your Week stat tile's label breaks as "Interaction / s". It shows in every
38.5 Digest shot (`~/orbit-art/38.5/device-pass/raw/*-digest2.png`). This is layout, not art.

## Solution

Fold into a later layout / large-text pass (see Phase 40's large-text reflow). Let the tile label shrink or wrap on
word boundaries only.
