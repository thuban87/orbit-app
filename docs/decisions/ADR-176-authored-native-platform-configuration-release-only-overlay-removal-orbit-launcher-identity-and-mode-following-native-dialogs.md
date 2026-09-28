# ADR-176: Authored Native Platform Configuration — Release-Only Overlay Removal, Orbit Launcher Identity, and Mode-Following Native Dialogs

**Status:** Accepted
**Date:** 2026-09-23
**Phase:** 38.4-audit-remediation-ui-performance-release
**Source decisions:** dossier Workstream H; 38.4-CONTEXT D-08, D-09, D-21, D-42(C), D-43, D-48, D-50, D-60; RG-040 (`release-readiness/AUD-REL-002`), RG-041 (`release-readiness/AUD-REL-003`); OA-D1, OA-D4
**Reversibility:** reversible
**Migration:** None
**Supersedes:** None
**Superseded by:** None

## Context

The release manifest still carried the Expo template's `SYSTEM_ALERT_WINDOW` permission, and the launcher still used the Expo scaffold artwork. `app.json` still named the app `orbit-scaffold`. Native surfaces Orbit does not paint, such as RN `Alert` confirmations and the date/time picker dialogs, followed the device's light/dark setting instead of Orbit's own mode. The storage permission pair (`READ/WRITE_EXTERNAL_STORAGE`, `maxSdkVersion 32`) came from library manifests, and nobody knew whether it was needed.

## Decision

Native configuration changes go through authored config and plugins, never through generated manifests.
- `SYSTEM_ALERT_WINDOW` is removed from release builds only. The `withReleaseOnlyOverlayPermissionRemoval` plugin deletes it from the main manifest and writes a release-variant manifest with a `tools:node="remove"` marker, so debug and dev-client builds keep it. aapt2 on both APKs verifies the result.
- No other permission changes. READ_CONTACTS stays (ADR-003), and the storage pair is kept (D-60) because removal was not proven 100% unused: legacy `file://` backup intake on Android 7–9 can need READ.

The launcher uses the owner-supplied Orbit artwork (D-21):
- The adaptive icon has a solid Deep royal `#1A2F8A` background with no background image.
- The foreground and monochrome layers are derived reproducibly by `scripts/fit-launcher-icons.py`. The script scales the art into the adaptive safe zone (66/108, margin 0.95), and its `--check` compares decoded pixels.
- The full-square legacy art is `expo.icon` and the About screen image.
- The scaffold icon files are deleted.
- `app.json` `name`/`slug` match the resolved `Orbit`/`orbit` (D-42C). Package identity is unchanged.

Native dialogs follow Orbit's mode setting (D-50). `useNativeColorSchemeSync` drives `Appearance.setColorScheme` from the active package's mode: light and dark force the matching AppCompat night mode, and "system" maps to `unspecified`, never to the resolved value, so Orbit's own System mode keeps following the device. The DayNight AppTheme and MainActivity's `uiMode` handling mean no activity is recreated and no native package is added. `userInterfaceStyle` is inert on Android without `expo-system-ui` and is left unchanged (D-43).

## Alternatives Considered

- **`android.blockedPermissions`** — rejected; its main-manifest remove marker also strips React Native's debug-library copy, which D-09 says debug must keep.
- **Remove the overlay permission everywhere** — not chosen (D-09).
- **Remove the storage pair** — held by D-48's "only if proven unused"; not proven, so kept (D-60).
- **Add `expo-system-ui` or a parent-theme plugin for D-50** — not needed; RN core's `Appearance` already maps to AppCompat night mode.
- **Map "system" to the resolved scheme** — rejected; once overridden, `useColorScheme()` reports the override and System mode would freeze.

## Consequences

### Positive

- Release builds drop an unused high-risk permission, the launcher carries Orbit's identity, and native dialogs match the app's mode.

### Negative

- Debug and release manifests now legitimately differ, so permission checks must inspect both APKs.

### Risks

- The storage pair stays until backup intake gains a `content://`-only guard (todo `2026-09-27-backup-intake-content-uri-only.md`).
- The themed (monochrome) launcher icon could not be exercised on the Android 12 test phone; the owner accepted it.

## Implementation

**Key files:**
- `plugins/withReleaseOnlyOverlayPermissionRemoval.js` — release-only overlay permission removal.
- `app.config.ts` — registers the plugin.
- `app.json` — Orbit launcher wiring and name/slug.
- `scripts/fit-launcher-icons.py` — reproducible safe-zone fit and check.
- `assets/orbit-icon-foreground-adaptive.png` — fitted adaptive foreground.
- `assets/orbit-icon-monochrome-adaptive.png` — fitted themed-icon layer.
- `assets/orbit-icon-legacy.png` — legacy icon and About image.
- `assets/icon.png` — deleted scaffold icon.
- `assets/android-icon-foreground.png` — deleted scaffold adaptive foreground.
- `assets/android-icon-background.png` — deleted scaffold adaptive background.
- `assets/android-icon-monochrome.png` — deleted scaffold monochrome layer.
- `src/screens/SettingsAboutScreen.tsx` — About screen shows the Orbit icon.
- `src/theme/native-color-scheme.ts` — `nativeColorSchemeFor` and `useNativeColorSchemeSync`.
- `src/theme/theme-provider.tsx` — drives native night mode from the mode setting.
- `src/theme/native-color-scheme.test.ts` — mapping contract.

**Depends on:** ADR-003 (Read-Contacts on API 37 for Reconcile); ADR-083 (Durable Multi-Package Theme Configuration and Restore-Before-Paint); ADR-007 (Cross-Machine Android Build Pipeline)
**Required by:** None
