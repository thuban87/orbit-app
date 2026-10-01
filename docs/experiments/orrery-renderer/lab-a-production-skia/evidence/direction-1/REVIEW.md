# Lab A direction 1 ("Deep-field star chart"): device review

**Reviewed:** 2026-10-01, Pixel 6 Pro (`raven`), package `com.bwales.orbit.laba`, **DEBUG build + Metro :8083** at HEAD `9237dbf6` (renderer commits `202b0d6c`..`b450f47e`). The change is JS-only, so no rebuild was needed. A force-stop and cold launch loaded the bundle fresh. The DEV marker "ORRERY LAB A — PRODUCTION SKIA" was visible on every Orrery view.

**Bar:** "opening it feels like entering a polished game's interactive star-system map."

**Verdict in one line:** the *structure* is right: the astrolabe plane, the corona, the reticle and the chart-paper light mode are real wins at low counts. On the device, though, the nebula is visibly **broken** (faceted, stair-stepped, with a hard vertical seam), and the hierarchy problem was **not** fixed. Rings are still the loudest element, and the added glow and trails make them louder. Bodies are still small chips at overview. Today it reads as "busier chart over a glitchy backdrop", not "game map".

## Environment, restore log, method

- `adb devices` showed exactly the Pixel (`1A071FDEE002BU`) throughout. No emu-connect was run. Reverse mapping was `tcp:8081→8083`, `tcp:8083→8083`, already set and left as found.
- **Original settings, now restored.**
  - Appearance: Theme **Galaxy**, Mode **Follow System**, accent default, Deep Space background. The phone is in dark mode, so galaxy-dark is the default view.
  - Animation scales: `animator_duration_scale=1`, `transition_animation_scale=1`, `window_animation_scale=1`. Restored to `1`, verified with `settings get`.
- **Reduced motion.**
  - The app reads RN `AccessibilityInfo.isReduceMotionEnabled` / `reduceMotionChanged` (`src/theme/use-reduced-motion.ts`).
  - On Android, RN's `AccessibilityInfoModule.kt` derives this from **`Settings.Global.TRANSITION_ANIMATION_SCALE == 0`** and observes that URI. `animator_duration_scale` is **not** what the app reads.
  - I toggled `transition_animation_scale` 0 → 1.
- **Logs.** App `console.*` goes to `adb logcat` (`ReactNativeJS`). The Metro pane only carries bundler output plus the Reanimated strict warnings. Both channels were checked with a before/after delta.
- **Not automatable.** Pinch, two-finger tilt and yaw (no multitouch over adb). **Max tilt was not reachable**: there is no tilt UI control, only Recenter and Reset north. One-finger pan works but is clamped to about 120 dp at home zoom.
- **Photos.** These are synthetic abstract avatars from the seed, not faces. "Photo recognisability" is judged on contrast and legibility only.

## 1. Errors, crashes, silent fallbacks

| Check | Result |
|---|---|
| RuntimeEffect / SkSL compile errors | **None** in logcat for the whole session. (A grep for "sksl" hit only launcher `RecentTasksList` lines, a false positive.) |
| Nebula, corona and body shaders actually rendering (not fallback) | **All three render.** The nebula texture is present (00, 01). The corona has an animated harmonic edge, and pixels around the sun change between two frames 1.5 s apart (mean diff 0.68 / 0.71). The body terminator, rim and halo are visible on initials bodies (crop of Clara, 02/05). Chart-mode corona rays and the light nebula contour wash render in light modes (14–16). |
| JS errors / redbox / LogBox errors | **None.** No `ReactNativeJS` `E` lines, no redbox. Only warnings: deprecation notices, plus **~774** Reanimated strict-mode "Reading from `value` during component render". The Metro pane already held 461 of these before this session, so they are not attributable to direction 1 without an A/B. |
| Crashes | **None.** The same PID 7035 survived the whole session: theme and mode switches, background/foreground, tab switches, profile round-trips. |
| Native log noise | `SkiaTextureView` emits `updateTexImage: LegacySurfaceTexture is not attached!` at about 30 Hz whenever the Orrery canvas is mounted. That was ~26k lines over 15 min, one new SurfaceTexture per remount (0–8). This is probably RN-Skia/TextureView behaviour and is **not attributable** without a baseline logcat. It is worth checking against the pre-Lab renderer (`DEEP_FIELD_ENABLED=false`). |

## 2. Per hypothesis item

| # | Item | Verdict | What I saw | Refs |
|---|---|---|---|---|
| 1 | Environment: nebula plus 2 star layers plus vignette, parallax | **broken** (nebula); stars and vignette weak-OK | The nebula renders as **faceted polygon shards with stair-stepped (aliased) edges and a hard full-height vertical seam** at x≈560 px. A hard diagonal cut to near-black runs lower-right. It looks like a texture-compression or precision glitch, not gas. This is consistent with reduced-precision evaluation of `hash21`/`fbm` on the Mali GPU. The CanvasKit previews were CPU fp32 raster, which is why they looked smooth. It is also **far too strong**: teal and violet at alpha 0.8 sit right behind the rings and wash out ring and body contrast. Stars are fine but get lost against the nebula. Hero spikes are visible (small, lower right). The vignette is barely perceptible under the nebula. Parallax on pan is subtle and correct in direction (22). | 00, 00a, 01a, 03, 05, 13, 22 |
| 2 | World plane / astrolabe | **works** (low count), **weak** (high count) | At 2–3 contacts (Family, Lab Inner Circle) the bezel ring, ticks, spokes and lit pool give a strong instrument look. It is the best new element. At 39 contacts the reference rings and spokes add one more layer of concentric lines under ~20 status rings, so the grid becomes noise. Tilt legibility (its main purpose) could not be tested. | 00a, 13, 15, 01 |
| 3 | Orbits as instruments: depth alpha, progress trail, tick | **weak** | Rings got *louder*, not quieter. Same hue saturation, plus an additive underglow (×3 width), plus a near-full-length bright trail on many rings. A dashed ring's glow is itself dashed, so it reads as a string of fuzzy beads. Trails on the long-interval (yellow) rings cover about 300° and read as a second, brighter ring rather than "progress". Depth attenuation can't be seen at tilt 0. The progress tick is too small to read at overview. | 01, 01a, 11, 17 |
| 4 | Bodies lit by the sun: terminator, rim, halo, contact shadow, far tint | **weak** | The lighting exists and the direction is correct (Clara is lit on the sun side, Ada's night side faces away). Shading is subtle and photos stay legible. **But body size is unchanged.** At overview bodies are still about 26 dp chips with truncated initials ("C…", "El…"), so the lighting is invisible where it matters. The **contact shadow reads as a black smudge offset beside the body** (most visible at tilt 0 next to Ada and Dev). Without tilt it looks like dirt rather than a cast shadow on a plane. | 01a, 02, 05, 00a |
| 5 | Sun as a star (corona) | **works** for the corona, **weak** for the sun | The corona edge, bloom and animation read well, and the white-hot to gold gradient is nice. The **sun disc itself is still a flat accent-blue fill with a gold outline**: a "blue button with a glow", not a star. The core never goes white-hot. Light mode's engraved rays read as deliberate. | 00a, 13, 15 |
| 6 | HUD: reticle, instrument plates, leader, marker | **works / weak** | The reticle (accent corner brackets) is crisp and game-like. Plates with status tick and leader read well and are legible in both modes. However, the **focus card still covers the focused body and the reticle** (pre-existing layout, unchanged from baseline 03). The marker is clear of the selector but overlaps scene content (a body at top-left in Lab Dense). | 02, 03, 05, 11 |
| 7 | System switch as a jump | **unverifiable (debug)** | In debug, both directions show a **4–5 s UI freeze after the tap**, then 2 discrete visual states (frozen mid-pose, then settled). Frame-diffing the 10 fps extraction finds only 2 changes. The baseline video shows the same freeze pattern (changes at frames 51/60), so this is pre-existing debug behaviour, not caused by direction 1. **Streaks, draw-on and flare could not be observed at all.** The frozen mid frame shows the **DEV marker drawn twice, offset** ("ORRERY LAB A│ORRERY LAB A — …"), so both layers render the HUD during a switch. Needs a release build. | 10, 12, 12a, 18 |
| 8 | Light modes as "chart paper" | **works** (best result) | Galaxy-light and standard-light both read as a deliberate engraved chart: ink rings, bezel ticks, rayed sun, faint contour wash. It is not a washed-out dark mode. The same hierarchy problem applies (heavy saturated ink rings at 39 contacts), and the nebula faceting is still faintly visible as polygon patches in the wash. | 14, 15, 16 |

**Guard-rail checks.** Reduced motion (transition scale 0): the app still ran, with no crash and no streaks visible. Debug shows no motion at all in either mode, so the difference can't be assessed. Lifecycle results are in §4.

## 3. Implementer's scrutinize list

The notes list 12 points; the first 8 are the core ones and all 12 are answered.

| # | Point | Verdict | Notes |
|---|---|---|---|
| 1 | Shader compile on Ganesh / silent fallback | **works** | No compile errors. Nebula, corona and body effects all visibly render (see §1). |
| 2 | Nebula strength / muddiness / band | **broken** | The problem is not mud, it is **faceting and seam artifacts** (a precision problem), plus too much alpha. No "galactic band" reads; it is screen-filling shards. |
| 3 | Perspective strokes at max tilt / dash / shimmer / horizon | **untested** | Tilt is not reachable without multitouch. At tilt 0 the strokes are clean. Pan shimmer is not noticeable in stills. |
| 4 | Ring and trail density at 30–40 | **broken for the bar** | Home at 39 contacts (01) and 32 (11) is a wall of glowing concentric lines. Trails add a second bright layer. |
| 5 | Photo recognisability under lighting | **works** (with caveat) | The night side darkens noticeably but the content stays readable at identity zoom (02, Dev and Ben). At overview, bodies are too small to judge, or to matter. Synthetic avatars only. |
| 6 | Corona pop at 2r cull | **untested** | Pan is clamped; could not place the sun just off-screen. When focused with the sun partly off the top edge (03), the corona is clean. |
| 7 | Per-frame picture allocation / GC | **untested (debug)** | No memory blow-up or crash over about 15 min of switching and panning. A release-build measurement is still needed. |
| 8 | Switch: streaks, draw-on, flare timing; RM has none | **unverifiable** | 4–5 s debug freeze (also in baseline). Only discrete states are visible. The doubled marker is visible mid-switch. |
| 9 | Light modes as chart paper | **works** | See item 8 above. |
| 10 | Label plate legibility / leader | **works** | Legible in all 4 palettes captured. The leader was not observed misplaced. |
| 11 | Marker clear of selector | **works** | Clear of the selector. It overlaps scene bodies, and is doubled mid-switch. |
| 12 | New ambient motion vs ADR-077 | **note** | Corona harmonics, twinkle and reticle spin are all running. This is an owner escalation for production (HARVEST). |

## 4. Lifecycle

| Action | Result |
|---|---|
| Home key, then relaunch | Same PID, no crash. The Orrery is back with ambient motion running: corona-region diff is non-zero across 1.5 s. |
| Tab away (Contacts) and back | No crash. **The canvas is blank (header only) for about 2–3 s** and then everything appears at once (19). |
| Back from Profile | First frames show **no nebula and initials instead of photos** (04). Both pop in, unanimated, about 3 s later (02b). |

The canvas remount is by design, but the hard pop of a full-screen nebula and of the photos is jarring. Whether the blank period is longer than the pre-Lab renderer's needs an A/B (`DEEP_FIELD_ENABLED=false`).

## 5. Rough perf (DEBUG build, not a perf claim)

| Capture | Frames | Janky | p50 | p90 | p99 | Notes |
|---|---|---|---|---|---|---|
| `20-gfxinfo-DEBUG-switch-all-to-lab-dense-8s.txt` | 53 | 100 % | 57 ms | 85 ms | 4100 ms | One GPU p99 of 4950 ms. |
| `21-gfxinfo-DEBUG-framestats-switch-lab-dense-to-all-8s.txt` | 35 | 100 % | 69 ms | 125 ms | 4850 ms | GPU p50 14 ms, p99 18 ms. |

- These cover the UI/RenderThread only. The 4–5 s stall is a single blocked frame, and the baseline video shows the same stall.
- The GPU p50 of 13–14 ms per frame with the full-screen nebula image, 3 star pictures and the plane picture is worth re-measuring in release. At 120 Hz, the GPU side alone would be over budget.

## 6. Hierarchy assessment (the key question)

In the baseline, the loudest element was the thick saturated status rings and bodies were tiny flat chips. **That did not invert.**

- **Ring stroke.** The core went to 0.72× width, but it gained a 3× additive underglow plus trails, so total ring luminance went *up*.
- **Bodies.** They are the same radius as the baseline. Lighting, rim and halo are confined to about 1.28r, which on a 26 dp chip is a few pixels. At 39 contacts the eye goes, in order: (1) the nebula shards, (2) the ring wall, (3) the sun, and (4) only then the people.
- **Overview legibility at 39.** Poor. No names, truncated initials, many bodies overlapping rings of the same hue, and the B/C pair at 6 o'clock almost stacked. The brief was "bodies are the subject, rings are instruments". Currently the instruments are the subject.

## 7. Ranked shortcomings and proposed fix direction

1. **Nebula artifacts (faceted shards, stair edges, vertical seam): a ship-blocker.**
   - Make the noise precision-safe:
     - wrap lattice coordinates (`mod(i, 289.0)`) and use a permutation-polynomial hash designed for mediump (Ashima/`mod289` style) instead of `fract(p*234.34…)`;
     - keep `uv` magnitudes small (seed as a small fractional offset, not 3.7 plus warp ×4.6);
     - declare all noise math `float` and avoid `half` in intermediate steps.
   - Alternative: render the nebula off-device at build time into a bundled image asset (local, no network), and tint it with token uniforms.
   - Re-verify on the Pixel, not CanvasKit.
2. **Nebula far too loud.** Cut `NEBULA_ALPHA_DARK` from 0.8 to about 0.25–0.35, and drop saturation toward `orreryVoid` so it sits at a value step below rings and bodies. Confine it to the band (raise the band power so the off-band sky is nearly void) and let the vignette show.
3. **Rings still dominate.**
   - Drop the dark underglow entirely at overview (`RING_GLOW_ALPHA` → 0, or zoom-gated in only at identity zoom).
   - Cut the ring core to about 1–1.25 px at roughly 0.45–0.55 alpha and desaturate it toward `orreryGrid`.
   - Keep full status colour only on the **near arc around each body** (about ±25°) and on the trail head.
   - Status should read from the body's rim and halo, not from a 360° coloured circle.
4. **Bodies too small; no presence.**
   - Increase *visual* radius at overview by about 1.4–1.6×, or a minimum of about 36 dp, as a presentation extent. Keep `radius`/`hitRadius` untouched as the guard-rail requires, or escalate if the hit target must grow.
   - Strengthen the halo (wider soft status glow, about 1.6r) and add a crisp bright rim, so bodies become the brightest things on screen after the sun.
5. **Progress trails read as a second ring.** Cap the visible trail length to the last about 60–90° behind the body with a fast fade, not north→angle (which is about 300° on overdue bodies). Lower `TRAIL_ALPHA_DARK` to about 0.35 and drop the 5.5 px soft band at overview.
6. **Dashed-ring glow renders as fuzzy beads.** Never apply the glow pass to dashed rings. Draw the glow solid-but-faint, or skip it.
7. **The sun is a flat blue disc.** Shade the disc itself: radial white-hot core → occupant hue at the limb, limb darkening, and a slow granulation from the existing corona uniforms. The status rim stays as a thin ring. For a contact-sun, keep the hue in the corona and the limb.
8. **The contact shadow looks like a smudge at tilt 0.** Scale shadow alpha by tilt (0 at tilt 0, full at mid-tilt) and offset it straight "down" in plane space, not outward from the sun, until tilt makes it read as cast.
9. **Astrolabe grid adds noise at density.** Fade reference rings and spokes as orbit count rises (for example, alpha × clamp(12 / N)). Keep the bezel and ticks, which give the instrument look cheaply.
10. **Remount pop.** On tab return or profile back, the canvas is blank for about 2–3 s, then the nebula and photos pop in. Fade the nebula image in over about 300 ms once the texture resolves, and fade body photo layers in. Pre-bake the nebula once per theme and size at module or store level, so remount doesn't re-rasterise. Measure in release.
11. **Overview truncation.** "C…", "El…" initials in 26 dp chips at 39 contacts. Render two-letter initials (it is a glyph-fit issue: "CR" fits). Also consider plate labels for the top-N bodies by Gravity at overview.
12. **Home framing.** The recentered home view at 2–3 contacts uses about the top 45 % of the canvas (13, 15), and at 39 contacts the outer rings run off-screen (01). Fit the scene's extent to the usable rect, both down and up.
13. **DEV marker doubled and offset mid-switch** (12a). Draw `LabHud` once, outside the per-system transition layers.
14. **Switch FX unverifiable in debug.** Cut a release build and record the switch at 60/120 fps before judging streaks, draw-on and flare. The 4–5 s debug stall makes the debug build useless for this item.
15. **Focus card covers the focused body and reticle** (pre-existing). Anchor the focus card away from the body, so the new reticle (the best HUD element) is actually seen.

## Evidence index (`evidence/direction-1/`)

**Overview and crops**

| File | Content |
|---|---|
| `00` / `00a` | Cold start in Family (last System); nebula faceting; astrolabe, corona and bodies crop |
| `01` / `01a` | All Contacts overview (dark); crop of ring-vs-body weight and nebula shards |

**Focus, zoom and remount**

| File | Content |
|---|---|
| `02` | Focus Ada Park (photo, satellite list shows "Jun") |
| `02b` | Same view settled after the profile round-trip |
| `03` | Focus Clara Ruiz (initials, satellite "Tom") |
| `04` | First seconds after return: no nebula, initials instead of photos |
| `05` | Zoomed after clear focus, satellite dot |

**System switch and Systems**

| File | Content |
|---|---|
| `10` | Screenrecord, All → Lab Dense |
| `11` | Lab Dense settled |
| `12` | Screenrecord, Lab Dense → All |
| `12a` | Frozen mid-switch frame with the doubled marker |
| `13` | Lab Inner Circle (dark) |

**Themes, reduced motion and the rest**

| File | Content |
|---|---|
| `14` | Galaxy-light All Contacts |
| `15` | Galaxy-light Lab Inner Circle |
| `16` | Standard-light All Contacts |
| `17` | Standard-dark All Contacts |
| `18` | Reduced-motion switch screenrecord |
| `19` | Tab-return sequence (0.6 s steps) |
| `20`, `21` | gfxinfo, DEBUG |
| `22` | After a one-finger pan |

Helper added: `tools/shot.sh` (screenshot plus optional preview JPEG).
