# Lab B — R3 report: integration polish

2026-10-01. Branch `experiment/orrery-skia-unleashed`. Code commits `13c706ad` (presets,
near-size clamp, immersive chrome, HUD rail, stale-comment fixes, harness/phone script on
presets), `1c339064` (crash fix: `moonShader` + layer pictures),
`23bedb9c` (Home tilt lab-only), then this docs/evidence commit. Every image is from the desktop **emulator** (1280×2856, release
x86_64 builds `r3a`…`r3e`); every cost is **relative on that emulator**, never a phone claim.
Evidence: `evidence/11-r3/`. Detail: DECISIONS-LOG (R3), COMPROMISES C-71…C-73, PERF-LOG (R3),
DEAD-ENDS (R3).

## 1. Legibility with the R2 stage on (re-measured)

Method = R1's (`tools/r1-contrast.py`), driven by `tools/r3-legibility.sh` (adds a Recentre so the
Home tilt, light pool, rim-lit rings and plane grid are in frame): static reduced-motion Dense,
focus on Cleo Okafor next to the sun, identity zoom, all four themes. Before = R2 build `r2d`
(`00-legibility-before/`), after = R3 build (`04-legibility-after/`), plus "Everything" (bloom +
lens flare + tilt-shift on) in the dark themes (`04-legibility-after/everything/`).

| Theme | Focused/plate label model (worst) R2 → R3 | Defocused label vs median | Glass `textSecondary` model R2 → R3 | Glass text measured (worst) | "Everything" glass model |
|---|---|---|---|---|---|
| Galaxy Dark | 10.96 → 10.96 | 14.27 → 14.28 | 4.51 → 4.51 | 12.39 | 4.51 |
| Galaxy Light | 14.58 → 14.58 | 5.14 → 5.14 | 5.56 → 5.56 | 15.36 | — |
| Standard Dark | 11.12 → 11.35 | 14.41 → 14.41 | **4.47 → 4.42** | 10.67 | 4.42 |
| Standard Light | 15.27 → 15.27 | 5.25 → 5.25 | 5.10 → 5.10 | 15.96 | — |

- **No regression from the R2 stage.** The light pool (strength 0.13) never becomes the extreme
  pixel under a label or panel; the sun's R1 composite cap still bounds the dark themes, even with
  bloom on in "Everything" (the bloom halo spreads light, it does not create a brighter extreme
  than the capped sun limb). Nothing was retuned.
- Standard Dark glass `textSecondary` stays at 4.42–4.47 (model): the extreme is still the initials
  glyph ink (`avatarSwatchText`), the R1 owner item C-02 — unchanged by R2/R3.
- R2's light-theme "measured vs p98" dip (3.57 / 3.69) is the status hairline + leader above a
  defocused plate entering the measurement box (decoration beside the glyphs, as R1 found for
  the dark themes); in the R3 capture the same labels read 5.14 / 5.24.
- **New element — the floating header title (immersive chrome):** `textPrimary` over
  `background` at the scrim's minimum behind the bar (0.84) composited on the scene's extreme raw
  pixel = **9.93–10.90 : 1 model**, 12.6–15.8 : 1 measured (`header-title.tsv`).

## 2. Near bodies at detail zoom (Home tilt)

Cause (measured on the formula, `perspectiveScale`): focal distance ≈ 4.65 × extent, so
perspective alone only adds 13–30 % at the near edge; the rest is the detail zoom itself, and the
tilt packs more near-side bodies onto the screen bottom (under the FAB column).

Fix (flag `nearSizeClamp`, default ON, C-71): `labClampNearSizes` post-processes the FRAME in the
model half's frame worklet — size growth from perspective is knee'd at +6 % (positions keep full
perspective, so the plane still recedes) and the drawn radius soft-caps at 8 % of the viewport's
short side (tanh knee at 70 %); the sun is exempt; hit radius keeps the `MIN_HIT_RADIUS` floor.
Because it is the frame, the bodies picture, label gaps, hit-testing, reticle and card keep-out all
agree. Iteration: 9.5 % (`01-iter1/04-detail-dense.jpg`) still read as a disc under the FAB →
8 % (`02-iter2/04-detail-dense.jpg`). Tests: `labb-near-size.test.ts`.

Not solved by design: a body can still be panned under the FAB column (any map can); the
"detail" panel preset zooms about the view centre (debug path C-25); a real pinch zooms around the
fingers.

## 3. Immersive chrome (Orrery route only)

Flag `immersiveChrome` (default ON, lab renderer, C-72):
- The canvas fills the Orrery route; the route's own `ShellAppBar` floats over it inside
  `LabImmersiveHeader` on a `background`-token scrim (0.96 at the top, continuous with the
  status band → 0.84 behind the title → 0 over 44 dp below the bar). The map now runs under the
  title instead of starting at a hard edge (`05-final/presets-02-overview-dense.jpg`).
- Iteration 1 used abutting bands and drew hairline seams (`01-iter1`); iteration 2 uses nested
  top-anchored bands solved to the target profile (`labb-header-scrim.ts`, tested) and clips the
  bar's own bottom hairline with a wrapper (`02-iter2`, `03-paths`).
- The bar is an obstacle (`orrery-lab-header`), so the usable camera rect, Home framing and focus
  card placement are unchanged in window terms; the selector / View options get `topInset`.
- The three controls become one HUD rail (single plate, accent corner brackets, hairline
  separators); same names, states, 55 dp targets (`orrery-controls-render.test.tsx`).
- **Skipped (shared shell):** the status-bar band (navigator `SafeAreaView`), the tab bar, the
  universal "+" FAB, `ShellAppBar` styling. An edge-to-edge map needs a shell-level "immersive
  route" contract — V2/owner.

## 4. Less-tested paths (`tools/r3-paths.sh`, `evidence/11-r3/03-paths/`)

| Path | Result |
|---|---|
| Polaris north flare | **Works** on a Polaris tap (two rings + cross spikes, `north-polaris-flare.jpg`, `north-polaris-tap.mp4`). **Open:** the same tap does not visibly rotate the camera to north (flat or tilted, `np-flat-*`), although the flare proves `hitPolaris` passed and `camera.recover(northTarget)` was called; the rail's Reset north works (`sheet-north.jpg`). Model-half gesture/recovery path, not diagnosed; legacy comparison inconclusive. |
| Cluster tap (JD/EN overlap, tilted plane) | Group panel opens, a reticle per member (`cluster-1-panel.jpg`). |
| Far-zoom focus (0.4) | Flies in and locks; card anchored (`farfocus-*`). |
| Reorder with Home tilt | Hold charge → elliptical held-ring glow on the tilted plane + reticle; drag commits (RB moved one slot, `sheet3.jpg`). |
| Background during a big switch | Home 1 s into Inner → Dense, foreground 3 s later: lands settled on the destination, photos/nebula re-hydrate within ~5 s, no stuck state (`bgswitch-*`). |
| Every theme with R2 flags | Overview + focus in all four themes (`02-iter2/sheet-b.jpg`). |
| Reduced motion, everything on | Preset "Everything" + `rm=on`: **0 changed pixels** below the status bar over 3 s (`rmstatic-a/b.png`). |
| **Bug found + fixed** | "Everything" crashed the app: `moonShader` + layer pictures called `makeShaderWithChildren` without a children array (`Value is undefined, expected an Object`). The moon effect has no children → `makeShader` (`1c339064`). The test Skia mock had silently defaulted the array; it now throws like native. |
| **Bug found + fixed** | The Legacy preset drew a tilted legacy map (`labHomePose` ignored the renderer) — Home tilt is lab-only now. |

## 5. Presets and final defaults

One-tap switcher at the top of the FX panel (`05-final/panel-presets.jpg`; chip centres at
1280×2856 with the panel unscrolled: best 196,1457 · ship-safe 464,1457 · everything 733,1457 ·
legacy 976,1457 — every older RUNBOOK panel coordinate moved down ≈ 200 px) and deep link
`orbit://labb?preset=best|shipSafe|everything|legacy`. Presets set renderer + every non-debug
flag; debug instrumentation keeps its value (except `forceFallback` / `freezeClock` → off); the
`ringsPathRebuild` A/B baseline is never on. The active preset is highlighted while the flags match.

| Preset | What | Why |
|---|---|---|
| **Lab B best** (= registry defaults = Reset) | Every WP-1/2 layer and effect, R2 art (`homeTilt`, `planeLight`, `planeGrid`, `ringSunLight`, `bodySizeFloor`), R3 `nearSizeClamp` + `immersiveChrome`; experiments off | The best-looking configuration without a known GPU cliff |
| **Ship-safe** | Best minus `ringWake`, `ringFlow`, `fxFocusDim`, `planeGrid`, `nebulaLive`, `moonShader`, bloom, lens flare, tilt-shift, shock filter | Drops owner-glance clutter (C-04/C-17), the defocus legibility trade (C-52), decorative non-data texture (C-67) and every costly/failed experiment; also measurably cheaper (§7). Membership is a lab judgement (C-73). |
| **Everything** | Every effect incl. bloom, lens flare, tilt-shift, shock filter, live nebula, moon shader | Worst case for the phone pass |
| **Legacy** | Production renderer, production Home (tilt 0) | Baseline |

Final captures on release `r3d`/`r3e` (`05-final/`): `presets-01-overview-inner.jpg`,
`presets-02-overview-dense.jpg`, `presets-05-focus-cleo.jpg` (columns best / ship-safe /
everything / legacy), `presets-switch-sequence.jpg` (Inner → Dense, 9.0–11.5 s of each
recording, one row per preset), `switch-best.mp4`. (Lab presets captured on `r3d`; `r3e` only
changed the legacy renderer's Home, so Legacy was recaptured on `r3e`.)

## 6. Visual iterations

1. `r3a` (`01-iter1/`): presets, clamp at 9.5 %, immersive header with abutting bands → seams
   under the title, near body still a disc at detail.
2. `r3b` (`02-iter2/`, full art set incl. all themes): nested-band scrim (seams gone), clamp 8 %;
   remaining: the bar's own hairline across the map in light themes.
3. `r3c`/`r3d` (`03-paths/`, `04-legibility-after/`): hairline clipped; crash fix.
4. `r3e` (`05-final/legacy`): Legacy = production Home.

## 7. Costs (emulator, relative; `perf/summary.tsv`, PERF-LOG R3)

Dense 120, gfx p50 (ms) idle / pan / focus / switch-in: best 24 / 23 / 26 / 25; **ship-safe
18 / 20 / 18 / 18**; everything 25 / 25 / 28 / 20; best + bloom 27 / 23 / 26 / 26 (GPU p50 +4);
best − stage 24 / 24 / 24 / 24; legacy 200 / 200 / 200 / 38 (36–64 skipped). Ship-safe is the only
row separable from noise: with `ringFlow` on, the rings picture re-records on every clock tick
(659 runs vs 100 in the pan window). The clamp (`frame` probe 0.8–1.0 ms) and the immersive chrome
(static views) cost nothing measurable.

## 8. Gates

- `npx tsc --noEmit`: clean.
- Orrery vitest (`src/components/orrery src/stores/orrery src/navigation src/logic/orrery`):
  722 / 722 green; `src/components/orrery/labb`: 106 / 106 green after the crash fix.
- Full vitest after the last code commit: **554 files / 6 254 tests green**.
- `npm run check:colors`: exit 0. Biome: clean on all 23 `src/` files touched in R3.
- Device: release builds `r3a`…`r3e` on the emulator; crash buffer empty after the matrix,
  final captures and path runs on `r3d`/`r3e`.

## 9. Open problems / owner items

1. **Polaris tap does not recover north** (flare fires) — §4; needs a debug-build trace of the
   tap → `camera.recover` path (also check on main / legacy).
2. C-71 near-size clamp, C-72 immersive chrome, C-73 ship-safe membership — owner taste; C-66 Home
   tilt still the main owner decision (now lab-renderer only).
3. Standard Dark glass `textSecondary` 4.42 (model) — R1 owner item C-02, unchanged.
4. Shell-level immersion (status band / tab bar translucency, "+" FAB styling) was out of scope
   (shared shell).
5. Phone: every number here is emulator-relative; `research/PHONE-PASS-SCRIPT.md` now runs the
   presets plus `bloom` / `nostage` rows into `evidence/12-phone/`.

## 10. Tooling added / changed

`tools/r3-legibility.sh` (Recentre + `PRESET`/`FLAGS`), `tools/r3-paths.sh` (north, cluster,
farfocus, reorder, bgswitch, rmstatic), `r2-shots.sh` `PRESET=`, `r1-perf.sh` `PRESET=`,
`r1-matrix.sh` configs = presets + `bloom` / `nostage` / `labmin` (labmin now also turns off the
R2/R3 flags). Screenrecord at native 1280×2856 fails (`err=-22`); always pass `--size 720x1606`.
