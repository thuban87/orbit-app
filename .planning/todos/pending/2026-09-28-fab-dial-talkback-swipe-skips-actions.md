---
created: 2026-09-28T12:00:00.000Z
title: TalkBack swipe through the open + (FAB) menu reaches only every second action
area: accessibility
severity: minor
files:

  - src/components/UniversalFab.tsx

source: 38.4 owner checklist item 18 (OWN-RG039 / D-31), owner 2026-09-28 — accepted as is, revisit later
---

## Problem

With TalkBack on and the + menu open, swiping moves focus to every second action, so 3 of the 6 actions are never
reached by swiping. Tapping each action directly works. With the menu closed, TalkBack behaves correctly.

## Solution

Investigate the dial's accessibility order/grouping (likely nested accessible containers or an importantForAccessibility
mismatch on alternate rows) and make swipe traversal visit all six actions plus the FAB, in order.
