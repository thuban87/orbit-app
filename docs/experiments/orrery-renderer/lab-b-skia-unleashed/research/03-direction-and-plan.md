# Lab B research 03: visual direction, renderer architecture and build plan

Status: research and planning only. No source was modified. Date: 2026-10-01.
Branch: `experiment/orrery-skia-unleashed`, HEAD `9ca24ae8`.

**Inputs.** I read the experiment contract, research 01 (architecture) and research 02 (Skia
capabilities) in full. I then checked their load-bearing claims against the code on disk:

- `OrreryWorld.tsx`, `OrreryCanvas.tsx`, `OrbitBody.tsx`, `SunBody.tsx`,
  `ProjectedOrbitRing.tsx` and `OrreryLabel.tsx`
- `src/logic/orrery-frame.ts`, `src/logic/orrery-camera-logic.ts` (`projectFrame`),
  `src/logic/orrery-switch-choreography.ts` and `src/logic/orrery-ring-logic.ts`
- `src/theme/theme-types.ts`, `theme-presets.ts` and `theme-provider.tsx`
- `scripts/check-colors.sh`
- the tests `orrery-render.test.tsx`, `orrery-frame-mapper.test.ts`,
  `orrery-worklet-order.test.ts`, `src/services/orrery-scene.test.ts`,
  `accent-foreground-role-contract.test.ts` and `art-treatment-scope-contract.test.ts`
- the Lab B seed `src/__dev__/lab-b-seed.ts` and the lab marker in `OrreryScreen.tsx`

## 0. Corrections and additions to research 01/02 found while verifying

These change the plan. Executors must treat them as facts.

1. **The worklet-order guard does NOT see subfolders.** `orrery-worklet-order.test.ts`
   (around line 214) uses a non-recursive `readdirSync("src/components/orrery")`. A new
   `src/components/orrery/labb/` folder would be invisible to the Hermes forward-reference
   guard. Research 01 says new files are "scanned automatically", which is only true at the
   top level. **WP-1.0 must extend the scan to `labb/` (recursive) as its first test change.**
2. **The `orrery-scene.test.ts` mock trap.** That test mocks `@shopify/react-native-skia` as
   `{}` and imports `OrreryWorld` through the `createOrreryGestures` re-export. As a result:
   - Any module-scope `Skia.RuntimeEffect.Make(...)` reachable from `OrreryWorld.tsx` would
     throw at import (`Skia` is undefined) and break that real-SQLite tracer.
   - Effects must therefore be created **lazily**, through a memoised, `try`-guarded getter.
     This replaces the module-scope pattern suggested in research 02. "Compile once" still
     holds, because the getter caches.
3. **During a switch, `pose` is not the displayed camera.**
   - The `frame` worklet uses `sampleOrrerySwitchCamera(cameraFrom, cameraTo, progress)` while
     `progress < 1`. Any parallax or environment effect must read **`frame.value.pose`**,
     never `pose.value`. Otherwise the sky moves wrongly during every System switch.
4. **`frame` discards the choreography metadata.** The `frame` derived value keeps only
   `.world` from `sampleSwitchChoreography`. `phase`, `angularVelocity` and
   `accumulatedRotation` are thrown away, and `phaseAt` and `normalizedAngularVelocity` are
   not exported.
   - Do **not** add captures to the `frame` worklet. `orrery-frame-mapper.test.ts` resolves
     every compiled capture against a fixed `available` map and throws
     `Unhandled compiled capture` on any new one.
   - Instead, add a small exported pure helper, `sampleSwitchSignal(transition, progress)`, to
     the choreography module. It returns phase, angular velocity, progress and the reduced
     flag without building the world. The lab renderer reads it in its own derived value.
5. **The accent contract fails on stale entries.** `accent-foreground-role-contract.test.ts`
   allowlists `color={colors.accent}` in `OrreryWorld.tsx` (reorder ghost) and
   `SatelliteBody.tsx`. If the lab renderer moves the ghost out of `OrreryWorld.tsx`, those
   rows go stale and fail. The allowlist must be edited honestly, with a reason per row, and
   not loosened.
6. **Four theme variants are confirmed.** `THEME_PRESETS` has `galaxy` and `standard`, each
   with `dark` and `light`, plus the accent overlay.
   - Light backgrounds are `#EDF0F9` (galaxy light) and `#F2F3F6` (standard light).
   - `useTheme()` returns `{colors, mode, package}`, so the renderer can choose an effect
     profile per package × mode without any new plumbing.
7. **The seed is debug-only.** `seedLabBFixtureIfAbsent` returns early unless `__DEV__` and
   the `com.bwales.orbit.labb` applicationId. It creates about 140 contacts and the Systems
   "Lab B Dense" (about 120), "Lab B Inner Circle" (12) and "Lab B Work" (30), with photos on
   about 40% of contacts and satellites on 30 parents.
   - A release build, which is the only build a performance claim may come from, does not
     seed. Seed on a debug install first, then `install -r` the release APK over it.
   - Whether the release build is signed with the same key as the debug build, which
     `install -r` needs to keep the data, is **unverified**. Check it in WP-1.4.

---

## 1. Direction: "DEEP FIELD CARTOGRAPHY"

### 1.1 The idea in one paragraph

Opening the Orrery should feel like the moment a strategy game drops you into a star-system
map. You see a deep, softly lit volume of space with real depth. Physically lit worlds hang
in it, and a crisp, holographic layer of instruments is drawn over them.

The look rests on a **two-register visual language**:

- **The physical register** covers the environment, the sun, the contact bodies and the
  moons. It is painterly, volumetric and lit from the sun, with soft edges and no outlines.
- **The instrument register** covers orbits, focus brackets, labels, ticks, ripples and the
  reorder ghost. It is hairline, exact and drawn in status or accent hues.

The tension between the two registers is what makes premium space-strategy maps read as
premium. It also keeps Orbit legible:

- Every piece of *data* lives in the instrument register, or is unmistakable on the body
  (status hue, drift, ring treatment).
- Every piece of *atmosphere* lives in the physical register and never carries data.

Contacts remain the information architecture. Nothing becomes an orbital simulation, and
bodies stay on their rails.

### 1.2 Candidate techniques evaluated against this codebase

Cost classes are from research 02 (C0 negligible to C4 budget-breaking). "Fit" means fit
with the existing data flow and invariants.

| # | Technique | Codebase fit | Cost | Verdict |
|---|---|---|---|---|
| T-A | Baked nebula texture, sampled by a cheap warp shader that pans by `frame.value.pose`. fbm runs once into a low-res texture at mount and on theme change; per frame there is 1–2 texture fetches plus a tiny noise offset. | Excellent. Theme tokens become uniforms; it is static under reduced motion. | C1–C2 | **Adopt (M1).** Full-res live fbm is rejected as the default and kept as a panel toggle for an A/B cost measurement. |
| T-B | Three-depth Atlas starfield. RSXform and colour buffers parallax with pan, zoom and yaw from `frame.value.pose`. A rect buffer picks dot or streak sprite cells for warp. | Excellent. It replaces 44 `Circle` commands with one draw. | C1 | **Adopt (M1).** It also carries the switch warp in M2. |
| T-C | Lit photo-body shader. The photo, or a baked swatch-plus-initials texture, is a child `ImageShader`. It adds a Lambert terminator from the sun direction, a Fresnel rim in the status hue and an alpha uniform. | Good. Bodies keep their keyed per-resource components (photo hook rule), and the per-body `saveLayer` plus per-frame `Skia.Paint()` allocation goes away. | C1 | **Adopt (M1).** This is the core of "worlds, not avatars". |
| T-D | Atmosphere and status halo: a radial-gradient circle at ≤1.3 r in the status hue, `plus` blend in dark and a `multiply`/shadow variant in light. | Good. Kept inside the culling reach of `projectAnimatedFrame` (×1.3 for contacts, ×2 for the sun). | C0–C1 | **Adopt (M1).** |
| T-E | Ring treatment: a stroke with a screen-space vertical `LinearGradient` for depth fade (near side bright, far side dim, scaled by `sin(tilt)`); an animated `DashPathEffect` phase for energy flow; and a trimmed progress-wake arc using `start`/`end`. | Good. It uses the existing `ringPath`, and ring `i=0` is north, which matches the angle convention. | C1 | **Adopt (M1).** Flow is a recorded compromise (§5, C-04). |
| T-F | Stateless Atlas particle system: position = f(seed, switch progress), fixed capacity 512, `plus` blend. | Excellent for switching. Stateless means pause, remount, resume and retarget are all correct by construction. | C1 | **Adopt (M2).** |
| T-G | Projected-ellipse shockwaves and ripples: rings on the world plane, drawn as `ringPath`-like projected circles. | Good. They reuse projection math, so they sit correctly in tilt. | C1 | **Adopt (M2).** |
| T-H | Shockwave displacement `RuntimeShader` image filter over the world layer, transition only. | Fair. It puts Paragraph labels inside a filtered layer unless they are kept outside, and it needs a warm-up. | C2–C3, transient | **Toggle experiment (R2).** Only an Atlas/ellipse shockwave ships in M2. |
| T-I | Single-pass emissive bloom (blurred `plus` layer of the emissive group). | Fair. It is the classic Android perf cliff. | C2–C3 | **Toggle experiment (R2), with a verdict.** |
| T-J | Depth of field and lens flare. | Poor. DoF blurs faces, and flare is a taste risk. | C2–C3 / C1 | **DoF rejected.** Lens flare is an R2 toggle only, recorded in DEAD-ENDS if it fails. |

### 1.3 The look, layer by layer (back to front)

**L0 — Deep environment.**

*Nebula.* A two-lobe, domain-warped nebula is baked once at about ¼ viewport resolution. The
renderer then samples it through a cheap shader:

- **Colours** come from tokens, never literals:
  - lobe A mixes `background` toward `accent`;
  - lobe B mixes `background` toward a `starPalette` hue (`starPalette[3]` violet or `[4]`
    cyan, chosen per System; see M2);
  - the dust lanes are `background` darkened by a lab scalar.
- **Parallax** comes from `frame.value.pose`:
  - pan moves the nebula at 0.06× the world's screen motion;
  - zoom scales it by `1 + 0.08·log(zoom)`, so zooming feels like pushing *into* the cloud;
  - yaw rotates the sky about the sun's screen centre (`frame.value.center`), so rotating the
    system rotates the heavens, as a world-anchored sky should.
- **Ambient life:** a 0.5–1 px/s UV drift and a 40 s breathing of the warp amount. Under
  reduced motion both are frozen; parallax still follows the user's gestures.
- **Vignette:** a radial darkening toward the corners keeps the overlays' glass readable and
  pulls the eye to the sun.

*Starfield.* Three depth layers are drawn as **one Atlas**:

| Layer | Stars | Parallax | Twinkle |
|---|---|---|---|
| Far | 380 tiny points | 0.03 | None |
| Mid | 160 | 0.10 | Slow, ±15% per-star colour-buffer alpha, phase-hashed |
| Near | 40 soft sprites | 0.22 | Sparse |

- Star tones come from `textSecondary`, `textPrimary` and `starPalette`, as they do today.
- Near stars scale slightly with zoom, which gives a fly-in feel.
- Tilt shifts the layers vertically by depth, so tilting the plane parallaxes the sky.

**L1 — Orbits (instrument register).**

*Rings.*

- Hairline rings (1–1.5 px; the width still comes from `ringVisual`) in the status hue, with
  the status *stroke style* preserved: solid, dashed, faded, faint trace.
- **Depth fade:** a vertical gradient across the ring's screen bounds. At tilt 0 it is
  uniform; at full tilt the far side drops to 35%. This is the single cheapest "3D" cue
  available.
- **Energy flow:** 2–3 short bright comet dashes travel clockwise along every ring at the
  **same speed for every status**. The flow is a texture of the instrument and never encodes
  status (see C-04).
  - Under a running switch, flow speed is multiplied by the normalised angular velocity, so
    rings visibly "spool up" with the spin.
  - Reduced motion: no flow (phase constant).
- **Progress wake:** a faint gradient arc from north (angle 0) to the body's angle, brightest
  at the body.
  - This *literally draws interval progress*, which angle already encodes (ADR-011
    convention), as a fading comet tail.
  - It is static except with the camera. Never-contacted bodies get no wake.
- **Drift tether:** for decay and rogue bodies, which `orrery-world-logic` pushes off the
  rail, a thin dashed radial line in the status hue runs from the rail point to the body.
  "Out of orbit" becomes measurable, not just visible.

*Focus.* When a body is focused:

- its ring goes to full opacity, plus a soft glow stroke beneath it;
- every other ring fades to about 35%;
- the focused ring gets north tick marks (instrument detail).

**L2 — The sun.**

*Self sun.*

- A limb-darkened disc with slow granulation: 2-octave noise, evaluated only inside the
  disc's pixels.
- A ray-structured corona shader out to 2 r in `glowColor` (`starPalette[n]` / `selfSunColour`),
  with angular-noise rays rotating very slowly. Reduced motion: static rays.
- The existing ~3.1 s pulse is kept as a ±6% breathing of the corona intensity.

*Contact sun.* The photo disc is drawn **unlit** (emissive, so the face is never darkened),
ringed by a bright rim and the corona in its status colour, which keeps the existing
`resolveSunOccupant` colour semantics.

*Lighting role.* The sun is the light source for every other body (L3).

**L3 — Contact bodies (physical register).**

- **Surface.** It is the photo, or for photo-less contacts a baked swatch-plus-initials
  texture, so both paths run through one shader pipeline. The shader applies:
  - Lambert lighting from the direction body → sun (the screen-space vector to
    `frame.value.center`), with a **floor of 0.55** in dark themes and 0.75 in light themes,
    so faces always stay recognisable;
  - a terminator softened by a wrap term;
  - a Fresnel rim in the status hue on the lit limb;
  - a 2 px crisp status inner rim, which replaces today's 3 px `bodyFill` outline so the
    status hue stays glanceable.
- **Atmosphere.** A gradient halo out to ≤1.3 r in the status hue:

  | Status | Atmosphere | Surface |
  |---|---|---|
  | stable | Full and clear | Normal |
  | wobble | Full | Normal |
  | decay | Thin and dim | Desaturated 25% |
  | rogue | None; the rim is cold `rogueExtinguished`, so the body reads extinguished | Desaturated 45% (face kept legible) |
  | never-contacted | None; a neutral `border` rim | Matte |

  This is all **static**: there is no per-status animation (HANDOFF §7 [REJECTED]
  differentiated per-band animation).
- **Gravity.** It is unchanged at ±10% mass. Atmosphere thickness scales with the drawn
  radius, so Gravity reads exactly as strongly as it does today. It is not amplified (ADR-106).
- **Depth cue.** Bodies on the far side of a tilted plane get a slight haze toward the nebula
  colour (up to 15%), driven by the normalised `depth` from `projectFrame`.
- **Focus dimming.** When something is focused, non-focused bodies dim to about 60%
  luminance and desaturate 30% through the `uDim` uniform, which is animated by `focusMix`.
- **Hard rule.** The disc is drawn at exactly `frame.bodies[i].radius`. Hit radius, label
  anchors and focus cards are unchanged.

**L4 — Satellites (moons).**

- Tiny lit spheres (no photo) whose tone is derived from `textSecondary`, with a lit limb
  from the sun direction and a single specular glint.
- **No orbit traces:** ADR-105 says satellites have no rings.
- When the semantic level crosses into `identity`, moons fade and scale in over 250 ms via
  `withTiming`. That is user-driven motion, not ambient; under reduced motion they appear
  instantly.

**L5 — Polaris.** A distant bright star with 4-point diffraction spikes (a sprite in the
same Atlas texture) and a faint accent compass tick on the world rim. It stays in the same
world position and keeps the same `hitPolaris` semantics. A north reset fires a short flare
(M2 feedback).

**L6 — Labels (instrument register, semantic zoom).**

- **Allocation and tap semantics are untouched:** `allocations` still feeds `resolveTap`, and
  the same plate width and height are measured by `prepareOrreryText`.
- The reskin turns the plate into a HUD tag:
  - a `surface` plate at its current opacity;
  - a 1 px top hairline in the body's status hue;
  - a 6 px leader tick from the plate toward the body.
- Context captions at `detail` stay as they are, in caption style.

| Level | What is visible |
|---|---|
| overview | No names (unchanged); environment at full drama; simplified atmospheres |
| identity | Names, full lighting and moons |
| detail | Context captions, ring north ticks, the focused ring's tick scale and moon glints |

**L7 — Focus and feedback overlays (instrument register).**

*Focus.*

- Four accent corner-bracket arcs "lock on" around the focused body: they scale from 1.6× to
  1× with a 220 ms ease-out, then stay **static** (no continuous spin).
- The environment vignette deepens by 10%.
- **Cluster focus:** brackets on each member plus a thin accent hull circle around the group.
- **Satellite focus:** small brackets.

*Feedback.*

- A tap on empty space sends a faint accent ripple across the world plane: a projected
  ellipse at the unprojected tap point, 450 ms.
- A tap on a body sends a sonar ping from the body edge.
- A reorder hold makes the held ring glow accent. The candidate slot ring flashes once on
  each slot change, which is event-driven and not ambient. The existing haptic is kept.

**System switching — the showcase.** The existing choreography stays the single source of
geometry. Effects are pure functions of `(sampleSwitchSignal, per-entry role/stagger, body
pose)`, so pause, remount, resume and retarget stay byte-consistent.

| Phase (progress) | Existing geometry | Added visual |
|---|---|---|
| **accelerate** 0–0.20 | Spin ramps up | Stars stretch into radial **hyperspace streaks** about the sun's screen centre. The streak length ∝ normalised angular velocity × layer depth, via rect-buffer cell selection and RSXform rotation. The nebula pushes inward with an extra +12% zoom (environment only). The corona flares +40%. Ring flow spools up. Retained bodies grow a short tangential motion-smear arc ∝ angularVelocity × ring radius. |
| **shed** 0.18–0.58 | Leaving bodies peel out, shrink to 75% and fade | Leaving bodies **dissolve into particles**. A noise-threshold dissolve runs in the body shader (`uDissolve = 1 − opacity`), and 24 particles per leaving body are emitted along the outward vector in its status hue. Their rings **unwind**: `end` trims from 1 → 0 across the body's own shed window. |
| **capture** 0.44–0.82 | Entering bodies spiral in from displacement and grow | Each entering body is preceded by a **comet streak**, a tapered line from its current position back along its inbound radial, with length ∝ remaining displacement. Its ring **draws on** (`end` 0 → 1). On reaching its rail it fires a **capture flare**: a brief bright rim plus a projected-ellipse shockwave expanding along its own ring radius. |
| **settle** 0.72–1 | Spin decelerates; Home pose | Streaks relax back to points. One soft **system-lock shockwave** expands from the sun across the plane. The nebula tint **crossfades to the destination System's sky hue**, a deterministic hash of the System identity into `starPalette` (C-05). The corona settles. |
| **retarget** | The choreography rebases on the displayed sample | Effects follow automatically, because they read the live sample. Particles key on `(transition.generation, entry key)`, so a new generation restarts its emitters cleanly. |
| **Reduced Motion** | 180 ms crossfade and reposition | No streaks, particles, flares or shockwaves. Bodies and rings crossfade, and the nebula tint crossfades in the same 180 ms. Static but complete. |

Intensity scaling is kept: a low-turnover switch (low `intensity`) produces fewer particles,
shorter streaks and no system-lock shockwave below intensity 0.25.

**Reduced motion overall.** The scene must be static but still beautiful:

- The nebula is frozen in its best composition, and the stars do not twinkle.
- Bodies are fully lit and atmospheres stay.
- There is no flow, corona motion or ripple animation; feedback becomes a ≤150 ms opacity
  highlight.
- Camera recovery keeps its existing 100 ms linear path.
- Parallax still follows the user's own gestures.
- R2 experiment: unmount the ambient clock subtree entirely while the React
  `useReducedMotion()` boolean is true, so the static scene stops replaying every frame.
  Today the clock runs regardless.

**Light themes.** They get the same structure under different physics:

- additive `plus` glows become `multiply`/soft-shadow treatments;
- the nebula becomes low-contrast watercolour vellum tints (token mixes toward `background`,
  multiply blend at ≤12% strength);
- stars become sparse ink specks in `textSecondary` at 25–40% alpha with no glow;
- bodies get a soft contact shadow toward the anti-sun side instead of a glowing atmosphere,
  plus a thin status rim;
- the corona becomes a warm gradient wash.

Standard Light runs at the lowest intensity profile (about 0.5× of Galaxy Light's effect
scalars). Galaxy Dark is the hero.

---

## 2. Renderer architecture

### 2.1 Seam

This follows research 01 §10, with the corrections in §0.

`OrreryWorld.tsx` keeps its whole model half verbatim:

- the `frame` worklet, its captures and the `camera.frame` publication;
- `level`, `labels`/`measured`/`allocations`, `identities` and `reorderExpectation`;
- the gesture and both focus-lost reactions.

Only its **return statement** changes, into a switch between two renderers:

```tsx
return labFx.renderer === "legacy"
  ? <LegacyOrreryTree … />          // today's JSX, moved verbatim into a local function
  : <LabBRenderer contract={…} />;
```

Keeping the legacy tree mounted-switchable gives a same-build, same-data A/B baseline for
both visuals and performance. It also keeps today's renderer tests meaningful (§2.7). Only
one canvas, and therefore one `useClock`, is ever mounted.

There is one small model-half addition. `resolveTap` (defined in `OrreryWorld.tsx`) writes
`fxTap.value = {x, y, seq: seq + 1, kind}` before returning the existing intent, so the
feedback layer can draw a ripple. The semantics are unchanged.

### 2.2 Module layout

New files live under `src/components/orrery/labb/` unless noted:

| File | Role |
|---|---|
| `LabBRenderer.tsx` | Composes the layers in fixed order. It takes the render contract and owns the per-renderer derived values (`frameIndex`, `switchSignal`, `switchRoles`, `focusMix`, `fxFlags`). |
| `LabCanvas.tsx` | Replaces `OrreryCanvas` for the lab path: `GestureDetector` > `Canvas` (an `opaque` experiment behind a flag). It is the **only** `useClock` in the lab path and provides it through the existing `OrreryClockContext`. It hosts the warm-up group. |
| `labb-effects.ts` | All SkSL sources as string constants, plus `getLabEffect(name): SkRuntimeEffect \| null`. The getter is lazy and memoised in a module-level `Map`, wraps `Skia?.RuntimeEffect?.Make?.(src)` in `try`, logs once in `__DEV__` on null, and never runs at import. `WARMUP_EFFECTS` lists the transition-only effects. |
| `labb-uniforms.ts` | JS-side token → `[r,g,b]` conversion via `Skia.Color(token)`, memoised per palette. It also mixes helpers (`mixToken(a, b, t)`) for derived lab colours, which are numeric mixes of tokens and never literals. |
| `labb-frame-index.ts` | Worklet helpers: `indexFrame(frame) → Record<key, index>`, `bodyAt(frame, index, key)`, `ringClassOf`, `sunScreenCenter` and `normDepth`. Helpers are declared **above** their callers. |
| `LabEnvironment.tsx` | Nebula (baked texture + warp shader) and the Atlas starfield, with parallax and warp. |
| `LabRings.tsx` | Keyed `LabRing` per contact resource: depth gradient, flow dash, progress wake, drift tether and switch trims. |
| `LabBody.tsx` | Keyed per resource. It calls `useOrreryPhoto` unconditionally, builds the swatch-plus-initials texture (`useTexture`, UI-thread-owned), and draws the lit-surface shader circle, atmosphere and dissolve. It replaces `OrbitBody`'s layer pattern. |
| `LabSun.tsx` | The sun surface, corona shader and photo-sun variant. |
| `LabMoons.tsx` | Batched moons: one Atlas when there are many, otherwise keyed circles with the moon shader. |
| `LabPolaris.tsx` | Polaris sprite and compass tick. |
| `LabLabels.tsx` | HUD-tag reskin over the existing `allocations` and prepared paragraphs. Plate geometry is identical. |
| `LabFocusFx.tsx` | Brackets, cluster hull and reorder glow. |
| `LabSwitchFx.tsx` | Particle Atlas, comets, capture flares and shockwaves. |
| `LabFeedbackFx.tsx` | Tap ripples and pings, plus the north flare. |
| `debug/LabFpsOverlay.tsx` | The frame-time HUD (§4). |
| `debug/LabFxPanel.tsx` | The effect toggle sheet (§4). |
| `src/stores/orrery-labb-fx-store.ts` | Zustand store of effect flags and intensities (React side), mirrored into one SharedValue for worklets. |
| `src/theme/orrery-lab-fx.ts` | **Lab tokens.** Per package × mode effect profiles: intensities, blend family (`additive` or `multiply`) and which palette tokens feed which lab role. It is under `/theme/`, so any unavoidable new colour literal is legal there, labelled `LAB-ONLY`. Mixes of existing tokens are preferred. |
| `src/logic/orrery-switch-choreography.ts` (addition) | Export `sampleSwitchSignal(transition, progress)` and the per-entry local-window helper `entryWindow(entry, start, end, progress)`. Both are pure, `"worklet"`, and declared above their callers. |
| `src/__dev__/lab-b-seed.ts` (extension) | `seedLabBStress(count)` for the dense-scene generator (§4). |

### 2.3 What feeds which layer

| Shared value (owner) | Consumers |
|---|---|
| `clock` (`LabCanvas`, the single `useClock`) | Nebula drift, star twinkle, ring flow phase, sun granulation, corona and pulse, ripple age, bracket lock-on timing, FPS stats. **Never** the switch effects. |
| `frame` (`OrreryWorld`, unchanged) | Everything world-space. **`frame.value.pose` drives environment parallax**; `frame.value.center` drives the sun light direction. |
| `frameIndex` = `useDerivedValue(() => indexFrame(frame.value))` | Every keyed body, ring and label consumer reads `frame.value.bodies[frameIndex.value[key]]`. This removes today's O(N²) `find` per consumer. |
| `allocations`, `level` (`OrreryWorld`) | Labels, moon fade-in and level-gated detail (ticks). |
| `switchSignal` = `useDerivedValue(() => sampleSwitchSignal(transition.value, progress.value))` | Warp, flow speed-up, corona flare, nebula push, sky-hue crossfade and system-lock shockwave. |
| `switchRoles` = `useDerivedValue(() => roleMap(transition.value))` | Recomputes only per publish. It maps key → `{role, stagger}` for dissolve, particles, comets, flares and ring trims. |
| `reducedMotion` (`useReducedMotionShared`) | Read **inside** every ambient worklet (ADR-085), as today. |
| `focusMix` (`withTiming` 0↔1 on a `focusedIds`/`focusedSatellite` change in a `useEffect`) | Body dimming, ring fade, brackets and vignette. Not per-frame React state. |
| `fxTap` (written in `resolveTap`) + `useAnimatedReaction` stamping `t0 = clock.value` | Ripples and pings. |
| `camera.reorder` | Reorder glow and slot flash. |
| `fxFlags` (store mirror) | Per-effect intensity multipliers. Heavy effects are also **unmounted** through React flags so a disabled effect truly costs nothing. |

### 2.4 Batching

- **One Atlas** for all stars, Polaris spikes and (M2) streak cells. A single atlas texture
  is built with `useTexture` holding dot, soft dot, spike and 3 streak lengths; colours come
  from the colour buffer, which is filled from token vec3s.
- **One Atlas** for particles. Capacity is fixed at 512 (buffer hooks re-create on a size
  change; research 02 pitfall 11). Unused slots get scale 0 or go off-screen. The Atlas is
  mounted only while `switchSignal.progress < 1` or a burst is live.
- **Bodies:** one keyed component per resource, which is required by the photo hook rule.
  Each draws about three primitives (atmosphere circle, lit-surface circle with
  `<Shader source={surface}>` holding a child `<ImageShader>`, and an optional inner rim):
  - no `layer`; alpha is a shader uniform;
  - depth sort keeps `zIndex` on the body `Group`, and the body run stays contiguous
    (research 01 §2 batch note).
- **Rings:** keyed per contact in M1 (per-ring opacity and trim are needed for switching). R1
  experiment: when settled and unfocused, merge rings by style class into ≤5 `Path`s built
  in one derived value, falling back to per-ring rendering while a switch or focus is
  active.
- **Picture:** used for the nebula bake (`drawAsPicture` → texture via `usePictureAsTexture`,
  UI-thread-owned) and in R1 for static instrument decorations (north ticks and compass),
  which re-record only when the frame changes.
- **Labels:** `OrreryLabel` keeps its per-label `layer`, because Paragraph alpha needs a real
  layer (`OrreryLabel.tsx:1`). This is recorded as C-09. Labels stay **outside** any filtered
  or effect layer.

### 2.5 Shader strategy

- **Lazy getters, not module-scope `Make`** (§0.2). Every component does
  `const fx = getLabEffect("surface")`. When the result is `null` it renders its plain
  fallback: today's equivalent primitive, such as a flat `Circle` and clipped `Image`. The
  null path is unit-tested by forcing the getter to return null.
- **Colour comes only from uniforms.** SkSL sources contain no colour constants: white
  highlights use a `uHighlight` uniform fed from `textPrimary` or a lab token. They contain
  no `#define`, which keeps `check-colors.sh`'s hex regex quiet and stays portable. Time is
  wrapped `% 1000 s`, and coordinates and hashes use `float`.
- **Warm-up at mount.** `LabCanvas` renders a 2×2 clipped `Group` at opacity 0.004 that draws
  every `WARMUP_EFFECTS` effect, plus one `Blur` if the bloom toggle exists, for the first
  ~10 frames. One React state flip, not per-frame, then unmounts it. This moves the GL
  program compile from the first switch to Orrery entry. Device evidence must check the
  first switch for a hitch.
- **Per-GPU risk.** Test both test phones (Pixel 6 Pro Mali and Pixel 3a Adreno) with the
  panel's "force fallback" toggle to compare.

### 2.6 Lifecycle

These rules are unchanged:

- `OrreryScreen.tsx:1048` still mounts `OrreryWorld` only when
  `visible && sessionReady && scene`.
- `LabCanvas` is inside that subtree, so blur, background and an invalid measurement unmount
  the clock, every derived ambient value, the Atlases and the textures.
- The switch runtime stays screen-owned. Because every switch effect is a pure function of
  `progress`/`transition` (no wall-clock state), a remount mid-switch resumes visually from
  the exact sample.
- There is no `useFrameCallback` anywhere; the FPS overlay derives from clock deltas (§4).
- Baked textures (nebula, atlas, initials) are owned by `useTexture`/`usePictureAsTexture`
  on the UI thread and rebuilt on palette change.
- Photo `SkImage`s keep `useOrreryPhoto`'s disposal discipline, because `LabBody` calls the
  hook exactly as `OrbitBody` does.

### 2.7 Worklet ordering and tests

**Worklet hazard.** Every lab worklet module declares its helpers first and its callers
after (memory: f979263). WP-1.0 changes `orrery-worklet-order.test.ts` to scan
`src/components/orrery/**` recursively, so the `labb/` and `labb/debug/` files are guarded.

**Test handling.** The rule is to retarget, not delete.

| Test | Action |
|---|---|
| `orrery-render.test.tsx` | **Keep it as-is against the legacy renderer.** The legacy tree is still shipped in the lab as the A/B baseline, so its order and batch assertions are still true. Set the store default to `legacy` inside that test. Add **`labb-render.test.tsx`**, which pins the lab contract with the same mocked-Skia technique (it needs `Shader`, `ImageShader`, `Atlas` and `Fill` added to the mock). It asserts:<br>(a) layer order: environment, rings, polaris, ghost, bodies (contiguous), moons, labels, fx;<br>(b) no body `Group` carries `layer`, which is the regression guard for the saveLayer removal;<br>(c) body `zIndex` follows depth (contact behind the sun, flipped at yaw π: the same scenario as today);<br>(d) label alpha is 0 at overview and 1 at zoom 2;<br>(e) every body draws at the frame radius;<br>(f) the null-effect fallback renders a body and a ring. |
| `orrery-frame-mapper.test.ts` | **Unchanged and must stay green.** The `frame` worklet is untouched. If a later WP genuinely needs a new capture, extend the test's `available` map in the same commit, with the reason in the commit message, and keep `names` not containing `camera`. |
| `orrery-worklet-order.test.ts` | Extend it to a recursive scan (above). |
| `src/services/orrery-scene.test.ts` | Must stay green **without new mocks**, which is guaranteed by the lazy effect getters and by no Skia calls at import. If an import-time Skia touch slips in, the right fix is to make it lazy, not to add a mock. |
| `src/screens/orrery-screen-framing.test.ts` | Unchanged: the `OrreryWorld` export name is kept. |
| `accent-foreground-role-contract.test.ts` | Add allowlist rows for each lab Skia accent use (brackets, ripples, reorder glow), with a `SKIA_FILL` reason. If an accent value only flows as a uniform array, no row is needed; do not add speculative rows, because stale rows fail. |
| `art-treatment-scope-contract.test.ts` | Lab files must not reference the art-treatment table. The nebula is procedural, not art. |
| `orrery-switch-choreography.test.ts` | Add tests for `sampleSwitchSignal` (phase boundaries, reduced-motion zero velocity, agreement with `sampleSwitchChoreography(...).phase/angularVelocity`) and `entryWindow`. |
| New pure-helper tests | `labb-frame-index` (index correctness, satellites keyed via `bodyKey`), the particle field function (deterministic, finite, zero alpha outside its window), `orrery-lab-fx` profiles (all four package × mode combinations resolve, and the intensity is lower for Standard Light). |

**Legitimately obsolete only if the legacy renderer is later deleted:** the
`orrery-render.test.tsx` assertions on `layer` being a SharedValue and on Paint-alpha
layering. Those describe the per-body saveLayer that the lab deliberately removes. Do not
delete them while the legacy path exists.

---

## 3. Staged build plan

**Plan sizing** follows CLAUDE.md. Each WP is one area, and one executor can complete it.
**Gates for every WP:**

1. `npx tsc --noEmit`
2. `npx vitest run src/components/orrery src/logic/orrery- src/services/orrery-scene.test.ts src/screens/orrery-screen-framing.test.ts src/theme/accent-foreground-role-contract.test.ts src/theme/art-treatment-scope-contract.test.ts`
3. `npm run check:colors`
4. `npx biome check` on the changed files

These come from the runbook §7 list plus the contracts. Before M1 closes and at final
validation, run the **full** `npx vitest run`: an orphaned test consumer has broken the tsc
gate before (memory).

**Executor constraints for every WP:**

- Run the contract's pre-modification checks (`pwd`, `git status`, branch, `git worktree list`).
- Never run `git worktree` commands and never push.
- Commit locally on `experiment/orrery-skia-unleashed`.

**Device loop** (`docs/runbooks/desktop-build-pipeline.md`):

- **Iterate on debug** using Metro (port per memory) and `emu-connect`, then
  `adb devices -l`. Check that exactly one device is listed. Never hardcode a device.
- The package is `com.bwales.orbit.labb`.
- **Every performance claim comes from a release APK on a physical phone.** Label the target,
  the thread measured, the scene size and the build type.
- Never make real AI calls during device runs.

### Milestone 1 — the first integrated, device-viable Deep Field

**WP-1.0 Scaffolding, parity port and instrumentation** (area: lab renderer shell and debug
tooling).

Files:

- `OrreryWorld.tsx`: the return switch, the legacy tree moved into a local function, and the
  `fxTap` write in `resolveTap`;
- `labb/LabBRenderer.tsx`, `labb/LabCanvas.tsx`, `labb/labb-effects.ts`,
  `labb/labb-uniforms.ts` and `labb/labb-frame-index.ts`;
- `labb/debug/LabFpsOverlay.tsx` and `labb/debug/LabFxPanel.tsx`;
- `src/stores/orrery-labb-fx-store.ts` and `src/theme/orrery-lab-fx.ts`;
- `OrreryScreen.tsx`: the lab marker becomes long-pressable and opens the panel;
- the test changes (recursive worklet-order scan, legacy default in the render test, the
  `labb-render.test.tsx` skeleton, and `labb-frame-index` tests).

Content: the lab renderer starts as a **parity port**. It draws today's visuals (Fill, stars,
rings, bodies, labels) through `frameIndex`, with no per-body `layer` and a cached Paint,
which gives a clean perf baseline against `legacy`.

Acceptance:

- the gates pass;
- the panel switches `legacy ↔ lab` live;
- the FPS overlay shows numbers;
- `orrery-scene.test.ts` is green with no new mocks.

Device evidence: on a release build with "Lab B Dense" (about 120), compare legacy against
the lab parity port, idle and during pan, using the FPS overlay and `dumpsys gfxinfo
com.bwales.orbit.labb framestats`. Take screenshots of both.

**WP-1.1 Environment** (area: L0).

Files: `labb/LabEnvironment.tsx`, the effects (`nebulaBake` and `nebulaSample`), the atlas
texture builder, `orrery-lab-fx.ts` profiles and its tests.

Content:

- the baked nebula with warp sampling;
- the three-layer Atlas starfield with parallax from `frame.value.pose` (pan, zoom, yaw,
  tilt);
- vignette;
- light-theme vellum and ink variants;
- reduced-motion freeze;
- a null fallback to `Fill` plus a plain Atlas.

Acceptance:

- the gates pass;
- a pure test that the parallax helper uses the frame pose and not `pose`;
- no colour literals outside `/theme/`.

Device evidence:

- screenshots in all 4 themes at Home;
- a recording of pan, pinch, rotate and tilt showing parallax;
- a recording of a System switch, where the sky must follow the *sampled* camera smoothly;
- a reduced-motion screenshot;
- release frame times with the environment on and off via the panel.

**WP-1.2 Worlds: bodies, sun, moons, Polaris** (area: L2–L5).

Files: `labb/LabBody.tsx`, `labb/LabSun.tsx`, `labb/LabMoons.tsx`, `labb/LabPolaris.tsx`,
the effects (`surface`, `corona`, `sunSurface` and `moon`) and additions to the
`labb-render` test.

Content:

- the lit-surface shader with the photo or a baked initials texture;
- status atmospheres and rims per the §1.3 L3 table;
- the far-side depth haze;
- the sun corona, granulation and photo-sun variant;
- lit moons with the level fade-in;
- the Polaris sprite;
- light-theme shadow variants;
- null fallbacks.

Acceptance:

- the gates pass;
- the render test proves no body `layer`, frame-radius drawing and depth `zIndex`;
- photo disposal still goes through `useOrreryPhoto`.

Device evidence:

- close-ups at identity and detail zoom of photo and initials bodies in each status, plus the
  self sun and a contact sun;
- all 4 themes;
- dense-scene frame times with bodies on and off;
- a face-legibility check of the darkest terminator (owner glance item).

**WP-1.3 Orbits and labels** (area: L1 and L6, the instrument register).

Files: `labb/LabRings.tsx`, `labb/LabLabels.tsx`, `labb/LabFocusFx.tsx` (static focus ring
emphasis only in M1) and tests.

Content:

- depth-gradient rings with status stroke styles kept;
- uniform energy flow;
- the progress wake;
- decay and rogue drift tethers;
- the HUD label reskin with identical geometry;
- semantic-zoom detail ticks;
- reduced-motion static flow.

Acceptance:

- the gates pass;
- a test that the plate width and height equal the prepared text measurements;
- a test that tap semantics still read `allocations` (the existing focus and label tests stay
  green);
- a wake-angle helper test: north = 0 and clockwise.

Device evidence:

- overview, identity and detail screenshots;
- a tilted view showing the depth fade;
- a dense System at overview (ring clutter check);
- label readability over the nebula in all 4 themes.

**WP-1.4 M1 device integration pass** (area: verification only; no new features, only small
fixes).

Run the whole M1 on the release Pixel 6 Pro, plus the Pixel 3a if it is available:

- overview, near/far zoom, focus, satellites, labels, gestures, dense 120, the Inner Circle
  (12) System and a switch (legacy switch FX for now);
- reduced motion toggled live;
- all 4 themes;
- background → foreground and tab away → back, confirming the clock stops (the frame
  overlay freezes and gfxinfo goes idle);
- reorder hold.

Record a 5-minute thermal and frame-time run. Commit the "M1" milestone. Start the
`docs/experiments/orrery-renderer/lab-b-skia-unleashed/` package (README, ARCHITECTURE and
DECISIONS stubs, with evidence paths).

### Milestone 2 — the System-switch showcase, focus and feedback

**WP-2.1 Switch signal and switch FX** (area: switching visuals).

Files:

- `src/logic/orrery-switch-choreography.ts` (`sampleSwitchSignal` and `entryWindow`) and its
  tests;
- `labb/LabSwitchFx.tsx`;
- warp support in `LabEnvironment.tsx`;
- trims in `LabRings.tsx` and the dissolve uniform in `LabBody.tsx`;
- `labb/labb-particles.ts` (a pure stateless field function) and its tests.

Content: the full phase map in §1.3:

- streaks, flare and flow spool-up;
- dissolve, particles and ring unwind;
- comets, ring draw-on and capture flares;
- system-lock shockwave and sky-hue crossfade;
- intensity scaling;
- the reduced-motion crossfade.

Acceptance:

- the gates pass;
- `orrery-switch-runtime.test.ts` and `orrery-frame-mapper.test.ts` are unchanged and green;
- particle and signal tests prove determinism and that they are pure in `progress`;
- the warm-up list includes every switch-only effect.

Device evidence:

- release-build recordings of a high-intensity switch (Dense → Inner Circle), a
  low-intensity switch (Work → a mostly overlapping System) and a rapid A→B→C retarget;
- a mid-switch background/foreground resume;
- reduced motion;
- first-switch-after-entry hitch check (frame times of the first 500 ms);
- frame times during the switch at dense 120.

**WP-2.2 Focus and feedback** (area: L7).

Files: `labb/LabFocusFx.tsx`, `labb/LabFeedbackFx.tsx`, `focusMix` and `fxTap` wiring in
`LabBRenderer.tsx`, the accent-contract allowlist rows, and tests.

Content:

- lock-on brackets;
- body dimming and ring fade;
- the cluster hull;
- satellite brackets;
- tap ripples and pings;
- reorder glow and slot flash;
- the north flare;
- reduced-motion static highlights.

Acceptance:

- the gates pass;
- focus, cluster and satellite overlays are still positioned by `camera.frame`;
- no React state changes per frame. Grep-check that `focusMix` only changes in a `useEffect`
  keyed on focus identity.

Device evidence:

- focus a distant contact (lock-on, then zoom to identity);
- tap a named body (opens Profile, so tap semantics are intact);
- an ambiguous tap (cluster);
- a satellite tap;
- a reorder hold and drag;
- a north tap;
- all recorded.

**WP-2.3 M2 device pass.** Repeat the WP-1.4 matrix plus all the switch scenarios, then
commit the "M2" milestone.

### Refinement pass R1 — performance and legibility (data-driven)

Use the panel to measure **each effect's marginal cost** on a release build. Do this on both
phones at dense 120 and at the stress size of 400 (§4), idle, panning and switching. Record
the results in PERFORMANCE.md, labelled UI thread versus RenderThread.

Then evaluate and act on these:

- The nebula bake resolution: is ⅛ indistinguishable from ¼?
- Is live fbm worth keeping as an option?
- Batch rings by class when settled. Measure before and after.
- Try the `opaque` Canvas (SurfaceView). Verify that the RN overlays, the glass, the focus
  card and screenshots still composite. Keep it or reject it into DEAD-ENDS.
- Mount the ambient clock only when it is needed (reduced motion, or all ambient effects
  off).
- Check label and overlay contrast over the brightest nebula and star pixels. Sample
  screenshots and compute contrast for the ADR-149 overlay treatment and the label plates.
  Report numbers; do not retune owner hues.
- Check face legibility under the terminator.
- Assess ring clutter at overview in dense Systems.
- Run a thermal check (10 minutes).

**Output:** tuned constants (all at the top of their files), and HARVEST/DEAD-ENDS entries
with evidence.

### Refinement pass R2 — art direction and hero moments

Review the full experience against the visual target: "entering a polished game's
star-system map".

- Composition at Home per theme, with Standard Light as the low-intensity variant.
- Colour harmony of the sky hue per System.
- Switch timing against the existing 2100 ms. **Do not change the choreography constants.**
  Effects may be retimed within the phases.
- The focus lock-on feel.
- The reduced-motion still frame.
- Run the toggle-only experiments (bloom pass, displacement shockwave filter, lens flare) and
  give each a verdict.
- Write the complete research package required by the contract (README through
  RECOMMENDATIONS), with screenshots and recordings referenced from HARVEST.

---

## 4. Debug instrumentation (built in WP-1.0)

**Frame-time HUD (`LabFpsOverlay`).**

- It is derived from the single clock with no extra loop. A `useDerivedValue` over
  `clock.value` keeps a fixed 120-slot ring buffer of frame deltas in a SharedValue-held
  array, mutated in place and followed by reassignment to notify.
- It reports the mean FPS, p50/p95/max frame time and a count of frames over 16.7 ms and
  over 33 ms.
- **Text:** an Animated `TextInput` whose `text` prop is set through `useAnimatedProps`. This
  is the standard Reanimated HUD pattern and is not React state.
- **Graph:** a Skia sparkline `Path` of the last 120 deltas in a corner of the canvas.
- **Label it honestly** as "UI-thread frame cadence (clock deltas)". It cannot see GPU or
  RenderThread time, so pair it with `adb shell dumpsys gfxinfo com.bwales.orbit.labb
  framestats`.
- It is mounted only when the panel flag is on, and it lives inside the canvas subtree, so
  it unmounts with everything else.

**Effect toggle panel (`LabFxPanel`).**

- **Open it** with a long press on the existing "ORRERY LAB B — SKIA UNLEASHED" marker. That
  makes the marker pressable, outside the canvas, so there is no gesture conflict with the
  Orrery.
- **What it controls:**
  - the renderer: `legacy` / `lab`;
  - per-layer switches: nebula, live fbm, stars, twinkle, parallax, ring flow, wake, tethers,
    atmospheres, lighting, corona, moons shader, label reskin, focus FX, feedback FX, switch
    FX (each of streaks, particles, flares, shockwaves, sky hue), and the R2 experiments
    (bloom, displacement filter, lens flare, opaque canvas);
  - the global intensity slider;
  - "force effect fallback" (all getters return null);
  - FPS HUD on/off;
  - "freeze clock" (diagnostic);
  - "replay last switch" (re-publishes the previous System through the normal store path, so
    a switch can be repeated for recording).
- **State:** a Zustand store, session-only and not persisted, mirrored into one `fxFlags`
  SharedValue for worklets.
- **Heavy layers are unmounted** when off, so the measured marginal cost is real.
- **Gating:** the applicationId (`com.bwales.orbit.labb`), **not** `__DEV__`, so A/B
  profiling works on release builds (C-08).

**Dense-scene generator.**

- `seedLabBStress(count = 400)` extends `lab-b-seed.ts`. It creates `count` extra synthetic
  contacts through the same DAOs, plus a "Lab B Stress" custom System and moons on 60
  parents.
- It is idempotent by System name and triggered from a panel button. It is `__DEV__` and
  applicationId gated, like the seed, so seed on debug and then install release over it.
- This exercises real read, scene, world and label paths. A render-only body multiplier is
  deliberately **not** used, because its fake bodies would be untappable and would mislead
  label and hit costs.
- Optional panel toggle: "synthetic photos everywhere", which forces the initials-texture
  path for every body to compare photo against texture cost.

---

## 5. Anticipated production compromises (each to be recorded in DECISIONS/PRODUCTIONIZATION)

| ID | Compromise | Why it is acceptable in the lab | What production would need |
|---|---|---|---|
| C-01 | Departs from **ADR-114/179**: the Orrery route draws a procedural nebula and a dense starfield instead of a solid, art-free background. | Explicit lab stance. | An owner decision and a superseding ADR. |
| C-02 | **ADR-149 contrast proof invalidated.** The `orrery-overlay` glass treatment was proven against "the brightest raw Orrery star", and the nebula, near stars, corona and glows are brighter. | Explicit lab stance; R1 measures it. | Re-prove AA or retune the overlay opacity; owner bucket. |
| C-03 | **Derived and lab colours.** Nebula and atmosphere colours are numeric mixes of existing tokens, plus any `LAB-ONLY` entries in `src/theme/orrery-lab-fx.ts`, none of which the owner has approved. | Theme discipline is kept (no literals outside `/theme/`). | Authored tokens per palette. |
| C-04 | **Ambient ring energy flow** is "mood" motion on the rails. HANDOFF §7 rejected *differentiated per-band animation*, and the lab flow is uniform across statuses and off under reduced motion, but it is still new ambient motion. | Toggleable; it never encodes status. | An owner call on whether it is allowed at all. |
| C-05 | **Per-System sky hue.** A visual identity for Systems hashed from System identity is new product meaning. | A taste experiment. | An owner product decision. Hash stability across a System rename/re-key is to be decided. |
| C-06 | **Heavier continuous redraw.** The clock already forces a replay every frame; the lab adds full-screen shader work every frame, which costs battery and heat. | Measured in R1. | A clock-only-when-needed mount and frame-skipping for idle scenes. |
| C-07 | **`opaque` Canvas (SurfaceView)**, if it is adopted. | A possible free performance win. | Overlay, screenshot and transition-capture verification on more devices. |
| C-08 | The **lab debug panel and FPS HUD ship in lab release builds** (applicationId-gated, not `__DEV__`). | Needed for honest release profiling. | Removal, or a `__DEV__` gate. |
| C-09 | **Labels keep a per-label `saveLayer`** (Paragraph alpha quirk). | Bounded by allocated labels. | Pre-rasterised label textures or a glyph-based path. |
| C-10 | **Visual reach beyond the culling halo.** The corona and particles can exceed the ×2 / ×1.3 reach used by `visible`, which can pop at the screen edges. | Cosmetic. | A separate visual-reach field in `projectAnimatedFrame` that leaves hit and label geometry alone. |
| C-11 | **GPU and driver coverage.** Shaders are verified only on the two test phones. The null fallbacks exist, but a *miscompile* that is not null cannot be caught. | Lab scope. | A device matrix and a runtime self-test render. |
| C-12 | **Shader-compile warm-up** draws hidden effects at Orrery entry, a small entry cost. | It avoids a mid-switch hitch. | Measure the entry time budget. |
| C-13 | **Baked textures in memory** (nebula about ¼ viewport, star atlas, about 64–128 px initials per body) on top of the 512 px photo cap. | Small (a few MB). | Budget them under the high-count rules. |
| C-14 | **Focus dimming** lowers the contrast of non-focused bodies. The canvas is a11y-hidden and the overlays carry the actions, but it is a visual-legibility trade. | Reversible via `focusMix`. | Owner taste and accessibility review. |
| C-15 | **Light themes** invert the glow physics (multiply and shadows) without owner art direction; Standard Light is deliberately muted. | Must not break; it is a lower-intensity variant. | Owner review per palette. |
| C-16 | **Status outline replaced.** The 3 px `bodyFill` outline becomes a 2 px rim plus an atmosphere; decay and rogue desaturate the photo. | Status stays glanceable. | Owner sign-off, since status visibility is product semantics. |
| C-17 | **The progress wake and drift tethers** add *new visual encodings* of existing data (interval progress, drift). | They encode only what the angle and drift already mean. | An owner product decision. |
| C-18 | **Test coverage gaps.** Shader output is not unit-testable; vitest covers only structure, fallbacks and pure helpers. | Unavoidable. | A device screenshot regression suite. |
| C-19 | **Lab-only data:** a stress seed of 400 synthetic contacts, a dev path only. | Needed for density evidence. | None; drop it. |
| C-20 | **The `resolveTap` side-write** (`fxTap`) is a small model-half change for feedback. | Semantics are unchanged. | A clean feedback event channel in V2. |

---

## 6. Owner glance items (not blockers for building; surface with evidence after M1)

These are C-02, C-04, C-05, C-16 and C-17. All five are visual or product meaning, which is
the owner's bucket. The lab builds each one behind a toggle so the owner can judge it on
device. None of them is presented as decided.
