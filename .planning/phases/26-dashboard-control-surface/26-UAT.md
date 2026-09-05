---
status: testing
phase: 26-dashboard-control-surface
source: [26-VERIFICATION.md]
started: 2026-09-05
updated: 2026-09-05
---

## Current Test

number: 1
name: Anchored panels open below their control with live-updating list behind a scrim
expected: |
  Panel floats anchored under the tapped control (not a full-screen modal / bottom sheet);
  the dashboard list behind updates live as options toggle; the scrim covers the whole
  surface including the app bar.
awaiting: user response

## Tests

### 1. Anchored panels — geometry, scrim, live-update-behind
expected: Open each of Population, Filters, Sort. Each opens an anchored floating panel anchored below its control (not a modal/bottom sheet), with the dashboard list visibly re-querying behind a light full-surface scrim that covers the app bar too.
result: [pending]

### 2. Panel dismissal + background inertness + Back ordering
expected: With a panel open, the background is inert and out of assistive-tech focus. All three dismiss paths close it — (a) re-tapping the same control, (b) tapping outside anywhere including over the app bar, (c) Android system Back. Back dismisses the panel before any route navigation; only one panel is ever open at a time.
result: [pending]

### 3. Live-apply — no Apply/Done button; zero-result keeps panel open
expected: Toggling populations/filters/sort applies immediately with NO Apply/Done affordance. A selection yielding zero rows leaves the panel open with the cause-aware empty state behind it.
result: [pending]

### 4. Header destinations — icon-only fallback under text scale
expected: At default and 200% OS text scale, both header destinations (Your Week, Group Events) stay present. Labels show when they fit; otherwise BOTH collapse to icon-only. Header never wraps, shrinks below role size, or pushes the control/search rows down.
result: [pending]

### 5. Row-3 search expand/collapse + List/Card toggle targets
expected: Expand/collapse the Row-3 search with reduced-motion OFF then ON; background the app mid-animation. Motion is restrained; reduced-motion collapses to instant; no half-run animation after backgrounding. The right-aligned List/Card toggle keeps a 44px target at supported widths and 200% text scale; search takes the remaining row width.
result: [pending]

### 6. Origin-aware return + Unbound live search + dual Archived entry points
expected: Dashboard → Archived → a Profile → Back lands back on Archived (not Dashboard root). Dashboard → Unbound → search → Back filters live and disambiguates no-match from true-empty. Both Archived entry points (overflow + Settings row) reach the same one screen.
result: [pending]

### 7. Disabled Select Contacts row + Reset Dashboard View
expected: Tapping the disabled Select Contacts overflow row is a true no-op with the sheet staying open and the row read as disabled to assistive tech. Reset Dashboard View (from a mixed state and from an already-default state) returns Active / no filters / Default sort / cleared search with NO confirmation dialog, while preserving the List/Card viewMode.
result: [pending]

## Summary

total: 7
passed: 0
issues: 0
pending: 7
skipped: 0
blocked: 0

## Gaps

(none recorded by verification — 10/10 requirements code-satisfied; these are device-observable confirmations only)

## Review notes (from 26-REVIEW.md — all fixed this session, confirm on device)

The 3 code-review Warnings were fixed before this UAT (owner-approved "fix now"). Confirm the fixed behaviour while testing:

- WR-01 (fixed 8418857): opening a panel and toggling options should NOT yank TalkBack focus back to the panel each time. Confirm during tests 1–3.
- WR-02 (fixed d380ce1): collapsing Row-3 search now clears the term — "Close search" restores the full list, never a silently filtered one. Confirm during test 5.
- WR-03 (fixed d380ce1): a favourites list zeroed by an active filter shows neutral "Nothing here right now." copy, not "No favourites yet".
