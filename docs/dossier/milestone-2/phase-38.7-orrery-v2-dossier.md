# Phase 38.7 --- Orrery V2: Renderer, Camera & Visual Language Dossier

**Status:** DRAFT 2026-10-02. Authored by Claude from the Prototype D synthesis; **codex review pending**. The phase is not yet on the roadmap. It is inserted by hand after the dossier is accepted (`gsd-tools phase insert` does not work on this roadmap).

**Sources:**
- Owner decisions: the owner's hands-on review of three renderer labs on a Pixel 6 Pro and a Pixel 3a (release builds, 2026-10-02), plus chat rulings the same day.
- Evidence: `docs/experiments/orrery-renderer/synthesis/`.
  - [SYNTHESIS.md](../../experiments/orrery-renderer/synthesis/SYNTHESIS.md): evaluation, conflict matrix, architecture.
  - [HARVEST-MAP.md](../../experiments/orrery-renderer/synthesis/HARVEST-MAP.md): where every idea lives.
  - [DEAD-ENDS.md](../../experiments/orrery-renderer/synthesis/DEAD-ENDS.md).
  - [OWNER-REVIEW.md](../../experiments/orrery-renderer/synthesis/OWNER-REVIEW.md): verbatim scores and rulings.
  - [audits/](../../experiments/orrery-renderer/synthesis/audits/): verified grounding.

Current-state claims below were verified against `main` @ `34920925` unless labelled LIKELY.

## Decision Legend

-   **[DECIDED]** explicitly chosen by the owner.
-   **[OPEN]** an owner decision still to be made (discuss-phase).
-   **[DERIVED]** a consequence of a decision or of a measured fact. Engineering calls delegated to the agent are recorded here so planning cannot drift.
-   **[PLANNING NOTE]** a repository finding or engineering follow-up to verify at planning time.
-   **⚠ SUPERSEDES** marks a decision that reverses or amends a recorded decision. Each one needs a superseding ADR at KB extraction, never a "bug fix" label.

**Numbering.**
- **D-01..D-30** are the owner's field-sheet decisions D1–D30, renumbered one to one.
- **D-31..D-42** are the owner's chat rulings of 2026-10-02.
- **D-43 onward** are [DERIVED] engineering decisions.
- Carried decisions are written "38.6 D-NN" or cite their dossier or ADR.

## Objective

Rebuild the Orrery's rendering, camera and visual language so that opening it feels like entering a polished game's star-system map:
- calm and legible star-chart views with a 3D strategy-map feel;
- cinematic System switches;
- smooth on both test phones and no hotter than today.

It stays recognisably Orbit: contacts and relationships remain the information architecture. V2 starts fresh from main; no lab branch is merged. It also fixes five production Orrery defects the labs found.

## Owner Requests --- field-sheet decisions (2026-10-02)

### Direction

-   **[DECIDED · 2026-10-02] D-01 --- Renderer: Skia 2.5D.** Not true 3D. "I liked the visuals of 3D initially … but overall that lab seemed to perform worse … and the other items about size and such make the decision final." Lab C's three.js/WebGPU renderer is rejected. Its camera and layout ideas are harvested.
-   **[DECIDED · 2026-10-02] D-02 --- Look: a blend.** "Cinematic during transitions, calm star chart with 3D strat on normal views."

### Camera

-   **[DECIDED · 2026-10-02] D-03 --- Tilted Home, about 62°, as one easily changed setting. ⚠ SUPERSEDES** phase-08 dossier (`phase-08-orrery-camera-scale-exploration-dossier.md:68`, `:300-306`), 29-UI-SPEC `:106` ("Home is … top-down"), and `docs/systems/orrery.md:77`.
    - Home is no longer top-down.
    - Recenter still restores all Home axes; Home simply has a tilt.
    - The owner is "not totally sold … may switch back to flat eventually, let's design this so it's easily changeable", so flat must remain a supported Home value.
-   **[DECIDED · 2026-10-02] D-04 --- One-finger drag pans the map** (today's behaviour, enforced). Lab C's one-finger orbit and two-finger pan are rejected.
-   **[DECIDED · 2026-10-02] D-05 --- A small, perceptible pan coast.** The owner saw none in any lab. Low priority.
-   **[DECIDED · 2026-10-02] D-06 --- Near-side size cap** (Lab B CLAMP). People on the near side of the tilted map cannot grow into large discs.

### Environment

-   **[DECIDED · 2026-10-02] D-07 --- A painted sky behind the Orrery. ⚠ SUPERSEDES** ADR-179 / 38.5 D-54 ("The Orrery keeps its solid background") for the in-canvas sky. BackgroundHost art on the Orrery route stays `none` (ADR-114), consistent with phase-02's "[DECIDED] specialized visualization background".
    - More visible stars than Lab A, and a much quieter nebula.
    - Lab B was "too busy".
    - Lab B's Standard-Dark graphite sky is the calm default feel.
    - Lab B's light-mode sky is good.
    - Motion: see D-36.
-   **[DECIDED · 2026-10-02] D-08 --- Each System gets its own sky tint** (Lab B HUE). No schema change (see D-50).
-   **[DECIDED · 2026-10-02] D-09 --- Optional orbital-plane grid in Lab C's style.** The owner is unsure about having a grid at all, so it is tunable down to off and gets an owner device checkpoint. Lab B's gravity-well grid is rejected.

### Ambient motion

-   **[DECIDED · 2026-10-02] D-10 --- Lab B's light pulses travelling along the orbits, kept but "not very obvious". ⚠ SUPERSEDES** the "sole ambient animation" clause of ADR-077 `:18` and ADR-048, and `09-orrery.md:68-72`.
    - This is a deliberate exception to HANDOFF §7 "Motion encodes data, not mood".
    - The pulses carry no data and are identical for every status.
    - They must stay on the single unmountable clock (ADR-048/077) and stop under reduced motion (ADR-085).

### Orbits

-   **[DECIDED · 2026-10-02] D-11 --- Lab B's thin, sun-lit orbit lines.** The status colours and the solid/dashed/faded style ladder stay as non-colour cues. "Fantastic in light mode."
-   **[DECIDED · 2026-10-02] D-12 --- Contacts stay on their orbit line. ⚠ SUPERSEDES** the drift half of `HANDOFF.md:194`, `09-orrery.md:99-104` ("rogue renders as maximum drift") and the drift clause of ADR-046.
    - Ring colour and angular position are the status indicators.
    - Today's production pushes decay bodies up to 40 world units and rogue bodies 80 past their ring (`src/logic/orrery-world-logic.ts:136`, `orrery-geometry-logic.ts:63-65`). That push goes.
    - No progress wake and no tether (D-38).

### People and the sun

-   **[DECIDED · 2026-10-02] D-13 --- Sun-lit faces with lighter shading only.** Faces in Labs B and C were too dark. Re-check with real photos.
-   **[DECIDED · 2026-10-02] D-14 --- Status is drawn with Lab B's rim + atmosphere glow.**
-   **[DECIDED · 2026-10-02] D-15 --- Lab A's star sun** (corona + granulation). It was the owner's favourite.
-   **[DECIDED · 2026-10-02] D-16 --- Minimum body size at overview.** Small bodies read as worlds, not pins.
-   **[DECIDED · 2026-10-02] D-17 --- Moons.** Lab B's and Lab C's moons are rejected. The owner's "perfect" moon behaviour is specified as D-31.

### Focus and controls

-   **[DECIDED · 2026-10-02] D-18 --- A reticle on the focused person** (the owner loved it in both A and B).
-   **[DECIDED · 2026-10-02] D-19 --- Lab C's focus framing.**
    - The person is centred and large, with the card docked below.
    - Lab A's card-above placement is rejected.
    - **New:** tapping a cluster at far zoom zooms into the cluster. Prod frames the group and opens the cluster panel; it does not zoom in enough.
    - The panel stays (phase-08 `:250-257` is enforced).
-   **[DECIDED · 2026-10-02] D-20 --- Do not hide the map behind the card.** Keep today's glass (see D-35). ADR-149 is unchanged.
-   **[DECIDED · 2026-10-02] D-21 --- Dim everyone else while someone is focused** (Lab B). The sun is not dimmed. Labels stay readable.
-   **[DECIDED · 2026-10-02] D-22 --- Lab B's corner-bracket instrument chrome** on the Orrery's HUD panels and buttons. The map running under the header is D-39.
-   **[DECIDED · 2026-10-02] D-23 --- Reorder hold:** Lab B's charge arc plus the glowing, projected orbit outline. It replaces the ghost ring. The hold time and haptic are unchanged.

### System switch

-   **[DECIDED · 2026-10-02] D-24 --- The switch is a blend** (further ruled in D-32):
    - Lab B's star warp in and out ("amazing");
    - Lab A's planets streaking around their orbits;
    - Lab A's camera swirl back to centre.

    Lab B as built was janky and "a bit sloppy", so it must be clean and smooth, especially on the 3a.
-   **[DECIDED · 2026-10-02] D-25 --- No camera effects:** no bloom, tilt-shift, lens flare or heat-haze.

### Themes

-   **[DECIDED · 2026-10-02] D-26 --- Light themes start from Lab B's light-mode treatment.** Galaxy Light needs more flavour of its own.
-   **[DECIDED · 2026-10-02] D-27 --- Standard and Galaxy look distinct.** The Galaxy nebula is "a little more subdued".
-   **[DECIDED · 2026-10-02] D-28 --- Hard gate on contrast.** Secondary text on the Orrery's see-through cards must pass 4.5:1 in all four themes over the new sky.

### Risk

-   **[DECIDED · 2026-10-02] D-29 --- Heat and battery** (answered by D-40).
-   **[DECIDED · 2026-10-02] D-30 --- Kill list.** Do not rebuild:
    - Lab B's gravity-well grid;
    - Lab C's gestures;
    - Lab B's and Lab C's moons;
    - Lab C's reorder;
    - the loading box when the Orrery opens (production `OrreryNotice kind="world-loading"`, `src/screens/OrreryScreen.tsx:1210-1218`);
    - dark faces;
    - a dark, low-findability overview.

## Owner Rulings (chat, 2026-10-02)

-   **[DECIDED · 2026-10-02] D-31 --- Moon bump at far zoom that splits into moons. ⚠ SUPERSEDES** phase-08 `:469` ("far overview → hidden").
    - At far zoom, a parent with moons shows them as a small bump on its body.
    - Zooming in, the bump separates into individual moons.
    - This is a **new** feature. What the owner saw in Lab A was the **stack pip** (a dot for a contact hidden behind another), which is kept as well.
    - Moon bumps and stack pips must be visually distinct.
    - Today's focus card already lists the focused person's moons (`OrreryScreen.tsx:1109-1131`). Keep it.
-   **[DECIDED · 2026-10-02] D-32 --- The star warp replaces the "not light-speed" rule. ⚠ SUPERSEDES** phase-08 `:568`.
    - Production spin, shed and capture by membership change stays underneath.
    - So do the 2100 ms / 180 ms (reduced-motion) durations, land-at-Home, and interaction readiness at progress 0.82 (`use-orrery-switch-runtime.ts:25-26`; phase-09 `:450`, `:462-479`; 30-CONTEXT D-11).
-   **[DECIDED · 2026-10-02] D-33 --- Contact initials are fixed to real initials, with emoji-safe handling. ⚠ AMENDS** Phase 29's deliberate full-name fallback (`29-05-SUMMARY.md:93`, EDGE-14).
    - Hermes lacks `Intl.Segmenter`, so today the disc shows "El…" (`src/logic/orrery-label-logic.ts:22`).
    - The fix must not slice UTF-16 or produce partial emoji (ZWJ sequences, flags).
-   **[DECIDED · 2026-10-02] D-34 --- V2 is built on the current `@shopify/react-native-skia` 2.x line.**
    - `react-native-skia` 3.0.x (Graphite, Vulkan, minSdk 26) shipped 2026-10-02 from a fork.
    - Any move to it is its own later phase.
    - Upgrading within 2.x is allowed if planning needs it; it is an engineering call, with each API listed in D-46 re-verified.
-   **[DECIDED · 2026-10-02] D-35 --- Keep today's translucent Orrery cards (ADR-149) unchanged.**
    - They must pass D-28 over the new sky.
    - Lab A's "glassiness" is today's production glass; Lab A changed nothing there.
    - **This clarifies 38.5 D-12's "full scrim" wording.** The Orrery's cards and controls keep the ADR-149 translucent treatment; they do not get a full scrim.
-   **[DECIDED · 2026-10-02] D-36 --- The sky barely drifts and shifts slightly with the camera (parallax).** It is fully still under reduced motion.
-   **[DECIDED · 2026-10-02] D-37 --- Idle motion budget.**
    - Keep today's star twinkle and sun pulse.
    - The subtle orbit pulses (D-10) are the only new idle motion.
    - No sun churn, reticle scan or idle moon motion. Lab A's corona and granulation are drawn frozen, or move only with the existing sun pulse.
-   **[DECIDED · 2026-10-02] D-38 --- No progress wake.** The tether is moot under D-12.
-   **[DECIDED · 2026-10-02] D-39 --- The map runs up under the Orrery title** (Lab B IMMERSE). The status bar, tab bar and "+" button are unchanged.
-   **[DECIDED · 2026-10-02] D-40 --- Cool idle.**
    - When nothing is moving, the Orrery stops drawing except for the low-rate ambient (twinkle, sun pulse, pulses).
    - It must not run noticeably warmer than today's Orbit on either phone.
-   **[DECIDED · 2026-10-02] D-41 --- The five production Orrery defects found by the labs are fixed in this phase,** not in a separate port phase (see D-52).
-   **[DECIDED · 2026-10-02] D-42 --- Cross-platform portability is an architectural criterion.**
    - Android comes first; iOS and web are planned.
    - Android-only choices sit behind an interface (D-46).

## Current State (grounding, verified 2026-10-02)

Full inventory and decision crawl: [audits/PROD-GROUNDING.md](../../experiments/orrery-renderer/synthesis/audits/PROD-GROUNDING.md).

**Pipeline:**
- `loadOrreryScene` (`src/services/orrery-scene.ts:210`) → `deriveOrreryWorld` (`src/logic/orrery-world-logic.ts:83`, drift push at `:136`) → the switch runtime (`use-orrery-switch-runtime.ts`).
- One UI-thread `frame` (`OrreryWorld.tsx:222-262`) feeds the renderer, hit-testing, the focus card and the HUD.
- The renderer is a **declarative** RN-Skia tree (`OrreryCanvas.tsx`, `OrbitBody.tsx`, `SunBody.tsx`, `ProjectedOrbitRing.tsx`, `OrreryLabel.tsx`) with a solid `Fill` plus 44 twinkling stars.

**Camera:**
- `HOME_CAMERA.tilt = 0` (`orrery-camera-logic.ts:60-67`).
- `MAX_TILT = π/3` (60°, `:72`), clamped at `:244`.
- `deriveFocalDistance` is telephoto (≈4.65 × extent) and built on `sin(MAX_TILT)` (`:91-99`).
- `projectFrame` projects 128 points per ring per body per frame (`:513-528`).
- Tap → Profile at zoom ≥ 2 (`tapIntent`, `:587`).
- Coast: `COAST_MS 120` (`orrery-recovery-logic.ts:16`).

**Lifecycle:**
- The canvas mounts only while `measured && isFocused && appActive` (`OrreryScreen.tsx:610`, `:1048`).
- Every tab return re-reads the scene (`:427-435`). This is part of the "slow to reload" the owner saw in every lab.

**Focus, clusters, moons:**
- The focus card already docks **below** the body (`OrreryFocusContext.tsx:46-72`) and lists moons.
- A cluster tap frames the group and opens `OrreryClusterPanel`.
- Moons are hidden at overview (`orrery-satellite-logic.ts:31`).

**Production performance (LIKELY):** about 2–3 fps at Dense 120 and an ANR at 400 contacts on the Pixel 6 Pro. This comes from one Lab B run of the unchanged legacy renderer, under swap and thermal pressure (`audits/LAB-B-AUDIT.md` §4). **Main itself was never measured in release by any lab.**

**Defects present on main today (all verified in code):**

| # | Defect | Where | Root cause |
|---|---|---|---|
| 1 | 3–7 s switch freeze | `OrreryWorld.tsx:222-262`; `use-orrery-switch-runtime.ts:168`, `:401-411` | The frame worklet captures the switch runtime and scene snapshots. A fresh runtime object every render forces re-serialisation on the UI thread. |
| 2 | O(N²) lookups and per-point projection | `orrery-frame.ts:51-60`, `:209`; `OrreryWorld.tsx:280`, `:366`; `ProjectedOrbitRing.tsx:18`; `orrery-camera-logic.ts:509-529` | A linear `find` per body per frame; `usableCameraRect` and trig recomputed per point. |
| 3 | Paragraph churn (likely cause of the 800-body crash) | `OrreryWorld.tsx:276-339` (memo deps include the fresh `clusterIds=[]` from `OrreryScreen.tsx:1063`); `OrbitBody.tsx:88-106`, `SunBody.tsx:135-153`, `OrreryLabel.tsx:42-54` | Every label Paragraph is rebuilt on every parent render. One builder per body. Nothing is disposed. RN-Skia charges 1 MB of pressure per Paragraph and per builder. |
| 4 | Initials "El…" | `orrery-label-logic.ts:22` | No `Intl.Segmenter` on Hermes, so the full name is ellipsised in the disc (see D-33). |
| 5 | "Unavailable System" after a cold start into a custom System | `OrreryScreen.tsx:466`; `orrery-system-store.ts:95-105`, `:122-131` | The restore passes no name, and the post-load name refresh covers categories only. |
| (6) | Stale camera at switch start | `use-orrery-switch-runtime.ts:313`, `:371` (`interpolateCamera`) | When settled, the first switch frame starts from the previous switch's target. |

**Schema:**
- Migration head 032.
- `BACKUP_FORMAT_VERSION = 7` (`src/backup/types.ts:14`).
- A stable System id exists: `systemRefId` (`orrery-system-logic.ts:58-66`), built from `categories.uid` / `systems.uid` (both UNIQUE).

## Derived Decisions (engineering, delegated)

-   **[DERIVED] D-43 --- Renderer foundation: Lab A's imperative pattern, written fresh.**
    - A small, stable `<Canvas>` tree of a few `<Picture>`s whose inputs are SharedValues only.
    - JS-prepared immutable specs.
    - Bounded layers only while fading; never a `layer` per item.
    - React commits must never re-record or restructure the tree (photo arrival, focus, label rebuilds).
    - V2 is a new consumer of the existing `frame` (seam S3). Hit-testing, labels, the focus card and the HUD keep reading the same frame (drawn == tappable).
    - Lab A measured idle main-thread time ≈92% → 15–16% and focus response 3.6–10 s → 0.06–0.18 s (release, 6 Pro) with this pattern (`audits/LAB-A-AUDIT.md` §7).
-   **[DERIVED] D-44 --- Tilted orbit drawing never strokes under a perspective transform.**
    - Default: Lab A's world plane, drawn in world space under the exact homography with analytic screen-dp strokes on cached `SkVertices` (`RING_WORLD_SKSL`).
    - Fallback: Lab B's full-screen ring field, if an **early spike on both phones** shows the default cannot hold the D-56 targets.
    - B's thin-line style (D-11), rim (D-11) and pulse term (D-10) are written for whichever method wins.
-   **[DERIVED] D-45 --- Home profile and camera model.**
    - Home becomes one tunable profile `{tilt, lensShift, fitRule}`, defaulting to 62° with Lab C's strategy-map lens shift.
    - The max user tilt becomes a separate constant. 62° cannot exist under today's `MAX_TILT` of 60°.
    - Adopt Lab C's dolly focal model (focal ∝ 1/zoom), which is what makes a steep tilt read as depth rather than squash. Today's telephoto focal flattens it (`audits/LAB-A-AUDIT.md` §5, `audits/LAB-C-AUDIT.md` §1).
    - Re-derive the depth clamp and the near-plane guards.
    - Flat Home (tilt 0) must remain valid, with lens shift 1.0 and a whole-disc fit, plus min size and ring fade at density.
    - Every `frameBodies`/`unproject`/Home-fit caller gets tests at 0°, 45° and 62°.
-   **[DERIVED] D-46 --- Platform seam.**
    - One `OrreryRenderHost` capability interface owns the Android-only or GPU-specific choices:
      - opaque canvas → SurfaceView (Android only; a no-op on iOS and web);
      - the idle frame-rate hint;
      - Mali workarounds as capability flags, not structure;
      - the offscreen-bake path (web needs a raster path);
      - the DPR source.
    - All Orrery text goes through one `OrreryTextService`: a shared ParagraphBuilder per font provider, a cache keyed by role, width, ink and text, and disposal swept only after the commit that stops drawing the old object.
    - Gesture semantics stay in pure functions, because RNGH 3 (Expo SDK 58) replaces the `Gesture.*` builder API.
    - APIs to re-verify on any Skia bump: `drawVertices` under perspective, `opaque`, offscreen surface ownership, `RuntimeEffect`, `Paragraph`.
-   **[DERIVED] D-47 --- Semantics follow projected size.**
    - Under a dolly, `zoom` stops meaning magnification. Semantic label tiers use projected body size (Lab C `effectiveLabelZoom`).
    - Labels are allocated nearest-first, with body exclusions.
    - The "tap the focused person again → Profile" threshold is re-keyed from raw zoom to projected size, so its behaviour is preserved.
    - The focus zoom may exceed today's `IDENTITY_ZOOM` cap to achieve D-19 framing. This amends phase-08 `:225-230` ("stops at the name-visible level"). Recorded here, and the owner sees it at the device checkpoint.
-   **[DERIVED] D-48 --- One size mechanism, in the projection.**
    - Minimum on-screen size inflates the projected radius (Lab C), so the drawn body, hit target and label gap agree.
    - Lab B's near-side clamp applies in the same place.
    - Lab B's visual-only FLOOR is rejected (its hits and labels ignore it).
-   **[DERIVED] D-49 --- Ambient and idle.**
    - All ambient motion (twinkle, sun pulse, pulses, sky drift) runs on one quantised ~30 Hz clock (−1 under reduced motion), hanging off the existing single clock owner.
    - The static base (sky, plane, rings without pulses) is baked to a texture only while the scene is still. The previous snapshot is disposed when replaced: Lab A leaks one about 18 MB image per settle until GC (`LabScene.tsx:432`).
    - While idle, the canvas must not drive the panel at 120 Hz (stop the clock between ticks, or use a frame-rate hint).
    - If D-10's pulses cannot meet D-40, **report it to the owner rather than silently dropping them.**
-   **[DERIVED] D-50 --- Per-System sky hue from the stable id, no schema change.**
    - The hue is derived from `systemRefId` through theme tokens (the ADR-022 swatch pattern), with more than Lab B's 6 buckets so Systems rarely collide.
    - A duplicated System gets a new uid and therefore a different hue. This is accepted.
    - A user-pickable hue is out of scope; it would need migration 033 and a backup decision.
-   **[DERIVED] D-51 --- Authored Orrery tokens.**
    - Sky, nebula, star, hue, pulse, rim, glow, reticle and instrument colours become named theme tokens per palette, for all four themes, including inside SkSL uniforms.
    - They replace Lab B's formula-mixed colours (C-03/32/40/44/53/68).
    - Light themes use normal/src-over blending with ink tokens; dark themes may use additive/screen. Keyed from the theme store, not luminance.
-   **[DERIVED] D-52 --- Defect fixes (D-41), shipped as the first work in the phase.**
    - **Freeze.** Narrow every worklet capture to SharedValues and small ids, and memoise the runtime. Update `orrery-frame-mapper.test.ts:104,115`, which today *expects* the bad captures.
    - **Lookups and projection.** Add an O(1) body-key index (also in `ProjectedOrbitRing.tsx:18`), hoist the projection basis, and remove per-frame ring polygons.
    - **Text.** Route all text through `OrreryTextService`. Give `clusterIds` a stable empty default.
    - **Initials.** Implement D-33.
    - **System name.** Resolve custom System names in the store after load, with its own test.
    - **Stale camera.** Start the switch from the displayed camera.
    - **Related todo:** `.planning/todos/pending/2026-09-29-orrery-anr-choose-system.md` (ANR opening Choose System on the 3a). Absorb it or close it with evidence.
-   **[DERIVED] D-53 --- Switch on a budget.**
    - The warp is a fixed streak-sprite budget, with no particles, comets or shockwave trims.
    - Choreography setup is O(N) with keyed maps (today `orrery-switch-choreography.ts:348-432` is O(N²)).
    - No React re-render of the renderer during or immediately after the switch.
    - Photos are decoded once and kept across the switch.
    - A's trails are rebuilt without mutating scratch state inside a mapper.
    - The camera swirl uses shortest-arc yaw plus an authored spin, composed with Lab C's camera "breath" (not stacked). Part of today's swirl is a yaw-wrap artifact.
    - Reduced motion keeps the 180 ms crossfade.
-   **[DERIVED] D-54 --- Moons and pips.**
    - D-31's moon bump and Lab A's stack pips draw differently: the pip is a ring-coloured dot; the moon bump is satellite-styled.
    - Moon hit-testing keeps `resolveSatelliteTap` parity.
    - ADR-105 limits are enforced: unlinked-only, and a non-member sun gets no moons.
    - Stack detection must be indexed, not O(n²) per re-record (it is unmeasured at 800 bodies).
-   **[DERIVED] D-55 --- Contrast fix lever.** For D-28, dim what the Orrery draws **under** the card region (Lab B's occlusion lever); never change card opacity. Re-prove with the ADR-169 both-extrema method over the brightest sky, nebula, star, initials and photo pixel in all four themes. Lab B measured 4.42:1 in Standard Dark, and the worst pixel was a white initials glyph.

## Derived Constraints

-   **[DERIVED] Drift removal blast radius (D-12).** Everything that inherits the push:
    - **Body position:** `deriveOrreryWorld` (`:61-72`, `:95-99`, `:119-122`, `:136`, `:140-148`).
    - **Through x/y:** hit candidates (`orrery-camera-logic.ts:539-561`), label anchors, focus card, offscreen detection, Home fit/extent, the moon parent offset, switch shed/capture radii (`orrery-switch-choreography.ts:308`, `:341`).
    - **Reorder:** drift subtraction (`orrery-reorder-logic.ts:73`, `:93`, `:131-145`), which collapses to 0.
    - **Tests and docs:** the tests that pin drift, and the docs listed in `audits/PROD-GROUNDING.md` §2.2.
    - **Dead code:** the legacy `drawnRadius`/`driftPush` helpers have only test consumers and can go.
-   **[DERIVED] Rogue identity without drift.** Rogue is carried by the cold, desaturated, glow-less body (D-14). A non-colour status cue remains for colour-blind users: the ring dash/fade/trace styles. Decay/rogue photo desaturation (Lab B C-16) is product meaning: confirm it at the device checkpoint.
-   **[DERIVED] Steep tilt packs rings vertically.** This produces more co-angular stacks (pips), more label conflicts on the near and far sides, and possibly bare sky corners at 60°+ because of parallax (`audits/LAB-A-AUDIT.md` §5). One-finger pan at 62° moves about 2.1× the ground per point at the far rim: tune the pan mapping (D-04 stays one-finger pan).
-   **[DERIVED] Lab C's focus-radius helper** (`orreryFocusSystemRadius`) is keyed to C's hero scale and moon geometry. Re-key it to V2's moons (D-31).
-   **[DERIVED] Phase 30 Preview canvas.** `SystemPreviewCanvas.tsx` is a separate simplified renderer, and phase-09 `:311` says the Preview does not expose tilt or yaw. See O-2.

## OPEN (owner, for discuss)

-   **[OPEN] O-1 --- Performance acceptance numbers.** Proposed, to confirm or change. All measured with SurfaceFlinger presents, because gfxinfo cannot see a SurfaceView.
    - **Pixel 6 Pro, release, Size 120 at Home tilt:**
      - pan, pinch and Recenter at a median of ≥ 55 presents/s;
      - a Size 5 ↔ Size 120 switch with no gap > 100 ms;
      - idle Orrery CPU and 5-minute skin temperature no higher than **today's main** measured the same way on day one.
    - **Pixel 3a, release, Size 120:**
      - pan and pinch at a median of ≥ 45 presents/s;
      - switch with no gap > 150 ms;
      - no ANR at Size 120 or All Contacts with about 1,000 contacts;
      - a tab return showing the scene within an agreed time (proposed ≤ 1 s to the first full frame).
-   **[OPEN] O-2 --- Does the Phase 30 System Preview canvas adopt the V2 look and tilt, or stay as it is?** Proposed: adopt the V2 visuals at flat tilt, keeping phase-09 `:311`.
-   **[OPEN] O-3 --- Tab-return speed.** Every lab and today's app rebuild the scene, textures, photos and text on every return to the Orrery tab. Proposed: keep decoded photos, baked sky and text caches alive across a blur, still releasing the canvas and clock, within an agreed memory ceiling. This touches the lifecycle and memory posture ADR-170 governs (settled resource retirement).

## Scope

**In:**
- the D-52 defect fixes;
- the drift removal;
- the camera model (D-45, D-47, D-48);
- the new renderer (D-43, D-44, D-46, D-49);
- sky and environment (D-07..D-09, D-36, D-50, D-51);
- rings and pulses (D-10, D-11);
- bodies, sun, moons and pips (D-13..D-17, D-31, D-54);
- focus and HUD (D-18..D-23, D-35, D-39, cluster zoom);
- the switch (D-24, D-25, D-32, D-53);
- themes and contrast (D-26..D-28, D-55);
- removing the loading box (D-30);
- the coast (D-05);
- device verification on both phones.

**Out:**
- any 3D renderer or new native dependency;
- the Skia 3 / Graphite migration (D-34);
- the RNGH 3 / worklets 0.13 / Expo SDK 58 upgrade;
- iOS and web builds (only the seams of D-46 are in);
- a user-pickable System hue (schema);
- new Orrery data or SQL;
- widget changes;
- edge-to-edge app shell beyond the Orrery title (D-39).

## Carried Constraints

-   **Semantics V2 keeps:**
    - dense rank → ring (ADR-046);
    - timestamp → angle;
    - query-time status (ADR-011, ADR-026);
    - one canonical world, with the camera separate (ADR-077);
    - frame-driven hit-testing with uid + generation guards;
    - contacted-only reorder and its `ring_seq` write;
    - System identity, membership, switch lands at Home, shared focus preserved (Phase 30);
    - scoped satellites (ADR-105).
-   **Runtime:**
    - a single unmountable ambient clock (ADR-048/077) that pauses on blur and background;
    - reduced motion through the live SharedValue (ADR-085), with every new motion frozen under it;
    - the conventional `OrreryContactsSheet` remains the accessible route (the canvas exposes nothing);
    - portrait lock.
-   **Colour:** every colour resolves through theme tokens, including Skia and SkSL uniforms (ADR-006; `npm run check:colors`).
-   **Hermes / worklets:**
    - define worklet helpers above their callers, and add the new V2 files to `orrery-worklet-order.test.ts`'s scan (worklet forward-reference hazard, fix f979263);
    - no `globalThis.crypto`; use the deterministic `seeded()` hash pattern.
-   **Local-first:** no network on any render or read path. Bundled assets only.
-   **Schema:**
    - no schema change is expected;
    - any migration is head+1 (033, verified on disk at plan time);
    - a backup-format bump (today 7) is an owner decision.
-   **38.6 D-11/D-41 photo rules:** downsampled on-disk Orrery derivatives, textures ≤ 512.
-   **Gates every wave:** `npx tsc --noEmit` (no npm script), `npm run check:colors`, vitest.

## Related Backlog / Todos Reviewed (2026-10-02)

-   `.planning/todos/pending/2026-09-29-orrery-anr-choose-system.md` (38.5 D-51): absorbed by D-52.
-   **ROADMAP drift:** Phase 30 is still `[ ]` at `.planning/ROADMAP.md:148`, although 12/12 plans ran and the owner approved it. Tick it when 38.7 is inserted.
-   **HANDOFF.md:196** "[DECIDED] Elliptical orbits wider than the viewport" was replaced in practice by circular rings plus the camera, with no recorded supersession. Record it at KB extraction alongside D-12.

## Supersessions to record at KB extraction

| V2 decision | Supersedes / amends |
|---|---|
| D-03 | phase-08 `:68`, `:300-306` (top-down Home); 29-UI-SPEC `:106`; `docs/systems/orrery.md:71`, `:77` (tilt range, Home axes) |
| D-07 | ADR-179 `:21` / 38.5 D-54 ("Orrery keeps its solid background"), for the in-canvas sky |
| D-10 | ADR-077 `:18` and ADR-048 ("sole ambient animation"); `09-orrery.md:68-72`; an explicit exception to HANDOFF `:195` "Motion encodes data, not mood" |
| D-12 | HANDOFF `:194` (drift outward); `09-orrery.md:99-104`; ADR-046 drift clause; `docs/systems/orrery.md:30` |
| D-31 | phase-08 `:469` (far overview → hidden) |
| D-32 | phase-08 `:568` (not light-speed) |
| D-33 | Phase 29 full-name initials fallback (`29-05-SUMMARY.md:93`) |
| D-35 | 38.5 D-12 "full scrim" wording, for the Orrery's cards and controls |
| D-47 | phase-08 `:225-230` (focus stops at the name-visible level) |

## Verification Expectations

**Unit and logic:**
- drift removal (bodies on `ringRadius`; reorder without drift);
- Home profile at 0°, 45° and 62° (fit, lens shift, focal, near clamp, min size), with parity tests between `projectWorldPoint` and every independently projected draw path (plane, grid, rings, sky);
- projected-size label tiers and the tap-to-Profile threshold;
- the moon bump/split and pip rules;
- per-System hue determinism from `systemRefId`;
- emoji-safe initials without `Intl.Segmenter`;
- the custom System name after a cold restore;
- a worklet capture guard that fails on runtime or scene captures;
- `OrreryTextService` cache and disposal;
- switch setup O(N) and no renderer re-render during the switch.

**Day-one baseline:** a release build of **today's main** on both phones, measured exactly as the V2 build will be. No lab ever measured main in release.

**Device, debug for iteration, then one release build on the Pixel 6 Pro and Pixel 3a.** Use the shared Size 5/10/20/32/120 cast (rebuild the seed as one dev seed). Cover:
- overview, the zoom tiers and focus;
- a cluster tap that zooms in;
- the moon bump splitting;
- reorder;
- Size 5 ↔ 120 and All Contacts switches;
- all four themes;
- reduced motion (zero presents while idle apart from what D-37 allows; the switch crossfade);
- tab return and background;
- a 5-minute idle soak with temperature and CPU against the baseline;
- TalkBack through the companion sheet.

**Gates:**
- O-1 performance numbers, once confirmed;
- D-28 contrast at 4.5:1 in all four themes over the sky (ADR-169 method);
- D-40 heat no worse than main;
- `tsc`, `check:colors` and vitest green.

**Owner device checkpoints:**
- 62° vs flat Home (D-03);
- grid on or off (D-09);
- pulse intensity (D-10);
- face shading with real photos (D-13);
- the switch on the 3a (D-24);
- light themes (D-26);
- decay/rogue desaturation.

## Revision Log

-   **2026-10-02** --- Draft authored from the Prototype D synthesis: D-01..D-30 (field sheet), D-31..D-42 (chat rulings), D-43..D-55 (derived), O-1..O-3 open. Awaiting codex review.
