# Orrery Lab C — decisions log

Chronological, oldest first. Each heading names its checkpoint, and the commits are listed in README.md.
Performance and memory decisions (C.4, D.5, D.6, E.1, F.2) are written up in full in PERFORMANCE.md; the
entries here point to them. Entries added when the research package was assembled are marked *(package)*.

## 2026-10-01 — M0: renderer choice *(package; commits 167bbcaa, 38616b7c)*

Imperative three.js `WebGPURenderer` on `react-native-webgpu 0.10.4` (Dawn/Vulkan), with Skia kept for text
and photo decode and the existing UI-thread pose and projection kept as the source of truth. The fallback was
expo-gl + three WebGLRenderer. Skia "real projection", Filament, Babylon and Unity were rejected. R3F was
rejected for the prototype: the reconciler invites React-driven animation and has an open double-renderer bug.
Full survey: RENDERER-DECISION.md. The app identity was changed to `com.bwales.orbit.labc` so the lab
installs beside the real app.

## 2026-10-01 — M1: first true-3D world *(package; commit 205c1462)*

`OrreryWorld3D` drops in at the `OrreryScreen` seam. It packs data UI→JS per changed frame and runs its own
rAF loop. It uses instanced lit spheres, atlas face billboards, one-draw TSL rings, a star slab, sun glow and
a label overlay. Spike lessons recorded in code comments (`three/orrery-gpu.ts`; the referenced
`_notes/M1-BUILD.md` was never committed):
- `requestDevice()` during SurfaceView creation blocked JS and main for about 32 s → prewarm a device at module
  load and after each unmount, and mount the `<Canvas>` only once a device is held.
- A process-wide shared device leaked every renderer (three's per-renderer `device.lost` reaction): about
  +200 MB external per remount and a JS SIGSEGV on the 3rd–4th remount → one device per mount, destroyed on
  unmount.
- `device.queue` creates a new native wrapper per read in 0.10.4 → pin one.
- The CMake build fails at minSdk 24 (`AHardwareBuffer_*`) → `plugins/withLabCMinSdk.js` (minSdk 26).
- `projectFrame`'s 128-point `ringPath` per body dominated the UI thread at 200 bodies →
  `projectAnimatedFrameLite` (same math, no ring paths, parity test).
The camera in this commit reproduced the 2.5D pinhole exactly. That became the dead end in the next entry.


## 2026-10-01 — Parity camera abandoned; real perspective camera adopted

**Dead end (commit 205c1462).** The first true-3D build drew a three.js WebGPU scene but
viewed it through `orreryCameraRig` configured to reproduce the production ADR-077 pinhole
pixel-for-pixel: focal distance derived from the scene extent (~4.6× extent, telephoto),
`zoom` narrowing the FOV instead of moving the camera, default tilt 0 (top-down), max tilt 60°.
The output was indistinguishable from the 2.5D Skia Orrery, so the owner's goal (a visibly
deep, game-like star-system map) was not met. The parity requirement was an orchestrator
mistake and is withdrawn. (fff81462 additionally left `LAB_STAGE="context"` and
`LAB_C_TRUE_3D=false`, so nothing 3D rendered at all; both removed/flipped.)

**New camera model.** Still one pinhole formula shared by the UI-thread projection
(`orrery-frame-lite`, hits/labels/focus) and the three camera (`orrery-camera-rig`), so
drawn == tappable — but with real-camera parameters (`src/logic/orrery-camera-logic.ts`):
- fixed focal length `LAB_FOCAL_PX = 720` logical px (≈50° vertical FOV on the Pixel 6 Pro);
- dolly distance `F / zoom` from the pivot (`clampCameraPose` writes it into `focalDistance`),
  so pinch is a dolly and perspective strength grows as you move in;
- default tilt `LAB_HOME_TILT = 1.08` rad (~62° from vertical), `MAX_TILT = 1.32` (~76°);
- yaw orbits the pivot; focus flies the pivot to the contact and dollies in;
- points at/behind the camera no longer throw on the UI thread: `perspectiveScale`/unproject
  clamp the denominator and frame-lite culls bodies inside 12% of the dolly distance.

Depth cues in `orrery-scene3d.ts`: sun point light + low ambient (lit side / terminator on
body spheres), per-pixel sun lambert on the photo billboards (view-space sun vector per
instance), range fog to the background token, ring opacity falloff with view distance,
thinner ring strokes, star sphere around the camera (rotational parallax), emissive sun core
with limb darkening + additive glow + wide corona.

Known consequences: 7 vitest cases in camera/frame/gesture/recovery/reorder logic encode the
old 2.5D contract (tilt 0 home, 60° max, throw-on-horizon) and now fail; to be rewritten
for the 3D contract in a follow-up.

## 2026-10-01 — Checkpoint B.1: strategy-map camera gestures

`createOrreryGestures({ strategyCamera: true })` (3D world only; the Skia world and its tests keep
the production mapping):
- **one-finger drag orbits**: new `CameraStep` `orbit` — `yaw -= dx·0.0076` (full-width drag ≈ 180°,
  grab-the-turntable sign), `tilt -= dy·0.0052` (drag up leans toward the horizon), clamped to
  `[0, MAX_TILT]` by `clampCameraPose`. Every sample composes on the UI thread into `pose`.
- **inertia**: release velocity → `inertiaTarget(kind "orbit")` (velocity × 0.32 s, capped ±1.2 rad
  yaw / ±0.35 rad tilt) played as a 900 ms coast on the existing quintic ease-out recovery curve
  (reads as damping). Reduced Motion disables it, as for pan/yaw coast. Any new touch `stop()`s it.
- **two-finger drag pans** the pivot (the former 2-finger vertical-tilt recognizer, now activating
  on centroid travel in any direction, feeding `panCamera`); pan stays bounded by
  `clampCameraPose` (pivot within ±extent) so the system cannot be lost.
- pinch = dolly (unchanged), two-finger twist = yaw (unchanged), tap/long-press reorder unchanged
  (reorder's hold still fails on > HOLD_SLOP movement before the orbit claims ownership).
- recenter = `deriveHomePose` (tilt 1.08, yaw 0, home zoom) via `camera.recover` — unchanged.
Device-verified: adb swipe orbits (screens 01→02), tap after orbit focuses (03). Not device-testable
via adb: two-finger pan, pinch (multi-touch).

## 2026-10-01 — Checkpoint B.2: framing, hero bodies, label tiers for the 3D camera

- **Framing.** `CameraViewport.camera` (new, optional) is the rect whose centre is the projection
  centre; `cameraCenterRect()` falls back to the usable rect, so the production/2D path is unchanged.
  OrreryScreen sets it to the canvas minus full-width bars only (selector row, tab bar) — the right
  control column, cluster panel and focus card stay obstacles for labels/framing but no longer push
  the whole system into the top third. Used by projection, unprojection, frame-lite and the three rig
  (drawn == tappable preserved).
- **Focus framing.** `focus()` re-caps zoom to IDENTITY_ZOOM after `frameBodies`; with a lower
  projection centre that slid the body under the focus card. Single-body focus now solves the pivot
  (3 fixed-point steps of project/unproject) so the body lands on the usable-rect centre at the final
  zoom; the card then sits below it.
- **Hero bodies.** Contacts' world radius ×1.9 (`CONTACT_HERO_SCALE`) inside the 3D world's sample —
  the same radius feeds the UI-thread frame (hits) and the GPU packet, so drawn == tappable. Hit
  circles grow with it (more `group` taps where bodies overlap — accepted for the lab).
- **Label tiers.** The PRODUCT rule (overview: focused/cluster only; identity: names; detail: names +
  context; thresholds IDENTITY 2 / DETAIL 3 with hysteresis) is unchanged. Its input is re-derived:
  instead of `pose.zoom` it is the median on-screen magnification of visible contacts relative to their
  un-heroed world radius (`effectiveLabelZoom`) — i.e. names appear when bodies are as large on screen as
  when the old near-orthographic camera crossed the tier. Satellites' tier uses the same level.
- **Label legibility/occlusion.** Labels keep the theme `surface` plate (existing rasterizer); gap to
  body 8→4 px so the name visibly belongs to its body; allocation now ranks same-priority labels
  nearest-first (`LabelCandidate.depth`), and every visible body is an exclusion, so a far label can't
  sit on a near body. The focus card is not a shell obstacle (it follows the body), so the 3D world
  reserves a 290×230 rect below the focused body — no label renders under the translucent card.
- Lab badge presets now also dolly (×1, ×2.2, ×3.4 home zoom) to reach the tiers without pinch.

## 2026-10-01 — Checkpoint B.3: visual pass (overview composition, star, plane)

- **Overview composition.** `CameraViewport.camera` height ×0.62 ⇒ a lens shift putting the pivot (sun)
  at ~31% of the canvas, so the receding far half reaches the top of the canvas and the near half fills
  the bottom (screens 10 vs 04). `deriveHomePose` additionally dollies in while the far rim stays under
  the camera-rect top and the system half-width ≤ 0.6 viewport — on the dense seed the width bound
  already binds at the top-down fit, so the lens shift is what fixes the empty sky. (deriveHomePose was
  moved BELOW projectWorldPoint: worklet forward-reference rule.)
- **Star.** Sun core is an emissive sphere with limb darkening + drifting 2-octave
  `mx_fractal_noise_float` granulation on the local normal + a hot core term; sun ×1.45 hero scale.
  The occupant is a framed medallion (face inset to 80% of the plate, glow-token gold bezel with a bevel
  highlight and warm vignette), plate 0.74 of the sun radius, so the person sits IN the star.
  Compromise: the seeded self occupant has no photo and its tile renders as a plain swatch, so the
  medallion interior is still a flat periwinkle (not a renderer limitation — a real photo fills it).
- **Orbital plane.** One additive CircleGeometry disc (1.18 extents) under the plane: radial dust falloff
  + 9 polar grid rings + 24 spokes, tinted by the theme `accent` token, faded at the edge.
- **Bloom: not added.** A real bloom pass (three PostProcessing BloomNode) adds 2+ full-screen passes;
  the frame is already JS/present-bound. The existing additive sun glow + corona stands in. Dead end
  candidate for a GPU-thread renderer, not tried.
- **Cost.** Renderer log on the Pixel 6 Pro: before B.3 ~47–51 fps (jsRender ~11.3 ms); after, 42 fps at
  overview, 31–34 fps dollied in close (present 4.9→10.6 ms: fill cost of the noise star + plane at
  close range). Overdraw is the lever (smaller plane disc, cheaper noise) if this ships.

## 2026-10-01 — Checkpoint B.4/B.5: "Unavailable System", tests

- **"Unavailable System" is pre-existing app behaviour, not the seed or the lab.** On screen focus,
  OrreryScreen restores `preferences.lastSystem` via `select(system, undefined)` (no name). The store's
  name fallback (`orrery-system-store.ts` ~104) resolves names only for built-ins and categories; for a
  `custom` System (all three Lab C seed Systems are custom) the name falls to "Unavailable System", and
  the post-load `currentName` again resolves categories only, so it never recovers. Files are unchanged
  vs `main`. Would reproduce in production for any user whose last System is custom. Fix (not applied —
  production behaviour, owner's call): pass the catalog entry's name on restore, or resolve custom names
  from the loaded snapshot.
- **Tests.** The 7 old-2.5D-contract cases (tilt-0 home, 60° max, throw-on-horizon, …) were NOT rewritten
  in this checkpoint (time box); they still fail exactly as at da5433a9. New coverage:
  `orrery-strategy-camera.test.ts` (orbit step, orbit inertia cap + Reduced Motion, two-finger pan bound).
  `npx tsc --noEmit` clean.
- **Sun occupant without a photo** still renders as a flat swatch inside the bezel: the seeded self has
  no photo and (apparently) empty initials. Next step: initials/icon on a shaded plate with the star
  glowing through.

## 2026-10-01 — Checkpoint C.1: "Unavailable System" fixed on the LAB BRANCH ONLY

OrreryScreen now reconciles `requested.name` from the loaded Systems catalog whenever the requested
System is `custom` (one effect after the catalog loader; `useSystemStore.setState`). The store itself is
untouched. This is a **pre-existing main-app bug** (any user whose last System is custom sees
"Unavailable System" after re-entering the Orrery); this branch is never merged, and the fix on `main`
is the owner's decision. Device: selector reads "Lab C Inner" after relaunch
(evidence/04-checkpoint-c/01-system-name-restored-lab-c-inner.png).

## 2026-10-01 — Checkpoint C.2: System switching reinterpreted in 3D

The production choreography is untouched: `sampleSwitchChoreography` (roles retained/leaving/entering/anchor,
phases SHED 0.18–0.58, CAPTURE 0.44–0.82, SETTLE 0.72, stagger 0.035, spin turns by intensity, 2100 ms
driver, 180 ms Reduced Motion crossfade) still owns x/y, radius, opacity and interactivity. The 3D world
ADDS, all computed on the UI thread inside the existing packet reaction / sampled camera (no React state):
- **Vertical axis** (`switchDepth`, packet stride 6→8: `lift`, `flare`): leaving bodies fall below the plane
  (`0.42·extent·shed²`) while they spiral out and fade, so they sink into the range fog; entering bodies
  streak in from above (`0.55·extent·(1−capture)²`) and land on their orbit; retained bodies stay ON the
  plane (they are interactive throughout, so drawn == tappable is preserved; entering bodies only become
  interactive at 0.82, when their residual lift is ≈0).
- **Capture flare**: in a 0.16-progress window around each entering body's capture end, its orbit ring
  brightens (alpha ×(1+1.4f)) and widens (×(1+2f)), plus a small additive accent-token halo (pool of 24).
- **Camera breath** in the sampled switch camera: dolly-out up to 24%, yaw +0.38 rad, tilt −0.1 rad on a
  sin² envelope scaled by intensity — zero at p=0 and p=1, so the destination Home is landed exactly.
  It lives in the sampled pose, so the UI-thread frame and the three camera stay one pinhole.
- Reduced Motion: no lift, no flare, no breath (the production 180 ms crossfade only).
- Evidence: `04-checkpoint-c/02-switch-inner-to-core-to-dense.mp4`, `03-switch-dense-to-inner.mp4`,
  `04-switch-mid-t*.png` (frames pulled from the recording). Log line `[lab-c] switch gen=… retained/leaving/
  entering` proves the choreography fires (Dense→Inner: retained 10, leaving 110, entering 7, intensity 0.85).
- **Orchestrator review (a)** "Core→Dense shows no transition": the first recording simply ended while the
  Dense snapshot was still loading (~2 s scene read for 120 contacts; the old System stays mounted until the
  destination is ready — production behaviour). The renderer log confirms Dense renders 121 bodies.
- **Review (b)** "destination doesn't frame the whole System": not changed. Home is the production
  readability rule (`zoom ≥ 10/minRadius`, research §7: "large Systems overflow and you pan") plus the B.3 lab
  composition. Fitting the full extent would shrink bodies below the readability floor — a product call,
  flagged for the owner rather than reversed here.
- Known issues seen in the recordings: (1) the scene read for a switch takes 1.4–2.5 s before any motion
  (pre-existing load latency, not renderer); (2) one frame right after the selector closes shows the upper
  canvas black (a single-frame present glitch, not chased); (3) a camera step when the selector closes,
  before the choreography starts (not chased).

## 2026-10-01 — Checkpoint C.3: sun occupant without a photo

The seeded self has no photo and an empty name, so the medallion was a flat periwinkle swatch. Now the sun
tile is drawn as a **shaded plate**: theme `surface` token disc, darkened rim (neutral alpha radial ramp),
soft top-left highlight, and the star's glow token as ink — the occupant's initials, or a **person glyph**
(head + shoulders) when there are none (`BodyAtlas.drawInitials(..., plate)`; `BodyInfo.plateInk`). In the
shader the medallion interior is 86% opaque so the emissive star core glows through it, and the warm
rim tint now starts at 30% of the plate radius (was 60%) so the glow wraps further in. A real photo still
replaces the tile. Evidence: `05-sun-occupant-glyph-overview.png`, `06-sun-occupant-glyph-close.png`.
Side observation: one relaunch showed "Couldn't load this System" (transient; Reload System recovered it,
no JS error logged) — likely the force-stop/relaunch racing the DB open; not investigated.

## 2026-10-01 — Checkpoint C.4: performance recovery

See `PERFORMANCE.md`. Plane pattern + star granulation baked into textures, corona 16→11 sun radii, lighter
sphere/ring geometry, and the render DPR cap lowered 2.5 → 2.0 (visible softening is small at 411 dp width;
it is the change that actually moved fps — the frame was fill-bound). The phone hit thermal SEVERE during the
session; close-range targets were not met under that condition.

## 2026-10-01 — Checkpoint C.5: Dense System (121 bodies) + whole-disc Home for large Systems

- Seed unchanged: "Lab C Dense" already has 120 contacts (renderer log `bodies=121` incl. the sun;
  `bodies=152` once satellites appear at the identity tier).
- **Before** (production readability floor + B.3 strategy composition): Home dollied in to the readability
  floor; ~30 of 121 bodies on screen, the far half compressed under the selector row and the rest off-screen
  (`07-dense-overview.png`). Near/close tiers read well, CJK and emoji labels render (`08`, `09`).
- **After (lab-only, orchestrator request):** Systems with > 24 contacts get a whole-disc Home —
  tilt 0.9 and the largest zoom at which 24 sampled rim points all project inside the usable rect (between
  the header controls and the tab bar). `MIN_ZOOM` lowered 0.25 → 0.08 so Dense can dolly out that far.
  Result: whole disc visible, 120 of 121 bodies drawn (`drawnSpheres=120`, `10-dense-overview-whole-disc-fit.png`).
  **Honest judgment: the bodies become specks** — the disc reads as a ring pattern, not as people. This is
  exactly what the production readability floor (`zoom ≥ 10/minRadius`, research §7) prevents, so this
  deliberately overrides a recorded product rule on the lab branch and must be an owner decision before it
  goes anywhere. Smaller Systems (Inner 17) are unchanged.
- **Ring density fade** (renderer): when orbits pack tighter than 10 px apart on screen, ring alpha and
  stroke width scale down (floor 30%) so 120 concentric rings stop forming a moiré (visible in `10` vs the
  first un-faded attempt). Bodies still need a minimum on-screen size / impostor to read at this distance —
  not done.
- Labels: at the fitted overview no names are shown (overview tier = focused/cluster only); at near (`11`)
  initials on faces only, names appear at the identity tier as before.
- fps at the fitted overview (one reading, thermal status SEVERE): 43.3 fps, present 2.6 ms. Overdraw at
  overview is now low; near/close is fill-bound (see PERFORMANCE.md).
- Tests: `orrery-camera-logic.test.ts` still fails the same 2 cases as at HEAD before this change (old
  readability-floor / extremes contract); the new count branch would additionally contradict the
  "no count branch" assertion once that test is rewritten.
- **Reverted (orchestrator review of 10/11):** the whole-disc fit is disabled (`LAB_FIT_ALL_ENABLED = false`),
  MIN_ZOOM back to 0.25; default Home is the previous framing. Recorded in DEAD-ENDS.md. Ring density fade kept.

## 2026-10-01 — Checkpoint D.1: Dense legibility (core framing + minimum body size)

- **Home for Systems with > 24 contacts** frames the *populated core* (`LAB_CORE_FRACTION` of contacts,
  `coreRadius()` in `orrery-camera-logic.ts`) at tilt `LAB_CORE_TILT = 0.85`: the largest zoom at which the
  core disc projects inside the canvas between the System selector row (camera-rect top) and the usable
  bottom. Smaller Systems keep the strategy-map Home unchanged.
- **Fraction is 0.5, not the suggested 0.8.** Seed rings are linear in rank (`58 + i·34`), so the 80% core is
  0.8× the full extent; at 411 dp it needs zoom ≈ 0.07, i.e. the whole-disc dead end again (node sweep: 0.6
  and 0.8 both bottom out at the zoom floor). 0.5 lands at zoom ≈ 0.087.
- **`MIN_ZOOM` 0.25 → 0.08** (required for that Home; also the user's pinch-out floor). Legibility no longer
  comes from the readability-floor zoom but from:
- **Minimum on-screen size** (`OrreryWorld3D`): contacts ≥ 18 px diameter, moons ≥ 10 px, star ≥ 34 px. Applied
  to the WORLD radius in the UI-thread sample (radius = max(r, minPx/2 / pxPerWorld at that depth)), so drawn ==
  tappable == label anchor.
- **Canvas top inset**: contacts/moons whose centre projects above the camera-rect top (selector/View options
  row) fade over 28 px and become non-interactive, so far bodies no longer pile up under the header.
- **Ring density fade, harder** (orchestrator review): full strength at ≥ 20 px orbit spacing, squared ramp,
  floor 5% (was linear, 10 px, floor 30%). At Dense Home rings are a faint texture; bodies dominate.
- **Counts** (`visibleContacts` now in the 5 s renderer log = tappable contacts with centre on screen): before
  ~30 of 120 (`04-checkpoint-c/07`), after **100 of 120** at Home (`05-checkpoint-d/03`), 51 at near ×2.2 (`04`).
- **The vertical "spine" behind the star is the production layout, not a 3D bug:** never-contacted members
  (`progress === null`) all rest at `NEUTRAL_RESTING_ANGLE = 0` (`orrery-world-logic.ts`), one per ring, so 20
  of them form a radial line due north; at yaw 0 the camera looks straight along it. Not changed (product
  layout rule; spreading neutrals would be an owner call). Visible in 2.5D too, but foreshortening stacks it.
- Not done: name labels at the dense near view (label tier is still magnification-based, so dense views show
  initials only until ≥ identity tier).

## 2026-10-01 — Checkpoint D.2: satellites as 3D moons

- Before: moons were planar spheres at a fixed hash angle around the parent (no height, no motion) and tiny
  (`min(MOON_RADIUS, 0.2·parent)` next to a 1.9× hero parent) — `05-satellite-focused-parent-moon-before-scale.png`.
- Now (`OrreryWorld3D` sample): each moon rides a **tilted local orbit** (inclination 0.5 rad: x = cos a·r,
  y = sin a·r·cos i, height = sin a·r·sin i). The **focused parent's moons revolve** (≈ one turn / 21 s) on a
  Reanimated `useFrameCallback` that is active only while exactly one focused contact has moons and Reduced
  Motion is off; other moons sit still at their hash angle. Moon world radius ×1.7 (`MOON_HERO_SCALE`), min 10 px.
- **Drawn == tappable kept:** `projectAnimatedFrameLite` now projects an optional `lift` with the same pinhole
  as the three camera (h = 0 is exactly the old path); parity test added in `orrery-camera-rig.test.ts`
  (12 lifted cases). The packet carries the lift so the renderer draws the moon at the same 3D point.
- Labels: unchanged production rule — moons have no on-canvas label; the relationship ("Cy · Parent of …")
  appears in the focus card rows (`06-satellite-moon-tilted-orbit-focused.png`).
- **Not verified on device:** tapping a moon (`resolveSatelliteTap`) — the moon is a moving 10–20 px target that
  spends much of its orbit behind the parent/focus card, and adb tap timing could not be made reliable in the
  time box. The hit path consumes the same published frame as the drawing (unit-tested parity). No focus ring
  is drawn on a focused moon yet (the 3D focus ring pool keys by contact id only).
- Seen while testing: at Dense, focus framing (`IDENTITY_ZOOM` cap) dollies very close — the focused body is
  ~170 px and its lower half sits under the focus card. Pre-existing focus framing, not changed here.

## 2026-10-01 — Checkpoints D.5, D.6, E.1: lifecycle and memory *(package; cc2ec75e, f1d9b310, e4d9e842, 1d052ca2)*

Details and tables: PERFORMANCE.md. Decisions in order:
- D.5: the Hermes `external` counter climbs 400–600 MB per mount. Recorded, not fixed (time box).
- D.6: `dumpsys meminfo` shows real memory about flat. The counter is mostly GC-pending RN Skia host-object
  pressure (a flat 1 MB per Paragraph). `BodyAtlas.flush` was changed to snapshot only dirty tiles (it was
  ~26 MB per flush).
- E.1: a ParagraphBuilder also carries 1 MB and has no `dispose()` → one shared builder per font provider
  (`orreryParagraphBuilder`), `OrreryTextCache` with disposal, and label rasters kept while the Paragraph is
  unchanged. Mount external 1569 → 297 MB; the post-gc floor went from +300–575 to about +70 MB per mount.
- E.1 re-measure: releasing CPU buffers at `dispose()` did not move the floor (+72 MB). The mitigation was kept
  because it is harmless; the retainer remains unidentified.

## 2026-10-01 — Checkpoint E.2: satellite focus framing, lit moons, label/disc overlap

- **Focus frames the focused contact's whole system above the focus card** (`OrreryScreen.focus`, single
  target, Lab C only). System radius = hero body, plus moon orbit (parent r + 24) + moon size when the contact
  has moons (`orreryFocusSystemRadius`). The camera dollies so that radius projects to a target size and
  places the system centre so system + card stack sit in the canvas. The IDENTITY_ZOOM cap is not applied to
  this dolly any more (with the perspective dolly it kept the system small); MAX_ZOOM still clamps.
- **The focus card anchors below the whole moon system**, not the parent's disc: the 3D frame carries
  `systemRadius` (px) on the parent, and `OrreryFocusContext` + the label exclusion use it. Both now clamp
  the card to the canvas bottom (camera rect) instead of the usable-rect bottom, so the card may hang beside
  the side-controls column instead of being pushed up over the body.
- **Moons**: own instanced mesh with a small emissive floor (theme `textSecondary` × 0.28) so the night side
  is not a black blot; diffuse lit by the sun key light (terminator kept). Fill = the satellite person's
  avatar swatch; they now get an atlas **face tile with initials** like every other body (no photo — the
  satellite read carries none).
- **Labels never land on another body's disc**: body exclusions and label anchor offsets pad the disc by
  1.15× (perspective sphere silhouette is larger than r·scale off-axis); the reserved focus-card rect uses the
  card's own placement + clamp (the "Ava Abara" overlap was the card rect being reserved lower than where the
  clamped card actually sat).
- **Moon tap verified on device**: tapping the moving moon focused it — card "Dana · Sibling of Chloé
  Castellanos" (`evidence/07-checkpoint-e/s2-moon-tap-uiautomator.txt`, `s2-moon-tap-attempt.png`).
- **Open at this commit:** on device (s3/s4) the focused system is still framed small under the header —
  the target size was bounded by the usable-rect width (narrowed by the side controls). Next commit bounds it
  by the canvas width and logs the rects; re-shot in E.2b.

## 2026-10-01 — Checkpoint E.3: reduced motion verified (no code change beyond a log line)

- Source: the app's live OS signal (`useReducedMotion` / `useReducedMotionShared`, ADR-085), driven on the
  Pixel by Android "Remove animations" (`animator_duration_scale`, `transition_animation_scale`,
  `window_animation_scale` = 0 for one session; all three restored to 1 afterwards and re-read as 1).
- Renderer log (`evidence/07-checkpoint-e/s4-reduced-motion-log.txt`): `reducedMotion=true` reached the world;
  the System switch logged `reduced=true` (180 ms direct reposition + crossfade path; the 3D fall/rise lift,
  capture flare and camera breath are gated on `!reducedMotion` in `switchDepth` / the sampled camera).
- Focused parent with a moon, two screenshots 5 s apart (`s4-reduced-focus-moon-t0.png`, `-t5s.png`):
  **pixel-identical** (diff bbox none) — moon revolution stopped (frame callback inactive under reduced
  motion), star twinkle and sun pulse constant, no idle drift.
- Camera flights: focus recovery uses the shared camera motion's reduced path (100 ms linear); pan/yaw coast
  is disabled by the same shared value. Not separately measured on device (adb cannot fling reliably).
- Switch screenshots `s4-reduced-switch-mid.png` / `-after.png` (Dense → Lab C Inner).

## 2026-10-01 — Checkpoint E.2b: focus framing after orchestrator review (docked card)

- Diagnosis from the focus log (`s5-s6-focus-log.txt`): the usable rect ends at the top of the side-controls
  column (`usable.height ≈ 408` of a ~720 px canvas), and the camera rect is even shorter, so "system above
  the card inside the usable rect" could only ever be small. (The canvas-width bound landed already in
  97d94229; the E.2 note calling it "next commit" is wrong.)
- **Lab C focus card docks at the canvas bottom**, left of the controls column
  (`orrery-focus-card-layout.ts`, shared by `OrreryFocusContext` and the label exclusion in `OrreryWorld3D`).
  The product rule (card hangs under the body, clamped to the usable rect) still applies when no camera rect
  is measured, i.e. outside Lab C. Trade-off: if the user pans the focused body down, the docked card can
  cover it (focus-lost still fires off-screen only).
- **Focus dolly backed off**: the system is centred between the selector row and the docked card, radius =
  min(0.7 × half that height, 0.30 × canvas width with moons / 0.15 without). Result
  (`s6-dense-focus-moon-docked-card.png`): Chloé + both moons large and centred, neighbours, the star and
  orbit arcs stay in view, no empty void under the card. Over-zoomed s5 (Oskar, before) kept as contrast.
- Still open: moons read slightly faded next to the parent (small 10–14 px disc, face shading toward the
  terminator); not tuned further in the time box.

## 2026-10-01 — Checkpoint E.4: light theme profiles

- Before (`s7-galaxy-light-overview.png`, `s7-galaxy-light-focus.png`, `s7-standard-light-*.png`): rings and
  plane grid invisible at overview, fog lerped far bodies to grey ghosts, sun glow (additive) vanished, near
  bodies dark smudges. The focus view was already readable (rings, faces, card, labels).
- Fix (`OrreryScene3D.applyColors`, all via existing tokens; light mode = background luminance > 0.5):
  fog tint = background lerped 12% toward `textSecondary` and reaching 2.6× farther; ambient 0.22 → 0.75;
  glow / corona / capture flare / plane switch from additive to normal blending; plane grid ink
  `textSecondary` at 0.35 instead of `accent` 0.25; ring density floor 0.05 → 0.35; faces never fogged.
- After (`s8-galaxy-light-overview-after.png`, `s8-galaxy-light-focus-after.png`): ring field and plane read,
  far bodies keep colour, the star has a visible warm core + halo, focus view unchanged-good.
- **Compromises / still weak:** at the Dense overview the body spheres still read dark (their fill tokens are
  status colours lit from one side; faces are ~10 px there); a thin outline instead of glow was not tried.
  Standard-light was only shot before the fix (same code path as galaxy-light; not re-shot in the time box).
  Theme restored to Galaxy / Dark after both sessions.

## 2026-10-01 — Tests rewritten for the 3D camera *(package; commit 467b973b)*

The 7 old 2.5D-contract cases (tilt-0 Home, 60° max, throw-on-horizon, …) were rewritten for the dolly
camera: bounded scale and near-plane/horizon round trip, tilted and core Home, top-down flat depth, MAX_TILT
ceiling, on-screen pan-coast bound, dolly-consistent north, sky at MAX_TILT. When this package was written,
`npx tsc --noEmit` was clean and the orrery suites were at 731/733. The 2 failures are in
`orrery-screen-framing.test.ts` and come from the lab-only "Unavailable System" effect (f608d35d) reading
`requested.ref.kind` against a store mock without `ref`. Not fixed (docs-only package).

## 2026-10-01 — Checkpoint F: release build, performance, accessibility, final evidence *(package; c7fcbe80, 334a561e, 567c120d, 4a82ae85, 5abe6016, 6c1d3c68)*

- F.1: `assembleRelease` arm64 with the same debug keystore, installed with `install -r` over the seeded
  debug app so the data is kept. APK 102.9 MB; WebGPU libs 17.5 + 3.1 MB (RUNBOOK §8).
- F.2: release holds about 60 fps in every steady state, and the GPU is not the bottleneck
  (PERFORMANCE.md "Release (final)").
- F.3: the canvas is not the accessible path (no per-body nodes, the same as production). The companion
  controls are labelled. TalkBack swipe-nav could not be driven by adb (`_notes/A11Y.md`).
- 4a82ae85: a lab-tool bug was found during the evidence review. The badge presets kept a stale home zoom
  after a System switch, so Inner "near/close" actually zoomed out. Fixed (re-capture on leaving preset 0) and
  the Inner rows were re-measured.
- F.4: final release screenshots and recordings. The README does not claim debug parity for the focus being
  cleared on tab return (not compared).


## 2026-10-01 — Test fix after the research package

- df8479b6: the lab-only System-name restore now guards `requested.ref?.kind`; the 2 `orrery-screen-framing.test.ts` failures are gone. Orrery suites + framing test: 733/733, tsc clean.
