# Lab A — Recommendations

Lab A's question was: *how game-like can the Orrery get on its existing Skia + Reanimated + RNGH foundation while staying a plausible near-term production architecture?*

**Short answer.** Quite game-like, and production-plausible, **if and only if the renderer is imperative**.
- The visual direction ("deep-field star chart": a lit, tilted, instrument-grade system map with people as the subject) worked on device in all four palettes.
- The declarative RN-Skia tree that both the Lab and main started from was the real obstacle. It was not shaders, not Hermes, and not the frame worklet.

Evidence:
- `evidence/final/40` and `41` (look);
- `_notes/ARCH-PERF-PASS.md` and `_notes/CAMERA-PERF-PASS.md` (numbers);
- [HARVEST.md](HARVEST.md) (what to keep).

## 1. Lessons

1. **Measure release on the physical phone before judging anything.**
   - Four refinement passes ran on debug and production-mode JS. The first release build (`730899b4`) then showed both renderers at ≈12 fps idle with the main thread ≈91% busy. That reframed the whole lab.
   - Debug builds also hid the switch FX behind a 4–5 s freeze.
   - Off-device CanvasKit previews hid a Mali precision bug.
   - V2 should establish its release baseline on day one, **including main's own release build**. Main was never measured; every "legacy" number in this package is main's renderer *inside the lab build* (45° tilt, freeze fixes applied).
2. **The cost lived in how RN-Skia 2.6.2 redraws a declarative tree, not in drawing.**
   - One mapper re-converts every animated prop (~550) and replays everything on the main thread when *any* shared value changes.
   - Every `layer` prop is an unbounded full-canvas `saveLayer`.
   - Every React commit re-records the tree with blocking sync reads.
   - The fix was architectural: a few UI-thread pictures from one frame. Shaders, body count and Hermes were not the issue.
3. **Never return fresh objects from clock-captured derived values.** A uniform object or `createPicture` result per tick means a full redraw per tick, even under reduced motion. Ambient time must be a primitive, quantised, −1 under reduced motion.
4. **Worklet closures are a serialisation hazard.** Capturing a runtime object that transitively holds scene snapshots cost about 241k materialised nodes per mapper restart on the main thread. Keep the capture-guard test.
5. **Ganesh on Mali has hard rules:**
   - no strokes or dashes under a perspective CTM;
   - no `drawOval` for large ellipses;
   - no round joins or non-convex paths on hot paths;
   - no hash/fbm noise in mediump.
   Analytic shaders over cached `SkVertices`, with widths in screen dp from the homography's Jacobian, are the way through.
6. **The view type matters as much as the scene.** TextureView capped presents at about 25/s regardless of scene cost; SurfaceView reached display rate. It also keeps the panel at 120 Hz, which doubles idle CPU unless the clock stops.
7. **Hierarchy beats glow.** Every attempt to make the scene "more game" by adding luminance (underglow, long trails, a strong nebula) made it worse. The wins came from:
   - receding rings;
   - bodies with presence and one light;
   - a tilted plane;
   - a star sun;
   - HUD that lands on time.
8. **Presentation can be rich without touching semantics.** Every visual stayed outside `radius`, `hitRadius`, label metrics and allocation. That is why taps, labels and Profile-vs-Focus never drifted across 31 commits. Keep that contract.
9. **Anything that must land "with" an interaction must be off the React path.** Examples are the reticle, emphasis and arrival ghosts. A React child arrives after the commit's re-record: seconds late.

## 2. Carry forward

In priority order; details in HARVEST.

1. The **imperative renderer pattern** (V1):
   - tiny stable Canvas tree;
   - UI-thread pictures from the shared `frame`;
   - JS-prepared immutable specs written in render;
   - bounded layers only while fading;
   - a primitive ambient clock;
   - a base texture only when static.
2. **World-space plane under the exact homography** with analytic screen-dp strokes (V2), and **no ring polygons in the frame**.
3. **An opaque canvas (SurfaceView)** with the idle-clock fix (V3).
4. **Main-line fixes M1–M3** (freeze, stale camera, Hermes initials). They can land on main now, independently of everything else.
5. **Hierarchy inversion ring language** (V4) and **body presence** (V5): visual minimum radius ≤ hit radius, lit shader with a crisp status edge, keyline, stack pips.
6. **Star sun** (V6). **UI-thread focus layer** (V7).
7. **CPU-baked nebula with a palette cache** (V8). **Astrolabe bezel and dial** with a density fade (V9).
8. **Chart-paper light variant** principle (V11), with a little more engraving weight than at HEAD.
9. **Switch FX:** trails, flare and dial swing (V12). Arrival ghosts as a fallback (V13). **Focus card placement** (M5/V14). Depth cues (V15). Lit moons (V16). Instrument plates (V17). Fades (V18).
10. Token-uniform SkSL discipline (V19), sky parallax (V20), and the measurement toolkit (V21), especially SurfaceFlinger present counting and camera-animation capacity tests.

## 3. Reject

| Reject | Why |
|---|---|
| Declarative per-body/per-label RN-Skia trees with `layer` props, for a scene of this size | DEAD-ENDS A1 |
| GPU fbm/hash noise on Mali | Use a CPU bake or a bundled asset (A3) |
| Strokes, dashes, ovals or round joins under perspective, and per-frame JS polygon projection | A4–A8, A11 |
| Additive ring glow; long progress trails; fixed streaks; spinning reticle; React-mounted HUD | B1–B3, B10–B12 |
| The renderer A/B toggle, DEV marker and experiment package id | Lab scaffolding |
| A module SkImage photo cache | Unless the owner chooses to revisit D-41 |
| The declarative twinkle-over-`<Picture>` | Never rendered; decide TW1/TW2 explicitly |

## 4. Recommendation: clean Orrery V2 architecture

**Build V2 as an imperative Skia renderer on the existing stack, not as a port of either renderer's component tree.**

### The frame contract stays

`projectAnimatedFrame` / `frame` remains the single source of geometry for hits, labels, focus and drawing. Its worklet captures only shared values. The ring polygons come out of it.

### The canvas holds one stable node

The `<Canvas>` contains a single `Scene` component: a Group of four or five `<Picture>`s whose inputs are all shared values.

| Picture | Content |
|---|---|
| `world` | sky, plane, Polaris, reorder ghost, bodies behind the sun |
| `sun` | the sun |
| `front` | bodies in front of the sun |
| `hud` | reticle |
| `labels` | labels and pips |

- React commits never change this tree.
- Drawing functions are pure worklets in a few files: sky, plane, bodies, HUD, labels. Each is depth-ordered explicitly.

### Plane content

All plane content is drawn as cached unit `SkVertices` under `H·T·S` with analytic SkSL strokes in screen dp. That covers rings, grid, pool and haze, plus future plane content such as gravity wells or cluster zones.

### Resources

- Specs (token RGBA, shaped paragraphs, SkImages, effects) are built on JS per publication or theme, and handed to the UI thread by an async write in render.
- Photo custody follows the hand-off pattern (owner to confirm against D-41).

### Redraw policy

- Camera and scene changes redraw immediately.
- Ambient-only frames redraw at most at `AMBIENT_HZ`, from a cached base texture.
- Reduced motion, or an idle scene with no ambient element, means **zero frames and no frame callback**: the clock stops, not just its consumers.

### Surface

An opaque canvas, so RN-Skia uses a SurfaceView. Ship it together with the clock-stop (or a 30 Hz surface frame-rate vote), and re-verify the ADR-149 overlay contrast over the new sky.

### Why decisive, and why this and not alternatives

- **Same stack, no new dependency, local-first intact.**
- **Measured:**
  - release idle main thread 92 → 16% (17–32% with SurfaceView at 120 Hz, fixable);
  - camera motion ≈5 fps (scripted pan) → 82–92 fps (camera animation);
  - focus 3.6–8.9 s → 5–45 ms;
  - reduced-motion idle 0 presents;
  - memory −450 MB after 10 switches.
- **Visual parity verified** across both refactors.
- The semantics tests (frame, hits, labels, choreography) survived unchanged.
- **Alternatives:**
  - A game engine or true 3D is out of scope by contract and unnecessary.
  - Patching the declarative tree (H1) removes the worst cost (full-canvas layers), but keeps the per-commit re-record and the per-prop conversion. It will not reach Lab A's focus latency or reduced-motion idle.

### Gate V2 on

1. A main release baseline.
2. Parity of the imperative skeleton with the *current* main look (H2 core) before any new visuals.
3. Then the visual layer, decision by decision.

## 5. Pending owner decisions, with my recommendation

These are **owner decisions**. Nothing below is settled, and none may be defaulted in planning.

### K — 45° tilted Home in production?

**Status.** Kept for testing only. It reverses milestone-2 phase-08 dossier §C/§P and 29-UI-SPEC ORRC-04/05 ("Home is sun-centred, top-down and north-up").

**My recommendation: adopt a tilted Home, about 40–45°, recorded as a new decision that supersedes those clauses.**
- **For:**
  - It is the single largest "star-system map" gain (`pass-1/30`, `31` vs `13`, `01`).
  - It fits more of a dense System on screen.
  - Taps are verified exact.
  - The plane, shadow and depth cues depend on it.
- **Against:**
  - Bodies near the sun pack vertically.
  - North-up top-down Home was a deliberate legibility choice.
- **Middle option:** a tilted Home with Recenter's second press, or Reset-north, returning to top-down. That keeps a top-down view one tap away.

### H1 vs H2 — fixing main's release performance

**Status.** Pending. Main's slowness is **inferred** from the lab's legacy renderer, not measured.

**My recommendation:** measure main's release first (half a day). Then **H2: port the imperative renderer**, with the legacy look first. Ship M1–M3 to main immediately regardless.
- Choose **H1** only as a short-lived stop-gap if V2 is more than a milestone away. Removing per-body/label `layer` props and making clock values primitive is cheap.
- H1 does not fix commit re-records (focus latency) or per-prop conversion.

### TW1 vs TW2 — star twinkle

**Status.** Pending. Lab A's twinkle never rendered.

**My recommendation: TW1, keep the sky steady.** I agree with the orchestrator.
- The steady sky is the look every review judged.
- A real twinkle means a dimmer sky on average plus another always-on ambient redraw of the whole sky picture. That works against the idle-CPU residual.
- Twinkle adds little to a chart-like map.
- If the owner wants life in the sky, a very slow per-star alpha on a handful of hero stars, drawn in the `sun`-rate ambient picture, is the cheapest TW2.

### Ambient motion beyond "starfield twinkle + sun pulse" (ADR-048/077)

**Status.** Pending. Lab A added corona harmonics, sun granulation, the reticle scan arc and a 30 Hz ambient rate.

**My recommendation:**
- **Adopt a slow sun corona and granulation as the "sun pulse" successor.**
  - The motion stays on the sun, is restrained, and is cheap at 30 Hz.
  - It needs a superseding ADR.
- **Drop the reticle scan arc.**
  - It adds ambient motion for little meaning.
  - The lock-on, which is focus-triggered and therefore not ambient, carries the "game HUD" read.
- Either way:
  - keep everything static under reduced motion;
  - make an idle scene with nothing ambient visible produce zero frames;
  - the ambient clock stays single and unmountable (ADR-077 risk clause).

### Also for the owner, lower priority

- **D-41.** No shared photo cache needed now. The cross-fade hides most of the pop.
- **Photo custody hand-off.** Confirm it as compatible with D-41 rule 3.

## 6. What I would do with one additional day

Ordered by value per hour. No visual expansion; close the gaps that block a V2 decision.

1. **Release-measure main itself** with the same protocol (`relproto.sh` plus the SurfaceFlinger scripts). That settles the H1/H2 premise with real numbers (2 h).
2. **Fix the idle clock** (P1/P3): stop or skip the `useClock` frame callback when the ambient time would not change and nothing else is animating, or under reduced motion. Re-measure idle CPU on the SurfaceView. Target ≤ 10% idle (3 h).
3. **Owner hands-on session** (30 min of his time, prepared checklist):
   - pinch and two-finger tilt/yaw feel;
   - real-finger pan;
   - the detail-zoom context lines;
   - K / TW / ambient judgements on the installed release `5fb0f0d7`.
4. **Exercise photo custody:** edit and replace a contact photo while the Orrery is mounted and during remounts; seed a self-sun photo. That verifies the two untested ownership paths (1 h).
5. **Cleanup spike:** delete the dead lab branches and tunables, and draw warp copies only while `v > 0` (re-tuning near-star brightness). That proves the renderer is as small as claimed (1 h; a cleanup agent may already be doing part of this).
6. If time remains: re-capture the switch at full present rate on the final build, to judge ink-in, ripples and glints. Then run the ADR-149 contrast proof against the new sky.
