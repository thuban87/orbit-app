---
phase: 37-settings-personalization
plan: 02
subsystem: ui
tags: [react-navigation, settings, theme-store, app-settings-dao, appearance, adr-083, adr-084, adr-087, zustand]

# Dependency graph
requires:
  - phase: 37-settings-personalization
    plan: 01
    provides: SETTINGS_REGISTERED_ROUTES contract + source-scan test, SettingsHubScreen at `Settings`, hub model, transitional SettingsMore, category-screen shell + persist() template
  - phase: 23-theme
    provides: theme-store (package × per-package mode/accent/background), themeSelectionFromSettings, BACKGROUND_ORDER/PACKAGE_DEFAULT_SLOT, ACCENTS, app_settings theme columns (migration 015)
provides:
  - SettingsAppearanceScreen — Appearance category (Theme section) reached from the hub
  - injectable persistAppearanceSetting helper — durable write + failed-write reconcile via theme-store hydrate (review MEDIUM cycle-3)
  - settings-appearance-background pure helpers — backgroundChoicesForPackage(pkg) (D-07 active-package guard) + backgroundPatchForPackage(pkg, slot) (per-package durable key)
  - SettingsAppearance route registered (types + SettingsStack + SETTINGS_REGISTERED_ROUTES) + Appearance hub row at §A index 0
affects: [37-03, 37-04, 37-05, 37-06, 37-07, 37-08]

actuals:
  tokens: 8500
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Injectable durable-write helper (persistAppearanceSetting) that reconciles the live Zustand store back to SQLite on a failed write, so 'durable' cannot silently mean 'diverged'"
    - "Pure per-package selectors (backgroundChoicesForPackage / backgroundPatchForPackage) making the D-07 active-package guard and the correct-column write unit-provable in vitest-node"

key-files:
  created:
    - src/screens/SettingsAppearanceScreen.tsx
    - src/screens/settings-appearance-persist.ts
    - src/screens/settings-appearance-persist.test.ts
    - src/screens/settings-appearance-background.ts
    - src/screens/settings-appearance-background.test.ts
  modified:
    - src/navigation/types.ts
    - src/navigation/tabs/SettingsStack.tsx
    - src/navigation/settings-routes.ts
    - src/screens/settings-hub-model.ts
    - src/screens/SettingsScreen.tsx

key-decisions:
  - "Failed durable write is reconciled, not just logged: persistAppearanceSetting catches a failed updateAppSettings, re-reads getAppSettings, projects via themeSelectionFromSettings, and calls the store's hydrate() to pull the live store back to the persisted value — the locked cycle-3 failure path, removing the weaker 'just show it wasn't saved' variant"
  - "D-07 is a rendering guard only: the Background grid renders backgroundChoicesForPackage(themePackage) (active package's slots + None) instead of both packages' subgroups; no theme-store, schema, or backup-format change. ADR-083/084/087 upheld, PARKED theme-merge untouched"
  - "Helper deps are REQUIRED (not defaulted) — same rationale as Plan 01's assist helper: the real updateAppSettings/getAppSettings/localDateTime bindings pull expo-sqlite (RN Flow source), which would make the logic module + its node test unloadable in vitest-node"

requirements-completed: []

coverage:
  - id: D1
    description: "A failed durable appearance write re-reads getAppSettings, reconciles the live store via hydrate, and surfaces the error — the store is not left diverged, the failure is not swallowed (review MEDIUM cycle-3)"
    verification:
      - kind: unit
        ref: "src/screens/settings-appearance-persist.test.ts#failed durable write (review MEDIUM, cycle-3)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The Background section offers only the active package's choices (D-07) and a background selection writes the package-sensitive durable key (galaxyBackground vs standardBackground)"
    verification:
      - kind: unit
        ref: "src/screens/settings-appearance-background.test.ts#active-package guard (D-07) + per-package durable key"
        status: pass
    human_judgment: false
  - id: D3
    description: "SettingsAppearance is registered (SETTINGS_REGISTERED_ROUTES source-scan + hub model target-validity) and the Appearance hub row holds §A index 0"
    verification:
      - kind: unit
        ref: "src/navigation/settings-routes.test.ts#route-registration contract"
        status: pass
      - kind: unit
        ref: "src/screens/settings-hub-model.test.ts#§A ordering + registered-route targets"
        status: pass
    human_judgment: false
  - id: D4
    description: "Device UAT: changing package/mode/accent/background restyles the app instantly AND survives relaunch (durable); with Standard active the Galaxy-only backgrounds are not offered, switching to Galaxy reveals them live"
    verification: []
    human_judgment: true
    rationale: "On-device instant-restyle + durability + Galaxy-conditional visibility need visual confirmation on the Pixel (verify-ui-on-pixel-yourself + device-uat-runas-pattern for the durable-relaunch check). Deferred to end-of-phase UAT."

duration: 8min
completed: 2026-09-14
status: complete
---

# Phase 37 Plan 02: Appearance › Theme Migration Summary

**The Theme controls (package / mode / accent / background) move out of the 2,168-line Settings monolith into a dedicated Appearance category screen reached from the hub — preserving instant restyle + durability verbatim, adding an honest failed-write reconcile the monolith never had, and shipping the Galaxy-conditional background as the trivial one-line active-package guard D-07 confirmed it is.**

## Performance

- **Duration:** ~8 min
- **Tasks:** 2
- **Files modified:** 10 (5 created, 5 modified)

## Accomplishments
- `SettingsAppearanceScreen` carries the full Theme section — each control reads the reactive `useThemeStore` selector, fires the live store setter (instant restyle via ThemeProvider), and persists the durable `app_settings` column.
- `persistAppearanceSetting` (injectable, node-tested) closes the review-MEDIUM divergence: a failed `updateAppSettings` re-reads `getAppSettings`, projects via `themeSelectionFromSettings`, and calls the store's `hydrate()` to reconcile the live store back to SQLite, then surfaces an inline `accessibilityLiveRegion="polite"` save-error notice (theme-token colours). Never swallowed, never left diverged — the cycle-3-locked path, not the weaker "just show it wasn't saved" variant.
- D-07 shipped as a rendering guard: the Background grid renders `backgroundChoicesForPackage(themePackage)` (active package's slots + None) instead of both packages' subgroups. `backgroundPatchForPackage(pkg, slot)` writes the package-sensitive durable key. No theme-store / schema / backup-format change.
- `SettingsAppearance` registered end-to-end (types + `SettingsStack` `<Stack.Screen>` + `SETTINGS_REGISTERED_ROUTES`); Appearance hub row inserted at §A index 0 (before Interactions); the `__DEV__` theme-preview row moved onto the Appearance screen.
- Migrated Theme JSX, the `BackgroundThumbnail` component, `BACKGROUND_LABELS`, theme selectors/setters, dead styles, and now-unused imports removed from the `SettingsMore` monolith — no duplicate write surface.
- No migration added; `TARGET_VERSION` stays 29, `BACKUP_FORMAT_VERSION` stays 5 (D-06). ADR-083/084/087 upheld; the PARKED theme-merge untouched.

## Task Commits

1. **Task 1: Theme section → SettingsAppearanceScreen + persist helper + route/hub wiring + monolith removal** - `75017f6` (feat)
2. **Task 2: Galaxy-conditional background control (D-07) + per-package helpers/tests** - `fb734eb` (feat)

## Files Created/Modified
- `src/screens/SettingsAppearanceScreen.tsx` - Appearance category screen (Theme section) with the inline save-error notice.
- `src/screens/settings-appearance-persist.ts` - injectable `persistAppearanceSetting` (durable write + failed-write reconcile via `hydrate`).
- `src/screens/settings-appearance-persist.test.ts` - happy-path + failed-write reconcile (re-read → hydrate → surface, ordering asserted).
- `src/screens/settings-appearance-background.ts` - `backgroundChoicesForPackage` (D-07 active-package guard) + `backgroundPatchForPackage` (per-package durable key).
- `src/screens/settings-appearance-background.test.ts` - active-package choices + per-package patch-key tests.
- `src/navigation/types.ts` - `SettingsAppearance: undefined;` added to `SettingsStackParamList`.
- `src/navigation/tabs/SettingsStack.tsx` - `SettingsAppearanceRoute` wrapper + `<Stack.Screen name="SettingsAppearance">`.
- `src/navigation/settings-routes.ts` - `SettingsAppearance` appended to `SETTINGS_REGISTERED_ROUTES`.
- `src/screens/settings-hub-model.ts` - Appearance `kind:"route"` row at §A index 0.
- `src/screens/SettingsScreen.tsx` - migrated Theme JSX / dev preview / helpers / styles / imports removed.

## Decisions Made
- **Failed-write honesty (review MEDIUM, cycle-3):** the durable write path reconciles the live Zustand store to SQLite on failure rather than logging-and-forgetting. This is the single behavioural addition over the monolith — instant-apply ordering (setter first) is preserved.
- **D-07 as a one-line guard:** confirmed against disk that Mode/Accent already read the active package; only the Background grid rendered both. The guard is a rendering change over the existing per-package model — no ADR-083/084/087 reversal, no start on the PARKED theme-merge.

## Deviations from Plan
None — plan executed as written. (The plan's optional `settings-appearance-background.ts`/`.test.ts` and `settings-appearance-persist.ts`/`.test.ts` filenames match; the persist test was named `settings-appearance-persist.test.ts` per the plan's cycle-3 note.)

## Known Stubs
None. Every migrated control drives a live setter + durable write; no placeholder or empty-data path was introduced.

## Threat Flags
None. No new network endpoints, auth paths, file access, or schema changes — all writes reuse the existing validated `updateAppSettings` DAO path (T-37-01 mitigation held); D-07 is a rendering guard (T-37-04 scope-reversal avoided).

## User Setup Required
None for automated verification. Device UAT (D4) requires the owner's Pixel: confirm instant restyle + durable relaunch for package/mode/accent/background and the Galaxy-conditional background visibility. Deferred to end-of-phase UAT.

## Next Phase Readiness
- The Appearance screen is the home Plan 03 extends (Orbit Center + self-star D-02, owner photo, global profile default D-05, self-name editor + `setProfileName` D-04b).
- `persistAppearanceSetting`'s reconcile pattern and the per-package pure-helper idiom are available templates for later category screens that write theme-adjacent prefs.

## Self-Check: PASSED

All five created source files present on disk; both task commits (`75017f6`, `fb734eb`) exist in git history.
