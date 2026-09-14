---
phase: 30-orrery-systems
reviewed: 2026-09-08T23:36:28Z
depth: deep
files_reviewed: 61
files_reviewed_list:
  - AGENTS.md
  - HANDOFF.md
  - docs/decisions/ADR-104-durable-orrery-preferences-and-live-system-scope.md
  - docs/decisions/ADR-105-scoped-relationship-satellites-for-system-member-context.md
  - docs/decisions/ADR-106-derived-orrery-gravity-visual-mass-and-accessible-context.md
  - docs/systems/orrery.md
  - docs/systems/orrery-systems-backup-contract.md
  - src/backup/backup-schema.ts
  - src/backup/reconciliation.ts
  - src/backup/restore-apply.ts
  - src/components/icons/icon-registry.ts
  - src/components/orrery/ManageMembersGrid.tsx
  - src/components/orrery/OrreryContactsSheet.tsx
  - src/components/orrery/OrrerySystemSelector.tsx
  - src/components/orrery/OrreryWorld.tsx
  - src/components/orrery/SystemPreviewCanvas.tsx
  - src/components/orrery/SystemRuleAccordion.tsx
  - src/components/orrery/manage-members-logic.ts
  - src/components/orrery/orrery-controls-logic.ts
  - src/components/orrery/orrery-switch-animation.ts
  - src/components/orrery/system-builder-logic.ts
  - src/components/orrery/system-preview-logic.ts
  - src/db/app-settings-dao.ts
  - src/db/database.ts
  - src/db/merge-dao.ts
  - src/db/migrations/021-orrery-preferences.ts
  - src/db/migrations/022-orrery-systems.ts
  - src/db/migrations/023-orrery-system-selection-revision.ts
  - src/db/orrery-action-read.ts
  - src/db/orrery-satellites-read.ts
  - src/db/orrery-system-read.ts
  - src/db/purge-dao.ts
  - src/db/systems-catalog-read.ts
  - src/db/systems-dao.ts
  - src/db/systems-members-read.ts
  - src/db/transaction.ts
  - src/logic/orrery-focus-logic.ts
  - src/logic/orrery-frame.ts
  - src/logic/orrery-system-logic.ts
  - src/logic/system-rule-resolver.ts
  - src/navigation/tabs/OrreryStack.tsx
  - src/navigation/tabs/SettingsStack.tsx
  - src/navigation/types.ts
  - src/screens/OrreryScreen.tsx
  - src/screens/SettingsScreen.tsx
  - src/screens/SystemBuilderScreen.tsx
  - src/screens/SystemsManagementScreen.tsx
  - src/services/orrery-scene.ts
  - src/stores/orrery-preferences-store.ts
  - src/stores/orrery-system-store.ts
  - src/db/migrations/022-orrery-systems.test.ts
  - src/db/migrations/full-chain.test.ts
  - src/db/orrery-satellites-read.test.ts
  - src/db/orrery-system-read.test.ts
  - src/db/systems-dao.test.ts
  - src/logic/system-rule-resolver.test.ts
  - src/logic/orrery-focus-logic.test.ts
  - src/screens/SystemsManagementScreen.test.tsx
  - src/screens/SystemBuilderScreen.test.tsx
  - src/stores/orrery-preferences-store.test.ts
  - src/stores/orrery-system-store.test.ts
findings:
  critical: 0
  warning: 1
  info: 0
  total: 1
status: issues_found
---

# Phase 30: Code Review Report

**Reviewed:** 2026-09-08T23:36:28Z
**Depth:** deep
**Files Reviewed:** 61
**Status:** issues_found

## Summary

This final gate review traced the live Orrery Systems subsystem beyond the phase diff: migrations, all Systems readers/writers, selection persistence, contact purge/merge interactions, snapshot consumers, resolver, stores, management/builder UI, and backup boundary. The earlier custom-System action/satellite, active-selection Undo, and management-refresh issues are fixed in the current implementation. SQL runtime inputs are bound, local-only reads remain local, and the forward-only migration chain registers the selection revision correctly.

Focused System/Orrery validation passed: 14 suites / 191 tests, TypeScript, the color gate, and Biome checks on the affected implementation all passed. One recovery-path robustness defect remains.

## Narrative Findings (AI reviewer)

## Warnings

### WR-01: System Undo cannot recover when a snapshotted override contact was purged or merged

**Classification:** WARNING

**Files:** `src/db/systems-dao.ts:489-536`, `src/db/migrations/022-orrery-systems.ts:33-42`, `src/db/purge-dao.ts:337-345`, `src/db/merge-dao.ts:212-214`

**Issue:** Deleting a System snapshots its override `contactId`s. If one of those contacts is then permanently purged or absorbed by a merge before the user taps the six-second Undo action, the `system_overrides.contact_id` foreign key has already cascaded away. `restoreDeletedSystemCore()` blindly inserts every snapshotted override, so the first missing contact makes SQLite reject the entire restore transaction. The System, its rules, its preferences, and even still-valid overrides consequently remain deleted, despite the user choosing Undo. The UI reports a generic failed undo, but it can safely restore all non-orphaned System state.

**Fix:** Before replaying snapshot overrides inside `restoreDeletedSystemCore()`, query the surviving contact IDs in one bound `IN (...)` read and insert only overrides whose contacts remain. Keep restore atomic for the System/rules/prefs and valid overrides; optionally expose a specific message that some obsolete member overrides were dropped. Add DAO tests covering both an archived-and-purged contact and a merged contact between delete and Undo.

---

_Reviewed: 2026-09-08T23:36:28Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: deep_
