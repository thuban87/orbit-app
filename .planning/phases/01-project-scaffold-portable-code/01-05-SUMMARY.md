---
phase: 01-project-scaffold-portable-code
plan: 05
subsystem: build-pipeline
tags: [FND-01, android, expo, release-apk, cross-machine-build, ssh, tar-over-ssh, droid, pixel, runbook, walking-skeleton]

# Dependency graph
requires:
  - "01-01: package.json/package-lock.json, app.config.ts (placeholder package id), babel.config.js, @/* alias, tsconfig extends expo/tsconfig.base"
  - "01-03: themed HomeScreen (testID home-shell-root, Orbit title) rendered by App.tsx via ThemeProvider"
provides:
  - "Owner-confirmed Android package id com.bwales.orbit in app.config.ts (placeholder replaced)"
  - "APP_NAME single-source display name (src/constants/app-name.json + typed src/constants/app.ts re-export), decoupled from the install-locked package id"
  - "babel-preset-expo declared as a direct devDependency (hoisted so metro's embedded bundle resolves it)"
  - "docs/runbooks/desktop-build-pipeline.md — the proven commit -> tar-over-ssh -> droid build -> pull -> adb install loop (release standalone proof + debug+Metro iteration)"
  - "FND-01 proven: standalone release APK built on droid, installed on the physical Pixel 6 Pro, launches to the themed home shell (no red screen)"
affects: [every-later-phase, dashboard, orrery, ports, ci-signing]

# Tech tracking
tech-stack:
  added: ["babel-preset-expo@~57.0.7 (direct devDependency; was expo-nested-only)"]
  patterns:
    - "Display name single-sourced in JSON (Node/Expo + metro + tsc all load it natively — no tsx global hook that would break the embedded release bundle)"
    - "Cross-machine build: source-only tar-over-ssh to droid (rsync ABSENT there), npm ci + expo prebuild --clean (set \"CI=1\") + gradlew.bat assembleRelease, scp pull, adb install on the Pixel"
    - "Release APK = standalone (embedded JS bundle, no Metro/adb reverse) for launch proof; debug APK + Metro + adb reverse for iteration"

key-files:
  created:
    - src/constants/app-name.json
    - src/constants/app.ts
    - docs/runbooks/desktop-build-pipeline.md
  modified:
    - app.config.ts
    - src/screens/HomeScreen.tsx
    - package.json
    - package-lock.json

key-decisions:
  - "Android package id = com.bwales.orbit (owner-confirmed at the checkpoint; install-locked, decoupled from the display name)"
  - "Display name centralized behind APP_NAME as a JSON single-source rather than the owner-requested TS literal, because a .ts runtime import in app.config.ts forces the tsx/cjs global hook which breaks the embedded release JS bundle (see Deviations)"
  - "babel-preset-expo promoted to a direct devDependency so it hoists to top-level node_modules and metro's babel transformer resolves it from the project root"
  - "Transport is tar-over-ssh (rsync absent on droid); source-only, no mirror-delete, never git push"

requirements-completed: [FND-01]

coverage:
  - id: T-name-const
    description: "APP_NAME single-source display name wired into app.config.ts name + HomeScreen title, decoupled from android.package"
    requirement: "FND-01"
    verification:
      - kind: other
        ref: "npx expo config --json -> name=Orbit, android.package=com.bwales.orbit; tsc/biome/check:colors/vitest(56) all exit 0; on-device UI tree shows 'Orbit' title"
        status: pass
    human_judgment: false
  - id: T-fnd01
    description: "Standalone release APK built on droid from tar-over-ssh'd source, installed on the physical Pixel, launches to the themed home shell (no red screen)"
    requirement: "FND-01"
    verification:
      - kind: manual
        ref: "gradlew.bat assembleRelease BUILD SUCCESSFUL; adb -s 1A071FDEE002BU install -r -> Success; uiautomator dump contains 'Orbit' (primary) + home-shell-root (secondary); pm list packages has com.bwales.orbit; adb reverse 8081 entries=0 (no Metro dependency); screenshot shows space-dark themed shell"
        status: pass
    human_judgment: true

# Metrics
duration: 26min
completed: 2026-08-14
status: complete
---

# Phase 1 Plan 05: FND-01 Cross-Machine Build/Deploy Proof Summary

**Proved FND-01 once, end-to-end, on the physical Pixel 6 Pro: source tar-over-ssh'd to the `droid` Windows desktop (rsync is absent there) → `npm ci` + `expo prebuild --clean` + `gradlew.bat assembleRelease` over SSH → the ~73 MB standalone release APK (embedded JS bundle) pulled back via scp → `adb install` on the wired Pixel → the app launches to the themed Orbit home shell (space-dark background, "Orbit" title, "Your people, in orbit." subtitle — all theme tokens), NOT the RN "could not connect" red screen, with zero `adb reverse` entries confirming no Metro dependency. The owner-confirmed package id `com.bwales.orbit` is committed, the display name is centralized behind a single-source `APP_NAME`, and the whole loop is captured as `docs/runbooks/desktop-build-pipeline.md`. Two latent scaffold bugs that only surface at the first real metro bundle were found and fixed along the way.**

## Performance
- **Duration:** ~26 min
- **Started:** 2026-08-14T19:49:38Z
- **Tasks:** Task 1 (owner checkpoint) pre-resolved; Task 2 (the loop) + the owner's name-constant addition executed
- **Files created:** 3, modified: 4

## Accomplishments
- **Owner checkpoint (Task 1) resolved by the owner:** package id `com.bwales.orbit`; droid SSH host live (cmd.exe shell, path `C:\Users\bwales\projects\orbit-app`); Pixel `1A071FDEE002BU` attached + authorised; rsync ABSENT on droid → tar-over-ssh transport.
- **Name-constant addition (owner request):** created `src/constants/app-name.json` (the single source) + `src/constants/app.ts` re-exporting typed `APP_NAME`; `app.config.ts` `name` now derives from it; `HomeScreen` renders `{APP_NAME}` (still "Orbit"). Rename is a one-line JSON edit, DECOUPLED from the install-locked package id.
- **Package id committed:** `app.config.ts` `android.package` = `com.bwales.orbit` (placeholder `com.placeholder.orbit` removed).
- **Transport:** classified the droid destination (non-empty but HANDOFF.md marker present ⇒ this repo), wiped + re-extracted a clean source tree via `tar -czf - … | ssh droid 'tar -xzf - -C …'` (excludes node_modules/android/ios/.git/.expo/.planning). No `git push`.
- **Build:** `npm ci` (514 pkgs, exact lockfile) → `set "CI=1" & npx expo prebuild --platform android --clean --no-install` (generated `applicationId 'com.bwales.orbit'`) → `gradlew.bat assembleRelease` → BUILD SUCCESSFUL.
- **Install + proof:** scp'd `app-release.apk` back; `adb -s 1A071FDEE002BU install -r` → Success; launched `com.bwales.orbit/.MainActivity`; `uiautomator dump` shows `text="Orbit"` (primary) + `home-shell-root` testID (secondary) + subtitle, no red-screen text; screenshot confirms the space-dark themed shell; `pm list packages` includes `com.bwales.orbit`; `adb reverse --list` shows 0 port-8081 entries (standalone, no Metro).
- **Runbook:** `docs/runbooks/desktop-build-pipeline.md` records both the one-time release proof and the debug+Metro iteration loop, with the concrete cmd.exe/path forms, the tar-over-ssh fallback (rsync absent), the destination marker classification, the `set "CI=1"` trailing-space gotcha, the red-screen caveat (cites `ANDROID_BUILD_GUIDE.md:213-222`), and the two caveats (release APK not `run-as`-debuggable; adb/emu-connect not in the allow-list).

## Task Commits
1. **feat(01-05): set real Android package id + centralize display name** — `040307e`
2. **fix(01-05): load display name from JSON so the release bundle builds** — `5887ceb`
3. **fix(01-05): declare babel-preset-expo as a direct devDependency** — `32aa81b`
4. **docs(01-05): add desktop-build-pipeline runbook (FND-01 proven loop)** — `c474690`

## Files Created/Modified
- `src/constants/app-name.json` — the single-source display name (`{ "APP_NAME": "Orbit" }`)
- `src/constants/app.ts` — typed `APP_NAME` re-export for the app (owner's `@/constants/app` import unchanged)
- `docs/runbooks/desktop-build-pipeline.md` — the proven build/deploy runbook
- `app.config.ts` — `android.package = com.bwales.orbit`; `name` from `app-name.json`; `tsx/cjs` hook removed
- `src/screens/HomeScreen.tsx` — renders `{APP_NAME}` (still "Orbit"; FND-01 title assertion holds)
- `package.json` / `package-lock.json` — `babel-preset-expo@~57.0.7` added + hoisted

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `babel-preset-expo` not resolvable from the project root**
- **Found during:** first `gradlew.bat assembleRelease` — the `:app:createBundleReleaseJsAndAssets` (metro embedded-bundle) task failed with `Cannot find module 'babel-preset-expo'`.
- **Root cause:** `babel.config.js` references `babel-preset-expo` as a top-level preset, but the lockfile installed it only nested under `node_modules/expo/node_modules/babel-preset-expo` (never hoisted), so babel — running from the repo root — could not resolve it. Latent since the 01-01 scaffold; tsc/vitest/biome never invoke metro, so the first real bundle (this plan) is the first time it surfaced. Confirmed identical on both this box and droid.
- **Fix:** declared `babel-preset-expo: ~57.0.7` (expo's own range; already the resolved 57.0.7) as a direct devDependency; `npm install` hoisted it to top-level. Verified `require.resolve('babel-preset-expo')` from root now succeeds on both machines.
- **Files modified:** `package.json`, `package-lock.json`
- **Commit:** `32aa81b`

**2. [Rule 1 - Bug + owner-spec adjustment] Display-name mechanism changed from a TS literal to a JSON single-source — OWNER, PLEASE NOTE**
- **Found during:** first release build — after fixing bug #1, the bundle still failed with the same `Cannot find module 'babel-preset-expo'`, this time routed through **tsx's** `resolveTsPaths` global resolver.
- **Root cause:** the owner's requested design (`src/constants/app.ts` exporting a literal, imported by `app.config.ts`) requires `app.config.ts` to import a `.ts` runtime module. Expo evaluates `app.config.ts` in Node, which cannot `require` a `.ts` without a global TS loader hook (`import "tsx/cjs"`, present since the scaffold). That hook globally patches `Module._resolveFilename`, and during `expo export:embed` it then breaks metro's own `require('babel-preset-expo')`. A `.ts` runtime import in the Expo config is therefore fundamentally incompatible with the embedded release bundle.
- **Fix (deviation from the literal spec, preserving the intent):** the display name now lives in `src/constants/app-name.json` (`{ "APP_NAME": "Orbit" }`) — loadable natively by Node/Expo, metro, and tsc with **no** global hook. `src/constants/app.ts` re-exports a typed `APP_NAME` from it, so `HomeScreen`'s `import { APP_NAME } from "@/constants/app"` and `{APP_NAME}` render are **exactly as the owner specified**. `app.config.ts` imports the JSON directly and the `tsx/cjs` hook was removed.
- **Intent preserved:** single source of the display name ✓, one-line rename (edit `app-name.json`) ✓, decoupled from the install-locked package id ✓, TypeScript for all code (the JSON is data, not code) ✓, gates green ✓.
- **What changed vs the owner's words:** the literal `export const APP_NAME = "Orbit"` in a `.ts` file became a JSON-backed re-export, and `app.config.ts` imports the JSON rather than the `.ts` constant. If you'd prefer a different mechanism (e.g. reading `Constants.expoConfig.name` via `expo-constants`, which would need adding that package), say so and I'll switch it.
- **Files modified:** `app.config.ts`, `src/constants/app.ts` (+ new `src/constants/app-name.json`)
- **Commits:** `040307e` (initial), `5887ceb` (JSON fix)

**Transport note (not a deviation — planned fallback):** rsync is absent on droid (confirmed via `ssh droid 'rsync --version'`), so the plan's documented tar-over-ssh fallback was used. It is source-only and does not mirror-delete, so the `rsync --delete` marker-guard risk did not apply; the destination was still classified (non-empty + HANDOFF.md marker ⇒ this repo) before syncing.

**Total deviations:** 2 auto-fixed bugs (one of which adjusts the owner's requested APP_NAME mechanism — flagged above for owner review).
**Impact on plan:** none on FND-01 scope or outcome; both fixes were prerequisites for the release bundle to build at all.

## Known Stubs
None. The home shell is the real themed screen from 01-03; the package id, display name, and runbook are complete and proven on hardware. No placeholder remains (`com.placeholder.orbit` removed).

## Out-of-scope items (not fixed)
- `npm ci` reports 18 audit vulnerabilities (7 moderate, 11 high) in the Expo/RN dependency tree — pre-existing, not introduced by this plan's changes; not touched (scope boundary).
- Gradle deprecation warnings (incompatible with Gradle 10) and a `RawPropsParser`/`targetSdk` deprecation from RN 0.86 / expo-modules-core — upstream, non-blocking.

## Threat Flags
None beyond the plan's register. T-1-05 (SSH TOFU to droid) mitigated: the owner's own machine over authenticated Tailscale, host key accepted at bring-up; transport excludes `.git`/`node_modules`; no secret transmitted (none exist this phase). T-1-SC2 (`npm ci` on droid) mitigated: `npm ci` against the exact synced `package-lock.json` — the only stack change is `babel-preset-expo`, which was already the expo-resolved 57.0.7 (no new/unaudited package; the direct declaration merely hoists the copy expo already depended on). Release APK is signed by the prebuild debug keystore (production signing deferred).

## Verification Evidence
- `npx expo config --type public --json` → `name=Orbit`, `android.package=com.bwales.orbit`
- `npx tsc --noEmit` / `npx biome check .` / `npm run check:colors` / `npx vitest run` (56 tests) — all exit 0
- droid: `npm ci` (514 pkgs) → `prebuild --clean` (`applicationId 'com.bwales.orbit'`) → `gradlew.bat assembleRelease` → **BUILD SUCCESSFUL** (app-release.apk, 76,675,726 bytes)
- Pixel `1A071FDEE002BU`: `adb install -r` → **Success**; `uiautomator dump` → `text="Orbit"` + `text="Your people, in orbit."` + `home-shell-root`; no `could not connect`/`development server` text; `pm list packages` → `com.bwales.orbit`; `adb reverse --list` → 0 port-8081 entries (standalone bundle)
- Screenshot (1440×3120) shows the space-dark themed shell with the Orbit title — evidence file captured during the run

## Next Phase Readiness
- **FND-01 satisfied** — the single biggest phase risk (proving the cross-machine build loop) is closed on real hardware, and every later phase now has a repeatable runbook.
- Build gotchas (babel-preset-expo hoist, JSON name source) are fixed in-repo and documented so they will not recur.
- Follow-ups for later phases (not blockers): production release signing (currently debug keystore); the data-layer inspection loop must use the `assembleDebug`+Metro build (release APK is not `run-as`-debuggable) — both recorded in the runbook.

## Self-Check: PASSED
All 3 created files verified present (`src/constants/app-name.json`, `src/constants/app.ts`, `docs/runbooks/desktop-build-pipeline.md`); all 4 task commits (`040307e`, `5887ceb`, `32aa81b`, `c474690`) verified in git history; `com.placeholder.orbit` absent from `app.config.ts`; on-device proof captured.

---
*Phase: 01-project-scaffold-portable-code*
*Completed: 2026-08-14*
