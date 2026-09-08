---
status: testing
phase: 30-orrery-systems
source: [30-VERIFICATION.md]
started: 2026-09-08T23:42:37Z
updated: 2026-09-08T23:42:37Z
---

## Current Test

number: 1
name: Author custom membership
expected: |
  Manual-only, rule-only, and mixed Systems save and resolve as described; Reset retains rules and clears inclusions/exclusions.
awaiting: user response

## Tests

### 1. Author custom membership
expected: Manual-only, rule-only, and mixed Systems save and resolve as described; Reset retains rules and clears inclusions/exclusions.
result: pending

### 2. Exercise base and Category behavior
expected: Immutable base controls are unavailable, Category changes propagate, broken rules remain visible, and duplication produces an editable custom System.
result: pending

### 3. Use Builder, grid, Preview, and unsaved-change guard at largest text
expected: HUD controls, search/grid, Preview/Edit/Save, and Discard/Keep remain accessible without canvas interaction.
result: pending

### 4. Operate Management from Orrery and Settings
expected: Management operations refresh correctly, preserve All Contacts' constraints, and ordinary delete Undo restores metadata without changing contacts.
result: pending

### 5. Switch on the physical Pixel with normal and Reduced Motion
expected: Home framing/focus persistence works; motion intensity follows membership delta; Reduced Motion uses only crossfade/reposition; empty and broken states are distinguishable.
result: pending

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps
