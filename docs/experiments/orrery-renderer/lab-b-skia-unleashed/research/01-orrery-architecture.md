# Lab B research 01: Orrery architecture as of HEAD `34920925`

**Scope:** a read-only survey of the production Orrery on `experiment/orrery-skia-unleashed`. Line numbers refer to HEAD `34920925`. Some working-tree edits appeared during this survey, such as the lab marker added to `OrreryScreen.tsx` after line 1307. Line references at or before that point are unaffected.

**Sources read in full:** the experiment contract, `CLAUDE.md`, and HANDOFF §7 (the orrery mechanics and rendering decisions). Also `docs/systems/orrery.md`, `docs/runbooks/orrery-visual-layer.md`, ADR-046/047/048/077/085/104/105/106/114/149/170 (their decision sections) and the Phase-08 camera dossier. On the code side: `OrreryScreen.tsx` and every renderer, camera, logic and runtime file under `src/components/orrery/` and `src/logic/orrery-*`, plus `src/services/orrery-scene.ts`. The photo hook header, test names and the key test bodies were also read, as were the device evidence in Phase 29/30/38.4 (`29-UAT`, `29-NATIVE-CHECKLIST`, `30-12-DEVICE`, `38.4-UAT`).

**One correction to the brief:** there are no Gravity, Frequency or Systems *layout modes*. ADR-077 removed the old Status/Relationship dual view, so there is **one canonical world**:

- **Gravity** is only a ±10% body-mass modifier, plus companion and label context (ADR-106).
- **Contact Frequency** is only a custom-System *rule family* (`system-builder-logic.ts:23`).
- **Systems** are membership filters over that single world.

All three share one layout: `deriveOrreryWorld`.

---

## 1. Data flow: DB → scene → world → frame → render

### 1.1 Read model (one coherent SQLite snapshot)

- `readOrrerySystemSnapshot(exec, system)` (`src/db/orrery-system-read.ts:323`) wraps `readOrrerySystemSnapshotCore` (`:241`) in `inReadSnapshot`. Inside one read it gathers:
  - **Settings:** density, satellites, last System, sun id, self-sun colour and `dataRevision`.
  - **Profile:** the self sun's name and photo.
  - **Sun header and status.**
  - **Categories.**
  - **Members** from `readOrrerySystemMembersCore`. These are built-in, Category-UID or custom (via `system-rule-resolver`).
  - **Gravity impact inputs** from `readOrreryImpactInputsCore`, read in chunks of 256.
  - **`orbiting`:** members minus the resolved contact sun (`:276`).
  - **Reorder fingerprints:** `completeContactedOrder`, `contactIdentities` and `eligibleContactedVisibleIds` (contacted members only, `:315`).
- **Member row shape** (`OrrerySystemMember`, `:57-67`):
  - Identity: `id` and `uid`.
  - Display: `name` and `photo` (a relative path).
  - Ordering and state: `ring_seq`, `status` (`stable|wobble|decay|rogue|null`), `progress` (from `PROGRESS_SQL`, `null` when never contacted), `last_contact`, `rarely_responds`, `favourite_rank` and `created_at`.
  - `status` and `progress` are computed at query time by `STATUS_SQL`/`PROGRESS_SQL` (`src/db/status.ts:40-59`; STABLE_MAX 0.8, WOBBLE_MAX 1.0, ROGUE_K 3).

### 1.2 Scene builder

- `loadOrreryScene(exec, generation, system)` (`src/services/orrery-scene.ts:210-257`):
  - It reads the snapshot, then throws the typed `MissingOrreryCategoryError` or `MissingOrreryCustomSystemError` when the System is gone.
  - **Outside** the mutex, `deriveSceneGeometry` (`:88-124`) does four things:
    - orders the members (`orderOrreryMembers`);
    - computes Gravity per contact (`computeContactGravity`);
    - builds the sun `WorldBody`: `id` is 0 for self or the sun contact's id, `kind:"sun"`, at the origin, radius `SUN_RADIUS`=30 × the Gravity mass factor (contact suns only), `ringRadius` 0;
    - calls `deriveOrreryWorld`.
- **`OrrerySceneSnapshot`** (`:41-60`) carries:
  - `preferences`, `generation`, `dataRevision` and `system`;
  - `systemSnapshot` (the raw read);
  - `contacts` (the ordered members);
  - `world: WorldBody[]` and `extent`;
  - `gravity: Map<id, GravityResult>`;
  - `sun {sunContactId, selfSunColour, selfPhoto, selfName, occupant, sunContactName}`.
- **Controllers:**
  - `createOrrerySceneController` (`:318`) publishes only the newest generation.
  - `createOrrerySatelliteController` (`:272`) is an independent generation that filters rows to current member parents.
  - `createOrreryIntentDispatcher` (`:350`) re-validates before any action.
- **Store:** `createOrrerySystemStore` (`src/stores/orrery-system-store.ts`) is created per screen in `OrreryScreen.tsx:257-283`.
  - Statuses: `initial | loading | ready | error | stale | missing-category`.
  - It keeps requested versus successful System identity and persistence status.

### 1.3 World layout (`src/logic/orrery-world-logic.ts`)

The world is the only layout. It is independent of the camera and stored nowhere.

- **Rank.** Members are sorted by `ring_seq ?? 1e9`, then `created_at`, then `id` (`:47-56`). The dense index *is* the ring. The ring radius is `ringInner + index*ringGap`, using `DENSITY_PRESETS` (`:21-25`):

  | Density | ringInner | ringGap |
  |---|---|---|
  | Spacious | 68 | 44 |
  | Balanced | 58 | 34 |
  | Compact | 58 | 32 |

- **Angle.** `progressToAngle(progress)` gives `frac(progress)*2π`: 0 is 12 o'clock and the angle runs clockwise (`orrery-geometry-logic.ts:256`). Never-contacted bodies sit at `NEUTRAL_RESTING_ANGLE=0` (north) and are never nudged.
- **Drift.**
  - A decaying body is pushed outward in proportion to its position in [WOBBLE_MAX, ROGUE_K), up to `DECAY_DRIFT_SPAN`=40.
  - A rogue body gets `ROGUE_DRIFT_SPAN`=80 (`:61-72`).
  - Drift is added to the body's distance from the centre but **not** to its `ringRadius`. The body sits off its rail, which is how "out of orbit" becomes literal.
- **Collision nudge.** The overlap test runs on Balanced reference geometry with 8 units of clearance. A body that overlaps gets a ±(≤1° and ≤4 world units) angle shift. The sign comes from an FNV hash of the UID (`:110-126`), so it is deterministic and the same at every density.
- **Mass.** Body radius is `PLANET_RADIUS`=16 × `gravityMassModifier`, which maps 0.9 to 1.1 across Gravity tiers (`:34-45`).
- **Output.** `{bodies, extent}`. The sun is pushed **last** (`:139`), so its world index follows every contact.

**What each world body carries** (`WorldBody`, `orrery-camera-logic.ts:38-45`):

- Always: `id` (0 means self with no Profile), `kind` (`contact|sun|satellite`), `x`, `y`, `radius` and `ringRadius`.
- Contacts also carry `angle` and `nudgeAngle`.
- Satellites carry `satelliteTarget {uid,parentId,parentUid}`.
- **Bodies carry no presentation data.** The name, photo, status, Gravity and colour are resolved at render time from `scene.contacts`, `scene.sun` and `scene.gravity`, keyed by `body.id` (`OrreryWorld.tsx:122-164`).

### 1.4 Per-frame projection (UI thread)

In the `OrreryWorld` `frame = useDerivedValue` (`OrreryWorld.tsx:222-258`), each step feeds the next:

1. **Choreography sample.** `sampleSwitchChoreography(switchRuntime.transition, progress).world` produces the bodies with `opacity` and `interactive`.
2. **Camera.** Use `pose.value` when settled; otherwise interpolate between `cameraFrom` and `cameraTo` (`sampleOrrerySwitchCamera`).
3. **Reorder preview.** `previewReorder(world, heldDrag)` swaps the radii of the selected slots.
4. **Moons.** `deriveSatelliteBodies(world, satellites, members, true, semanticLevel(zoom, level))` returns nothing at `overview`.
5. **Projection.** `projectAnimatedFrame({from: complete, to: complete}, 1, camera, viewport)` calls `projectFrame` once (`orrery-frame.ts:129-157`).
   - Each body gets its projected `x/y`, `radius*zoom*perspectiveScale`, `ringRadius*zoom` and `hitRadius = max(22, projectedRadius)`.
   - It also gets a 128-point `ringPath` (only when `ringRadius>0`) and a `depth`.
   - Each body is then flagged with `opacity`, `interactive` and `visible`. The `visible` test uses halo reach: ×2 for the sun, ×1.3 for others.
6. **Publication.** The result `AnimatedFrame` is copied into `camera.frame` (`:260-265`). Gestures, focus context and the obstacles all read the same frame.

---

## 2. Renderer structure

**Tree** (`OrreryWorld.tsx:517-612`). There is one `<Canvas>`, and **everything is individual declarative Skia components driven by shared values**. The code uses no Picture, Atlas, `useFrameCallback`, shader, RuntimeEffect, blur or shadow (grep-verified across `src/components/orrery` and `OrreryScreen.tsx`).

```
OrreryCanvas (GestureDetector > Canvas)           OrreryCanvas.tsx:141-165
  Fill(colors.background)
  Group(opacity=twinkle) > 44 × Circle            static, screen-space starfield
  OrreryClockContext.Provider
    Group(clip=viewport)                           OrreryWorld.tsx:525
      [0] Group > ProjectedOrbitRing × contact resources   (Path per ring)
      [1] Polaris                                   (Group transform > Circle+Path+Circle)
      [2] ReorderGhost                              (Path stroke, accent)
      [3] Group  ← contiguous native depth batch (do not interleave)
            ProjectedBody × resources → OrbitBody | SunBody   (each ONE root Group)
            SatelliteBody × satellite rows
      [4] Group > per label: Group > OrreryLabel (+ context OrreryLabel)
```

The render test pins this exact child order (`[rings, polaris, ghost, bodies, labels]`) and the "consecutive skGroup" batch (`orrery-render.test.tsx:244-305`).

### 2.1 Bodies

**`OrbitBody`** (`OrbitBody.tsx`):

- Its root `Group` takes `transform=[translateX, translateY, scale]` from `billboardPose`, `zIndex=depth` (Skia sibling depth sort) and `layer=Paint(alpha=opacity)`. That last prop makes **a saveLayer per body on every frame** (`:267-281, 319`).
- From the bottom up, it draws:
  - an optional focus stroke ring at `r+4` in `colors.accent`;
  - the status disc in `bodyFill`, which `orreryRingStyle` sets to the status colour, or to `rogueExtinguished` for rogue and `border` for never-contacted;
  - then **either** a clipped cover-fit photo (`SkiaImage` in an rrect clip) **or** a swatch circle plus a centred initials `Paragraph` (Inter, `fontSize = radius`, `:292-310`).
- The world radius is drawn at `cx=cy=0`. `billboardPose` scales it by `projected.radius / world.radius` (`orrery-frame.ts:203-219`), so circles stay circular under tilt ("billboarding").

**`SunBody`** (`SunBody.tsx`) uses the same root pattern. It draws:

- a pulsing halo `Circle` whose radius moves ±10% and opacity 0.35 ±40%, at `PULSE_SPEED` 0.002 rad/ms (about a 3.1 s period), driven by the context clock (`:422-491`);
- a rim at `r+2` in the glow colour;
- the photo, or a swatch plus initials.
- **Glow colour.** `resolveSunOccupant` (`src/logic/sun-occupant-logic.ts:120-155`) picks it: the self sun uses `selfSunColour ?? starPalette[0]`, and a contact sun uses its status ring colour.
- **Glow radius.** It is `body.radius*1.8`, passed from `OrreryWorld.tsx:156`.

**`SatelliteBody`** (`SatelliteBody.tsx`):

- It is a unit `Circle r=1` in `textSecondary`, scaled by the billboard (`billboardPose(frame, key, 1)`).
- The focus ring is an `accent` stroke at r=1.5.
- **Moon placement** (`orrery-satellite-logic.ts:23-83`):
  - Moons are world-space bodies placed at `parent.radius + 24` from the parent.
  - The angle comes from a deterministic UID hash.
  - The radius is `min(4, parent.radius*0.2)` and the opacity is inherited from the parent.
  - Satellites have no ring.

### 2.2 Rings

`ProjectedOrbitRing` (`ProjectedOrbitRing.tsx`) builds **a new `Skia.Path` every frame** from `ringPath` (128 projected points, so the ring is a true ellipse under tilt).

- Stroke width comes from `ringVisual`, via `orreryRingStyle` (`src/logic/orrery-ring-logic.ts:308-358`).
- Stroke style by status:

  | Status | Stroke | Opacity multiplier |
  |---|---|---|
  | stable | solid | `ringVisual` opacity |
  | wobble | dashed `DashPathEffect [6,6]` | `ringVisual` opacity |
  | decay | faded | ×0.7 |
  | rogue | faintTrace (dashed) | ×0.3 |

- Rings are drawn for **every contact resource**, with no ring culling. Depth culling only affects body media.

### 2.3 Photos

`useOrreryPhoto(relative)` (`use-orrery-photo.ts`) replaces Skia `useImage`.

- **Size cap.** Textures are capped at `ORRERY_TEXTURE_MAX`=512 px (`:79`). A master over 512 px is drawn from a lazily generated on-disk ≤512 JPEG derivative, keyed by the master's size and mtime signature (38.6 D-41).
- **Concurrency.** Derivative generation is limited to `ORRERY_DOWNSAMPLE_CONCURRENCY`=1 (`:88`).
- **Lifecycle.** Each hook owns and disposes its own `SkImage`, and only after the commit that replaced it. A disposed image still referenced by a re-record would throw (`:36-43`).
- **Hook rule.** The hook is called unconditionally, with a null-guarded source, inside each keyed body component (runbook step 4).

### 2.4 Labels and text

- **Measurement.** `prepareOrreryText` (`OrreryLabel.tsx:31-69`) runs on the React path only and builds a native `Paragraph`:
  - single line with `maxLines 1` and a "…" ellipsis, using the `TYPOGRAPHY` role, a colour token and `fontScale`;
  - measured with `getLongestLine` and `getHeight`.
  - Only the plain measurements cross to the worklet (`OrreryWorld.tsx:341-356`).
- **Allocation.** `allocateLabels` (`orrery-label-logic.ts:301-403`) runs per frame inside `allocations = useDerivedValue` (`OrreryWorld.tsx:363-393`).
  - Label candidates exist only for bodies that are both `visible` and `interactive`.
  - The anchor sits below the body, with the alternate above it.
  - The bounding boxes of every visible body are exclusions, alongside the viewport obstacles.
  - Placement is greedy in priority order: focused 0, cluster 1, favourite 2, then clean isolated 3, then everything else 4. It tries x-nudges of 0 and ±8 and the alternate y. Collisions are inclusive.
  - At the `detail` level a context caption (status, Gravity name and relation) is placed below the name, but only if the name already fit.
- **Rendering.** `OrreryLabel` draws a `RoundedRect` backplate in `colors.surface` (`RADII.sm`) plus the `Paragraph`, inside a `layer` Paint opacity group (a saveLayer).
- **Initials.** `orreryInitials` takes the first grapheme cluster of the first two words (`orrery-label-logic.ts:240-250`).

### 2.5 Semantic zoom

| Level | Enter | Exit (hysteresis) | Effect |
|---|---|---|---|
| overview | default | — | Only focused or cluster labels show. Moons are hidden. |
| identity | zoom ≥ 2 (`IDENTITY_ZOOM`) | below 1.85 | Names are allocated. Moons show. |
| detail | zoom ≥ 3 | below 2.8 | Context captions show. |

Source: `orrery-label-logic.ts:229-265`. The current level lives in `level` (a SharedValue, `OrreryWorld.tsx:219, 357-362`).

### 2.6 Focus state

- **React state.** `focusTargets` and `focusedSatellite` live in `OrreryScreen.tsx:244-251`. They are passed down as `focusedIds`, `clusterIds` and `focusedSatellite`.
- **Visual cues.** Focus draws an accent stroke ring and label priority 0. The floating `OrreryFocusContext` panel follows the body on the UI thread through `useAnimatedStyle` over `camera.frame` (`OrreryFocusContext.tsx:212-241`).
- **Focus loss.**
  - When a focused body moves more than its hit radius plus 44 off the usable rect, two `useAnimatedReaction`s call `onFocusLost` (`OrreryWorld.tsx:476-516`, `focusEffectivelyOffscreen` at `orrery-focus-logic.ts:119-142`).
  - `onFocusLost` is suppressed while the cluster panel is open (`OrreryScreen.tsx:1064`).

---

## 3. Animation model

**Ambient clock.**

- The ambient clock is a single `useClock()` owned by `OrreryCanvas` (`OrreryCanvas.tsx:101`). It reaches `SunBody` through `OrreryClockContext` (`orrery-clock-context.ts`), and nothing else calls `useClock` (ADR-048/077, M5).
- **Clock consumers:**
  - Star twinkle animates one Group opacity between 0.18 and 0.55 at 0.0024 rad/ms (about a 2.6 s period, `:56-117`).
  - The sun halo pulses as described in §2.1.
- **Continuous redraw.** While mounted, the clock forces a canvas re-record and redraw every display frame, so every body's saveLayer is repainted continuously. Device note RG-027 records "Skia orrery animating continuously".
- **Everything else is event-driven** through Reanimated derived values:
  - `frame` recomputes whenever `pose`, `switchRuntime.progress`/`transition`/`cameraFrom`/`cameraTo`, `camera.reorder` or `level` change;
  - `allocations` recompute whenever `frame` does;
  - each body, ring and label derives its own pose from `frame`.
- **Discrete changes only touch React state.** Scene, focus, resources and satellites are React state. The runbook (step 5) and `CLAUDE.md` forbid per-frame `setState`.

**Lookup costs.** Each per-body and per-ring derived value does `frame.value.bodies.find(bodyKey(b) === key)`, which is O(N) per consumer and **O(N²) per frame**. `bodyKey` runs `JSON.stringify` for satellites. Each projection call also re-runs `usableCameraRect` over the obstacle list (`projectWorldPoint` → `projectionCenter`, `orrery-camera-logic.ts:183-188, 282-296`), so one frame does about N×129 obstacle-aware projections.

**Camera motion** (`orrery-recovery-logic.ts`; `use-orrery-camera.ts:95-129`).

- **Recovery** (Recenter, focus framing, north, session restore):
  - `withTiming` on `pose` with `recoveryCurve`, which is `1-(1-t)^5`.
  - Duration is 180–850 ms and distance-adaptive.
  - Reduced Motion uses 100 ms with linear easing.
- **Coast.** Pan and yaw get 120 ms of coast, capped at 18 pt and 0.08 rad. Zoom and tilt never coast.
- **Cancellation.** An `epoch` invalidates stale completions.

**Pausing and unmounting.**

- The canvas is mounted only when `visible && sessionReady && scene` (`OrreryScreen.tsx:1048`). `visible` requires a valid usable measurement, `useIsFocused()` and `AppState === active` (`:609-610`). Unmounting `OrreryCanvas` is what stops the clock: hiding a derived value does not stop it (runbook pitfall 1).
- **On blur or background:**
  - the switch runtime is paused (`pauseSwitch`, `:416-425, 438-446`);
  - the camera animation is cancelled (`cancelAnimation(pose)`);
  - intents and the store reload are cancelled;
  - on Profile departure or background, the session pose is captured once (`captureSession`, `:622-652`).
- `useOrreryCamera`'s enable/cleanup effect resets the samples, input, reorder and frame on the UI thread (`use-orrery-camera.ts:137-160`). The worklet-boundary test pins this.
- The switch runtime lives **above** the conditional canvas, in the screen, so a remount resumes from the exact displayed sample (`use-orrery-switch-runtime.ts:341-360`; `:612-613` in the screen).

**Reduced motion** (ADR-085).

- `useReducedMotionShared()` (`src/theme/use-reduced-motion.ts:106`) is a live `AccessibilityInfo` SharedValue. Every ambient consumer reads it **inside** its worklet: the twinkle collapses to the constant 0.365, and the sun pulse to the static glow.
- Camera recovery becomes short and linear, and coasting is disabled.
- The switch choreography uses its reduced path (§5).
- A live toggle mid-switch rebases onto the reduced path from the displayed sample (`use-orrery-switch-runtime.ts:362-389`).
- Animation durations use `ReduceMotion.Never` so that Reanimated's boot-time flag does not override the Orbit-owned logic.

---

## 4. Camera and gestures

**Camera model** (`orrery-camera-logic.ts`). This is a 2.5D tilted-plane perspective camera.

- **Pose:** `{x, y, zoom, tilt, yaw, focalDistance}`. `HOME_CAMERA` is `{0,0,1,0,0,256}`.
- **Limits:** zoom 0.25–4 and tilt 0–π/3. Pan is clamped to ±extent. The focal distance is derived from the extent (`:60-77, 91-100, 235-250`).
- **Projection.** It applies yaw, then perspective: `focal/(focal − y·sin tilt)`, scaled by zoom, with y compressed by cos(tilt) (`:282-296`).
- **Inverse.** `unprojectToWorldPlane` (`:303-325`) inverts it exactly; tests pin the round trip to within 1e-6.
- **Depth** = `planeY·sin(tilt)` (`:534`), which feeds `zIndex`.
- **Home pose.** `deriveHomePose` fits the whole extent to the usable rect but never zooms below `MIN_READABLE_RADIUS`(10)/minRadius, so large Systems run off-screen instead of shrinking (`:254-280`).
- **`frameBodies`.** A 36-step binary search over zoom with 32 recentring iterations, which honours `MIN_HIT_RADIUS`. It is used for focus, cluster focus and session framing (`:363-456`).
- **Usable rect.** `usableCameraRect` subtracts the measured obstacles (shell tabs, FAB, controls, cluster panel and feedback) and keeps the largest free rectangle (`:116-182`; obstacles from `orrery-obstacle-logic.ts:290-309`).

**Gesture stack** (`use-orrery-camera.ts:170-532`): `Race(Tap, Race(Hold, Simultaneous(Pan, Pinch, Rotation, TiltPan)))`.

| Gesture | Recognizer | Behaviour |
|---|---|---|
| Tap | `maxDistance` 8 | Calls `onNorth` first: a Polaris hit within 22 px that no body claims resets yaw only. Otherwise calls `resolveTap` (satellite-aware). |
| Pan | `minDistance` 10, 1 pointer | Pans through `cameraGestureStep`. The pan is applied through inverse projection, so the world point under the finger tracks the finger. |
| Pinch | — | Zoom anchored at the focal world point (`anchorCameraPose`). |
| Rotation | — | Yaw. |
| Tilt | 2-pointer pan, `manualActivation` | Activates only after 28 pt of centroid vertical travel. Applies 0.004 rad per point. |
| Hold (reorder) | `activateAfterLongPress(850)` | Captures only a single, unambiguous, contacted body, with 8 pt of slop. |

- **Input ownership.** The owner moves through `idle|pending|pan|multi|reorder|cancelled` (`orrery-gesture-logic.ts`). A second pointer cancels reorder.
- **Tap semantics.** `resolveOrreryTap` (`orrery-focus-logic.ts:46-93`) collects every interactive non-satellite body whose `max(22, hitRadius)` disc contains the tap. Depth never picks a winner.
  - 0 hits: `clear`.
  - More than 1 hit: `group` (cluster focus).
  - 1 hit **whose label is currently allocated** (`visibleNames` = `allocations.value` ids, `OrreryWorld.tsx:442-452`): `profile`. Otherwise: `focus`.
  - **So label visibility decides whether a tap opens Profile or focuses the contact.** This is a renderer-coupled product semantic. The older `tapIntent` in `orrery-camera-logic.ts:570-591`, which uses a zoom-based rule, is now only a test fallback.
- **Satellite taps.** `resolveSatelliteTap` (`orrery-satellite-logic.ts:88-149`) handles moons. A lone moon gives a `satellite` intent. A moon mixed with contacts gives a `group` of contacts that uses the moons' parent rows.
- **Intent dispatch.**
  - Discrete intents leave the UI thread through `runOnJS(send)`.
  - `OrreryScreen.onIntent` (`:766-821`) passes them to `createOrreryFocusController` (`orrery-focus-logic.ts:152-217`). The controller does a fresh SQL validation per target (`readOrreryContactTargetValidation`) and checks generation and System around each await.
  - The outcome is then `focus` (framing via `frameBodies`, with zoom capped at `IDENTITY_ZOOM` for a single target, `:695-720`), `group` (cluster panel, framed once measured), or `openProfile` (capture the session, then navigate).
- **Reorder** (`orrery-reorder-logic.ts`).
  - The hold captures the radii of the eligible visible slots, the body's drift and the pointer offset in **world** coordinates.
  - Moving the finger maps its unprojected radius to the nearest slot (`computeRingReorder`).
  - `previewReorder` swaps ring radii inside the frame, which moves the body and its ring.
  - `ReorderGhost` strokes the held body's ring plus a circle at `r+4`.
  - On release, a `ReorderIntent` goes to `OrreryScreen.onReorder` (`:659-690`), then to `commitRingReorder`, which runs under the write lock with full fingerprint validation. A haptic fires on activation (`Haptics.selectionAsync`, `:118-120`).

---

## 5. System switching choreography

**Driver** (`use-orrery-switch-runtime.ts`):

- **Normal mode.** `NORMAL_SWITCH_DURATION_MS`=2100 and `REDUCED_SWITCH_DURATION_MS`=180 (`:25-26`).
- **Shared values.** It owns `transition: SwitchChoreography`, `progress` (0→1 via `withTiming`), `cameraFrom`/`cameraTo` (smoothstep camera interpolation, `:60-86`) and `running`. It also keeps the React `resources` list.
- **`publish(scene, isSwitch, intensity, destinationHome)`** (`:283-339`):
  - A non-switch publish rebuilds a settled identity choreography.
  - A switch publish samples the **currently displayed** world and camera, calls `beginSwitchChoreography(displayed, destination, ...)` and restarts the driver. This is how re-targeting continues from the displayed sample.
- **`finish`** (`:251-263`) is generation-checked. It sets `pose = cameraTo`, compacts the transition with `settleSwitchChoreography` (RG-027/ADR-170) and prunes resources on the JS side.
- **Pause and resume** cancel or restart the timing with the remaining fraction (`:341-360`).

**Trigger** (`OrreryScreen.tsx:305-354`):

- The screen subscribes to the System store and filters through `shouldPublishSwitchScene` (status, generation or snapshot identity). This avoids the persistence-publish reset bug that `30-12-DEVICE.md` describes.
- A `loading` transition that follows a `ready` one on a different System records `switchSourceIds`.
- On `ready`, the intensity is `switchIntensity(computeMembershipDelta(src, dst))`, which is (entering+leaving)/(entering+leaving+2·overlap), in [0,1] (`orrery-switch-animation.ts:543-572`).
- The destination is the new System's `deriveHomePose`.
- Focus survives the switch only when both Systems contain the focused contact (`preservedFocus`).
- `forceSwitchHome` stops the Home-framing effect from snapping the first frame (`:937-951`).

**Choreography** (`src/logic/orrery-switch-choreography.ts`):

- **Roles,** keyed by `bodyKey` (`kind:id`; satellites by parent and uid). These are `retained`, `leaving` and `entering`, plus `anchor` for the sun and anything else that is not a contact.
- **Phases** (`:4-13`):

  | Phase | Progress | Motion |
  |---|---|---|
  | accelerate | 0–0.20 | Spin ramps up. |
  | shed | 0.18–0.58 | Leaving bodies peel outward by `radialDisplacement` while shrinking to 75% and fading. |
  | capture | 0.44–0.82 | Entering bodies spiral in from `radialDisplacement` outward while growing from 75% and fading in. |
  | settle | from 0.72 | Spin decelerates. |

- **Timing and gating.** Each contact gets a stagger of up to 0.035 from a UID hash. Entering bodies become interactive at `INTERACTION_READY_PROGRESS`=0.82. Leaving bodies are inert immediately.
- **Retained bodies** rotate forward by the angular difference plus `spinTurns` full turns, while their radius, size and opacity smoothstep to the destination (`sampleRetained`, `:259-284`).
- **Spin profile.** The angular velocity profile is a cubic ramp-in, then constant, then quadratic ease-out. Its integral is normalised (`:161-199`).
- **Intensity mapping:**
  - spinTurns = 1 + round(intensity×2), giving 1 to 3 turns, and 0 when intensity is 0;
  - radialDisplacement = 52 + 118×intensity.
- **Reduced Motion** (`sampleReduced`, `:231-257`): a smoothstep position and opacity crossfade with no rotation and no radial displacement.
- **Re-target:** `retargetSwitchChoreography` (`:493-507`).
- `orrery-frame.ts:108-128` contains an unused `spinSwitchWorld` helper, kept from Phase 30 and test-only.
- **Device evidence.** Tuned on a physical Pixel with 3- to 9-contact fixtures. Recordings were at `/tmp/orbit-30-12-evidence/*.mp4`, which are ephemeral (`30-12-DEVICE.md:57-86`).

---

## 6. Theme integration

- **Delivery.** Colours arrive as a resolved `ThemePalette` (`useTheme().colors`, `OrreryScreen.tsx:148`), which is passed into `OrreryWorld` and then into each component as plain strings. **No colour literals:** `scripts/check-colors.sh` fails any hex, `rgb()`, `hsl()` or quoted named colour outside `src/**/theme/**`.
- **Tokens the Orrery uses:**

  | Token | Used for |
  |---|---|
  | `background` | Canvas fill and screen root |
  | `textSecondary`, `textPrimary`, `starPalette[]` | Stars |
  | `starPalette[0]` | Polaris halo and self-sun default |
  | `textPrimary` | Polaris glyph |
  | `accent` | Focus rings and reorder ghost |
  | `avatarSwatches[]`, `avatarSwatchText` | Initials fallback (`swatchIndex(name)`) |
  | `statusStable`, `statusWobble`, `statusDecay`, `rogueExtinguished`, `border` | Body fill |
  | ring colour via `ringVisual` | Rings: the `rogue` token for rogue, `border` for null |
  | `surface` | Label backplates |
  | `TYPOGRAPHY` colour tokens | Text |
  | `textSecondary` | Moons |

- **Unused.** `gravityTiers` is **not** used by the Orrery.
- **Packages and modes.** There are two packages, `galaxy` and `standard`, each with authored dark and light palettes (`src/theme/theme-presets.ts:29-335`), plus a user accent overlay. Every Orrery colour flips with package and mode, so **Standard Light renders the Orrery on a light `background`.** A rewrite must look right in all four combinations.
- **Background art.** ADR-114 has the shell `BackgroundHost` force **None/Solid on the Orrery route only**. ADR-179 confirms that "the Orrery keeps its solid background".
  - The Orrery draws its own `Fill(background)` and procedural starfield. No bundled background art is drawn into the canvas.
  - Overlays use `GlassSurface treatment="orrery-overlay"` (ADR-149: Galaxy 0.91, Standard 0.87 opacity, AA-proven against the brightest Orrery star).
  - The `art-treatment-scope-contract` test forbids Orrery files from referencing the art-treatment table (`src/theme/art-treatment-scope-contract.test.ts:137-141`).
- **Accent role contract.** `accent-foreground-role-contract.test.ts:88-106` lists Orrery Skia accent uses such as the reorder ghost and the satellite focus stroke as sanctioned "Skia fill" exceptions. New accent uses in Skia files may need registering there.

---

## 7. Accessibility

- **The canvas exposes nothing to accessibility services.** `OrreryCanvas` and `OrreryWorld` set no accessibility props; the canvas has only `testID="orrery-canvas"`. Accessibility is provided by conventional RN overlays tied to the **same scene snapshot**:
  - **`OrreryControls`** (`OrreryControls.tsx`): three 55 px icon buttons, "Contacts in this System", "Recenter Orrery" and "Reset north". The north button exposes a live `accessibilityValue` "N degrees from north" through `useAnimatedProps` over `pose.yaw` (`:49-53`; `northOrientation` in `orrery-obstacle-logic.ts:365-374`).
  - **`OrreryContactsSheet`** (`OrreryContactsSheet.tsx`): the modal companion list for the exact System in member order, including a qualifying sun once. Each row shows an avatar, the name, the health and Gravity context (`companionRows` → `labelContext`) and satellite relation rows, with "Focus in Orrery: {name}" and "Open Profile: {name}" buttons. Its actions route through the same `onIntent` (`companionAction`).
  - **`OrreryClusterPanel`:** a nonmodal "Contacts here" group with per-target Focus and Profile actions. It publishes its measured rect as a camera obstacle (`CLUSTER_OBSTACLE`).
  - **`OrreryFocusContext`:** a floating identity card with "Clear focus" and "Open Profile: {name}", plus relationship context. The satellite variant has no Profile action.
  - **`OrrerySystemSelector` and `OrreryViewOptions`:** modal pickers with radio rows, expanded and busy states, and a polite live region.
- **Focus management and gating.**
  - Sheet dismissal restores accessibility focus to the trigger (`OrreryControls.tsx:63-66`).
  - Back and tab-retap consume the top transient through `shellTransientStore`.
  - Overlays set `importantForAccessibility="no-hide-descendants"` when blocked.
  - Gestures are disabled while any non-cluster transient is open (`overlaysOpen`, `OrreryScreen.tsx:162-164, 618, 1065`).
- **Text scaling.** Labels honour `fontScale`: width is capped at 200×fontScale and size comes from `TYPOGRAPHY`, so OS text size reaches canvas labels.
- **Tie to the scene.** Overlays are bound by `scene.systemSnapshot.members` order, by `focusTargets` (id and uid), and by `camera.frame` for positioning. Anything a new renderer draws for a body must keep that body's key, frame position and id/uid identity consistent with these lists.

---

## 8. High-count and density behaviour

- **No count caps** (dossier §G/§I and ADR-104). The world grows with population. Home stops shrinking at the readability floor and outer rings run off-screen; the camera and Systems handle exploration.
- **LOD and culling today:**
  - Semantic levels gate labels and moons.
  - `visible` (halo-reach on-screen test) gates billboard opacity and label candidacy. Culled bodies are still drawn: their Group remains with alpha 0, so the saveLayer may still be allocated (unverified).
  - Rings are never culled.
  - Every resource keeps its own React component, hooks and photo texture, all mounted.
- **Per-frame cost profile** (code-derived; not measured):
  - Choreography sampling is O(N), or O(N²) with key `find`s in `beginSwitchChoreography`. That cost is per publish, not per frame.
  - Projection is about N×(1+128) `projectWorldPoint` calls, each recomputing `usableCameraRect` over all obstacles.
  - Per-consumer `find` lookups make the frame O(N²).
  - `allocateLabels` is O(N²) in collisions.
  - Each ring builds a new Path every frame, and each body and label creates a new `Skia.Paint` plus a saveLayer.
  - The ambient clock repaints everything every frame even when the camera is still.
- **Photo memory.** Textures are capped at 512 px with a single-flight derivative queue. The comment there explains that an unbounded 50-planet first mount would spike about 200 MB.
- **Tunables in one place.** `DENSITY_PRESETS`, `PLANET_RADIUS` 16, `SUN_RADIUS` 30, `MIN_HIT_RADIUS` 22, `MIN_READABLE_RADIUS` 10, `RING_SEGMENTS` 128, `STAR_COUNT` 44, twinkle and pulse constants, and the switch phase constants.
- **Recorded performance evidence:**
  - `38.4-UAT.md:266` (RG-027): Pixel 3a, **debug** build, 20 switches. gfxinfo UI/RenderThread: 99.94% janky, p50 57 ms, p90 77 ms, p99 1550 ms, "with the Skia orrery animating continuously". It explicitly makes **no** performance claim (debug build plus uiautomator load), and it does not cover the JS thread. meminfo Graphics went from 270 MB to 283 MB.
  - `29-UAT.md:36, 113`: debug gesture jank was dev-mode overhead, and release was "smooth", owner-confirmed on the Pixel.
  - Explicitly deferred to Phase 40: large-System performance, LOD, final density, contention and GPU calibration (`38.4-UAT.md:273`, `docs/systems/orrery.md:145-148`, `29-NATIVE-CHECKLIST.md:134`).
- **Largest tested scene.** The largest recorded device fixture is small: 9 contacts (`30-12-DEVICE.md:37`). Behaviour at high counts is effectively **unmeasured**.
- **HANDOFF §7:** "tens of bodies, not thousands", and any starfield animation must be "a static image or a very cheap shader".

---

## 9. Test coverage that pins renderer behaviour

| Test | Pins | Rewrite impact |
|---|---|---|
| `src/components/orrery/orrery-render.test.tsx` | Mocked Skia and Reanimated render of the real `OrreryWorld`. It checks the exact child order `[rings, polaris, ghost, bodies, labels]`, that bodies are consecutive `skGroup`s with `zIndex` depth (contact behind the sun, flipped at yaw π), that body `layer` is a shared value, the moon colour `textSecondary` and its scale bounds, overview-hidden labels at alpha 0 versus 1 at zoom 2, the transform length of 3, and the Paragraph options and measurements (`:188-332`). | **Breaks** on any tree restructure. Rewrite or retarget it. |
| `orrery-frame-mapper.test.ts` | Transforms `OrreryWorld.tsx` with Babel. It extracts the `frame` worklet and checks that it settles under Reanimated's real mapper registry, recomputes exactly once per progress step and **does not capture `camera`** (feedback-loop guard, `:48-208`). | Breaks if `frame` is moved or renamed out of `OrreryWorld.tsx`. Keep the same capture discipline. |
| `orrery-worklet-order.test.ts` | Scans every `src/logic/orrery-*.ts` and `src/components/orrery/` module for a same-file worklet forward reference (the Hermes crash class). | New worklet files are scanned automatically. Keep helpers above their callers. |
| `orrery-worklet-boundary.test.ts` | Camera enable/cleanup reset worklets in `use-orrery-camera.ts`. | Safe if the camera hook is untouched. |
| `orrery-switch-runtime.test.ts` | Runtime start, re-target, pause/remount/resume byte-identity, reduced-motion path, settle compaction and resource cardinality. | Safe if the runtime API is kept. |
| `logic/orrery-frame.test.ts`, `orrery-switch-choreography.test.ts`, `orrery-camera-logic.test.ts`, `orrery-label-logic.test.ts`, `orrery-satellite-logic.test.ts`, `orrery-focus-logic.test.ts`, `orrery-reorder-logic.test.ts`, `orrery-recovery-logic.test.ts`, `orrery-gesture-logic.test.ts`, `orrery-world-logic.test.ts` | Pure math: projection, culling, hits, labels, moons, reorder, recovery, gestures, layout. | Unaffected by a pure renderer swap. |
| `src/services/orrery-scene.test.ts` | Real-SQLite tracer. Imports `createOrreryGestures` **from `OrreryWorld`** (re-export at `OrreryWorld.tsx:74`) and mocks `OrbitBody`, `SunBody` and `OrreryCanvas` by path (`:2, 25-27`). | Keep the re-export and the module paths, or update the mocks. |
| `src/screens/orrery-screen-framing.test.ts` | Screen framing and the store pipeline. Mocks `OrreryWorld` by id (`:268`). | Keep the `OrreryWorld` export name. |
| `orrery-controls-render.test.tsx` | Controls, sheet, cluster panel, focus-context accessibility labels and sizes. | Unaffected unless overlays change. |
| `use-orrery-photo*.test.ts` | Photo loader and lifecycle. | Unaffected if `useOrreryPhoto` is reused. |
| `src/theme/accent-foreground-role-contract.test.ts`, `art-treatment-scope-contract.test.ts` | Accent usage in specific Orrery files; no art table in Orrery files. | New files using `accent` may need registering. |

Gates are listed in runbook §7: the focused vitest list, `npx tsc --noEmit` and `npm run check:colors`.

---

## 10. Seams for a richer renderer

**Recommended seam:** keep everything above the `OrreryWorld` **return statement** and swap what is drawn inside `OrreryCanvas`. Concretely, split `OrreryWorld` into two parts.

1. **Keep the model half verbatim** (`OrreryWorld.tsx:206-516`). That means:
   - the `frame` derived value (it must stay in `OrreryWorld.tsx`, with its captures, for the mapper test, and must not capture `camera`);
   - the `camera.frame` publication, `level`, `labels`/`measured`/`allocations`, `identities`, `reorderExpectation`;
   - the `gesture` from `createOrreryGestures`, including `resolveTap`, which reads `allocations` for its tap semantics, and `onNorth`;
   - the two focus-lost reactions.
2. **Hand a single render contract to a new renderer.**
   - **Shared values:** `frame: SharedValue<AnimatedFrame>`, the authoritative per-body `x`, `y`, projected `radius`, `ringPath`, `depth`, `opacity`, `visible`, `interactive` and `hitRadius`; `allocations: SharedValue<LabelAllocation[]>`; `camera.reorder: SharedValue<ReorderDrag|null>`; `level`; `pose`; `switchRuntime.progress` and `transition`, for switch-aware effects such as streaks keyed to `sample.phase`, `angularVelocity` and the per-entry `role`; and `reducedMotion`.
   - **React data:** `switchRuntime.resources` (keyed body list, used to mount photo and text resources), `scene` (contacts, sun, gravity, systemSnapshot), `colors`, `fontProvider`, `labels` (prepared Paragraphs), `focusedIds`, `clusterIds`, `focusedSatellite`, `satellites` and `viewport`.
3. **Replace or extend `OrreryCanvas`** to change the background, environment and ambient layers. Keep three things:
   - it is the **only `useClock` owner**, and the clock goes out through context;
   - it still wraps the `GestureDetector`;
   - it is still mounted only through `OrreryScreen.tsx:1048`.

**What this gives the new renderer:**

- It can batch: an `Atlas` or `Picture` per layer built inside one `useDerivedValue` over `frame`, shaders for rings, glow and nebula, and parallax driven by `pose`.
- It can index bodies by key once per frame instead of running O(N) `find`s per consumer.
- Data, scene, store, camera math, hit-testing, gestures, reorder, switch runtime, focus, session and every accessibility overlay stay untouched, because overlays read `camera.frame`, which is fed from the same `frame`.

**Hard coupling rules for the new renderer:**

- **Visual size must match the frame.** Draw each body at `frame.bodies[i].radius`, or keep any extra visual reach within halo culling. Hit targets (`hitRadius`), label anchors (`body.y + body.radius + 8`), focus-card placement and the label exclusion boxes all derive from that radius. If the renderer draws bodies much larger or offset, either change `projectFrame` and the label inputs, or accept that hits and labels drift from the visuals.
- **Labels decide tap semantics.** Any rewrite of the label system must keep `allocations` (or an equivalent "visible name id list") feeding `resolveTap`. A renderer that hides or shows names differently changes whether a tap focuses a contact or opens its Profile.
- **Photos.** Reuse `useOrreryPhoto`: the 512 cap, the derivative cache and the disposal discipline. It has to be called unconditionally inside a keyed per-resource component. A hook cannot be called inside a `.map()` or a worklet.
- For an Atlas or Picture approach, keep thin keyed "resource" components that publish their `SkImage` into a shared registry, for example a JS-side map passed as a prop. Do not dispose an image while a re-record can still read it.
- **Keep keys stable** (`bodyKey`) so retained bodies keep their media through switches. `resources` already unions departures during a running switch.

**Alternative, lower-risk seams:**

- **Component-level reskin.** Change `OrbitBody`, `SunBody`, `SatelliteBody`, `ProjectedOrbitRing`, `Polaris`, `OrreryLabel` and the `OrreryCanvas` starfield in place, keeping the tree shape, so `orrery-render.test.tsx` still mostly holds. This is good for quick visual iteration, but it cannot fix the per-body saveLayer or the O(N²) lookups.
- **Projection-level extension.** Add fields to `ProjectedFrame`/`AnimatedFrame` in `projectFrame`/`projectAnimatedFrame`. Examples: screen-space ellipse parameters per ring instead of 128 points, or a depth-normalised value for lighting and fog. The model, gestures and tests then stay valid. Any new worklet helper must be defined above its callers.

**Do not seam below the scene.** World placement, rank, drift, the neutral angle and the nudge are product semantics (§11). Visual offsets must be presentation-only and must not move hit or label geometry unless that is done deliberately.

---

## 11. Invariants a rewrite must preserve

### 11.1 Product and information architecture

1. **One canonical status world** (ADR-077). There is no second mode and no relationship morph. Contacts and relationships remain the information architecture, not a literal solar-system simulation (experiment contract).
2. **Radius means closeness and order.**
   - Each contact gets its own ring, ordered by dense `ring_seq` rank (ADR-046; HANDOFF §7).
   - Angle encodes interval progress: north is 0 and the angle runs clockwise.
   - Never-contacted contacts sit at a fixed neutral north with neutral styling and no fabricated progress (ADR-011).
3. **Status is encoded without altering motion.** Status shows through body and ring colour, the ring style (solid → dashed → faded → faint trace), and outward drift for decay and rogue. The rogue body is cold while its ring stays warm.
   - **[REJECTED] in HANDOFF §7:** differentiated per-band animation, such as wobble jitter or free-floating decayed bodies. "Motion encodes data, not mood." Bodies stay on rails, stay tappable and stay static apart from camera and switch motion.
4. **Gravity is modest.** It is a ±10% mass change, never a raw number, never stored and never editable (ADR-106/027).
5. **The sun.** It is centred and globally assigned (ADR-047). The self sun uses the themed star colour. A contact sun glows in its status colour and appears once, never as an orbiting body. A non-member sun keeps Focus and Profile but gets no moons or context (D-11).
6. **Satellites** (ADR-105).
   - They are subordinate, without health, Gravity, Profile, rank, rings or children.
   - They are hidden at overview and default Off.
   - They come only from unlinked relationships of current members.
7. **Camera semantics.**
   - A finite, sun-centred 2.5D inspection camera, never free flight.
   - Bounded tilt and noticeable but bounded perspective.
   - Billboarded, circular photos and horizontal labels.
   - Natural depth occlusion.
   - Polaris is a world landmark: tapping it resets yaw only, and Recenter resets everything.
   - Recovery is distance-adaptive. Inertia is tiny and only on pan and yaw.
   - Pose is session-only and never persisted (ADR-104).
8. **Interaction semantics.**
   - A distant isolated tap focuses and zooms to the identity level. A tap on a named body opens Profile.
   - Any ambiguity, including mixed moons, opens cluster focus and never silently picks one body.
   - Reorder needs an 850 ms stationary hold, gives a haptic, and only moves contacted, unambiguous bodies.
   - Every action is re-validated against SQL by generation.
9. **Semantic zoom.** Three levels with hysteresis. Label priority is focus, then cluster, then favourites, then isolated, then the rest. Context never displaces a name. Native Unicode shaping with no JS name slicing.
10. **System switching.** Leaving bodies peel off, retained bodies keep continuity, entering bodies are captured, and the destination settles at canonical Home.
    - Intensity scales with membership turnover, not population size.
    - Re-targeting starts from the displayed sample.
    - Blur or background holds the sample.
    - Departed geometry is retired on settle (ADR-170).
    - Reduced Motion replaces all of this with a short direct crossfade and reposition.
11. **Single world per frame.** One sampled and projected world feeds rings, bodies, labels, culling, hits, focus cards and reorder preview (runbook step 5).

### 11.2 Technical and lifecycle

12. **The clock is the only ambient loop.** Exactly one `useClock`, owned by the unmountable `OrreryCanvas`. Blur, background or invalid measurement unmount it. No per-frame React state.
13. **Reduced Motion is live** (ADR-085). Every ambient consumer reads `useReducedMotionShared().value` inside its worklet. User-driven pan, zoom, tilt and yaw always remain available.
14. **Worklet discipline.**
    - Define helpers above their worklet callers (the Hermes crash class, guarded by `orrery-worklet-order.test.ts`).
    - Do not capture `camera` in the `frame` worklet.
    - Hooks are unconditional and keyed, never called in `.map()`.
15. **Theme discipline.**
    - All colours come from `ThemePalette` tokens. `check:colors` must pass, though contract B/C may document temporary compromises.
    - The renderer must work across Galaxy/Standard × Dark/Light and the accent overlay.
    - The Orrery route keeps a solid, non-art background (ADR-114/179).
    - Overlays use the ADR-149 `orrery-overlay` treatment, AA-proven against "the brightest raw Orrery star". **A much brighter starfield or glow could invalidate that contrast proof, which is an owner-bucket visual decision.**
16. **Local-first.** No network in rendering or read paths, and no downloaded assets. Prefer procedural rendering (contract).
17. **Accessibility parity.** The companion sheet, cluster panel, focus card and controls stay reachable and stay tied to the same System and frame. The canvas never becomes the only path to an action.
18. **Photo memory.** Keep the 512 px texture cap and the safe `SkImage` disposal.

---

## Appendix: key file index

| File | Role |
|---|---|
| `src/screens/OrreryScreen.tsx` | Lifecycle, store wiring, mount gate (`:1048`), switch publication (`:305-354`), framing (`:885-991`), intents (`:766-821`) |
| `src/services/orrery-scene.ts` | Scene load, geometry derivation, controllers |
| `src/db/orrery-system-read.ts` | Snapshot read model |
| `src/logic/orrery-world-logic.ts`, `orrery-geometry-logic.ts` | World layout and constants |
| `src/logic/orrery-camera-logic.ts` | Projection, inverse, Home, `frameBodies`, hits |
| `src/logic/orrery-frame.ts` | `AnimatedFrame`, `bodyKey`, `billboardPose` |
| `src/logic/orrery-label-logic.ts` | Semantic levels, label allocation |
| `src/logic/orrery-switch-choreography.ts` + `src/components/orrery/use-orrery-switch-runtime.ts` + `orrery-switch-animation.ts` | Switching |
| `src/components/orrery/use-orrery-camera.ts` + `src/logic/orrery-gesture-logic.ts`, `orrery-recovery-logic.ts`, `orrery-reorder-logic.ts`, `orrery-focus-logic.ts`, `orrery-satellite-logic.ts` | Input and intents |
| `src/components/orrery/OrreryWorld.tsx`, `OrreryCanvas.tsx`, `OrbitBody.tsx`, `SunBody.tsx`, `SatelliteBody.tsx`, `ProjectedOrbitRing.tsx`, `Polaris.tsx`, `OrreryLabel.tsx`, `use-orrery-photo.ts` | Renderer |
| `src/components/orrery/OrreryControls.tsx`, `OrreryContactsSheet.tsx`, `OrreryClusterPanel.tsx`, `OrreryFocusContext.tsx`, `OrrerySystemSelector.tsx`, `OrreryViewOptions.tsx` | Accessible overlays |
| `src/components/orrery/SystemPreviewCanvas.tsx` | Separate builder preview canvas: simplified markers, its own zoom bounds, not the production renderer |
