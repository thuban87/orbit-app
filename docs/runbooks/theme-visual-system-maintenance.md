# Theme & Visual System Maintenance

## Overview

Use this process when adding a curated accent, bundled background slot, semantic theme token, or a complete theme package. It preserves Orbit's local-only appearance system, durable option-ID settings, token-only colour rule, and contrast/accessibility checks.

## Architecture (Phase 23)

`app_settings` stores a package plus per-package mode, accent ID, and background ID. `ThemeProvider` resolves the active package and OS appearance, then applies a curated accent tone at render time. Palette hex values live only under `src/theme/`; screens receive resolved semantic tokens through `useTheme()`.

### Resolution order

1. **SQLite selection** — `src/db/app-settings-dao.ts` returns the active package and remembered package-specific values.
2. **Mode resolution** — `src/theme/theme-provider.tsx` resolves Light, Dark, or Follow System.
3. **Palette and accent** — `src/theme/theme-presets.ts` selects one complete palette; `src/theme/accents.ts` overlays `{ fill, onAccent, text }`.
4. **Background and surface** — `src/theme/backgrounds.ts` resolves a local asset or solid fallback; `src/theme/tokens/surface.ts` selects glass/flat treatment.

## File Locations

| File | Purpose |
|---|---|
| `src/theme/theme-option-ids.ts` | Single canonical accent and background option-ID lists. |
| `src/theme/theme-types.ts` | Package, mode, palette, and theme-token type contracts. |
| `src/theme/theme-presets.ts` | Complete palette values; the normal home for palette hex literals. |
| `src/theme/accents.ts` | Curated accent tone triples and package defaults. |
| `src/theme/backgrounds.ts` | Local background manifest, stable ordering, and solid fallback. |
| `src/theme/tokens/surface.ts` | Package surface treatment and compositing helpers. |
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

6. **Validate durable-settings scope.** Do not edit migration 015. A new persisted setting requires a new forward migration, typed DAO validation, the `PORTABLE_SETTINGS_KEYS` allowlist, and an explicit decision about the backup-format projection. Storing a hex value in SQLite is prohibited; store an ID or NULL.

7. **Preserve accessibility seams.** New icons use `src/components/icons/icon-registry.ts`; status meaning needs an existing or new non-colour cue; Skia ambient motion reads `useReducedMotionShared()` inside a worklet and never uses per-frame React state.

## What You Don't Need to Change

- Do not add a network, CDN, download, or user-upload path for backgrounds.
- Do not edit a shipped migration or replace `app_settings` with AsyncStorage.
- Do not add a full custom Orbit icon family merely to add one semantic icon.
- Do not mount `BackgroundHost`, `GlassSurface`, or `StatusGlyph` in unrelated legacy screens without the owning renderer phase.

## Pitfalls

1. **An allowlisted backup key is not necessarily emitted.** Phase 23 keeps format-3 exports byte-compatible; do not add theme keys to the portable projection without its format-version work.

2. **One accent hex is insufficient.** `fill`, `onAccent`, and link-text values differ by resolved mode so each role can meet contrast requirements.

3. **A declared asset brightness is a contract.** If final art exceeds the bound, darken/re-master it or retune the declared bound and tint together; never weaken AA.

4. **Reduced motion has multiple consumers.** Gating only an obvious canvas effect can leave another shared-clock effect animating.

## Smoke Test

```bash
npx vitest run src/theme
npm run check:colors
npx tsc --noEmit
```

Expected: theme tests pass, the colour gate finds no literals outside `src/theme/`, and TypeScript is clean.

For a background change, also inspect every Galaxy asset's brightest region on a physical device with text over the rendered surface. For a live-motion change, toggle the OS reduced-motion preference while the affected Skia surface is visible.
