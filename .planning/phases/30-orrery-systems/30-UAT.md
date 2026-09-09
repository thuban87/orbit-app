---
status: partial
phase: 30-orrery-systems
source: [30-VERIFICATION.md]
started: 2026-09-08T23:42:37Z
updated: 2026-09-09T00:47:55Z
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
result: issue
reported: "Pixel device test: Settings Management refreshed and deletion preserved all 18 contacts, but tapping Undo removed the snackbar without restoring the deleted Work Copy System. The Orrery entry point is also unreachable because Orrery crashes on render."
severity: major

### 5. Switch on the physical Pixel with normal and Reduced Motion
expected: Home framing/focus persistence works; motion intensity follows membership delta; Reduced Motion uses only crossfade/reposition; empty and broken states are distinguishable.
result: issue
reported: "Pixel device test: opening Orrery immediately raises a Render Error (undefined is not a function) at orrery-controls-logic.ts:100 from OrrerySystemSelector.tsx:31, so switching, focus persistence, empty/broken presentation, and both motion modes cannot be exercised."
severity: blocker

## Summary

total: 5
passed: 2
issues: 2
pending: 1
skipped: 0
blocked: 0

## Gaps

- gap_id: G-30-4
  truth: "Both Management entry points refresh the list; deleting a custom System offers Undo that restores metadata without contacts changing."
  status: failed
  reason: "Pixel device test: deletion preserved all 18 contacts, but tapping Undo dismissed the recovery snackbar without restoring the deleted System; Orrery Management is unreachable due to the Orrery render crash."
  severity: major
  test: 4
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""

- gap_id: G-30-5
  truth: "System switching works on a physical Pixel under normal and Reduced Motion, preserving framing/focus and distinguishing empty from broken Systems."
  status: failed
  reason: "Pixel device test: Orrery crashes during initial render before its switcher can be operated."
  severity: blocker
  test: 5
  root_cause: "buildSystemChoices discriminates overloads with source.some(...); the initially empty catalog falls into the legacy categories branch and calls .map on the counts Map as if it were a CustomSystem array."
  artifacts:
    - path: "src/components/orrery/orrery-controls-logic.ts"
      issue: "Empty catalog is misclassified at runtime and countsOrCustom.map is invoked on a Map."
    - path: "src/components/orrery/OrrerySystemSelector.tsx"
      issue: "Renders buildSystemChoices against the initially empty catalog."
  missing:
    - "Use an overload discriminator that handles an empty SystemCatalogEntry array."
    - "Add a regression test for the selector's initial empty-catalog render."
  debug_session: ""
