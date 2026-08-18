---
phase: 13-orrery
plan: 05
subsystem: orrery render + navigation
tags: [orrery, skia, canvas, react-native-skia, useFonts, paragraph, segmented-control, navigation, tap-to-profile, device-uat]

# Dependency graph
requires:
  - phase: 13-orrery (13-04)
    provides: "orreryRingStyle(status, colors) + resolveSunOccupant(input) — the ring-style + sun-occupant vocabulary this render consumes"
  - phase: 13-orrery (13-02/13-03)
    provides: "orrery-geometry-logic (deriveOrreryMetrics/drawnRadius/ringRadius/progressToAngle/polarToXY/hitTest) + orrery-read (listOrbitingContacts) + app-settings-dao (sun_contact_id/self_sun_colour)"
  - phase: 08-dashboard
    provides: "contact-read getContactHeader, contact-status-read getContactStatus, FilterChipRow filled-accent idiom, HomeScreen topBar"
  - phase: photo/PHOTO
    provides: "resolvePhotoUri (relative→file://) + avatar-initials (getInitials/swatchIndex) + CropPhotoScreen Skia surface idioms"
provides:
  - "OrreryScreen — the reachable static status-view orrery (measured metrics, keyed OrbitBody/SunBody, Promise.all sun read, tap→Profile)"
  - "OrbitBody / OrreryCanvas / SunBody — the H1 Rules-of-Hooks component decomposition (per-body useImage isolated in keyed children; <Canvas> subtree owns 13-07's useClock)"
  - "SegmentedControl — a generic two-segment filled-accent toggle (Status | Relationship)"
  - "assets/Inter-SemiBold.ttf (OFL-1.1) — the bundled Skia initials font"
  - "Orrery nav route + dashboard ◎ Orbit button"
affects: [13-06, 13-07, 13-08, orrery ambient motion, two-view morph, ring_seq radial drag]

# Tech tracking
tech-stack:
  added:
    - "assets/Inter-SemiBold.ttf — Inter SemiBold static face, SIL OFL-1.1, from the rsms/inter v4.0 GitHub release (extras/ttf); OFL permits bundling/embedding"
  patterns:
    - "H1 component decomposition: a dynamic list of Skia bodies never calls a hook inside .map() — each per-body useImage lives in a keyed <OrbitBody key={id}/>; the <Canvas> subtree is its own <OrreryCanvas> so unmounting halts 13-07's render loop; OrreryScreen keeps a fixed hook count"
    - "OrreryScreen BUILDS the OrbitBody/SunBody/ring elements and passes them as children into OrreryCanvas — Skia elements constructed outside <Canvas> render fine inside it, so the map stays in the screen (hook-free) while the Canvas stays in the unmountable subtree"
    - "C2-1 nullable-photo Skia hook: useImage(photo ? resolvePhotoUri(photo) : null) — unconditional hook, null-guarded source (resolvePhotoUri requires string; useImage(null) → null image → swatch/initials fallback)"
    - "H2/C2-4 measured-canvas gate: onLayout → dimsValid (w>0 && h>0) defers deriveOrreryMetrics + <Canvas> mount + gesture enable; one metrics object C threads render + hitTest (refs sync C/bodies for the tap worklet)"
    - "New-to-repo Skia idioms (NOT in CropPhotoScreen): useFonts + Skia.ParagraphBuilder Paragraph API for initials; device-UAT-first (13-08)"

key-files:
  created:
    - src/components/SegmentedControl.tsx
    - src/screens/OrreryScreen.tsx
    - src/components/orrery/OrbitBody.tsx
    - src/components/orrery/OrreryCanvas.tsx
    - src/components/orrery/SunBody.tsx
    - assets/Inter-SemiBold.ttf
  modified:
    - src/navigation/types.ts
    - src/navigation/RootNavigator.tsx
    - src/screens/HomeScreen.tsx

key-decisions:
  - "OrreryScreen owns the .map() over the orbiting set (returns <OrbitBody/> elements, no hook); OrreryCanvas receives them as children and wraps the <Canvas>+GestureDetector — satisfies both the H1 'map in the screen' acceptance grep AND the 'Canvas subtree unmountable' requirement"
  - "Font: shipped the STATIC Inter-SemiBold.ttf (413976 bytes, OFL-1.1) from the rsms/inter v4.0 release rather than the Google Fonts variable Inter — matches the plan filename, smaller, single-weight face registered under family 'Inter' (so no FontWeight selection needed)"
  - "Planet visual: a filled status-colour disc (orreryRingStyle.bodyFill — rogue = rogueExtinguished) as the body treatment, with the photo (clipped fit=cover) or the deterministic avatarSwatches swatch + Paragraph initials inset inside it, so status reads even under a photo"
  - "Orbit ring line treatment mapped from orreryRingStyle.strokeStyle: solid = plain stroke; dashed/faintTrace = DashPathEffect([6,6]); faded → opacity 0.7, faintTrace → opacity 0.3 (numeric opacity, not a colour)"
  - "Sun hit-test radius = C.SUN_RADIUS (60px diameter ≥ 44); planet hit via hitTest(C.HIT_RADIUS). Tap: planet → Profile; contact-sun → Profile; self-sun → no-op"
  - "view toggle state is local + inert this plan (morph is 13-07); the status-view layout renders regardless of view"

patterns-established:
  - "Keyed-child hook isolation for a dynamic Skia body list (Rules of Hooks); the unmountable <Canvas> subtree as the home of the render-loop clock"
  - "Measured-dims dimsValid gate before any geometry/gesture (belt to deriveOrreryMetrics' MIN_GAP suspenders)"
  - "Build Skia child elements in the hook-free screen, render them inside the Canvas-owning child component"

requirements-completed: [ORR-01, ORR-03, ORR-05]

coverage:
  - id: T1
    description: "SegmentedControl — two-segment filled-accent toggle (active accent-fill/background-label, inactive surface/textSecondary), 44/10/12/16-600 dims, testIDs orrery-view-toggle + per-segment, every colour via tokens"
    requirement: "ORR-02 (control; morph wiring 13-07)"
    verification:
      - kind: other
        ref: "npx tsc --noEmit clean; npm run check:colors clean (no hex)"
        status: pass
      - kind: human
        ref: "13-08 device UAT — the toggle highlights the active segment and is tappable"
        status: deferred
    human_judgment: true
  - id: T2
    description: "Static status-view orrery — keyed OrbitBody/SunBody inside OrreryCanvas, measured deriveOrreryMetrics threaded to render+hitTest, Promise.all sun occupant read (statusRow?.status ?? null), C2-1 null-guarded useImage, rings/planets/rogue/empty-state, tap→Profile, bundled font via useFonts+Paragraph"
    requirement: "ORR-01, ORR-03, ORR-04, ORR-05"
    verification:
      - kind: other
        ref: "npx tsc --noEmit clean; npm run check:colors clean; npm test 1000 passed; grep — OrreryScreen .map() returns <OrbitBody/> with no useImage/useDerivedValue in the map; both OrbitBody+SunBody use useImage(photo ? resolvePhotoUri(photo) : null)"
        status: pass
      - kind: human
        ref: "13-08 device UAT — sun + rings + planets render, rogue extinguished body + bounded drift, empty-state prompt, tap a planet → Profile, tap a contact-sun → Profile, font loads (initials render)"
        status: deferred
    human_judgment: true
  - id: T3
    description: "Orrery route registered additively (RootStackParamList + RootNavigator; Home stays initial) + dashboard ◎ dashboard-orbit-entry button (accessibilityLabel 'Orbit view', pressed = accent) → navigate('Orrery')"
    requirement: "ORR-03"
    verification:
      - kind: other
        ref: "npx tsc --noEmit clean; npm run check:colors clean; npm test 1000 passed; grep — Orrery: undefined in types, <Stack.Screen name=\"Orrery\"> in RootNavigator, dashboard-orbit-entry in HomeScreen"
        status: pass
      - kind: human
        ref: "13-08 device UAT — the ◎ button on the dashboard opens the orrery"
        status: deferred
    human_judgment: true

# Metrics
duration: 25min
completed: 2026-08-17
status: complete
---

# Phase 13 Plan 05: Reachable Static Status-View Orrery Summary

**The orrery becomes the first user-touchable slice: a Skia `<Canvas>` reachable from the dashboard ◎ Orbit button that renders the orbiting set (one status-coloured ring + planet per live, contacted, non-archived contact) around a central sun, with the rogue extinguished body + bounded drift, an empty-state prompt, a two-segment view toggle (inert until 13-07), and tap→Profile. Built as the mandated H1 decomposition — per-body `useImage` isolated in keyed `<OrbitBody>`/`<SunBody>` children, the `<Canvas>` subtree in `<OrreryCanvas>` (where 13-07's `useClock` lands) — from a single MEASURED `deriveOrreryMetrics` object threaded to both render and hit-test, with the sun occupant resolved from a concrete `Promise.all(getContactHeader, getContactStatus)`. Colour-clean, typechecking, and Rules-of-Hooks-safe; the render itself is device-UAT in 13-08.**

## Performance

- **Duration:** ~25 min
- **Tasks:** 3
- **Files created:** 6 · **Files modified:** 3

## Accomplishments
- **Task 1 (SegmentedControl):** A thin, purely presentational, generic two-segment control in the shipped filled-accent idiom (active = `accent` fill / `borderStrong` outline / `background` label; inactive = `surface` / `border` / `textSecondary`), reusing FilterChipRow's 44/10/12/16-600 dimensions. Deliberately NOT an overload of `FilterChipRow`'s `DashboardFilter`-keyed API (RESEARCH OQ-3). Controlled by the parent; testIDs `orrery-view-toggle` + `orrery-view-toggle-{value}`. Every colour via `useTheme().colors.*`.
- **Task 2 (OrreryScreen + orrery components + font):** The static status-view render as the mandated H1 decomposition. `OrbitBody` (keyed, one `useImage` + its initials Paragraph), `SunBody` (sun photo hook + glow), and `OrreryCanvas` (the conditionally-mounted `<Canvas>`+`GestureDetector` subtree — 13-07's `useClock` lands there). `OrreryScreen` owns only screen-level hooks: on focus it reads `getAppSettings` → resolves the sun occupant via `Promise.all([getContactHeader, getContactStatus])` (threading `statusRow?.status ?? null`, C2-2; archived/missing → self) → `listOrbitingContacts({ excludeContactId })`. It MEASURES the canvas (`onLayout`), gates all layout on `dimsValid` (C2-4), computes `deriveOrreryMetrics` ONCE and threads the same `C` to render + `hitTest`. Rings map from `orreryRingStyle` (solid/dashed/faded/faintTrace), planets are keyed `<OrbitBody/>` elements (C2-1 null-guarded `useImage`), the sun is a `<SunBody/>`, and an RN `<View>` empty-state overlay shows when the orbiting set is empty (the sun still renders). Tap: `Gesture.Tap().maxDistance(8)` → `runOnJS(handleTap)` → `hitTest` → `navigate('Profile')`; a contact-sun tap navigates, a self-sun tap is a no-op. Vendored `assets/Inter-SemiBold.ttf` (OFL-1.1) and registered it with `useFonts` for the Paragraph-API initials fallback — a NEW-to-repo Skia idiom, labelled in-code as first-proven-on-device (13-08).
- **Task 3 (route + dashboard button):** Added `Orrery: undefined` to `RootStackParamList` and registered `<Stack.Screen name="Orrery">` additively (Home stays initial; no existing route touched). Added a sibling `◎` `dashboard-orbit-entry` button beside the `⚙` gear in HomeScreen's `topBar` (accessibilityLabel "Orbit view", pressed state `colors.accent`, resting `colors.textSecondary`) → `navigate('Orrery')`.

## Task Commits

1. **Task 1: SegmentedControl** — `dbe3cfb` (feat)
2. **Task 2: static status-view orrery render + orrery components + font** — `9d4d4ed` (feat)
3. **Task 3: Orrery route + dashboard ◎ button** — `8365bcc` (feat)

## Files Created/Modified
- `src/components/SegmentedControl.tsx` — generic two-segment filled-accent toggle
- `src/screens/OrreryScreen.tsx` — the screen: measured dims, dimsValid gate, single deriveOrreryMetrics threaded to render+hitTest, Promise.all sun read, tap→Profile, empty state, useFonts
- `src/components/orrery/OrbitBody.tsx` — one keyed planet; its own null-guarded useImage + Paragraph initials
- `src/components/orrery/OrreryCanvas.tsx` — the conditionally-mounted `<Canvas>`+GestureDetector subtree (13-07 useClock home)
- `src/components/orrery/SunBody.tsx` — the centre sun; null-guarded useImage + glow + initials
- `assets/Inter-SemiBold.ttf` — bundled Skia initials font (OFL-1.1)
- `src/navigation/types.ts` — `Orrery: undefined` (additive)
- `src/navigation/RootNavigator.tsx` — `<Stack.Screen name="Orrery">` (additive)
- `src/screens/HomeScreen.tsx` — `◎` dashboard-orbit-entry button beside the gear

## Decisions Made
All within the delegated implementation bucket (the plan pre-specified the architecture; these are the render-detail calls it left to the executor):
- **OrreryScreen owns the map, OrreryCanvas owns the Canvas.** The screen builds `<OrbitBody/>`/ring/`<SunBody/>` elements (hook-free) and passes them as `children` into `OrreryCanvas`, which renders them inside `<Canvas>`. This satisfies both the acceptance grep ("OrreryScreen's `.map()` returns `<OrbitBody/>` elements") and the requirement that the unmountable `<Canvas>` subtree be its own component (13-07's `useClock` home).
- **Static Inter-SemiBold.ttf over the variable Inter.** Fetched the static SemiBold face from the rsms/inter v4.0 release (`extras/ttf/Inter-SemiBold.ttf`, 413976 bytes, verified TrueType, SIL OFL-1.1 with the LICENSE.txt confirming bundling/embedding is permitted) rather than the Google Fonts variable `Inter[opsz,wght].ttf` — it matches the plan filename, is a single weight registered under family `"Inter"` (so the text style needs no `FontWeight` selection), and is smaller.
- **Planet body treatment.** Base filled disc in `orreryRingStyle.bodyFill` (rogue = the cold `rogueExtinguished`) with the photo (clipped `fit="cover"`) or the deterministic `avatarSwatches` swatch + Paragraph initials inset inside a 3px status outline — status stays legible even under a photo. Exact inset/vertical-centering is device-UAT-tunable (13-08).
- **Ring stroke treatment.** `solid` = plain stroke; `dashed`/`faintTrace` add a `DashPathEffect([6,6])`; `faded` → opacity 0.7, `faintTrace` → opacity 0.3 (numeric opacity — not a colour, so check:colors-safe).

## Deviations from Plan
None — plan executed exactly as written. One trivial mechanical fix: `StyleSheet.absoluteFillObject` is not on the RN type surface here, so the empty-state overlay uses explicit `position:'absolute'` + edge insets (behaviour identical).

## Issues Encountered
- **biome check on two touched files (pre-existing, NOT introduced).** `src/navigation/RootNavigator.tsx` and `src/screens/HomeScreen.tsx` were already non-conformant to biome's formatter/organizeImports at HEAD *before* this plan (verified by running `biome check` against the pre-edit versions). My added lines are biome-clean, and the five new files (`SegmentedControl` + the three orrery components + the screen) pass `biome check` cleanly. Per the executor scope boundary, I did NOT reformat the pre-existing unrelated lines (doing so would balloon the diff into churn on `NeverContacted`/`ManageFavourites`/the dashboard import block that this plan never touched). Flagged here so it is not mistaken for a regression — a separate formatting sweep can address the repo-wide biome state if desired.

## Known Stubs
- **The two-view morph is intentionally inert this plan.** The `SegmentedControl`'s `onChange` sets local `view` state only; the status-view layout renders regardless. This is by design — the morph (`withTiming` + per-body `interpolate`/`interpolateColor`, `useClock` ambient loop) is 13-07's scope, and the boundary (per-body `useDerivedValue` in `OrbitBody`, `useClock` in `OrreryCanvas`) is already established here. Not a data stub; no UI reads empty/mock data.

## User Setup Required
None — no external service configuration required. The font is a build-asset already vendored into the repo.

## Next Phase Readiness
- **13-06 Settings star/sun controls** write `self_sun_colour` / `sun_contact_id`; this screen already reads both via `getAppSettings` and resolves them at render, so those writes will reflect on next focus.
- **13-07 ambient motion + morph + radial drag:** the per-body `useDerivedValue` slot is in `OrbitBody`, the `useClock` slot is in `OrreryCanvas` (unmount-on-blur ready), and the tap gesture is a single `Gesture.Tap()` ready to become `Gesture.Race(tap, pan)`. The measured `C` (threaded via refs) is already the single geometry source the drag-release rank map needs.
- **13-08 device UAT** is the first proof of the on-device render: font load + initials, sun/ring/planet draw, rogue extinguished body + bounded drift, empty state, and tap→Profile. Per repo convention `.tsx`/Skia surfaces are device-UAT, not node-tested — no RN render test was written.

## Self-Check: PASSED

All 6 created + 3 modified files exist on disk; all 3 task commits (`dbe3cfb`, `9d4d4ed`, `8365bcc`) are in git history. `npx tsc --noEmit` clean; `npm run check:colors` clean; `npm test` → 1000 passed (83 files); `biome check` clean on the five new files.

---
*Phase: 13-orrery*
*Completed: 2026-08-17*
