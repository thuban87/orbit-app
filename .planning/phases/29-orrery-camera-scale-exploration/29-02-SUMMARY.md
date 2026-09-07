---
phase: 29-orrery-camera-scale-exploration
plan: "02"
subsystem: database
tags: [orrery, sqlite, zustand, preferences, backup, tdd]
requires:
  - phase: 29-01
    provides: Canonical SQLite scene and Orrery screen
provides:
  - Migration 021 and validated durable density, satellites and last-System preferences
  - Commit-before-publish preference store and reachable top-right View options panel
  - Optional restore acceptance with current format-4 export omission
affects: [29-03, 29-04, 29-06, 29-10, 29-11, 29-12, 36]
tech-stack:
  added: []
  patterns: [serialized preference intent, generation-guarded hydration, optional portable keys]
key-files:
  created:
    - src/db/migrations/021-orrery-preferences.ts
    - src/db/orrery-preferences.test.ts
    - src/stores/orrery-preferences-store.ts
    - src/stores/orrery-preferences-store.test.ts
    - src/components/orrery/OrreryViewOptions.tsx
    - src/backup/orrery-preferences-portability.test.ts
  modified:
    - src/db/database.ts
    - src/db/app-settings-dao.ts
    - src/db/app-settings-dao.test.ts
    - src/db/migrations/full-chain.test.ts
    - src/screens/OrreryScreen.tsx
    - src/services/orrery-scene.ts
    - src/services/orrery-scene.test.ts
    - src/services/notifications/digest-schedule.test.ts
    - src/services/notifications/notification-schedule.test.ts
    - src/backup/backup-schema.ts
key-decisions:
  - Phase 29 uses its own additive migration 021; no shipped migration changes or camera persistence.
  - System tokens use closed builtin identities or category UID payloads of 1–256 non-whitespace/control characters; existence resolves later, with no category FK.
  - Optional preference restore acceptance is live; current snapshot/export emission and format 4 remain unchanged for Phase 36.
requirements-completed: []
requirements-progressed: [ORRC-05, ORRC-13]
coverage:
  - id: D1
    description: Forward upgrades, rollback, validated ordinary/core writes and retained existing settings
    verification:
      - kind: integration
        ref: src/db/orrery-preferences.test.ts
        status: pass
    human_judgment: false
  - id: D2
    description: Serialized saves, defaults, guarded hydration, retained committed selection and retry intent
    verification:
      - kind: unit
        ref: src/stores/orrery-preferences-store.test.ts
        status: pass
      - kind: integration
        ref: src/services/orrery-scene.test.ts
        status: pass
    human_judgment: false
  - id: D3
    description: Optional restore acceptance in Merge and Replace-all without changing current export
    verification:
      - kind: integration
        ref: src/backup/orrery-preferences-portability.test.ts
        status: pass
    human_judgment: false
  - id: D4
    description: Native View options reachability, text reflow and TalkBack focus restoration
    verification: []
    human_judgment: true
    rationale: Native UI verification remains scheduled for the existing end-of-phase human check.
duration: 18min
completed: 2026-09-07
status: complete
actuals:
  tokens: 15334
  tasks: 3
  commits: 8
---

# Phase 29 Plan 02: Durable Orrery Preferences Summary

**SQLite-backed density, satellite and last-System choices now have validated writes, retryable controls and optional restore acceptance without changing current exports.**

## Performance

- Started: 2026-09-07T07:51:30Z; completed: 2026-09-07T08:09:00Z.
- Three tasks; sixteen source/test files changed.
- Actuals: ceil(61,335 realized source-diff characters / 4) = 15,334; seven task/fix commits plus one closeout commit.

## Accomplishments

- Verified migration directory/registry and TARGET_VERSION agreed at 20 before editing. Independent migration 021 adds constrained density (`balanced`), satellite flag (`0`) and last System (`builtin:all-contacts`) defaults. Runner owns the atomic DDL/user_version transaction. Existing settings, sun and ranks survive the upgrade.
- Public and restore-core settings writers share closed validators and bound parameters. SQL checks density/toggle and System length; DAO validation supplies the complete builtin/category UID grammar. No System-existence FK or durable camera/focus state was added.
- Replaced the first task's inline saved-density action with `OrreryViewOptions`: top-right trigger, scrollable panel, Spacious/Balanced/Compact ordering, explicit selection and Off/On state, wrapping help, busy controls, error/retry messages, dedicated `orrery-view-options` transient and accessibility focus restoration.
- Preference reads fail distinctly from optional omission. Only committed saves publish selections; conflicting changes serialize, duplicate/unchanged choices are no-ops, delayed hydration cannot overwrite newer writes, and failures retain saved values plus retry intent.
- `OrrerySceneSnapshot.preferences` carries the durable choices into scene/presentation input, and screen changes reload the local snapshot. Tests preserve contact membership across preference changes.
- Backup accepts the three optional keys and applies them through real Merge/Replace-all. Omission preserves existing choices. Current `getPortableSettingsSnapshot` and export omit them, camera/focus and secrets; BACKUP_FORMAT_VERSION remains 4.

## Task Commits

1. Task 29-02-01 RED — `8b147cc`: migration/default/preservation/rollback/validation tests.
2. Task 29-02-01 GREEN — `2a4c051`: migration 021, DAO shapes/validators and reachable saved density.
3. Task 29-02-02 RED — `20b4e79`: asynchronous hydration/save/retry specification.
4. Task 29-02-02 GREEN — `9736871`: preference store, panel and scene input wiring.
5. Task 29-02-03 RED — `e6839ab`: restore acceptance and unchanged-export tests.
6. Task 29-02-03 GREEN — `b040516`: portable allowlist and shared validation.
7. Regression follow-up — `132da2c`: update current-schema fixtures and preserve saved-choice no-op after failure.

All task commits are local on the existing main branch, with hooks enabled. No tracked files were deleted; unrelated dirty files were preserved.

## Exported Contracts

- `app-settings-dao.ts`: `OrreryDensity`, `ORRERY_DENSITIES`, `OrrerySystemId`, `ORRERY_BUILTIN_SYSTEM_IDS`, `assertOrreryDensity(field, value): void`, `assertOrreryLastSystem(field, value): void`. Builtins are `builtin:all-contacts`, `builtin:favorites`, `builtin:needs-attention`, `builtin:not-contacted`, `builtin:snoozed`, `builtin:chargers`.
- `AppSettings` requires `orreryDensity`, `orrerySatellitesEnabled: 0 | 1`, `orreryLastSystem`. `PortableSettingsSnapshot` exposes the same keys optionally, and `AppSettingsPatch` accepts them.
- `orrery-preferences-store.ts`: `OrreryPreferences { density, satellitesEnabled, lastSystem }`, `DEFAULT_ORRERY_PREFERENCES`, `OrreryPreferencesState`, `createOrreryPreferencesStore(adapters?)`, `useOrreryPreferencesStore`.
- Store state: `committed`, `hydrated`, `hydration: idle | loading | ready | error`, `saving`, `saveError`, `pendingIntent`. Actions: `hydrate(exec)`, `save(exec, Partial<OrreryPreferences>)`, `retry(exec)`, all returning `Promise<void>`.
- `OrreryViewOptions({ availableHeight: number })`; height is the measured canvas region.
- `OrrerySceneSnapshot.preferences: OrreryPreferences`, read from the same settings snapshot as the rest of the scene.

## Verification

- Final full `npm test`: **253 files / 2,392 tests passed**, 22.48 seconds. Log: `/tmp/orbit-29-02-tests-final.log`.
- New suites: 15 migration/DAO tests, 9 store tests, 27 portability tests. Existing scene suite now has 9 tests including preference-to-scene wiring; settings suite has 81 tests.
- `npx tsc --noEmit`, `npm run check:colors`, targeted Biome and `git diff --check` passed.
- RED gates failed for absent migration/contracts and rejected new portable keys before implementation. Existing preservation assertions were already green as expected.
- Context7 tools and CLI were unavailable; consulted the official Zustand create API documentation: https://zustand.docs.pmnd.rs/reference/apis/create . No package installation.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Add the actual scene preference input seam.**
- Task 2 required scene/presentation wiring but omitted the existing scene module from its files list. Added `preferences` to its real snapshot and a real-SQL consumer test (`9736871`). No new service or architectural layer.

**2. [Rule 3 - Blocking] Bring current-schema fixtures to migration 021.**
- The enlarged settings reader exposed old fixtures pinned at 20. Updated the typed DAO expectations, full-chain registration assertion and two notification fixtures (`9736871`, `132da2c`). Initial full regression had 33 failures in those three remaining fixtures; final full regression passed. No notification production logic changed.

**3. [Rule 1 - Bug] Keep saved-choice re-selection a no-op after a failed change.**
- Retry intent previously made the saved value look like a conflicting queued request even with no write in flight. Idle saved selections now leave SQLite and retry intent untouched; active conflicting reversals still serialize (`132da2c`).

## Remaining Phase Work

- GSD progress update declined its truncated phase scope; plan position advanced to 3 of 12. The roadmap helper incorrectly counted `29-PLAN-CHECK.md` as a thirteenth plan; removed that generated checkbox and restored the actual 2/12 count.

- Density spacing/Home geometry is intentionally owned by 29-04; satellite rendering/eligibility by 29-10; System selection by 29-03 and lifecycle by 29-11. This plan supplies live durable input, not those later render algorithms.
- ORRC-05 and ORRC-13 remain pending at requirement level because their other implementing plans are incomplete.
- Native Skia/gesture claims, panel placement/text scaling/TalkBack and phone calibration remain pending for Plan 12/end-of-phase verification. No device action was performed here.
- Phase 36 owns coordinated preference emission/versioning. No auth gates, new network paths, or security surfaces beyond the planned local settings/restore boundary.

## Self-Check: PASSED

All six created source/test artifacts exist; all seven task/fix commits exist in git. Final automated verification passed and the summary is written on disk.
