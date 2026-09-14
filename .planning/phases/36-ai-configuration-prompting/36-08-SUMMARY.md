---
phase: 36-ai-configuration-prompting
plan: 08
subsystem: backup
tags: [sqlite, backup, restore, portability, crash-consistency, profile-backgrounds]

requires:
  - phase: 36-ai-configuration-prompting
    provides: AI configuration, prompting, profile presentation, and all preceding Phase 36 storage contracts
provides:
  - Complete v5 portable preference and entity inventory with a v4-to-v5 upgrader
  - UID-remapped merge and replace-all restore for the full Phase 36 entity graph
  - Crash-consistent profile background-byte restore and launch reconciliation
affects: [backup-restore, app-settings, profile-presentation, ai-configuration]

actuals:
  tokens: 33488
  tasks: 7
  commits: 8

tech-stack:
  added: []
  patterns:
    - Portable references use stable UIDs and are remapped to local rowids during restore
    - Background bytes stage before SQL commit and persist canonically after commit

key-files:
  created: []
  modified:
    - src/backup/types.ts
    - src/backup/backup-schema.ts
    - src/backup/export-manifest.ts
    - src/backup/reconciliation.ts
    - src/backup/restore-apply.ts
    - src/db/app-settings-dao.ts
    - src/services/photos/background-storage.ts
    - src/services/photos/background-reconcile-sweep.ts
    - docs/systems/backup-restore.md
    - docs/systems/profile.md

key-decisions:
  - "Backup format v5 carries the complete milestone preference and entity graph and upgrades v4 exactly once."
  - "Profile background restore uses UID-keyed pending files and post-commit canonical persistence; restore_photo_journal remains unchanged."
  - "Missing Group Event parents repair interactions to ordinary contact history instead of dropping them."

patterns-established:
  - "Portable identity: every cross-device relationship is serialized by UID, never SQLite rowid."
  - "Background crash recovery: reconcile swap sidecars first, then re-list and re-drive committed UID-keyed pending bytes."

requirements-completed: [AICFG-16, AICFG-17]

coverage:
  - id: D1
    description: "Backup format v5 roundtrips the complete Phase 36 settings and entity graph, including v4 upgrade compatibility and rowid remapping."
    requirement: AICFG-16
    verification:
      - kind: integration
        ref: "npx vitest run src/backup/backup-schema.test.ts src/backup/export-manifest.test.ts src/backup/restore-apply.test.ts src/backup/reconciliation.test.ts src/db/app-settings-dao.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "Profile presentation backgrounds roundtrip their bytes and recover correctly across every required insert and replacement crash window."
    requirement: AICFG-17
    verification:
      - kind: integration
        ref: "npx vitest run src/services/photos/background-storage.test.ts src/services/photos/background-reconcile-sweep.test.ts src/backup/export-manifest.test.ts src/backup/restore-apply.test.ts"
        status: pass
    human_judgment: false

duration: 34min
completed: 2026-09-14
status: complete
---

# Phase 36 Plan 08: Complete Backup Format v5 Summary

**Portable backup v5 now preserves the complete Phase 36 settings and entity graph, including crash-consistent profile background bytes and deterministic v4 upgrades.**

## Performance

- **Duration:** 34 min
- **Started:** 2026-09-14T08:49:35Z
- **Completed:** 2026-09-14T09:23:52Z
- **Tasks:** 7
- **Files modified:** 22

## Accomplishments

- Expanded the portable settings snapshot to cover theme, dashboard, Orrery, profile, history, channel, compose, and non-secret AI configuration while excluding credentials and device-local state.
- Serialized and restored the complete v5 entity graph with stable-UID references, different-rowid remapping, merge/replace-all behavior, presentation rows, Group Event tombstones, and missing-parent repair.
- Made profile background image restore crash-consistent through staged bytes, post-commit atomic persistence, and launch-time re-drive/prune behavior verified across insert and replacement crash windows.
- Added the one-way v4-to-v5 manifest upgrader only after all pre-bump completeness and crash-consistency gates passed.

## Task Commits

Each task was committed atomically:

1. **Task 1: Emit the whole milestone preference inventory** - `ab37e4b` (feat)
2. **Task 2: Serialize missing entities and Profile presentation** - `55bbfbf` (feat)
3. **Task 3: Restore the complete v5 entity graph** - `24105aa` (feat)
4. **Task 4: Stage and rehydrate Profile background bytes** - `e2d635b` (feat)
5. **Checkpoint: approve irreversible bump after all gates passed** - owner-preauthorized `bump`
6. **Task 6: Bump to v5 and add the v4-to-v5 upgrader** - `9daf2f7` (feat)
7. **Task 7: Document the complete v5 boundary** - `2341444` (docs)
8. **Full-suite compatibility follow-up** - `418a6dd`, `bf9687c` (test)

## Files Created/Modified

- `src/db/app-settings-dao.ts` - Emits and restores the complete portable settings inventory.
- `src/backup/types.ts` - Declares backup format v5 and the expanded manifest surface.
- `src/backup/backup-schema.ts` - Validates v5 entities and upgrades v4 manifests.
- `src/backup/export-manifest.ts` - Serializes stable-UID entity relationships and background bytes.
- `src/backup/reconciliation.ts` - Reconciles the expanded entity inventory and repairs missing parents.
- `src/backup/restore-apply.ts` - Applies merge/replace-all restoration with rowid remapping and staged background persistence.
- `src/services/photos/background-storage.ts` - Provides UID-keyed restore-pending storage and atomic canonical persistence.
- `src/services/photos/background-reconcile-sweep.ts` - Re-drives committed pending bytes and prunes unreferenced artifacts on launch.
- `docs/systems/backup-restore.md` - Documents v5 inventory, upgrade, and crash contract.
- `docs/systems/profile.md` - Retires the former device-local presentation boundary and records portable background behavior.

## Decisions Made

- The irreversible format bump proceeded because every required emitter, writer, remap, roundtrip, presentation-byte, and crash-window gate passed.
- Group Event references that cannot resolve on restore are cleared so their interactions survive as ordinary contact history.
- Profile backgrounds do not extend `restore_photo_journal`; their canonical path is UID-derived, so a dedicated restore-pending namespace provides sufficient durable recovery evidence without a migration.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] Preserved Group Event follow-state semantics**
- **Found during:** Task 2 and Task 3 entity inventory audit
- **Issue:** Preserving Group Event interaction inheritance also requires the interaction follow-state columns, beyond the three gap columns highlighted in the plan prose.
- **Fix:** Included the follow-state values in export, validation, and restore so restored interactions retain their behavior.
- **Files modified:** `src/backup/backup-schema.ts`, `src/backup/export-manifest.ts`, `src/backup/restore-apply.ts`, tests
- **Verification:** Required 205-test backup/settings/background suite passes.
- **Committed in:** `55bbfbf`, `24105aa`

**2. [Rule 3 - Blocking integration issue] Updated composed restore test boundaries for v5 background persistence**
- **Found during:** Full repository verification after Task 7
- **Issue:** Three integration suites imported the new background restore dependency without their native-storage boundary mock; two backup-service assertions still expected v4 previews.
- **Fix:** Added background-storage mocks and updated expectations to assert v5 portable Orrery settings while retaining device-local omissions.
- **Files modified:** `src/services/backup/backup-service.test.ts`, `src/backup/orrery-preferences-portability.test.ts`, `src/backup/phase-17-integration.test.ts`, `src/services/orrery-exploration.integration.test.ts`
- **Verification:** Affected integration suites pass 44/44; repository run passes 3,499 tests with only the tracked pre-existing Phase 30 collection error.
- **Committed in:** `418a6dd`, `bf9687c`

---

**Total deviations:** 2 auto-fixed (1 Rule 2, 1 Rule 3)
**Impact on plan:** Both changes were required to preserve entity semantics and keep existing composed test boundaries compatible with the completed v5 restore path; no product or architectural scope changed.

## Issues Encountered

- The optional repository-wide suite still cannot collect `src/components/orrery/orrery-controls-render.test.tsx` because of the previously tracked `SyntaxError: Unexpected token 'typeof'`. All 366 other suites and 3,499 tests pass; the issue remains recorded in `deferred-items.md` and is unrelated to Plan 36-08.

## Known Stubs

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 36's final portable backup boundary is complete and documented.
- A v5 export can be restored through merge or replace-all without SQLite-rowid coupling, credential leakage, or background-byte crash windows.
- No Plan 36-08 blocker remains; the separate Phase 30 test-collection issue remains deferred.

## Self-Check: PASSED

All declared implementation files and all eight task/deviation commits were verified on disk and in git history.

---
*Phase: 36-ai-configuration-prompting*
*Completed: 2026-09-14*
