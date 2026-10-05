---
created: 2026-10-05T07:00:00.000Z
title: Orrery initials take an emoji as a letter ("Mia 🌸 Nguyễn" draws "M…")
area: orrery
severity: cosmetic
files:

  - src/logic/orrery-label-logic.ts (orreryInitials)

source: 38.7 Plan 16 text probe (38.7-DEVICE-PASS.md, accented/emoji names); owner ruling EMO-1 (2026-10-05)
---

## Problem

`orreryInitials` takes the first grapheme of the first two words, so "Mia 🌸 Nguyễn" gives "M🌸", which is
wider than the body disc and is ellipsized to "M…". Accented names ("Zoë Ångström-Øre") draw correctly.

## Solution

Skip words whose first grapheme is not a letter (emoji, symbols) when picking initials, so the example gives
"MN". Add a unit test with emoji, accented and single-word names. No native change.
