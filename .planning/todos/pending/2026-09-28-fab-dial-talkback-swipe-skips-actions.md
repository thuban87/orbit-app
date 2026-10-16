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

## Update 2026-10-16 (38.11-14 device pass, Pixel 3a debug build)

- The + now holds four actions (38.11 D-62, D-66): Add Contact, Quick Log, Log Interaction, Group Log.
- With TalkBack on and the dial open, the accessibility tree has the four actions as separate, labelled, focusable
  buttons, plus the FAB ("Add / capture") and the full-screen "Dismiss capture actions" scrim
  (`untracked/artifacts/38.11/38.11-14/T3-T1-dial-a11y-nodes.txt`).
- Their tree order is Log Interaction, Add Contact, Group Log, Quick Log, which is not the visual top-to-bottom order
  (Group Log, Log Interaction, Quick Log, Add Contact). TalkBack's swipe order usually follows tree order, so even if
  every action is now reached, the order may jump around.
- Not verified on device: an agent cannot drive TalkBack swipes over adb (an injected swipe arrives as a plain touch,
  and Alt/Search+arrow key combinations are ignored; runbook §3.4). Still needs a finger check: open the +, swipe right
  through it, and confirm all four actions are reached, in order.
