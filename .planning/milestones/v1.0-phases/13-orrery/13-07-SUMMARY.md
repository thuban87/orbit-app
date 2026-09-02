---
phase: 13-orrery
plan: 07
subsystem: orrery — morph + ambient + radial-drag interaction
tags: [orrery, skia, reanimated, morph, useclock, pause-on-blur, ring-seq, radial-drag, gesture-race, device-uat]
status: complete

# Dependency graph
requires:
  - phase: 13-orrery (13-05)
    provides: "OrreryScreen static status render + the H1 keyed-child decomposition (OrbitBody/OrreryCanvas/SunBody), the measured `dimsValid` gate, deriveOrreryMetrics C, the tap gesture + hit-test refs, the SegmentedControl mount"
  - phase: 13-orrery (13-02)
    provides: "orrery-geometry-logic — deriveOrreryMetrics, progressToAngle, evenSpreadAngle, shortestAngleDelta, drawnRadius, polarToXY, MORPH_MS"
  - phase: 13-orrery (13-03)
    provides: "ring-seq-dao rewriteRingSeq(exec, ids, now, excludeContactId) 3-guard one-txn writer; ring-reorder-logic computeRingReorder; orrery-read listOrbitingContacts({excludeContactId})"
  - phase: 13-orrery (13-04)
    provides: "theme tokens mutedStable/mutedWobble/mutedDecay/rogueExtinguished/starPalette"
  - phase: 05-photos
    provides: "CropPhotoScreen Reanimated useSharedValue/useDerivedValue/Gesture idioms (shared-value geometry mirroring)"
provides:
  - "ORR-02 two-view morph — a single Reanimated `morph` shared value (0=Status, 1=Relationship) driven by the SegmentedControl via withTiming(MORPH_MS, ease-in-out); per-body OrbitBody useDerivedValue worklets interpolate angle (statusAngle↔restAngle via shortestAngleDelta) + outline colour (full↔muted via interpolateColor), radius FIXED"
  - "ORR-03 ambient layer — OrreryCanvas owns the sole useClock() driving a starfield twinkle + (via OrreryClockContext) the SunBody glow pulse; pause-on-blur by UNMOUNTING OrreryCanvas on !(dimsValid && useIsFocused && AppState active)"
  - "ORR-06 canvas half — Gesture.Race(tap, pan): a radial drag hit-tests a worklet-safe bodiesShared snapshot, live-previews an accent ghost-ring, and on release snaps to the nearest rank + commits ring_seq via rewriteRingSeq threading sunContactId as excludeContactId, in one transaction"
  - "OrreryClockContext — the single ambient-clock provider (src/components/orrery/orrery-clock-context.ts) so useClock lives only in OrreryCanvas"
affects: [13-08]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Single `morph` shared value + per-body useDerivedValue worklet: the body is drawn at its FIXED status position and TRANSLATED by the polar delta between statusAngle and the live morph angle (radius never interpolated — the shared axis); outline colour morphs via interpolateColor"
    - "useClock lives in exactly ONE place (OrreryCanvas, the conditionally-mounted <Canvas> subtree) and reaches SunBody via OrreryClockContext — a React context whose Provider + consumer are BOTH inside the same <Canvas>, so unmounting the subtree stops every ambient worklet (Pitfall 4: the clock has no pause arg)"
    - "Pause-on-blur = UNMOUNT the clock-owning subtree on !(dimsValid && useIsFocused && AppState==='active') — the RN chrome (header, toggle, empty state) stays mounted; only OrreryCanvas unmounts"
    - "Worklet-safe pan hit-test (M5): resting body positions mirrored into a `bodiesShared` shared value + a `dragMetrics` scalar snapshot, so the UI-thread pan worklet reads shared values only (never a plain JS array/number), mirroring CropPhotoScreen's geometry-into-shared-values idiom"
    - "H2 release-rank map: (releaseRadius − C.ringInner) / C.effectiveGap from the SAME deriveOrreryMetrics object as render + hit-test (effectiveGap floored > 0), never the raw RING_GAP seed (C2-6: the object has no such alias)"
    - "Latest-ref bridge for a stable gesture: a stable `commitFromWorklet` reads a ref updated to the current commit closure, so the pan gesture stays identity-stable while runOnJS always calls the freshest orbiting/sunContactId snapshot"

key-files:
  created:
    - src/components/orrery/orrery-clock-context.ts
    - .planning/phases/13-orrery/13-07-SUMMARY.md
  modified:
    - src/screens/OrreryScreen.tsx
    - src/components/orrery/OrbitBody.tsx
    - src/components/orrery/OrreryCanvas.tsx
    - src/components/orrery/SunBody.tsx

key-decisions:
  - "Morph is a Group-transform TRANSLATE from the status position (not a re-derived cx/cy per element), so the existing clip-rect / photo / initials draw math stays keyed off the static status cx/cy while the animated Group moves the whole body — radius provably never interpolated"
  - "Only the OrbitBody outline circle morphs colour (full↔muted); the avatar swatch + photo disc do not — matching the UI-SPEC 'body treatment' colour, not the avatar background"
  - "Starfield twinkle = a SINGLE Group-opacity oscillation over a deterministic ~44-dot field (one worklet, per-star static base opacity for variation) — cheap and subtle; per-dot phase deferred to 13-08 device tuning"
  - "SunBody reaches the clock via OrreryClockContext (Provider inside OrreryCanvas's <Canvas>) rather than calling useClock itself — keeps useClock in one place so the unmount truly stops the loop; a null clock (unit harness) falls back to a static, unpulsed glow"
  - "Tap hit-test targets whichever view `morph` settled on (view-state-driven status/rest position arrays); a mid-morph tap hits the resting target — accepted per plan"

patterns-established:
  - "Skia render-loop clock ownership + pause via subtree unmount, with a context bridge to sibling animated children"
  - "Worklet-safe direct-manipulation drag → pure reorder → transactional single-writer commit, on the UI thread with a JS-thread runOnJS commit"

requirements-completed: [ORR-02, ORR-03, ORR-06]

coverage:
  - id: T1
    description: "Two-view morph — one `morph` shared value driven by the SegmentedControl via withTiming(MORPH_MS, ease-in-out); OrbitBody per-body useDerivedValue worklets interpolate angle (shortestAngleDelta) + outline colour (interpolateColor full↔muted), radius FIXED; H1 — the morph hooks live in the keyed OrbitBody, not a .map()"
    requirement: "ORR-02"
    verification:
      - kind: other
        ref: "npx tsc --noEmit clean; npm run check:colors clean (muted/full colours are tokens, no hex); npm test 1000 green; biome clean. No useDerivedValue in a .map() in OrreryScreen. Morph feel is device-UAT (13-08)."
  - id: T2
    description: "Ambient layer + pause-on-blur — OrreryCanvas owns the sole useClock() driving a starfield twinkle + (via OrreryClockContext) the SunBody glow pulse; OrreryScreen unmounts OrreryCanvas on !(dimsValid && useIsFocused && AppState active); bodies stay static"
    requirement: "ORR-03"
    verification:
      - kind: other
        ref: "grep: useClock appears only in OrreryCanvas.tsx (call), comment-only mentions in OrreryScreen/SunBody; OrreryScreen gates the <OrreryCanvas> ELEMENT (not just derived values) on dimsValid+focus+AppState. tsc/check:colors/test/biome green. Twinkle/pulse + that unmount stops the clock are device-UAT (13-08)."
  - id: T3
    description: "Radial drag → ring_seq — Gesture.Race(tap, pan); M5 worklet-safe bodiesShared + activeDragId; H2 release-radius → clamped rank via deriveOrreryMetrics; commitRingSeq threads sunContactId as excludeContactId → rewriteRingSeq in one txn; accent ghost-ring preview; re-read + reflow on success, alert + re-read on failure"
    requirement: "ORR-06 (canvas half)"
    verification:
      - kind: other
        ref: "grep: Gesture.Race present; rewriteRingSeq(exec, newIds, localDateTime(), sun.sunContactId); pan worklet reads bodiesShared.value; re-read uses excludeContactId: sun.sunContactId. tsc/check:colors/test/biome green. Drag + persist is device-UAT (13-08)."

metrics:
  duration_minutes: 14
  completed: 2026-08-17
  tasks_completed: 3
  files_created: 2
  files_modified: 4
  commits: 3
---

# Phase 13 Plan 07: Orrery morph + ambient + radial-drag Summary

Upgraded the static status-view orrery into the full interactive Skia surface: the two-view morph (ORR-02), the ambient starfield/sun-pulse layer that pauses by unmounting on blur (ORR-03), and the `ring_seq` radial drag with a transactional commit (ORR-06's canvas half) — all driven off the UI thread via Reanimated worklets, with every per-body/clock hook inside a keyed child and every layout number from the one shared `deriveOrreryMetrics` object.

## What shipped

### Task 1 — Two-view morph (ORR-02)
A single `morph = useSharedValue(0)` in `OrreryScreen` (0 = Status default, 1 = Relationship). The `SegmentedControl` `onChange` now sets React `view` (for chrome + hit-test) AND drives `morph.value = withTiming(target, { duration: MORPH_MS, easing: Easing.inOut(Easing.ease) })`. Per body, the screen precomputes BOTH endpoint angles from the SAME measured `C` — `progressToAngle(progress)` (status) and `evenSpreadAngle(rank, count)` (relationship) — plus the fixed drawn radius (`drawnRadius`, the shared axis) and the `shortestAngleDelta` between them, and passes them as props into the keyed `<OrbitBody>`. Inside `OrbitBody` (H1 — one hook set per body, never in a `.map()`), two `useDerivedValue` worklets: a Group `transform` that translates the whole body from its status position by the polar delta of `statusAngle + morph·angleDelta` (radius never interpolated — Pitfall 2 short-way handled by the precomputed delta), and an `interpolateColor(morph, [0,1], [fullFill, mutedFill])` on the status outline circle. The tap hit-test now targets whichever view `morph` settled on.

### Task 2 — Ambient layer + pause-on-blur (ORR-03)
`OrreryCanvas` gained the SOLE `useClock()` (M5), driving a subtle starfield twinkle — a single Group-opacity oscillation over a deterministic ~44-dot field, star tones passed as `textSecondary`/`textPrimary`/`starPalette` tokens — and, via the new `OrreryClockContext`, the `SunBody` glow pulse (radius ±10% / opacity ±40%, ~3 s). `SunBody` reads the clock through context (never calls `useClock`) and falls back to a static glow when no clock is in scope. Bodies do not animate. `OrreryScreen` computes a mount boolean `dimsValid && placement && useIsFocused() && appActive` (an `AppState` 'change' listener mirroring HomeScreen) and renders `{canvasVisible ? <OrreryCanvas/> : null}` — UNMOUNTING the clock-owning subtree is what stops the loop (Pitfall 4); the RN chrome stays mounted.

### Task 3 — Radial drag → ring_seq (ORR-06 canvas half)
`Gesture.Race(tapGesture, panGesture)` now feeds `OrreryCanvas`. The resting body positions are mirrored into a worklet-safe `bodiesShared` shared value and a `dragMetrics` scalar snapshot (M5); the `Gesture.Pan().minDistance(10)` worklet hit-tests the touch-down body against `bodiesShared.value` on the UI thread and sets `activeDragId`, `onUpdate` tracks the radius for an accent ghost-ring preview (angular component ignored), and `onEnd` maps the release radius to `clamp(round((releaseRadius − C.ringInner) / C.effectiveGap), 0, N−1)` (H2 — the SAME metrics object as render/hit-test) then `runOnJS(commit)`. `commitRingSeq` runs `computeRingReorder` over the rendered sun-excluded orbiting list and `await rewriteRingSeq(getExecutor(), newIds, localDateTime(), sun.sunContactId)` in one transaction — threading `sunContactId` as `excludeContactId` so the N−1 dragged list agrees with Guard 2 (the fixed cross-plan blocker). On success it re-reads `listOrbitingContacts({ excludeContactId: sunContactId })` to reflow; on failure it alerts and re-reads the persisted truth. C2-4: the gesture lives inside `OrreryCanvas`, mounted only when `dimsValid` (+focus), so the release-rank division is never reachable on a degenerate canvas.

## Review-concern mitigations carried through
- **H1 (Rules of Hooks):** every per-body morph `useDerivedValue` is inside `OrbitBody`; OrreryScreen's `.map()` returns elements only. Grep: no `useDerivedValue` in a `.map()` in OrreryScreen.
- **M5 (clock boundary + worklet-safe drag):** `useClock` is called only in OrreryCanvas (grep-confirmed — the OrreryScreen/SunBody hits are comments); the pan worklet reads `bodiesShared`/`dragMetrics` shared values, never a plain JS array.
- **H2 / C2-6:** the release-rank map divides by `C.effectiveGap` from `deriveOrreryMetrics` (floored > 0), never a raw `RING_GAP`.
- **C2-4:** the `GestureDetector` + clock mount are gated on `dimsValid`.
- **Guard-alignment fix:** `commitRingSeq` threads `sun.sunContactId` as `excludeContactId` on both the write and the reflow re-read, so a contact-sun reorder clears Guard 2 instead of rolling back.
- **Pitfall 5:** `rewriteRingSeq` runs off the worklet via `runOnJS` in its own one transaction — never nested.

## Colour discipline
Every Skia colour resolves through theme tokens: the morph endpoints are `statusStable/Wobble/Decay` ↔ `mutedStable/Wobble/Decay` (rogue → `rogueExtinguished` in both views), the starfield uses `textSecondary/textPrimary/starPalette`, the ghost ring is `accent`, and the background/glow tokens are unchanged. `npm run check:colors` stays green — no hex literal added, including inside `interpolateColor` endpoints.

## Deviations from Plan
None — plan executed exactly as written. No auto-fixes, no auth gates, no architectural escalations. `useClock` is imported from `@shopify/react-native-skia` (not reanimated); this matched the plan's "new-to-repo Skia idiom" framing.

## Known Stubs
None. All three interactions are fully wired to the tested geometry, reorder, and DAO modules. `useClock` behavior and the drag→persist round-trip are first proven on device in 13-08 (an expected verification point, not a stub).

## Verification
- `npx tsc --noEmit` — clean
- `npm run check:colors` — clean (no hex; morph/star/ghost colours are tokens)
- `npx biome check` (the 5 touched files) — clean (added lines conformant; no unrelated reformatting)
- `npm test` — 83 files, 1000 tests green

The `.tsx`/Skia render loop + gestures are DEVICE-UAT on the Pixel (13-08) per the phase plan — no RN render test written; perf claims are Pixel-only (the emulator cannot assess a Skia render loop).

## Commits
- `d204f33` feat(13-07): two-view morph (Status↔Relationship) on one canvas
- `ea4370c` feat(13-07): ambient starfield twinkle + sun-glow pulse with pause-on-blur
- `de20aca` feat(13-07): radial drag → ring_seq transactional commit (ORR-06 canvas half)

## Self-Check: PASSED
- FOUND: src/components/orrery/orrery-clock-context.ts
- FOUND: src/screens/OrreryScreen.tsx (morph + canvasVisible gate + Gesture.Race + commitRingSeq)
- FOUND: src/components/orrery/OrbitBody.tsx (morph props + bodyTransform/outlineColor worklets)
- FOUND: src/components/orrery/OrreryCanvas.tsx (useClock + starfield + OrreryClockContext.Provider)
- FOUND: src/components/orrery/SunBody.tsx (useOrreryClock + pulse)
- FOUND: commit d204f33
- FOUND: commit ea4370c
- FOUND: commit de20aca
