---
phase: 23-theme-visual-system
plan: 06
subsystem: ui
tags: [theme, backgrounds, glass, surface, skia, reduced-motion, expo-blur, aa-contrast, orrery]

# Dependency graph
requires:
  - phase: 23-01
    provides: BACKGROUND_SLOT_IDS single-source ids + app_settings galaxy/standard_background columns + assertBackgroundId
  - phase: 23-02
    provides: expo-blur dependency
  - phase: 23-03
    provides: four authored palettes (galaxy/standard × dark/light) + contrast.ts AA gate
  - phase: 23-04
    provides: useReducedMotionShared() SharedValue + MOTION.ambient speed token
provides:
  - "backgrounds.ts — per-package BACKGROUND slot manifest keyed by the imported BACKGROUND_SLOT_IDS single source, lazy require() thunks, per-asset declared worst-case brightest pixel; resolveBackground + resolveRenderableBackground (onError->None/Solid pure reducer)"
  - "tokens/surface.ts — per-package glass/flat SURFACE tokens (density opacity, live glass + fallback tint opacity, palette-token-key colours) + pure resolveSurfaceStyle token-only selector + alphaComposite helper"
  - "BackgroundHost — fixed-behind-scroll background host with token-sourced density scrim + onError->None/Solid fallback"
  - "GlassSurface — one semantic surface API, glass (galaxy, expo-blur) vs flat (standard), tinted-token blur fallback"
  - "ThemePreviewScreen (dev-only) — device-UAT mount point for the deferred Pixel checks"
  - "OrreryCanvas + SunBody — every ambient clock consumer gated on the live reduced-motion SharedValue"
  - "8 bundled placeholder background webp assets + provenance README"
affects: [phase-15-renderer-adoption, phase-37-appearance-settings, orrery-camera, dashboard]

# Actuals
actuals:
  tokens: 13200
  tasks: 3
  commits: 4

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Lazy require() thunk per bundled asset (mirrors fonts.ts) so backgrounds.ts stays node-testable"
    - "Token-only surface selector: resolveSurfaceStyle returns palette-token KEYS + declared opacities, component resolves colour via useTheme()[key] — closes the check:colors /theme/ location-exemption escape hatch"
    - "Composited per-asset AA proof: alphaComposite(live glass tint, declared brightest pixel) checked against every text/status foreground"
    - "Direct useReducedMotionShared() in each Skia clock consumer (no prop/context threading) gated inside useDerivedValue"

key-files:
  created:
    - src/theme/backgrounds.ts
    - src/theme/backgrounds.test.ts
    - src/theme/tokens/surface.ts
    - src/theme/tokens/surface.test.ts
    - src/components/ui/BackgroundHost.tsx
    - src/components/ui/GlassSurface.tsx
    - src/components/ui/__dev__/ThemePreviewScreen.tsx
    - assets/backgrounds/README.md
    - assets/backgrounds/*.webp (8 placeholder assets)
  modified:
    - src/components/orrery/OrreryCanvas.tsx
    - src/components/orrery/SunBody.tsx

key-decisions:
  - "BackgroundHost density scrim reuses surfaceOpacityForDensity (the same token/test as GlassSurface) — for D-04 text-heavy app-wide backgrounds readability dominates, so the scrim band is high (galaxy 0.88->0.97, standard 0.97->1.0); the vivid full-bleed treatment belongs to the Orrery immersive exception, not text screens"
  - "liveGlassTintOpacity is pinned to the least-dense (most translucent, AA worst-case) density opacity and == fallbackTintOpacity per package, so the opacity-ordering invariant holds by construction and the composited-AA check runs on the worst case"
  - "Standard is glass:false (flat) — resolveSurfaceStyle().useBlur is always false for standard even when blur is available; galaxy blurs only where affordable"
  - "Placeholder background assets are uniform-fill webps whose single colour equals the declared brightest pixel (honest bound); final curated art deferred, must stay <= that pixel (device-UAT enforces the shipped bytes)"
  - "ThemePreviewScreen is NOT wired into RootNavigator (files_modified scope + no new user-facing nav prohibition); the device-UAT wires a temporary dev route"

patterns-established:
  - "Node-safe asset manifest: lazy require thunks keep an asset-referencing theme module importable under vitest"
  - "Surface-token-only component contract enforced by a unit test on the selector, not the location-based colour gate"

requirements-completed: [THEME-04, THEME-05, THEME-12]

coverage:
  - id: D1
    description: "Background slot manifest keyed by the imported BACKGROUND_SLOT_IDS single source (no re-declared list); resolveBackground (NULL->default, none->solid, unknown->default) + resolveRenderableBackground onError->None/Solid reducer; stable order; adjacency/ordering determinism"
    requirement: THEME-04
    verification:
      - kind: unit
        ref: "src/theme/backgrounds.test.ts (drift, NULL->default, none->solid, unknown->default, adjacency, ordering, renderable reducer)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Per-package surface/glass tokens: density->opacity monotonic, glass-composite AA over the fallback tinted surface (4 palettes), composited per-asset live-glass AA over each asset's declared brightest pixel, live>=fallback opacity ordering, resolveSurfaceStyle token-only output"
    requirement: THEME-05
    verification:
      - kind: unit
        ref: "src/theme/tokens/surface.test.ts (density monotonic, opacity ordering, fallback AA, composited per-asset AA, token-only selector)"
        status: pass
    human_judgment: false
  - id: D3
    description: "BackgroundHost renders the background fixed behind scroll with a token-sourced density scrim and drives onError through resolveRenderableBackground; GlassSurface renders glass/flat via one API with expo-blur + tinted-token fallback, deriving all style from resolveSurfaceStyle/useTheme (no component-local colour/opacity)"
    requirement: THEME-05
    verification:
      - kind: unit
        ref: "npx tsc --noEmit; npm run check:colors src/components/ui/BackgroundHost.tsx src/components/ui/GlassSurface.tsx (clean); onError->None/Solid transition covered by backgrounds.test resolveRenderableBackground"
        status: pass
      - kind: manual_procedural
        ref: "23-VALIDATION.md Manual-Only: fixed-behind-scroll + density opacity + glass/flat + None/Solid + asset-fail fallback on the Pixel via ThemePreviewScreen"
        status: unknown
    human_judgment: true
    rationale: "Fixed-behind-scroll, density readability, glass vs flat, and the per-asset brightest-region AA over the SHIPPED .webp bytes are Skia/visual behaviors not observable in node; deferred to the end-of-phase Pixel pass"
  - id: D4
    description: "Every Orrery ambient clock consumer (OrreryCanvas twinkle/drift AND SunBody glow pulse) gates on the live reduced-motion SharedValue read inside useDerivedValue — the sun stops pulsing under reduced motion"
    requirement: THEME-12
    verification:
      - kind: unit
        ref: "npx tsc --noEmit; npm run check:colors (both files clean); grep confirms reducedMotion.value read in each useDerivedValue loop, no new setState"
        status: pass
      - kind: manual_procedural
        ref: "23-VALIDATION.md Manual-Only: OS reduced-motion toggle halts Orrery drift/twinkle + sun glow pulse live, manual camera still works"
        status: unknown
    human_judgment: true
    rationale: "Live reduced-motion gating in the Skia render loop and the absence of jank are physical-device (Pixel) observations; deferred to the end-of-phase Pixel pass"

# Metrics
duration: 14min
completed: 2026-09-03
status: complete
---

# Phase 23 Plan 06: Background System, Surface/Glass Treatment & Orrery Reduced-Motion Summary

**Bundled per-package backgrounds (+ None/Solid, fixed-behind-scroll, token density scrim, render-failure fallback), a single glass/flat GlassSurface API with graceful expo-blur degradation and a composited per-asset AA proof, and an Orrery where every clock consumer (canvas twinkle/drift + sun glow pulse) honors the live reduced-motion SharedValue — THEME-04/05/12 delivered as primitives + behaviors.**

## Performance

- **Duration:** ~14 min
- **Started:** 2026-09-03T~12:38:00Z (local -05:00)
- **Completed:** 2026-09-03T12:50:39-05:00
- **Tasks:** 3
- **Files modified:** 15 (13 created incl. 8 assets + 2 tests, 2 modified)

## Accomplishments
- `backgrounds.ts` + `surface.ts` as pure, node-tested data — the slot manifest is keyed by the imported `BACKGROUND_SLOT_IDS` single source (drift test asserts equality, no re-declared parallel list), and the surface tokens carry the glass/flat treatment, density opacity, and the live/fallback glass tint opacities with a composited per-asset AA proof over each asset's declared brightest pixel (39 tests).
- `BackgroundHost` (fixed-behind-scroll + token density scrim + `onError`->`resolveRenderableBackground` None/Solid fallback) and `GlassSurface` (one API: glass galaxy / flat standard, expo-blur where affordable, semi-opaque tinted-token fallback, style entirely from `resolveSurfaceStyle` + `useTheme()` tokens).
- Gated BOTH Orrery ambient clock consumers on `useReducedMotionShared()` read inside `useDerivedValue` — `OrreryCanvas` twinkle collapses to a constant and `SunBody`'s glow pulse holds at its mid-point under reduced motion (REVIEWS 23-06 HIGH: the sun no longer pulses).
- 8 bundled placeholder background webp assets + a provenance/license README recording each asset's declared worst-case brightest pixel.

## Task Commits

1. **Task 1: Background slot manifest + surface tokens (pure data, TDD)** — `af2de01` (feat)
2. **Task 2: BackgroundHost + GlassSurface with graceful fallbacks** — `eca5937` (feat)
3. **Task 3: Gate ALL Orrery clock consumers on reduced motion** — `180e8eb` (feat)

**Plan metadata:** `<this commit>` (docs: complete plan)

## Files Created/Modified
- `src/theme/backgrounds.ts` (+ `.test.ts`) — slot manifest, lazy require thunks, declared brightest pixels, `resolveBackground` / `resolveRenderableBackground`.
- `src/theme/tokens/surface.ts` (+ `.test.ts`) — per-package glass/flat SURFACE tokens, `resolveSurfaceStyle` token-only selector, `alphaComposite`, `surfaceOpacityForDensity`.
- `src/components/ui/BackgroundHost.tsx` — fixed-behind-scroll host, density scrim, render-failure fallback.
- `src/components/ui/GlassSurface.tsx` — one semantic surface API with graceful blur degradation.
- `src/components/ui/__dev__/ThemePreviewScreen.tsx` — dev-only device-UAT mount point.
- `src/components/orrery/OrreryCanvas.tsx` — twinkle/drift gated on reduced motion.
- `src/components/orrery/SunBody.tsx` — sun glow pulse gated on reduced motion.
- `assets/backgrounds/*.webp` (8) + `assets/backgrounds/README.md` — bundled placeholder assets + provenance.

## Decisions Made
- **BackgroundHost density scrim reuses the surface density opacity token** (same function + monotonicity test as GlassSurface). For D-04's app-wide text-heavy backgrounds readability dominates, so the scrim band is high; the vivid full-bleed background is the Orrery immersive exception (Task 3 scope), not text screens.
- **`liveGlassTintOpacity` pinned to the least-dense density opacity and `== fallbackTintOpacity`** per package, so the opacity-ordering invariant holds by construction and the composited-AA check runs on the AA worst case.
- **Standard is `glass: false`** — `useBlur` is always false for standard; only galaxy blurs (and only where affordable).
- **Placeholder assets** are uniform-fill webps whose colour equals the declared brightest pixel; final art is deferred and must stay `<=` that pixel (device-UAT enforces the shipped bytes).
- **ThemePreviewScreen is not wired into RootNavigator** — respecting files_modified scope and the "no new user-facing nav" prohibition; the device-UAT wires a temporary dev route.

## Deviations from Plan

None — plan executed exactly as written. (Two minor in-scope hygiene choices: `BackgroundHost` uses React's render-phase state-reset idiom instead of a `useEffect` to clear the render-failure latch on selection change, avoiding a lint finding and an extra frame; the dev-only harness carries a file-level `biome-ignore-all` for `useValidAriaRole` because `AppText`'s semantic `role` prop is not an ARIA role. Neither changes behavior or scope.)

## Issues Encountered
- **Node-testing an asset-referencing manifest:** vitest cannot evaluate a `require("*.webp")`. Resolved by the `fonts.ts` lazy-thunk idiom — each slot's `require()` lives inside a `source: () => require(...)` thunk that the resolvers return uncalled, so the module imports cleanly under node and only `BackgroundHost` invokes the thunk on device.

## Known Stubs
- **Placeholder background assets (8 webp).** `assets/backgrounds/*.webp` are uniform-fill placeholders (colour == declared brightest pixel); final curated art is deferred (asset-production item). They render, bundle, and pass the composited-AA bound honestly. Recorded in `assets/backgrounds/README.md` and in `.planning/WINDOWS.md` (stub). Not blocking — the primitives and behaviors are complete; art replacement is a later cosmetic pass that must respect the declared brightest pixel.

## Owner Flags / Deferred Verification
- **Per-asset brightest-region text-over-glass AA (shipped `.webp` bytes)** and **live reduced-motion halt of Orrery + background motion** are device-UATs deferred to the end-of-phase Pixel pass (config `human_verify_mode: end-of-phase`). Both are tracked in `23-VALIDATION.md` Manual-Only and in `.planning/WINDOWS.md` (unrun-verify). The composited unit test is the fast regression guard for the declared pixel; the device-UAT is the only check against the decoded image — a failure means re-master/darken the asset or retune its declared pixel + tint opacity, never weaken AA.

## Threat Flags
None — no new network endpoint, auth path, file-access pattern, or schema change beyond the plan's `<threat_model>` (backgrounds are local require() assets only; grep + check:colors confirm no remote URL; the reduced-motion mitigation T-23-06b is satisfied by gating both clock consumers).

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- BackgroundHost / GlassSurface primitives + behaviors are complete and node/tsc/check:colors-green; app-wide mounting is the deferred renderer/Phase-15 adoption task and the Appearance settings UI is Phase 37 (recorded scope boundary, not a gap).
- OrreryCanvas + SunBody are real, wired consumers of the Plan 04 reduced-motion signal — the Orrery Camera / Systems phases inherit gated ambient motion.
- End-of-phase Pixel device-UATs remain (background visuals + reduced-motion live toggle + per-asset AA against shipped bytes); replace placeholder background art before/at that pass.

## Self-Check: PASSED

All 10 checked files exist on disk (7 source/doc + 2 sample assets + README) and all 3 task commits (`af2de01`, `eca5937`, `180e8eb`) are present in git history.

---
*Phase: 23-theme-visual-system*
*Completed: 2026-09-03*
