# Orrery Visual Layer Pipeline

## Overview

Use this process when adding or materially changing a visual or interaction layer in Orbit's Skia Orrery. It keeps relationship state local and derived, isolates dynamic Skia hooks in keyed children, preserves token-only colour use, and treats physical-device rendering as the proof for canvas behavior.

## Architecture (Phase 13)

`OrreryScreen` owns local reads, measured layout, navigation, and gesture commits. It builds Skia children and passes them to `OrreryCanvas`; that canvas is conditionally mounted and owns the single ambient `useClock()`. `OrbitBody` owns one planet's `useImage` and morph worklets, while `SunBody` consumes the shared clock for its pulse.

### Geometry and rendered state

**Files:** `src/logic/orrery-geometry-logic.ts`, `src/db/orrery-read.ts`

The local read composes the status engine's SQL and returns a dense display order. Geometry stays in a React-Native-free module so it can be node-tested before a canvas is involved.

```typescript
const metrics = deriveOrreryMetrics(canvasWidth, canvasHeight, orbiting.length);
const angle = progressToAngle(contact.progress);
const radius = drawnRadius(contact.progress, rank, contact.status, metrics);
const point = polarToXY(metrics.cx, metrics.cy, radius, angle);
```

### Animation and pause boundary

**File:** `src/components/orrery/OrreryCanvas.tsx`

`OrreryCanvas` is the only ambient-clock owner. It stays mounted only when the route is focused, the app is foregrounded, and dimensions are valid. The screen chrome may remain mounted; the Canvas subtree must not.

### Fallback Chain / Resolution Order

1. **Local photo** — `OrbitBody` or `SunBody` loads the raw relative path through `resolvePhotoUri()`.
2. **Themed initials avatar** — a missing or failed image renders the deterministic avatar swatch and bundled Inter Paragraph text.
3. **Empty sky** — no orbiting contacts leaves the sun visible with the in-app first-contact prompt.

## File Locations

### Assets

**Directory:** `assets/`

`Inter-SemiBold.ttf` is the bundled font used by Skia's Paragraph API. Keep an Orrery font local and bundled; Skia has no reliable OS-font fallback for the initials path.

### Code

| File | Purpose |
|---|---|
| `src/screens/OrreryScreen.tsx` | Screen-level local reads, layout, view state, gestures, and canvas mount gate. |
| `src/components/orrery/OrreryCanvas.tsx` | Canvas, starfield, sole ambient clock, and gesture detector. |
| `src/components/orrery/OrbitBody.tsx` | One keyed planet with photo/fallback and Status ↔ Relationship morph. |
| `src/components/orrery/SunBody.tsx` | Central occupant, glow, and shared-clock pulse. |
| `src/logic/orrery-geometry-logic.ts` | Pure angles, positions, drift, hit testing, and responsive metrics. |
| `src/logic/orrery-ring-logic.ts` | Status-ring style and rogue-body vocabulary. |
| `src/theme/theme-types.ts` | Theme contract for star, muted, and extinguished-rogue values. |
| `src/theme/theme-presets.ts` | Sole home of the Orrery's palette literals. |

## How to Add or Change an Orrery Layer

1. **Define deterministic visual math** in `src/logic/orrery-geometry-logic.ts` when the layer changes position, hit testing, size, or timing. Keep it free of React Native, Skia, and screen state.

2. **Add node tests** beside that logic before editing the screen:

   ```bash
   npx vitest run src/logic/orrery-geometry-logic.test.ts
   ```

   Cover normal, zero/short canvas, maximum drift, and overlap boundaries relevant to the change.

3. **Add visible colours as theme tokens** in `src/theme/theme-types.ts` and `src/theme/theme-presets.ts`. Pass resolved tokens as props to Skia components; never add a raw colour literal outside the preset file.

4. **Put per-body hooks in a keyed child.** A dynamic `.map()` in `OrreryScreen` may return elements, but it must not call `useImage`, `useDerivedValue`, or another hook. For a new body layer, use the existing boundary:

   ```tsx
   {orbiting.map((contact) => (
     <OrbitBody key={contact.id} {...bodyProps(contact)} />
   ))}
   ```

5. **Preserve unconditional image hooks.** Give `useImage` a null-guarded source so a photo-less contact never changes hook order:

   ```tsx
   const image = useImage(photo ? resolvePhotoUri(photo) : null);
   ```

6. **Keep a continuous animation inside `OrreryCanvas`.** For a new ambient worklet, consume its existing clock or add it there. Gate the element, not only a derived value:

   ```tsx
   const canvasVisible = dimsValid && isFocused && appState === "active";
   return canvasVisible ? <OrreryCanvas {...props} /> : null;
   ```

7. **Route direct manipulation through existing pure logic and the DAO.** A rank change must use `computeRingReorder()` then `rewriteRingSeq()` with the current `sunContactId` exclusion. Do not write `last_contact` and do not nest an `inWriteTransaction()` call.

8. **Verify source-level gates**, then build and inspect on a physical Pixel:

   ```bash
   npx tsc --noEmit
   npm run check:colors
   npm test
   ```

### What You Don't Need to Change

- Do not duplicate `PROGRESS_SQL`, `STATUS_SQL`, or `ROGUE_K`; `orrery-read` imports the status engine's source of truth.
- Do not add stored status, progress, or visual rank fields; display rank is dense and read-time derived.
- Do not add a second sun-assignment gesture to the canvas; Settings owns **Sun / centre**.
- Do not modify photo storage or introduce a network image path; the Orrery consumes the established local master/fallback pipeline.

## Pitfalls

1. **Canvas visibility is not clock pause.** Hiding a derived value leaves `useClock()` running. Unmount `OrreryCanvas` when blurred, backgrounded, or unmeasured.

2. **Remove drift before converting a radial release to rank.** Use the dragged body's `driftPush`; otherwise a rogue body jumps rings even when released where it was picked up.

3. **Keep sun exclusion symmetric.** The render read and `rewriteRingSeq()` guards must exclude the same contact sun, or the transactional count guard rejects the drag list.

4. **Respect high-density limits.** The current minimum gap can overlap planets at high contact counts. Treat a capacity change as a visual/product decision and test it on a device.

5. **Fast Refresh can leave Expo SQLite statements invalid in debug.** A clean relaunch is the first diagnostic step before changing a local read query.

## Smoke Test

```bash
npx vitest run src/logic/orrery-geometry-logic.test.ts src/logic/orrery-ring-logic.test.ts src/logic/ring-reorder-logic.test.ts src/logic/sun-occupant-logic.test.ts
npx tsc --noEmit
npm run check:colors
```

Expected: all targeted tests pass, TypeScript emits no errors, and the colour gate reports no literals outside theme presets.

On a physical Pixel, open the dashboard Orbit button; verify the sun, rings, photo/fallback planets, Status ↔ Relationship morph, radial reorder, and blur/background pause for any changed layer.
