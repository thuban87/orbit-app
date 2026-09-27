# Theme & Visual System Maintenance

## Overview

Use this process when adding a curated accent, bundled background slot, semantic theme token, or a complete theme package. It preserves Orbit's local-only appearance system, durable option-ID settings, token-only colour rule, and contrast/accessibility checks.

## Architecture (Phases 23, 31, 31.1, 38.1, 38.4)

`app_settings` stores a package plus per-package mode, accent ID, and background ID. `ThemeProvider` resolves the active package and OS appearance, then applies a curated accent tone at render time. Palette hex values live only under `src/theme/`; screens receive resolved semantic tokens through `useTheme()`.

### Resolution order

1. **SQLite selection** — `src/db/app-settings-dao.ts` returns the active package and remembered package-specific values.
2. **Mode resolution** — `src/theme/theme-provider.tsx` resolves Light, Dark, or Follow System.
3. **Palette and accent** — `src/theme/theme-presets.ts` selects one complete palette; `src/theme/accents.ts` overlays `{ fill, onAccent, text }`.
4. **Background and shell** — `src/theme/backgrounds.ts` resolves a local asset or solid fallback; one `BackgroundHost` in `RootNavigator` renders it fixed behind transparent ordinary routes.
5. **Route treatment** — `src/navigation/focused-route-classification.ts` selects presentation, comfortable, or dense treatment and suppresses the image only on the Orrery visualization.
6. **Readable composition** — `src/theme/tokens/surface.ts` independently selects the host veil, mode-aware card tint, protected chrome opacity, and the controlled-canvas Orrery overlay treatment.
7. **Glass foreground scope** — in Standard Light over an asset background only, `src/theme/glass-foregrounds.ts` resolves a `glassColors` palette. `GlassSurface` cards, `ChromeScrim` and the `ShellAppBar` re-provide it to their descendants through `GlassForegroundScope`. There `textSecondary` resolves to `textPrimary`, and the on-glass status hues, `rogue`, `danger` and every accent's `accentText` resolve to darker lightness-only variants (RG-029, D-24, D-26). Overlays reset to the root palette through `UnscopedTheme`.

## File Locations

| File | Purpose |
|---|---|
| `src/theme/theme-option-ids.ts` | Single canonical accent and background option-ID lists. |
| `src/theme/theme-types.ts` | Package, mode, palette, and theme-token type contracts. |
| `src/theme/theme-presets.ts` | Complete palette values; the normal home for palette hex literals. |
| `src/theme/accents.ts` | Curated accent tone triples and package defaults. |
| `src/theme/backgrounds.ts` | Local background manifest, stable ordering, solid fallback, and each slot's declared `darkestPixel` / `brightestPixel` bounds. |
| `src/theme/native-color-scheme.ts` | Drives the native night mode (RN `Alert`, date/time pickers) from the active package's mode setting; "system" → `"unspecified"` (D-50). |
| `src/theme/glass-foregrounds.ts` | Standard-Light glass foreground palette (`resolveGlassForegroundPalette`), its lightness-only variants, and the pure scoped-value helpers. |
| `scripts/measure-background-extrema.py` | Decodes every bundled asset and validates the declared bounds against each tint regime's composite extrema (`--check`, `--self-test`). |
| `scripts/background-extrema-regimes.json` | The card/chrome tint regimes the script composites; a sync guard in `surface.test.ts` keeps it equal to the proof. |
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

   Every slot declares BOTH a `darkestPixel` and a `brightestPixel` in `src/theme/backgrounds.ts`. Run `python3 scripts/measure-background-extrema.py --check` for any new or changed asset. It decodes the file, composites every pixel under each card/chrome tint regime, and fails if a declared bound does not enclose that regime's composite extremum. Raw-luminance extrema are not enough, because an sRGB tint blend reorders luminance across hues. If the check fails, use the channel-wise bounds the script reports. If you change a card or chrome tint or opacity, update `scripts/background-extrema-regimes.json` too; the sync guard fails otherwise.

   For replacement art, review the complete slot family together, retain each stable ID/package mapping, transcode only the approved source into its existing production filename, and measure the final WebP against the declared brightness ceiling. If it exceeds the ceiling, remaster the art or re-prove the bound and compositing together.

6. **Preserve production adoption.** A bundled slot automatically appears through the shared `BACKGROUND_ORDER`, but verify the Settings label and grouping remain meaningful. Ordinary page roots omit only their full-page background wash; do not mount another `BackgroundHost`. New routes must receive the right density in `src/navigation/focused-route-classification.ts`, and only the actual `Orrery` route may force `none`.

7. **Keep veil, cards, chrome, and controlled-canvas overlays independent.** Tune background visibility through `BACKGROUND_VEIL_OPACITY`; tune matched-mode card glass through `CARD_GLASS_OPACITY`; protect text outside a card with `ChromeScrim`. The Orrery alone may use `ORRERY_OVERLAY_TINT_OPACITY` through `GlassSurface treatment="orrery-overlay"`: it stays translucent in every package/mode, remains at or below the visibility ceiling, and needs AA proof against the brightest actual canvas backdrop. Do not change ordinary card constants to tune it.

8. **Validate durable-settings scope.** Do not edit migration 015. A new persisted setting requires a new forward migration, typed DAO validation, the `PORTABLE_SETTINGS_KEYS` allowlist, and an explicit decision about the backup-format projection. Storing a hex value in SQLite is prohibited; store an ID or NULL.

9. **Keep the both-extrema proof and the glass scope honest.** `src/theme/tokens/surface.test.ts` composites each tint over BOTH declared extrema. It requires the floor at each extremum, and it requires the foreground luminance to lie strictly OUTSIDE the composite-luminance interval. A mid-tone foreground can pass both endpoints while some pixel in between composites to nearly 1:1 against it. The proof asserts the same effective palette the app renders (`resolveGlassForegroundPalette(...) ?? palette`).
   - **A new foreground rendered on Standard glass/chrome must be added to the proof or given a written exclusion.** Every exclusion in `PROOF_EXCLUSIONS` carries a justification and an inventory reference. An exclusion that is the owner's call is marked `held-for-owner` and scoped as narrowly as possible. Fix a failure by lowering only HSL lightness in a Standard-Light glass variant. A hue change, glass opacity, artwork or a Galaxy/Standard Dark retune is the owner's call.
   - **Scope boundaries.** The scope applies inside a `GlassSurface` card (not the Orrery overlay), a `ChromeScrim`, and the `ShellAppBar` title/Back/trailing content. It resets in every overlay built on `overlay-base` (Modal, Sheet, ConfirmDialog) and in the `OverflowMenu` sheet through `UnscopedTheme`. An opaque surface that reads colours above its own boundary uses `useUnscopedTheme()`. A `GlassSurface` card inside an overlay re-enters the scope.
   - **`textPlaceholder`.** Input placeholders use `textPlaceholder`. It equals `textSecondary` in every palette, and the glass scope never overrides it, because inputs sit on their own surface.

10. **Preserve accessibility seams.** New icons use `src/components/icons/icon-registry.ts`; status meaning needs an existing or new non-colour cue; Skia ambient motion reads `useReducedMotionShared()` inside a worklet and never uses per-frame React state.

## Native dialogs follow Orbit's mode (D-50)

RN `Alert` confirmations and the Android date/time picker dialogs are native surfaces Orbit does not paint. They take their light or dark look from the activity's night configuration, not from `useTheme()`.

- **The rule.** The active package's mode *setting* drives the native night mode. `ThemeProvider` calls `useNativeColorSchemeSync(activeMode)` once, with the same `activeMode` its palette resolution uses.
- **The helper.** `src/theme/native-color-scheme.ts` holds `nativeColorSchemeFor(mode)` (light → `"light"`, dark → `"dark"`, system → `"unspecified"`) and `useNativeColorSchemeSync(mode)`. The hook calls `Appearance.setColorScheme` from an effect keyed on the mode. RN core maps that to `AppCompatDelegate.setDefaultNightMode`. The Expo AppTheme is DayNight and MainActivity handles `uiMode`, so nothing is recreated and no native package is needed.
- **The guard.** "system" must map to `"unspecified"`, never to the resolved mode. Once the native mode is forced, `useColorScheme()` reports the override. Passing a resolved value would freeze Orbit's own System mode on the last forced value. `native-color-scheme.test.ts` pins the mapping, the guard and the `ThemeProvider` call site.
- `app.json` `userInterfaceStyle` plays no part on Android (without `expo-system-ui` it only produces a prebuild warning). Do not add `expo-system-ui` for this; that is a native dependency and an owner decision. Evidence: `.planning/phases/38.4-audit-remediation-ui-performance-release/38.4-NATIVE-CONFIG-INVESTIGATION.md`.
- Surfaces in other processes (the system photo picker, DocumentsUI, the share chooser, the keyboard, notifications, the widget host) keep following the device.

## Read colours inside the scope (D-34)

`GlassForegroundScope` re-provides the theme only inside a `GlassSurface` card, a `ChromeScrim` and a `ShellAppBar` `trailing` subtree. In Standard Light over an asset it swaps in the glass palette there (`textSecondary` → primary, darker `danger`/status/`rogue`/`accentText`).

- **The rule.** Only a hook called INSIDE that subtree sees the glass palette. A host that calls `useTheme()` once at its top and uses `colors.*` inside its own card renders the ROOT tone there, even though the palette-level proof passes. The same holds for a local variable, JSX value or helper built above the card, a `ThemePalette` parameter, a `colors[key]` lookup, and a whole palette handed to a child or helper.
- **The helper.** Put `ScopedPalette` (`src/components/ui/ScopedPalette.tsx`, imported by module path) as a child inside the scope and read the render prop: `<GlassSurface><ScopedPalette>{(scoped) => <Text style={{ color: scoped.danger }} />}</ScopedPalette></GlassSurface>`. It adds no node, style or colour. A child component that calls `useTheme()` itself works too. Placeholders stay on `colors.textPlaceholder` (never the scoped palette, Pitfall 9).
- **Deliberate root reads.** `useUnscopedTheme()` (opaque surfaces nested inside a scope) and `useGlassForegroundColors()` (a component that draws its own backing) are exempt by design.
- **The contract.** `src/theme/glass-scope-read-contract.test.ts` (analyzer: `src/theme/__contract__/glass-scope-reads.ts`, test support only) fails with `file:line` on any glass-overridden token read through a palette resolved above the scope. The overridden-token set is derived from `resolveGlassForegroundPalette`, so a new override widens the contract automatically. It also pins the list of discovered scope slots (`ProfileSection` `children`/`headerAction`, `AIConnectionScreen`'s `card(…, body)`); a new wrapper that renders a `ReactNode` prop inside a card changes that list. Its allowlist is empty; an entry needs a reason that the read is deliberately root.
- **Blind spot.** A plain colour string resolved above a scope in one file and passed as a prop to a component that renders it inside its own card in another file is not traced. Check such sites on the device.

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

11. **A palette token cannot tell text from fill.** Inside Standard-Light glass the darker `danger` and status variants also darken destructive fills, borders and status rings drawn in a card. Review them on the device, not only in the proof.

12. **Text bare on the art is not glass.** Captions and errors with no `GlassSurface`, `ChromeScrim` or opaque backing sit on the veiled art. The glass scope does not reach them, and neither does the proof (38.4 finding F-1, owner device review in Plan 17).

13. **Android blur is off for now (D-61).** `GlassSurface` passes `blurMethod="none"` on its `BlurView`. expo-blur's Dimezis methods need a `blurTarget`; without one they silently fall back to no blur and warn on every mount. `"none"` keeps the identical native tint fallback, so do not "fix" it by removing the `BlurView` on Android (that drops the tint layer and thins Galaxy cards). Real Android blur needs a `BlurTargetView` host and is out of 38.4. `glass-surface-blur.contract.test.ts` guards it.

## Smoke Test

```bash
python3 scripts/measure-background-extrema.py --self-test
python3 scripts/measure-background-extrema.py --check
npx vitest run src/theme src/navigation/focused-route-classification.test.ts src/stores/theme-store.test.ts
npm run check:colors
npx tsc --noEmit
```

Expected: theme tests pass, the colour gate finds no literals outside `src/theme/`, and TypeScript is clean.

For a bundled background or surface-composition change, select two materially different assets in each package on the physical Pixel and compare the same presentation, comfortable, and dense routes. Confirm the art changes visibly, cards and chrome remain readable in matching and mismatched modes, scroll content moves over a fixed image, Orrery and System Builder show no image bleed, and a no-photo Profile falls through while a resolved Profile photo wins. For a live-motion change, toggle the OS reduced-motion preference while the affected Skia surface is visible.

## Accent roles: fill, text, on-fill (D-63)

ADR-084 gives the accent three roles, and every foreground picks one:

- **`accent` is a FILL only.** Backgrounds, borders, tracks and Skia shape paints. Never a text or glyph colour, including inside a ternary (`tone={isFavourite ? "accent" : …}`) or a multi-line style object.
- **`accentText` is the text/glyph role** on any non-accent surface (links, selected-chip labels, the favourite star, selection checks, state captions). Inside a glass card read it through the scope (`ScopedPalette`, or `Icon tone="accentText"`, which resolves inside the card by construction) so the D-26 Standard-Light glass variant reaches the screen.
- **`onAccent` is the label or glyph ON an accent fill.** Never the page `background` token: ADR-084 validates only `onAccent` on `fill`. This includes tone-object helpers that return `{ background, border, text }` for a selected segment.
- **Kept graphics.** The tab-bar active tint and the pull-to-refresh spinner stay on `accent` (owner, D-63).
- **The contract.** `src/theme/accent-foreground-role-contract.test.ts` (analyzer: `src/theme/__contract__/accent-foreground-roles.ts`, test support only) walks the AST of every non-test `src/` file. It checks every `color`/`tone`/`tintColor`/`glyphColor`/`placeholderTextColor` slot and tone-object `text`/`label` key, follows ternary arms, `??`/`||`, call arguments and same-file `const` aliases, and fails with `file:line` and the fix. Its allowlist holds only the two graphic tints and Skia canvas paints, each with a reason; a stale entry fails. The per-site record is `38.4-RG029-INVENTORY.md` Table F.

## Changelog

- **2026-09-26 — Phase 38.4 Plan 03 (RG-029 / `ui-accessibility/AUD-UIA-001`; D-12, D-24, D-26, D-27).** Added `darkestPixel` and `scripts/measure-background-extrema.py --check`, the both-extrema + interval proof, the Standard-Light glass foreground scope (`GlassForegroundScope`, `UnscopedTheme`, `useUnscopedTheme`, `useGlassForegroundColors`) with lightness-only variants, the `textPlaceholder` token, and the rule that a new foreground on Standard glass is proven or excluded in writing.
- **2026-09-27 — Phase 38.4 Plan 22 (D-50 / `OA-D4`).** Added "Native dialogs follow Orbit's mode": `native-color-scheme.ts` (`nativeColorSchemeFor`, `useNativeColorSchemeSync`), called once from `ThemeProvider` with the active package's mode setting; "system" → `"unspecified"` feedback-loop guard; `userInterfaceStyle` recorded as inert on Android.
- **2026-09-27 — Phase 38.4 Plan 20 (D-34 / RG-029 `ui-accessibility/AUD-UIA-001`).** Added "Read colours inside the scope (D-34)": `ScopedPalette`, the glass-scope read contract and its analyzer. The 48 out-of-scope reads (17 files) were moved inside their scopes (inventory Table E). D-61: Android blur off for now (`blurMethod="none"`, Pitfall 13).
- **2026-09-27 — Phase 38.4 code review fix pass 2 (D-63, owner; ADR-084).** Added "Accent roles: fill, text, on-fill (D-63)": 33 accent-as-text sites → `accentText` and 47 labels on accent fills → `onAccent`, locked by the repo-wide AST contract `accent-foreground-role-contract.test.ts`; tab-bar and pull-to-refresh tints kept.
