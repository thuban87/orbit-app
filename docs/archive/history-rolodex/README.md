# Archived: the History Rolodex browser

**Archived in Phase 38.8 (History Navigation UX). Reference only. Not production code.**

## What these files were

| File | What it did |
|---|---|
| `RolodexBrowser.tsx` | The Profile History date browser: three synchronized Month / Day / Year wheels (Day the primary axis), per-date markers, and a summary drawer whose "See details" opened the shared Date Detail Sheet and whose "Log interaction" opened the detailed Log form for the picked date. It owned the pause-on-blur lifecycle for the wheels. |
| `RolodexWheel.tsx` | One snapping wheel column (react-native-gesture-handler + Reanimated), with the interaction / lifecycle-only date markers. |
| `rolodex-logic.ts` | The wheel date math: rolling Day across Month/Year boundaries, leap-aware clamping, today as the maximum, marker lookup and the drawer summary text. |
| `rolodex-logic.test.ts` | Its vitest suite. |

The design was recorded in ADR-121 (Rolodex Month/Day/Year History browser).

## Why it was archived, not deleted

- **38.8 D-10** replaced the Rolodex with an activity-first stream of the contact's records, newest first, inside the same Profile History section. A user no longer has to pick a date before seeing anything. This supersedes ADR-121 in full.
- **38.8 D-12** (owner ruling): keep the Rolodex as reference rather than deleting it.
- **38.8 D-13**: the archive mechanics below.

## Status

- **No production imports.** Nothing under `src/` imports these files, and they are not behind a runtime flag. Metro bundles only what `src/` imports, so none of this ships.
- **Excluded from every tool:**
  - **tsc:** `tsconfig.json` `exclude` lists `docs/archive`, alongside a re-listing of Expo's base excludes (a local `exclude` replaces the inherited one).
  - **vitest:** `vitest.config.ts` includes only `src/**/*.test.ts(x)`, so `rolodex-logic.test.ts` is kept but never run.
  - **Biome:** `biome.json` `files.includes` has `"!docs/archive"`.
  - **graphify:** `.graphifyignore` lists `docs/archive/`.
  - **check:colors** scans `src` and `App.tsx` only.
- **Not expected to compile.** The imports still point at `src/` paths (`@/components/history/RolodexWheel`, `@/db/history-read`, `@/theme`, and so on). Those modules keep changing, and some of these paths no longer exist, so the code drifts. Read it; do not import it.
- **Theme tokens kept.** The wheels' marker colours, `markerInteraction` and `markerLifecycle`, stay in `ThemePalette` and all four presets. At archive time a consumer grep (`grep -rn "markerInteraction\|markerLifecycle" src`) found them used only by `RolodexWheel.tsx` and the theme definitions (`src/theme/theme-types.ts`, `src/theme/theme-presets.ts`). Removing them would edit `ThemePalette` and four presets for no user benefit, so they were kept (D-13).
