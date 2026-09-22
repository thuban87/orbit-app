# Theme & Visual System Maintenance

## Overview

Use this process when adding a curated accent, bundled background slot, semantic theme token, or a complete theme package. It preserves Orbit's local-only appearance system, durable option-ID settings, token-only colour rule, and contrast/accessibility checks.

## Architecture (Phases 23, 31, 31.1, 38.1)

`app_settings` stores a package plus per-package mode, accent ID, and background ID. `ThemeProvider` resolves the active package and OS appearance, then applies a curated accent tone at render time. Palette hex values live only under `src/theme/`; screens receive resolved semantic tokens through `useTheme()`.

### Resolution order

1. **SQLite selection** — `src/db/app-settings-dao.ts` returns the active package and remembered package-specific values.
2. **Mode resolution** — `src/theme/theme-provider.tsx` resolves Light, Dark, or Follow System.
3. **Palette and accent** — `src/theme/theme-presets.ts` selects one complete palette; `src/theme/accents.ts` overlays `{ fill, onAccent, text }`.
4. **Background and shell** — `src/theme/backgrounds.ts` resolves a local asset or solid fallback; one `BackgroundHost` in `RootNavigator` renders it fixed behind transparent ordinary routes.
5. **Route treatment** — `src/navigation/focused-route-classification.ts` selects presentation, comfortable, or dense treatment and suppresses the image only on the Orrery visualization.
6. **Readable composition** — `src/theme/tokens/surface.ts` independently selects the host veil, mode-aware card tint, protected chrome opacity, and the controlled-canvas Orrery overlay treatment.

## File Locations

| File | Purpose |
|---|---|
| `src/theme/theme-option-ids.ts` | Single canonical accent and background option-ID lists. |
| `src/theme/theme-types.ts` | Package, mode, palette, and theme-token type contracts. |
| `src/theme/theme-presets.ts` | Complete palette values; the normal home for palette hex literals. |
| `src/theme/accents.ts` | Curated accent tone triples and package defaults. |
| `src/theme/backgrounds.ts` | Local background manifest, stable ordering, and solid fallback. |
| `src/theme/tokens/surface.ts` | Package surface treatment and compositing helpers. |
| `src/components/ui/BackgroundHost.tsx` | Fixed shell background, veil, Profile override, and render-failure fallback. |
| `src/components/ui/GlassSurface.tsx` | Mode-aware glass/opaque card renderer. |
| `src/components/ui/ChromeScrim.tsx` | Token-only local backing for bare-on-background chrome. |
| `src/navigation/focused-route-classification.ts` | Background-density map and Orrery-only solid override. |
| `src/screens/SettingsAppearanceScreen.tsx` | Grouped shared-library picker and immediate package-local persistence. |
| `assets/backgrounds/README.md` | Background provenance and declared-brightness bounds. |
| `src/db/migrations/015-theme-settings.ts` | Original durable theme-settings migration; never edit it. |

## How to Change the Theme System

1. **Choose the smallest change.** Add a token for a semantic role, an accent for an existing package, or a background slot. A new package changes durable configuration and needs an owner-approved product decision before implementation.

2. **Keep IDs single-sourced.** For a curated accent or background, add its ID in `src/theme/theme-option-ids.ts`, then add the matching resolver entry in `src/theme/accents.ts` or `src/theme/backgrounds.ts`. Do not declare a second ID list in a screen or DAO.

3. **Author values only under `src/theme/`.** An accent needs both modes and all three roles:

   ```ts
   "example-accent": {
     dark: { fill: "#000000", onAccent: "#FFFFFF", text: "#FFFFFF" },
     light: { fill: "#000000", onAccent: "#FFFFFF", text: "#000000" },
   },
   ```

   Replace the example values with colors that pass the checks; never move literals into a component, Skia draw call, migration, or DAO.

4. **Preserve contrast and destructive semantics.** Run the theme suites after changing palettes, accents, or surface tokens. Do not lower `AA_NORMAL` or `AA_LARGE` to pass. Pre-existing owner-approved Galaxy Dark values are flag-for-owner values: report a failure rather than retuning them.

5. **Add local background assets deliberately.** Put the bundled `.webp` in `assets/backgrounds/`, add its lazy `require()` slot and stable package order, then add a provenance row with its declared brightest pixel in `assets/backgrounds/README.md`. `none` stays asset-free and resolves to the solid theme background.

   For replacement art, review the complete slot family together, retain each stable ID/package mapping, transcode only the approved source into its existing production filename, and measure the final WebP against the declared brightness ceiling. If it exceeds the ceiling, remaster the art or re-prove the bound and compositing together.

6. **Preserve production adoption.** A bundled slot automatically appears through the shared `BACKGROUND_ORDER`, but verify the Settings label and grouping remain meaningful. Ordinary page roots omit only their full-page background wash; do not mount another `BackgroundHost`. New routes must receive the right density in `src/navigation/focused-route-classification.ts`, and only the actual `Orrery` route may force `none`.

7. **Keep veil, cards, chrome, and controlled-canvas overlays independent.** Tune background visibility through `BACKGROUND_VEIL_OPACITY`; tune matched-mode card glass through `CARD_GLASS_OPACITY`; protect text outside a card with `ChromeScrim`. The Orrery alone may use `ORRERY_OVERLAY_TINT_OPACITY` through `GlassSurface treatment="orrery-overlay"`: it stays translucent in every package/mode, remains at or below the visibility ceiling, and needs AA proof against the brightest actual canvas backdrop. Do not change ordinary card constants to tune it.

8. **Validate durable-settings scope.** Do not edit migration 015. A new persisted setting requires a new forward migration, typed DAO validation, the `PORTABLE_SETTINGS_KEYS` allowlist, and an explicit decision about the backup-format projection. Storing a hex value in SQLite is prohibited; store an ID or NULL.

9. **Preserve accessibility seams.** New icons use `src/components/icons/icon-registry.ts`; status meaning needs an existing or new non-colour cue; Skia ambient motion reads `useReducedMotionShared()` inside a worklet and never uses per-frame React state.

## What You Don't Need to Change

- Do not add a network, CDN, or downloadable-pack path for bundled backgrounds. Profile's explicitly invoked local image workflow is separate: it stores a bounded app-owned derivative and never changes the bundled slot manifest.
- Do not edit a shipped migration or replace `app_settings` with AsyncStorage.
- Do not add a full custom Orbit icon family merely to add one semantic icon.
- Do not mount `BackgroundHost`, `GlassSurface`, or `StatusGlyph` in unrelated legacy screens without the owning renderer phase.

## Pitfalls

1. **An allowlisted backup key is not necessarily emitted.** Phase 23 keeps format-3 exports byte-compatible; do not add theme keys to the portable projection without its format-version work.

2. **One accent hex is insufficient.** `fill`, `onAccent`, and link-text values differ by resolved mode so each role can meet contrast requirements.

3. **A declared asset brightness is a contract.** If final art exceeds the bound, darken/re-master it or retune the declared bound and tint together; never weaken AA.

4. **Reduced motion has multiple consumers.** Gating only an obvious canvas effect can leave another shared-clock effect animating.

5. **A review PNG is not a production asset.** Approval establishes visual direction; the shipped WebP still needs stable-slot, brightest-region, composited-contrast, and physical-device checks.

6. **A mounted background can still be invisible.** The original Phase 31.1 UAT passed static screenshots while the host veil left only 0–12% of the art. Compare two materially different selected slots on the same physical-device route.

7. **Do not make semantic surfaces transparent.** Remove only full-page washes. Inputs, cards, dialogs, sheets, loading/error overlays, crop canvases, and the System Builder authoring canvas retain their own backing.

8. **Do not suppress by top-level tab.** Orrery-stack browse children are ordinary pages and must reveal the same background regardless of navigation origin.

9. **Android elevation and translucent cards conflict.** Elevation can render an opaque inner rectangle over a glassy Galaxy card; retain the iOS shadow without restoring Android elevation.

10. **A controlled canvas is not wallpaper.** Do not apply the Orrery overlay treatment to ordinary cards or modal Sheets; it is a named semantic exception for floating Orrery `GlassSurface` consumers.

## Smoke Test

```bash
npx vitest run src/theme src/navigation/focused-route-classification.test.ts src/stores/theme-store.test.ts
npm run check:colors
npx tsc --noEmit
```

Expected: theme tests pass, the colour gate finds no literals outside `src/theme/`, and TypeScript is clean.

For a bundled background or surface-composition change, select two materially different assets in each package on the physical Pixel and compare the same presentation, comfortable, and dense routes. Confirm the art changes visibly, cards and chrome remain readable in matching and mismatched modes, scroll content moves over a fixed image, Orrery and System Builder show no image bleed, and a no-photo Profile falls through while a resolved Profile photo wins. For a live-motion change, toggle the OS reduced-motion preference while the affected Skia surface is visible.
