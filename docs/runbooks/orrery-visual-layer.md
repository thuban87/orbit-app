# Orrery Visual Layer Pipeline

## Overview

Use this process when adding or materially changing a visual or interaction layer in Orbit's Skia Orrery. It keeps the canonical world separate from the transient camera, derives relationship state locally, preserves token-only colour use, and treats physical-device rendering as the proof for canvas behavior.

## Architecture (Phase 38.7 — Orrery V2)

`OrreryScreen` owns local scene reloads, measured obstacles, navigation, lifecycle cancellation, and the canvas mount gate. `loadOrreryScene()` reads one coherent System snapshot, then derives Gravity and world geometry after that snapshot releases. `OrreryWorld` projects that immutable world through the UI-thread camera frame; only discrete focus, Profile, and reorder intents cross to JavaScript.

### World, camera, and System scope

**Files:** `src/services/orrery-scene.ts`, `src/logic/orrery-world-logic.ts`, `src/logic/orrery-camera-logic.ts`, `src/db/orrery-system-read.ts`

The world holds timestamp/neutral placement, density spacing, bounded collision nudges, and modest derived Gravity mass. The camera holds transient pan, zoom, tilt, yaw, and focal distance. A System is a closed built-in, Category-UID, or custom reference over current local data; it is never Dashboard state or a frozen member list. Custom membership composes closed rules, a post-query Gravity pass, and ref-keyed manual overrides before entering the same scene pipeline.

```typescript
const scene = await loadOrreryScene(exec, generation, system);
const home = deriveHomePose(scene.world, viewport);
const frame = projectFrame(scene.world, pose, viewport, generation);
```

### Render and lifecycle boundary

**Files:** `src/components/orrery/OrreryWorld.tsx`, `src/components/orrery/v2/OrreryV2Canvas.tsx`, `src/components/orrery/v2/scene-specs.ts`, `src/components/orrery/v2/render-host.ts`, `src/components/orrery/use-orrery-camera.ts`

`OrreryWorld` computes one sampled projected frame and publishes immutable body, label and overlay specs (`scene-specs.ts`). It renders no per-body components. `OrreryV2Canvas` draws a small, fixed list of `<Picture>` layers: sky, base (rings and grid), stars, pulses, switch effects, bodies behind the sun, the sun, bodies in front, labels and overlay. Each layer is recorded on the UI thread from SharedValues (ADR-186). It is the only ambient-clock owner (`ambient-clock.ts`, `AMBIENT_HZ` 30) and is unmounted when the route blurs, the app backgrounds, or dimensions are invalid. Platform-specific choices (opaque SurfaceView, frame-rate vote, bake path) live behind `resolveOrreryRenderHost`. Hit targets, labels and the focus card read the same frame, so what is drawn is what is tappable.

### Resources

**Files:** `src/components/orrery/resources/orrery-photo-cache.ts`, `src/components/orrery/resources/orrery-text-service.ts`, `src/components/orrery/resources/orrery-generation-ledger.ts`, `src/components/orrery/resources/orrery-warm-cache.ts`

Photos and Paragraphs have exactly one creation path each. A layer that records an SkImage, Paragraph or baked image acknowledges its generation through `layer-ack.ts`. The ledger disposes the old object only after every recording layer has acknowledged a newer one. CPU-backed objects survive an ordinary tab blur in the bounded warm cache (ADR-192).

### System authoring, Preview and switching

**Files:** `src/screens/SystemBuilderScreen.tsx`, `src/components/orrery/SystemPreviewCanvas.tsx`, `src/logic/orrery-switch-choreography.ts`, `src/components/orrery/use-orrery-switch-runtime.ts`

The builder resolves an unsaved definition through the DB-owned draft wrapper, expands it into canonical world geometry, and renders simplified rails and markers on an inert decorative canvas. The live switch runtime sits above the conditional canvas mount. It samples retained, leaving and entering bodies through accelerate, shed, capture and settle stages, and preserves the displayed sample through re-targeting or lifecycle pause. Reduced Motion selects the direct non-rotational path.

### Relationship satellites

**Files:** `src/db/orrery-satellites-read.ts`, `src/logic/orrery-satellite-logic.ts`

The reader returns only unlinked, nondeleted, visible structured Relationships whose parents are members of the active System. The logic derives subordinate moon positions and context-only actions. Satellites have no contact health, Gravity, Profile, rank, logging, or children.

## File Locations

| File | Purpose |
|---|---|
| `src/screens/OrreryScreen.tsx` | Owns screen lifecycle, layout obstacles, controls, navigation, and cancellation. |
| `src/services/orrery-scene.ts` | Loads coherent scene state and coordinates optional satellite work. |
| `src/db/orrery-system-read.ts` | Reads live System members, global sun identity, and guarded reorder fingerprints. |
| `src/logic/system-rule-resolver.ts` | Resolves custom rules and manual overrides without writing during a read. |
| `src/db/systems-dao.ts` | Owns System definitions, overrides, ordering, deletion and Undo transactions. |
| `src/logic/orrery-world-logic.ts` | Derives density-aware canonical world geometry and bounded Gravity mass. |
| `src/logic/orrery-camera-logic.ts` | Owns bounded projection, inverse, Home, hit targets, and arbitrary-body framing. |
| `src/components/orrery/OrreryWorld.tsx` | Projects the world on the UI thread and publishes the V2 specs. |
| `src/components/orrery/v2/OrreryV2Canvas.tsx` | Fixed picture tree; sole ambient clock owner; frame-rate vote. |
| `src/components/orrery/v2/scene-specs.ts` | Immutable JS-published specs and `tokenInk` colour conversion. |
| `src/components/orrery/v2/visual-tunables.ts` | Owner-tuned look constants (sky, pulses, bodies, switch). |
| `src/components/orrery/v2/draw-plane.ts` | Example layer: rings, grid and pulses under the plane homography. |
| `src/components/orrery/resources/orrery-generation-ledger.ts` | Generation-gated disposal for recorded objects. |
| `src/components/orrery/use-orrery-switch-runtime.ts` | Owns live switch progress, re-targeting, camera coordination and lifecycle holds. |
| `src/components/orrery/SystemPreviewCanvas.tsx` | Renders the flat provisional System preview on the V2 pieces, without cinematic effects (D-57). |
| `src/db/ring-seq-dao.ts` | Commits a validated System-scoped reorder under the shared write lock. |

## How to Add or Change an Orrery Layer

1. **Put deterministic placement or hit math** in `src/logic/orrery-world-logic.ts` or `src/logic/orrery-camera-logic.ts`. Keep it free of React Native, Skia, and mutable screen state.

2. **Compose local data into the existing snapshot.** A scene reader receives the snapshot executor from `readOrrerySystemSnapshotCore`; it must not open a nested mutex, perform per-contact queries, or add a network dependency.

   For a custom System, extend `system-rule-resolver.ts` and keep values in its closed vocabulary. Reuse Dashboard predicates, keep Gravity in the TypeScript pass, bind every runtime value, and preserve broken rule rows for user repair. Do not make the read path prune stale exclusions; an intentional definition save owns that write.

3. **Add visible colours as theme tokens.** Add an `orrery*` token to `ThemePalette` in `src/theme/theme-types.ts`, and give it a value in all four palettes in `src/theme/theme-presets.ts`. Pass it to Skia or SkSL as numeric RGBA through `scene-specs` `tokenInk`, never as a literal. Pick the blend by the resolved theme mode (dark: additive/screen allowed; light: src-over with ink), never by luminance. Do not add a colour literal outside `src/theme/theme-presets.ts`.

4. **Draw inside an existing picture layer, or add one to the fixed list.** Write a `draw-*.ts` recorder in `src/components/orrery/v2/` that reads SharedValue specs only. Add any new spec fields in `scene-specs.ts`. Never add a React component per body, and never let a React commit re-record or restructure the tree. Get photos from `orreryPhotoCache` and text from `OrreryTextService`, and acknowledge the generation through `layer-ack.ts` so the ledger can dispose safely. Ambient motion reads the shared ambient clock (−1 = still under reduced motion), never its own clock. Owner-tunable numbers go in `visual-tunables.ts`. Tilted geometry is drawn in world space under the plane homography and is never stroked under a perspective transform (ADR-186).

5. **Use the shared UI-thread frame for continuous behavior.** Do not use `setState` for camera, interpolation, labels, depth, or animation frames. Capture only SharedValues and small ids in a worklet, never the switch runtime or scene objects (the capture-allowlist test fails otherwise). Put worklet helpers before their worklet callers, and do not give a worklet default parameters: Reanimated's transform does not preserve ordinary function-hoisting behavior. A new file under `src/components/orrery/v2/` is covered by `orrery-worklet-order.test.ts`.

   Framing comes from persistent chrome only (`framingViewport`). A new floating surface must not be added as a framing obstacle (ADR-188).

   A System transition must feed one sampled world into projection, rings, bodies, labels, culling and hit testing. Keep its runtime above `OrreryWorld` so a blur/background canvas unmount cannot discard the displayed sample. Filter persistence-only store publications; they are not new scenes.

6. **Route reordering through `commitRingReorder()`.** The request must carry the complete contacted order, current System membership, sun, and ID/UID fingerprints. It may permute only eligible visible slots and must never write `last_contact` or nest `inWriteTransaction()`.

7. **Run the focused checks and inspect on a physical Pixel.** The desktop emulator cannot establish Skia performance or native gesture behavior.

   ```bash
   npx vitest run src/db/orrery-system-read.test.ts src/db/systems-dao.test.ts src/logic/system-rule-resolver.test.ts src/db/orrery-impact-read.test.ts src/db/orrery-satellites-read.test.ts src/logic/orrery-camera-logic.test.ts src/logic/orrery-world-logic.test.ts src/logic/orrery-switch-choreography.test.ts src/components/orrery/orrery-switch-runtime.test.ts src/services/orrery-scene.test.ts src/components/orrery/v2 src/components/orrery/resources src/components/orrery/orrery-worklet-order.test.ts src/components/orrery/orrery-frame-mapper.test.ts
   npx tsc --noEmit
   npm run check:colors
   ```

### What You Don't Need to Change

- Do not duplicate `PROGRESS_SQL` or `STATUS_SQL`; the System reader consumes the status engine's source of truth.
- Do not store camera pose, focus, status, progress, Gravity, or display rank. Camera state is a navigation session; the others are derived reads.
- Do not add a second Orrery mode, an Orrery sun-assignment gesture, nested/System-composed queries, or social-graph schema.
- Do not treat a satellite as a contact or add photo/network retrieval for it.

## Pitfalls

1. **Canvas visibility is not clock pause.** Hiding a derived value leaves the clock running. Unmount `OrreryV2Canvas` when blurred, backgrounded, or unmeasured; the warm cache, not the canvas, is what survives a tab blur.

2. **A worklet helper declared after its caller can crash only on device.** Reanimated can capture that later helper as `undefined` even though Vitest passes. Keep helper definitions above their worklet callers.

3. **A Category name is not a System identity.** Persist and validate the Category UID; resolve deletion at read time and recover to All Contacts.

4. **Global-sun actionability does not grant membership.** An excluded contact sun has focus/Profile actions but no companion row or satellite context.

5. **A bounded query is not a latency guarantee.** Scene and fresh target reads queue behind the shared snapshot mutex; cancellation must suppress publication rather than bypassing the transaction order.

6. **A persistence publication is not a scene change.** Publishing settings-save status into an active switch can replace its sampled world with the settled destination after only a few frames. Gate scene publication by status, generation and snapshot identity.

7. **System Undo can encounter a deleted override contact.** The current restore is atomic and therefore fails if a snapshotted override contact was purged or merged during the short Undo window. Do not claim partial recovery until the DAO deliberately filters missing contact IDs.

8. **Disposing on a React commit is a use-after-free.** A recorded picture can still reference an SkImage or Paragraph after the commit that stopped publishing it. Dispose only through the generation ledger.

9. **A DEBUG frame rate is not a measurement.** V2 performance claims need a release build on a physical phone (`docs/runbooks/orrery-perf-measurement.md`); SurfaceView frames are invisible to `dumpsys gfxinfo`.

## Smoke Test

```bash
npx vitest run src/db/orrery-system-read.test.ts src/db/systems-dao.test.ts src/logic/system-rule-resolver.test.ts src/db/orrery-impact-read.test.ts src/db/orrery-satellites-read.test.ts src/logic/orrery-camera-logic.test.ts src/logic/orrery-world-logic.test.ts src/logic/orrery-switch-choreography.test.ts src/components/orrery/orrery-switch-runtime.test.ts src/services/orrery-scene.test.ts src/components/orrery/v2 src/components/orrery/resources src/components/orrery/orrery-worklet-order.test.ts src/components/orrery/orrery-frame-mapper.test.ts
npx tsc --noEmit
npm run check:colors
```

Expected: the focused suites pass, TypeScript emits no errors, and the colour gate reports no literals outside theme presets.

On a physical Pixel, verify pan, pinch, tilt, yaw, focus/Profile behavior, ambiguous-group access, custom-System switching, satellite visibility, guarded hold-reorder, re-targeting, Reduced Motion, and blur/background pause for a changed layer. Record native evidence in the owning phase's device artifact before making rendering or performance claims.
