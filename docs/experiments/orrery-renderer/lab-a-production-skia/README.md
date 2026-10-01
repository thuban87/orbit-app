# Orrery Lab A: Production Skia

**Question:** How game-like can the Orrery get on its existing Skia + Reanimated + RNGH foundation while it stays a plausible near-term production architecture? See [HYPOTHESIS.md](HYPOTHESIS.md) for the full question and the "deep-field star chart" bet.

**Status:** the experiment is complete and runs on a device. It is **not for merge**: the work is R&D on an experiment branch, and the owner decides what gets harvested.

| | |
|---|---|
| Branch | `experiment/orrery-skia-production` (local only, never pushed) |
| Base | `main` @ `3492092` |
| HEAD at writing | `978643c9` (31 lab commits, plus this research package) |
| Package | `com.bwales.orbit.laba`, launcher "Orbit Lab A". It installs side by side with `com.bwales.orbit` (`app.config.ts`, commit `6514a80`). |
| Device | Pixel 6 Pro (`raven`, 1440×3120, 120 Hz). A release build of `5fb0f0d7` is installed. |
| Dependencies | **None added.** `package.json`, the lockfile and `patches/` are unchanged from base. The lab uses RN-Skia 2.6.2, Reanimated 4.5.1 and worklets 0.10.4, which were already present. |

## What was built (one paragraph)

When the A/B toggle is on, the Lab A renderer replaces the Orrery's drawing. It does not change the Orrery's semantics. The design is a deep-field sky: a CPU-baked nebula, parallax stars and a vignette. Under it sits a world-plane astrolabe drawn **in world space under the camera's exact homography** (analytic constant-screen-dp strokes). Bodies are lit by the sun (terminator, rim, atmosphere, keyline and contact shadows). The sun is drawn as a star with a corona and granulation. Labels become instrument plates, and focus shows a UI-thread targeting reticle. A System switch reads as a "jump" (motion trails, ink-in rings, ripples, flare and warp).

The renderer itself is **imperative**: five `SkPicture`s are recorded on the UI thread from the one sampled `frame`, with a cached base texture, conditional redraw, and an opaque canvas (SurfaceView). The architecture is described in [ARCHITECTURE.md](ARCHITECTURE.md) and the code map is in [IMPLEMENTATION.md](IMPLEMENTATION.md).

## Package isolation and the renderer A/B toggle

- **Isolation.** `app.config.ts` changes only `android.package` → `com.bwales.orbit.laba` and the launcher name. Provider authorities are `${applicationId}`-relative, so the lab coexists with the main app. The `orbit://` scheme is still shared, so a deep link may show a chooser. Details are in [BUILD-LOOP.md](BUILD-LOOP.md).
- **A/B toggle.** View options has a row, "Lab A renderer (experiment)", that switches Lab A ↔ the legacy declarative renderer **live, in one build, including release**. The toggle is in-memory only (`lab/deep-field-mode.ts`, a zustand store) and is reset to `DEEP_FIELD_ENABLED = true` on every app start. It is never persisted and is not DEV-gated.
  - **Caveat for any A/B number:** "legacy" in this build is *not* `main`. It shares the lab's logic-layer changes:
    - the freeze fixes (`ba3cef6`, `842f1f3`);
    - the stale-camera fix (`20538bd`);
    - the Hermes initials fix;
    - **the 45° tilted Home.** `LAB_HOME_TILT_DEG` lives in `src/logic/orrery-camera-logic.ts` `deriveHomePose` and applies to both renderers.

## Build / run / test (summary of [BUILD-LOOP.md](BUILD-LOOP.md))

| Step | How |
|---|---|
| Native build | Use the tar-over-ssh sync to `droid:C:\Users\bwales\projects\orbit-lab-a`, then `npm ci`, then `CI=1 npx expo prebuild --platform android --clean`, then `gradlew assembleDebug` (or `assembleRelease`). Pull the APK with `scp` (§a). Never `git push`. Run the droid-busy check before building. |
| JS-only change | No rebuild is needed. Metro runs on **:8083** (tmux `orbit-lab-a`), with `adb reverse tcp:8081 tcp:8083` (§c). Restore the previous mapping afterwards (the main app uses `tcp:8081 tcp:8082`). |
| Production-mode JS on the debug APK | Use the shared-prefs switch `js_dev_mode_debug=false`, `js_minify_debug=true` (§i). This is *not* a release build. |
| Seed data | `tools/seed-lab-a.py [--satellites 1]` creates 40 contacts (39 orbiting), Lab Dense (32), Lab Inner Circle (3), 5 moons and 15 synthetic avatars (§e). It needs the debug build (`run-as`). |
| Drive the UI | `tools/ui.py list/tap …` (uiautomator selectors) and `tools/shot.sh`. **Pinch and tilt cannot be automated** (no multitouch over adb). |
| Gates | `npx tsc --noEmit` · `npm run check:colors` · `npx vitest run src/components/orrery src/logic/orrery-*`. At HEAD this gives **38 files, 313 tests passed**. The arch pass ran a wider suite: 250 files, 2463 passed. |
| Perf capture | Use SurfaceFlinger `--latency` for the Lab canvas, because gfxinfo no longer sees a SurfaceView. Also use `/proc` per-thread CPU, screenrecord frame-diff and simpleperf. Scripts are in `evidence/*/tools/`; see [PERFORMANCE.md](PERFORMANCE.md). |

## Key commits by milestone

| Milestone | Commits | What |
|---|---|---|
| Infra | `6514a80`, `105fd72` | Package isolation; BUILD-LOOP, seed tooling, baseline evidence |
| Brief | `9237dbf` | HYPOTHESIS + `_research/SUBSYSTEM-BRIEF.md` |
| Direction 1 | `202b0d6`, `0a73a54`, `b450f47`, `58893a0`; review `3ad9295` | Six new theme tokens; declarative deep field (GPU fbm nebula), world plane under `concat(H)`, lit bodies, corona, HUD, switch FX (*superseded*) |
| Owner decision log | `5c47bb3` | K: tilted Home kept **for testing only** |
| Pass 1 | `c862c30`, `864f7e0`, `c5d535e` | CPU-baked nebula, hierarchy inversion (hairline + status segment), star sun, Home tilt 45°, Hermes initials fix |
| Pass 2 | `527bd5b`, `7899aac`, `15ec425` | Screen-space convex ring polygons + `RING_SKSL` (*superseded*), trails/warp/ink-in/ripples, depth cues, keylines, stack pips, focus card v1, lit moons, photo cross-fade |
| Freeze fix | `ba3cef6`, `842f1f3`, `20538bd`, `b1cfde3`, `655f6ad` | Projection basis hoist, narrow worklet captures, `frameBody` index, `billboardMap`, memoised Canvas content; stale-camera fix; A/B toggle |
| Pass 3 | `3cd7695`, `b1af0a5`, `0c0b18b`, `6ad5a30` | UI-thread reticle + focus emphasis, arrival ghosts, focus card v2 (narrow, natural height) |
| First release measurement | `730899b` | `evidence/final/` (release of `6ad5a307`) |
| Architecture perf pass | `fd7f09c`, `2111be6` | **Imperative five-picture renderer**, cached base texture, conditional redraw, photo custody |
| Camera perf pass | `033e751`, `dc7f866`, `5fb0f0d`, `978643c` | **World-space plane under H** (`RING_WORLD_SKSL`/`GRID_SKSL` on cached `SkVertices`), bake-only-when-static, **opaque canvas (SurfaceView)**, Lab frames without ring polygons |

## Headline results (release, Pixel 6 Pro; details in [PERFORMANCE.md](PERFORMANCE.md))

| | Release `6ad5a307`, declarative Lab (legacy ≈ same) | Release `5fb0f0d7` (final) |
|---|---|---|
| Idle main-thread CPU | ≈92 % (legacy ≈91 %) | ≈32 % (≈17 % before the SurfaceView; see the residuals) |
| Idle presents | ≈12/s (100 % janky) | 21/s (ambient capped at 30 Hz by design) |
| Camera motion | Pan ≈5 fps | Recenter animation 82–92 presents/s (median gap 8.3 ms); scripted pan 63/s, limited by adb input injection |
| Focus tap → response | 3.6–8.9 s (once >10 s) | 0.005–0.045 s, settled ≈0.63 s |
| Reduced-motion idle | ≈10 redraws/s, ≈91 % CPU | 0 presents, 12–13 % CPU |
| PSS after 10 switches | 1010 MB | 562 MB |

**Core finding.** Skia + Reanimated *is* a plausible production architecture when it is used **imperatively**. The ceiling of the declarative RN-Skia tree has three causes:
- per-item full-canvas `layer` saveLayers;
- whole-tree prop re-conversion and replay on every redraw;
- clock-captured derived values that return fresh objects.

Main's legacy renderer has the same pattern (see the caveat above about what "legacy" means here).

## Owner decisions pending (not settled by this lab)

- **K: tilted Home.** 45° is kept *for testing only*. Adopting it in production reverses phase-08 dossier §C/§P and 29-UI-SPEC ORRC-04/05 ("top-down Home").
- **H1 vs H2: fixing main's slow Orrery.** H1 harvests the cheap fix (drop the per-body/label `layer` props, stop fresh-object clock values). H2 ports the imperative renderer.
- **TW1 vs TW2: star twinkle.** Lab A's twinkle never rendered, because `drawPicture` ignores paint. TW1 keeps a steady sky. TW2 enables real twinkle, which dims the sky on average and adds ambient motion.
- **New ambient motion** (corona churn, granulation, reticle scan/lock-on, the 30 Hz ambient) versus ADR-048/077, which allow starfield twinkle and sun pulse as the only ambient motion.

## Where evidence lives

`evidence/<pass>/`: `baseline`, `direction-1` (`REVIEW.md`), `pass-1`, `pass-2`, `perf` (`latency-summary.txt`), `pass-3`, `final` ([`INDEX.md`](evidence/final/INDEX.md), [`PERF-RESULTS.md`](evidence/final/PERF-RESULTS.md)), `arch-perf`, `camera-perf`. The narrative for each pass is in `_notes/*.md`. The CanvasKit off-device previews (direction 1, the *intended* look and not evidence) are in `_notes/canvaskit-previews/`.

## Package map

| Technical (this set) | Design / decision half |
|---|---|
| [ARCHITECTURE.md](ARCHITECTURE.md) · [IMPLEMENTATION.md](IMPLEMENTATION.md) · [INTERACTIONS.md](INTERACTIONS.md) · [PERFORMANCE.md](PERFORMANCE.md) · [ASSET-MANIFEST.md](ASSET-MANIFEST.md) | [VISUAL-DESIGN.md](VISUAL-DESIGN.md) · [DECISIONS.md](DECISIONS.md) · [DEAD-ENDS.md](DEAD-ENDS.md) · [HARVEST.md](HARVEST.md) · [PRODUCTIONIZATION.md](PRODUCTIONIZATION.md) · [RECOMMENDATIONS.md](RECOMMENDATIONS.md) |
