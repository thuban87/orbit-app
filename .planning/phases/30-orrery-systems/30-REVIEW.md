---
phase: 30-orrery-systems
reviewed: 2026-09-08T17:16:00-05:00
depth: deep
files_reviewed: 61
files_reviewed_list:
  - docs/systems/orrery-systems-backup-contract.md
  - src/backup/backup-schema.ts
  - src/backup/backup-schema.test.ts
  - src/backup/export-manifest.test.ts
  - src/backup/phase-17-integration.test.ts
  - src/components/icons/icon-registry.ts
  - src/components/icons/icon-registry.test.ts
  - src/components/orrery/ManageMembersGrid.tsx
  - src/components/orrery/OrrerySystemSelector.tsx
  - src/components/orrery/OrreryWorld.tsx
  - src/components/orrery/SystemPreviewCanvas.tsx
  - src/components/orrery/SystemRuleAccordion.tsx
  - src/components/orrery/manage-members-logic.ts
  - src/components/orrery/manage-members-logic.test.ts
  - src/components/orrery/orrery-controls-logic.ts
  - src/components/orrery/orrery-controls-logic.test.ts
  - src/components/orrery/orrery-frame-mapper.test.ts
  - src/components/orrery/orrery-render.test.tsx
  - src/components/orrery/orrery-switch-animation.ts
  - src/components/orrery/orrery-switch-animation.test.ts
  - src/components/orrery/system-builder-logic.ts
  - src/components/orrery/system-builder-logic.test.ts
  - src/components/orrery/system-preview-logic.ts
  - src/components/orrery/system-preview-logic.test.ts
  - src/db/app-settings-dao.ts
  - src/db/app-settings-dao.test.ts
  - src/db/database.ts
  - src/db/lifecycle-consumer-ledger.test.ts
  - src/db/orrery-system-read.ts
  - src/db/orrery-system-read.test.ts
  - src/db/orrery-preferences.test.ts
  - src/db/systems-catalog-read.ts
  - src/db/systems-catalog-read.test.ts
  - src/db/systems-dao.ts
  - src/db/systems-dao.test.ts
  - src/db/systems-members-read.ts
  - src/db/systems-members-read.test.ts
  - src/db/migrations/022-orrery-systems.ts
  - src/db/migrations/022-orrery-systems.test.ts
  - src/db/migrations/full-chain.test.ts
  - src/logic/orrery-frame.ts
  - src/logic/orrery-frame.test.ts
  - src/logic/orrery-system-logic.ts
  - src/logic/orrery-system-logic.test.ts
  - src/logic/system-rule-resolver.ts
  - src/logic/system-rule-resolver.test.ts
  - src/navigation/types.ts
  - src/navigation/tabs/OrreryStack.tsx
  - src/navigation/tabs/SettingsStack.tsx
  - src/screens/OrreryScreen.tsx
  - src/screens/SettingsScreen.tsx
  - src/screens/SystemBuilderScreen.tsx
  - src/screens/SystemBuilderScreen.test.tsx
  - src/screens/SystemsManagementScreen.tsx
  - src/screens/SystemsManagementScreen.test.tsx
  - src/screens/orrery-screen-framing.test.ts
  - src/services/orrery-scene.ts
  - src/services/orrery-scene.test.ts
  - src/stores/orrery-preferences-store.ts
  - src/stores/orrery-preferences-store.test.ts
  - src/stores/orrery-system-store.ts
findings:
  critical: 2
  warning: 2
  info: 0
  total: 4
status: issues_found
---

# Phase 30: Code Review Report

**Reviewed:** 2026-09-08T17:16:00-05:00
**Depth:** deep
**Files Reviewed:** 61
**Status:** issues_found

## Summary

Reviewed the complete Systems data path: irreversible migration 022; DAO writers and bound read/resolver queries; catalog, lifecycle, backup boundary, preference/store publication, both navigation stacks, management and builder UI, and the Skia switch/preview paths. The migration remains forward-only and parameter binding is consistently used. The actual deletion workflow, however, splits a destructive deletion from the preference fallback it requires. A save failure can therefore destroy a System while reporting deletion failure and without offering Undo. The Undo path has the symmetric split-brain failure. Rule writes also lack the promised closed-vocabulary boundary, and preview markers have no accessible equivalent interaction.

## Critical Issues

### CR-01: Active-System deletion is not atomic with its required fallback

**File:** `src/screens/SystemsManagementScreen.tsx:109`
**Issue:** `deleteManagedSystem()` commits `deleteSystem()` first, then separately writes `orrery_last_system` at line 110. If `publishLastSystem()` fails, the System is already gone, no Undo snackbar is created (it is only reached at line 112), and the caller reports “Couldn't delete this System.” The persisted preference can also remain `custom:<deleted uid>` until some later Orrery load happens to recover it. This is a destructive data-loss path, not a harmless UI retry.

**Fix:** Add one DAO composite which opens the sole write transaction, reads/validates whether the deleted custom System is active inside that transaction, calls `deleteSystemCore()`, calls `updateAppSettingsCore(... { orreryLastSystem: ALL_CONTACTS_REF })` when necessary, and bumps `data_revision` once before commit. Return the deletion snapshot only after that transaction commits. The UI should invoke the composite and offer Undo only after success.

### CR-02: Undo can restore data but fail to restore the active selection

**File:** `src/screens/SystemsManagementScreen.tsx:121`
**Issue:** The Undo callback commits `restoreDeletedSystem()` before independently calling `publishLastSystem()` at line 122. A preference-write failure leaves the System restored but leaves the user on All Contacts; the catch then falsely says the undo failed because its name is in use. This breaks the active-delete contract and makes the resulting state and user feedback disagree.

**Fix:** Provide the symmetric DAO composite: restore the snapshot and, when it was active at deletion time, update `orrery_last_system` in the same transaction, then bump the revision once. Distinguish an actual restore conflict from a preference failure only if the design intentionally permits the latter; otherwise neither part should commit.

## Warnings

### WR-01: DAO accepts invalid System rule vocabulary despite the closed-rule contract

**File:** `src/db/systems-dao.ts:471`
**Issue:** `setSystemRulesCore()` deletes the existing definition and inserts every caller-provided `{ family, value }` verbatim at lines 481-488. `SystemRuleDraft` is `string`-typed, and neither this method nor `saveSystemDefinitionCore()` validates the closed family/value vocabulary. The resolver later treats such persisted rows as broken, so an internal caller or future restore writer can silently create a System that cannot represent the selected predicate. The Phase 30 backup contract explicitly requires validation before writes.

**Fix:** Centralize an `assertSystemRuleDrafts()` validator in the DAO (or a pure shared module) for every allowed family and value, including UID grammar for categories; call it before beginning replacement writes in both public and core-compatible composites. Retain the resolver’s broken-rule handling for historical/deleted category UIDs, not newly invalid writes. Add rejection tests for invalid family/value and malformed category UID.

### WR-02: Preview membership markers are not available to assistive technology

**File:** `src/components/orrery/SystemPreviewCanvas.tsx:127`
**Issue:** The preview exposes contact markers only as Skia circles under a gesture detector. They have no accessibility role, label, state, or non-canvas equivalent. A screen-reader or switch-control user cannot discover or focus a member; the HUD only announces the generic text “Focused member” at `SystemBuilderScreen.tsx:502`, not the member identity. This makes the Preview interaction unavailable to non-touch users.

**Fix:** Treat the canvas as decorative for accessibility and provide a tokenized, accessible member list/buttons in the Preview HUD (with name and selected state), wired to the same `onFocusBody` handler. Announce the selected member’s name. Keep the canvas tap behavior as the visual equivalent.

---

_Reviewed: 2026-09-08T17:16:00-05:00_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: deep_
