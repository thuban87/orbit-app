---
phase: 23-theme-visual-system
plan: 01
subsystem: theme
tags: [theme, sqlite, migration, app_settings, backup, zustand, boot, restore-before-paint]

# Dependency graph
requires:
  - phase: 22-app-shell-navigation
    provides: App.tsx boot ready gate + openAndMigrate lifecycle
  - phase: 13-orrery
    provides: self_sun_colour nullable/NULL-resolved-at-render idiom (accent/background copy this)
  - phase: 18.1-04
    provides: phoneRegionOverride deferred-emission precedent (OPTIONAL type field + no SELECT/return)
provides:
  - migration 015 — seven durable app_settings theme columns (theme_package + per-package galaxy_*/standard_* mode/accent/background), TARGET_VERSION 15
  - app-settings-dao theme writer contract (validators assertThemePackage/assertThemeMode/assertAccentId/assertBackgroundId, COLUMN_OF, getAppSettings read)
  - theme-option-ids.ts single canonical ACCENT_IDS/BACKGROUND_SLOT_IDS source (Plans 03/06 import this)
  - package-axis theme layer (galaxy = former space-dark verbatim, standard placeholder); resolvePalette(package, mode)
  - orbit-theme one-time envelope import + hydrate-theme-at-boot DI coordinator folded into the boot ready gate (restore-before-paint)
  - 7 theme keys allowlisted in PORTABLE_SETTINGS_KEYS (emission deferred to Phase 36)
affects: [23-03 accents, 23-06 backgrounds, 36 AI config / backup v4, theme-store consumers, Settings screen]

actuals:
  tokens: 18764
  tasks: 1
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Single-source option-id constants (theme-option-ids.ts) consumed by DAO validators via .includes(), mirroring AI_PROVIDER_IDS"
    - "Dependency-injected boot coordinator (hydrateThemeAtBoot) owning no React — node-testable idempotency + error isolation without react-test-renderer"
    - "Compare-before-write DIFF gating (not patch-non-empty) so a repeat legacy import performs zero writes"

key-files:
  created:
    - src/db/migrations/015-theme-settings.ts
    - src/theme/theme-option-ids.ts
    - src/theme/orbit-theme-migration.ts
    - src/theme/hydrate-theme-at-boot.ts
  modified:
    - src/db/app-settings-dao.ts
    - src/db/database.ts
    - src/backup/backup-schema.ts
    - src/theme/theme-types.ts
    - src/theme/theme-presets.ts
    - src/theme/theme-provider.tsx
    - src/stores/theme-store.ts
    - App.tsx

key-decisions:
  - "Task 1 (owner-resolved checkpoint): migration-015 shape = nullable accent-id + NOT-NULL-default enums; one-time orbit-theme import then clear (recommended option). No hex in the migration."
  - "galaxy_accent/standard_accent + galaxy_background/standard_background are nullable TEXT option-ids (NULL = package default at RENDER) — no colour hex ever enters the schema (check:colors safe)"
  - "theme_package NOT NULL DEFAULT 'galaxy' CHECK(galaxy|standard); galaxy_mode/standard_mode NOT NULL DEFAULT 'system' CHECK(light|dark|system) — a v0->v15 device lands Galaxy + Follow-System with no code branch"
  - "7 theme keys allowlisted + DAO-writable NOW but EMISSION deferred to Phase 36's format-4 plan (OPTIONAL PortableSettingsSnapshot fields, NOT added to getPortableSettingsSnapshot SELECT); BACKUP_FORMAT_VERSION stays 3, no FORWARD_MIGRATIONS entry — format-3 wire stays byte-identical"
  - "DEFAULT_PRESET_ID kept as the exported name (value now 'galaxy') so widget-colors.ts (ADR-042 headless consumer) compiles unchanged across the package re-key"
  - "orbit-theme mapper unwraps the zustand persist ENVELOPE (parsed.state), NOT the top level — the pre-fix top-level read is undefined on every real device"

patterns-established:
  - "Single canonical option-id source: theme-option-ids.ts exports ACCENT_IDS/BACKGROUND_SLOT_IDS; DAO validators consume via .includes(); Plans 03/06 import the same arrays (no parallel id lists)"
  - "Boot restore-before-paint: openAndMigrate -> hydrateThemeAtBoot -> store hydrate -> setReady, so the first main frame carries the saved palette"
  - "Compare-before-write idempotent legacy import: diff mapped legacy values against committed settings; write ONLY the non-empty diff so a failed clear never bumps data_revision"

requirements-completed: [THEME-01, THEME-03, THEME-13]

coverage:
  - id: D1
    description: "Migration 015 adds the seven theme columns additively; a fresh v0->v15 lands seeded (galaxy/system, accent/background NULL); full chain reaches v15"
    requirement: THEME-13
    verification:
      - kind: unit
        ref: "src/db/migrations/015-theme-settings.test.ts"
        status: pass
      - kind: unit
        ref: "src/db/migrations/full-chain.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "DAO round-trips each package's own mode/accent/background typed; invalid enum/accent/background rejected before UPDATE; validators bound to the exported single-source arrays"
    requirement: THEME-03
    verification:
      - kind: unit
        ref: "src/db/app-settings-dao.test.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "Backup deferral: 7 theme keys in PORTABLE_SETTINGS_KEYS but omitted from a format-3 export's appSettings; BACKUP_FORMAT_VERSION still 3, no new FORWARD_MIGRATIONS entry"
    requirement: THEME-13
    verification:
      - kind: unit
        ref: "src/backup/export-manifest.test.ts"
        status: pass
      - kind: unit
        ref: "src/db/app-settings-dao.test.ts#allowlists all seven theme keys but does NOT emit them"
        status: pass
    human_judgment: false
  - id: D4
    description: "orbit-theme envelope mapper: real persist envelope space-dark/dark -> galaxy+galaxyMode dark; reads parsed.state not top level; unknown/malformed/absent -> no-op"
    verification:
      - kind: unit
        ref: "src/theme/orbit-theme-migration.test.ts"
        status: pass
    human_judgment: false
  - id: D5
    description: "Boot coordinator idempotency + error isolation: repeat import performs zero writes (compare-before-write); getItem/JSON.parse/removeItem failures each non-fatal; write-failure leaves the key intact; returns post-import settings"
    requirement: THEME-03
    verification:
      - kind: unit
        ref: "src/theme/hydrate-theme-at-boot.test.ts"
        status: pass
    human_judgment: false
  - id: D6
    description: "Package-axis theme layer: resolvePalette('galaxy','dark') and ('standard','dark') return distinct palettes; galaxy == former space-dark; widget re-key intact"
    verification:
      - kind: unit
        ref: "src/theme/theme-presets.test.ts"
        status: pass
      - kind: unit
        ref: "src/services/widget/widget-colors.test.ts"
        status: pass
    human_judgment: false
  - id: D7
    description: "On-device restore-before-paint: cold-start with a persisted non-default theme shows the saved package's palette on the first frame (no wrong-theme flash); an existing device's orbit-theme value carries mode across after one launch"
    verification: []
    human_judgment: true
    rationale: "Restore-before-paint and no-flash are UI-observable on a Pixel cold start only; node tests prove the read/import path but not the rendered first frame. Deferred to the end-of-phase device UAT."

duration: 45min
completed: 2026-09-03
status: complete
---

# Phase 23 Plan 01: Theme & Visual System — Durable theme + package axis tracer Summary

**A persisted theme package × appearance mode resolves through the provider to the on-screen palette, restored before first paint from durable `app_settings` columns (migration 015), with the legacy AsyncStorage `orbit-theme` value imported once then cleared — the phase's thin end-to-end vertical slice, proven green under node tests, check:colors, and tsc.**

## Performance

- **Duration:** ~45 min
- **Tasks:** 1 executed (Task 2 tracer); Task 1 was an owner-resolved checkpoint recorded, not re-prompted
- **Commits:** 2 (1 tracer feat + 1 docs)

## Accomplishments

- **Task 1 (checkpoint:decision, owner-resolved):** Recorded the owner's selection of the *recommended* migration-015 shape — nullable accent-id + NOT-NULL-default enums; one-time import then clear. Not re-prompted (resolution supplied in the executor prompt).
- **Migration 015** (`src/db/migrations/015-theme-settings.ts`, `version: 15`): seven additive `ALTER TABLE app_settings ADD COLUMN`s — `theme_package` (NOT NULL DEFAULT 'galaxy', CHECK galaxy|standard), `galaxy_mode`/`standard_mode` (NOT NULL DEFAULT 'system', CHECK light|dark|system), and nullable `galaxy_accent`/`standard_accent`/`galaxy_background`/`standard_background` (option-id, NULL = package default at render). `TARGET_VERSION` bumped 14→15; `migration015` registered in `MIGRATIONS`. Head+1 was verified on disk (was 14).
- **DAO writer contract** (`src/db/app-settings-dao.ts`): the 7 columns threaded through `AppSettings`, `AppSettingsRow`, `COLUMN_OF`, `WritableSettingsKey`, `getAppSettings` (NULL passthrough for accent/background), the `PortableSettingsSnapshot` TYPE (OPTIONAL, emission deferred), and new validators `assertThemePackage`/`assertThemeMode`/`assertAccentId`/`assertBackgroundId` (+ `*_FIELDS`) wired into the pre-UPDATE validation loop.
- **theme-option-ids.ts** (new, pure/RN-free/db-free): the single canonical `ACCENT_IDS` / `BACKGROUND_SLOT_IDS` source. DAO validators consume it via `.includes()` (the `AI_PROVIDER_IDS` idiom); Plans 03/06 will import these same arrays. Background slot ids match Plan 06's manifest (`none`, galaxy-nebula/deep-space/aurora/starfield, standard-dawn/dusk/mesh/paper); accent ids include the two named package defaults (`nebula-blue`, `slate-indigo`).
- **Backup forward-safety** (`src/backup/backup-schema.ts`): the 7 keys added to the `PORTABLE_SETTINGS_KEYS` allowlist only — no `BACKUP_FORMAT_VERSION` bump, no `FORWARD_MIGRATIONS` entry. A regression test asserts a format-3 export's `appSettings` omits all 7 keys (they are not emitted by `getPortableSettingsSnapshot` this phase).
- **Package-axis theme layer** (`theme-types.ts`, `theme-presets.ts`, `theme-provider.tsx`): `ThemePackage` = galaxy|standard; `THEME_PRESETS` re-keyed (galaxy = former space-dark palette verbatim, standard = distinct placeholder dark palette); `resolvePalette(package, mode)`; `ResolvedTheme` carries the active package; `DEFAULT_PRESET_ID` kept exported (now 'galaxy') so `widget-colors.ts` compiles unchanged.
- **Legacy import + boot** (`orbit-theme-migration.ts`, `hydrate-theme-at-boot.ts`, `App.tsx`, `theme-store.ts`): a pure mapper unwrapping the zustand persist envelope (`parsed.state`), a dependency-injected boot coordinator (compare-before-write idempotency + per-step error isolation) folded into the `openAndMigrate` ready gate, and the theme store reworked to the boot-hydrated `app_settings` selection (no AsyncStorage persist).

## Verification

- `npx vitest run` — **1916/1916 pass** (200 files), including the plan's named suites (015 migration, full-chain, app-settings-dao, orbit-theme-migration, hydrate-theme-at-boot, theme-presets, export-manifest, widget-colors).
- `npm run check:colors` — **exit 0** (no hex outside `src/**/theme/**`; none in migration 015).
- `npx tsc --noEmit` — **clean**.
- `npx @biomejs/biome check` on all changed files — **clean**.
- Acceptance greps: `TARGET_VERSION = 15` matches; `migration015` registered; `theme-option-ids.ts` imports nothing from react-native/db; `BACKUP_FORMAT_VERSION = 3` unchanged.
- **Device UAT (end-of-phase Pixel pass) — deferred:** restore-before-paint / no-flash and the orbit-theme carry-across are UI-observable only (coverage D7, human_judgment).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Extended two out-of-plan test files' migration setup to v15**
- **Found during:** Task 2 (full test run)
- **Issue:** `src/services/notifications/digest-schedule.test.ts` and `notification-schedule.test.ts` build their own `app_settings` schema by listing migrations 001–014 (target 14) and then call `getAppSettings`, which now SELECTs `theme_package` → `no such column` failures. Directly caused by the getAppSettings SELECT change.
- **Fix:** Added `migration015` to both files' migration arrays and bumped the target to 15.
- **Files modified:** src/services/notifications/digest-schedule.test.ts, src/services/notifications/notification-schedule.test.ts
- **Commit:** 6741d25

**2. [Rule 3 - Blocking] Re-keyed two logic tests off the retired 'space-dark' THEME_PRESETS key**
- **Found during:** Task 2 (package re-key)
- **Issue:** `src/logic/orrery-ring-logic.test.ts` and `sun-occupant-logic.test.ts` read `THEME_PRESETS["space-dark"].dark`, which no longer exists after the package re-key.
- **Fix:** Updated both to `THEME_PRESETS.galaxy.dark` (galaxy = former space-dark palette verbatim, so values are identical).
- **Files modified:** src/logic/orrery-ring-logic.test.ts, src/logic/sun-occupant-logic.test.ts
- **Commit:** 6741d25

## Known Stubs

- **`standard` package palette is a placeholder** (`theme-presets.ts`): a distinct-but-provisional dark palette proving the package axis. Intentional — the finished four-palette authoring (galaxy-light + standard dark/light) is **Plan 03** (`accents.ts`), documented in-file. Not a goal-blocking stub for this tracer (the tracer only proves galaxy × mode to render end-to-end).
- **`theme-store` setters `setPackage` / `setModeForActivePackage` have no runtime caller yet**: the live-preview plumbing established here; the Settings UI that calls them arrives in a later plan. Provider re-renders from store state, so the wiring is exercised by hydrate.
- **Accent/background overlay not yet applied at render:** columns + store fields + validators land here; accent tone resolution (Plan 03) and background asset resolution (Plan 06) expand from this proven slice. Deliberate per the plan's tracer scope.

No emission of the 7 theme keys in `getPortableSettingsSnapshot` and no `BACKUP_FORMAT_VERSION`/`FORWARD_MIGRATIONS` change — deliberately deferred to Phase 36 (owner-sequenced), not a stub.

## Self-Check: PASSED

- All created files exist on disk (migration 015, theme-option-ids, orbit-theme-migration, hydrate-theme-at-boot, SUMMARY).
- Tracer commit `6741d25` present in git history.
