---
created: 2026-09-28T12:00:00.000Z
title: Revisit the import match-review screens (Review possible matches / Duplicate Review) — janky flow and layout
area: ui
severity: minor
files:

  - src/screens/DuplicateReviewScreen.tsx
  - src/screens/ImportCompleteScreen.tsx

source: 38.4 owner checklist item 25 (OWN-O3), owner 2026-09-28 — passed functionally, but "the screens here are terrible and janky"
---

## Problem

The owner-tested flow (Import complete "Need review (N)" → Review possible matches → long-press a card → Choose action →
link → Back) works, but the screens feel janky and poorly laid out.

## Solution

Owner walkthrough first to capture exactly what feels wrong, then a design pass on the match-review flow.
