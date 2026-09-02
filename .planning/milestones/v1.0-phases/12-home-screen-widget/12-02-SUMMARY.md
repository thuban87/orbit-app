---
phase: 12-home-screen-widget
plan: 02
subsystem: infra
tags: [expo, config-plugin, react-native-android-widget, android-widget, prebuild]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: "app.config.ts plugins() dedupe-by-name builder (tuple-append pattern for expo-image-picker / expo-share-intent)"
provides:
  - "react-native-android-widget@0.22.0 installed (pinned, owner-approved [SUS] legitimacy gate)"
  - "widgetConfig (WithAndroidWidgetsParams) declared in app.config.ts with the OrbitFavourites widget"
  - "Widget Expo config plugin registered as a [name, params] tuple through the deduped plugins() builder"
affects: [12-05, 12-06, 12-07, 12-08]

# Tech tracking
tech-stack:
  added: ["react-native-android-widget@0.22.0"]
  patterns:
    - "Native config-plugin registered as a [name, params] TUPLE past the dedupe-by-name name-filter (never a bare string) — extends the 01-01 duplicate-plugin-prebuild-hazard pattern to a fourth plugin"
    - "Widget definition typed against the INSTALLED library types (WithAndroidWidgetsParams) via a type-only import (fully erased, no runtime require)"

key-files:
  created: []
  modified:
    - "package.json — react-native-android-widget pinned at 0.22.0"
    - "package-lock.json — dependency lock"
    - "app.config.ts — widgetConfig + tuple registration through plugins() builder"

key-decisions:
  - "Pinned exactly 0.22.0 (no caret) so downstream slices build against the researched config-plugin/enum contract; a floating range could silently break the API."
  - "widget name 'OrbitFavourites' is the contract string every later requestWidgetUpdate/requestPinWidget/registerWidgetTaskHandler call must reference verbatim."
  - "updatePeriodMillis: 0 (event-push only, WDG-03) — the library floors any positive value at 30 min and the OS Doze-throttles it; Orbit pushes on data change instead."
  - "resizeMode 'horizontal|vertical' + maxResizeWidth/maxResizeHeight bounds make the single widget genuinely resizable (WDG-03); prop names verified against installed config-plugin.type.d.ts."
  - "previewImage OMITTED — no committed preview asset exists and a missing asset path fails prebuild; polish deferred."
  - "No prebuild run here — that is 12-08 on the desktop pipeline. This plan only makes the dep + config available so downstream files typecheck."

patterns-established:
  - "Tuple-append native plugin registration: add the plugin name to the plugins() name-filter exclusion list AND push the [name, params] tuple onto the returned array."
  - "Widget config values (resize bounds, cell span, updatePeriodMillis) live at top-of-config as owner-tunable constants, tuned on the Pixel in 12-08."

requirements-completed: [WDG-01, WDG-02, WDG-03]

coverage:
  - id: D1
    description: "react-native-android-widget installed pinned at 0.22.0 in package.json dependencies (owner legitimacy gate approved before install, T-12-SC)"
    requirement: "WDG-01"
    verification:
      - kind: other
        ref: "node -e require('./package.json').dependencies['react-native-android-widget'] === '0.22.0'"
        status: pass
    human_judgment: false
  - id: D2
    description: "app.config.ts declares widgetConfig (name OrbitFavourites, updatePeriodMillis 0, resizeMode + max resize bounds) and registers it as a tuple through the deduped plugins() builder; config resolves with the widget plugin present and all prior invariants preserved (allowBackup=false, portrait, picker+share)"
    requirement: "WDG-03"
    verification:
      - kind: other
        ref: "npx tsc --noEmit (clean)"
        status: pass
      - kind: other
        ref: "npx expo config --type prebuild --json => plugins includes react-native-android-widget tuple; widget name OrbitFavourites, updatePeriodMillis 0, resizeMode horizontal|vertical; allowBackup=false, orientation=portrait, picker+share preserved"
        status: pass
    human_judgment: false
  - id: D3
    description: "Widget provider actually generated into AndroidManifest.xml + widget-info XML at prebuild (deferred to 12-08 on desktop pipeline)"
    requirement: "WDG-02"
    verification: []
    human_judgment: true
    rationale: "No prebuild is run in this plan (native build is 12-08 on the desktop). Manifest generation and on-device widget-picker appearance can only be verified after prebuild + install on the Pixel."

# Metrics
duration: 8min
completed: 2026-08-17
status: complete
---

# Phase 12 Plan 02: Widget Native-Enablement Gate Summary

**Installed react-native-android-widget@0.22.0 (owner-gated [SUS] legitimacy check) and registered its Expo config plugin as a deduped tuple in app.config.ts — declaring the OrbitFavourites widget (event-push, resizable) so the native-surface slices 12-05..12-08 can build against the library.**

## Performance

- **Duration:** ~8 min
- **Completed:** 2026-08-17
- **Tasks:** 2 (1 owner checkpoint pre-approved + 1 auto)
- **Files modified:** 3

## Accomplishments
- Installed `react-native-android-widget` pinned at exactly `0.22.0` via `npx expo install` (SDK-57-aligned, version PINNED in the command — not floating).
- Verified the exact config-plugin prop names against the INSTALLED types (`node_modules/react-native-android-widget/lib/typescript/config-plugin.type.d.ts`) before writing config: `resizeMode` (`'none' | 'horizontal' | 'vertical' | 'horizontal|vertical'`), `maxResizeWidth`/`maxResizeHeight` (`` `${number}dp` ``), `minWidth`/`minHeight`, `targetCellWidth/Height`, `updatePeriodMillis`.
- Declared `widgetConfig: WithAndroidWidgetsParams` (type-only import, fully erased at evaluation) with one widget `OrbitFavourites`, `updatePeriodMillis: 0` (event-push only), and the full resize contract.
- Appended `["react-native-android-widget", widgetConfig]` as a TUPLE through the existing dedupe-by-name `plugins()` builder — added the name to the filter exclusion list and pushed the tuple (never a bare string; the 01-01 duplicate-plugin prebuild hazard).
- Confirmed the resolved config (`npx expo config --type prebuild --json`) carries the widget plugin tuple with the correct values and that all prior invariants are intact: `allowBackup=false`, `orientation=portrait`, `expo-image-picker` + `expo-share-intent` preserved.

## Task Commits

1. **Task 1: Owner legitimacy checkpoint (T-12-SC)** — pre-approved by the owner (2026-08-17); no commit (pre-install gate).
2. **Task 2: Install dependency + register config plugin** — `2f967e2` (feat)

## Files Created/Modified
- `package.json` — added `react-native-android-widget` pinned at `0.22.0`.
- `package-lock.json` — dependency lock updated.
- `app.config.ts` — type-only `WithAndroidWidgetsParams` import; `widgetConfig` tunable block (OrbitFavourites, event-push, resizable); tuple registration through the deduped `plugins()` builder.

## Decisions Made
- Task 1 owner checkpoint was **pre-approved** by the owner (2026-08-17) per the execution objective — legitimacy reviewed (latest version, published 2026-08-08, ~46k weekly downloads, real maintained repo `sAleksovski/react-native-android-widget`, MIT, no postinstall; flagged SUS only for the too-new version). Recorded as approved and proceeded to Task 2 without re-asking.
- All widget config values (min/max resize bounds, target cell span) are top-of-config, owner-tunable constants; the precise breakpoints are tuned on the Pixel in 12-08.
- No prebuild run — native build is 12-08 on the desktop pipeline.

## Deviations from Plan

None - plan executed exactly as written. Prop names were verified against the installed 0.22.0 types as the plan required, and matched the workpaper spelling/casing.

## Issues Encountered
None. `npx expo install` reported pre-existing `npm audit` vulnerabilities in the tree (unrelated to this dependency) and re-applied an existing `expo-share-intent@8.0.1` patch (no file change); neither affected this plan. The install printed a reminder to add the plugin to the dynamic config, which is exactly what Task 2 did in tuple form.

## User Setup Required
None - the one net-new dependency was installed on this box during execution; the owner's remaining step (custom dev-client prebuild) is 12-08 on the desktop pipeline, not this plan.

## Next Phase Readiness
- The library and its config plugin are available locally, so the native-surface slices (12-05 render, 12-06 task handler, 12-07 pin, 12-08 prebuild) typecheck against `react-native-android-widget`.
- The `OrbitFavourites` contract name is locked — downstream `requestWidgetUpdate` / `requestPinWidget` / `registerWidgetTaskHandler` calls must reference it verbatim.
- Deferred to 12-08: the actual prebuild that generates the AppWidgetProvider + widget-info XML and asserts manifest hardening; on-device widget-picker verification on the Pixel.

## Self-Check: PASSED
- `app.config.ts` modified and committed in `2f967e2` — FOUND.
- `react-native-android-widget@0.22.0` present in `package.json` dependencies — FOUND.
- Commit `2f967e2` exists in git log — FOUND.
- `.planning/phases/12-home-screen-widget/12-02-SUMMARY.md` created — FOUND (this file).

---
*Phase: 12-home-screen-widget*
*Completed: 2026-08-17*
