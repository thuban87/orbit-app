# Lab A — Orrery Rendering Subsystem Brief (verified against code on disk)

Branch `experiment/orrery-skia-production`, worktree `/home/bwales/projects/orbit-orrery-lab-a`, read at HEAD `6514a802`.
Every file:line below was opened and checked. Stack versions read from `node_modules/*/package.json`:
`@shopify/react-native-skia` **2.6.2**, `react-native-reanimated` **4.5.1**, `react-native-worklets` **0.10.4**,
`react-native-gesture-handler` **2.32.0**. The Android Skia backend is **Ganesh/OpenGL**. Graphite is off:
`node_modules/@shopify/react-native-skia/libs/.graphite` does not exist, and `android/build.gradle:62-66` keys on that file.

Contents: §0 TL;DR · §1 Pipeline · §2 Camera · §3 Switch choreography · §4 Status encoding · §5 Theme/colour gate ·
§6 Lifecycle/tests · §7 Hit/gesture coupling · §8 Skia 2.6.2 inventory · §9 Risks · §10 Perf evidence · Appendix A file map.

---

## 0. TL;DR for the rewrite

1. **Single source of geometry.** One derived `frame: SharedValue<AnimatedFrame>` (`OrreryWorld.tsx:222-258`) feeds every layer,
   hit testing, label allocation, focus-lost detection, reorder capture, and `camera.frame`. A rewrite may change *how pixels
   are drawn from `frame`*. It must not change what `frame` contains, or tap/label/focus semantics drift.
2. **Visual size ≠ semantic size.** `body.radius` (projected) drives `hitRadius = max(22, radius)`, label anchors
   (`y + radius + 8`), label body-exclusion rects, culling reach (`1.3r`, sun `2r`), and focus framing. Draw halos/glows
   *outside* that number, inside the renderer, and never write them back into the frame.
3. **Labels decide Profile vs Focus.** `resolveOrreryTap` returns `profile` if the tapped body's label id is in
   `allocations.value` (`orrery-focus-logic.ts:77-91`, wired at `OrreryWorld.tsx:442-452`). Label visibility is a *semantic*
   output, not decoration. Never hide an allocated label visually, or show an unallocated one.
4. **One ambient clock.** `useClock()` exists only in `OrreryCanvas.tsx:101`. It is provided via `OrreryClockContext`.
   Every clock consumer must gate on `useReducedMotionShared()` inside the worklet. The canvas unmounts on
   blur/background/unmeasured (`OrreryScreen.tsx:609-610, 1048`). ADR-077's Decision makes "starfield and sun pulse the
   *sole* ambient animation". Any new ambient motion (nebula drift, ring shimmer, orbiting particles) is a recorded-decision
   change. That is acceptable inside this R&D lab, but production must escalate it to the owner. Flag it in HARVEST.
5. **Tests pin the tree shape.** `orrery-render.test.tsx` pins exact children of the clip Group:
   `[rings, polaris, ghost, bodies, labels]`, plus types, colours and `layer` props. `orrery-frame-mapper.test.ts` extracts the
   compiled frame worklet and fails on any new closure capture. `accent-foreground-role-contract.test.ts` pins exact
   `color={colors.accent}` slot text in `OrreryWorld.tsx` and `SatelliteBody.tsx`. Stale allowlist entries fail.
6. **Colour gate is regex-only.** `scripts/check-colors.sh` flags `#hex`, `rgb(`/`rgba(`/`hsl(`/`hsla(` (case-insensitive,
   *including inside SkSL strings*, e.g. `hsv2rgb(` and `toRGB(`), and quoted CSS names. Numeric SkSL constants
   (`half4(1.0,0.8,0.6,1)`) pass the gate but violate the Lab rule. Pass every hue in as a uniform from `ThemePalette`.
7. **Big perf levers in current code** (§9/§10):
   - per-body `saveLayer` every frame;
   - 128-point ring re-projection × N per frame, each point re-running `usableCameraRect` obstacle subtraction;
   - O(N²) `bodyKey` string lookups per frame;
   - an always-running clock that forces whole-canvas redraw every frame while motion is on.
   The projection is an exact **planar homography**, so world-plane layers (rings, grids, plane nebula) can be drawn under
   one 3×3 perspective matrix (§2.5).

---

## 1. Render pipeline end to end

### 1.1 Scene load (JS, discrete)

| Step | Where | What |
|---|---|---|
| System store | `OrreryScreen.tsx:257-284` | `createOrrerySystemStore({ load: (system, gen) => loadOrreryScene(getExecutor(), gen, system), persist })` |
| Scene read | `src/services/orrery-scene.ts:210-257` | `loadOrreryScene(exec, generation, system)`: `readOrrerySystemSnapshot` (one read txn), then `deriveSceneGeometry` *after* the snapshot releases |
| Geometry | `orrery-scene.ts:88-124` | orders members (`orderOrreryMembers`), computes Gravity per id (`computeContactGravity`), calls `deriveOrreryWorld(contacts, density, gravity, sunBody)` |
| Sun body | `orrery-scene.ts:110-121` | `{id: self?0:sunContactId, kind:"sun", x:0, y:0, radius: SUN_RADIUS(30) × (self ? 1 : gravityMassModifier), ringRadius:0}` |
| World | `src/logic/orrery-world-logic.ts:83-150` | contact bodies `{id, kind:"contact", radius: PLANET_RADIUS(16)×mass(0.9–1.1), ringRadius: ringInner + index×ringGap, angle, nudgeAngle, x,y = polar(ringRadius + drift, angle)}`; sun **appended last** (`:139`); `extent` = max reach |
| Snapshot type | `orrery-scene.ts:41-60` | `OrrerySceneSnapshot { preferences, generation, dataRevision, contacts(OrrerySystemMember[] with status/progress/photo/name/favourite_rank…), system, systemSnapshot(members, resolvedSunIdentity, completeContactedOrder, eligibleContactedVisibleIds, contactIdentities, …), world: WorldBody[], extent, gravity: Map<id, GravityResult>, sun{sunContactId, selfSunColour, selfPhoto, selfName, occupant, sunContactName} }` |

The world is camera-independent. Angle 0 is 12 o'clock and runs clockwise (`orrery-geometry-logic.ts:106-129`: `x = r·sin a`,
`y = −r·cos a`). Never-contacted contacts have angle `NEUTRAL_RESTING_ANGLE = 0` (`orrery-world-logic.ts:26, 91-94`). All
neutrals therefore sit in a vertical column north of the sun on successive rings, and they are never nudged
(`:111-118`, `progress !== null` gate).

Density presets (`orrery-world-logic.ts:21-25`): spacious `{ringInner 68, gap 44}`, balanced `{58, 34}`, compact `{58, 32}`.
Drift (`:61-72`): decay `0..DECAY_DRIFT_SPAN(40)` proportional through the decay band; rogue fixed `ROGUE_DRIFT_SPAN(80)`.
The **ring stays at `ringRadius`. The body sits at `ringRadius + drift`.** This literal "out of orbit" encoding is DECIDED
(HANDOFF §7 "Status is encoded without altering motion").

### 1.2 Publication into the switch runtime (JS → UI)

- `OrreryScreen.tsx:305-354`: a store subscription gated by `shouldPublishSwitchScene` (status/generation/snapshot identity;
  `orrery-switch-animation.ts:21-30`). Persistence-only Zustand publications are filtered out; this was a real device bug
  (30-12-DEVICE). Then `publishSwitch(snapshot, isSwitch, intensity, destinationHome)`.
  - `intensity = switchIntensity(computeMembershipDelta(src, dst))` gives 0..1 turnover (`orrery-switch-animation.ts:36-65`).
  - `destinationHome = deriveHomePose(world, viewport)`.
- `use-orrery-switch-runtime.ts:283-339` `publish`:
  1. `setResources(nextOrreryResources(...))`. This is React state of keyed `OrreryBodyResource {key, body, scene}`. It changes
     only per publication, never per frame.
  2. `runOnUI`: when not a switch, or on first publication, it writes a settled `transition` with `progress = 1`. Otherwise it
     samples the *displayed* world/camera, calls `beginSwitchChoreography(displayed, scene.world, gen, {intensity, reducedMotion})`,
     sets `progress = 0`, and calls `startDriver`. The driver is `withTiming(1, {duration: 2100 or 180 ms × remaining,
     reduceMotion: ReduceMotion.Never})`.
  3. `finish` (`:251-263`): generation check → `progress = 1`, `pose = cameraTo`, `transition = settleSwitchChoreography(transition)`,
     then `runOnJS(prune)`.

### 1.3 Mount gate (lifecycle)

`OrreryScreen.tsx:609-613`: `measured = usableCameraRect(viewport) !== null`; `visible = measured && isFocused && appActive`.
`OrreryScreen.tsx:1048-1067` mounts `<OrreryWorld …/>` only when `visible && sessionReady && scene`. `OrreryWorld` renders
`OrreryCanvas`, which owns the clock, so unmounting stops it. The switch runtime lives in the **screen**
(`OrreryScreen.tsx:285`) and survives the canvas unmount. Blur/background call `pauseSwitch()` (`:415-425`, `:426-447`).
`resumeSwitch()` is called when visible again (`:611-613`).

### 1.4 The frame (UI thread) — `OrreryWorld.tsx:222-258`

```ts
const frame = useDerivedValue(() => {
  const sampled = sampleSwitchChoreography(switchRuntime.transition.value, switchRuntime.progress.value).world;
  const sampledCamera = switchRuntime.progress.value >= 1 ? pose.value
    : sampleOrrerySwitchCamera(switchRuntime.cameraFrom.value, switchRuntime.cameraTo.value, switchRuntime.progress.value);
  const held = reorder.value;                                  // = camera.reorder (captured as `reorder`, NOT `camera`)
  const world = previewReorder(sampled, held?.generation === scene.generation ? held : null);
  const moons = deriveSatelliteBodies(world, satellites, scene.systemSnapshot.members, true,
                                      semanticLevel(sampledCamera.zoom, level.value));
  const completeWorld = [...world, ...moons];
  return projectAnimatedFrame({ generation: switchRuntime.transition.value.generation, from: completeWorld, to: completeWorld },
                              1, sampledCamera, viewport);
});
```

- `useAnimatedReaction(() => frame.value, v => camera.frame.value = v)` at `:260-265` publishes the frame to the gesture
  controller.
- `level` (SemanticLevel shared value) is updated by a reaction on `frame.value.pose.zoom` (`:357-362`), with hysteresis.
- **Index alignment:** `frame.bodies[i]` ↔ `completeWorld[i]`. For `i < entries.length`, it also matches
  `transition.value.entries[i]`, because `sampleSwitchChoreography` maps `entries` in order and `previewReorder` preserves
  order. Moons are appended after. During a settled state, entries = destination bodies (world order: contacts by rank,
  then sun).

### 1.5 `AnimatedFrame` body fields (per frame) — `orrery-frame.ts:24-30, 129-157` + `orrery-camera-logic.ts:38-59, 490-538`

| Field | Meaning | Source |
|---|---|---|
| `id` | contact id. Self sun = 0. Satellites = −1 | world |
| `kind` | `"contact" \| "sun" \| "satellite"` | world |
| `satelliteTarget?` | `{kind:"satellite", uid, parentId, parentUid}` | moons |
| `x, y` | **screen px** projected centre | `projectWorldPoint` |
| `radius` | **projected screen radius** = `worldRadius × zoom × perspectiveScale` | `:530` |
| `ringRadius` | `worldRingRadius × zoom`. **Not** perspective-correct; used by reorder math only | `:531` |
| `hitRadius` | `max(MIN_HIT_RADIUS=22, radius)` | `:532` |
| `ringPath` | 128 projected screen points of the body's orbit circle (empty if ringRadius 0: sun/moons) | `:512-526` |
| `depth` | `cameraPlane(body).y × sin(tilt)` (world-units). **Larger = nearer viewer** (lower on screen). 0 for all at tilt 0 | `:534` |
| `opacity` | choreography opacity (0..1) | sampled world |
| `interactive` | `world.interactive && opacity > 0` | `:147` |
| `visible` | `opacity>0 &&` within viewport with reach `radius × (sun ? 2 : 1.3)` | `:148-153` |

Frame-level fields: `generation`, `pose` (the *clamped* pose actually used, incl. tilt, yaw, zoom, focalDistance), `viewport`
(`{width, height, usable?, obstacles?}`), `center` (projected world origin). **Tilt, yaw and zoom are all available per
frame via `frame.value.pose`.** Not in the frame: per-body role/stage, status, photo, name. Those come from React-side
`resource.scene` / `transition.value.entries`.

`billboardPose(frame, key, baseRadius)` (`orrery-frame.ts:203-219`) gives `{x, y, scale: b.radius/baseRadius, depth,
opacity: visible ? opacity : 0}`. When a key is absent, it returns `{0,0,1,0,0}`, which hides it.

### 1.6 Layers (draw order) — `OrreryCanvas.tsx:141-165` then `OrreryWorld.tsx:517-613`

| # | Layer | File:lines | Per-frame inputs | Notes |
|---|---|---|---|---|
| 0 | `GestureDetector` → `<Canvas testID="orrery-canvas" style={{width,height}}>` | `OrreryCanvas.tsx:142-143` | — | default Android `SkiaTextureView` (no `opaque`) |
| 1 | `<Fill color={background}>` | `:144` | — | `colors.background` |
| 2 | Starfield: `<Group opacity={twinkle}>` + 44 `<Circle>` | `:146-158` | `twinkle` (clock, RM-gated) | **screen-space**: not camera-linked, no parallax. Deterministic `seeded()` positions (`:87-90, 120-139`). Colours cycle `[textSecondary, textPrimary, ...starPalette]` (`OrreryWorld.tsx:272-275`). r 0.6–1.8; base opacity 0.4–1.0; twinkle 0.18–0.55 @ 0.0024 rad/ms; RM → 0.365 |
| — | `<OrreryClockContext.Provider value={clock}>` | `:160-162` | — | wraps all world children |
| 3 | clip `<Group clip={{0,0,w,h}}>` | `OrreryWorld.tsx:525-527` | — | **tree[0]** in render test |
| 3a | Rings `<Group>` → one `ProjectedOrbitRing` per **contact resource** | `:528-543`; `ProjectedOrbitRing.tsx:6-49` | `frame` → find body by key → `ringPath` → new `SkPath` per frame; opacity = `body.opacity × (faded 0.7 \| faintTrace 0.3 \| style.opacity)` | stroke width `style.width` (2/3/4) in **screen px** (does not scale with zoom); `DashPathEffect [6,6]` for dashed & faintTrace. All rings sit **below all bodies** (no depth interleave) |
| 3b | `<Polaris frame extent colors>` | `:544`; `Polaris.tsx:11-39` | `polarisProjection(frame, extent)` → translate | world point `(0, −max(32, 0.85·extent))` (`orrery-obstacle-logic.ts:99-105`). Circle r=9 `starPalette[0]` @0.25, 4-point star `Path` `textPrimary`, dot r=2. Not scaled by zoom/perspective |
| 3c | `<ReorderGhost frame drag color={colors.accent}>` | `:545-549`; `:84-108` | `drag.value?.active` → held body's `ringPath` + circle r+4 | single `Path` stroke 2 |
| 3d | Bodies `<Group>`: `ProjectedBody` per resource (contacts + sun) **then** `SatelliteBody` per satellite row | `:551-588` | each body root `Group` has `transform=[translateX, translateY, scale]`, `zIndex=depth`, `layer=Paint(alpha=opacity)` | **must stay consecutive Group siblings**: RN-Skia sorts pending groups by zIndex and *flushes at every non-Group command* (`sksg/Recorder/Player.ts:71-110`; comment at `OrreryWorld.tsx:550`). Equal zIndex → source order |
| 3d-i | `OrbitBody` | `OrbitBody.tsx:50-155` | `projection = billboardPose(frame, key, body.radius)` → transform/zIndex/layer | local space: focus ring `r+4` stroke 2 `accent` (if focused); status disc `Circle r bodyFill`; photo `Image` clipped to `rrect` of `innerR = r − 1.5` cover-fit, **or** swatch circle + initials `Paragraph` (Inter, fontSize = r) |
| 3d-ii | `SunBody` | `SunBody.tsx:71-208` | same + `clock` (context) + its **own** `useReducedMotionShared()` | focus ring `r+6`; glow halo `Circle r=pulseGlowRadius (1.8r ±10%) opacity 0.35(±40%)` `glowColor`; rim `r+2` `glowColor`; photo/swatch+initials |
| 3d-iii | `SatelliteBody` | `SatelliteBody.tsx:7-46` | `billboardPose(frame, identity, 1)` → scale = projected radius | `Circle r=1 textSecondary`; focused: stroke `r=1.5 w=0.3 accent` |
| 3e | Labels `<Group>` → per label `<Group key>` → `OrreryLabel` (+ context `OrreryLabel` if any) | `:590-610`; `OrreryLabel.tsx:71-116` | `allocations.value.find(id)` → rect/contextRect/opacity | `<Group layer={<Paint opacity/>}>` (= `skLayer`) → `RoundedRect r=RADII.sm colors.surface` backplate + `Paragraph` (pre-shaped on JS: `prepareOrreryText`, `OrreryLabel.tsx:31-69`, Inter 600 label / 400 caption, colour `textPrimary`/`textSecondary`, fontScale-aware, `maxLines 1`, ellipsis). Screen-space, horizontal, never depth-sorted |

`ProjectedBody` (`OrreryWorld.tsx:109-165`) resolves on the JS thread per resource render: the sun occupant
(`resolveSunOccupant`), name, `swatch = avatarSwatches[swatchIndex(name)]`, `initials`,
`focusColor = focused ? accent : undefined`, and `bodyFill = orreryRingStyle(contact.status).bodyFill`. These are **React
props, not per-frame**.

### 1.7 Label pipeline

- `labels` (`OrreryWorld.tsx:276-339`, `useMemo` on scene/colours/font/fontScale/focus/cluster) builds one entry per
  `scene.world` body except self sun (`id===0`). Each entry has
  `{id: bodyKey, name, text: PreparedOrreryText, context: PreparedOrreryText|null, focused (single focus only), cluster, favorite (favourite_rank != null)}`.
  `context = labelContext(status, gravity, focusedRelation)` gives e.g. `"Wobbling · Solid gravity · Sister of Ann"`
  (`orrery-label-logic.ts:187-209`). D-11: a nonmember global sun gets no relationship context (`:288-297`).
- `measured` (`:341-356`) holds plain numbers only. Native paragraph objects never enter worklets.
- `allocations` (`:363-393`, worklet): candidates = visible **and** interactive bodies.
  `x = body.x − w/2`, `y = body.y + body.radius + 8`, `alternateY` above. Exclusions = every visible body's
  `radius` box + `viewport.obstacles`. Then `allocateLabels(candidates, semanticLevel(zoom, level), viewport, exclusions)`.
- `allocateLabels` (`orrery-label-logic.ts:82-184`):
  - Overview admits only focused/cluster.
  - Priority: focused 0 → cluster 1 → favourite 2 → clean-fitting 3 → rest 4, with id tiebreak.
  - Six placements: below or above × dx {0, −8, +8}.
  - Inclusive collision.
  - Context rects only at `detail`, never displacing a name.

---

## 2. Camera / projection model — `src/logic/orrery-camera-logic.ts`

### 2.1 Pose

`CameraPose = {x, y, zoom, tilt?, yaw?, focalDistance?}` (`:18-25`). `HOME_CAMERA = {0, 0, zoom 1, tilt 0, yaw 0, focal 256}` (`:60-67`).

| Axis | Range / rule | Where |
|---|---|---|
| pan x,y (world units) | clamped to `±max(1, extent)`; gesture bound uses `cameraExtent(extent) = max(32, extent)` | `clampCameraPose :235-250`; `orrery-recovery-logic.ts:21-24` |
| zoom | `MIN_ZOOM 0.25 … MAX_ZOOM 4` | `:70-71` |
| tilt | `0 … MAX_TILT = π/3 (60°)` | `:72, 244` |
| yaw | wrapped to `[0, 2π)` | `:245-247` |
| focalDistance | **re-derived on every clamp**: `max(256, (1+√2)·extent·sin(60°)/0.45)`, so perspective never exceeds ±45% of focal (`MAX_DEPTH_FRACTION`) | `:91-100, 248` |

Gesture deltas (`orrery-gesture-logic.ts`): `PAN_DISTANCE 10`, `TAP_DISTANCE 8`, `HOLD_MS 850`, `HOLD_SLOP 8`,
`TILT_DISTANCE 28`, `TILT_RADIANS_PER_POINT 0.004`.

### 2.2 Projection (worklet)

```
plane = R(yaw)·(p − pose.xy)            // cameraPlane :189-197  (x' = x c − y s, y' = x s + y c)
s     = focal / (focal − plane.y·sin(tilt))       // perspectiveScale :198-206 (throws if denom ≤ 0)
screen.x = cx + plane.x · s · zoom
screen.y = cy + plane.y · cos(tilt) · s · zoom     // projectWorldPoint :282-296
(cx, cy) = centre of usableCameraRect(viewport)    // projectionCenter :183-188 — largest obstacle-free rect
```

- Billboards stay screen-facing and circular. Size = `worldRadius × zoom × s`.
- Inverse: `unprojectToWorldPlane` (`:303-325`).
- `tryUnprojectToWorldPlane` (`:459-489`) returns null beyond the horizon.
- `anchorCameraPose` (`:329-353`) keeps the pinch focal point fixed.
- `frameBodies` (`:363-456`) binary-searches zoom so projected media plus a 22-px touch radius fit the usable rect.

### 2.3 Depth

`depth = plane.y · sin(tilt)` (`:534`). At tilt 0 every depth is 0, so draw order = resource order: contacts by rank, then
sun **last** (on top). With tilt, bodies lower on screen (camera-plane +y, "south" after yaw) have larger depth, a larger
perspective scale, and draw on top. The render test asserts contact (north) depth < sun depth at tilt 0.5/yaw 0, reversed
at yaw π (`orrery-render.test.tsx:288-293`). `depth` is presentation only: "zIndex … never chooses a contact action"
(`docs/systems/orrery.md:71`).

### 2.4 Semantic levels — `orrery-label-logic.ts:10-46`

`overview` < `identity` (enter zoom ≥ 2 = `IDENTITY_ZOOM`, exit < 1.85) < `detail` (enter ≥ 3, exit < 2.8). Hysteresis
depends on the previous level held in the `level` shared value.

| Level | Effects |
|---|---|
| overview | labels only for focused/cluster; satellites not derived (`deriveSatelliteBodies` returns `[]`) |
| identity | names allocated; satellites appear |
| detail | adds health/Gravity/relation context captions |

Home zoom is `min(1, max(floor, fit))` (`deriveHomePose :254-280`; floor = `MIN_READABLE_RADIUS(10)/minWorldRadius`).
**Home is therefore always overview.** `FOCUS_MS 300`, `IDENTITY_ZOOM 2`.

### 2.5 Projection is a planar homography (renderer opportunity)

The map from world plane to screen is exactly:

```
H = T(cx,cy) · [[z·f, 0, 0], [0, z·f·cos t, 0], [0, −sin t, f]] · R(yaw) · T(−pose.x, −pose.y)
```

with `f = clamped focalDistance` and `z = zoom`. Skia accepts 3×3 perspective matrices: `Skia.Matrix(number[9])`, and
Group `matrix?: InputMatrix` (`dom/types/Common.ts:70`; `skia/types/Matrix.ts:23,71`). So a world-plane layer can be drawn
in world coordinates under one `<Group matrix={H}>`. That covers rings as true circles, decay drift guides, a plane nebula,
grid, or radial "gravity wells". This replaces 128×N re-projected points per frame.

Caveats:
- Strokes and dashes are then in world units and scale/foreshorten with perspective. Current rings are fixed screen-px.
  Choose deliberately.
- `H` must be built from **`frame.value.pose`** (the clamped pose, including the re-derived focal) and `frame.value.viewport`,
  so it coincides with hit math. Add a unit test that `H·p == projectWorldPoint(p)` within 1e-6.
- `ringPath` must remain in `ProjectedBody` while `ReorderGhost`/tests consume it. Or change the consumers deliberately.

### 2.6 Home / framing / recovery owners

- `deriveHomePose` is called in `OrreryScreen.tsx:328` (switch destination), `:957` (framing effect) and `:999` (Recenter).
- Focus framing uses `frameBodies` (`OrreryScreen.tsx:709`); a single focus is capped at `IDENTITY_ZOOM`.
- Recovery (`orrery-recovery-logic.ts:13-156`): 180–850 ms distance-adaptive, quintic-out; reduced motion gives 100 ms
  linear. Coast: 120 ms, pan ≤ 18 pt, yaw ≤ 0.08 rad, none under reduced motion.
- `northTarget` resets yaw only.
- Polaris hit radius is 22 and never steals a body tap (`orrery-recovery-logic.ts:136-156`).

---

## 3. Switch choreography

### 3.1 Data — `src/logic/orrery-switch-choreography.ts`

- `beginSwitchChoreography(source, destination, generation, {intensity, reducedMotion})` (`:348-404`). Entries are keyed by
  `keyOf` (= `bodyKey`). Roles: `retained` (contact on both sides), `leaving`, `entering`, `anchor` (non-contact, i.e. sun).
  `stagger = stableUnit(key) × 0.035` for contacts.
- `spinTurns = RM ? 0 : (intensity<=0 ? 0 : 1 + round(intensity×2))`, so 1–3 turns.
  `radialDisplacement = RM||intensity<=0 ? 0 : 52 + 118×intensity`.
- `SwitchChoreographySample` (`:55-62`) = `{generation, progress, phase, accumulatedRotation, angularVelocity, world}`.

### 3.2 Stages (progress 0..1; normal 2100 ms, RM 180 ms — `use-orrery-switch-runtime.ts:25-26`)

| Constant | Value | Meaning |
|---|---|---|
| `ACCELERATE_END` | 0.20 | rotation ramps up (cubic integral) |
| `SHED_START/END` | 0.18 / 0.58 (+stagger) | leaving bodies move out radially + `radialDisplacement`, shrink to 0.75r, fade, at `bodyAngle + accumulatedRotation`; **inert from progress > 0** |
| `CAPTURE_START/END` | 0.44 / 0.82 (+stagger) | entering bodies come in from `+radialDisplacement`, counter-rotated by `(1−rotationProgress)·turns·2π`, grow 0.75→1, fade in |
| `SETTLE_START` | 0.72 | rotation decelerates (quadratic) |
| `INTERACTION_READY_PROGRESS` | 0.82 | entering bodies become interactive |
| phase labels | `phaseAt` `:152-159` | accelerate <0.2, shed <0.44, capture <0.72, settle <1, complete ≥1 |

Retained bodies (`:259-284`) rotate forward to their destination angle plus `turns` full turns, mixing distance, ring,
radius and opacity with smoothstep. They stay interactive throughout. Anchor/sun: linear mix (`:207-229`). At progress ≥ 1,
destination bodies have opacity 1 and interactive; source-only entries have opacity 0 and are inert (`:460-463`).

Reduced motion (`sampleReduced :231-257`): smoothstep crossfade and direct reposition, no rotation, no displacement.
Retained/anchor stay interactive; entering bodies become interactive only at 1. Live RM toggled mid-switch re-bases onto an
RM choreography from the displayed sample (`use-orrery-switch-runtime.ts:362-389`). The camera interpolates
`cameraFrom → cameraTo` with smoothstep (`:60-86`).

Retarget: `publish` during a running switch rebases from `sampleSwitchChoreography(transition, progress).world`, so the
displayed sample is authoritative. Settle compaction: `settleSwitchChoreography` (`:416-431`, RG-027/ADR-170).

### 3.3 What a renderer can read per frame (without changing semantics)

`OrreryWorld` currently discards everything but `.world` (`OrreryWorld.tsx:223-226`). Available read-only sources:

- `switchRuntime.progress.value`, `switchRuntime.running.value`
- `switchRuntime.transition.value.{entries[i].role, entries[i].stagger, intensity, reducedMotion, spinTurns, radialDisplacement, generation}`
- recompute `phase`, `angularVelocity` and `accumulatedRotation` by calling `sampleSwitchChoreography` (already called once
  in the frame worklet). Or export small pure helpers. The shed/capture per-body local progress =
  `smoothstep(clamp01((p − START − stagger)/(END − START)))` with the exported constants.

Safe hook patterns:

- **Preferred:** a *separate* `useDerivedValue` named e.g. `switchFx` that reads `switchRuntime.progress/transition` and
  returns `{progress, phase, angularVelocity, perBody: Float32Array(role code, local stage 0..1)}` indexed like
  `frame.bodies` for `i < entries.length`. This keeps the frame worklet's closure unchanged (protects the mapper test,
  §6). Cost: one extra sampling pass while running. Gate the pass to `progress < 1`.
- Visual-only uses:
  - motion streaks/trails ∝ `angularVelocity` (sign by body);
  - outbound "ejection" glow for leaving bodies ∝ shed stage;
  - capture flare for entering bodies at the capture end;
  - ring "ripple" during settle;
  - background parallax impulse ∝ `intensity × angularVelocity`.
- All of these must be **0 when `transition.reducedMotion || reducedMotionShared.value`** and **0 at progress ≥ 1**. They
  must not alter `frame` (positions, radius, opacity, interactive).
- Do not use React state for any of it. Do not start a second timing driver. The runtime owns the only switch clock
  (`withTiming` on `progress`).

---

## 4. Status / health visual encoding contract

### 4.1 `orreryRingStyle(status, colors)` — `src/logic/orrery-ring-logic.ts:55-105` (wraps `ringVisual`, `src/components/contact-card-ring.ts:45-62`)

| status | ring `color` | `opacity` | `width` (px) | `strokeStyle` | ring render (`ProjectedOrbitRing`) | `bodyFill` |
|---|---|---|---|---|---|---|
| stable | `statusStable` | 1 | 2 | solid | solid, α = body.opacity × 1 | `statusStable` |
| wobble | `statusWobble` | 1 | 3 | dashed | dash [6,6], α × 1 | `statusWobble` |
| decay | `statusDecay` | 1 | 4 | faded | solid, α × 0.7 | `statusDecay` |
| rogue | `rogue` (warm amber) | 1 | 3 | faintTrace | dash [6,6], α × 0.3 | `rogueExtinguished` (cold) |
| null (never contacted) | `border` | 0.5 | 2 | solid | solid, α × 0.5 | `border` |

`bodyFill` renders as the full disc behind the photo. Because `innerR = r − 1.5`, the visible status cue on a photo body is
only a **1.5-px rim** (`OrbitBody.tsx:48, 83, 127`). This is weak. A rewrite can strengthen it as long as the colour
stays `bodyFill`/ring colour.

### 4.2 Other encodings currently drawn

| Concept | Current visual | Semantic source |
|---|---|---|
| Ring radius = rank (closeness) | ring per contact, `ringInner + index·gap` | ADR-046, HANDOFF "every contact gets its own orbit ring" |
| Angle = interval progress | body position on ring | HANDOFF/ADR-048 |
| Decay/rogue drift | body offset outward from its ring (+0..40 / +80 world) | HANDOFF "drifting outward past their assigned ring" |
| Never contacted | neutral border fill, faint ring, fixed north angle, label context "Not contacted yet" | ADR-011, 29-UI-SPEC "never substitute Stable/Decaying" |
| Gravity | body radius × 0.9–1.1 (`gravityMassModifier`, `orrery-world-logic.ts:34-45`); detail caption "`{tierName} gravity`"; companion list | ADR-106: modest secondary cue, never a raw number |
| Favorites | **label priority only** (no body visual) | `favourite_rank != null` |
| Focus (single) | `accent` stroke ring r+4 (sun r+6), w 2; label priority 0; `OrreryFocusContext` overlay | focusedIds |
| Cluster | label priority 1 only; `OrreryClusterPanel` overlay | clusterIds |
| Satellites | tiny `textSecondary` dot (world r = min(4, 0.2·parent r), offset parent r + 24 at UID-hashed angle); focused gets an accent stroke; only at identity/detail and when the preference is on | ADR-105: subordinate; no health, Gravity or Profile implication |
| Sun | photo/swatch + glow halo + rim in `glowColor` (self: `selfSunColour ?? starPalette[0]`; contact sun: its status ring colour; never contacted: `border`) | `sun-occupant-logic.ts:120-155`, ADR-047 |
| Polaris | north landmark | ADR-077/29-UI-SPEC E8 |
| Reorder | accent ghost ring + circle during active hold | ADR-046 |

### 4.3 MUST stay perceivable (recorded decisions)

- One canonical health view. No second mode or morph (ADR-077).
- Status distinguishable **without colour** via line treatment (solid / dashed / faded / faint-trace), plus companion text
  (29-UI-SPEC Colour section; `ringVisual` width is the "redundant CVD channel").
- Rogue: warm ring and cold body must stay distinct.
- Neutral never-contacted must never look like Stable or Decay.
- Radius encodes rank. Angle encodes progress. Drift-outward encodes decay/rogue. **Motion encodes data, not mood:**
  "[REJECTED] Differentiated per-band animation (wobble moving irregularly, decayed floating free with no orbit lines)"
  (HANDOFF §7). So **no status-specific jitter, wobble or floating, and no removing a decayed body's ring.**
- Bodies are static except the camera and switch choreography (ADR-048/077). Starfield twinkle and sun pulse are the only
  ambient motion (ADR-077 Decision; ADR-085 gating). Anything beyond that is an owner decision for production.
- Gravity stays modest and secondary. Never a raw number or "worth" label. Never displaces an identity label (ADR-106).
- Satellites stay subordinate and never imply a contact (ADR-105).
- Photos stay circular and screen-facing. Labels stay horizontal (docs/systems/orrery.md:71).
- Accent is reserved for focus, reorder preview and selection (29-UI-SPEC Colour). Text is `textPrimary`/`textSecondary`.
  Label backplate is `surface`.
- Theme restyles everything, in light and dark, Galaxy and Standard (§5).

### 4.4 Free presentation (renderer's call)

Disc shading/lighting, rim/glow treatment (keeping status hue), atmosphere, ring rendering technique (gradients, glow,
world-space strokes, depth fade), starfield/nebula/background (static or cheap), Polaris styling, label plate styling
(keeping token colours and the allocation geometry), focus treatment (keeping the accent and a distinct non-status cue),
parallax of the *background* only, switch-stage VFX (§3.3), sun corona (still gated by the single clock and reduced motion).

---

## 5. Theme

### 5.1 Packages / modes

`ThemePackage = "galaxy" | "standard"`; `ResolvedMode = "light" | "dark"`. There are four authored palettes:
`THEME_PRESETS.galaxy.{dark,light}`, `.standard.{dark,light}` (`src/theme/theme-presets.ts:29-333`; types
`src/theme/theme-types.ts:13-24, 50-262`). `resolvePalette(pkg, mode)`. The provider overlays the accent trio
(`applyAccent`, spread) and may supply `glassColors` (spread). The Orrery reads `useTheme().colors` (`OrreryScreen.tsx:148`)
and draws on **`colors.background` via `<Fill>`, not the app wallpaper/art**. The art-treatment contract bans
`useArtTreatment`/`artComponent` in Orrery files (`src/theme/art-treatment-scope-contract.test.ts:137-148`).

**Light mode is a first-class case.** `background` is `#EDF0F9` (galaxy-light) / `#F2F3F6` (standard-light), and stars
become dark dots. Additive/screen glows vanish on light backgrounds, so effects must be mode-aware: for example, switch the
blend mode or use darker token tints in light mode.

### 5.2 Orrery-relevant tokens (`ThemePalette`)

| Token | Galaxy dark | Galaxy light | Standard dark | Standard light | Used by |
|---|---|---|---|---|---|
| `background` | #0B0E1A | #EDF0F9 | #101216 | #F2F3F6 | Fill |
| `surface` | #141828 | #FBFCFE | #191C22 | #FFFFFF | label backplate |
| `textPrimary` | #E6E9F5 | #1A1F33 | #E9ECF1 | #1B1E26 | stars, Polaris, label text |
| `textSecondary` | #8B93B0 | #515A78 | #9AA1AD | #565D6B | stars, moons, captions |
| `border` | #2A3048 | #D2D9EA | #2E333C | #DADEE6 | neutral ring/body/sun glow |
| `accent` (overlaid) | #6C8CFF | #3355E6 | #8091D6 | #4453B0 | focus, reorder |
| `statusStable` | #45B98A | #1E7D5A | #4BB08A | #1E7D5A | ring/body |
| `statusWobble` | #E8C15C | #8A6A12 | #E2C065 | #836612 | ring/body |
| `statusDecay` | #E56A52 | #B33A22 | #EA7059 | #B33A22 | ring/body |
| `rogue` | #E0904A | #9A5B14 | #DA9350 | #96591A | rogue ring |
| `rogueExtinguished` | #3E4A6B | #8892A8 | #414957 | #7E889C | rogue body |
| `starPalette[6]` | #F2C14E, #E8944A, #D96B7C, #A98BE0, #5CC6F0, #DCE6FF (galaxy-dark; other palettes `:179, 245, 303`) | | | | stars, Polaris halo, self-sun default `[0]`. **Every entry must be 6-digit hex** (DAO validator test) |
| `avatarSwatches[]`, `avatarSwatchText` | | | | | initials fallback |
| `gravityTiers[4]` | #4E5A7A, #5B8AB0, #5B9E8A, #C9A24E (galaxy-dark) | | | | not currently drawn on canvas; available for Gravity cues |
| `mutedStable/Wobble/Decay` | | | | | legacy morph endpoints, **unused now**; desaturated same-hue, usable for depth-fade/far tint |
| `borderStrong`, `surfaceElevated`, `heatmapScale`, `onAccent`… | | | | | available |

`selfSunColour` comes from SQLite (user-picked hex). It is data, not a literal.

### 5.3 How colours reach Skia today

Token strings are passed as props (`color={colors.x}`) or built into paragraphs (`Skia.Color(colors[token])`). No shader
uniforms exist yet. For SkSL:
- `Skia.Color(string)` returns `SkColor = Float32Array` RGBA 0..1, unpremultiplied (`skia/types/Color.ts:1-4`).
- Uniform values accept `number | Vector | Float32Array | Uniform[]` (`skia/types/Shader/Shader.ts:10-61`).
- Precompute on the JS thread: `const tint = useMemo(() => Array.from(Skia.Color(colors.statusStable)), [colors])`, then
  pass it into the uniforms object. SkSL `half4 main` must return **premultiplied** colour.

### 5.4 `check:colors` exact behaviour — `scripts/check-colors.sh` (`package.json:66`)

- Scans `src` + `App.tsx`, `*.ts`/`*.tsx` only (for directory recursion), with
  `grep -rEniIH "#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(|[\"'](white|black|transparent|silver|gray|grey|red|green|blue|yellow|orange|purple|pink|cyan|magenta|brown)[\"']"`.
  It is **case-insensitive** and has **no string/comment awareness**.
- Exemption: any match whose *file path* contains `/theme/` (`grep -vE '^[^:]*/theme/'`). Note the loophole: a hypothetical
  `src/components/orrery/theme/x.ts` would also be exempt. **Do not use it.** Colour literals belong only in
  `src/theme/theme-presets.ts` per Lab rules.
- Verified by running the exact regex on samples (scratchpad):
  - **Flagged:** `hsv2rgb(` (ends `rgb(`), `toRGB(`, `// tint #fff`, `"transparent"`.
  - **Not flagged:** `half4(1.0, 0.8, 0.6, 1.0)`, `color.rgb * 0.5`, `rgb2hsv(`, `#define FOO`, `0xFFFFFFFF`.
- Conclusion: SkSL numeric colour constants pass the gate but break the token rule. Allowed numerics are intensity/alpha
  scalars, noise math, and neutral `half4(0)`. Every hue (including "white-hot" cores) comes from a token uniform: e.g.
  `textPrimary`, `starPalette[5]`, or a new token. Avoid SkSL helper names ending in `rgb`/`rgba`/`hsl`/`hsla` (use
  `hsvToColor`). Avoid `#` in shader comments.

### 5.5 Other colour contracts a rewrite can trip

- `src/theme/accent-foreground-role-contract.test.ts:88-99`: the allowlist holds the **exact** slot texts
  `color={colors.accent}` in `src/components/orrery/OrreryWorld.tsx` (ReorderGhost) and
  `src/components/orrery/SatelliteBody.tsx` (focus stroke). Each entry must still match **exactly one** finding
  (`:166-176`), and new `color`/`tone`/`tintColor`/`glyphColor` slots fed by `colors.accent` must be allowlisted with a
  reason starting with the `SKIA_FILL` text. Moving or renaming these props means editing the allowlist in the same commit.
  A slot named e.g. `focusColor` or `uniforms` is not a foreground slot (`__contract__/accent-foreground-roles.ts:40-44`).
- `src/theme/theme-presets.test.ts:185-262`: starPalette `[0] === #F2C14E`, ≥6 entries, DAO-valid hex. The listed
  SCALAR/ARRAY tokens must exist in all four palettes.

### 5.6 Adding a token properly

1. Add the field and its doc comment to `ThemePalette` (`src/theme/theme-types.ts:50-262`).
2. Author the value in **all four** palettes (`src/theme/theme-presets.ts`). `tsc` enforces this. `accents.ts:139` and
   `glass-foregrounds.ts:164` spread palettes, so no edits are needed there. No test fixture constructs full palette
   literals (grep found `rogueExtinguished:` only in theme-types/presets).
3. Add it to `SCALAR_TOKENS`/`ARRAY_TOKENS` in `theme-presets.test.ts:229-255` so completeness is asserted. Add contrast
   tests if it carries text.
4. Run `npx tsc --noEmit`, `npm run check:colors`, `npx vitest run src/theme`.
5. Production would also need an owner sign-off for new hues (galaxy-dark seeds are owner-approved infrastructure).

---

## 6. Lifecycle / clock / reduced-motion contract and enforcing tests

### 6.1 Contract (code)

- **Clock:** `useClock()` exists only at `OrreryCanvas.tsx:101`. It is `useFrameCallback`-based
  (`skia/src/external/reanimated/interpolators.ts:57-68`). It ticks every frame while mounted, so **any derived value that
  reads it forces a full canvas redraw every frame**. Today that is the twinkle (whole-scene redraw at display rate whenever
  reduced motion is off, even when the camera is idle) plus the `SunBody` pulse.
- Clock distribution: `OrreryClockContext.Provider` (`:160-162`) → `useOrreryClock()` (`orrery-clock-context.ts:26-28`).
  It is null outside the canvas, and consumers must fall back to static.
- **Reduced motion:** `useReducedMotionShared()` (`src/theme/use-reduced-motion.ts:106-118`) creates a per-call
  `SharedValue<boolean>` fed by `AccessibilityInfo` live events, not by Reanimated's boot-time hook. Each consumer reads it
  inside its worklet: `OrreryCanvas.tsx:106,111-117`, `SunBody.tsx:117-131`, screen `OrreryScreen.tsx:256` → switch runtime +
  camera (`use-orrery-camera.ts:131-136` cancels coast/recovery on an RM flip).
- **Unmount = pause:** canvas mounted only when `visible && sessionReady && scene` (`OrreryScreen.tsx:609-610, 1048`).
  Blur/background → `pauseSwitch()` + session capture + `cancelAnimation(pose)` (`:415-447`). Camera disables
  (`enabled: visible && !overlaysOpen`, `:614-620`) and the cleanup resets input/frame/reorder (`use-orrery-camera.ts:137-160`).
- Every timing in runtime/camera uses `reduceMotion: ReduceMotion.Never`, because the app owns RM semantics explicitly.
- React state is only for discrete data (resources, focus, overlays). Never per frame.

### 6.2 Tests a rewrite can break

| Test | Asserts (that rendering changes can break) |
|---|---|
| `src/components/orrery/orrery-render.test.tsx` | Calls `OrreryWorld(...)` as a plain function with mocked React hooks, Reanimated, `OrreryCanvas` (→ children) and Skia. The Skia mock has **only** `Group` (real installed impl), `Circle, Paragraph, Paint, Path, DashPathEffect, RoundedRect, Image` as string tags, `Skia.{Color, Paint, ParagraphBuilder}`, `rect`, `rrect`, `TextAlign`. **Any new Skia component or API (Shader, RadialGradient, BlurMask, `Skia.RuntimeEffect`, `Skia.Matrix`, Picture, Atlas…) must be added to this mock**; module-level `Skia.RuntimeEffect.Make` would throw on import. Structure pins (`:228-243, 272-305`): `tree[0].children` = `[rings, polaris, ghost, bodies, labels]`; `bodies.children` types all `skGroup` (2 for contact+sun, 3 with a moon), moon is `[2]` with `children[0].props.color === textSecondary` and `transform.value[2].scale` in (0, 8], becoming 1 when hidden at zoom 1; `ghost.props.color === accent`; Polaris children `[circle, path, circle]` with `[1].color === textPrimary`; every ring child is `"path"`; `labels.children.length === 1`; `zIndex.value` ordering flips with yaw π; **every body root has `props.layer` with `.value`**; label `children[0]` is `skLayer` whose first child's `opacity.value` is 0 at overview and 1 at zoom 2; contact `transform.value` length 3; `prepareOrreryText` measurements and native style (Inter 600, size 14×fontScale, maxLines 1, "…") |
| `src/components/orrery/orrery-frame-mapper.test.ts` | Babel-compiles `OrreryWorld.tsx`, finds the worklet whose code contains **`projectAnimatedFrame`**, and maps each closure capture name to a fixed `available` list: `switchRuntime, sampleSwitchChoreography, sampleOrrerySwitchCamera, pose, level, viewport, scene, satellites, camera, reorder, previewReorder, deriveSatelliteBodies, semanticLevel, projectAnimatedFrame`. **A new capture throws "Unhandled compiled capture".** It asserts the captures **do not include `camera`** (feedback-loop guard: the frame must read `camera.reorder` via the `reorder` alias, never the controller that holds `camera.frame`). Under the real Reanimated mapper registry it asserts projection runs once and then settles (no self-retrigger), and recomputes exactly once per progress change |
| `src/components/orrery/orrery-worklet-order.test.ts` | TS-checker scan of **every** non-test `src/logic/orrery-*.ts` and `src/components/orrery/*.ts(x)`: a worklet calling a same-file worklet declared later fails (Hermes forward-ref crash). New renderer helper files are scanned automatically |
| `src/components/orrery/orrery-worklet-boundary.test.ts` | `use-orrery-camera.ts` cleanup resets samples/live/input/reorder/frame and calls stop |
| `src/components/orrery/orrery-switch-runtime.test.ts` | runtime start/retarget/pause-resume byte-stability; reduced-motion direct path; RG-027 compaction and resource cardinality (`nextOrreryResources`/`pruneOrreryResources`) |
| `src/logic/orrery-frame.test.ts` | one sample feeds rings/bodies/hits; inert departures; equal-depth source order; culling keeps hit membership; `spinSwitchWorld` zero-intensity identity |
| `src/logic/orrery-switch-choreography.test.ts` | stage math, no reversal, retained continuity, turnover-scaled spin, deterministic stagger, retarget, RM crossfade only, settle |
| `src/logic/orrery-camera-logic.test.ts`, `orrery-label-logic.test.ts`, `orrery-satellite-logic.test.ts`, `orrery-recovery-logic.test.ts`, `orrery-ring-logic.test.ts`, `orrery-focus-logic.test.ts`, `orrery-reorder-logic.test.ts`, `orrery-gesture-logic.test.ts`, `orrery-world-logic.test.ts` | pure semantics. Untouched if the renderer reads but does not change logic |
| `src/services/orrery-scene.test.ts` | imports `createOrreryGestures` **from `@/components/orrery/OrreryWorld`** with `@shopify/react-native-skia` mocked as `{}`, `OrbitBody`/`SunBody`/`OrreryCanvas` mocked `{}`. **Any new module imported by `OrreryWorld.tsx` that touches `Skia.*` at module scope, or imports an unmocked native module, breaks this suite.** Keep Skia access inside components/hooks, or add mocks |
| `src/screens/orrery-screen-framing.test.ts` | mocks `OrreryWorld` (`:268`); unaffected by internals |
| `src/theme/accent-foreground-role-contract.test.ts` | §5.5 |
| `src/theme/art-treatment-scope-contract.test.ts` | no art-treatment usage in Orrery files |
| `src/theme/use-reduced-motion.test.ts` | controller seed/listen/dispose |

Gates per Lab rules: `npx tsc --noEmit`, `npm run check:colors`, `npx vitest run src/components/orrery src/logic/orrery-*`
(plus `src/services/orrery-scene.test.ts` and `src/theme` when touched).

---

## 7. Hit testing and gestures — what is coupled to rendering geometry

| Consumer | Reads from `frame` | File |
|---|---|---|
| Tap → intent | `resolveSatelliteTap(frame, x, y, identities, allocations.value.map(id), members)` → contacts: `interactive`, non-satellite, `id>0`, `hypot ≤ max(22, hitRadius)`; ≥2 → `group`; 1 + **label allocated** → `profile`; else `focus`; moons similar | `OrreryWorld.tsx:442-452`; `orrery-satellite-logic.ts:88-149`; `orrery-focus-logic.ts:46-93` |
| Polaris tap | `polarisProjection` + 22 px, never over a body hit | `orrery-recovery-logic.ts:128-156`; `OrreryWorld.tsx:453-458` |
| Reorder capture/move | `collectHitCandidates` (exactly 1), moon-overlap veto, `ringRadius/zoom` for slot radii, `tryUnprojectToWorldPlane` | `orrery-reorder-logic.ts:30-105`; gestures `use-orrery-camera.ts:434-530` |
| Focus lost | `focusEffectivelyOffscreen` (`hitRadius + 44` beyond usable rect); satellite variant | `OrreryWorld.tsx:476-516`; `orrery-focus-logic.ts:119-142` |
| Label allocation | `visible && interactive`, `x, y, radius`, `opacity` | `OrreryWorld.tsx:363-393` |
| Camera gestures | `frame.value.viewport` for pan/pinch/tilt steps | `use-orrery-camera.ts:269-426` |
| Framing | `frameBodies` uses world radii plus `MIN_HIT_RADIUS` | `OrreryScreen.tsx:709` |

Rules for the renderer:

1. Do not change `radius`, `hitRadius`, `x/y`, `opacity`, `interactive`, `visible` or `ringRadius` semantics in the frame.
   Draw visuals from them.
2. If the drawn disc gets bigger than `radius`, the extra is not tappable beyond `max(22, radius)`. If it gets smaller,
   taps still land on the old radius. Keep drawn disc ≈ `radius` (glows outside are fine).
3. Culling `visible` uses reach `1.3r` (contacts) / `2r` (sun). A halo larger than that will **pop** at viewport edges,
   because `billboardPose` sets opacity 0 when not visible. Either keep halos within the reach, draw halos from `opacity`
   rather than the `visible`-gated billboard, or change the reach constant in `orrery-frame.ts:143/180`. Changing the reach
   alters label candidacy (labels require `visible`), which is a semantics change. Prefer the first two options.
4. Labels must be drawn exactly where `allocations` says, with allocated opacity. Visual label changes (plates, glow, type)
   are fine. Changing label `width/height` changes allocation and therefore Profile-vs-Focus.
5. Gestures are screen-space through `GestureDetector` on the Canvas (`OrreryCanvas.tsx:142`). Overlay HUD views are
   separate RN views. Adding Skia-drawn HUD (e.g. a compass) must not intercept taps. The canvas has a single detector.

---

## 8. Skia 2.6.2 capability inventory (verified in `node_modules/@shopify/react-native-skia/src`)

All of the following are exported from `@shopify/react-native-skia` (`src/index.ts` re-exports renderer, skia, external,
animation). Any prop accepts a Reanimated SharedValue/DerivedValue (`AnimatedProp<T> = T | {value:T}`,
`renderer/processors/Animations/Animations.ts:1-9`).

### 8.1 RuntimeEffect shader with animated uniforms

- API: `Skia.RuntimeEffect.Make(sksl): SkRuntimeEffect | null`. It returns null on compile error and logs
  (`skia/types/RuntimeEffect/RuntimeEffectFactory.ts`).
- Component: `<Shader source uniforms>` (`renderer/components/shaders/Shader.tsx`). Child shaders become `uniform shader`
  inputs (`makeShaderWithChildren`).
- Image-filter form: `<RuntimeShader source uniforms>` (`imageFilters/RuntimeShader.tsx`). It samples the layer content as
  `uniform shader image`.
- Uniforms are resolved **by name** each draw via `processUniforms` (`skia/types/Shader/Shader.ts:41-61`). A declared
  uniform missing from the object **throws**.
- Every frame with a changed uniform builds a new `SkShader` (`sksg/Recorder/commands/Shaders.ts:37-51`). That is cheap,
  but it is still a full-scene re-record/redraw.
- Android: Ganesh GL compiles SkSL to GLSL. This is supported; it is the standard RN-Skia Android path.

```tsx
const NEBULA = `
uniform float2 uSize; uniform float uTime; uniform half4 uTintA; uniform half4 uTintB; uniform float uAlpha;
half4 main(float2 p) {
  float2 q = p / uSize.y;
  float n = sin(q.x*3.1 + uTime*0.05) * cos(q.y*2.3 - uTime*0.03) * 0.5 + 0.5;   // math only, no colour literals
  half4 c = mix(uTintA, uTintB, half(n));
  return half4(c.rgb * c.a, c.a) * half(uAlpha);                                   // premultiplied
}`;
// inside a component rendered within OrreryCanvas (not module scope: tests mock Skia as {}):
const effect = useMemo(() => Skia.RuntimeEffect.Make(NEBULA), []);
const tintA = useMemo(() => Array.from(Skia.Color(colors.surfaceElevated)), [colors]);
const tintB = useMemo(() => Array.from(Skia.Color(colors.starPalette[3])), [colors]);
const clock = useOrreryClock(); const reduced = useReducedMotionShared();
const uniforms = useDerivedValue(() => ({
  uSize: [width, height], uTime: !clock || reduced.value ? 0 : clock.value / 1000,
  uTintA: tintA, uTintB: tintB, uAlpha: 0.6,
}));
return effect ? <Fill><Shader source={effect} uniforms={uniforms} /></Fill> : null;
```

### 8.2 Noise

`<FractalNoise freqX freqY octaves seed? tileWidth? tileHeight?>` and `<Turbulence …>` (`shaders/FractalNoise.tsx`,
`Turbulence.tsx`; `Skia.Shader.MakeFractalNoise/MakeTurbulence`). Both are Perlin and produce a static pattern. Animate
via the shader `transform` (TransformProps) for drift, not by changing the seed. Typically composed with
`<Blend mode=…>` / `<ColorMatrix>` or used as a `uniform shader` child of a RuntimeEffect.

```tsx
<Rect x={0} y={0} width={w} height={h} opacity={0.25}>
  <Blend mode="multiply"><FractalNoise freqX={0.004} freqY={0.004} octaves={4} /><Color color={colors.starPalette[3]} /></Blend>
</Rect>
```

### 8.3 Gradients (cheapest glows)

`<RadialGradient c r colors positions? mode?>`, `<SweepGradient c start? end? colors>`, `<LinearGradient start end colors>`,
`<TwoPointConicalGradient>` (`dom/types/Shaders.ts:56-84`). Colours accept token strings. For alpha falloff, use token
colours plus the Group/Paint `opacity`, or a RuntimeEffect.

```tsx
<Circle cx={0} cy={0} r={glowR}><RadialGradient c={vec(0,0)} r={glowR} colors={[glowColor, colors.background]} /></Circle>
```

A transparent end-stop needs alpha. The colour gate bans `"transparent"`, so mix by opacity or derive alpha in SkSL.

### 8.4 Blur / glow filters

- Mask filter (cheap, per draw): `<BlurMask blur={6} style="normal"|"solid"|"outer"|"inner" respectCTM>`
  (`maskFilters/Blur.tsx`). Good for halos on circles.
- Image filters (force a layer): `<Blur blur mode>`, `<Shadow dx dy blur color inner? shadowOnly?>` (DropShadow),
  `<Morphology>`, `<Offset>`, `<DisplacementMap>`, `<RuntimeShader>`.
- Backdrop: `<BackdropBlur blur clip>` / `<BackdropFilter filter clip>` (`renderer/components/backdrop`). This is the most
  expensive (reads the framebuffer). Avoid per body.
- Factory: `Skia.ImageFilter.MakeBlur/MakeDropShadow/MakeRuntimeShader/MakePicture/MakeCompose…`
  (`skia/types/ImageFilter/ImageFilterFactory.ts:29-405`).

### 8.5 Blend modes

`BlendMode` enum (`skia/types/Paint/BlendMode.ts:28-64`): Clear…Plus, Modulate, Screen, Overlay, Darken, Lighten,
ColorDodge, …, Multiply, Hue…Luminosity. It also has `PlusDarker = 1001` and `PlusLighter = 1002`. These two are RN-Skia
custom values. **Avoid them on Android unless verified; prefer `"plus"`, `"screen"`, `"lighten"`.**

Usage: `blendMode="screen"` on any drawing/Group paint (`PaintProps.blendMode`, `dom/types/Common.ts:82`), `<Blend mode>`
for shader composition, `colorBlendMode` on Atlas. Additive modes on light palettes wash out, so switch by resolved mode.

### 8.6 Picture caching

- `createPicture(cb: (canvas: SkCanvas)=>void, rect?)` is a **worklet** (`skia/core/Picture.ts:11-24`).
- `<Picture picture={…}>` (`renderer/components/Picture.tsx`).
- `drawAsPicture(element, bounds)` is async, JS thread, renders a React Skia element tree (`renderer/Offscreen.tsx:16-27`).

Static layers (starfield, nebula base, ring textures) can be recorded once (`useMemo`) and replayed. A dynamic option is a
per-frame `useDerivedValue(() => createPicture(c => {...imperative draws...}))`. That gives one GPU draw list per frame and
avoids N React nodes and N saveLayers, but it loses per-node zIndex batching (you sort yourself) and the render-test
structure (§6.2).

```tsx
const starPic = useMemo(() => createPicture((c) => { const p = Skia.Paint(); for (const s of stars) { p.setColor(Skia.Color(s.color)); p.setAlphaf(s.base); c.drawCircle(s.x, s.y, s.r, p); } }, { width, height }), [stars, width, height]);
<Group opacity={twinkle}><Picture picture={starPic} /></Group>
```

### 8.7 Atlas (sprite batching)

- `<Atlas image sprites: SkRect[] transforms: SkRSXform[] colors? colorBlendMode? sampling?>`
  (`dom/types/Drawings.ts:67-74`).
- Buffers: `useRSXformBuffer(n, (xf, i) => { 'worklet'; xf.set(scos, ssin, tx, ty) })`, also `useRectBuffer`,
  `usePointBuffer`, `useColorBuffer` (`external/reanimated/buffers.ts:45-58`). These run a Reanimated mapper and stop it on
  unmount.
- `Skia.RSXform(scos, ssin, tx, ty)`.

Good for hundreds of identical glow/star/particle sprites in one draw. The sprite texture comes from §8.8.

```tsx
const xforms = useRSXformBuffer(N, (xf, i) => { 'worklet'; const b = frame.value.bodies[i]; const s = b ? b.radius*3/64 : 0; xf.set(s, 0, (b?.x ?? -999) - 32*s, (b?.y ?? -999) - 32*s); });
<Atlas image={glowTexture} sprites={sprites /* N × rect(0,0,64,64) */} transforms={xforms} />
```

### 8.8 Offscreen snapshot → image / texture

- `Skia.Surface.MakeOffscreen(w, h, opts?)` creates a GPU surface (`skia/types/Surface/SurfaceFactory.ts:30-34`).
  `Skia.Surface.Make` creates a CPU raster surface.
- `surface.getCanvas()`, `flush()`, `makeImageSnapshot(bounds?)`, `image.makeNonTextureImage()`.
- Hooks (`external/reanimated/textures.tsx`):
  - `useTexture(element, {width, height}, deps?)` gives `SharedValue<SkImage|null>`. It draws the element as a picture on
    JS, then rasterizes on the **UI thread** with `MakeOffscreen`.
  - `usePictureAsTexture(picture, size)`.
  - `useImageAsTexture(source)`.
  - `drawAsImage(element, size)` / `drawAsImageFromPicture` (`renderer/Offscreen.tsx:29-47`) return a non-texture image.
- Caveat in `sksg/Recorder/ReanimatedRecorder.ts:36-38`: "the recorder only works if GPU resources (e.g. Images) are owned
  by the main thread. It will crash otherwise on Ganesh (iOS/Android)". Create GPU textures on the UI thread via the hooks
  above. Use `makeNonTextureImage()` for cross-thread use.

```tsx
const glowTexture = useTexture(<Circle cx={32} cy={32} r={32}><RadialGradient c={vec(32,32)} r={32} colors={[colors.textPrimary, colors.background]} /></Circle>, { width: 64, height: 64 }, [colors]);
```

### 8.9 Other useful primitives

- `<Points points mode="points"|"lines"|"polygon">` draws a starfield in one call.
- `<Vertices vertices textures? colors? indices? mode blendMode?>` builds custom meshes (e.g. an orbit "ribbon" with
  per-vertex alpha for a depth fade). Note `VerticesProps.colors?: string[]`.
- `<ImageShader image fit rect tx ty>` as a Circle child gives a circular photo **without a clip layer**: a cheaper
  alternative to `clip` + `Image`.
- `<Group matrix={number[9]}>` / `transform` with `perspective`, `rotateX` and Matrix4 (`processTransform3d`) support §2.5.
- `<Mask>`, `<Paint>` layers, `ColorMatrix`, `Lerp`, `BlendColor` colour filters.
- Path effects: `DashPathEffect` (used), `CornerPathEffect`, `DiscretePathEffect`, `Path1DPathEffect`, `Line2D`, `Path2D`,
  `Sum`.
- `Skia.ParagraphBuilder` (used).
- `<Canvas debug>` shows the FPS overlay for device perf checks.
- `opaque` switches Android to `SkiaSurfaceView` (`android/.../SkiaBaseView.java:21-42`). Deprecated on Fabric; layering
  implications. Probably leave it off.

---

## 9. Risk list (top 10) with mitigations

| # | Risk | Mitigation |
|---|---|---|
| 1 | **Visual geometry desyncs taps/labels.** Drawing bodies at an enlarged or different radius, or deriving visuals from a second projection, makes taps miss or labels overlap. | Read only from `frame`. Keep the disc at `radius`. Put halos outside it. If the homography (§2.5) is used, build it from `frame.value.pose/viewport` and unit-test it against `projectWorldPoint` |
| 2 | **Profile-vs-Focus drift via labels.** Restyling labels (size, plates, hidden at overview, fade logic) changes `allocations`, which changes the `profile` intent. | Keep the `prepareOrreryText` metrics or re-measure through it. Render exactly the allocated set. Never show unallocated names as decoration |
| 3 | **Frame worklet closure change breaks `orrery-frame-mapper.test` or creates a feedback loop.** | Do not add captures to the `projectAnimatedFrame` worklet. Never capture `camera`. Put renderer extras in separate `useDerivedValue`s. If the frame must change, update the test's `available` list deliberately and keep "settles after publication" green |
| 4 | **Render-test structure / Skia mock breakage.** New components or a restructured clip Group, `layer` removal, etc. | Plan the tree, then update `orrery-render.test.tsx` deliberately: add mocks for new Skia exports and keep semantic assertions (moon colour token, zIndex flip, label alpha by level, accent ghost). Never module-scope `Skia.*` calls (also breaks `orrery-scene.test.ts`, where Skia = `{}`) |
| 5 | **New ambient motion violates the clock/RM contract or ADR-077.** E.g. a second `useClock`, a `withRepeat` loop, a timer, a non-gated shader time. | Single clock via `useOrreryClock()`. Every time-based uniform is `reduced.value ? const : clock`. No `useClock`, `useFrameCallback`, `withRepeat` or `setInterval` elsewhere. Record new ambient motion as an owner decision in HARVEST/RECOMMENDATIONS |
| 6 | **Always-redraw cost/battery.** Any clock-driven value redraws the whole scene each frame. Heavy shaders, blurs and per-body layers multiply that cost. | Cache static layers as Picture/texture. Keep animated shaders full-screen-cheap (few ALU ops, no loops/octaves). Drop per-body `saveLayer` (fold alpha into paint/shader colour). Measure on the physical phone with `debug` FPS + `gfxinfo` (UI/RenderThread) and state which thread |
| 7 | **zIndex batch broken.** Inserting a non-Group draw (e.g. a shadow Path) between body Groups splits the sort (`Player.ts:90-110`), so sun/contact occlusion goes wrong under tilt. | Keep every body (and its glow) inside its own root Group with `zIndex`. Batch-level layers go before or after the bodies Group. Or move to an explicitly depth-sorted imperative Picture/Atlas and update tests |
| 8 | **Status semantics eroded by "game" styling.** Status hue drowned by lighting, dash/fade lost, neutral resembling stable, rogue cold body lost, decay ring removed, status-specific motion. | Keep `orreryRingStyle` as the only status mapping. Preserve line-treatment differences at every zoom. Test light and dark for all four palettes. No per-status animation (HANDOFF REJECTED) |
| 9 | **Colour policy violations hidden in SkSL / light-mode breakage.** | Pass every hue as a token uniform. Avoid `…rgb(`/`hsl(` names and `#` in comments. Verify all four palettes on device. Make blend choices mode-aware. Run `npm run check:colors` and the accent role contract |
| 10 | **Resource/lifecycle regressions.** Textures/pictures/effects created per render, never disposed, or held across unmount. Shader compile on every mount. Photos not disposed (`use-orrery-photo.ts` ownership rules). Hermes forward-ref crashes in new worklet helpers. | `useMemo` effects/pictures keyed on size/colours. Rely on canvas unmount for the clock. Keep `useOrreryPhoto` as the only photo owner. Define worklet helpers above callers (`orrery-worklet-order.test` scans new files automatically). Guard `globalThis.crypto` (undefined in Hermes) |

Further secondary risks:
- Culling pop for big halos (§7.3).
- Satellite visuals implying contacts (ADR-105).
- Photos becoming non-circular or non-screen-facing.
- Labels rotating with yaw.
- Choreography visuals running when `transition.reducedMotion`.
- Breaking `interactive`-based inertness of departures.
- The `canvas` lacking a11y. The accessible path is the companion sheet; do not remove it.

---

## 10. Existing performance evidence / claims

| Source | Evidence | Status |
|---|---|---|
| `29-UAT.md:36,113-114` | Gesture jank seen on the **debug** build was "dev-mode overhead only; release is smooth (owner-confirmed on the physical Pixel)" | qualitative owner observation, no numbers |
| `29-NATIVE-CHECKLIST.md:24,124-126` | "JS/Skia frame timing on physical phone: Unmeasured", "no performance claim" | explicitly unmeasured |
| `30-12-DEVICE.md:47-69` | Pixel 6 Pro recordings of 2100 ms switch choreography (3→9, 9→3, 9→8, 3↔3 disjoint, non-Home→Home, rapid retarget, blur/background resume): "continuous per-frame movement, not React publication steps". Found and fixed the persistence-publication reset bug | visual/continuity evidence only, no frame metrics. Reduced-motion device recording **not** obtained (animator-scale automation failed) |
| `38.4-UAT.md:266` (RG-027) | Pixel 3a, **debug**, Standard Light, 20 switches All↔Not Contacted. meminfo TOTAL PSS 1,220,884→1,261,178 KB; Graphics 270,111→283,175 KB; gfxinfo (**UI/RenderThread only**) 10,803 frames, 99.94% janky, p50 57 ms, p90 77 ms, p99 1550 ms, "with the Skia orrery animating continuously and uiautomator dumps running between switches". **No performance or leak claim made** | numbers recorded, explicitly not a claim (debug + dump load) |
| `docs/systems/orrery.md:123,147-148` | frame timing/GPU behaviour unmeasured. Phase 40 owns high-count performance calibration | — |
| HANDOFF §7 | "[DECIDED] Performance is not a concern at this scale — tens of bodies, not thousands. The risk is method, not volume" | design premise |

**There is no release-build frame-time measurement of the Orrery.** Lab A should establish one baseline on the physical
phone (release build), recording target device, contact count (e.g. 10/50/150), tilt/zoom, RM on/off, `debug` FPS overlay
and `dumpsys gfxinfo <pkg> framestats` (stating UI/RenderThread only). That baseline should be taken *before* and *after*
the rewrite. Only physical-phone numbers support perf claims; the desktop emulator cannot.

Code-level hotspots, from reading (not measured):
1. `projectFrame` creates 128 ring points per contact per frame. Each `projectWorldPoint` runs `assertProjection` +
   `usableCameraRect` (obstacle rectangle subtraction + sort) (`orrery-camera-logic.ts:282-296, 116-188`). That is roughly
   `N×128×obstacles` work per camera change.
2. Per-layer `frame.value.bodies.find(b => bodyKey(b) === key)` in every ring, body, satellite and label derived value,
   with `bodyKey` string building (JSON.stringify for moons). This is O(N²) per frame.
3. Each ring allocates a new `SkPath` per frame.
4. Every body Group has `layer = Paint(alpha)`, i.e. a `saveLayer` per body per frame, even at opacity 1
   (`OrbitBody.tsx:73-77`, `SunBody.tsx:95-99`, `SatelliteBody.tsx:27-31`). The render test currently asserts this
   `layer` exists.
5. Photo discs use `clip` (rrect) per body.
6. `allocateLabels` is O(L²) with sorting per frame.
7. The ambient clock forces a full redraw every frame while RM is off (§6.1). Idle frames still replay every body layer.

---

## Appendix A — file map (rendering-relevant)

| File | Lines | Role |
|---|---|---|
| `src/screens/OrreryScreen.tsx` | 1346 | scene store, publication, lifecycle gate, camera hook, framing, mount (`:1048-1067`) |
| `src/components/orrery/OrreryWorld.tsx` | 614 | frame, labels, allocations, gestures, layer tree |
| `src/components/orrery/OrreryCanvas.tsx` | 166 | Canvas, GestureDetector, Fill, starfield, the clock |
| `src/components/orrery/orrery-clock-context.ts` | 28 | clock context |
| `src/components/orrery/OrbitBody.tsx` / `SunBody.tsx` / `SatelliteBody.tsx` | 156/209/47 | body billboards |
| `src/components/orrery/ProjectedOrbitRing.tsx` / `Polaris.tsx` / `OrreryLabel.tsx` | 50/40/116 | rings, north, labels |
| `src/components/orrery/use-orrery-switch-runtime.ts` | 421 | switch driver, resources |
| `src/components/orrery/use-orrery-camera.ts` | 532 | gestures, recovery, reorder |
| `src/components/orrery/use-orrery-photo.ts` | 502 | 512-px photo textures, disposal ownership |
| `src/components/orrery/SystemPreviewCanvas.tsx` | 212 | separate builder preview canvas (own lifecycle; not the Orrery) |
| `src/logic/orrery-camera-logic.ts` | 628 | projection, inverse, Home, framing, hit candidates |
| `src/logic/orrery-frame.ts` | 219 | AnimatedFrame, bodyKey, billboardPose, culling |
| `src/logic/orrery-switch-choreography.ts` | 507 | stages and sampling |
| `src/logic/orrery-label-logic.ts` | 209 | levels, allocation, context |
| `src/logic/orrery-ring-logic.ts` | 105 | status → ring/body style |
| `src/logic/orrery-world-logic.ts` | 150 | world placement/mass |
| `src/logic/orrery-satellite-logic.ts` / `orrery-focus-logic.ts` / `orrery-reorder-logic.ts` / `orrery-recovery-logic.ts` / `orrery-gesture-logic.ts` / `orrery-geometry-logic.ts` | — | interaction semantics/constants |
| `src/logic/sun-occupant-logic.ts` | 155 | sun occupant and glow colour |
| `src/services/orrery-scene.ts` | 406 | scene snapshot |
| `src/theme/theme-types.ts`, `theme-presets.ts`, `use-reduced-motion.ts`, `tokens/{typography,radii,spacing,motion}.ts` | — | tokens, RM |
| `scripts/check-colors.sh` | 64 | colour gate |
