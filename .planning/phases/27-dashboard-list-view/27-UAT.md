---
status: partial
phase: 27-dashboard-list-view
source: [27-VERIFICATION.md]
started: 2026-09-06T04:38:10Z
updated: 2026-09-06T05:10:47Z
---

## Current Test

[testing paused — 4 items outstanding]

## Tests

### 1. List anatomy and status states
expected: Rows remain readable and three-line at increased text size; null status is neutral with no glyph and snoozed is neutral with the snooze glyph.
result: blocked
blocked_by: other
reason: "Automated device UAT rendered the populated Stable rows, but the prepared device data has no never-contacted/null-status, snoozed, or long-text fixture; system text scaling was not changed."

### 2. Favourite, line-three, and TalkBack behavior
expected: The star updates immediately with light haptic, reconciles correctly on durable success/failure, and TalkBack narration/actions are correct without decorative glyph duplication.
result: blocked
blocked_by: physical-device
reason: "Automated device UAT verified the favourite button's Remove favourite → Add favourite → Remove favourite round-trip, stable line-three content, and the row's colour-free accessibility label. The Pixel has no TalkBack service enabled, and no controlled DAO failure path was available."

### 3. FAB and List gestures
expected: FAB behavior is unchanged; configured right swipe commits its action, left opens Edit, and only one row is revealed.
result: issue
reported: "Automated device UAT: an in-row right swipe logged UAT Ada and presented Undo. Activating Undo dismissed the affordance, but UAT Ada still showed Today after a forced app reload; the interaction persisted."
severity: major

### 4. Schema v20 physical readback
expected: The singleton database row defaults to quick-log and the dashboard swipe preference survives a real device read/write path.
result: blocked
blocked_by: other
reason: "The debug app and run-as access are available, but the device image exposes no sqlite3 shell client and no in-app setting surface exists to read/write the v20 preference without a data-extraction procedure."

### 5. Search, states, and reduced motion
expected: Search explanations/snippets and shared states render correctly; rapid updates are restrained and reduced motion disables animation.
result: blocked
blocked_by: other
reason: "Automated device UAT verified the search control and name-only UAT query, but this device data has no memory/fuel corpus fixture; no-match and reduced-motion checks were not completed without changing device-wide settings."

## Summary

total: 5
passed: 0
issues: 1
pending: 0
skipped: 0
blocked: 4

## Gaps

- gap_id: G-27-3
  truth: "Undoing a logged dashboard swipe restores the contact to its pre-swipe interaction state."
  status: failed
  reason: "Automated device UAT: an in-row right swipe logged UAT Ada and presented Undo. Activating Undo dismissed the affordance, but UAT Ada still showed Today after a forced app reload; the interaction persisted."
  severity: major
  test: 3
  artifacts: []
  missing: []
