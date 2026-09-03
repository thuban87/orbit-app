---
plan: 23-08
phase: 23-theme-visual-system
title: In-app Appearance settings — entry point for the live theme axes
gap_closure: true
gap_ids: [G-23-entrypoint]
status: complete
completed: 2026-09-03
---

# 23-08 SUMMARY — In-app Appearance settings

## What shipped

A **Settings → Appearance** section (first section in `SettingsScreen`) exposing the
three theme axes that resolve through `ThemeProvider` app-wide today:

- **Theme** — Galaxy | Standard chips → `setPackage` (live) + `persist({ themePackage })`
- **Mode** — Light | Dark | Follow System chips → `setModeForActivePackage` (live) +
  `persist({ galaxyMode | standardMode })` (per active package)
- **Accent** — Default + 8 colour swatches → `setAccentForActivePackage` (live) +
  `persist({ galaxyAccent | standardAccent })` (per active package)

Each control updates the in-memory `useThemeStore` selection (the provider re-renders,
restyling the whole app instantly) AND writes the durable `app_settings` column via the
screen's existing `persist()` → `updateAppSettings` (validated, restart/backup-safe).

## Files

- `src/stores/theme-store.ts` — added `setAccentForActivePackage(accent: AccentId | null)`
  (mirrors `setModeForActivePackage`; writes the active package's accent field).
- `src/screens/SettingsScreen.tsx` — new Appearance section (package/mode chips + accent
  swatches), token-styled (no colour literals), `check:colors` clean.

## Scope boundary (owner-directed, consumer-gated)

Wired ONLY axes with a real in-app consumer today. **Excluded** the background picker
(`BackgroundHost` is not mounted in any production screen — no visible effect yet) and
did not touch glass/status-glyph adoption (no consumers). Screen adoption of those still
lands in the rebuild phases (25/26 Dashboard, 29/30 Orrery, 31 Profile).

## Verification

- `npm run check:colors` clean; `tsc --noEmit` clean; theme suite 199/199; settings
  tests 22/22.
- **Device UAT (Pixel 3a, dev-client via Metro):** Appearance section renders; tapping
  Standard + Coral re-tinted the ENTIRE app live (chips, FAB, links, tab icons, surfaces);
  Light mode applied live; DB persisted `theme_package=standard, standard_mode=light,
  standard_accent=coral`; cold-start restored Standard/Light/Coral before paint. Screenshots
  captured.

## Notes

- No migration (columns exist since 015). No AsyncStorage (persist via DAO — D-08/D-09).
- No new colour literals; all through theme tokens.
- Does not reverse the deferred screen-adoption boundary — only adds the settings entry
  point for the axes already live.
