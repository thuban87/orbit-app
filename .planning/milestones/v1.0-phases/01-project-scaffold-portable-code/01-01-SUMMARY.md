---
phase: 01-project-scaffold-portable-code
plan: 01
subsystem: infra
tags: [expo, react-native, typescript, biome, vitest, tsx, expo-sqlite, zustand, scaffold]

# Dependency graph
requires: []
provides:
  - Flat (non-monorepo) Expo SDK 57 app scaffolded into the existing repo without clobbering HANDOFF.md/docs/.planning/.claude/.git
  - Pinned stack: expo ~57.0.13, RN 0.86.2, React 19.2.3, expo-sqlite, zustand, async-storage, safe-area-context; devDeps @biomejs/biome 2.5.8, vitest, tsx, @types/node
  - Committed package-lock.json (01-05 rsyncs it to droid and installs via npm ci)
  - Portrait lock + @/* tsconfig alias + tsx-loaded app.config.ts that merges app.json
  - Biome config with logger.ts + *.test.ts rule overrides (keeps 01-02 lint-clean)
  - Vitest runner (node env, passWithNoTests, absolute @ alias)
  - Shared no-hardcoded-colour gate (npm run check:colors) reused from 01-03 on
  - All eight CLAUDE.md src/ folders tracked (FND-06 layout complete)
  - Green baseline: tsc --noEmit, biome check ., vitest run, expo config all exit 0
affects: [01-02, 01-03, 01-04, 01-05, theme, ports, every-later-phase]

# Tech tracking
tech-stack:
  added: [expo@~57.0.13, expo-sqlite, expo-status-bar, react-native-safe-area-context, "@react-native-async-storage/async-storage", zustand, "@biomejs/biome@2.5.8", vitest, tsx, "@types/node"]
  patterns: ["@/* path alias -> ./src/*", "functional app.config.ts merging app.json via ({ config })", "tsx/cjs hook for TS app config", "shared check-colors.sh gate excluding src/**/theme/**", "co-located src/**/*.test.ts vitest layout"]

key-files:
  created: [package.json, package-lock.json, app.config.ts, tsconfig.json, biome.json, babel.config.js, vitest.config.ts, scripts/check-colors.sh, app.json, App.tsx, index.ts]
  modified: [.gitignore]

key-decisions:
  - "app.config.ts dedupes the expo-sqlite plugin (expo install pre-populated app.json's plugins array) to avoid a duplicate-plugin prebuild error"
  - "Kept biome linter.rules.recommended:true per plan despite a benign schema-2.5.8 deprecation info (non-blocking, biome check exits 0)"
  - "Did NOT add type:module to package.json to silence a benign Vitest ESM warning — it would break babel.config.js's module.exports"
  - "Placeholder android package com.placeholder.orbit; real id confirmed by owner at FND-01 checkpoint (01-05)"

patterns-established:
  - "No-hardcoded-colour gate: hex(3-8)/rgb(a)/hsl(a)/named colours forbidden outside src/**/theme/**; scans files or dirs via grep -r; wired as npm check:colors"
  - "Flat repo: @/* alias only, zero @quest-board/* monorepo machinery ported"
  - "expo install for native deps (SDK-57 pin), bare npm install only for pure-JS/dev deps"

requirements-completed: [FND-06]

coverage:
  - id: D1
    description: "Flat Expo SDK 57 app scaffolded into the existing repo; pinned stack installed; existing repo docs preserved; .gitignore extended additively"
    requirement: "FND-06"
    verification:
      - kind: other
        ref: "node package.json deps assertion (expo/expo-sqlite/zustand/@biomejs/biome/vitest/async-storage present) + test -f HANDOFF.md/.planning/docs/.claude"
        status: pass
    human_judgment: false
  - id: D2
    description: "Portrait lock, strict tsconfig @/* alias, tsx-loaded app.config.ts merging app.json, and flat-repo Biome config with the two ported-file overrides"
    requirement: "FND-06"
    verification:
      - kind: other
        ref: "npx tsc --noEmit && npx biome check . && npx expo config --type public (all exit 0; resolved config shows name Orbit / orientation portrait / plugins deduped)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Vitest configured, all eight src/ folders tracked, shared check:colors gate created, green tsc+biome+vitest baseline"
    requirement: "FND-06"
    verification:
      - kind: unit
        ref: "npx vitest run (passWithNoTests, exit 0) + colour-gate negative/positive control (flags #ff0000/rgba(/\"white\", passes clean)"
        status: pass
    human_judgment: false

# Metrics
duration: 8min
completed: 2026-08-14
status: complete
---

# Phase 1 Plan 01: Project Scaffold & Portable Code Summary

**Flat Expo SDK 57 app scaffolded into the existing repo with a pinned native stack, portrait lock, @/* alias, Biome 2.5.8, Vitest, the shared no-hardcoded-colour gate, and the full eight-folder CLAUDE.md layout — tsc, biome, vitest, and expo config all green.**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-08-14T17:40:57Z
- **Completed:** 2026-08-14T17:49:13Z
- **Tasks:** 3
- **Files modified:** 26 (incl. 6 template asset PNGs + 8 `.gitkeep`)

## Accomplishments
- Scaffolded `create-expo-app` blank-typescript into a temp dir and copied the enumerated files into the existing repo — template already resolved Expo SDK 57 (`~57.0.13`, RN 0.86.2), so no re-pin was needed; HANDOFF.md/docs/.planning/.claude/.git left untouched.
- Pinned the native stack via `expo install` (expo-sqlite, expo-status-bar, safe-area-context, async-storage) and installed zustand + devDeps (@biomejs/biome@2.5.8, vitest, tsx, @types/node); committed `package-lock.json` for the droid `npm ci` build path (01-05).
- Portrait lock + `@/*` alias + a `tsx/cjs`-loaded `app.config.ts` that merges the template `app.json`; Biome config with `src/utils/logger.ts` (noStaticOnlyClass/noThisInStatic) and `src/**/*.test.ts` (noNonNullAssertion) overrides.
- Vitest runner, the shared `scripts/check-colors.sh` gate (wired as `check:colors`), and all eight `src/` folders tracked — FND-06 layout complete.
- Proved the green baseline: `tsc --noEmit`, `biome check .`, `vitest run`, and `expo config --type public` all exit 0; colour-gate negative/positive control passes.

## Task Commits

Each task was committed atomically:

1. **Task 1: Scaffold flat Expo SDK 57 app into existing repo** - `8e74d97` (chore)
2. **Task 2: Configure portrait lock, @/* tsconfig alias, and Biome** - `91b969d` (feat)
3. **Task 3: Vitest, folder skeleton, shared colour gate, green baseline** - `4839a06` (feat)

**Plan metadata:** `<final-docs-commit>` (docs: complete plan)

## Files Created/Modified
- `package.json` - Pinned SDK-57 stack + `check:colors` script (renamed from orbit-scaffold to orbit)
- `package-lock.json` - Committed lockfile pinning the exact resolved tree (droid `npm ci`)
- `app.config.ts` - tsx/cjs hook (line 1) + functional `({ config })` merge: name Orbit, slug orbit, orientation portrait, placeholder android package, expo-sqlite plugin (deduped)
- `tsconfig.json` - Extends expo/tsconfig.base, strict, `@/* -> ./src/*` only
- `biome.json` - Schema 2.5.8, flat includes (!.planning/!android/!ios/!dist), logger.ts + *.test.ts overrides
- `babel.config.js` - babel-preset-expo only (no reanimated — Phase 13 dep)
- `vitest.config.ts` - node env, globals, include src/**/*.test.ts, passWithNoTests, absolute @ alias
- `scripts/check-colors.sh` - Shared no-hardcoded-colour gate (excludes src/**/theme/**)
- `app.json` - Template config preserved; merged via app.config.ts (expo install added its plugins array)
- `App.tsx`, `index.ts` - Template entry (format-normalized by the Biome pre-pass)
- `.gitignore` - Extended additively with Expo/native ignores + Android signing material
- `src/{db,components,screens,theme,stores,services,schemas,utils}/.gitkeep` - Eight tracked folders

## Decisions Made
- **Dedupe expo-sqlite plugin** — `expo install` pre-populated `app.json` with `plugins: ["expo-sqlite","expo-status-bar"]`, so the plan's literal `[...config.plugins, "expo-sqlite"]` would have produced a duplicate-plugin prebuild error; used `[...new Set(...)]`. Verified via `expo config` (expo-sqlite appears once).
- **Kept `linter.rules.recommended: true`** per the plan despite a schema-2.5.8 deprecation *info* (suggesting `preset`) — it is non-blocking and `biome check .` exits 0; the recommended ruleset is what 01-02 depends on.
- **Did not add `"type": "module"`** to silence Vitest's benign "ESM in CommonJS" warning on `vitest.config.ts` — it would break `babel.config.js`'s `module.exports`. Vitest runs green regardless.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Deduped the expo-sqlite config plugin**
- **Found during:** Task 2 (app.config.ts)
- **Issue:** `expo install` (Task 1) had already written `plugins: ["expo-sqlite","expo-status-bar"]` into `app.json`. The plan's specified `plugins: [...(config.plugins ?? []), "expo-sqlite"]` merge would therefore emit `expo-sqlite` twice, which Expo prebuild rejects as a duplicate plugin.
- **Fix:** Used `plugins: [...new Set([...(config.plugins ?? []), "expo-sqlite"])]` — still satisfies the "expo-sqlite pre-registered" intent and the `grep -c expo-sqlite` criterion, with no duplicate.
- **Files modified:** app.config.ts
- **Verification:** `npx expo config --type public` exits 0 and resolves `plugins: ['expo-sqlite','expo-status-bar']` (single expo-sqlite).
- **Committed in:** `91b969d` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Necessary for a loadable Expo config. No scope creep — the plugin set and every acceptance criterion are unchanged.

## Issues Encountered
- The plan's Task 1 step (3) re-pin (`expo install expo@^57 && expo install --fix`) was a no-op: the blank-typescript template already resolved `expo ~57.0.13` / RN 0.86.2 / React 19.2.3. Confirmed and skipped the redundant re-pin; the SDK-57 matrix was already correct.
- Benign, non-blocking warnings noted and deliberately left as-is: Biome `recommended` deprecation info, and Vitest's Vite "ESM in CommonJS" config-loader warning. Both gates exit 0.

## Known Stubs
- `App.tsx` retains the Expo template placeholder text and a hardcoded `backgroundColor: "#fff"`. **Intentional and plan-sanctioned** — the plan explicitly defers replacing `App.tsx` with the themed shell to plan **01-03**, which is the first `check:colors` enforcement point. `check:colors` was deliberately NOT run in this plan's baseline for that reason.
- The eight `src/` folders contain only `.gitkeep` (no code yet). Intentional scaffold — real files land across 01-02 (ports), 01-03 (theme), 01-04, 01-05.

## Threat Flags
None. This plan introduces no new runtime trust boundary (no network read path, no secrets) — pure scaffold + config, as recorded in the plan's T-1-SC threat register (all six runtime/tooling + three build-time dev deps are mainstream official packages; no human legitimacy checkpoint required).

## User Setup Required
None - no external service configuration required this plan. (The real Android package id is an owner confirmation at the FND-01 checkpoint in plan 01-05, not a setup step here.)

## Next Phase Readiness
- Green toolchain baseline in place for 01-02 (portable-code ports), 01-03 (theme module + first colour-gate enforcement), 01-04, and 01-05 (droid build bring-up).
- No blockers introduced. Standing project blockers unchanged: droid SSH/rsync build bring-up (01-05) and the deferred graphify ADR-bridge (graphify still disabled).

## Self-Check: PASSED

All 20 created/tracked files verified present on disk, and all three task commits (`8e74d97`, `91b969d`, `4839a06`) verified in git history.

---
*Phase: 01-project-scaffold-portable-code*
*Completed: 2026-08-14*
