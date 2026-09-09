---
status: partial
phase: 30-orrery-systems
source: [30-VERIFICATION.md]
started: 2026-09-08T23:42:37Z
updated: 2026-09-09T01:55:33Z
---

## Current Test

number: 2
name: Exercise base and Category behavior
expected: |
  Immutable base controls are unavailable, Category changes propagate, broken rules remain visible, and duplication produces an editable custom System.
awaiting: user response

## Tests

### 1. Author custom membership
expected: Manual-only, rule-only, and mixed Systems save and resolve as described; Reset retains rules and clears inclusions/exclusions.
result: pass
device_evidence: "Pixel 6 Pro: saved manual-only, rule-only, and mixed temporary Systems; membership counts resolved; Preview saved; Reset removed the durable include override while preserving the favorite rule."

### 2. Exercise base and Category behavior
expected: Immutable base controls are unavailable, Category changes propagate, broken rules remain visible, and duplication produces an editable custom System.
result: pending
device_evidence: "Pixel 6 Pro: All Contacts reorder/hide controls were unavailable, built-in and Category names/rules were disabled, and duplicating Work produced an editable custom Work Copy. Category propagation and a broken-rule fixture still need human review."

### 3. Use Builder, grid, Preview, and unsaved-change guard at largest text
expected: HUD controls, search/grid, Preview/Edit/Save, and Discard/Keep remain accessible without canvas interaction.
result: pass
device_evidence: "Pixel 6 Pro at font_scale 2.0: Settings and Systems remained reachable; Builder scrolled to Manage Members, Preview, and Save; member search filtered to UAT Grace; Add People rows were operable; Preview/Edit and the Discard/Keep Editing dialog remained accessible."

### 4. Operate Management from Orrery and Settings
expected: Management operations refresh correctly, preserve All Contacts' constraints, and ordinary delete Undo restores metadata without changing contacts.
result: pass
device_evidence: "Pixel 6 Pro: Settings and Orrery both opened Systems Management; All Contacts remained pinned with no hide/reorder control; deletion preserved all 18 contacts; tapping Undo within the six-second action window restored Work Copy with its exact UID. The earlier Undo report was a test-timing false positive after the snackbar had expired."

### 5. Switch on the physical Pixel with normal and Reduced Motion
expected: Home framing/focus persistence works; motion intensity follows membership delta; Reduced Motion uses only crossfade/reposition; empty and broken states are distinguishable.
result: pending
device_evidence: "Rebuilt debug APK on Pixel 6 Pro: Orrery opens without the prior crash; All Contacts (6), Favorites (2), and valid-empty Needs Attention (0) switch successfully; shared UAT Grace focus survives Favorites -> All Contacts while the real switch lands at Home; Favorites restores after force-stop/relaunch; normal and Android Reduced Motion (animator scale 0) switches completed, with the reduced-motion recording showing crossfade/reposition and no rotational sweep. Broken-rule presentation and comparative membership-delta motion feel still need owner review."

## Summary

total: 5
passed: 3
issues: 0
pending: 2
skipped: 0
blocked: 0

## Gaps

[none]
