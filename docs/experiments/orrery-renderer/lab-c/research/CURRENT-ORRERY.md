# Current Orrery: Implementer Brief for Lab C (True 3D)

**Branch / tree read:** `experiment/orrery-3d` @ `1ea58dd0`, worktree `/home/bwales/projects/orbit-orrery-lab-c`. All file:line references below were opened and checked against this tree on 2026-10-01. Where this brief draws a conclusion rather than restating code, it says so.

**Two framing facts to settle first:**

1. **The current Orrery has no "Gravity vs Frequency mode."** No such toggle or mode exists in `src/components/orrery`, `OrreryScreen`, the preferences store or the system doc. What does exist:
   - **Gravity** is a *derived* per-contact value (`GravityResult {raw, tierIndex, tierName, tierCount}`, `src/services/gravity-logic.ts:64`). It modulates body radius by 0.9–1.1 and appears as named text ("… gravity").
   - **Contact Frequency** is a custom-System *rule family*, `docs/systems/orrery.md:61`.
   - The only "mode" ever recorded was Status/Relationship. **ADR-077 removed it** (`docs/systems/orrery.md:13`), and `docs/runbooks/orrery-visual-layer.md:251` says "Do not add a second Orrery mode." Re-adding a mode would reverse a recorded decision.
   - The only user view options are **density** (spacious/balanced/compact) and the **Relationship Satellites** on/off switch.
2. **True 3D versus the recorded decisions.**
   - **ADR-077 rejected "Unrestricted true-3D / free-flight navigation"** (`docs/decisions/ADR-077-…md`, Alternatives Considered).
   - **The Phase-08 dossier makes these `[DECIDED]`:** a finite, sun-centred world; a *constrained* camera; a top-down Home with north up; bounded tilt with no inversion and no flying underneath; billboarded avatars and labels (`docs/dossier/milestone-2/phase-08-orrery-camera-scale-exploration-dossier.md:44,66-79,86-92`).
   - **The same dossier also says** "Do not introduce Three.js/a game engine merely because tilt/yaw/perspective are requested… unless implementation evidence proves it inadequate" (`…:708`).
   - **What this means for Lab C:** a GPU 3D *renderer* that keeps the constrained camera model is an R&D exploration the experiment contract permits. A free-flight camera, or shipping a 3D engine dependency, is an **owner decision**.

---

## 1. Data pipeline: SQLite to scene model

### 1.1 Call chain

```
OrreryScreen (src/screens/OrreryScreen.tsx)
  └─ useMemo(createOrrerySystemStore({ load, persist }))           :257-283
       load = (system, generation) => loadOrreryScene(getExecutor(), generation, system)   :260-261
       persist = useOrreryPreferencesStore.save({lastSystem}) / retry          :262-280
  └─ state = useSystemStore()                                       :284
  └─ satelliteController = createOrrerySatelliteController(readOrrerySatellites…)  :360-372

loadOrreryScene(exec, generation=0, system=ALL_CONTACTS_SYSTEM)     src/services/orrery-scene.ts:210-257
  ├─ readOrrerySystemSnapshot(exec, system)                          src/db/orrery-system-read.ts:323-328
  │     inReadSnapshot(exec, ro => readOrrerySystemSnapshotCore(ro, system))   (one coherent read txn)
  │     readOrrerySystemSnapshotCore                                 :241-319
  │       getAppSettings, getProfile, sun header/status, savedSunIdentity, categories,
  │       readOrrerySystemMembersCore(ro, system)                    :169-238  (builtin/category WHERE or custom resolver + overrides)
  │       readOrreryImpactInputsCore(ro, ids)  (full history, 256-id chunks)
  │       listOrbitingContacts (complete contacted order, for reorder guards)
  │       identities (id/uid fingerprints)
  ├─ throws MissingOrreryCategoryError / MissingOrreryCustomSystemError   orrery-scene.ts:216-219
  └─ deriveSceneGeometry(...)  (OUTSIDE the DB mutex)               orrery-scene.ts:88-124
        orderOrreryMembers → computeContactGravity per id → deriveOrreryWorld(contacts, density, gravity, sunBody)
```

**System store** (`src/stores/orrery-system-store.ts:54-191`):

- **Generation-guarded.** `select()` bumps `generation`, sets `status:"loading"` and **keeps the old snapshot mounted** (`:107-115`) so the switch choreography has a source.
- **On success** it publishes `snapshot: {...result, generation}` and then persists `lastSystem` (`:126-133`).
- **Fallbacks.** A missing category reselects All Contacts with `await`. A missing custom System does the same without awaiting (`:136-143`).
- **`current()`** returns the snapshot only when `active && status==="ready" && snapshot.generation===generation` (`:179-184`). Every intent path uses this as its liveness check.

### 1.2 Key types (verbatim)

```ts
// src/services/orrery-scene.ts:41-60
export interface OrrerySceneSnapshot {
  preferences: OrreryPreferences;           // {density, satellitesEnabled: 0|1, lastSystem}
  generation: number;
  dataRevision: number;
  contacts: OrrerySystemMember[];           // ordered orbiting members (sun excluded)
  system: OrrerySystemRef;
  systemSnapshot: OrrerySystemSnapshot;     // full read result (members, resolvedSunIdentity, reorder fingerprints, brokenRules, validity…)
  world: WorldBody[];                       // canonical geometry: contacts + sun
  extent: number;
  gravity: Map<number, GravityResult>;
  sun: {
    sunContactId: number | null;
    selfSunColour: string | null;
    selfPhoto: string | null;
    selfName: string;
    occupant: SunOccupantLookup | null;
    sunContactName: string;
  };
}

// src/db/orrery-system-read.ts:38-41, 57-67
export interface ContactIdentity { id: number; uid: string; }
export interface OrrerySystemMember extends ContactIdentity {
  name: string;
  photo: string | null;          // canonical RELATIVE photo path
  ring_seq: number | null;
  status: ProfileStatus | null;  // 'stable'|'wobble'|'decay'|'rogue' | null (never contacted)
  progress: number | null;       // elapsed/interval (PROGRESS_SQL), null if never contacted
  last_contact: string | null;
  rarely_responds: number;
  favourite_rank: number | null;
  created_at?: string;
}
// OrrerySystemSnapshot = Awaited<ReturnType<typeof readOrrerySystemSnapshotCore>>  (:320-322). Fields used downstream:
//   members, resolvedSunIdentity, savedSunContactId, completeContactedOrder, contactIdentities,
//   eligibleContactedVisibleIds, brokenRules?, validity?, categories, settings, profile, header, occupant, orbiting, impactInputs

// src/logic/orrery-camera-logic.ts:7-59
export interface WorldPoint { x: number; y: number; }
export interface OrrerySatelliteTarget { kind: "satellite"; uid: string; parentId: number; parentUid: string; }
export type CameraPose = { x: number; y: number; zoom: number; tilt?: number; yaw?: number; focalDistance?: number; };
export interface CameraRect { x: number; y: number; width: number; height: number; }
export interface CameraViewport { width: number; height: number; usable?: CameraRect; obstacles?: readonly CameraRect[]; }
export interface WorldBody extends WorldPoint {
  id: number;                      // 0 = self sun (no Profile action); satellites use -1
  kind: "contact" | "sun" | "satellite";
  satelliteTarget?: OrrerySatelliteTarget;
  radius: number;
  ringRadius: number;
}
export interface ProjectedBody extends WorldBody { interactive?: boolean; hitRadius: number; ringPath: WorldPoint[]; depth: number; }
export interface ProjectedFrame { generation: number; pose: CameraPose; viewport: CameraViewport; bodies: ProjectedBody[]; center: WorldPoint; }
export interface OrreryIntent {                                    // :563-569
  kind: "none" | "clear" | "focus" | "profile" | "group" | "satellite";
  satelliteTarget?: OrrerySatelliteTarget;
  ids: number[];
  generation: number;
  targets?: OrreryContactTarget[];
}

// src/logic/orrery-frame.ts:15-30
export interface AnimatedWorldBody extends WorldBody { opacity: number; interactive: boolean; }
export type AnimatedFrame = Omit<ProjectedFrame, "bodies"> & {
  bodies: (ProjectedFrame["bodies"][number] & { opacity: number; interactive: boolean; visible: boolean })[];
};
// bodyKey: `satellite:${JSON.stringify([parentId,parentUid,uid])}` | `${kind}:${id}`   :31-40

// src/logic/orrery-focus-logic.ts:12-14
export type OrreryContactTarget = ContactIdentity & { kind: "member" | "contact-sun" };

// src/db/orrery-satellites-read.ts:15-21
export interface OrrerySatellite { uid: string; parentId: number; parentUid: string; personName: string; relationType: string | null; }

// src/logic/orrery-system-logic.ts:241-244
export type OrrerySystemRef =
  | { kind: "builtin"; id: "all-contacts"|"favorites"|"needs-attention"|"not-contacted"|"snoozed"|"chargers" }
  | { kind: "category"; uid: string }
  | { kind: "custom"; uid: string };
// systemRefId → "builtin:…" | "category:<uid>" | "custom:<uid>"   :275-284

// src/logic/orrery-reorder-logic.ts:241-255 (ReorderDrag / ReorderIntent); RingReorderRequest src/db/ring-seq-dao.ts:67-74
```

### 1.3 World geometry (canonical, camera-independent)

`deriveOrreryWorld(members, density, gravity, sun)` is defined at `src/logic/orrery-world-logic.ts:302-369`.

- **Angle.** Members are ordered by `ring_seq`, then `created_at`, then `id` (`:266-275`). Angle is `progressToAngle(progress)`: `frac(progress)·2π`, where 0 is 12 o'clock and the sweep runs clockwise (`orrery-geometry-logic.ts:106-109`). A never-contacted member (`progress === null`) sits at `NEUTRAL_RESTING_ANGLE = 0`, which is north.
- **Ring radius.** `ringRadius = preset.ringInner + index·preset.ringGap`, with one ring per member (`:346`).
  - `DENSITY_PRESETS` (`:240-244`): spacious `{68, 44}`, balanced `{58, 34}`, compact `{58, 32}`.
- **Drift.** Status pushes a body outward along its ray (`:280-291`), and position is `polarToXY(0,0, ringRadius + push, angle)`, i.e. `x = r·sin a`, `y = −r·cos a`. **World +y is south / screen-down.**
  - decay: `clamp01((progress − 1)/(3 − 1)) · 40` (`DECAY_DRIFT_SPAN`)
  - rogue: `80` (`ROGUE_DRIFT_SPAN`)
- **Body radius.** `PLANET_RADIUS (16) · gravityMassModifier` (`:324`), where `gravityMassModifier` is `0.9 + 0.2·tierIndex/(tierCount−1)` (`:253-264`).
- **Sun.** `SUN_RADIUS = 30` (`orrery-geometry-logic.ts:49`). A contact sun is scaled by its own gravity modifier (`orrery-scene.ts:110-121`).
  - The sun body's `id` is `0` when the sun is self, otherwise `sunContactId`. `kind:"sun"`, `ringRadius 0`.
- **Collision nudge.** Collision is computed at balanced geometry: a body's centre is closer to another than `r1 + r2 + 8`. The nudge is at most 1° and at most 4 world units of arc, with sign `uidSign(uid)` (`:330-345`). Neutral bodies are never nudged.
- **Extent** is `max(ringRadius + radius, |pos| + radius)` across all bodies (`:359-367`).

**Status thresholds.** These are SQL-side and must not be duplicated (`src/db/status.ts:39-41`). `STATUS_SQL` (`status.ts:~72`) also makes a contact rogue if `rarely_responds=1 && progress ≥ 1`.

| Status | Progress |
|---|---|
| stable | < 0.8 |
| wobble | [0.8, 1) |
| decay | [1, 3) |
| rogue | ≥ 3 |

### 1.4 What a scene contains, by visual element

| Element | Source | Notes |
|---|---|---|
| Sun / centre | `world` entry `kind:"sun"`; `scene.sun`; `resolveSunOccupant` (`src/logic/sun-occupant-logic.ts:120-155`) | Self sun: profile photo; glow = `selfSunColour ?? starPalette[0]`. Contact sun: contact photo; glow = that contact's **ring** status colour. A contact sun that is a member appears once, as the centre (excluded from `orbiting`). |
| Contact bodies | `world` `kind:"contact"` + `scene.contacts` lookup | Photo (relative path) or swatch + initials. Fill = `orreryRingStyle(status).bodyFill`. |
| Orbits/rings | `ringRadius` per contact (one ring each) | Style per status (`orrery-ring-logic.ts:328-378`): stable solid; wobble dashed; decay "faded" (0.7 opacity); rogue "faintTrace" (dashed, 0.3). Null status → neutral `colors.border`. |
| Satellites ("moons") | `OrrerySatellite[]` from `readOrrerySatellites` | Only unlinked, visible structured Relationships of current System members; **only at identity/detail semantic level and only when `satellitesEnabled`** (`orrery-satellite-logic.ts:139-199`). |
| Systems | `scene.system`, `systemSnapshot.members` | Built-in / Category-UID / custom. A System only filters membership; geometry comes from the same derivation. |
| Photos / initials | `member.photo`; `orreryInitials(name)` (grapheme-safe, up to 2) `orrery-label-logic.ts:399-409`; swatch `avatarSwatches[swatchIndex(name, n)]` | — |
| Status colours | tokens `statusStable/statusWobble/statusDecay/rogue/rogueExtinguished/border` | Rogue: ring = warm `rogue`, body = cold `rogueExtinguished`. |
| Gravity | `scene.gravity.get(id)` | Size ±10% plus label text "`<tierName> gravity`". Never a raw number (ADR-106). |
| Polaris (north landmark) | `polarisWorldPoint(extent)` = `(0, −max(32, 0.85·extent))` `orrery-obstacle-logic.ts:380-386` | Projected and tappable: tapping it sets yaw to 0. |

---

## 2. Rendering (Skia 2.5D)

### 2.1 Frame pipeline (one UI-thread frame for everything)

`OrreryWorld` (`src/components/orrery/OrreryWorld.tsx:222-258`) builds a single `useDerivedValue` frame each tick:

1. **Switch sample.** `sampleSwitchChoreography(switchRuntime.transition.value, switchRuntime.progress.value).world`.
2. **Camera.** `progress ≥ 1 ? pose.value : sampleOrrerySwitchCamera(cameraFrom, cameraTo, progress)` (smoothstep blend).
3. **Reorder preview.** `previewReorder(world, camera.reorder.value)`, applied only for a drag of the current generation.
4. **Moons.** `deriveSatelliteBodies(world, satellites, members, true, semanticLevel(zoom, level))`.
5. **Project.** `projectAnimatedFrame({generation, from: complete, to: complete}, 1, camera, viewport)` produces an `AnimatedFrame`.
6. **Publish.** `useAnimatedReaction` copies the frame into `camera.frame.value` (`:260-265`). This is how the RN HUD (`OrreryFocusContext`) follows bodies.

**The single frame feeds** rings, bodies, labels, culling, hit tests, reorder and focus-lost detection. The runbook requires this (`docs/runbooks/orrery-visual-layer.md:235`).

### 2.2 Projection math (2.5D)

From `src/logic/orrery-camera-logic.ts`:

```
cameraPlane(p, pose)  = rotate(p − (pose.x,pose.y), yaw):  { x·c − y·s,  x·s + y·c }          :189-197
perspectiveScale(p)   = f / (f − plane.y·sin(tilt))      (throws if denominator ≤ 0)             :198-206
projectWorldPoint(p)  = center + { plane.x·scale·zoom ,  plane.y·cos(tilt)·scale·zoom }           :282-296
    center = centre of usableCameraRect(viewport)  (largest unobstructed rect, NOT viewport centre)  :183-188
depth                 = plane.y · sin(tilt)    (bigger = nearer; screen-bottom comes toward viewer) :534
projected radius      = body.radius · zoom · perspectiveScale
hitRadius             = max(MIN_HIT_RADIUS=22, projected radius)                                   :532
ringPath              = 128 projected points of the circle ringRadius around world origin          :512-526
projected ringRadius  = body.ringRadius · zoom   (no perspective; only reorder uses it)            :531
f (focalDistance)     = deriveFocalDistance(extent) = max(256, (1+√2)·extent·sin(60°)/0.45)        :91-100
```

**A pinhole camera can match this exactly.** (Analysis, not a code claim.) Rotate the plane about the screen x-axis by `tilt`, so a point becomes `(x, y·cos t, y·sin t)`. A camera at distance `f` from the pivot `(pose.x, pose.y)` with focal length `F = zoom·f` pixels then gives `screen = center + F·(x, y·cos t)/(f − y·sin t)`, which is the formula above. So a GPU camera can reproduce the existing frame **pixel-for-pixel** with these settings:

- **Camera distance** to the pivot = `focalDistance` world units. Zoom changes focal length / FOV, not distance.
- **Vertical FOV** = `2·atan((H/2)/(zoom·f))`.
- **Yaw** rotates about the world normal through the pivot.
- **Tilt** pitches the plane: the bottom comes toward the viewer, and +y is south.
- **Principal point** at the usable-rect centre. In three.js terms this is lens shift: `camera.setViewOffset` or a custom projection matrix.

If the 3D camera matches this model, every pure-logic consumer stays valid unchanged: hit testing, labels, reorder, framing (`frameBodies`), Home (`deriveHomePose`), Polaris, focus-lost and the RN HUD positioning.

**Camera constants** (`orrery-camera-logic.ts:60-77`):

| Constant | Value |
|---|---|
| `HOME_CAMERA` | `{x:0, y:0, zoom:1, tilt:0, yaw:0, focalDistance:256}` |
| `IDENTITY_ZOOM` | 2 |
| `MIN_ZOOM` | 0.25 |
| `MAX_ZOOM` | 4 |
| `MAX_TILT` | π/3 (60°) |
| `MIN_READABLE_RADIUS` | 10 |
| `MIN_HIT_RADIUS` | 22 |
| `MAX_DEPTH_FRACTION` | 0.45 |
| `RING_SEGMENTS` | 128 |

**Clamping.**

- `clampCameraPose` (`:235-250`) clamps pan to a square of ±extent, clamps zoom, clamps tilt to [0, 60°], wraps yaw into [0, 2π), and **recomputes focalDistance from the bound**.
- `projectFrame` re-clamps with `max(worldExtent, f·0.45/((1+√2)·sin60°))` (`:497-504`).
- `cameraExtent(e) = max(32, e)` (`orrery-recovery-logic.ts:21-24`).

**Home and framing.**

- `deriveHomePose` (`:254-280`) chooses `zoom = min(1, max(floor, fit))`. The floor is `max(0.25, 10/minBodyRadius)` (readability wins over fit, so outer rings may leave the screen). Fit is `min(w,h)/(2·extent)`.
- `frameBodies` (`:363-456`) binary-searches zoom over [0.25, 4] (36 iterations, plus 32 centring iterations) so the projected media plus the minimum touch radius fit in the usable rect. It returns `{pose, fits, usable}`.

### 2.3 Visibility, culling and opacity

`projectAnimatedFrame` (`orrery-frame.ts:129-157`) adds three fields per body:

- `opacity`, taken from the sampled transition.
- `interactive = world.interactive && opacity > 0`.
- `visible = opacity > 0 && on-screen`, using a reach of `radius × (sun ? 2 : 1.3)`.

Culling is **media-only**. The full frame remains the hit authority (`:142`).

### 2.4 Draw tree and depth sorting

`OrreryWorld.tsx:517-613` draws inside `OrreryCanvas`, in this order:

1. `<Fill color={colors.background}/>`
2. Starfield `Group` (`OrreryCanvas.tsx:144-158`).
3. Clip `Group`, containing in order:
   1. Rings: one `ProjectedOrbitRing` per contact resource, drawn behind everything.
   2. `Polaris`.
   3. `ReorderGhost` (accent-stroked ring path plus a circle at `r + 4` around the held body).
   4. **The body batch:** every `ProjectedBody` (sun and contacts) plus every `SatelliteBody`, as **consecutive sibling `Group`s with `zIndex={depth}`**. Skia's native recorder sorts them by zIndex. Comment `:550`: "RNRecorder flushes sorting at every non-Group command. Keep this run contiguous." `orrery-render.test.tsx` asserts this.
   5. Screen-space labels.

**Bodies are billboards.** Each body is drawn at local origin `(0,0)`, then `transform = [translateX, translateY, scale]`, where `billboardPose` gives `scale = projectedRadius/worldRadius` (`orrery-frame.ts:203-219`). Opacity is applied via `layer = Skia.Paint().setAlphaf(opacity)`.

**`OrbitBody`** (`OrbitBody.tsx:216-322`):

- Optional focus ring: `r + 4`, stroke 2, `colors.accent`.
- Status disc at `r` filled with `bodyFill`. It reads as an outline because the inner disc is `r − 1.5`.
- Then either the photo, cover-fit and clipped to a circle of `innerR`, or the swatch circle plus an initials `Paragraph` (Inter, fontSize = radius, one line, ellipsis).

**`SunBody`** (`SunBody.tsx:393-531`):

- Focus ring at `r + 6`.
- **Pulsing glow halo.** Radius is `glowRadius·(1 + 0.1·sin(clock·0.002))`, with `glowRadius = body.radius·1.8` passed from `OrreryWorld.tsx:156`. Opacity is `0.35·(1 + 0.4·sin)`, which gives roughly a 3.1 s period.
- A rim at `r + 2` in the glow colour, then the photo or swatch plus initials.

**`SatelliteBody`** (`SatelliteBody.tsx`) is a unit circle in `colors.textSecondary`, scaled by the projected radius. When focused it adds an accent ring at `1.5` with stroke `0.3`.

**`ProjectedOrbitRing`** (`ProjectedOrbitRing.tsx`):

- Draws a closed path from `ringPath`, with stroke width/colour from `orreryRingStyle`.
- Opacity is body opacity × (faded 0.7 | faintTrace 0.3 | style.opacity).
- `DashPathEffect [6,6]` for dashed and faintTrace.

**`Polaris`** (`Polaris.tsx`) is a 4-point star path (±10 px) with a halo of `POLARIS_RADIUS·1.5 = 9`. Halo colour is `starPalette[0]` at 0.25 opacity; the star itself is `textPrimary`.

### 2.5 Starfield and background

- **Starfield** (`OrreryCanvas.tsx:55-139`): `STAR_COUNT=44` deterministic dots via a `sin`-hash. Radius is 0.6–1.8 and colours are `[textSecondary, textPrimary, ...starPalette]`. Per-star base opacity is 0.4–1.0.
- **Twinkle.** One group opacity oscillates between 0.18 and 0.55 at `0.0024` rad/ms (about 2.6 s). Under reduced motion it holds at the constant 0.365.
- **App background art is forced off on the Orrery route.** `focused-route-classification.ts:85-89` returns `"none"` for route `Orrery` (ADR-114). The screen root is `colors.background` (`OrreryScreen.tsx:1038`). The canvas is the whole environment; there is no parallax or skybox today.

### 2.6 Photos and textures

`useOrreryPhoto(relative)` (`src/components/orrery/use-orrery-photo.ts:465-502`) returns a `SkImage | null`.

- **Texture cap.** `ORRERY_TEXTURE_MAX = 512` px. Masters of 512 px or less are decoded directly. Larger masters (new ones are 1024 WebP) use an on-disk 512 JPEG derivative (`orrery-derivative-store.ts`) generated through `expo-image-manipulator`.
  - At most `ORRERY_DOWNSAMPLE_CONCURRENCY = 1` generation at a time, from a FIFO queue.
  - Generation is keyed by `relative#signature#revision`.
- **Reload trigger:** `usePhotoCacheBust(relative)`.
- **Disposal order.** The SkImage is disposed only after the commit that replaced it (`:497-499`), because Skia re-reads `image.width()` on every re-record and a disposed host object throws.
- **Non-photo paths.** `isStoredPhotoPath` rejects any path that is not a stored photo (`:345`), and those bodies show initials.

**For a 3D renderer.** `loadOrreryImage(relative, deps, token)` (`:338-401`) is the reusable, injectable loader. It returns an `SkImage`. A GPU texture would need either pixel readback from the SkImage, or a sibling loader that reuses `findOrreryDerivative` / `orreryMasterSignature` / `resolvePhotoUri`. **Constraint:** `photo-writer-contract.test.ts:~100` pins *which files* may import the plain (revision-less) photo URI resolver. A new file that imports `resolvePhotoUri` must be added to that allowlist, or must go through `use-orrery-photo.ts`.

### 2.7 Labels and semantic zoom

**Semantic levels** (`src/logic/orrery-label-logic.ts:388-424`) use hysteresis:

| Level | Enter at zoom | Exit below zoom |
|---|---|---|
| `overview` | — | — |
| `identity` | 2 (`IDENTITY_ENTER`) | 1.85 |
| `detail` | 3 | 2.8 |

The level is held in a shared value `level`, updated from `frame.pose.zoom` (`OrreryWorld.tsx:357-362`).

**Label preparation** happens on the JS side (`OrreryWorld.tsx:276-339`):

- One label per world body except `id === 0` (self sun).
- Name: the member name, or `sunContactName` for a contact sun.
- Text is built with `prepareOrreryText(text, "label"|"caption", fontScale, min(200·fontScale, viewport.width), fontProvider, colors)` (`OrreryLabel.tsx:31-69`). That is a native Skia Paragraph using `TYPOGRAPHY` tokens, one line, "…" ellipsis, padding `SPACING.sm` × `SPACING.xs`.
- Context line: `labelContext(status, gravity, relation)` = "Stable|Wobbling|Decaying|Rogue|Not contacted yet · <tier> gravity [· relation]" (`orrery-label-logic.ts:565-587`).
- Only plain measured `{width, height}` cross into worklets (`:341-356`).

**Placement** runs per frame in a worklet: `allocateLabels(candidates, level, viewport, bodyExclusions)` (`orrery-label-logic.ts:460-562`).

- **Candidates** are bodies that are `visible && interactive`. A label sits under its body at `y + r + 8`, with an alternate above.
- **At `overview`, only focused or cluster labels are shown.**
- **Priority:** focused (0), cluster (1), favourite (2), isolated label that fits (3), everything else (4). Ties break by id.
- **Placement tries** the below position, then the above position, each at x-nudges of 0 and ±8. A placement is rejected if it leaves the usable rect, touches an obstacle (HUD rects plus every visible body's bounding square), or touches an already-placed label.
- **The context line** is placed only at `detail`, under an already-placed name, and only if it fits.

**Label drawing.** `OrreryLabel` draws a `RoundedRect` (`RADII.sm`, `colors.surface`) plus a Paragraph. Its x/y/opacity come from the allocation, all inside the screen-space `Group` (`OrreryWorld.tsx:590-610`).

**Fonts.** `useFonts({Inter: [Regular, SemiBold], "Space Grotesk": [SemiBold]})` is called in `OrreryScreen.tsx:184-190` and passed down as `fontProvider`.

### 2.8 Tunables index

| File | Constants |
|---|---|
| `src/logic/orrery-geometry-logic.ts:49-65` | `SUN_RADIUS 30`, `SUN_GLOW_RADIUS 54` (legacy), `PLANET_RADIUS 16`, `HIT_RADIUS 24` (legacy), `DECAY_DRIFT_SPAN 40`, `ROGUE_DRIFT_SPAN 80` |
| `src/logic/orrery-world-logic.ts:240-251` | `DENSITY_PRESETS`, `MAX_NUDGE_ANGLE`, `MAX_NUDGE_WORLD`, `COLLISION_CLEARANCE 8`, mass 0.9–1.1 |
| `src/logic/orrery-camera-logic.ts:60-77` | camera constants above |
| `src/logic/orrery-gesture-logic.ts:276-281` | `PAN_DISTANCE 10`, `TAP_DISTANCE 8`, `HOLD_MS 850`, `HOLD_SLOP 8`, `TILT_DISTANCE 28`, `TILT_RADIANS_PER_POINT 0.004` |
| `src/logic/orrery-recovery-logic.ts:13-20` | `RECOVERY_MIN_MS 180`, `RECOVERY_MAX_MS 850`, `REDUCED_RECOVERY_MS 100`, `COAST_MS 120`, `PAN_COAST_POINTS 18`, `YAW_COAST_RADIANS 0.08`, `POLARIS_RADIUS 6`, `POLARIS_HIT_RADIUS 22` |
| `src/logic/orrery-label-logic.ts:389-394` | level thresholds, `LABEL_NUDGE 8`, `CONTEXT_GAP 4` |
| `src/components/orrery/OrreryWorld.tsx:81-82` | `LABEL_MAX_WIDTH 200`, `LABEL_BODY_GAP 8` |
| `src/logic/orrery-satellite-logic.ts:133-134` | `MOON_RADIUS 4`, `PARENT_GAP 24` |
| `src/logic/orrery-switch-choreography.ts:4-13` | phase boundaries (§3.6) |
| `src/components/orrery/use-orrery-switch-runtime.ts:25-26` | `NORMAL_SWITCH_DURATION_MS 2100`, `REDUCED_SWITCH_DURATION_MS 180` |
| `src/components/orrery/OrreryCanvas.tsx:56-70` | starfield/twinkle |
| `src/components/orrery/SunBody.tsx:385-391` | glow pulse |
| `src/components/orrery/OrbitBody.tsx:214` | `OUTLINE_WIDTH 3` |
| `src/components/orrery/use-orrery-photo.ts:79-88` | texture cap / derivative quality / concurrency |
| `src/components/orrery/orrery-obstacle-logic.ts:311-314` | control column geometry |
| `src/logic/orrery-focus-logic.ts:15` | `FOCUS_OFFSCREEN_MARGIN 44` |

---

## 3. Interaction

### 3.1 Gestures

All gestures are built by `createOrreryGestures` (`src/components/orrery/use-orrery-camera.ts:170-532`) and re-exported from `OrreryWorld.tsx:74`. They are composed as `Race(tap, Race(hold, Simultaneous(pan, pinch, rotation, tilt)))` (`:531`). Every callback is a worklet, and only discrete results cross to JS via `runOnJS`.

**Tap** (`Gesture.Tap().maxDistance(8)`):

- `onEnd(success)` first tries `onNorth(x,y)`. A Polaris hit triggers `camera.recover(northTarget(pose))`, i.e. yaw → 0 (`OrreryWorld.tsx:453-458`).
- Otherwise it sends `resolveTap(frame, x, y)`, which is `resolveSatelliteTap(…, identities, allocatedLabelIds, members)`.

**Pan** (one pointer, `minDistance 10`):

- Each step is `cameraGestureStep(pose, {kind:"pan", dx, dy})`, which calls `panCamera`.
- `panCamera` keeps the world point under the finger by unprojecting through the tilted plane, with the reachable-y clamp (`orrery-camera-logic.ts:597-628`).
- `onEnd` calls `coast("pan", vx, vy)`.

**Pinch** applies `anchorCameraPose` around the focal point: the world point under the fingers stays fixed. If the point is beyond the horizon it zooms about the centre instead (`:329-353`).

**Rotation** adds to yaw and then coasts.

**Tilt** is a two-pointer `Pan` with `averageTouches` and `manualActivation`. It activates once the vertical centroid has travelled ≥ 28 px. The step is `delta·0.004` rad, clamped to [0, 60°]. Zoom and tilt never coast.

**Hold → reorder** (`Pan.activateAfterLongPress(850)`, `maxPointers 1`):

1. `onTouchesDown` calls `captureReorder(frame, expectation, x, y)` (`orrery-reorder-logic.ts:256-305`). It fails on a moon hit, on more than one hit, or on a non-eligible id. Only contacted, visible System members are eligible.
2. Moving more than 8 px before activation fails the hold, and the gesture becomes a pan.
3. `onStart` sets the input owner to `"reorder"`, sets `drag.active`, and calls `runOnJS(acknowledge)`, which fires `Haptics.selectionAsync()`.
4. `onUpdate` calls `moveReorder`. It takes the radial distance in world units minus the body's drift, then snaps to the nearest ring slot with midpoint ties going outward, and produces `computeRingReorder(...)`.
5. `onEnd` calls `releaseReorder`. A no-op release returns null. A real change sends `runOnJS(commit)(ReorderIntent)`.

**Input ownership** (`orrery-gesture-logic.ts:282-343`) is one of `idle|pending|pan|multi|reorder|cancelled`. A second finger cancels a reorder drag (`use-orrery-camera.ts:208-213`).

### 3.2 Hit testing

`resolveOrreryTap` (`src/logic/orrery-focus-logic.ts:46-93`):

- **Candidates.** Every interactive non-satellite body with `id > 0` inside the viewport and within `max(22, hitRadius)` of the tap. The self sun (`id 0`) is never a target.
- **Identity mapping.** Each candidate maps to an `OrreryContactTarget` via `identities`: members become `kind:"member"`, and the contact sun becomes `kind:"contact-sun"`.
- **Order.** Targets are deduplicated and sorted by System member order (`orderContactTargets`, `:23-45`).
- **Result:**
  - 0 targets → `"clear"`.
  - More than 1 → `"group"`.
  - Exactly 1, and the body's label is currently allocated (visible on screen) → `"profile"`.
  - Otherwise → `"focus"`.

So **a name you can see means one tap opens the Profile; an unlabeled body means the first tap focuses.** The legacy `tapIntent` used `zoom ≥ 2` for this decision (`orrery-camera-logic.ts:570-591`), but it is not the production path.

**Satellites** (`orrery-satellite-logic.ts:204-265`):

- No contact target and exactly one moon hit → a `"satellite"` intent.
- Mixed or multiple hits → `"group"` of the parent contacts. Relationship ids never reach Profile, logging or rank.

**Polaris** (`orrery-recovery-logic.ts:136-156`) is hit within 22 px, but only if no interactive body is under the finger.

### 3.3 Focus model

The flow is `onIntent` (`OrreryScreen.tsx:766-821`), then `createOrreryFocusController` (`orrery-focus-logic.ts:152-217`), wired up at `OrreryScreen.tsx:723-765`.

1. **Every** focus, group or profile intent is **re-validated against SQL** with `readOrreryContactTargetValidation(exec, system, target)`. The ID/UID must match and membership (or global-sun identity) must still hold.
2. Generation, action-ticket and system are checked around each await.
3. **Outcomes:**
   - `focus(targets)`: sets `focusTargets`, then `frameBodies` → `camera.recover(pose)`. For a single body, zoom is capped at `min(IDENTITY_ZOOM=2, fit)` (`OrreryScreen.tsx:695-720`).
   - `group(targets)`: sets `clusterOpen` (the nonmodal `OrreryClusterPanel`) and stops the camera. Framing happens later in the Home effect, once the panel's obstacle has been measured (`:885-991`).
   - `openProfile(id)`: `captureSession("profile", () => navigation.navigate("Profile", {contactId}))` (`:747-758`). This samples the pose on the UI thread once, then navigates.
   - `reject(reason)`: `focusError` notice (`removed | missing-category | error`).
4. **A satellite intent** re-reads satellites and checks that the row still exists, then sets `focusedSatellite`. The UI is only an `OrreryFocusContext` card; there is no Profile action.
5. **Focus-lost.** When the camera is idle and the single focused body is more than 44 px outside the usable rect, `onFocusLost` → `clearFocus` (`OrreryWorld.tsx:476-516`). Satellites use the same check with `hitRadius + 44`.
6. **Focus visuals:**
   - Accent ring on the body.
   - Label priority 0.
   - An RN `OrreryFocusContext` card positioned on the UI thread from `camera.frame` (`OrreryFocusContext.tsx:213-241`). It shows the name, "Clear focus", "Open Profile" and relationship rows.
7. **Cancellation reasons** are `superseded | clear | outside | recenter | system | blur | background | dispose`.

**Data invariants.** Never fabricate focus for `id ≤ 0`. A contact sun outside the System is still focusable and can open its Profile, but it has no companion row and no moons (owner ruling D-11; `docs/systems/orrery.md:55`).

### 3.4 Camera and zoom model

- **Pose** is the screen-owned `useSharedValue<CameraPose>({...HOME_CAMERA})` (`OrreryScreen.tsx:255`).
- **`useOrreryCamera`** (`use-orrery-camera.ts:75-165`) returns `{input, samples, live, active, frame, reorder, stop, recover, coast, motionChanged}`.
  - **`recover(target)`** plans with `planRecovery`. Duration is `180 + 670·(1 − e^{−distance})` ms, eased with `recoveryCurve = 1 − (1 − t)^5`. Under reduced motion it is 100 ms and linear (`orrery-recovery-logic.ts:48-76`). Yaw takes the shortest path.
  - It animates `pose` with `withTiming(..., reduceMotion: ReduceMotion.Never)`; the app gates reduced motion itself.
  - **`stop()`** bumps the epoch and cancels.
  - **`coast()`** is a 120 ms bounded continuation, suppressed under reduced motion.
- **Recenter** (`OrreryScreen.tsx:992-1002`) clears focus, group and satellite, then `recover(deriveHomePose(world, viewport))`.
- **Reset north** (`:1003-1009`) calls `recover(northTarget(pose))`, i.e. yaw 0 only.
- **Home effect** (`OrreryScreen.tsx:885-991`). This is the authority for re-framing on scene, viewport, density or session change:
  - session restore;
  - same-domain clamping;
  - the forced switch Home (skipped because the choreography owns it);
  - focused framing, or else Home.

### 3.5 Navigation, session and System switching UI

**Profile and session.** Profile is pushed on the Orrery stack (`src/navigation/tabs/OrreryStack.tsx:57`).

- `useOrrerySessionStore` (`src/stores/orrery-session-store.ts`) is memory-only.
- Genuine Profile Back restores the pose and a still-valid focus (`restoreOrrerySession`, `src/logic/orrery-session-logic.ts:275-300`).
- Background keeps the session. A fresh tab visit (`leaveTab`, `OrreryStack.tsx:34`) resets to Home.

**System selector.** `OrrerySystemSelector` (`src/components/orrery/OrrerySystemSelector.tsx`) is a top dropdown.

- It has three disclosure groups: Built-in, Categories, Custom.
- Counts are filled in progressively. Custom-System counts are capped at `MAX_CUSTOM_SYSTEM_COUNTS_PER_OPEN = 12` per open (`OrreryScreen.tsx:124, 521-578`).
- Selecting a row calls `state.select(row.ref, row.name, true)` (`:268`). There is also a "Manage Systems" link to the `SystemsManagement` route (`:338`).
- `OrreryViewOptions` controls density and the satellites switch (`preferences.save`); changes reload the scene (`OrreryScreen.tsx:484-491`).

### 3.6 Switch choreography (exact)

**Wiring** (`OrreryScreen.tsx:305-354`): a store subscription filtered by `shouldPublishSwitchScene` on status, generation and snapshot identity (`orrery-switch-animation.ts:442-451`).

1. **Loading after ready:** remember the source member ids. This counts as an in-session switch only when `requested.id` changed.
2. **Ready:** `publishSwitch(snapshot, isSwitch, intensity, isSwitch ? deriveHomePose(destination) : pose.value)`.
   - `intensity = switchIntensity(computeMembershipDelta(src, dst)) = (entering + leaving)/(entering + leaving + 2·overlap)`.
   - A single focus is retained only if the body is in both Systems (`preservedFocus`). The destination always lands at canonical Home (`switchHomeGeneration`).

**Runtime** (`useOrrerySwitchRuntime`, `use-orrery-switch-runtime.ts:228-412`) is screen-owned and survives the canvas unmounting.

- Shared values: `transition`, `progress`, `cameraFrom`, `cameraTo`, `running`, plus React `resources` (keyed body list).
- `publish` re-bases on the **currently displayed sample**, so an A→B→C switch never snaps. The camera blends from the displayed camera to destination Home with smoothstep.
- The driver is `withTiming(progress → 1, duration = (reduced ? 180 : 2100)·remaining)`.
- `finish` sets `pose = cameraTo`, compacts the transition to destination-only (`settleSwitchChoreography`), and prunes React resources (RG-027).
- `pause` / `resume` are tied to blur and AppState. A live reduced-motion toggle mid-switch rebases onto the reduced path.

**Choreography** (`src/logic/orrery-switch-choreography.ts`):

| Constant | Value |
|---|---|
| `ACCELERATE_END` | 0.20 |
| `SHED_START` / `SHED_END` | 0.18 / 0.58 |
| `CAPTURE_START` / `CAPTURE_END` | 0.44 / 0.82 |
| `SETTLE_START` | 0.72 |
| `INTERACTION_READY_PROGRESS` | `CAPTURE_END` (0.82) |
| `STAGGER_WINDOW` | 0.035 |
| `BASE_RADIAL_DISPLACEMENT` | 52 |
| `RADIAL_DISPLACEMENT_RANGE` | 118 (so 52–170 world units) |

- **Roles.** Each key is `retained`, `leaving`, `entering` or `anchor` (sun / non-contact) (`:367-387`).
- **Spin.** `spinTurns = 1 + round(intensity·2)`, so 0–3 turns, and 0 under reduced motion.
- **Rotation profile.** Cubic ease-in to 0.2, constant velocity to 0.72, then ease-out (`rotationIntegral`, `:161-189`).
- **Retained** bodies rotate forward along a polar path by `forwardAngle + turns·2π`, with distance, ring, radius and opacity smoothstepped (`:259-284`).
- **Leaving** bodies peel off between SHED ± stagger: they rotate, move outward by `radialDisplacement`, shrink to 0.75 and fade, and are `interactive:false` (`:286-313`).
- **Entering** bodies are captured between CAPTURE ± stagger: they move in from `+radialDisplacement`, carrying the remaining rotation. Radius grows from 0.75 to 1. They become `interactive` at progress 0.82 (`:315-346`).
- **Reduced motion** is a direct smoothstep reposition plus crossfade, with no rotation (`sampleReduced`, `:231-257`).
- **Device-verified look** (`.planning/phases/30-orrery-systems/30-12-DEVICE.md`): "Retained bodies rotate continuously; entering contacts stream/capture; camera expands and settles exactly."

---

## 4. Accessibility

- **The canvas is not the accessible path.** `OrreryCanvas` has no a11y labels, and the bodies are Skia draws. The **companion** path is the requirement (Phase-08 dossier `:515, 718`):
  - **`OrreryControls`** (`OrreryControls.tsx`): three 55 px icon buttons, "Contacts in this System", "Recenter Orrery" and "Reset north". Reset north carries a live `accessibilityValue` text "`N degrees from north`" via `useAnimatedProps` (`:49-53`; `northOrientation` `orrery-obstacle-logic.ts:365-374`).
  - **`OrreryContactsSheet`**: a modal sheet listing members in exact System order with photo or fallback, health and named Gravity. Each row has "Focus in Orrery: {name}" and "Open Profile: {name}" (`OrreryContactsSheet.tsx:115,122`), plus parent relationship context.
  - **`OrreryClusterPanel`**: a nonmodal "Contacts here" group with the same per-row actions (`:54-80`).
  - **`OrreryFocusContext`**: name, Clear focus, and "Open Profile: {name}" (`:259-268`).
  - **Selector and view options** carry labels such as "Choose System", group counts, row name plus empty/broken state, "Close System selector", "View options", density radios and "Relationship Satellites".
- **Focus restoration.** Closing a sheet or dropdown restores TalkBack focus to its trigger via `AccessibilityInfo.setAccessibilityFocus`. Back and tab-retap consume the top transient (`shellTransientStore`).
- **Blocking.** While any overlay is open, HUD layers set `importantForAccessibility="no-hide-descendants"` and `pointerEvents="none"`, and the world is non-interactive (`interactive={!overlaysOpen && ready}`).
- **Text scale.** Labels scale by `fontScale` with max width `200·fontScale`.
- **Reduced motion** is a live OS signal (`src/theme/use-reduced-motion.ts`, ADR-085). It comes from `AccessibilityInfo.reduceMotionChanged`, not Reanimated's boot-only hook, and is exposed as a shared value that every consumer reads inside worklets:

| Behaviour | Under reduced motion |
|---|---|
| Starfield twinkle | constant |
| Sun pulse | constant |
| Recovery | 100 ms linear |
| Pan/yaw coast | none |
| Switch | 180 ms direct reposition plus crossfade, with no spin or displacement |
| Toggle mid-switch | rebases onto the reduced path |
| Manual gestures | still allowed |

---

## 5. Lifecycle and render-loop ownership

- **Mount gate.** `OrreryWorld` (and with it `OrreryCanvas` and its `useClock`) is mounted only while `visible && sessionReady && scene`, where `visible = measured && isFocused && appActive` (`OrreryScreen.tsx:609-610, 1048-1067`).
  - **Unmounting is the pause mechanism** (`OrreryCanvas.tsx:1-21`, runbook pitfall 1): "Canvas visibility is not clock pause."
  - `useClock()` exists only in `OrreryCanvas` and is shared through `OrreryClockContext` with `SunBody`.
- **Things that survive the unmount** because they live on the screen:
  - `pose`
  - the switch runtime: its shared values and `resources`
  - the camera controller
  - session and focus state
- **Focus effect** (`:426-448`):
  - On focus: hydrate preferences, reload the System if already initialised, then set `sessionReady`.
  - On blur: `pauseSwitch()`, cancel intents, `useSystemStore.cancel()`, `cancelAnimation(pose)`.
- **AppState** (`:415-425`): when not active, `pauseSwitch`, capture the session ("background") and cancel intents. When active again, `resumeSwitch` runs once the canvas is visible (`:611-613`).
- **Camera `enabled`** is `visible && !overlaysOpen`. Disabling it resets input, samples, reorder and frame, and stops motion (`use-orrery-camera.ts:137-160`).
- **Shared values and worklets used:**
  - `useSharedValue`, `useDerivedValue`, `useAnimatedReaction`, `withTiming`, `cancelAnimation`, `runOnUI`/`runOnJS`, `useAnimatedProps`/`useAnimatedStyle` (HUD)
  - `react-native-worklets/plugin` (`babel.config.js`; must stay last)
  - **No React state per frame anywhere.**

---

## 6. Themes

- **Colours.** `const { colors } = useTheme()` (`OrreryScreen.tsx:148`) gives a `ThemePalette` (`src/theme/theme-types.ts:50+`), passed as `colors` into `OrreryWorld`. Every Skia colour is a token; `npm run check:colors` (`scripts/check-colors.sh`) fails on any hex, `rgb()` or named-colour literal outside `src/**/theme/**`.
- **Packages and modes.** `THEME_PRESETS` (`src/theme/theme-presets.ts:29`) has two packages, `galaxy` (default, `:335`) and `standard`, each with `dark` and `light` palettes. Mode `system` resolves against the OS. Accents (8 ids) override `accent`. The Orrery forces background art to `none` (ADR-114).
- **Tokens the Orrery reads:**
  - `background`, `surface` (label backplate), `border` (neutral ring/body)
  - `accent` (focus ring, reorder ghost, focused moon)
  - `textPrimary` / `textSecondary` (stars, Polaris, moons)
  - `starPalette[]` (stars, Polaris halo, self-sun default glow)
  - `statusStable` / `statusWobble` / `statusDecay` / `rogue` / `rogueExtinguished` (`ringVisual` in `src/components/contact-card-ring.ts` supplies ring colour, opacity and width)
  - `avatarSwatches[]`, `avatarSwatchText`
  - `TYPOGRAPHY` (label/caption)
- **Overlays.** Floating Orrery overlays use `GlassSurface treatment="orrery-overlay"`: Galaxy 0.91, Standard 0.87 (ADR-149).
- **Profiles to exercise:** galaxy-dark (default, the hero), galaxy-light, standard-dark and standard-light. Light modes put the Orrery on a light `background`, so any 3D lighting, bloom or additive-glow model must still read on a light background.
- **Contract test.** `accent-foreground-role-contract.test.ts:88-97` pins `color={colors.accent}` in `OrreryWorld.tsx` (reorder ghost) and `SatelliteBody.tsx` (focus ring) as sanctioned Skia fills.

---

## 7. High-count behaviour

**No body cap.** Home enforces readability, not a count: `zoom ≥ 10/minRadius` with a floor of 0.25, so large Systems overflow and you pan. The calibration targets are about 6 generous and about 10 comfortable at balanced density (`docs/systems/orrery.md:69`).

**Measures in place:**

- Media culling via `visible` (`orrery-frame.ts:148-153`).
- Settled resource retirement after a switch (RG-027): React list and UI-thread transition (`use-orrery-switch-runtime.ts:191-209, 251-263`).
- Texture cap of 512 px, with on-disk derivatives at concurrency 1.
- Impact and satellite reads chunked at 256 ids.
- Selector custom counts capped at 12 per open.
- The scene read runs outside the mutex, with compute done after the read snapshot releases.

**Known costs, still in place.** These are my analysis from the code:

- Every frame builds `128 × N` ring points.
- Every frame runs `bodies.find` per resource (`billboardPose`, `ProjectedOrbitRing`, `OrreryLabel`), which is O(N²).
- `allocateLabels` checks every candidate against every other (O(N²)).
- `deriveOrreryWorld` collision is O(N²) on JS.
- One Skia `Paint` is allocated per body per frame (`layer` derived value).

**Performance is unmeasured beyond tens of bodies.** Phase 40 owns high-count calibration (`docs/systems/orrery.md:123,147`). Emulator perf claims are invalid; only the physical Pixel counts.

---

## 8. The integration seam

### 8.1 The seam

**`<OrreryWorld …/>` at `OrreryScreen.tsx:1049-1066` is the single seam.** Everything above it is renderer-agnostic: data, store, focus controller, session, camera controller, switch runtime and HUD. Everything below it is Skia. A `OrreryWorld3D` with the same props can be swapped in at that one JSX site, for example behind a const or a `__DEV__` flag.

Props that must be honoured (`OrreryWorld.tsx:167-205`):

| Prop | Contract |
|---|---|
| `scene: OrrerySceneSnapshot` | Source of bodies, names, photos, status and gravity. Use `scene.generation` for every intent. |
| `camera: OrreryCameraController` | **Must write `camera.frame.value` (a `ProjectedFrame`/`AnimatedFrame`) every frame.** `OrreryFocusContext` positions from it. Use `camera.stop/recover/coast`, `camera.reorder` (drag SV) and `camera.active` (null when idle; gates focus-lost). |
| `pose: SharedValue<CameraPose>` | The only camera state. Read it; mutate only through gesture steps / `recover`. |
| `viewport: CameraViewport` | Includes `obstacles`. The projection centre is `usableCameraRect(viewport)` centre (off-axis). |
| `colors`, `fontProvider` | Tokens; Skia font provider (optional for a 3D label path). |
| `onIntent(intent: OrreryIntent)` | Kinds `clear|focus|profile|group|satellite`, with `targets` / `satelliteTarget` and `generation`. Profile is gated by "label visible" (§3.2). |
| `onReorder(ReorderIntent)`, `onReorderActivated()` | Hold-reorder commit and haptic acknowledgement. |
| `focusedIds: number[]`, `clusterIds`, `focusedSatellite` | Focus ring, label priority and focus-lost tracking. |
| `satellites?: OrrerySatellite[]` | Shown only at identity/detail level and only for `interactive` parents. |
| `switchRuntime: OrrerySwitchRuntime` | Sample `transition` / `progress` / `cameraFrom` / `cameraTo` each frame. Render the union `switchRuntime.resources` (keyed) so departures can animate out. |
| `onFocusLost?` | Fire on the transition to off-screen (more than 44 px margin) while the camera is idle. |
| `interactive` | Gesture `enabled`. |
| `focusedRelationById?` | Currently not passed (defaults to `{}`). |

### 8.2 Reusable unchanged versus Skia-specific

**Reuse unchanged (pure logic, screen, HUD):**

- **Logic modules:** `src/logic/orrery-camera-logic.ts`, `orrery-frame.ts`, `orrery-world-logic.ts`, `orrery-geometry-logic.ts`, `orrery-ring-logic.ts`, `orrery-label-logic.ts` (`allocateLabels` / `semanticLevel` / `labelContext` / `orreryInitials`), `orrery-satellite-logic.ts`, `orrery-focus-logic.ts`, `orrery-reorder-logic.ts`, `orrery-gesture-logic.ts`, `orrery-recovery-logic.ts`, `orrery-switch-choreography.ts`, `orrery-system-logic.ts`, `orrery-session-logic.ts`, and `sun-occupant-logic.ts`.
- **Services, stores and data:** `src/services/orrery-scene.ts`, all `src/db/orrery-*` and `ring-seq-dao.ts`, and stores `orrery-system-store`, `orrery-preferences-store` and `orrery-session-store`.
- **Hooks:**
  - `use-orrery-camera.ts`, **including `createOrreryGestures`**. RNGH `GestureDetector` can wrap any view, including a GL/WGPU surface, so the gesture stack is renderer-agnostic as long as `frame` is a correct `ProjectedFrame`.
  - `use-orrery-switch-runtime.ts`.
- **HUD components and logic:** `OrreryControls`, `OrreryFocusContext`, `OrreryClusterPanel`, `OrreryContactsSheet`, `OrrerySystemSelector`, `OrreryViewOptions`, `OrreryFeedback`, `OrreryObstacle`, plus `orrery-obstacle-logic.ts`, `orrery-overlay-logic.ts`, `orrery-companion-logic.ts`, `orrery-controls-logic.ts`, `orrery-switch-animation.ts` and `orrery-satellite-context.ts`.
- **`OrreryScreen.tsx`:** everything except the one JSX swap. `useFonts` can stay if Skia labels or paragraph measurement are reused.
- **`use-orrery-photo.ts` → `loadOrreryImage`:** the loader logic, cancellation and derivative cache. Only the output type (`SkImage`) is Skia.

**Skia-specific (replace in a 3D renderer):**

- `OrreryCanvas.tsx` (Canvas, `useClock`, starfield, `GestureDetector` host)
- `orrery-clock-context.ts`
- `OrreryWorld.tsx` (render tree, `ReorderGhost`, `ProjectedBody`; keep its frame/label/gesture wiring logic as the template)
- `OrbitBody.tsx`, `SunBody.tsx`, `SatelliteBody.tsx`, `ProjectedOrbitRing.tsx`, `Polaris.tsx`
- `OrreryLabel.tsx` (Paragraph drawing; `prepareOrreryText` measurement is Skia but could be kept)
- `useOrreryPhoto`'s `SkImage` return
- `SystemPreviewCanvas.tsx` is a **separate** Skia consumer in System Builder. Leave it.

### 8.3 Minimum contract checklist for `OrreryWorld3D`

- [ ] Same props as `OrreryWorld`; mounted only under the same gate (`visible && sessionReady && scene`), so unmounting stops the GPU loop.
- [ ] Owns its **own** render loop / clock inside the unmountable subtree; nothing animates while blurred or backgrounded. No React state per frame.
- [ ] Each frame: sample `switchRuntime` (world + camera) → `previewReorder` → `deriveSatelliteBodies(level)` → produce an `AnimatedFrame` whose screen-space `x, y, radius, hitRadius, depth, opacity, interactive, visible, ringPath` **match what is drawn**. Either match the pinhole model in §2.2 exactly and keep `projectAnimatedFrame`, or derive the frame from the 3D camera's own matrices.
- [ ] Publish that frame to `camera.frame.value` every frame. Hits, labels, focus card, reorder and focus-lost depend on it.
- [ ] Gesture: reuse `createOrreryGestures({pose, frame, camera, extent: cameraExtent(scene.extent), send: onIntent, enabled: interactive, stop, coast, reorder:{drag: camera.reorder, expectation, generation, acknowledge, commit}, resolveTap: resolveSatelliteTap(…identities, allocatedLabelIds, members), onNorth: hitPolaris → recover(northTarget)})`, as at `OrreryWorld.tsx:424-475`.
- [ ] Profile-vs-focus depends on **which labels are currently allocated** (`allocations.value.map(l => l.id)`), so a label system that exposes an allocated-id list is required.
- [ ] Camera: Home top-down, north up; tilt [0, 60°]; yaw about the sun axis; zoom [0.25, 4]; pan clamped to ±extent. No free flight, no camera under the plane.
- [ ] Billboards: photos and initials stay circular and screen-facing; labels horizontal; depth-sorted occlusion allowed. Hits stay inclusive: every plausible target forms a group.
- [ ] Visual semantics:
  - status ring treatments (solid / dashed / faded / faint-trace) and fills;
  - rogue cold body with warm ring;
  - neutral null-status;
  - outward drift;
  - Gravity ±10% size;
  - sun glow = occupant status colour or chosen star colour;
  - self sun (`id 0`) has no label and is not tappable;
  - focus accent ring;
  - reorder ghost and highlight;
  - Polaris landmark.
- [ ] Satellites: only at identity/detail, only for interactive parents; context-only actions.
- [ ] Semantic zoom thresholds and hysteresis unchanged; context line only at detail.
- [ ] Switch: render union resources; departures `interactive:false`; entering bodies interactive at 0.82; reduced path (180 ms, no spin).
- [ ] Reduced motion read live from `useReducedMotionShared()` inside the render loop for all ambient effects.
- [ ] All colours from `colors` tokens (shader uniforms included); `check:colors` clean. Light palettes must read.
- [ ] Textures ≤ 512 px from the derivative pipeline; dispose GPU textures on unmount or swap; no network.
- [ ] Viewport obstacles: projection centre and label/hit region = `usableCameraRect(viewport)`.

---

## 9. Tests that constrain the Orrery

Run with `npx vitest run <files>`; the runbook smoke set is at `orrery-visual-layer.md:273`.

**Would break or need updating if the Skia renderer is bypassed or replaced:**

- **`src/components/orrery/orrery-render.test.tsx`** renders the real `OrreryWorld` and asserts the Skia node tree: three consecutive `skGroup` bodies in the depth batch, the moon colour token, transform scale, and native paragraph measurement (`:188-332`). It is Skia-tree-specific.
- **`src/components/orrery/orrery-frame-mapper.test.ts`** Babel-compiles **`src/components/orrery/OrreryWorld.tsx`** by path and finds the worklet containing `projectAnimatedFrame` (`:48-75`). It breaks if `OrreryWorld.tsx` is deleted or its frame worklet moves. It keeps passing if the file is left intact and a sibling `OrreryWorld3D` is added.
- **`src/screens/orrery-screen-framing.test.ts`** loads `OrreryScreen.tsx` with a module stub keyed on `id.includes("OrreryWorld")` and later calls `find("World")` (`:268, 327, 342, 390`).
  - If the screen renders a different component (e.g. `OrreryWorld3D` from another module), the stub still matches a path that contains "OrreryWorld".
  - A differently named module would be replaced by the default Proxy (returns null), and `find("World")` fails.
- **`src/services/orrery-scene.test.ts`** imports `createOrreryGestures` **from `@/components/orrery/OrreryWorld`** (`:2`) and mocks `OrbitBody` / `SunBody` / `OrreryCanvas` (`:25-27`). Keep that re-export.
- **`src/theme/accent-foreground-role-contract.test.ts:88-97`** pins exact source text `color={colors.accent}` in `OrreryWorld.tsx` and `SatelliteBody.tsx`. New accent usages in new files may need to be added to that allowlist.
- **`src/services/photos/photo-writer-contract.test.ts:~100`** allowlists `use-orrery-photo.ts` as a plain-URI photo reader. A new texture loader importing the plain resolver would fail.
- **`src/components/orrery/use-orrery-photo.test.ts`, `use-orrery-photo-hook.test.ts`, `src/services/photos/orrery-derivative-*.test.ts`** cover the SkImage loader and lifecycle. They are unaffected unless that file is changed.

**Constrain any new code** (good guards to keep green):

- **`orrery-worklet-order.test.ts`** scans **every** non-test file in `src/components/orrery/` and every `src/logic/orrery-*.ts` for same-file worklet forward references (`:208-228`). New 3D files placed there are checked automatically.
- **`orrery-worklet-boundary.test.ts`** checks the camera worklet boundaries.
- **Pure logic:** `orrery-camera-logic.test.ts`, `orrery-frame.test.ts`, `orrery-label-logic.test.ts`, `orrery-satellite-logic.test.ts`, `orrery-reorder-logic.test.ts`, `orrery-gesture-logic.test.ts`, `orrery-recovery-logic.test.ts`, `orrery-switch-choreography.test.ts`, `orrery-switch-runtime.test.ts`, `orrery-focus-logic.test.ts`, and `orrery-world-logic.test.ts` (geometry, density).
- **Data:** `orrery-system-read.test.ts`, `orrery-read.test.ts`, `orrery-satellites-read.test.ts`, `orrery-impact-read.test.ts`, `ring-seq-dao.test.ts`, and `orrery-exploration.integration.test.ts`. The integration test runs a real SQLite pipeline and calls `projectFrame` from camera-logic.
- **HUD:** `orrery-controls-render.test.tsx`.
- **Gates beyond vitest** (memory: tsc-in-post-merge-gate): `npx tsc --noEmit` and `npm run check:colors`. Vitest passing does not imply tsc is clean.

---

## 10. Gotchas relevant to a renderer rewrite

From memory, runbooks and phase artifacts:

1. **Worklet forward references crash only on Hermes.** A worklet that calls a same-file worklet declared *later* captures it as `undefined` on device and throws "undefined is not a function". Vitest passes.
   - Phase 29 had both two-finger camera gestures and hold-reorder force-closing (`29-UAT.md` gaps G-29-crash-camera / G-29-crash-reorder; fix `f979263`; note at `orrery-camera-logic.ts:297-302`).
   - Rule: define helpers above callers. The guard test covers `src/components/orrery` and `src/logic/orrery-*`. **Do not put 3D worklet code elsewhere without adding it to `TARGETS`.**
2. **Hermes has no `globalThis.crypto`.** Unguarded `crypto.randomUUID` / `.subtle` throws on device but passes under Node/vitest. Any 3D library or ID helper touching `crypto` needs a guard (RNQC is installed).
3. **Canvas visibility is not a pause.** Only unmounting stops a Skia clock. The same applies to a GL/WGPU loop: tie it to the mount gate.
4. **Persistence-only Zustand publications** once prematurely settled a running switch (`30-12-DEVICE.md`). Keep `shouldPublishSwitchScene`.
5. **Skia `SkImage` disposal ordering.** Disposing while it is still the rendered prop throws. GPU textures need the same commit-after-replace discipline.
6. **adb tap false negatives.** Small RN Pressables can silently miss `input tap`, and the right input method varies by control (memories adb-tap-false-negatives, adb-input-source-taxonomy). Verify against code before calling a control broken.
   - The 30-12 reduced-motion run saw adb presses on selector rows not activating with `animator_duration_scale=0`.
   - Use `uiautomator dump` bounds rather than hardcoded coordinates.
7. **LogBox "Open debugger" toast** on debug builds eats tab-bar taps. Dismiss it first.
8. **Metro port.** The Orbit dev client requests :8081 while quest-board owns it, so run `adb reverse tcp:8081 tcp:8082` with Orbit's Metro on 8082. A redbox "Cannot find native module ExpoWebBrowser" means quest-board JS was loaded.
9. **Debug-build jank is dev overhead.** Phase 29 judged camera smoothness on release. Perf claims need the physical phone and must say which thread the evidence covers (`gfxinfo` = UI/render thread only). Emulator numbers are meaningless for GPU work.
10. **Android `elevation` on translucent backgrounds paints an opaque inner rect.** Relevant if HUD or labels become RN views over a GL surface.
11. **tsc is not covered by vitest.** Run `tsc --noEmit` plus `check:colors`. Orphaned tests asserting an old contract also break tsc.
12. **Builds happen on `droid`** via tar-over-ssh, never git push. Debug-first iteration with one release at the end. No Drive uploads without approval. Never hardcode a device serial (use `emu-connect` + `adb devices`). The 6 Pro and the 3a are both test phones.
13. **Reanimated 4 / worklets.** The Babel plugin is `react-native-worklets/plugin` and must be **last**. Any 3D library with its own Babel plugin must come before it.

---

## 11. Versions and app identity

| Item | Value / source |
|---|---|
| expo | `~57.0.13` (lock 57.0.13) |
| react-native | `0.86.2` |
| react | `19.2.3` |
| @shopify/react-native-skia | `2.6.2` |
| react-native-reanimated | `4.5.1` (+ react-native-worklets `0.10.4` in lock) |
| react-native-gesture-handler | `~2.32.0` (lock 2.32.0) |
| react-native-screens | `~4.26.0` (lock 4.26.2; patched) |
| zustand | `^5.0.15` |
| expo-sqlite | `~57.0.1` |
| TypeScript / vitest / biome | `~6.0.3` / `^4.1.10` / `^2.5.8` |
| New Architecture | No flag in `app.json` / `app.config.ts`. RN 0.86 has no legacy-architecture toggle and Reanimated 4 requires Fabric, so **New Arch is effectively mandatory/on**. *(My inference, not verified in a generated android/.)* |
| JS engine | No `jsEngine` override, so Expo's default **Hermes** applies. |
| minSdk / compileSdk / targetSdk | **Not in the tree.** `android/` is **gitignored and absent in this worktree**; it is generated by `expo prebuild` on droid. There is no `expo-build-properties`. Read the values from `android/gradle.properties` / `android/build.gradle` after prebuild. Device notes: the Pixel 6 Pro runs SDK 37. |
| 3D libs | None installed: no `expo-gl`, `three`, `@react-three/fiber`, `react-native-wgpu`, `react-native-filament` or `expo-dev-client`. Any of them is a new native dependency that requires a clean prebuild on droid. |
| node_modules | Absent in this worktree; run `npm ci` before tests. `postinstall` runs `patch-package` against 3 patches. |

**Changing the app id to `com.bwales.orbit.labc` and the name to "Orbit Lab C":**

1. **Android package:** `app.config.ts`, `android.package: "com.bwales.orbit"` (line 75; the comment block calls it "install-locked"). Change it to `"com.bwales.orbit.labc"`. `app.json` has no package. **`android/` is not checked in**, so there is nothing else to edit; prebuild regenerates `applicationId`/`namespace`.
   - `plugins/withWidgetBootReceiver.js:110` reads `cfg.android.package`, so the receiver follows automatically.
   - The widget provider authority uses `${applicationId}` (`patches/react-native-android-widget+0.22.0.patch`), so it follows too.
2. **Display name:** `src/constants/app-name.json`, `{ "APP_NAME": "Orbit" }` → `"Orbit Lab C"`. `app.config.ts` imports it as `name` (desktop-build-pipeline runbook §"Rename the app"). The in-app About screen and notifications read the same constant via `src/constants/app.ts`.
3. **Optional but recommended — avoid intent collisions with the real Orbit on the same phone.** Both installs would register the same handlers:
   - `scheme: "orbit"`;
   - the `orbit://openrouter-auth` intent filter;
   - the `text/plain` share target;
   - the JSON backup share target.

   This gives chooser ambiguity, not data crossover. Consider `scheme: "orbitlabc"` in `app.config.ts`, plus the matching OpenRouter redirect if AI is ever exercised (it should not be).
4. **Build host path:** the runbook's remote path is `C:\Users\bwales\projects\orbit-app`. Use a **separate** droid directory for Lab C so the primary build tree is not clobbered.
5. **Hardcoded package strings to update for tooling only** (they do not affect the build): `scripts/dev/art-signoff-capture.py:47` (`PKG_ID`), and `run-as com.bwales.orbit` in runbooks and UAT commands.

---

## 12. Seeding synthetic data on a fresh install

There is **no in-app dev seed button or fixture loader** for contacts. The existing `__DEV__` hooks are theme/art/Phase-38 UAT controls (`src/components/ui/__dev__/`). The real write paths are listed below. Recency (`last_contact`), status and progress are **derived** from interactions by `recomputeLastContact` (the single recency writer, ADR-010), so seeds must create interactions, not set `last_contact`.

**Option A — restore a synthetic backup (no code change, exercises production paths).**

1. **Generate a plaintext manifest.** `BACKUP_FORMAT_VERSION = 7` (`src/backup/types.ts:14`), shape as in `syntheticManifest()` (`src/services/backup/__dev__/ingress-measure.ts:46-100`). Add:
   - `interactions` with `occurredAt` spread so progress lands in each band: stable < 0.8, wobble, decay 1–3, rogue ≥ 3;
   - `intervalDays` variety;
   - some contacts with no interactions (neutral);
   - `relationships` (moons);
   - `categories` + `categoryUid`, and optionally `systems` / `systemRules`;
   - `favouriteRank`;
   - photos as `photoBase64`.
2. **Photos.** `scripts/dev/photo-library-fixture.py` already builds N contacts with real-photo masters (WebP 1024 or JPEG 512), but writes `interactions: []` and `relationships: []`. Extend it, or post-process the JSON.
3. **Validate** with `npx tsx scripts/dev/validate-backup-fixture.ts file.json`.
4. **Restore on the device:**
   - push it to Downloads and use Settings → Backup → Restore (SAF picker); **or**
   - share the JSON to the app (`plugins/withBackupRestoreShareIntent.js` registers `application/json`/`text/json`).

   Use `replace-all` mode (`RestoreMode`, `src/backup/restore-apply.ts:85`). Restore recomputes `last_contact` for every surviving contact (`restore-apply.ts:2051-2058`).

**Option B — a `__DEV__`-only seed function** (deterministic, scalable to N bodies for perf; Lab-C-local code). It calls the production DAOs inside the app:

- `createContactWithInteraction(exec, {uid, name, intervalDays, now, firstInteraction?})` (`src/db/recency-dao.ts:433`; omit `firstInteraction` for never-contacted).
- `recordTouchpoint(exec, {contactId, uid, occurredAt, now, …})` (`:268`; rejects future dates).
- `addRelationship(exec, {contactId, personName, createdAt, now})` (`src/db/relationships-dao.ts:228`; moons).
- `src/db/systems-dao.ts` for custom Systems.
- `updateAppSettings` for `sunContactId` / density / satellites.

`orrery-render.test.tsx:192` shows the minimal raw contact row that the scene accepts: `contacts(uid,name,tracking_enabled=1,interval_days,created_at,modified_at)`. UID generation must avoid unguarded `crypto` (gotcha 2).

**Option C — device contacts import.** Create Android contacts through ContactsProvider `content insert` (memory: device-local-contact-fixtures), then use the app's contact import. This is slower and has no interaction history, so every contact is neutral.

Recommended: B for scalable perf scenes (10/30/100/300 bodies), A for photo realism. Use synthetic data only; test phones are for testing (memory).
