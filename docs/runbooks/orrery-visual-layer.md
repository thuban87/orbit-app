# Orrery Visual Layer Pipeline

## Overview

Use this process when adding or materially changing a visual or interaction layer in Orbit's Skia Orrery. It keeps the canonical world separate from the transient camera, derives relationship state locally, preserves token-only colour use, and treats physical-device rendering as the proof for canvas behavior.

## Architecture (Phase 29)

`OrreryScreen` owns local scene reloads, measured obstacles, navigation, lifecycle cancellation, and the canvas mount gate. `loadOrreryScene()` reads one coherent System snapshot, then derives Gravity and world geometry after that snapshot releases. `OrreryWorld` projects that immutable world through the UI-thread camera frame; only discrete focus, Profile, and reorder intents cross to JavaScript.

### World, camera, and System scope

**Files:** `src/services/orrery-scene.ts`, `src/logic/orrery-world-logic.ts`, `src/logic/orrery-camera-logic.ts`, `src/db/orrery-system-read.ts`

The world holds timestamp/neutral placement, density spacing, bounded collision nudges, and modest derived Gravity mass. The camera holds transient pan, zoom, tilt, yaw, and focal distance. A System is a closed built-in or Category-UID predicate over current local data; it is never Dashboard state or a frozen member list.

```typescript
const scene = await loadOrreryScene(exec, generation, system);
const home = deriveHomePose(scene.world, viewport);
const frame = projectFrame(scene.world, pose, viewport, generation);
```

### Render and lifecycle boundary

**Files:** `src/components/orrery/OrreryWorld.tsx`, `src/components/orrery/OrreryCanvas.tsx`, `src/components/orrery/use-orrery-camera.ts`

`OrreryWorld` renders keyed body resources, semantic labels, satellites, and hit targets from one sampled projected frame. `OrreryCanvas` remains the only ambient-clock owner and is unmounted when the route blurs, the app backgrounds, or dimensions are invalid. Reanimated owns continuous camera and render-loop work; React state changes only for discrete data and UI state.

### Relationship satellites

**Files:** `src/db/orrery-satellites-read.ts`, `src/logic/orrery-satellite-logic.ts`

The reader returns only unlinked, nondeleted, visible structured Relationships whose parents are members of the active System. The logic derives subordinate moon positions and context-only actions. Satellites have no contact health, Gravity, Profile, rank, logging, or children.

## File Locations

| File | Purpose |
|---|---|
| `src/screens/OrreryScreen.tsx` | Owns screen lifecycle, layout obstacles, controls, navigation, and cancellation. |
| `src/services/orrery-scene.ts` | Loads coherent scene state and coordinates optional satellite work. |
| `src/db/orrery-system-read.ts` | Reads live System members, global sun identity, and guarded reorder fingerprints. |
| `src/logic/orrery-world-logic.ts` | Derives density-aware canonical world geometry and bounded Gravity mass. |
| `src/logic/orrery-camera-logic.ts` | Owns bounded projection, inverse, Home, hit targets, and arbitrary-body framing. |
| `src/components/orrery/OrreryWorld.tsx` | Renders the world from the current UI-thread projected frame. |
| `src/db/ring-seq-dao.ts` | Commits a validated System-scoped reorder under the shared write lock. |

## How to Add or Change an Orrery Layer

1. **Put deterministic placement or hit math** in `src/logic/orrery-world-logic.ts` or `src/logic/orrery-camera-logic.ts`. Keep it free of React Native, Skia, and mutable screen state.

2. **Compose local data into the existing snapshot.** A scene reader receives the snapshot executor from `readOrrerySystemSnapshotCore`; it must not open a nested mutex, perform per-contact queries, or add a network dependency.

3. **Add visible colours as theme tokens.** Pass resolved tokens into Skia components. Do not add a colour literal outside `src/theme/theme-presets.ts`.

4. **Keep body resources keyed and hooks unconditional.** A dynamic map may return a keyed child, but must not call `useImage`, `useDerivedValue`, or another hook directly. A photo-less body passes a null-guarded source to its child hook.

5. **Use the shared UI-thread frame for continuous behavior.** Do not use `setState` for camera, interpolation, labels, depth, or animation frames. Put worklet helpers before their worklet callers: Reanimated's transform does not preserve ordinary function-hoisting behavior.

6. **Route reordering through `commitRingReorder()`.** The request must carry the complete contacted order, current System membership, sun, and ID/UID fingerprints. It may permute only eligible visible slots and must never write `last_contact` or nest `inWriteTransaction()`.

7. **Run the focused checks and inspect on a physical Pixel.** The desktop emulator cannot establish Skia performance or native gesture behavior.

   ```bash
   npx vitest run src/db/orrery-system-read.test.ts src/db/orrery-impact-read.test.ts src/db/orrery-satellites-read.test.ts src/logic/orrery-camera-logic.test.ts src/logic/orrery-world-logic.test.ts src/logic/ring-reorder-logic.test.ts src/services/orrery-scene.test.ts
   npx tsc --noEmit
   npm run check:colors
   ```

### What You Don't Need to Change

- Do not duplicate `PROGRESS_SQL` or `STATUS_SQL`; the System reader consumes the status engine's source of truth.
- Do not store camera pose, focus, status, progress, Gravity, or display rank. Camera state is a navigation session; the others are derived reads.
- Do not add a second Orrery mode, an Orrery sun-assignment gesture, a custom-System editor, or social-graph schema.
- Do not treat a satellite as a contact or add photo/network retrieval for it.

## Pitfalls

1. **Canvas visibility is not clock pause.** Hiding a derived value leaves `useClock()` running. Unmount `OrreryCanvas` when blurred, backgrounded, or unmeasured.

2. **A worklet helper declared after its caller can crash only on device.** Reanimated can capture that later helper as `undefined` even though Vitest passes. Keep helper definitions above their worklet callers.

3. **A Category name is not a System identity.** Persist and validate the Category UID; resolve deletion at read time and recover to All Contacts.

4. **Global-sun actionability does not grant membership.** An excluded contact sun has focus/Profile actions but no companion row or satellite context.

5. **A bounded query is not a latency guarantee.** Scene and fresh target reads queue behind the shared snapshot mutex; cancellation must suppress publication rather than bypassing the transaction order.

## Smoke Test

```bash
npx vitest run src/db/orrery-system-read.test.ts src/db/orrery-impact-read.test.ts src/db/orrery-satellites-read.test.ts src/logic/orrery-camera-logic.test.ts src/logic/orrery-world-logic.test.ts src/logic/ring-reorder-logic.test.ts src/services/orrery-scene.test.ts
npx tsc --noEmit
npm run check:colors
```

Expected: the focused suites pass, TypeScript emits no errors, and the colour gate reports no literals outside theme presets.

On a physical Pixel, verify pan, pinch, tilt, yaw, focus/Profile behavior, ambiguous-group access, a System change, satellite visibility, guarded hold-reorder, and blur/background pause for a changed layer. Record native evidence in the Phase 29 checklist before making rendering or performance claims.
