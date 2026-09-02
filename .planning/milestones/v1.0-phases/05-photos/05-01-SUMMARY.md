---
phase: 05-photos
plan: 01
subsystem: infra
tags: [expo-image-picker, expo-image-manipulator, expo-file-system, expo-image, react-native-skia, react-native-reanimated, react-native-gesture-handler, theme, babel, config-plugin]

# Dependency graph
requires:
  - phase: 04-contact-crud
    provides: "ThemePalette + resolvePalette token system (danger token precedent), App.tsx launch/migration shell, app.config.ts plugin-dedupe pattern"
provides:
  - "Seven photo-pipeline native modules installed at SDK-57 pins (picker, manipulator, file-system, expo-image, Skia, Reanimated 4 + worklets, gesture-handler)"
  - "Library-only picker hardening: expo-image-picker config plugin with cameraPermission:false / microphonePermission:false (CAMERA/RECORD_AUDIO kept out of the manifest)"
  - "Reanimated 4 babel plugin (react-native-worklets/plugin) registered last"
  - "GestureHandlerRootView wrapping the outermost app tree"
  - "avatarSwatches (readonly string[8]) + avatarSwatchText tokens on ThemePalette, populated in space-dark"
affects: [05-02 avatar render, 05-03 crop screen, 05-04 photo pipeline, 05-05 URL path, custom-field photo]

# Tech tracking
tech-stack:
  added: [expo-image-picker@~57.0.10, expo-image-manipulator@~57.0.10, expo-file-system@~57.0.4, expo-image@~57.0.3, "@shopify/react-native-skia@2.6.2", react-native-reanimated@4.5.1, react-native-worklets@0.10.4, react-native-gesture-handler@~2.32.0]
  patterns: ["Config-plugin dedupe BY NAME (tuple vs string) before appending a [name, options] plugin", "Finite themed avatar swatch set indexed by name hash replaces free-hue hsl()"]

key-files:
  created: []
  modified:
    - package.json
    - package-lock.json
    - app.config.ts
    - babel.config.js
    - App.tsx
    - src/theme/theme-types.ts
    - src/theme/theme-presets.ts
    - src/theme/theme-presets.test.ts

key-decisions:
  - "Used react-native-worklets/plugin (not react-native-reanimated/plugin) as the babel plugin — Reanimated 4.5.1 moved the transform there; reanimated/plugin is now a thin re-export"
  - "Added expo-image config plugin per expo install instruction so this framework-init is a single coordinated prebuild (deviation, Rule 3)"
  - "avatarSwatches uses the UI-SPEC 8 deep-space seeds + #F2F4FB on-swatch text — infrastructure default, owner-tunable"

patterns-established:
  - "Dedupe-by-name for Expo config plugins: derive each entry's name (entry[0] if tuple else entry), drop existing by name, append the tuple once — a Set cannot dedupe a tuple against a bare string"
  - "Deterministic per-contact avatar colour quantizes the name hash onto a finite themed array, never a raw hue (no-hardcoded-colour compliant, restyles with theme)"

requirements-completed: [PHOTO-04]

coverage:
  - id: D1
    description: "Seven photo-pipeline native modules installed at SDK-57-pinned versions"
    requirement: "PHOTO-04"
    verification:
      - kind: unit
        ref: "npx tsc --noEmit (exit 0) + package.json dependency assertion for all seven"
        status: pass
    human_judgment: false
  - id: D2
    description: "expo-image-picker config plugin disables camera/mic so CAMERA/RECORD_AUDIO never enter the release manifest"
    requirement: "PHOTO-04"
    verification:
      - kind: manual_procedural
        ref: "npx expo config --type prebuild --json — plugins array contains [expo-image-picker,{cameraPermission:false,microphonePermission:false}]"
        status: pass
    human_judgment: true
    rationale: "Config resolves correctly on this box, but the actual generated Android manifest (no CAMERA/RECORD_AUDIO) can only be confirmed on the rebuilt release APK via the desktop-build pipeline — on-device UAT."
  - id: D3
    description: "Reanimated 4 worklets babel plugin registered last; GestureHandlerRootView wraps the app root"
    requirement: "PHOTO-04"
    verification:
      - kind: unit
        ref: "grep react-native-worklets/plugin babel.config.js (final plugin) + grep GestureHandlerRootView App.tsx (outermost)"
        status: pass
    human_judgment: true
    rationale: "Static presence is verified, but that the worklets transform and gesture root actually function requires a native rebuild + on-device launch (Skia render loop / gesture-driven crop are later plans); no Node test can assert it."
  - id: D4
    description: "avatarSwatches + avatarSwatchText tokens exist on every preset, populated in space-dark, colour gate green"
    requirement: "PHOTO-04"
    verification:
      - kind: unit
        ref: "src/theme/theme-presets.test.ts#avatar swatch tokens (PHOTO-04)"
        status: pass
      - kind: unit
        ref: "npm run check:colors (exit 0)"
        status: pass
    human_judgment: false

# Metrics
duration: 16 min
completed: 2026-08-15
status: complete
---

# Phase 5 Plan 01: Photo-pipeline native enablement + avatar colour tokens Summary

**Installed the seven first-party photo modules (Expo picker/manipulator/file-system/image, Shopify Skia, Reanimated 4 + worklets, gesture-handler) in one coordinated prebuild, hardened the picker to library-only in the manifest, wired the worklets babel plugin + gesture root, and added the deterministic `avatarSwatches`/`avatarSwatchText` theme tokens PHOTO-04 depends on.**

## Performance

- **Duration:** 16 min
- **Started:** 2026-08-15T13:41:00Z
- **Completed:** 2026-08-15T13:57:30Z
- **Tasks:** 2 (Task 2 TDD: RED + GREEN)
- **Files modified:** 7 (excl. package-lock.json)

## Accomplishments
- Seven native modules resolved at SDK-57 `bundledNativeModules` pins via `expo install` (no hand-pinned `latest`); Reanimated 4 pulled `react-native-worklets@0.10.4`.
- `expo-image-picker` registered as a `[name, options]` tuple with `cameraPermission:false` / `microphonePermission:false` (T-05-01 information-disclosure mitigation); plugins deduped BY NAME so the tuple cannot collide with a bare string.
- `react-native-worklets/plugin` set as the final babel plugin (Reanimated 4's canonical transform); `GestureHandlerRootView` wraps the outermost tree in `App.tsx`.
- `avatarSwatches` (readonly string[8]) + `avatarSwatchText` added to `ThemePalette` and populated in `space-dark` with the UI-SPEC seed hexes — the barred free-hue `hsl()` avatar is replaced by a finite themed set the name hash indexes.

## Task Commits

1. **Task 1: Install seven native modules and wire config** - `bf7d73d` (feat)
2. **Task 2 (RED): failing avatar-token test** - `f6c4e42` (test)
3. **Task 2 (GREEN): avatarSwatches + avatarSwatchText tokens** - `ad4c0e1` (feat)

_No refactor commit — GREEN implementation was already clean; full suite (346 tests), tsc, and colour gate all passed unchanged._

## Files Created/Modified
- `package.json` / `package-lock.json` - Seven photo-pipeline deps + transitive worklets
- `app.config.ts` - Dedupe-by-name plugin logic; expo-image-picker tuple (cam/mic off); expo-image plugin
- `babel.config.js` - `react-native-worklets/plugin` as final plugin
- `App.tsx` - `GestureHandlerRootView` (flex:1) outermost wrapper
- `src/theme/theme-types.ts` - avatarSwatches + avatarSwatchText on ThemePalette; doc count 9 → 11
- `src/theme/theme-presets.ts` - 8 swatches + on-swatch text in space-dark.dark
- `src/theme/theme-presets.test.ts` - Asserts both tokens present + non-empty across every preset

## Decisions Made
- **Babel plugin = `react-native-worklets/plugin`.** Reanimated 4.5.1 moved the transform into react-native-worklets; verified that `react-native-reanimated/plugin` is now a one-line re-export of it. Using the canonical path avoids a future deprecation warning.
- **Swatch seeds from UI-SPEC.** 8 deep-space-harmonised muted hues + `#F2F4FB` near-white text — an infrastructure default explicitly owner-tunable like the rest of space-dark; not a taste ruling.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking/enablement] Added the `expo-image` config plugin entry**
- **Found during:** Task 1 (config wiring)
- **Issue:** `expo install` printed an explicit instruction to add `"expo-image"` to the Expo config plugins. The plan's action listed only the `expo-image-picker` tuple. Omitting `expo-image` would leave a required config plugin unregistered and force a *second* prebuild in a later plan — directly defeating this plan's stated purpose ("one coordinated rebuild instead of many").
- **Fix:** Added the bare `"expo-image"` string to the deduped plugins list. This is additive enablement instructed by the tooling and fully aligned with the plan objective; no decision is reversed.
- **Files modified:** app.config.ts
- **Verification:** `npx expo config --type prebuild --json` resolves plugins to `[expo-sqlite, expo-status-bar, @react-native-community/datetimepicker, expo-image, [expo-image-picker,{cameraPermission:false,microphonePermission:false}]]` — no duplicates, tuple appended once.
- **Committed in:** bf7d73d (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking/enablement)
**Impact on plan:** The single addition serves the plan's own "single prebuild" objective and matches expo's install instruction. No scope creep, no decision reversal.

## Issues Encountered
None. `npm install` reported pre-existing advisory-level vulnerabilities in the transitive tree (7 moderate / 15 high) — untouched, out of scope for this plan, and not introduced by it. TDD RED failed as designed before the tokens existed, then went GREEN.

## User Setup Required
None - no external service configuration required. (On-device UAT via the desktop-build pipeline is required to confirm the rebuilt release APK launches and the manifest omits CAMERA/RECORD_AUDIO — see D2/D3 below; that is verification, not setup.)

## Next Phase Readiness
- All native modules, config plugins, babel transform, gesture root, and avatar tokens are in place — every later Phase-5 slice (avatar render, crop, pipeline, URL path, custom-field photo) has its shared enablement.
- **Blocker for full verification (not for the next plan):** the manifest-permission check (no CAMERA/RECORD_AUDIO) and the worklets/Skia/gesture runtime behaviour are only assertable on a rebuilt release APK on the Pixel — deferred to on-device UAT via the desktop-build pipeline. Config-layer proof (expo config JSON) passed here.

## Self-Check: PASSED

- All modified files present on disk (7 + SUMMARY).
- All three task commits present in git log (bf7d73d, f6c4e42, ad4c0e1).
- Gates re-run green: `npx tsc --noEmit` exit 0, `npm run check:colors` exit 0, `npm test` 346/346 pass.

---
*Phase: 05-photos*
*Completed: 2026-08-15*
