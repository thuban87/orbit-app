---
phase: 23-theme-visual-system
plan: 02
subsystem: theme
tags: [theme, typography, fonts, tokens, spacing, radii, expo-font, boot, THEME-07]

# Dependency graph
requires:
  - phase: 23-01
    provides: durable theme + package-axis layer + App.tsx boot ready gate (theme read folded in)
  - phase: 13-orrery
    provides: bundled Inter-SemiBold.ttf + runtime useFonts precedent (Skia pipeline, separate)
provides:
  - three runtime deps installed SDK-57-pinned (@expo/vector-icons, expo-font, expo-blur)
  - locally-bundled fonts (Inter-Regular, SpaceGrotesk-SemiBold) + assets/README.md provenance
  - src/theme/fonts.ts — expo-font font map + loadAppFonts() non-fatal load helper (folded into boot gate)
  - TYPOGRAPHY (5 roles / 4 sizes / 2 weights), SPACING (xs..2xl), RADII (sm..full) — pure, node-tested, colour-literal-free tokens
  - AppText role primitive — reflow-preserving <Text> (THEME-07)
affects: [23-03 accents, 23-05 icons, 23-06 backgrounds/surface, 23-07 modals/buttons, Phase 15 screen adoption]

actuals:
  tokens: 4400
  tasks: 3
  commits: 4

tech-stack:
  added:
    - "@expo/vector-icons@^15.0.2 (SDK-57 matched, resolves 15.1.1)"
    - "expo-font@~57.0.3"
    - "expo-blur@~57.0.2"
  patterns:
    - "Node-testable font loader: require() of .ttf assets and of expo-font live INSIDE functions (mirrors reconcile-photo.ts / encryption.ts) so the module imports react-native-free; tests inject a fake loader"
    - "Non-fatal boot side effect: loadAppFonts() catches/logs and RESOLVES, awaited via Promise.all alongside hydrateThemeAtBoot in the ready gate so a font failure degrades to system font without blocking boot"
    - "Pure-data token modules with a colour TOKEN NAME (not a hex) so check:colors stays clean and colour resolves through useTheme() at render"

key-files:
  created:
    - assets/Inter-Regular.ttf
    - assets/SpaceGrotesk-SemiBold.ttf
    - assets/README.md
    - src/theme/fonts.ts
    - src/theme/fonts.test.ts
    - src/theme/tokens/typography.ts
    - src/theme/tokens/typography.test.ts
    - src/theme/tokens/spacing.ts
    - src/theme/tokens/radii.ts
    - src/components/ui/AppText.tsx
  modified:
    - package.json
    - package-lock.json
    - App.tsx

key-decisions:
  - "expo-font's OPTIONAL config plugin is deliberately NOT added to app.config.ts. The expo CLI suggested it, but the plan folds the load into the runtime boot gate (Font.loadAsync via loadAppFonts), matching the 13-05 Skia runtime useFonts precedent that shipped on device. @expo/vector-icons and expo-blur ship no config plugin (adding either would be a prebuild error — 01-01 dedupe lesson). No plugins entry added for any of the three."
  - "AppText's `role` prop OMITS RN's accessibility `role` from the extended TextProps (Omit<TextProps, 'role'>) so the semantic typography role owns the name; callers needing the a11y role use accessibilityRole."
  - "Font-map keys are weight-specific (Inter-Regular / Inter-SemiBold / SpaceGrotesk-SemiBold) because Android does not reliably synthesize a weight from one custom family; AppText maps (semantic family, weight) -> the loaded key."
  - "lineHeight stored as absolute px (size × UI-SPEC multiplier), NOT a fixed height/clamp — reflow under OS scaling is preserved."
  - "Inter-Regular is v3.019 (via @expo-google-fonts/inter static TTF) while the existing Inter-SemiBold is v4.000; minor cross-weight metric skew accepted for this primitives phase, documented in assets/README.md, owner-retunable."

requirements-completed: [THEME-07]

coverage:
  - id: T1
    description: "loadAppFonts() resolves (non-fatal) on a rejected/thrown font load, degrading to the system font so a font error never blocks the boot ready gate"
    requirement: THEME-07
    verification:
      - kind: unit
        ref: "src/theme/fonts.test.ts"
        status: pass
    human_judgment: false
  - id: T2
    description: "TYPOGRAPHY = exactly 5 roles over 4 sizes and 2 weights; label vs caption share 14 and diverge by weight + colour token; SPACING all multiples of 4; RADII include pill 999 + full 9999; no colour literal"
    requirement: THEME-07
    verification:
      - kind: unit
        ref: "src/theme/tokens/typography.test.ts"
        status: pass
    human_judgment: false
  - id: T3
    description: "AppText resolves role -> family/size/weight/lineHeight from TYPOGRAPHY and colour from useTheme(); no allowFontScaling={false}, no fixed height / numberOfLines on reflowable text; font load folded into App.tsx ready gate"
    requirement: THEME-07
    verification:
      - kind: static
        ref: "grep (no allowFontScaling={false} / no clamp) + tsc + check:colors on AppText.tsx & App.tsx"
        status: pass
    human_judgment: false
  - id: T4
    description: "On a Pixel with large OS text: AppText content wraps/grows rather than truncating or shrinking; long multibyte + long-word strings reflow without clipping; correct fonts render on first paint"
    verification: []
    human_judgment: true
    rationale: "Reflow + first-paint font correctness are UI-observable on a Pixel only; node/props checks prove the primitive contract but not the rendered frame. Deferred to the end-of-phase device UAT (UI-SPEC OS-text-scaling backstop)."

duration: 20min
completed: 2026-09-03
status: complete
---

# Phase 23 Plan 02: Typographic & Layout Foundation Summary

**Installed the phase's runtime deps (SDK-57-pinned), bundled Inter + Space Grotesk locally with a provenance README, defined the semantic typography/spacing/radii tokens as pure node-tested data, and shipped an OS-text-scaling-respecting `AppText` primitive with the font load folded into the boot ready gate as a non-fatal degrade — the token vocabulary + installed deps the rest of Phase 23 builds on.**

## Performance

- **Duration:** ~20 min
- **Tasks:** 3 executed (Task 2 via TDD RED→GREEN)
- **Commits:** 4 task commits (1 deps/fonts + RED test + GREEN tokens + AppText/boot) + this docs commit

## Accomplishments

- **Task 1 — deps + fonts (16ce6ce):** `npx expo install @expo/vector-icons expo-font expo-blur` (pinned `~57.0.x` / `^15.0.2`; lockfile committed and `npm ls`-consistent). Verified the three packages declare **no** install/postinstall scripts and that the only root postinstall is the known `patch-package`. Bundled `Inter-Regular.ttf` + `SpaceGrotesk-SemiBold.ttf` (SIL OFL 1.1, static TTFs) with `assets/README.md` recording per-font provenance/version/license. `src/theme/fonts.ts` exposes the expo-font map + `loadAppFonts()` that catches/logs and **resolves** on failure (degrade to system font); `fonts.test.ts` proves the non-fatal degrade on a rejected and a synchronously-thrown load. `require()` of `.ttf` + `expo-font` live inside functions so the module stays node-importable.
- **Task 2 — tokens, TDD (RED c5fddf5 → GREEN 733afa3):** `typography.ts` (5 roles / 4 sizes 28·20·16·14 / 2 weights 400·600; label vs caption share 14, diverge by weight + colour token), `spacing.ts` (xs4/sm8/md12/base16/lg24/xl32/2xl48), `radii.ts` (sm8/md12/lg16/xl24/pill999/full9999). All three RN-free and colour-literal-free (colour is a token NAME). `typography.test.ts` asserts the role/size/weight/divergence invariants + spacing 4-multiples + radii pill/full — 10 assertions.
- **Task 3 — AppText + boot gate (6bc01a5):** `src/components/ui/AppText.tsx` resolves `role` → family/size/weight/lineHeight from `TYPOGRAPHY` and colour from `useTheme()`; it sets **no** `allowFontScaling={false}` and imposes **no** fixed height / default `numberOfLines`, so OS text scaling reflows (THEME-07). `App.tsx` awaits `loadAppFonts()` via `Promise.all` alongside `hydrateThemeAtBoot` inside the ready gate, so first paint carries the real fonts and a font failure never reaches the boot catch.

## Verification

- `npx vitest run` — **1929/1929 pass** (202 files), including the new `fonts.test.ts` (3) and `tokens/typography.test.ts` (10).
- `npm run check:colors src/theme/tokens` and `... src/components/ui/AppText.tsx App.tsx` — **exit 0** (no hex outside `src/**/theme/**`).
- `npx tsc --noEmit` — **clean**.
- `npx @biomejs/biome check` on all 8 changed source files — **clean**.
- Acceptance greps: three deps present in `package.json`; `loadAppFonts` awaited inside the boot effect; no `allowFontScaling={false}` / no clamp in AppText (only the doc comment describing the contract matches the grep).
- **Device UAT (end-of-phase Pixel pass) — deferred:** large-text reflow, multibyte/long-word wrapping, and first-paint font correctness are UI-observable only (coverage T4, human_judgment).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] AppText `role` prop collided with RN TextProps accessibility `role`**
- **Found during:** Task 3 (tsc)
- **Issue:** `interface AppTextProps extends TextProps` failed TS2430 — RN's `TextProps.role` is the a11y `Role` union, incompatible with the typography `TypographyRole`.
- **Fix:** `extends Omit<TextProps, "role">` so the semantic role owns the prop name; callers use `accessibilityRole` for a11y.
- **Files modified:** src/components/ui/AppText.tsx
- **Commit:** 6bc01a5

**2. [Rule 3 - Blocking] biome format on fonts.ts**
- **Found during:** Task 3 (biome sweep)
- **Issue:** the `loadAppFonts` signature / Logger.error call needed biome's line-wrapping.
- **Fix:** `biome check --write` reformat (no semantic change).
- **Files modified:** src/theme/fonts.ts
- **Commit:** 6bc01a5

## Known Stubs

None. The `standard` package placeholder palette and unwired theme setters noted in 23-01 remain owned by later plans (23-03/06); this plan adds no new stub. Screen adoption of AppText and the Appearance settings UI are **Phase 15 by design** (REVIEWS scope note) — this plan ships the primitive + token vocabulary only, so unmigrated raw `<Text>` surfaces are a recorded scope boundary, not a stub.

## Self-Check: PASSED

- All created files exist on disk (fonts.ts/.test, tokens/typography.ts/.test, spacing.ts, radii.ts, AppText.tsx, assets/Inter-Regular.ttf, assets/SpaceGrotesk-SemiBold.ttf, assets/README.md, this SUMMARY).
- Task commits present in git history: 16ce6ce, c5fddf5, 733afa3, 6bc01a5.
