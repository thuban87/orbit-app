# ADR-186: Orrery V2 Imperative Picture Renderer Behind a Platform Render Host

**Status:** Accepted
**Date:** 2026-10-05
**Phase:** 38.7-orrery-v2
**Source decisions:** D-01, D-34, D-43, D-44, D-46, D-49, D-52, D-57, D-64, D-65, D-79 (FV-1) (dossier `phase-38.7-orrery-v2-dossier.md`; CONTEXT D-59/D-61 spike rules)
**Reversibility:** costly
**Migration:** None
**Supersedes:** None
**Superseded by:** None

## Context

The production Orrery was a declarative React Native Skia tree: one component per body, sun, label and ring. The renderer labs and the dossier's grounding found five defects in it (D-41/D-52). The frame worklet captured a fresh runtime object every render, which caused 3–7 s switch freezes. There were O(N²) lookups, and every ring point was projected on every frame. Every label Paragraph was rebuilt on every parent render and never disposed. Initials rendered as "El…". A custom System showed as "Unavailable System" after a cold restore. Lab A's imperative pattern cut idle main-thread time from about 92 % to 15–16 % on the Pixel 6 Pro.

## Decision

We will draw the Orrery with a 2.5D Skia renderer, not true 3D (D-01). It stays on the `@shopify/react-native-skia` 2.x line (D-34).

**Picture tree.** `OrreryV2Canvas` owns a small, fixed tree of `<Picture>` layers whose inputs are SharedValues only. JS publishes immutable specs (`scene-specs.ts`). A React commit never re-records or restructures the tree. V2 consumes the same projected `frame` that hit-testing, labels, the focus card and the HUD read, so what is drawn is what is tappable (D-43).

**Rings.** Tilted rings are never stroked under perspective. They are drawn in world space under the camera's exact plane homography, as an analytic SkSL line on cached strips (world-plane rings, D-44/D-64).

**Render host.** One `render-host.ts` seam holds every Android-only or GPU-specific choice: the opaque SurfaceView canvas, the frame-rate hint, the offscreen bake path and the DPR source. iOS and web get seam values but no build (D-46).

**Shared resources.** All Orrery text goes through one `OrreryTextService`. All photos go through one `orrery-photo-cache`. A generation ledger disposes an object only after every layer that recorded it has acknowledged a newer generation (D-46/D-52).

**Ambient clock.** All ambient motion runs on one frame clock quantised to `AMBIENT_HZ` 30, which is still (−1) under reduced motion. The static base is GPU-baked while the camera is still (D-49/D-64).

**Frame-rate vote.** A patched Skia 2.6.2 adds a native `Surface.setFrameRate` vote on the Orrery SurfaceView (D-65). It votes 30 at idle and the panel's top rate (`MOTION_VOTE_HZ` 120) during a switch, gesture or camera motion (FV-1). It votes 0 under reduced motion and is re-applied whenever the surface is recreated.

**Defect fixes.** The D-52 fixes ship first: narrowed worklet captures and a memoised runtime, an O(1) body-key index, a hoisted projection basis, a stable empty `clusterIds`, the custom System name resolved in the store after load, and the switch starting from the displayed camera.

**System Preview.** The System Preview reuses the V2 pieces, kept flat and without cinematic effects (D-57).

## Alternatives Considered

- **Lab C's three.js/WebGPU true-3D renderer.** Rejected by the owner (D-01): it performed worse, and its size behaviour settled the question. Its camera and layout ideas were harvested.
- **Lab B's full-screen ring field, or a hybrid.** This was the D-44 fallback. The Plan 08 release spike measured it and the owner chose world-plane rings (D-64), so no fallback verification build was made (D-61).
- **A JS-thread ambient driver, or a Skia version bump for a frame-rate API.** Rejected. No Skia 2.x release up to 2.14.0 has a frame-rate control, and Expo 57 pins 2.6.2. A patch-package vote was approved instead (D-64/D-65).
- **Withdrawing the vote (0) while in motion.** This was the first FV-1 build. Rejected on release (D-79): motion that no finger drove ran at 30 fps.
- **Skia 3 / Graphite.** Deferred to its own later phase (D-34).

## Consequences

### Positive

- Renderer cost no longer grows with React renders. Label and photo objects are created once per key and disposed safely.
- On the 6 Pro release, the idle panel leaves 120 Hz (60 Hz mode, rendering at 30). Motion runs at the panel's top rate.
- Total PSS is 26–31 % below the Day-1 baseline.

### Negative

- Graphics and GL memory grew (cold +21 %/+15 %, background +45 %/+51 %) because of the opaque canvas and the base bake. The owner accepted this (MEM-1, D-79).
- Idle CPU with animations on is about two thirds of a core. A profiling todo is open (D-80 CPU-1).
- The native vote lives in a patch file that must be re-checked on any Skia bump (D-46 re-verify list).

### Risks

- Worklet capture regressions are guarded by the capture-allowlist and forward-reference tests, not by the type system.
- The Day-1 gates G3 (All Contacts tab return, 1.008 s) and G5 (Size 120 ↔ All Contacts stall, 174.7 ms) were accepted as near misses, not passed (D-79).

## Implementation

**Key files:**
- `src/components/orrery/v2/OrreryV2Canvas.tsx` — fixed picture tree; sole ambient clock owner; sends the frame-rate vote on change.
- `src/components/orrery/v2/render-host.ts` — `resolveOrreryRenderHost`, the platform seam.
- `src/components/orrery/v2/scene-specs.ts` — immutable JS-published specs read by the pictures.
- `src/components/orrery/v2/ambient-clock.ts` — `AMBIENT_HZ` 30, `MOTION_VOTE_HZ` 120, the reduced-motion −1.
- `src/components/orrery/v2/base-bake.ts` — GPU-offscreen bake of the still base.
- `src/components/orrery/v2/draw-plane.ts` — world-plane rings and plane under the homography.
- `src/components/orrery/v2/shaders.ts` — SkSL ring, body and sky effects.
- `src/components/orrery/v2/layer-ack.ts` — per-layer generation acknowledgement.
- `src/logic/orrery-plane-logic.ts` — plane homography math.
- `src/components/orrery/resources/orrery-generation-ledger.ts` — ledger-gated disposal.
- `src/components/orrery/resources/orrery-text-service.ts` — the one Paragraph path.
- `src/components/orrery/resources/orrery-photo-cache.ts` — the one photo-decode path.
- `src/components/orrery/OrreryWorld.tsx` — publishes specs from the shared frame; renders no per-body components.
- `src/components/orrery/SystemPreviewCanvas.tsx` — flat Preview on the V2 pieces.
- `src/stores/orrery-system-store.ts` — custom System name after a cold restore.
- `patches/@shopify+react-native-skia+2.6.2.patch` — native `androidFrameRate` view prop.
- `src/components/orrery/OrreryCanvas.tsx` — deleted; V2 canvas replaced it as clock owner.
- `src/components/orrery/OrbitBody.tsx` — deleted with the declarative renderer.
- `src/components/orrery/SunBody.tsx` — deleted with the declarative renderer.
- `src/components/orrery/SatelliteBody.tsx` — deleted with the declarative renderer.
- `src/components/orrery/OrreryLabel.tsx` — deleted with the declarative renderer.
- `src/components/orrery/ProjectedOrbitRing.tsx` — deleted; per-frame ring polygons removed.
- `src/components/orrery/orrery-clock-context.ts` — deleted.

**Depends on:** ADR-077 (Single Canonical Orrery with a Constrained Inspection Camera); ADR-085 (Live Reduced-Motion Signal for Skia Ambient Animation)
**Required by:** ADR-189 (Painted Per-System Sky and Ambient Orbit Pulses as Permitted Non-Data Motion); ADR-192 (Bounded Warm Resource Cache Across Tab Blur)
