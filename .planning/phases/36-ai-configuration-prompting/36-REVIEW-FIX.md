---
phase: 36-ai-configuration-prompting
fixed_at: 2026-09-14T06:13:44-05:00
review_path: .planning/phases/36-ai-configuration-prompting/36-REVIEW.md
iteration: 3
findings_in_scope: 1
fixed: 1
skipped: 0
status: all_fixed
---

# Phase 36: Code Review Fix Report

**Fixed at:** 2026-09-14T06:13:44-05:00  
**Source review:** `.planning/phases/36-ai-configuration-prompting/36-REVIEW.md`  
**Iteration:** 3

**Summary:**

- Findings in scope: 1
- Fixed: 1
- Skipped: 0

## Fixed Issues

### CR-01: A stale reconciliation can overwrite a newer committed background session

**Files modified:** `src/services/photos/background-finalization.ts`, `src/services/photos/background-finalization.test.ts`, `src/services/photos/background-reconcile-sweep.ts`, `src/services/photos/background-reconcile-sweep.test.ts`, `src/backup/restore-apply.ts`  
**Commit:** `fe1c563`  
**Status:** fixed: requires human verification  
**Applied fix:** Added one process-local, per-template-UID finalization lock shared by restore post-commit handling and launch reconciliation. Inside the lock, the common finalizer re-reads `profile_background_templates.image_path`, requires exact ownership of the candidate's unique pending path, persists only an owning candidate to the approved `profile-backgrounds/<uid>.jpg`, compare-and-sets that exact marker to canonical in a short transaction, and deletes only that candidate. Filesystem I/O remains outside the SQLite write transaction and no transactions are nested. A stale candidate prunes itself before reaching the canonical writer. Deterministic tests cover sweep A discovering marker A and pausing while restore B commits and finalizes, followed by A resuming without overwriting B, plus overlap where B queues behind an in-flight A and restores the final bytes.

## Verification

All verification ran in the main checkout because `workflow.use_worktrees` is disabled.

- Focused background/restore/read suite: 6 files, 83 tests passed.
- Full `npx tsc --noEmit`: passed.
- `npm run check:colors`: passed.
- `git diff --check`: passed.
- Biome formatting/check completed for the shared finalizer, reconciliation, and restore files; only the restore file's pre-existing non-null-assertion warnings remain.
- `TARGET_VERSION` remains 29; no migration or background restore-photo journal was added.

---

_Fixed: 2026-09-14T06:13:44-05:00_  
_Fixer: the agent (gsd-code-fixer)_  
_Iteration: 3_
