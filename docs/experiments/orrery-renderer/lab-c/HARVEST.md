# Orrery Lab C — harvest

Every idea that worked, scored for a clean Orrery V2. **Readiness** scale: *concept* (re-implement from
the description), *portable* (the code is close to reusable), *prototype* (works, but needs hardening).
Many items are **renderer-independent** and would carry into a Skia V2 as easily as a 3D one. That is
marked in the "Needs 3D?" column.

| # | Idea | Verdict | Value | Readiness | Needs 3D? | Location (file · commit) | Deps / assets | Perf | Evidence |
|---|---|---|---|---|---|---|---|---|---|
| H1 | **One shared pinhole for drawing and hit testing** (UI-thread projection == GPU camera, pinned by a parity test) | **Carry forward** | Very high: drawn == tappable under any camera, the key to any richer camera | portable | No | `three/orrery-camera-rig.ts`, `orrery-camera-rig.test.ts`, `projectWorldPoint` · 205c1462, da5433a9, 20ae3596 (lift) | none | negligible | moon tap `07-checkpoint-e/s2-moon-tap-*` |
| H2 | **Real dolly camera** (fixed FOV, zoom = distance, tilted Home ~62°, lens shift putting the pivot low) | Carry forward (the composition), 3D-only (the depth) | High: strategy-map feel; far half fills the sky | prototype | Partly (lens shift and tilt work in 2.5D) | `orrery-camera-logic.ts` L67–140, `OrreryScreen.tsx` viewport memo · da5433a9, 0219e4a8 | none | — | `08-final/02-inner-overview.png` |
| H3 | **One-finger orbit with inertia; two-finger pan** | Carry forward (needs owner hands-on for two-finger) | High: the single biggest "game map" feel | prototype | No (a 2.5D yaw+tilt orbit is possible) | `orrery-gesture-logic.ts` L22/L103, `orrery-recovery-logic.ts` L19–26/L118, `use-orrery-camera.ts` · c0fc5882 | none | UI thread only | `08-final/rec-02-*.mp4` |
| H4 | **Label tiers driven by projected size** (median on-screen magnification feeding the unchanged thresholds) | Carry forward | High: keeps the product's semantic zoom correct under perspective | portable | No | `effectiveLabelZoom` `OrreryWorld3D.tsx` L204 · 823bd69f | none | O(n log n) per frame on the UI thread | `03-checkpoint-b/04…06` |
| H5 | **Minimum on-screen body size** applied to the *world* radius (so hits and labels follow) | Carry forward | High: dense Systems stay a field of people, not specks | portable | No | `OrreryWorld3D.tsx` L141–148, L523–537 · 7dd23580 | none | negligible | `08-final/01-dense-overview.png` vs `04-checkpoint-c/10` |
| H6 | **Density-based ring fade** (spacing-px squared ramp on alpha and width) | Carry forward | High at dense, inert otherwise | portable | No | `orrery-scene3d.ts` `frame` (ring density), constants L142–151 · 84f5d646, 7dd23580 | none | negligible | `05-checkpoint-d/02` |
| H7 | **Core framing for dense Systems** (frame the disc holding 50% of contacts instead of the readability floor or the whole disc) | Carry forward as a candidate; it changes a product framing rule, so **owner decision** | Medium-high: 100 of 120 visible at Home vs ~30 | prototype | No | `deriveHomePose`, `coreRadius` `orrery-camera-logic.ts` L115–136, L436+ · 7dd23580 | none | bisection at Home only | `05-checkpoint-d/03` |
| H8 | **Docked focus card plus system framing** (frame the body *and its moons* between the selector and a card docked at the bottom) | Carry forward | High: fixes card-over-body and void-under-card | prototype | No | `orrery-focus-card-layout.ts`, `OrreryScreen.tsx` focus, `orreryFocusSystemRadius` · 97d94229, 4ece2978, 7d558d87 | none | — | `08-final/05a`, `05b` |
| H9 | **Paragraph cache + shared ParagraphBuilder** (RN Skia 1 MB JSI pressure lesson) | **Carry forward to main now-ish**; it applies to the production Skia Orrery labels too | High: GC storms, external counter / 5 | portable | No | `orrery-text-cache.ts`, `OrreryLabel.tsx` `orreryParagraphBuilder` · e4d9e842 | none | GC 50–100/s → ~23/s after mount | `07-checkpoint-e/s1-paragraph-cache-mount-log.txt` |
| H10 | **Per-tile atlas updates** (one atlas, snapshot only dirty tiles, coalesced uploads) | Carry forward (any GPU path) | Medium | portable | Needs a GPU texture path | `BodyAtlas.flush` `orrery-textures3d.ts` · f1d9b310 | none | removes ~26 MB pressure per flush | `06-leak/mount-log-after.txt` |
| H11 | **Switch choreography beats** (fall-away below the plane, streak-in from above, capture ring flare, camera breath zero at both ends, all on top of the unchanged planar choreography) | Carry forward the *beats*; vertical lift is 3D-native, the flare and breath port to 2.5D | High: departure and arrival read in space | prototype | Lift yes; flare and breath no | `switchDepth` L276, breath in `sample` L434+, flare in `orrery-scene3d.ts` · 64858959 | none | release switch 54.8–56.3 fps, worst 54 ms | `08-final/rec-01-*.mp4`, `04-checkpoint-c/04-switch-mid-*` |
| H12 | **Moons on inclined, revolving local orbits; lift-aware hit projection** | Carry forward | Medium-high: satellites read as satellites; tap verified | prototype | Inclination yes (an ellipse fakes it in 2.5D) | `OrreryWorld3D.tsx` L156–168, L511–520, `orrery-frame-lite.ts` · 20ae3596, 97d94229 | none | frame callback only while focused | `08-final/05b`, `07-checkpoint-e/s2-moon-tap-*` |
| H13 | **Sun medallion** (occupant framed in a gold bezel inside a glowing star; shaded plate + initials or glyph when there is no photo) | Carry forward the design | Medium: strong landmark, identity at the centre | prototype | No (Skia can draw it) | face TSL `orrery-scene3d.ts` L557–660, `BodyAtlas.drawInitials(plate)` · 0219e4a8, ba48c76c | none | — | `04-checkpoint-c/06-sun-occupant-glyph-close.png` |
| H14 | **Lit faces** (face disc shaded as the camera-facing hemisphere toward the sun) | Keep if 3D; the idea ports to SkSL | Medium | prototype | No | face TSL · da5433a9 | none | trivial | `08-final/03b`, `04b` |
| H15 | **Screen-px instanced rings in one draw** (TSL strip, dashes by arc length, depth fade) | Keep if 3D | Medium: 120 rings in 1 draw call | portable (three/TSL) | Yes | `ringStripGeometry`, ring TSL L497–555 · 205c1462 | three | 1 draw | any overview |
| H16 | **Baked procedural textures instead of per-fragment noise** | Keep if 3D | Medium | portable | Yes | `planePattern`, `noiseTexture` · c5533857 | none | biggest debug fill win with DPR 2.0 | PERFORMANCE.md C.4 |
| H17 | **Top-inset fade** (bodies projecting under the header row fade over 28 px and stop being tappable) | Carry forward | Medium: no pile-up under controls | portable | No | `OrreryWorld3D.tsx` L154, L589 · 7dd23580 | none | — | `05-checkpoint-d/03` |
| H18 | **Nearest-first label allocation + padded body exclusions** | Carry forward | Medium | portable | No | `orrery-label-logic.ts` (`depth`), `SILHOUETTE_PAD` · 823bd69f, 97d94229 | none | — | `03-checkpoint-b/05`, `06` |
| H19 | **Light-theme profile for luminous effects** (switch additive to normal blending, tint fog, raise ambient and ring floor on pale backgrounds) | Carry forward the *rule*; the look is still weak | Medium | prototype | No | `applyColors` `orrery-scene3d.ts` L805 · 2ca56317 | none | — | `07-checkpoint-e/s7` → `s8`, `08-final/07a` |
| H20 | **GPU device lifecycle pattern** (prewarm off the surface path, one device per mount, destroy on unmount, pin `queue`) | Keep if react-native-webgpu is used | High for that stack | portable | Yes | `three/orrery-gpu.ts` · 205c1462 | react-native-webgpu | renderer ready 486–567 ms in release | PERFORMANCE.md F.2 |
| H21 | **Lab tooling**: dev-only seed through real DAOs on a separate app id; renderer frame-stat log; lab badge camera presets | Carry forward for V2 R&D | High for iteration speed | portable | No | `src/__dev__/lab-c-seed.ts` · c830da0a; stats log in the rAF tick; `cycleTilt` · 4a82ae85 | none | — | RUNBOOK |

## What V2 should preserve, in one list

1. One projection formula for drawing and hit testing, with a parity test (H1).
2. A camera that leans and orbits with the system composed low on the screen (H2, H3). Decide 2.5D vs 3D on
   *feel*, not on this.
3. Semantic labels keyed to *projected size*, nearest-first allocation, body exclusions (H4, H18).
4. Density legibility: minimum on-screen size, ring density fade, top-inset fade, and a dense-Home framing
   decision from the owner (H5, H6, H7, H17).
5. The docked focus card with system framing (H8).
6. The Paragraph cache and shared builder, in production Skia labels too (H9).
7. Switch beats: depart / arrive / capture flare / breath, zero at both ends, gated by reduced motion (H11).
8. Moons as inclined, revolving satellites with hit parity (H12), and the sun medallion (H13).
9. The reduced-motion contract: every ambient clock frozen, every flourish gated (verified pixel-identical).
