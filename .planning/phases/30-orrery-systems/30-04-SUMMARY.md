---
phase: 30-orrery-systems
plan: "04"
subsystem: backup
tags: [backup, restore, sqlite, orrery-systems, contract]
requires:
  - phase: 30-orrery-systems
    provides: widened custom System token grammar and persisted Systems tables
provides:
  - Restore acceptance coverage for custom System last-active tokens
  - A format-4 wire-shape trip-wire that uses the real portable-settings projection
  - Phase 36 Systems serialization and orphan-repair contract
affects: [36-ai-config, backup-restore, orrery-systems]
actuals:
  tokens: 2845
  tasks: 2
  commits: 2
tech-stack:
  added: []
  patterns:
    - Declare-only backup compatibility guard: accept a future portable setting without emitting it
    - Exact production portable-settings key-set assertions for coordinated wire changes
key-files:
  created:
    - docs/systems/orrery-systems-backup-contract.md
  modified:
    - src/backup/backup-schema.ts
    - src/backup/backup-schema.test.ts
    - src/backup/export-manifest.test.ts
key-decisions:
  - "Phase 36 exclusively owns Systems wire emission, forward migration, and the backup-format bump."
  - "The export wire-shape test calls the real portable-settings projection rather than a stale mock."
patterns-established:
  - "Systems restore acceptance is allowlisting only; manifest emission remains a separately coordinated compatibility change."
requirements-completed: [ORRS-14]
coverage:
  - id: D1
    description: Restore accepts a valid custom last-active token, rejects malformed tokens, and preserves the format-4 emitted settings shape.
    requirement: ORRS-14
    verification:
      - kind: integration
        ref: src/backup/backup-schema.test.ts#Systems restore acceptance (declare-only)
        status: pass
      - kind: integration
        ref: src/backup/export-manifest.test.ts#pins the format-4 portable-settings wire shape before Phase 36
        status: pass
    human_judgment: false
  - id: D2
    description: Phase 36 has a written Systems serialization, validation, and orphan-repair contract.
    requirement: ORRS-14
    verification:
      - kind: other
        ref: test -f docs/systems/orrery-systems-backup-contract.md && grep -c "system_overrides|system_prefs|system_rules|orrery_last_system" docs/systems/orrery-systems-backup-contract.md
        status: pass
    human_judgment: false
duration: 6min
completed: 2026-09-08
status: complete
---

# Phase 30 Plan 04: Systems Backup Contract Summary

**Custom System restore acceptance is guarded while the live format-4 backup wire remains unchanged, with Phase 36's full serialization contract recorded.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-09-08T20:38:00Z
- **Completed:** 2026-09-08T20:44:15Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Proved restored `custom:<uid>` last-active values flow through the existing closed validator, while malformed tokens fail before restore mutation.
- Replaced the export test's stale DAO mock with the real portable projection and pinned both format 4 and its exact emitted settings key set; no Systems entity is emitted.
- Documented Phase 36's Systems entities: `systems`, `system_rules`, `system_overrides`, `system_prefs`, and `app_settings.orrery_last_system`, including portable Category UIDs and orphan repair.

## Task Commits

1. **Task 1: Restore-accept custom:<uid>; prove no wire/format change** — `12e2f12` (test)
2. **Task 2: Write the Systems backup contract for Phase 36** — `38a02fd` (docs)

## Files Created/Modified

- `src/backup/backup-schema.ts` — records the declare-only custom-System restore boundary.
- `src/backup/backup-schema.test.ts` — covers valid and malformed custom System tokens.
- `src/backup/export-manifest.test.ts` — tests the actual format-4 settings projection and exact export key set.
- `docs/systems/orrery-systems-backup-contract.md` — Phase 36 serialization, validation, and orphan-repair specification.

## Decisions Made

- Phase 30 accepts future `custom:<uid>` restore values but leaves `getPortableSettingsSnapshot`, `export-manifest.ts`, `FORWARD_MIGRATIONS`, and `BACKUP_FORMAT_VERSION` untouched.
- Category rule values are portable UIDs; unresolved values remain broken, visible rules needing attention rather than being discarded or rewritten.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Full `npm test` ran 2,586 tests successfully in 280 suites; the known unrelated Flow-parser import failures remain in `src/backup/restore-apply.test.ts` and `src/stores/orrery-system-store.test.ts`. No tooling change was made to mask them.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Phase 36 can add the coordinated Systems manifest entities and orphan-repair implementation from the documented contract, then advance the format version exactly once.

## Self-Check: PASSED

- Verified all four task artifacts exist on disk.
- Verified commits `12e2f12` and `38a02fd` exist in git history.

*Phase: 30-orrery-systems*
*Completed: 2026-09-08*
