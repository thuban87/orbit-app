---
phase: 38-your-week
plan: 02
subsystem: database
tags: [sqlite, migrations, backup, localization, aggregation]
requires:
  - phase: 32-history-insights
    provides: HistoryWindow and heatmap date geometry
  - phase: 36-ai-configuration
    provides: portable-settings emission and format-6 backup policy
provides:
  - Locale-aware Rolling 7 and Calendar Week window geometry
  - Durable and portable Your Week period preference at schema 30 / backup format 7
  - App-wide Your Week metrics, activity date counts, and day detail reads
affects: [38-05, 38-06, digest, settings, backup]
actuals:
  tokens: 23144
  tasks: 4
  commits: 9
tech-stack:
  added: []
  patterns: [bound static aggregate SQL, parent-level group-event activity units]
key-files:
  created:
    - src/services/history/week-window.ts
    - src/db/migrations/030-your-week-period.ts
    - src/db/your-week-read.ts
  modified:
    - src/db/database.ts
    - src/db/app-settings-dao.ts
    - src/backup/backup-schema.ts
    - src/backup/types.ts
key-decisions:
  - "Confirmed migration 030 and backup format 7 mechanics before either one-way-door write."
  - "Headline interactions count qualifying child rows, while heatmap/day activity counts each Group Event parent once."
  - "Group Events remain activity even when all participant contacts are archived; archival filters contact identity only."
patterns-established:
  - "Your Week period geometry is centralized in buildYourWeekWindow; runtime locale lookup is isolated in resolveFirstWeekday."
  - "Group Event aggregate reads count parent rows directly and never expand children into activity units."
requirements-completed: [S-10, S-11, S-12]
coverage:
  - id: D1
    description: Rolling 7 and locale-aware Calendar Week boundaries
    requirement: S-10
    verification:
      - kind: unit
        ref: src/services/history/week-window.test.ts
        status: pass
    human_judgment: false
  - id: D2
    description: Migration 030 persistence and format-7 backup portability
    requirement: S-12
    verification:
      - kind: integration
        ref: src/db/migrations/030-your-week-period.test.ts and src/backup/orrery-preferences-portability.test.ts
        status: pass
    human_judgment: false
  - id: D3
    description: Group-deduplicated app-wide Your Week metrics and day activity
    requirement: S-11
    verification:
      - kind: integration
        ref: src/db/your-week-read.test.ts
        status: pass
    human_judgment: false
duration: 1h28m
completed: 2026-09-19
status: complete
---

# Phase 38 Plan 02: Your Week Data Foundation Summary

**Locale-aware week geometry, schema-30 period persistence, format-7 portability, and group-deduplicated app-wide activity reads now form the Digest data contract.**

## Performance

- **Duration:** 1h 28m
- **Started:** 2026-09-19T05:17:38Z
- **Completed:** 2026-09-19T06:45:49Z
- **Tasks:** 4
- **Files modified:** 22

## Accomplishments

- Added deterministic Rolling 7 and locale Calendar Week windows, including Expo's 1-based to JavaScript's 0-based weekday conversion.
- Added forward-only migration 030 and wired `yourWeekPeriod` through the complete generic settings writer, read, validation, export, parse, and restore contracts.
- Bumped the portable backup wire to format 7 with a format-6 default-injection migration and strict malformed-value rejection.
- Added read-only app-wide metrics, deduplicated date counts, and day-detail records with archived-contact and standalone Group Event semantics covered by tests.

## Task Commits

1. **Task 1: Week-window builder** — `40cfbd2` (RED), `9613c07` (GREEN)
2. **Task 2: Migration and settings persistence** — `a99bb2d` (RED), `150a48c` (GREEN)
3. **Task 3: Backup portability** — `03dce6e` (RED), `25a02ac` (GREEN)
4. **Task 4: App-wide reads** — `c8b9e29` (RED), `ea6b3d1` (GREEN)
5. **Regression fixture correction** — `cc6f9f5`

## Files Created/Modified

- `src/services/history/week-window.ts` — period window builder and device-locale resolver.
- `src/db/migrations/030-your-week-period.ts` — additive `app_settings.your_week_period` migration.
- `src/db/app-settings-dao.ts` — complete durable and portable preference contract.
- `src/backup/backup-schema.ts` — format-6 forward migration, allowlist, and parse validation.
- `src/db/your-week-read.ts` — async-only aggregate and day-detail queries.
- Co-located migration, settings, backup, notification-fixture, and aggregate tests cover the new schema/wire head.

## Decisions Made

- Followed the confirmed mechanics exactly: schema version 30, backup format 7, no relationship-domain schema, and no persisted Digest cache.
- Preserved the plan's two unit families: child-inclusive headline interaction counts and parent-deduplicated activity counts.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Advanced two current-schema notification test fixtures to migration 030**
- **Found during:** Overall full-suite verification
- **Issue:** The fixtures stopped at migration 029, so `getAppSettings()` correctly failed on their intentionally stale schema after the new required column landed.
- **Fix:** Registered migration 030 and target version 30 in both notification scheduler fixtures.
- **Files modified:** `src/services/notifications/notification-schedule.test.ts`, `src/services/notifications/digest-schedule.test.ts`
- **Verification:** Both suites pass (38 tests).
- **Committed in:** `cc6f9f5`

**2. [Rule 3 - Blocking] Advanced the restore integration fixture to migration 030**
- **Found during:** Task 3 backup regression verification
- **Issue:** The restore fixture stopped at migration 029 while exercising the current settings DAO.
- **Fix:** Included migration 030 and target version 30 in the fixture.
- **Files modified:** `src/backup/restore-apply.test.ts`
- **Verification:** Restore and portability suites pass (119 focused tests).
- **Committed in:** `25a02ac`

**Total deviations:** 2 auto-fixed blocking fixture updates. No product or architectural scope changed.

## Issues Encountered

- The complete repository run still encounters the pre-existing `orrery-controls-render.test.tsx` Node transform error (`Unexpected token 'typeof'`). Phase-targeted suites, TypeScript, and color checks are green; this plan does not touch that UI/render test subsystem.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plans 05/06 can consume `buildYourWeekWindow`, `readYourWeekMetrics`, `readYourWeekDateCounts`, and `readYourWeekDay` directly.
- The Settings surface can persist `yourWeekPeriod`; backup export and restore already preserve it.

## Self-Check: PASSED

- All three created production files exist.
- All nine task/deviation commits exist in local git history.
- Targeted verification: 165 tests passed; backup regression gate: 297 tests passed; notification fixture gate: 38 tests passed; TypeScript and color checks passed.

---
*Phase: 38-your-week*
*Completed: 2026-09-19*
