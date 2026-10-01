# Lab B — Productionization

What it would take to ship Lab B's ideas in a clean Orrery V2. The lab branch itself is
**never merged**: V2 re-implements from `HARVEST.md`. This file is about cleanup, tests,
accessibility, performance, dependencies and edge cases. **R3 (pending) and the phone pass
(pending) may add rows.**

## 0. Order of work

1. **Shared fixes to main now** (owner item PORT; HARVEST §A). These are small, testable and
   semantics-preserving:
   - `ea137306` capture discipline;
   - the paragraph cache;
   - the O(N) lookups;
   - `projectFrame` hoisting;
   - a shared `orreryInitials` fallback for Hermes;
   - the canvas memo.
2. **Owner decisions** (`OWNER-REVIEW.md`). The ⚠ items need superseding ADRs before any V2
   plan depends on them: TILT (Home camera), SKY (ADR-114/179), FLOW (HANDOFF §7 principle),
   CARD (ADR-149 in practice), GLASS (ADR-149 proof).
3. **Phone pass** (`research/PHONE-PASS-SCRIPT.md`, plus the gaps noted in PERFORMANCE §9).
4. **V2 renderer phase**, built on the HARVEST §B architecture.

## 1. Delete (lab-only scaffolding)

| Item | Where | Compromise |
|---|---|---|
| Panel, marker, deep links (`orbit://labb`), camera presets, quick switch, slow-mo | `labb/debug/LabFxPanel.tsx`, `OrreryScreen.tsx` (`LabBMarkerHost`), `use-orrery-switch-runtime.ts` `timeScale` | C-08, C-25, C-46 |
| FPS HUD | `labb/debug/LabFpsOverlay.tsx` | C-08, C-41 |
| Flag registry + store; `forceFallback` set during render | `src/stores/orrery-labb-fx-store.ts`, `LabBRenderer.tsx` | C-28 |
| Reduced-motion override | `src/theme/reduced-motion-override.ts`; revert `use-reduced-motion.ts` | C-21 |
| Perf probe calls in the model half | `OrreryWorld.tsx`, lab pictures | C-65 (keep the tool in a dev-only form if useful) |
| Lab renderer A/B switch and the legacy tree | `OrreryWorld.tsx` return | V2 decides one renderer |
| `ringsPathRebuild`, `layerPictures:0`, `nebulaLive`, `moonShader` and other A/B paths | various | — |
| R2 experiments (bloom, tilt-shift, shock filter; flare unless the owner keeps the streak) | `LabStage.tsx`, `LabSwitchFx.tsx`, `labb-effects.ts` | C-70 |
| Dev seeds (fixture + stress) and portrait `require`s | `src/__dev__/lab-b-seed.ts`, `App.tsx` | C-19, C-42. Move the portraits to a test-only fixture path; production must never `require` under `docs/`. |
| Package id, launcher name, widget label | `app.config.ts` | Revert to `com.bwales.orbit` / `APP_NAME` / "Orbit — Favourites" |
| Debug-key release signing for perf builds | build config | C-43 |

## 2. Re-architect cleanly (lab shortcuts that V2 must replace)

| Lab shortcut | V2 replacement | Compromise |
|---|---|---|
| `fxTap` side-stamp in `resolveTap` / `onNorth` | A clean feedback event channel from the gesture layer | C-20, C-54 |
| Focus-card rect handed to the canvas via a module-level SharedValue (`labb-card-channel.ts`) | A proper overlay-rect channel (screen → renderer) | C-61 |
| `ringPath` still in the frame (now skipped for the lab) | Remove `ringPath` from `projectFrame` once nothing reads it; the reorder ghost moves to the homography | C-45 |
| Visual reach = culling reach (1.3 r / 2 r) | A separate visual-reach field in `projectAnimatedFrame`, so the corona and particles can exceed the hit/label geometry without popping | C-10 |
| Sky yaw pivot = viewport centre | Export the projection centre from `orrery-camera-logic` (or carry it on the frame) | C-27 |
| Photo image shaders left to GC | A UI-side photo **texture atlas** (one `SkImage` for all faces), or a deferred dispose after a UI round-trip; measure texture memory on the phone | C-50 |
| Size floor and point LOD inside the bodies picture | A semantic "min drawn radius" in the projection, with label gaps aware of it | C-62, C-69 |
| Per-label saveLayer for paragraph alpha | Pre-rasterised label textures or a glyph path | C-09 |
| Lab tokens: numeric mixes plus LAB-ONLY sprite masks | Authored Orrery tokens per package × mode; keep masks as masks | C-03, C-26, C-32, C-40, C-44, C-53 |
| Home tilt applied by wrapping 3 call sites | If approved: a product `HOME_CAMERA.tilt` inside `deriveHomePose`, re-checking the Home fit under tilt (the near side can extend below the fold) | C-66 |
| Effects compile lazily but run on every replay even when culled (component path) | Moot with layer pictures; keep culled entities out of the picture | C-33 |
| `orrery-scene.test.ts` mocks `use-orrery-photo` | Keep, or lazy-load the bodies module | C-24 |

## 3. Tests

**Keep and port:**

- the pure-helper suites (`labb-*-logic.test.ts`, `labb-sky`, `labb-stage`,
  `labb-layer-plan`, `labb-frame-index`, `labb-clock-logic`, `orrery-focus-placement`);
- the uniform-contract test (every declared SkSL uniform is supplied and finite);
- the bit-identical projection test;
- the switch-signal agreement tests;
- the mocked-Skia render contract (layer order, no per-body `layer`, frame-radius draws,
  depth order, label alpha by level, null-effect fallbacks);
- the recursive worklet-order guard.

**Add:**

- **Capture-regression tests** for every per-frame worklet. Extend the frame-mapper pattern
  so that a new closure capture of an object graph fails CI. Without this, H-A1 can regress
  silently.
- **A Hermes-only trap lint/test.** No worklet default parameter may reference a module
  constant. No `null` local matrix in Skia factory calls.
- **A device screenshot regression suite** for shader output (C-18; vitest cannot see
  pixels). Seeded fixtures, the 4 themes, overview/identity/detail, focus and mid-switch
  frames.
- **A legibility regression.** Run `tools/r1-contrast.py`-style checks in CI on captured
  frames (ADR-149 method).

**Retarget:**

- `orrery-render.test.tsx` assertions on per-body `layer` / Paint-alpha describe the legacy
  saveLayer design. Retire them together with the legacy renderer; don't delete them while
  it exists.
- The accent-contract allowlist rows for any `color={colors.accent}` that moves.

## 4. Accessibility

1. **Overlay contrast (GLASS).** Re-prove ADR-149 AA over the new sky in all 4 themes, after
   R2/R3 and on a phone. Standard Dark was 4.45:1 (model) at R1, and the R2 pool and rim
   light were never re-measured. Fix it canvas-side (occlude or dim under overlays), not with
   overlay opacity.
2. **Ring contrast.** Hairlines (C-35), density fade (C-36) and rim light (C-68) lower outer
   and dense-ring contrast. Run a per-theme contrast check, and consider per-status alpha
   floors.
3. **Status redundancy.** Keep the ring weight order (the CVD channel). Consider a
   per-status micro-glyph on the rim at overview (M1-CRITIQUE): wobble and rogue are close in
   hue at small sizes.
4. **Faces.** Light floor (C-30), rogue desaturation (C-16) and focus dimming (C-52) need a
   phone glance with dark-skinned portraits at overview size.
5. **Reduced motion.**
   - Keep the static-but-complete scene and the idle clock.
   - The 250 ms moon level fade-in was never built (C-34). If V2 adds it, it must respect
     reduced motion.
   - The north flare has never been captured on device.
6. **Touch targets.** HUD chrome restyles geometry only (sizes unchanged, C-56). Re-check
   tracked caps against font scale.
7. **Large font scale.** Focus-card anchoring caps height and scrolls (C-57). Test at maximum
   fontScale, where a side-docked target panel may be better.
8. **Initials.** Ship a Hermes-safe initials function (H-A5). The lab's code-point version
   can split combining marks and ZWJ sequences (C-23).

## 5. Performance work before shipping

- **The phone pass.** Absolute frame times at 120/400/800 and Perfetto on main, RenderThread
  and JS. Answer five questions:
  - Mali fill for the nebula sample, the R2 stage plane and the sun;
  - opaque vs TextureView;
  - thermal and battery after 10 minutes;
  - texture memory;
  - whether the 800-body crash stays fixed on ARM.
- **If fill-bound on Mali:**
  - render the stage plane into the nebula pass (one full-screen pass, not two);
  - lower the bake to 512² (C-13);
  - drop the gravity-well grid.
- **If ambient redraw costs too much battery:**
  - drop ring flow (owner FLOW);
  - consider frame-skipping the ambient clock (for example 30 Hz drift and twinkle) while
    the camera is idle (C-06).
- **Switch p99 hot spots:**
  - the trim picture (one Paint + `MakeSweepGradient` per ring per frame, 15–24 ms);
  - particles and comets (per-frame loops + Atlas buffer conversion).

  Candidates: a shared trim shader with per-ring uniforms, and typed-array particle buffers.
- **Bodies at scale:** a photo texture atlas, so there is one image shader instead of one per
  body.
- **Projection at scale:** typed arrays / a fused pass, only if the phone shows it.
- **Upstream candidates (RN Skia):**
  - drop the redundant second `redraw()` in `SkiaSGRoot.render`;
  - skip record-time `.value` reads of animated props.

## 6. Dependencies

No new npm dependencies. The work relies on RN Skia 2.6.2 behaviour:

- the whole-canvas replay per SharedValue change;
- uniforms resolved by name;
- the double redraw per commit;
- the Ganesh backend.

**Re-validate all perf rules on any RN Skia / Reanimated upgrade.** Graphite would change the
shader-compile and fill characteristics.

## 7. Edge cases to test in V2

- A switch retarget A→B→C mid-flight.
- Remount mid-switch (tab away, app background).
- Reduced motion toggled live during a switch and during a focus fly-in.
- Theme change while the Orrery is mounted: there must be no rebake, and the sky hue must
  stay correct.
- System rename and re-key versus sky-hue stability (HUE).
- An empty System; a 1-member System; a contact-occupied sun with no photo.
- All Contacts at 940+.
- The far zoom preset while focused, a cluster tap and a Polaris tap (not covered on device).
- A photo decode failure (the procedural fallback must render).
- A runtime-effect compile failure on a real GPU (null fallback) **and** a miscompile that
  is not null (no detection today, C-11): consider a one-frame self-test render at mount.
- The opaque canvas with system dialogs, the keyboard, tab transitions, screenshots and
  screen recording.
- Release builds without the debug keystore (C-43).

## PLACEHOLDER — R3 / phone additions

> _TBD: any cleanup or test debt R3 introduces; any phone-pass finding that adds a
> must-fix._
