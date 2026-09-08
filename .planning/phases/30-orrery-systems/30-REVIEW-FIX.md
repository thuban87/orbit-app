---
phase: 30-orrery-systems
fixed_at: 2026-09-08T17:25:52-05:00
review_path: .planning/phases/30-orrery-systems/30-REVIEW.md
iteration: 1
findings_in_scope: 4
fixed: 4
skipped: 0
status: all_fixed
---

# Phase 30: Code Review Fix Report

**Fixed at:** 2026-09-08T17:25:52-05:00
**Source review:** `.planning/phases/30-orrery-systems/30-REVIEW.md`
**Iteration:** 1

**Summary:**

- Findings in scope: 4
- Fixed: 4
- Skipped: 0

## Fixed Issues

### CR-01: Active-System deletion is not atomic with its required fallback

**Files modified:** `src/db/systems-dao.ts`, `src/db/systems-dao.test.ts`, `src/screens/SystemsManagementScreen.tsx`, `src/screens/SystemsManagementScreen.test.tsx`
**Commit:** e047163
**Status:** fixed: requires human verification
**Applied fix:** Added a single DAO transaction that validates the stored active System, deletes the custom System, falls back to All Contacts when needed, and advances `data_revision` once. The screen offers Undo only after that commit and refreshes its preference cache afterward.

### CR-02: Undo can restore data but fail to restore the active selection

**Files modified:** `src/db/systems-dao.ts`, `src/db/systems-dao.test.ts`, `src/screens/SystemsManagementScreen.tsx`, `src/screens/SystemsManagementScreen.test.tsx`
**Commit:** c3b97b9
**Status:** fixed: requires human verification
**Applied fix:** Added the symmetric restore-and-selection DAO transaction. A failed restore now rolls back both data and selection; post-commit refresh failures report accurately rather than claiming the restore conflicted.

### WR-01: DAO accepts invalid System rule vocabulary despite the closed-rule contract

**Files modified:** `src/db/systems-dao.ts`, `src/db/systems-dao.test.ts`
**Commit:** 2929034
**Applied fix:** Centralized System rule vocabulary and Category UID validation before rule replacement, definition saves, and restored snapshots. Existing syntactically valid missing Category UIDs remain representable as documented broken rules.

### WR-02: Preview membership markers are not available to assistive technology

**Files modified:** `src/components/orrery/SystemPreviewCanvas.tsx`, `src/components/orrery/system-preview-logic.ts`, `src/components/orrery/system-preview-logic.test.ts`, `src/screens/SystemBuilderScreen.tsx`
**Commit:** 7856a07
**Applied fix:** Made the Skia canvas decorative and added named, selected-state Preview member controls that use the same focus handler. The live announcement now names the focused member.

## Verification

Verification ran in the main checkout (`workflow.use_worktrees: false`).

- `npx vitest run src/db/systems-dao.test.ts src/screens/SystemsManagementScreen.test.tsx src/components/orrery/system-preview-logic.test.ts src/screens/SystemBuilderScreen.test.tsx` — 4 files, 30 tests passed.
- `npx tsc --noEmit` — passed.
- `npx biome check` on all modified source and test files — passed.
- `npm run check:colors` — passed.

---

_Fixed: 2026-09-08T17:25:52-05:00_
_Fixer: the agent (gsd-code-fixer)_
_Iteration: 1_
