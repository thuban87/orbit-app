# Orrery Renderer R&D: Prototype D Synthesis

**Status:** complete 2026-10-02. This is the independent evaluation of Labs A, B and C, ending in a recommended Orrery V2 architecture and scope. It feeds the Phase 38.7 dossier (`docs/dossier/milestone-2/phase-38.7-orrery-v2-dossier.md`), which is the authoritative contract. This document is the evidence record behind it.

**Inputs:**
- the shared experiment contract (`docs/orrery-investigation/ORRERY-EXPERIMENT-CONTRACT.md`);
- each lab's research package and code on its branch;
- the owner's hands-on review on two phones ([OWNER-REVIEW.md](OWNER-REVIEW.md), the primary product evidence);
- five read-only audits that re-checked the lab claims against code on disk ([audits/](audits/)).

Nothing in this document trusts a lab write-up on its own. Where a lab claim failed verification, it is marked here and in the audits.

**Path shorthand:**

| Prefix | Path |
|---|---|
| `A:` | `~/projects/orbit-orrery-lab-a` (branch `experiment/orrery-skia-production`) |
| `B:` | `~/projects/orbit-orrery-lab-b` (branch `experiment/orrery-skia-unleashed`) |
| `C:` | `~/projects/orbit-orrery-lab-c` (branch `experiment/orrery-3d`) |
| `main` | `orbit-app` at `34920925` |

- Each lab's evidence lives under that lab's `docs/experiments/orrery-renderer/<lab>/evidence/`.
- **The lab branches are local and unpushed.** They are the only copy of the lab code and evidence. Keep the three worktrees and branches until V2 ships.

---

## 1. Verdict in one paragraph

**Build V2 on Skia 2.5D**, starting fresh from main in Phase 38.7. Use **Lab A's imperative scene architecture as the renderer foundation**:
- a stable picture tree fed by the shared `frame`;
- a quantised ambient clock;
- the static scene baked to a texture;
- the world plane drawn under the exact homography.

Port in **Lab B's art and interaction language**: thin sun-lit rings, rim-and-glow status, the star-warp switch, the near-side clamp, per-System sky hue, focus dimming, corner-bracket chrome, the reorder charge arc and B's sky profiles.

Port in **Lab C's camera and layout logic**: the steep tilted Home with lens shift and a dolly focal model, docked focus framing, projected-size label tiers, minimum on-screen size, ring density fade and the Paragraph cache.

**Reject Lab C's renderer** (three.js on WebGPU) and Lab B's renderer structure.

Fix the five production bugs the labs found as part of the same phase.

This is a recombination at the **idea** level. No lab is merged; most good ideas are rewritten, and only a handful of self-contained shaders and pure functions are lifted as code.

---

## 2. What each lab tested, and how it came out

| | A: Production Skia | B: Skia Unleashed | C: True 3D |
|---|---|---|---|
| Hypothesis | How game-like can the existing Skia stack get while staying production-plausible? | How far can Skia go with no limits on effects? | Does a real GPU 3D renderer (three.js WebGPU) make it feel like a game star map? |
| Renderer | Imperative: 5 `SkPicture`s from one UI-thread `frame`; baked base texture; world plane under the exact homography; opaque SurfaceView canvas (`A:src/components/orrery/lab/LabScene.tsx:540-556`) | Many UI-thread picture layers plus declarative parts; full-screen analytic **ring field** shader for tilted orbits (`B:src/components/orrery/labb/LabRingField.tsx`); 50+ effect flags and presets | three.js 0.186.1 `WebGPURenderer` on react-native-webgpu 0.10.4, JS-thread rAF loop; text still via Skia Paragraph rasters |
| New dependencies | none | none | `three`, `react-native-webgpu` (+20.6 MB native libs per ABI, minSdk 24 → 26) |
| Owner's overall read | Smooth and cool on the 6 Pro. Best sun, reticle, moons-as-seen (really stack pips), switch streaks. Sky too sparse, nebula too everywhere. Card above the person is wrong. | Best transition (star warp), orbit lines, light mode, chrome, reorder, reticle. Too busy, faces too dark, janky on zoom and switch, warmer, moons invisible. | Smoothest zoom, best single-person focus framing, favourite grid. Gestures "awful", too dark, hard to find people, poor moons and reorder, plain switch, slow tab return. |
| Lab's own verdict | Plausible for production **if** the renderer is imperative | Effects are compelling; a "Ship-safe" subset is the starting point | "Not yet: harvest the ideas, don't ship this renderer" |

---

## 3. Comparison across the evaluation dimensions

Ratings are relative within this set (●●● best, ● weakest). Every cell cites its source:
- "owner" = [OWNER-REVIEW.md](OWNER-REVIEW.md);
- "aud-A/B/C/P/G" = the audits for Lab A, B, C, Portability, and production Grounding.

| Dimension | A | B | C | Notes and sources |
|---|---|---|---|---|
| Visual quality / game feel | ●● | ●●● | ●● | Owner's target is a blend (D2): "cinematic during transitions, calm star chart with a 3D strategy-map feel on normal views". B is the most cinematic, A the calmest, C the most "3D strategy". |
| Information clarity / contact readability | ●●● | ● | ● | Owner on finding people at overview: A 4/5; B 3/5 ("background is too busy"); C 2/5 ("most are too dark"). B and C faces too dark (owner s3/s12). C fog: `AMBIENT 0.22`, fog from 0.8× dolly (aud-C §2). |
| Interaction / camera feel | ●●● | ●● | ● | A "smooth as butter" (owner). B "little janky". C "1 finger to rotate is awful", two-finger pan too sensitive (owner). C's zoom was the smoothest (owner p6 s3 5/5, 3a s3 5/5). |
| System-switch choreography | ●● | ●●● | ● | B's warp is "amazing" but "a bit sloppy" and janky. A's streaks and swirl are loved. C is "closest to prod, very few animations". B's switch really ran at **~20–29 fps** on the 6 Pro, not the published 58–63 (aud-B §3). A's "swirl" is production `interpolateCamera`, made visible by A's stale-camera fix (aud-A X2). |
| Dense-System behaviour | ●● | ●● | ● | A: great under ~100, strains above on the 3a (owner). B: survives 800 without a crash, but is CPU-bound (~60 fps on 120 Hz, main thread 79% busy, aud-B §1). C: needed three compensations to read at all (aud-C). Prod: likely 2–3 fps at Dense 120 and ANR at 400 on the 6 Pro (aud-B §4, one run). |
| Accessibility / reduced motion | ●●● | ●●● | ●● | All three gate reduced motion: A 0 presents (aud-A §7), B 0 presents (aud-B §1), C pixel-identical frames 5 s apart. The canvas is never the a11y path; the RN companion sheet is (aud-G §1.3). B's glass measures 4.42:1 in Standard Dark, under 4.5 (aud-B §6). |
| Measured / observed Android perf | ●●● | ●● | ●● | A: release idle 21 presents/s at 32% main-thread CPU; recenter 82–92 fps (aud-A §7). B: after the tilt fix, ~60 fps CPU-bound and warmer (aud-B §7). C: a steady 60 fps ceiling (JS loop, 10–11 ms JS per frame) and +52 MB Hermes external memory per mount (aud-C §3). **No lab measured the Pixel 3a**; only the owner's hands did. |
| Lifecycle correctness | ●●● | ●● | ● | A: stable tree; base texture disposed on unmount, though old snapshots are never disposed (aud-A §6). B: 0 frames off-screen, but rebuilds everything on return and re-renders on every photo arrival (aud-B §3, §6). C: renderer init 486–567 ms per mount and a 465 ms worst frame (aud-C §2). Every lab inherits prod's unmount-on-blur, which makes tab return slow in all of them. |
| Maintainability | ●●● | ● | ●● | A: 5 pictures, token-clean, 102 lab tests pass (aud-A). B: `LabRings.tsx` 1,627 lines with ~6 parallel ring paths, 1,054 lines of SkSL strings, 50+ flags threaded through shared overlays (aud-B §6). C: a second render stack; lab gating spread across shared camera logic (aud-C §1). |
| Dependency / native-build risk | ●●● | ●●● | ● | A and B add nothing. C adds two young dependencies (react-native-webgpu renamed May 2026; 19 releases in ~5 months) and native binaries (aud-P §4). **New today:** `react-native-skia` 3.0.x (Graphite, minSdk 26) shipped from a fork. Ruled S1: V2 stays on Shopify 2.x (aud-P §2A). |
| Theme integration | ●●● | ●● | ● | A: six new `orrery*` tokens in all four presets; `check:colors` clean. B: no literals, but many formula-mixed colours that need authored tokens (C-03/32/40/44/53/68). C: light themes undifferentiated (owner D26). |
| Portability (iOS / web) | ●●● | ●● | ● | Skia 2.5D is ~90–95% shared code; per-platform work is a thin host layer plus web fonts and wasm. C needs Skia for text **and** WebGPU, so it has two GPU stacks to port (aud-P §5–6). |
| Productionization effort | medium | high | very high | A: a foundation with few deps. B: harvest functions and shaders, not files. C: a different stack; only the camera and layout maths port. |

**The owner ruled D1 = Skia 2.5D** ("3D looked more modern, but C performed worse, and the size and dependency costs make the decision final").

---

## 4. Successful ideas, independent of which lab produced them

Each idea, with its source, files, commits and evidence, is in [HARVEST-MAP.md](HARVEST-MAP.md). The short list of what V2 keeps:

**Camera and layout**
- Tilted Home as one "Home profile" tunable `{tilt, lensShift, fitRule}` (C), at ~62°. The owner may go back to flat, so flat must stay a supported value.
- C's dolly focal model, which is what makes 62° read as depth rather than squash (aud-C §1; aud-A §5).
- Lens-shift strategy composition (C).
- Near-side size clamp (B).
- Minimum on-screen size applied in world radius, so drawn == tappable (C, preferred over B's visual-only FLOOR).
- Ring density fade (C).
- Top-inset fade (C).
- Projected-size label tiers (C).
- Nearest-first label allocation (C).
- Body exclusions (C).
- A small, perceptible pan coast (owner D5).

**Rendering foundation (A)**
- Stable picture tree.
- Ambient clock quantised to 30 Hz, and −1 under reduced motion.
- Static base baked only when the scene is still.
- World-space plane under the exact homography, with analytic strokes in screen dp. **Never stroke under a perspective transform.**
- No 128-point ring polygons in the frame.
- Opaque canvas on Android.
- Paragraph cache with a shared builder (C).

**Visual language**
- Lab A's star sun (corona and granulation shaders).
- B's thin, sun-lit ring styles, keeping the non-colour dash cues.
- B's rim + atmosphere status shader with lighter face shading (raise `lightFloor`).
- B's sky profiles as a starting point: Standard-Dark graphite as the calm default feel; light-mode ink sky. Galaxy gets a quieter nebula with more stars than A.
- Per-System sky hue from the stable System id (B), with more than 6 buckets.
- C's orbital-plane grid as an optional layer, opacity 0 allowed.
- B's subtle orbit light pulses, made quieter and ticking on A's 30 Hz clock.

**Focus and interaction**
- Reticle (A's self-contained worklet, accent-only).
- Dim the rest of the map (B).
- C's docked-card focus framing.
- Zoom into a tapped cluster (new).
- B's corner-bracket chrome.
- B's reorder charge arc and projected-orbit outline, driven from gesture state.
- A's stack pips, for co-angular hidden contacts.
- The new far-zoom moon bump that splits into moons (M1).

**Switch**
- B's star-warp look, built on a fixed sprite budget.
- A's real-history orbit trails.
- A deliberate camera swirl using shortest-arc yaw, composed with C's camera "breath".
- Production spin, shed and capture underneath.

---

## 5. Compatibility of the owner's chosen combination: conflicts and trade-offs

The owner's picks were made per feature. Below are the places where picks interact. **Nothing here was silently resolved.** Each row says whether it is an engineering resolution or needs an owner ruling (recorded in the dossier).

| # | Combination | Conflict / trade-off | Resolution |
|---|---|---|---|
| X1 | 62° tilt (D3) on Skia 2.5D (D1) | Production `MAX_TILT = π/3` (60°) silently clamps 62° (`main:src/logic/orrery-camera-logic.ts:72`, `:244`). `deriveFocalDistance` is built on `sin(MAX_TILT)`, so raising it changes perspective for **every** pose. With main's telephoto focal (~4.65×extent), 62° only flattens the disc (cos 62° ≈ 0.47) and gives no depth. C's "3D strategy" look came from its **dolly focal** (`720/zoom`). | **Engineering.** Split Home tilt from max tilt. Adopt the dolly focal model in camera logic. Re-derive the depth clamp. Every `frameBodies`/`unproject` caller gets tests. Flat (tilt 0) must remain a valid Home profile, with lens shift 1.0 and a whole-disc fit. |
| X2 | Dolly focal (X1) with semantic zoom, tap-to-Profile and C focus framing (D19) | Under a dolly, `zoom` stops meaning magnification. `semanticLevel(zoom)` and `tapIntent` (tap → Profile at zoom ≥ 2, `orrery-camera-logic.ts:587`) break. C's focus framing also removes the `IDENTITY_ZOOM` cap. | **Engineering, with owner visibility.** Drive label tiers from projected size (C's `effectiveLabelZoom`). Re-key tap-to-Profile from projected body size, not raw zoom. The dossier records the focus-zoom change as a deliberate amendment of phase-08 §focus. |
| X3 | Tilted rings on Mali | Strokes and dashes under a perspective CTM fall off a GPU cliff on the 6 Pro: 3–9 fps (B), 150–200 ms idle p50 (A). | **Engineering.** Two proven escapes: A's world-space plane on cached `SkVertices` under H, and B's full-screen ring field. Pick one in an early spike measured on **both phones**. Default to A's approach because it fits A's stable tree and baked base; B's field is the fallback. |
| X4 | Subtle light pulses (D10) with a cool idle (O5/D29) | Pulses are continuous motion, so the Orrery is never fully idle. In B they forced redraws at display rate. On Android the opaque SurfaceView keeps the panel at 120 Hz, which alone costs A 32% main-thread CPU while idle (aud-A §6). | **Engineering, with an acceptance gate.** Pulses, twinkle and the sun pulse tick only on the 30 Hz quantised clock. They re-record only the pulse-bearing layer, with the static base baked. Lower the panel rate while idle, or stop the clock between ticks. **Gate:** no noticeably warmer than today's Orbit on either phone. If pulses cannot meet it, take that back to the owner; don't silently drop them. |
| X5 | Moon bump (M1) + stack pips + 62° tilt | Both draw small marks on a body's rim. Tilt squashes rings vertically, so more co-angular stacks (pips) appear. | **Engineering design.** The two marks must be distinct: the pip is a ring-coloured dot; the moon bump is a satellite-styled nub with its own rule. Test a dense, tilted System with moons on. |
| X6 | Minimum size: B FLOOR (D16), C min-size, B CLAMP (D6) | Three overlapping mechanisms. B's FLOOR is **visual-only**: hit radius and label gaps ignore it, so drawn bodies can overlap their labels (aud-B §2). | **Engineering.** One mechanism in the projection: C-style world-radius inflation (drawn == tappable == labelled), plus B's near-side clamp. B's visual-only FLOOR is rejected. |
| X7 | Bodies on the ring (D12) with status (D14) and the a11y rules | Drift was one of the status channels (HANDOFF §7, 09-orrery rogue "max drift"). Removing it leaves ring colour, angle, ring style and body rim/glow. | **Owner-ruled (D12).** Keep a non-colour cue (dash, faded or trace ring styles) for colour-blind users. Rogue identity moves to B's cold, desaturated, no-glow body. Reorder's drift subtraction collapses to 0. |
| X8 | Painted sky (D7) with contrast (D28) and card glass (G1) | ADR-149's AA proof was made against the old solid background. B already measures 4.42:1 in Standard Dark. The worst pixel is a white initials glyph under the card, not the sky. | **Gate.** Redo the ADR-169 both-extrema proof over the brightest sky, nebula and body pixel in all four themes. Fix it by dimming what the Orrery draws under the card (B's occlusion lever). Card opacity does not change. |
| X9 | Star warp (D24/W1) on the Pixel 3a | B's switch is CPU-heavy: O(N²) setup, per-frame re-recording, a 4096-bin LUT rebuilt each tilted frame, a post-switch re-render train. On the 6 Pro it ran at 20–29 fps; on the 3a the owner called it janky. | **Engineering budget.** Fixed streak-sprite count; no particles, comets or trims; keyed O(1) setup; no React re-render during or after the switch; photos cached. **Gate:** smooth switch on the 3a at Size 120. |
| X10 | Standard vs Galaxy (D27), B's graphite as default (D7), per-System hue (D8) | The owner wants Standard and Galaxy distinct, a quieter Galaxy nebula, and B's Standard-Dark sky "as the regular background". Hue tints apply on top. | **Engineering design.** Standard = the graphite profile; Galaxy = a subdued nebula with more stars. Per-System hue is a tint over either. Authored per-theme tokens replace B's formula mixes. |
| X11 | Optional grid (D9) | The owner prefers C's grid but is unsure about any grid. | **Engineering.** Grid opacity is a tunable and 0 = off. C's `planePattern` bake is drawn with one perspective matrix. Owner device checkpoint. |
| X12 | Skia 2.x (S1) with web later | Web needs Skia ≥ 2.11.2 (framerate fix). Expo SDK 58 brings RNGH 3, which replaces the `Gesture.*` builder API. | **Engineering.** Keep gesture semantics in pure functions so the RNGH 3 move is mechanical. Isolate Android-only choices behind a render-host capability interface (§7). |

---

## 6. Proposed Orrery V2 architecture

```
SQLite → loadOrreryScene (unchanged) → deriveOrreryWorld (D12: no drift push)
       → useOrrerySwitchRuntime (captures only SharedValues + ids; memoised; bug fix)
       → frame = useDerivedValue: choreography → camera (Home profile; dolly focal)
                → reorder preview → satellites (+ M1 bump/split) → projectFrame
                  (hoisted basis; no ring polygons; min-size + near clamp in projection;
                   O(1) key index)
       → renderer (new): stable <Canvas> tree of a few <Picture>s, inputs = SharedValues
            base   : sky (CPU-baked nebula + star layers, per-System hue tint) + optional grid
                     + world-plane rings (analytic, under exact H), baked when static
            ambient: 30 Hz quantised clock (−1 under reduced motion): twinkle, sun pulse,
                     subtle orbit pulses (only these re-record at idle)
            bodies : rim+atmosphere status shader, lighter faces, stack pips, moon bumps/moons
            sun    : A's corona + granulation star
            focus  : reticle, dim veil, card-occlusion dim (for AA), reorder charge/outline
            switch : warp streak sprites + orbit trails + camera swirl/breath (budgeted)
       → hit-testing / labels / focus card / HUD read the same frame (drawn == tappable)
HUD (RN): glass cards (ADR-149) + corner brackets, docked focus card, immersive header,
          ContactsSheet a11y path (unchanged)
Text: one OrreryTextService (shared ParagraphBuilder + cache + disposal)
Platform: OrreryRenderHost capability interface (opaque/SurfaceView, frame-rate hint,
          Mali workaround flags, offscreen bake path, font provider, DPR source)
```

**Invariants V2 keeps** (aud-G §1.4):
- Placement and state rules:
  - dense rank → ring (ADR-046);
  - timestamp → angle;
  - query-time status (ADR-011);
  - one canonical world, with the camera separate (ADR-077);
  - frame-driven hit-testing with uid + generation guards;
  - contacted-only reorder and its `ring_seq` write.
- System rules:
  - System identity and membership;
  - switch lands at Home;
  - shared focus is preserved.
- Runtime rules:
  - one unmountable clock;
  - pause on focus loss or background;
  - reduced-motion gates (ADR-085);
  - the worklet ordering guard (`orrery-worklet-order.test.ts`);
  - theme tokens everywhere, Skia included (ADR-006, `check:colors`);
  - portrait lock.

**What V2 replaces:**
- in `OrreryCanvas` and the `OrreryWorld` JSX subtree, the body, sun, moon, ring and label drawing;
- ring styling, the reorder ghost look, focus card placement, cluster behaviour (zoom in), and the choreography spectacle constants.

---

## 7. Portability (Android first; iOS and web planned)

Full analysis: [audits/PORTABILITY.md](audits/PORTABILITY.md).

| | Skia 2.5D (chosen) | three.js WebGPU (rejected) |
|---|---|---|
| Shared code | About 90–95%. Scene, world, frame, camera maths, choreography and label allocation are plain TS. SkSL is one source. | About 90% on paper, but it still needs Skia for text, so two GPU stacks |
| iOS | Low risk. Ganesh on Metal. `opaque` is a harmless no-op. `half` = fp16, so the Mali-safe shader choices carry over. | Dawn → Metal, 109 MB framework, never tested on iOS |
| Web | Works with costs: self-hosted CanvasKit (3.25 MB gzip; a CDN fetch would break local-first); no UI thread (worklets run on the main thread), so it needs a reduced-effects tier; a bundled font provider with non-Latin fallbacks (`matchFont` throws); `MakeOffscreen` uses a separate WebGL context, so the base bake needs a raster path; DPR is read once | Best ceiling with WebGPU, but Lab C's own adapter request defeats three's WebGL2 fallback. Inherits every Skia text issue. |
| Debt to isolate now | One `OrreryRenderHost` / capability interface owning: opaque→SurfaceView, the frame-rate hint, Mali workarounds as flags, the offscreen-bake path, the font provider, and the DPR source. All text through one `OrreryTextService`. | — |
| Biggest risk | **Backend churn, not portability:** Skia 3 / Graphite (Vulkan on Android) landed 2026-10-02 and may invalidate Mali/Ganesh tuning. Ruled S1: stay on 2.x and isolate tuning as capability flags. | Dependency maturity |

**Verdict:** the chosen direction creates moderate, contained platform debt. The one Android-specific structural choice (SurfaceView) and the Mali workarounds must sit behind the host interface from day one, so that iOS, web or a Graphite backend can re-tune without restructuring.

---

## 8. Transplant versus reimplement (summary)

Detailed per-item classification: [HARVEST-MAP.md](HARVEST-MAP.md).

| Class | Items |
|---|---|
| **Transplant: lift code nearly as-is, then retune** | A: `CORONA_SKSL` + `SUN_DISC_SKSL` + `drawSunBody` (star sun); `drawReticle` + `reticleGeometry`; `findStacks` + `drawStackPips`; `RING_WORLD_SKSL`/`GRID_SKSL` + `planeHomography` + `makePlaneShapes`; `projectionBasis`/`projectWithBasis`; `displayedSwitchCamera` (stale-camera fix). B: `BODY_LIT` shader (with retuned `lightFloor`/`LIGHT_Z`/`wrap`); RIM shader term; `labClampNearSizes`; `systemSkyIndex` (widen the palette); DIM maths; `OrreryHudCorners`; reorder charge/held draw functions; sky profile values. C: `focusCardPlacement` + the focus loop; `effectiveLabelZoom`; the nearest-first sort key; exclusions; the min-on-screen-size inflation; ring density fade; top-inset fade; switch breath; `planePattern`; `OrreryTextCache` + shared builder. |
| **Reimplement: keep the concept, write fresh** | The renderer itself (A's pattern, new code); B's thin ring style as a spec drawn by the chosen tilted-ring method; subtle FLOW pulses on the 30 Hz clock; the star warp on a sprite budget; A's trails (no scratch mutation inside a mapper); the camera swirl (shortest-arc yaw); the sky (more stars, a quieter nebula, authored tokens); the light-theme rule; the M1 moon bump (new semantics); cluster zoom-in (new); the parity test pattern for any independently projected draw path; the initials grapheme fallback (emoji-safe). |
| **Do not take** | C's renderer and its three.js scene code; C's gestures; B's and C's moons; C's reorder; B's gravity grid; B's FLOW at full intensity; WAKE; tether; bloom, tilt-shift, flare and heat-haze; B's visual-only FLOOR; A's card-above placement; the lab flag and preset systems, A/B toggles, HUDs, package ids and seeds. |

---

## 9. Production-phase scope and acceptance (handed to the dossier)

The dossier turns this into the contract. Areas, in likely dependency order (plan splitting is the planner's job under CLAUDE.md's plan-sizing rules):

1. **Correctness fixes and logic changes, pure TS, testable first.**
   - The five main-line bugs (freeze/captures, O(N²) lookups + projection hoist, stale camera, Paragraph cache + the 800-body path, initials, Unavailable System).
   - Drift removal (D12).
   - The Home profile, dolly focal, tilt split and projected-size semantics (X1/X2).
   - Min-size and clamp in the projection (X6).
   - Moon bump/split rules (M1).
   - Cluster zoom-in.
2. **Renderer foundation:** the imperative stable-tree renderer; the tilted-ring method spike (X3) on both phones; the render-host capability interface; `OrreryTextService`; the quantised ambient clock; the base bake with snapshot disposal.
3. **Visual layers:** sky profiles and tokens; per-System hue; the optional grid; rings and pulses; the status body shader; star sun; stack pips; moons.
4. **Focus, HUD and interaction:** reticle, dim, docked framing, card-occlusion dim, corner brackets, immersive header, reorder visuals, coast.
5. **Switch:** warp + trails + swirl/breath on budget; reduced-motion crossfade unchanged.
6. **Themes and contrast:** authored tokens for all four themes; Galaxy-light flavour; the AA re-proof (D28 gate).
7. **Device verification:** day-one release baseline of **today's main** on both phones (no lab ever measured main in release); then debug iteration; one release build for owner sign-off on the Pixel 6 Pro and Pixel 3a.

The acceptance criteria are in the dossier's Verification Expectations.

---

## 10. Lessons that must carry forward

1. **Measure release builds on physical phones, both of them, from day one, including today's main.** Debug builds understated release by large factors in every lab, and A's first release measurement reframed the whole lab.
2. **The declarative RN-Skia tree is the ceiling, not drawing.** Per-item `layer` saveLayers, whole-tree prop re-conversion, and clock-captured values that return fresh objects caused it.
3. **Never stroke or dash under a perspective transform on Mali.** Use analytic shaders.
4. **Never put GPU hash/fbm noise in mediump.** CPU-bake it.
5. **Worklet closures are a serialisation hazard.** Capture only SharedValues and small ids, and keep a capture-guard test.
6. **gfxinfo is blind to a SurfaceView or WebGPU surface.** Use SurfaceFlinger presents or in-loop frame stats.
7. **Hierarchy beats glow** (A's lesson). Every "more game" attempt that only added luminance made it worse.
8. **Presentation must never change semantics.** Visuals stay outside `radius`, `hitRadius` and label metrics unless deliberately moved into the projection for everyone (drawn == tappable).
9. **Lab write-ups contained confident false or misleading claims.** Examples: B's "switch 58–63 fps", B's "the untilted path is the pre-fix code", C's M1 numbers from an uncommitted note. Always re-verify against code and raw evidence.
10. **adb cannot test this UI fully.** It has no multi-touch, and TalkBack swipes become camera input. Plan owner hands-on time for gestures and accessibility.

Dead ends to never rediscover: [DEAD-ENDS.md](DEAD-ENDS.md).
