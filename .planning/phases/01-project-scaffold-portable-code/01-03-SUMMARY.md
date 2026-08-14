---
phase: 01-project-scaffold-portable-code
plan: 03
subsystem: theme
tags: [theme, tokens, zustand, persist, async-storage, provider, useColorScheme, tdd, vitest, skeleton, FND-05]

# Dependency graph
requires:
  - "01-01: @/* alias, biome.json, vitest runner, shared check:colors gate, src/ folder skeleton, SafeAreaProvider/expo-status-bar/async-storage/zustand deps"
provides:
  - "ThemeMode/ResolvedMode/SystemScheme (RN ColorSchemeName superset)/ThemePalette/ThemePresetId/ThemePreset/ResolvedTheme (src/theme/theme-types.ts)"
  - "THEME_PRESETS single space-dark preset (sole hex location) + pure resolveMode/resolvePalette (no react-native import) (src/theme/theme-presets.ts)"
  - "useThemeStore — Zustand persist store keyed orbit-theme, AsyncStorage backend, mode/presetId + setters (src/stores/theme-store.ts)"
  - "ThemeProvider (subscribes to store, resolves system via useColorScheme) + useTheme (outside-provider dark fallback) + ThemeContext (src/theme/theme-provider.tsx)"
  - "@/theme barrel re-exporting the provider + types/presets (src/theme/index.ts)"
  - "Themed home shell HomeScreen (testID home-shell-root, visible Orbit title) reading colours from tokens (src/screens/HomeScreen.tsx)"
  - "Thin App.tsx entry wrapping HomeScreen in ThemeProvider + SafeAreaProvider (replaces the scaffold #fff placeholder)"
  - "Repo-wide check:colors now enforced green (App.tsx themed) — no colour literal outside src/theme"
affects: [01-05, dashboard, orrery, every-later-UI-phase, ports]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Colour values confined to src/theme/theme-presets.ts; every consumer reads useTheme().colors.*"
    - "Pure node-testable resolvers (resolveMode/resolvePalette) with zero react-native import; system resolved at the App boundary via useColorScheme"
    - "SystemScheme local union = superset of RN ColorSchemeName|null so useColorScheme() passes into resolveMode without coercion (guards the unspecified->dark default)"
    - "Persisted Zustand store DRIVES the provider (mode/presetId selectors) so rehydration restyles the tree — store is live, not dead code"
    - "Flat @/theme barrel; no packages/ui monorepo boundary"

key-files:
  created:
    - src/theme/theme-types.ts
    - src/theme/theme-presets.ts
    - src/theme/theme-presets.test.ts
    - src/theme/theme-provider.tsx
    - src/theme/index.ts
    - src/stores/theme-store.ts
    - src/screens/HomeScreen.tsx
  modified:
    - App.tsx

key-decisions:
  - "One space-dark preset ships as infrastructure (dark palette only); light is optional on ThemePreset so resolvePalette deterministically falls back to dark — the owner's visual design (HANDOFF §7 + Q4) is not pre-empted"
  - "resolveMode form `mode === 'system' ? (scheme === 'light' ? 'light' : 'dark') : mode` — every non-light system value (dark/unspecified/null/undefined) resolves to the dark default; unit-tested including the unspecified case"
  - "SystemScheme typed as superset of RN ColorSchemeName|null (verified in Appearance.d.ts: light|dark|unspecified) so useColorScheme() is assignable without narrowing that would drop unspecified (TS2345) or invert the default"
  - "StatusBar style=\"light\" in App.tsx (space-dark background → light content); App.tsx sits outside the provider so it does not call useTheme"
  - "Reworded the theme-store doc comment to drop the analog project name and per-profile entity token so the store's own acceptance greps (quest-board==0, character==0, single orbit-theme key) hold — doc-only, no behaviour change"

requirements-completed: [FND-05]

coverage:
  - id: T1
    description: "Theme types + single space-dark preset (sole hex location) + pure resolveMode/resolvePalette, node-unit-tested incl. system/unspecified/light fallback"
    requirement: "FND-05"
    verification:
      - kind: unit
        ref: "npx vitest run src/theme/theme-presets.test.ts (6 assertions incl. resolveMode('system','unspecified')->'dark' and resolvePalette(id,'light')===preset.dark); presets file has 0 react-native imports; check:colors src exit 0"
        status: pass
    human_judgment: false
  - id: T2
    description: "Persisted Zustand store (orbit-theme, AsyncStorage) + ThemeProvider SUBSCRIBED to it (system via useColorScheme) + @/theme barrel"
    requirement: "FND-05"
    verification:
      - kind: other
        ref: "grep: provider reads useThemeStore + useColorScheme; store keyed orbit-theme (no cross-project name / entity token); barrel re-exports provider; tsc --noEmit exit 0 (proves resolveMode(mode,useColorScheme()) typechecks)"
        status: pass
    human_judgment: false
  - id: T3
    description: "Themed home shell (HomeScreen, testID home-shell-root, Orbit title) rendered by thin App.tsx; repo-wide colour gate green"
    requirement: "FND-05"
    verification:
      - kind: other
        ref: "npx tsc --noEmit && npx biome check . && npm run check:colors && npx vitest run all exit 0 (48 tests); App.tsx imports ThemeProvider from @/theme + renders HomeScreen; negative colour-control still flags #ff0000/rgba(/white"
        status: pass
    human_judgment: false

# Metrics
duration: 3min
completed: 2026-08-14
status: complete
---

# Phase 1 Plan 03: Theme System & Themed Home Shell Summary

**Landed FND-05: a `useTheme()` provider whose colour values live in exactly one space-dark presets file, driven by a persisted Zustand store (`orbit-theme` / AsyncStorage) that restyles the app on rehydration, with pure `resolveMode`/`resolvePalette` resolvers unit-tested in Vitest (`system`/`unspecified`/`light` fallback all asserted) and a themed `HomeScreen` rendered by a thin `App.tsx` — the whole tree now passes the shared no-hardcoded-colour gate, and tsc/biome/check:colors/vitest are all green.**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-08-14T18:01:03Z
- **Completed:** 2026-08-14T18:04:20Z
- **Tasks:** 3
- **Files created:** 7, modified: 1

## Accomplishments
- **Task 1 (TDD):** Wrote the resolver Vitest suite FIRST — module-not-found RED (`79d8c82`) — then GREEN (`24a9c42`): `theme-types.ts` (mode unions + 8-token `ThemePalette` + `SystemScheme` superset of RN `ColorSchemeName|null`), `theme-presets.ts` (one space-dark preset as the sole hex location + pure `resolveMode`/`resolvePalette`, zero `react-native` import), and 6 passing assertions including `resolveMode("system","unspecified") -> "dark"` and `resolvePalette(id,"light") === preset.dark`.
- **Task 2:** `theme-store.ts` — Zustand `persist` store keyed `orbit-theme` (AsyncStorage, `partialize` persists only `mode`/`presetId`), dropping the analog's per-profile coupling and full-state `.subscribe`. `theme-provider.tsx` — `ThemeProvider` SUBSCRIBES to `useThemeStore` and resolves `system` via `useColorScheme()`, passing the result straight into `resolveMode` (no coercion), deriving the palette in a `useMemo`; `useTheme()` falls back to the default dark palette outside a provider. `index.ts` — the `@/theme` barrel.
- **Task 3:** `HomeScreen.tsx` — the themed shell body (testID `home-shell-root`, visible "Orbit" title + accessibility header) reading every colour from `useTheme().colors.*`; `App.tsx` rewritten as the thin entry wrapping `<HomeScreen/>` in `SafeAreaProvider` + `ThemeProvider` with a themed `StatusBar`, removing the scaffold's sanctioned `#fff`.
- Proved the full gate green repo-wide: `tsc --noEmit`, `biome check .`, `check:colors` (App.tsx + HomeScreen now scanned), and `vitest run` (48 tests: 6 new + 42 ported) all exit 0; the colour-gate negative control still flags `#ff0000`/`rgba(`/`"white"`.

## Task Commits

1. **Task 1 RED: failing resolver suite** — `79d8c82` (test)
2. **Task 1 GREEN: theme types, space-dark preset, pure resolvers** — `24a9c42` (feat)
3. **Task 2: persisted store, provider wired to it, @/theme barrel** — `9a9db4c` (feat)
4. **Task 2 follow-up: reword store comment for acceptance greps** — `62e6e5a` (docs)
5. **Task 3: themed HomeScreen + thin App.tsx entry** — `ca02397` (feat)

## Files Created/Modified
- `src/theme/theme-types.ts` — `ThemeMode`/`ResolvedMode`/`SystemScheme`/`ThemePalette`/`ThemePresetId`/`ThemePreset`/`ResolvedTheme`; no react-native import
- `src/theme/theme-presets.ts` — `THEME_PRESETS` (one space-dark preset — the ONLY hex location), `DEFAULT_PRESET_ID`, pure `resolveMode`/`resolvePalette`
- `src/theme/theme-presets.test.ts` — 6 Vitest assertions over the resolvers (FND-05's real behavioural test)
- `src/theme/theme-provider.tsx` — `ThemeContext`, `ThemeProvider` (store-subscribed, `useColorScheme`-resolved), `useTheme` (outside-provider dark fallback)
- `src/theme/index.ts` — the `@/theme` barrel
- `src/stores/theme-store.ts` — `useThemeStore` persist store (`orbit-theme`, AsyncStorage)
- `src/screens/HomeScreen.tsx` — themed home shell, testID `home-shell-root`, "Orbit" title
- `App.tsx` — thin entry: `SafeAreaProvider` + `ThemeProvider` + `<HomeScreen/>` + themed `StatusBar` (replaces the `#fff` placeholder)

## Decisions Made
- **One space-dark preset, dark palette only.** `ThemePreset.light` is optional so `resolvePalette` falls back to `dark` — `"light"`/`"system"` are DEFINED this phase without pre-empting the owner's palette design (HANDOFF §7 + Q4). Infrastructure, not a finished visual.
- **`SystemScheme` as an RN superset.** Verified `ColorSchemeName = "light" | "dark" | "unspecified"` in `Appearance.d.ts`; the local union adds `null | undefined`, so `useColorScheme()` passes into `resolveMode` unchanged. Narrowing it would reject `"unspecified"` (TS2345) or risk inverting the dark default — the unit test guards exactly that.
- **Store DRIVES the provider.** The provider reads `mode`/`presetId` selectors from `useThemeStore`, so a rehydrated persisted selection re-renders and restyles the tree — the store is live, not dead scaffolding (the review's HIGH fix).
- **`StatusBar style="light"`** in `App.tsx` (dark background → light content); `App.tsx` is outside the provider, so it does not call `useTheme`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Reworded theme-store doc comment to satisfy the plan's own acceptance greps**
- **Found during:** Task 3 acceptance-grep verification (retroactively checking Task 2's file).
- **Issue:** The initial `theme-store.ts` doc comment named the analog project and its per-profile entity to explain what was flattened away. Task 2's acceptance criteria assert `grep -c 'quest-board' == 0`, `grep -c 'character' == 0`, and `grep -c 'orbit-theme' == 1` on that file — the explanatory comment tripped all three.
- **Fix:** Reworded the comment generically ("the analog store", "per-profile coupling") and removed the redundant prose mention of the persist key, leaving only the `name:` field.
- **Files modified:** `src/stores/theme-store.ts`
- **Verification:** Greps now read `quest-board=0 character=0 orbit-theme=1 useThemeStore=1 AsyncStorage=3`; `tsc --noEmit` and `biome check` still exit 0 (doc-only, no behaviour change).
- **Committed in:** `62e6e5a`

**Total deviations:** 1 auto-fixed (1 blocking, doc-only).
**Impact on plan:** None on behaviour or scope — a comment reword to hold the plan's verbatim greps.

## Known Stubs
None. The theme module, store, provider, barrel, and shell are complete and wired: the store drives the provider, the provider is consumed by a real rendered screen, and the resolvers are behaviour-covered. The single space-dark preset (dark-only) is intentional, plan-sanctioned infrastructure — the fuller palette (light mode, additional presets) is the owner's future visual-design call, not an unwired stub.

## TDD Gate Compliance
Task 1 followed RED → GREEN: `79d8c82` (test, module-not-found failure) precedes `24a9c42` (feat, 6 tests pass). No REFACTOR needed. Tasks 2–3 are non-TDD `type="auto"` per the plan.

## Threat Flags
None beyond the plan's register. T-1-03 (theme-store → AsyncStorage) is disposition **accept**: `partialize` persists only the non-sensitive `mode`/`presetId`, AsyncStorage is OS-sandboxed, and no network read path is introduced. No new trust boundary or security surface was added.

## Verification Evidence
- `npx tsc --noEmit` — exit 0
- `npx biome check .` — exit 0 (the pre-existing `recommended` deprecation *info* from 01-01 is non-blocking)
- `npm run check:colors` — exit 0 repo-wide (App.tsx + HomeScreen scanned); negative control flags `#ff0000`/`rgba(`/`"white"` (exit 1)
- `npx vitest run` — 3 files, 48 tests pass (6 new resolver + 42 ported from 01-02, no regression)
- `grep -c "from 'react-native'" src/theme/theme-presets.ts` == 0 (resolvers stay node-pure)

## Next Phase Readiness
- FND-05 satisfied: the token architecture the entire app (including future Skia draw calls) reads from is in place, the Zustand+persist pattern is proven once, and the app opens to a themed shell locally.
- Plan **01-05** can now prove FND-01 on the Pixel by asserting the rendered "Orbit" title (primary) and `home-shell-root` testID (secondary) via `uiautomator dump`.
- No blockers introduced. Standing project blockers unchanged (droid SSH/rsync build bring-up in 01-05; graphify ADR-bridge still deferred).

## Self-Check: PASSED

All 7 created files verified present on disk (`theme-types.ts`, `theme-presets.ts`, `theme-presets.test.ts`, `theme-provider.tsx`, `index.ts`, `theme-store.ts`, `HomeScreen.tsx`) plus modified `App.tsx`; all five task commits (`79d8c82`, `24a9c42`, `9a9db4c`, `62e6e5a`, `ca02397`) verified in git history.

---
*Phase: 01-project-scaffold-portable-code*
*Completed: 2026-08-14*
