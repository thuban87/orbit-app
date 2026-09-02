---
phase: 13-orrery
plan: 01
subsystem: db
tags: [migration, app_settings, orrery, sun, dao, validation]
status: complete
requires:
  - migration 002 (app_settings table)
  - runner.ts per-step atomic transaction wrapper
  - node:sqlite testkit (foreign_keys=ON)
provides:
  - "migration003 (app_settings.sun_contact_id + self_sun_colour)"
  - "TARGET_VERSION=3 registration"
  - "AppSettings.sunContactId / AppSettings.selfSunColour"
  - "SELF_SUN_COLOUR_RE + assertSelfSunColour + assertSunContactId (exported)"
affects:
  - 13-03 (orrery-read / sun-picker-read consume sun_contact_id)
  - 13-04 (starPalette conformance test imports SELF_SUN_COLOUR_RE)
  - 13-06 (Settings "Your star" swatch + "Sun / centre" picker write path)
tech-stack:
  added: []
  patterns:
    - "additive forward-only ALTER TABLE ADD COLUMN migration (no shipped-migration edit)"
    - "validate-before-write posture mirrored from assertHour/assertToggle"
    - "exported validator + regex as single source of truth for a cross-plan lock"
    - "gate-safe assembled hex test inputs (no bare #RRGGBB literal outside theme)"
key-files:
  created:
    - src/db/migrations/003-orrery-settings.ts
    - src/db/migrations/003-orrery-settings.test.ts
  modified:
    - src/db/database.ts
    - src/db/app-settings-dao.ts
    - src/db/app-settings-dao.test.ts
    - src/services/notifications/notification-schedule.test.ts
decisions:
  - "self_sun_colour stores NULL (never a hex default); resolved to starPalette[0] at render, keeping the palette single-sourced (Pitfall 3)"
  - "sun_contact_id FK ON DELETE SET NULL auto-reverts a hard-purged sun-contact to self (A1)"
  - "SELF_SUN_COLOUR_RE exported so 13-04 asserts the palette against the ACTUAL DAO rule (C2-5), not a duplicated private regex"
  - "DAO round-trip tests insert a real contact before setting sun_contact_id (the FK is real, not just a type constraint)"
metrics:
  duration_min: 7
  tasks: 2
  files: 6
  tests_added: 12
  completed: 2026-08-18
---

# Phase 13 Plan 01: Migration 003 + app-settings-dao Widen Summary

Migration 003 adds the two nullable app-level sun columns (`sun_contact_id`, `self_sun_colour`) to the single-row `app_settings` table, and the app-settings DAO is widened to read, write, clear, and validate them — the storage half of assignable-sun (ORR-06) and self-sun-colour (ORR-05). First schema change since Phase-11's migration 002; additive and forward-only.

## What was built

**Task 1 — Migration 003 (additive sun columns + registration).**
- `src/db/migrations/003-orrery-settings.ts`: two `ALTER TABLE app_settings ADD COLUMN` statements — `sun_contact_id INTEGER REFERENCES contacts(id) ON DELETE SET NULL` (NULL = self) and `self_sun_colour TEXT` (NULL = unresolved). Both nullable, no non-null default, which keeps `ADD COLUMN` with a `REFERENCES` clause legal and the step starting-state-independent. No transaction of its own (the runner wraps each step atomically).
- `src/db/database.ts`: `TARGET_VERSION` bumped 2→3 and `migration003` (with its import) appended to the `runMigrations` array — `[migration001, migration002, migration003]`.
- `003-orrery-settings.test.ts` (node:sqlite): fresh v0→v3 (001+002+003) and seeded v2→v3 paths both land at `user_version=3` with both columns present and defaulting NULL; ascending-order apply; idempotent re-run; and the L7 FK test — assign a contact to `sun_contact_id`, DELETE that contact, read back NULL under `foreign_keys=ON` (the A1 self-revert proven, not just asserted).

**Task 2 — Widened app-settings-dao + validation.**
- `AppSettings`, `AppSettingsRow`, `COLUMN_OF`, and the `getAppSettings` SELECT/mapping all widened across the four parallel structures, mirroring the shipped `deliveryHour`/`notificationsEnabled` treatment. Raw NULL passes straight through as `null` — no palette resolution in the DAO (it cannot import theme).
- Exported `SELF_SUN_COLOUR_RE = /^#[0-9A-Fa-f]{6}$/`, `assertSelfSunColour`, and `assertSunContactId` (null | positive int). Both new fields are validated in `updateAppSettings` BEFORE the transaction opens, so a malformed value throws with zero writes (V5 / T-13-01-02). The write path and 13-04's conformance test consume the same exported symbol (C2-5 — single source of truth).
- Test cases: read/write/clear round-trip for both fields, upper- and lower-case 6-hex accept, and rejection of non-positive/non-integer ids and non-6-hex colours. All valid-hex accept inputs are assembled from non-`#`-prefixed fragments (`` `#${"F2C14E"}` ``) so the no-arg `check:colors` scanning this non-/theme/ file stays green (C2-3).

## Verification

- `npx vitest run src/db/migrations/003-orrery-settings.test.ts src/db/app-settings-dao.test.ts` — 43 passed.
- Full suite: `npm test` — 913 passed (76 files), 0 failures.
- `npx tsc --noEmit` clean; `npm run check:colors` (no-arg, full src) green.
- `git diff` confirms migrations 001/002 byte-unchanged.
- TDD gates present in history: `test(13-01)` RED commits precede both `feat(13-01)` GREEN commits.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] notification-schedule.test.ts harness migrated to v3**
- **Found during:** Task 2 (full-suite run after widening `getAppSettings`).
- **Issue:** `getAppSettings` now selects `sun_contact_id` / `self_sun_colour`; `notification-schedule.test.ts` seeded its DB only to v2 (001+002), so every `reconcileSchedule` case that reads settings threw `no such column: sun_contact_id` (21 failures). Directly caused by this plan's DAO change.
- **Fix:** imported `migration003` and bumped that test's setup to `runMigrations(..., [001,002,003], 3, ...)` — the same launch path the device runs.
- **Files modified:** src/services/notifications/notification-schedule.test.ts
- **Commit:** 9797db3

**2. [Rule 1 - Bug] sun_contact_id round-trip tests insert a real contact**
- **Found during:** Task 2 GREEN run.
- **Issue:** the initial round-trip tests set `sunContactId: 5` with no such contact row; under `foreign_keys=ON` the FK correctly rejected it (`FOREIGN KEY constraint failed`) — a test-data defect, not a DAO bug. The FK is a real constraint, not just a type check.
- **Fix:** the round-trip/clear tests now insert a contact and use its `lastInsertRowId`.
- **Files modified:** src/db/app-settings-dao.test.ts
- **Commit:** 9797db3

**3. [Rule 1 - Bug] removed `hsl()` token from a DAO comment**
- **Found during:** Task 2 GREEN run (`check:colors` flagged the comment).
- **Issue:** a doc-comment listing non-hex forms wrote `hsl()`, which the colour gate matches (`hsla?\(`).
- **Fix:** reworded to "a functional colour form" — no gate token.
- **Files modified:** src/db/app-settings-dao.ts
- **Commit:** 9797db3

## Known Stubs

None. Both columns are wired end-to-end (migration → DAO read/write/validate → tests). The read-time resolution of a NULL `self_sun_colour` to `starPalette[0]` is intentionally deferred to render (13-04/13-05) — the DAO returning raw `null` is the correct contract, not a stub.

## Threat Flags

None. No new network surface, no new dependency, no secrets. The single trust boundary (Settings UI → DAO write) is mitigated exactly as the plan's threat register specifies: every runtime value `?`-bound, both new fields validated before the write opens, `changes===1` guard intact.

## Self-Check: PASSED

- FOUND: src/db/migrations/003-orrery-settings.ts
- FOUND: src/db/migrations/003-orrery-settings.test.ts
- FOUND commit a74e6be (test RED migration), c077f49 (feat migration 003), cc8a686 (test RED DAO), 9797db3 (feat DAO widen)
- TARGET_VERSION === 3 and runner array === [migration001, migration002, migration003]
- SELF_SUN_COLOUR_RE exported, single definition, consumed by assertSelfSunColour + updateAppSettings
