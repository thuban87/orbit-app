---
phase: 30-orrery-systems
fixed_at: 2026-09-08T18:28:56-05:00
review_path: .planning/phases/30-orrery-systems/30-REVIEW.md
iteration: 5
findings_in_scope: 3
fixed: 3
skipped: 0
status: all_fixed
---

# Phase 30: Code Review Fix Report

**Fixed at:** 2026-09-08T18:28:56-05:00
**Source review:** `.planning/phases/30-orrery-systems/30-REVIEW.md`
**Iteration:** 5

**Summary:**

- Findings in scope: 3
- Fixed: 3
- Skipped: 0

## Fixed Issues

### CR-01: Custom Systems throw instead of supporting member actions and satellites

**Files modified:** `src/db/orrery-action-read.ts`, `src/db/orrery-satellites-read.ts`, `src/logic/orrery-focus-logic.test.ts`, `src/db/orrery-satellites-read.test.ts`
**Commit:** e4eb743
**Applied fix:** Custom action and satellite reads now resolve the definition's current rule-and-override membership inside their existing snapshot, while built-in and Category reads retain their bound SQL predicates. Custom focus, Profile, group, nonmember-sun validation, satellites, manual includes, rule-derived members, and historical broken-rule passthrough have deterministic coverage.

### CR-02: Undo overwrites a newer user System selection

**Files modified:** `src/db/migrations/023-orrery-system-selection-revision.ts`, `src/db/app-settings-dao.ts`, `src/db/systems-dao.ts`, `src/stores/orrery-preferences-store.ts`, `src/stores/orrery-system-store.ts`, `src/screens/OrreryScreen.tsx`, `src/components/orrery/OrrerySystemSelector.tsx`, `src/components/orrery/OrreryContactsSheet.tsx`, and focused tests
**Commit:** e4eb743
**Applied fix:** Migration 023 adds an internal selection revision. Deletion returns its fallback revision, and Undo restores the old custom selection only when both the fallback token and revision are still current in the same transaction. Explicit selections, including a re-selection of All Contacts, force a durable revision. Tests preserve newer built-in, Category, custom, and explicit-All-Contacts selections.

### WR-01: Management refreshes can publish an older durable snapshot after a later mutation

**Files modified:** `src/screens/SystemsManagementScreen.tsx`, `src/screens/SystemsManagementScreen.test.tsx`
**Commit:** e4eb743
**Applied fix:** Every management load receives a monotonic request guard; rows and read errors publish only while both that request and the operation guard remain current. Delete/Undo refreshes pass their real operation predicate rather than a forced-true predicate. Undo errors now distinguish a name conflict from a generic failed restore.

## Verification

Verification ran in the main checkout (`workflow.use_worktrees: false`).

- `npx vitest run src/logic/orrery-focus-logic.test.ts src/db/orrery-satellites-read.test.ts src/db/systems-dao.test.ts src/screens/SystemsManagementScreen.test.tsx src/stores/orrery-preferences-store.test.ts src/stores/orrery-system-store.test.ts src/db/migrations/full-chain.test.ts` — 7 files, 76 tests passed.
- `npx tsc --noEmit --pretty false` — passed.
- `npm run check:colors` — passed.
- `npx biome check` on all 18 touched source/test/migration files — passed.

---

_Fixed: 2026-09-08T18:28:56-05:00_
_Fixer: the agent (gsd-code-fixer)_
_Iteration: 5_
