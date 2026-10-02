# Lab B — decisions log

Chronological. Each entry: what was decided, why, where.

## 2026-10-01 — WP-1.0 scaffolding, parity port, instrumentation

1. **Renderer seam = `OrreryWorld` return switch.** The model half (frame worklet, captures,
   `camera.frame`, `level`, labels/`allocations`, gestures, focus-lost reactions) is untouched;
   the return chooses `LabBRenderer` (default) or the legacy tree, from `useLabFxStore().renderer`.
   One canvas / one `useClock` at a time. `src/components/orrery/OrreryWorld.tsx`.
2. **Layer slots fixed in `LabBRenderer.tsx`** (back→front): L0 `LabEnvironment` · clip group
   { L1 `LabRings` · L5 Polaris · reorder ghost · L2–L4 contiguous body batch · L6 labels ·
   L7 empty fx Group } · FPS HUD. WP-1.1 fills L0, WP-1.2 L2–L5, WP-1.3 L1/L6, WP-2.x L7.
   Heavy layers are unmounted when their flag is off (honest marginal cost).
3. **Reorder ghost stays built in `OrreryWorld.tsx`** and is passed to the lab as a `ghost`
   element, so the accent-contract allowlist row (`color={colors.accent}` in OrreryWorld) stays
   true and no allowlist edit was needed (research 03 §0.5).
4. **`LabCanvas` is the single clock owner**; exposes `LabRenderContext` {clock, ambient,
   fxFlags, reducedMotion} and still provides `OrreryClockContext` (= ambient clock).
   "Freeze clock" pins `ambient` to 0 (raw clock keeps ticking — diagnostic only).
5. **Parity port without per-body saveLayer.** Bodies use Group `opacity` instead of
   `layer={Paint}`; culled / faded-out bodies collapse to scale 0 (`labBillboard`) so nothing
   (incl. glyphs) draws. O(1) lookups via `frameIndex = indexFrame(frame.value)` + `bodyAt`.
6. **Initials via glyph `Text` + `matchFont(fontProvider)`** (respects paint alpha) instead of
   Paragraph. Found on device: Hermes has no `Intl.Segmenter`, so `orreryInitials` returns the
   full name and legacy only *looked* OK through Paragraph ellipsis ("El…"). Lab derives real
   initials (`labInitials`, code-point based) and fits them to 80% of the disc.
7. **Lazy shader loader** `labb-effects.ts`: `getLabEffect(name)` compiles on first use inside
   `try`, memoises success or null, `forceFallback` toggle, no import-time Skia. One `probe`
   effect proves the pipeline; `WARMUP_EFFECTS` drawn for 400 ms at mount in a 2×2 clip at
   alpha 0.004, ended by one `runOnJS` state flip.
8. **`orrery-scene.test.ts` gains one mock** (`use-orrery-photo`). Research 03 said "no new
   mocks", but the lab body slot must import the photo loader (expo-file-system → `__DEV__`
   crash at import), exactly why the test already mocks OrbitBody/SunBody. A lazy `require`
   was tried and rejected (vitest cannot resolve a bare TS `require`). No Skia import-time
   touch was introduced — the Skia `{}` mock is still sufficient.
9. **Reduced-motion override** lives in `src/theme/reduced-motion-override.ts` (plain module);
   both `useReducedMotionShared` and `useReducedMotion` combine OS value + override, so the
   panel's "On/Off" forces reduced motion app-wide and live (switch runtime, camera, SunBody,
   lab layers). `null` = production behaviour.
10. **Debug panel host** `labb/debug/LabFxPanel.tsx` (`LabBMarkerHost`) replaces the static
    marker in `OrreryScreen.tsx`; long-press (400 ms) opens a non-modal bottom panel:
    renderer A/B, camera presets (zoom 0.4/1/2.2/3.2/4, tilt 0/30°/max, yaw 0/90/180, pan to
    sun — via `camera.recover`, the normal animated recovery path), reduced motion OS/On/Off,
    quick System switch (store `select`) + replay last switch, intensity, every registry flag,
    effect compile status. Gated on applicationId `com.bwales.orbit.labb` (C-08).
11. **Flag registry** `LAB_FLAG_REGISTRY` in `src/stores/orrery-labb-fx-store.ts`; the panel
    renders it generically — later WPs add an entry, no panel code.
12. **Lab theme tokens** `src/theme/orrery-lab-fx.ts`: per package × mode profile (intensity:
    GD 1.0, GL 0.7, SD 0.85, SL 0.35; blend additive/multiply; HUD + reserved layer roles as
    palette token *names*). No new colour literal.
13. **FPS HUD** derives from the clock in a `useAnimatedReaction`, 120-slot ring buffer in a
    SharedValue, summary every 8 frames, Skia glyph text + sparkline (graph ceiling 50 ms).
    Labelled "UI-thread frame cadence (clock Δ)". Placed at canvas (8, 68) below the selector.
14. **Worklet-order guard is recursive** over `src/components/orrery/**` and asserts it sees
    `labb/` and `labb/debug/`.

### Device sanity (emulator, debug build, Lab B Dense ≈120 + 67 moons; NOT a perf claim)
- Lab renderer, FPS overlay, panel, A/B toggle, zoom preset, forced reduced motion and panel
  System switch all work. Evidence `evidence/01-wp1.0/01..05`.
- Relative only: idle 10 s gfxinfo legacy 36 frames vs lab 39 frames (both p50 200 ms — the
  debug/emulator floor). HUD: ~8–10 fps clock cadence idle with ambient animation; with
  reduced motion forced ON the cadence jumped to many 16.7 ms frames — a hint that per-frame
  ambient SharedValue churn (full-canvas replay) dominates on this target. Re-measure on a
  release phone build before concluding anything.
- Pre-existing, not caused by WP-1.0: the selector shows "Unavailable System" when a custom
  System is restored at launch without a name (`orrery-system-store.ts:104`); a Reanimated
  strict-mode "Reading from value during render" warning appears around System switching
  (source not yet located — check whether legacy also triggers it).

## 2026-10-01 — WP-1.1 deep environment (L0)

Commits: `54188b10` (first pass), `79cc89eb` (far stars into the shader + tests), and the
WP-1.1 close commit (tuning, fallback fix, logs, evidence).

1. **Bake DENSITIES, colour at sample time.** `nebulaBake` renders a 768² seamlessly tiling
   texture once per mount (`useTexture`, UI-thread owned) holding lobe A / lobe B / dust in
   r/g/b. `nebulaSample` colours it every frame from token uniforms. Consequences: a theme or
   accent change never rebakes; M2's per-System sky-hue crossfade is a uniform change; global
   intensity is live. Tile = 768 / 0.45 texel·dp⁻¹ ≈ 1 700 dp, base cloud cell ≈ 213 dp.
2. **Periodic noise** (`mod(i, per)`, each octave doubles frequency AND period; the warp
   offsets are periodic too) so the bake tiles with `repeat`: the sky never shows an edge
   however far the user pans, with no mirror seams.
3. **Live full-res fbm kept only as the `nebulaLive` A/B flag** (identical density function,
   so the comparison is fair). Emulator says it is the expensive variant (PERF-LOG run 3 H).
   "Reduced-resolution live" was rejected on analysis (DEAD-ENDS).
4. **Far star layer is analytic, inside the nebula sample pass** (hash grid, ≤1 star per
   22-dp sky cell, Gaussian disc in screen dp, 3 token tones). It replaced a 760-sprite Atlas
   after the emulator A/B (PERF-LOG run 2 vs 3). Mid (300) and near (110) stars stay in one
   Atlas because they need per-star twinkle and soft/spike sprites. The far Atlas survives
   only as the fallback when the nebula shader is off/null.
5. **One parallax rule for every sky layer** (`labb-sky.ts`), from the animated frame only:
   pan = factor × (sun screen position − viewport centre); zoom = `zoom^(factor·1.3)` about
   the viewport centre (nebula f = 0.06 ≈ 1 + 0.08·ln z as planned); yaw rotates the whole
   sky; tilt shifts layers vertically by depth. Factors: far 0.03, nebula 0.06, mid 0.10,
   near 0.22.
   - **Deviation from research 03 §1.3:** the sky rotates about the **viewport centre**, not
     the sun's screen centre. A yaw is a camera roll about the projection centre, which has no
     parallax, so a distant sky must turn about the same pivot; rotating about an off-screen
     sun swung the whole sky across the screen. (Viewport centre ≈ projection centre; the
     usable-rect offset is a constant shift.)
   - The pan offset is un-rotated into sky space before wrapping and re-rotated after, so pan
     and yaw never double-rotate (tested).
6. **`frame.value.pose` contract enforced by signature:** `labSkyPose(frame)` takes only the
   animated frame. Every sky worklet derives from it; nothing reads `pose`. A unit test pins
   that a sampled frame's pose/centre are what the sky uses.
7. **Ambient life is bounded:** drift is a slow Lissajous (±26/±18 dp, 95 s / 131 s periods,
   ≤ ~1.7 dp/s) and the warp "breathes" over 40 s — it never walks off the texture and never
   accumulates. Under reduced motion (or `nebulaDrift` off) time is pinned to a fixed
   composition (`STILL_T`); twinkle stops; parallax still follows the user's gestures.
8. **Star sprites are an alpha MASK tinted by tokens.** The atlas is drawn once in the
   LAB-ONLY mask colour (`LAB_SPRITE_MASK*` in `src/theme/orrery-lab-fx.ts`), and each star's
   colour buffer entry comes from `textPrimary` / `textSecondary` / `starPalette`
   (`colorBlendMode="modulate"`). Dark themes draw stars `plus` (additive); light themes
   `srcOver` ink specks with crisp dots only.
9. **Theme profiles (`LabEnvProfile`)**: dark = luminous lobes (accent + starPalette[3]
   violet, starPalette[2] ember where lobes overlap), additive cores, dust lanes, vignette to a
   darker shade of the sky token; light = "vellum" washes toward accent/violet at ≤ 0.16, no
   glow, near-zero dust, a faint `textSecondary` corner wash, 40 % star density at ~0.4 alpha,
   no twinkle. Standard Light is the quietest (profile intensity 0.35 ⇒ ≈ 0.5× Galaxy Light),
   pinned by a test.
10. **Seven FX flags** (registry, panel renders them): `nebula` (heavy), `nebulaLive`
    (heavy, A/B), `nebulaDrift`, `vignette`, `stars` (heavy; also zeroes the shader far layer),
    `twinkle`, `parallax`. `environment` stays the L0 master.
11. **Force-fallback is applied during render**, not in an effect. Children call
    `getLabEffect` while rendering, so the WP-1.0 effect-time setter left the first
    post-toggle render on the stale value (found when verifying the fallback on device).
12. **Visual iteration on the emulator** (galaxy dark hero, then all four themes): pass 1
    strengths were too loud (a bright lobe competed with the rings) → lobe A 0.34→0.28,
    B 0.30→0.27, glow 0.22→0.16, vignette 0.55→0.62; bake 512²@0.3 → 768²@0.45 texel/dp
    (blocky dust-lane edges); shader far stars enlarged/brightened after the first look; light
    vignette 0.18→0.13 (corners read grey/dirty).
13. **Evidence** (`evidence/02-wp1.1/`, emulator, debug): `00-first-pass-*` (pass-1 dark +
    light), `01-overview-dense-galaxy-dark`, `02-far-zoom-0.4-dense-galaxy-dark`,
    `03-near-zoom-4-galaxy-dark`, `04-reduced-motion-forced-on-zoom1`, `05-tilt-max-sky-shift`,
    `06-tilt-max-yaw-90-sky-rotated`, `07-pan-parallax-and-switch-dense-to-inner-circle.mp4`,
    `08-inner-circle-galaxy-dark`, `09-switch-inner-circle-to-dense-sky-follows-sampled-camera.mp4`,
    `10-galaxy-light-vellum-dense`, `11-standard-light-lowest-intensity-dense`,
    `12-standard-dark-dense`, `13-force-fallback-fill-plus-atlas`. The selector label reads
    "Unavailable System" in several shots: the pre-existing restore bug noted in WP-1.0 (the
    panel confirms Lab B Dense is selected).

## 2026-10-01 — WP-1.2 worlds: bodies, sun, moons, Polaris (L2–L5)

Commits: `469440db` (lit worlds), `0922d223` (uniform packing), WP-1.2 close (cheap moons,
logs, evidence).

1. **One draw per body.** Each contact is ONE `Circle` of radius r·1.3 filled by a runtime
   shader that paints the lit disc inside r and the atmosphere / contact shadow outside it.
   The disc edge is computed in the shader (1-dp AA from `uPx` = local units per dp) at
   exactly the world radius, and the root Group keeps the billboard transform, so the frame
   radius, hit radius, labels and focus cards are untouched (render test pins `uA.x` = world
   radius and the circle at r × `BODY_REACH`). Reach 1.3 r / 2 r = the existing culling reach.
2. **Two body effects, one lighting core** (`BODY_LIT` in `labb-effects.ts`): `bodyPhoto`
   (child `ImageShader`, photo in local coords) and `bodyProcedural` (initials bodies: banded
   latitude "world" in the contact's swatch, noise-warped, seeded per `bodyKey`, highlight
   streaks; glyph initials drawn on top). Both get the same Lambert + wrap lighting from the
   screen-space body→sun vector (`frame.value.center`), floor 0.55 dark / 0.75 light, a
   specular glint, a status Fresnel limb and a 1.5-dp crisp status rim, per-status
   desaturation and far-side depth haze (negative projected `depth` / scene extent, ≤ 15 %).
3. **Status materials** (`labBodyMaterial`): stable/wobble full atmosphere; decay 0.4
   atmosphere, 25 % desaturated; rogue no atmosphere, 45 % desaturated, cold
   `rogueExtinguished` rim; never-contacted matte, neutral `border` rim. Static — no
   per-status animation (HANDOFF §7). Gravity unchanged (already in the world radius).
4. **Light themes** keep the same lighting with a higher floor and swap the additive status
   glow for an anti-sun contact shadow in `textPrimary` ink plus a faint status glow; corona
   becomes a non-additive warm wash (highlight mixing reduced so no white sticker outline).
5. **Sun**: `sunStar` = limb-darkened stellar surface in the occupant glow colour with
   domain-warped granulation on a rotated lattice (the first axis-aligned version read as
   blocky squares on device), white-hot core toward `avatarSwatchText`; `sunPhoto` = the photo
   EMISSIVE (only a whisper of limb darkening) for a photo self-sun or a contact sun. Both
   share a corona: inner glow, halo, two angular-noise ray bands that drift outward, bright
   limb; ±6 % breathing on the legacy ~3.1 s pulse. Reduced motion pins time and pulse and
   stops reading the ambient clock. Contact sun keeps `resolveSunOccupant` colour semantics
   (status-colour corona) — verified on device with Gus Moreau as the centre.
6. **Moons**: default is a cheap lit moon (dark disc at 50 % + sun-facing cap + glint, three
   plain circles) after the emulator A/B; the per-moon shader is the `moonShader` flag.
7. **Polaris** (`LabPolaris`): BlurMask halo in `starPalette[0]` (plus-blended on dark),
   faint long diffraction spikes, crisp 4-point cross, core. Same `polarisProjection` and
   hit semantics. Compass tick deferred to WP-1.3 (instrument register).
8. **Uniform packing** (perf): RN Skia rebuilds every shader on every replay and resolves
   uniforms by name; uniforms are `float4`-packed (bodies 10, sun 5, moon 4). A test asserts
   that every uniform declared in each WP-1.2 SkSL source is supplied by its JS builder (a
   missing uniform throws on device), and that values are finite.
9. **FX flags** (registry): `bodyLighting` (heavy; off = WP-1.0 flat discs), `bodyAtmosphere`,
   `bodyProcedural`, `depthHaze`, `sunCorona`, `sunPlasma`, `moonShader` (heavy, default off),
   `polarisLab` (heavy). Force-fallback / a null effect renders the flat path.
10. **Visual iteration on the emulator** (pass 1 → 3): corona was nearly invisible (only a limb
    line) → stronger halo + outward-drifting streamers; granulation blocky → rotated,
    domain-warped, finer; terminator too faint at overview → light z 0.55 → 0.4; status rim +
    Fresnel read as the old thick outline → rim 2 → 1.5 dp, Fresnel 0.5 → 0.35; procedural
    bands invisible → band contrast 0.55 → 0.8 toward black + highlight streaks; light-theme
    corona had a white outline → highlight mix scaled by corona additivity.
11. **Not done / open**: moon level fade-in (250 ms at identity) not built; face legibility
    under the terminator only judged on seeded synthetic photos; the photo-less contact-sun
    variant and Standard/Galaxy Light close-ups of decay/rogue bodies not separately captured.
12. **Evidence** (`evidence/03-wp1.2/`): `00-pass1-overview-dense-galaxy-dark`,
    `01-pass1-self-sun-detail-3.2-galaxy-dark`, `02-pass2-focus-flyin-cleo-dense`,
    `03-pass2-inner-circle-overview`, `04-pass2-inner-circle-identity-2.2-photo-and-initials`,
    `05-galaxy-light-inner-circle-overview`, `06-galaxy-light-identity-contact-shadow`,
    `07-standard-dark-inner-circle`, `08-standard-light-inner-circle`,
    `09-pass3-sun-finer-granulation-identity`, `10-dense-focus-eli-moon-labels-sun`,
    `11-reduced-motion-forced-on-dense-static`,
    `12-contact-sun-photo-emissive-status-corona-cheap-moons`,
    `13-perf-run-D-lit-cheap-moons-rings-off`. Some shots show the selector as "Unavailable
    System" (the pre-existing restore bug, WP-1.0 note).

## 2026-10-01 — WP-1.3 instrument orbits (L1) and HUD labels (L6)

Commits: `ff7ddbdd` (instrument orbits + HUD tags + compact HUD/marker), `387b20c8` (pass 2:
focus lock keeps stroke style, density fade, tuning), dead end `eb860615` reverted by
`41495969`.

1. **One plane homography for the whole instrument layer.** `projectWorldPoint` is an exact
   plane homography (yaw → tilted perspective plane → zoom → usable-rect centre), so
   `planeHomography(frame.pose, frame.viewport)` returns ONE row-major 3×3 (RN Skia parses 9
   numbers incl. perspective) and every ring, wake, tether and tick is STATIC WORLD geometry in
   a `<Group matrix>`. Tested exact against `projectWorldPoint` (incl. pan, yaw, max tilt,
   obstacle-shifted usable rect) and against `projectFrame`'s `ringPath[0]` in the render test.
   Reads only `frame.value.pose`/`viewport` (the sampled camera during switches). Stroke widths
   are `dp / zoom`, so perspective makes the near side slightly heavier — kept as a depth cue.
2. **Rings = `<Circle cx=0 cy=0 r>`** (radius = frame `ringRadius / zoom`, so switch/reorder
   interpolation still applies; opacity = body opacity × focus dim). Grouped by instrument class
   (status) under one `ringInstrument` stroke shader per class: hairline, far-side **depth
   fade** (∝ tilt, to `farAlpha` 0.32/0.40), shader **dashes** (integer count per
   circumference → no seam at north; no CPU `DashPathEffect`), uniform **flow comets** (3 per
   ring, same LINEAR speed for every status, clockwise; off under reduced motion; flag
   `ringFlow`, C-04). Batching the circles further (one path per class when settled) was built
   and removed unmeasured-needed: run F showed the circles already at the rings-OFF floor.
3. **Semantics preserved, mapped from the legacy vocabulary** (`orreryRingStyle` → `ringVisual`
   stays the single source; `ringInstrumentClass` only restates it):
   | Status | Legacy | Instrument |
   |---|---|---|
   | stable | statusStable, solid, 2 px | statusStable, solid, 1.04 dp |
   | wobble | statusWobble, dashed [6,6], 3 px | statusWobble, dashed 11 dp @58 %, 1.46 dp |
   | decay | statusDecay, solid ×0.7, 4 px (heaviest) | statusDecay, solid ×0.7, 1.88 dp (heaviest) |
   | rogue | rogue amber, dashed ×0.3, 3 px | rogue amber, dotted trace 6 dp @30 % ×0.42, 1.46 dp |
   | never-contacted | border, solid ×0.5, 2 px | border, solid ×0.5, 1.04 dp |
   Weight ORDER (the CVD-redundant channel) is kept and tested; base alpha 0.5 (dark) / 0.7
   (light) × class alpha, so rings recede behind bodies. The focused ring's lock line goes
   through the class shader so it keeps its stroke style.
4. **Progress wake** (flag `ringWake`, C-17): per-ring stroked circle + `ringWake` shader —
   alpha rises from north (0) to the body angle (ADR-011 convention, `wakeAngle` tested), crisp
   end at the body, soft cross profile. Real statuses only (never-contacted: none). Built from
   the settled world bodies (React) and hidden (`settled` = progress ≥ 1 and no active reorder)
   while a switch or reorder moves bodies.
5. **Drift tethers** (flag `ringTethers`, C-17): decay/rogue bodies (pushed off the rail by
   `orrery-world-logic` drift) get a radially dashed tether from the rail point to the body
   limb, drawn as a rect in a north-pointing frame rotated onto the body. Hidden like wakes.
6. **Ticks** (flag `ringTicks`): a north tick on every ring at `detail`; a 30° tick scale on the
   focused ring (any level); a compass chevron outside the outermost ring (`accent`, the WP-1.2
   deferred compass tick).
7. **Focus (static, M1):** non-focused rings ×0.35 (`focusDim`); focused ring = two soft glow
   strokes beneath (flat, no blur) + full-alpha lock line. React-driven (focus is an event),
   no animation yet (WP-2.2 adds `focusMix`).
8. **Density fade:** ring alpha × clamp(gap·zoom / 20 dp, 0.35, 1) with gap = median world gap
   between rings; comets × fade². Far zoom on Dense: median ring brightness −25 % measured on the
   screenshots; zoom ≥ ~1 unaffected.
9. **HUD-tag labels** (`LabHudLabel`, flag `labelHud`): positioned ONLY from `allocations`;
   plate = EXACT prepared `width × height` (render test); hidden exactly when not allocated, so
   semantic zoom and the label-visibility → tap contract (`resolveTap` reads the same
   `allocations`) are untouched. Paint: blurred `background` scrim halo (0.55/0.5) under a
   `surface` plate (0.9/0.94), faint `textSecondary` outline, status-hue hairline on the
   body-facing edge and a 6 dp leader tick toward the body (direction from the body's y vs the
   plate — the allocator's below/alternate-above choice). Context captions keep `OrreryLabel`.
   Status hue from `orreryRingStyle` (sun label: occupant status).
10. **Debug chrome:** FPS HUD compacted to 178×40 dp (two lines + sparkline) and moved to the
    bottom-left above the marker; the marker is now a small dimmed "LAB B" tag bottom-left
    (long-press still opens the panel). Previously the HUD hid a body (DG) and the marker spanned
    the bottom centre.
11. **Visual iteration (emulator):** pass 1 (hairlines, flow, stepped wake) → wake invisible,
    comets too subtle in stills → pass 2: single-gradient wake 0.3, comets 48 world long at
    full strength, tethers 0.6; focus lock kept stroke style; density fade added after the Far
    0.4 Dense shot read as solid grooves (threshold 14 → 20 dp after a numeric check showed
    the first value barely changed anything).
12. **Evidence** (`evidence/04-wp1.3/`): `00-before-wp1.0-path-rings-dense`,
    `01-pass1-overview-dense-instrument-orbits`, `02-pass1-identity-2.2-hud-tags-wake-tether`,
    `03-detail-3.2-north-tick-depth`, `04-focus-cleo-lock-glow-tick-scale-dimmed-rings`,
    `05-tilt-max-depth-fade-dense`, `06-inner-circle-12-overview-galaxy-dark`,
    `07a/07b-far-0.4-dense-(before-)density-fade`, `08-pass2-overview-dense-final`,
    `09-flow-comets-overview-dense.mp4` (720×1280 recording, aspect squashed by screenrecord),
    `10a–10d` Galaxy Light / Standard Dark / Standard Light (Inner Circle) incl. a light focus +
    HUD tag, `10e-hud-tags-4-themes-gd-gl-sd-sl`, `11-reduced-motion-forced-on-static-no-flow`,
    `12-switch-inner-circle-to-dense.mp4` (rings fade out/in with their bodies; wakes and
    tethers return on settle).
13. **Not done / open:** perspective-matrix cost under tilt not timed; reorder ghost still
    rebuilds a 128-point path (only while held); `ringPath` is still computed by the frame
    worklet (R1); wake/tether during a switch simply hide (WP-2.1 ring unwind/draw-on will
    animate rings properly); light-theme yellow wobble dashes are low-contrast on vellum (token
    hue, same as legacy).

## 2026-10-01 — WP-1.4 Milestone 1 device checkpoint (release build, emulator)

Commits: `80a9650b` (seed portraits) + the WP-1.4 docs/evidence commit.

1. **Real-looking photos.** The 16 fictional test portraits are wired into the dev seed for 30
   contacts, through the normal `avatars/contact-<id>.jpg` contract. Inner Circle gets 7,
   including the low-contrast, dog and logo fixtures; Dense and Work reuse each portrait about
   twice. The PRNG sequence is unchanged, so every contact keeps its cadence, history, status
   and position from earlier WPs, and the old evidence stays comparable. Dev bundle only (C-42).
2. **Release build.** `assembleRelease -PreactNativeArchitectures=x86_64` on droid (5 m 15 s
   clean in Lab B's dir, after the busy check) gives an 84 MB APK. Debug and release are
   signed by the same `debug.keystore` (apksigner SHA-256 identical), so `install -r` of the
   release APK over the seeded debug install **keeps all data** (verified on device). No lab
   flag or seed-in-release path was needed. The FX panel and FPS HUD work in release
   (applicationId gate, C-08). Procedure: RUNBOOK §10.
3. **Checkpoint matrix (release, emulator)**, all in `evidence/05-m1-checkpoint/`:
   - overview: All Contacts, Dense 120 and Inner Circle 12;
   - all five zoom presets on Dense;
   - focus fly-in on a photo body (Dev Grant + moon companion) and an initials body (Cleo);
   - detail labels with context captions;
   - two System switches (mp4);
   - reduced motion forced on: 0 changed pixels outside the HUD;
   - all four themes;
   - background → foreground and tab blur → refocus: 0 gfx frames while inactive;
   - legacy-vs-lab A/B pairs (`28c`, `29b` vs `02`);
   - face close-ups at detail 3.2 for stable, never-contacted and rogue portraits;
   - perf matrix (PERF-LOG).
4. **Findings that change the plan.** Release legacy on Dense is ~5 fps against the lab's ~21
   gfx frames/s. In release no single heavy layer moves the lab's emulator frame count, so
   per-layer cost needs the phone or Perfetto (R1). The companion popover hides the focused
   body's label and covers half the face at detail zoom: a WP-2.2 target. Standard Dark is
   indistinguishable from Galaxy Dark in the lab sky: a package environment profile is
   needed. Faces survive the lighting and the rogue desaturation (M1-CRITIQUE).
5. **Not done (emulator-only checkpoint).** No physical Pixel 6 Pro / 3a run: Lab A owns the
   phone, and Lab B is restricted to the emulator. So there is no perf or thermal claim and no
   pinch. Reorder hold was not exercised (adb cannot do the long-press drag reliably on the
   canvas here). No decay-status *portrait* at detail. Tilt (perspective) is not timed.
6. **Debug blank-canvas incident.** This was seen once, on the debug build during droid build
   load (RUNBOOK §10). The release build was unaffected.

## 2026-10-01 — WP-2.1 System-switch showcase

Commits: `30026fda` (pass 1), `413d6999` (pass 2: tuning, docs, evidence). Evidence:
`evidence/06-wp2.1-switch/`. All device work: emulator, RELEASE build (see 11).

1. **One signal, pure effects.** `sampleSwitchSignal(transition, progress)` (phase, rotation,
   angular velocity, `velocity` 0..1 normalised to the spin plateau, intensity, reduced flag) and
   `sampleSwitchEntry(transition, entry, progress)` (one entry, byte-identical to the full sample,
   via a shared `sampleEntryAt`) are exported from `orrery-switch-choreography.ts`; `entryWindow`
   too. Choreography constants are unchanged. Every effect is a pure function of (signal, the
   per-key role map, the animated frame), so pause / remount / retarget stay correct.
   `labb-switch-logic.ts` holds the maths (tested: determinism, windows, intensity gates).
2. **Phase map as built.**
   - accelerate: hyperspace streaks — mid/near stars become streak sprites (32-band streak
     texture, band picked per frame through a rect buffer, RSXform head-anchored), tail toward
     the viewport centre (camera vanishing point), twisted with the spin; far stars smear in the
     nebula shader (cells walked back along the radial ray, segment distance — continuous, not
     dotted); sky push (zoom ×(1 + 0.14·warp·depth)); corona flare +40 %; ring-flow comets spool
     with the accumulated rotation; retained bodies get a motion smear (their own spiral sampled
     0.025 earlier).
   - shed: leaving bodies dissolve in the body shader (`uK.x`, noise threshold + glowing status
     edge, atmosphere thins; glyph initials fade with it) and burst into stateless particles
     (Atlas, capacity 640, budgeted over ON-SCREEN leaving bodies, status hue, hot sparks toward
     the highlight token); their rings UNWIND (visible arc trails the body, 1 → 0).
   - capture: entering bodies arrive behind comet streaks (tail = their inbound spiral sampled
     0.07 earlier, projected by the plane homography); rings DRAW ON (0 → 1) then crossfade
     back to their class style over the settle; capture flare = body-shader limb flash +
     glow/glint sprites (alpha shared across simultaneous arrivals, 1/√(n/8)).
   - settle: streaks relax with the spin; one system-lock shockwave (world-space circle under the
     homography = projected ellipse; crisp instrument front + soft trailing glow, in the
     destination sky hue; none below intensity 0.25); sky hue crossfades.
   - reduced motion: none of the above; the existing 180 ms crossfade + the sky-hue crossfade.
3. **Per-System sky hue (C-05, flag `fxSkyHue`, owner glance).** Nebula lobe B takes a
   starPalette hue hashed from the System identity (All Contacts keeps the default violet). The
   UI thread crossfades from whatever is displayed (`displayedSkyHue` is robust to whether the
   new transition or the new scene's hue arrives first, by generation order).
4. **Ring trims are ONE picture per frame**, not components: a UI-thread `PictureRecorder` draws
   each leaving/entering ring as a stroked circle with a sweep-gradient mask (world coords under
   the homography). A per-ring component version froze the debug UI thread for seconds at switch
   start (DEAD-ENDS). Class rings owned by a trim fade out/in via `classRingSwitchFade`.
5. **Warm-up.** `WARMUP_FILTERS` (shockFilter, zero-filled uniforms via `zeroUniforms`) compile in
   a tiny saveLayer at mount; every switch FX layer draws one ~1 %-alpha probe instance while
   `ctx.warm` is on (a one-shot SharedValue, not clock-derived, so FX mappers never run per frame
   at rest). Cold-launch first switch (Work → Inner, release): p50 17 / p90 40 / p99 117 ms, 0
   Choreographer skips, recording max gap 0.37 s at the publish render — the same as warm
   switches (p99 113–133 ms). No first-switch hitch attributable to compiles.
6. **Displacement filter experiment** (`fxShockFilter`, default OFF): a runtime image filter on
   ONE saveLayer around sky + L1–L5 (labels outside), following the shockwave front; dp → layer px
   via `PixelRatio`. It visibly lenses the nebula and rings with a chroma-split band. Verdict:
   "beautiful but costly" candidate — see PERF-LOG; keep as a toggle, not default.
7. **Lab perf fix in the model half (perf only, no semantics):** `projectFrame` /
   `projectAnimatedFrame` take `ringPaths` (true = all, false = none, id = that body). Under the lab
   renderer (and not the path-rebuild A/B) `OrreryWorld` projects ringPaths only for a held reorder
   body (the ghost). On the emulator UI runtime the 128-point loop cost ~700 ms per frame at 141
   bodies (instrumented: project=678–801 ms → 6–7 ms). New frame-worklet capture `ringPathMode`
   added to `orrery-frame-mapper.test.ts`'s map with a reason (research 03 §2.7 allowance).
8. **Debug tooling.** `orbit://labb?flags=…&system=…&slowmo=…&rm=…&reset=1` deep links
   (`parseLabCommand`, lab build only) drive the store/select paths; quick switch moved to the
   top of the panel with "close on switch" (panel closes, switch fires 0.7 s later); a switch
   slow-motion multiplier (`switchTimeScale`, optional 3rd arg of `useOrrerySwitchRuntime`, absent
   = production timing). Needed because (9) hides the first half of every big switch.
9. **Pre-existing main-thread stall at switch start (NOT WP-2.1).** Switching between large
   Systems skips 160–430 frames (≈3–7 s) on the emulator release build — on the M1 build too
   (7c464176: 159/349/345 skipped), with the legacy renderer (212/413), and with bodies + labels +
   rings off (222/339). Main-thread stack: `RNSkia::JsiRecorder::applyUpdates` inside a worklet
   `runSync` (evidence `07-stall-main-thread-stack.txt`). `withTiming` is wall-clock, so the
   switch is ~over when frames resume: at normal speed a big switch shows only its settle.
   Small↔small switches (Work ↔ Inner) do not stall and play the full showcase at normal speed
   (`01`, `03`). Not fixed here (renderer-architecture scope: RN Skia per-frame applyUpdates over
   every bound SharedValue); flagged for R1 with the phone.
10. **Visual iteration.** Pass 1 (`29-pass1-sheet…`): shockwave read as a soap bubble (band 0.16
    → 0.07 extent, glow 0.5 → 0.3, strength 0.35 + 0.4·intensity); particles invisible (3 per body
    on a 130-body shed → on-screen budget, bigger); capture glints sprite-span bug (×6 too big)
    and too bright; comets too thick (0.7 r → 0.38 r); initials glyphs survived the dissolve
    (now fade). Pass 2 matrix (`10`–`15`, `27`, `28`): dense→small, small→dense, high continuity
    (Dense → All: few streaks, no lock shockwave drama), All → System, near-total change
    (Work → Inner), panned-camera switch, reduced motion, Galaxy Light.
11. **Debug vs release iteration.** Debug JS on this emulator loads a System in > 7 s and the
    deep-link remount makes debug recordings unusable; iteration moved to RELEASE builds after
    the first debug pass (incremental `assembleRelease` ≈ 1 min on droid, busy-checked). The debug
    pass found the two Hermes-only bugs below.
12. **Hermes worklet trap #2:** a worklet DEFAULT PARAMETER referencing a module constant
    (`switchFx = NO_SWITCH_FX`) is not captured → `ReferenceError` on device, invisible to vitest.
    Use `undefined` + an in-body check. `MakeSweepGradient(..., null, ...)` throws "Value is null,
    expected an Object" — pass `undefined` for the local matrix.

## 2026-10-01 — Switch-stall fix (pre-existing big-switch stall, WP-2.1 §9 / C-49)

Commits: `ea137306` (fix 1), `038a8d97` (fix 2), `3c0f691b` (fix 3). Write-up:
`research/SWITCH-STALL-INVESTIGATION.md`; evidence `evidence/07-switch-stall/`.

1. **Root cause** (measured with temporary instrumentation): the shared model-half `frame`
   derived value captured `switchRuntime` (new object per render, `resources` → scene per entry)
   and `scene`; every OrreryScreen render restarted it and the UI thread spent ~0.6–0.8 s per
   restart deserialising/walking the closure. Not Skia `applyUpdates` (≤ 8 ms).
2. **Fix 1 (model half, both renderers):** worklets capture shared values and small stable data
   only; stable empty defaults; content-keyed `clusterIds`. Perf only — same semantics.
3. **Fix 2 (`layerPictures`, default ON, debug section):** bodies + moons, labels, class rings +
   wakes = one UI-thread picture per layer from one derived value; pure plans in
   `labb-layer-plan.ts`; photos via RN probes outside the canvas + image shaders (C-50, C-51).
   The per-component path stays as the A/B baseline (tests pin both).
4. **Fix 3:** `memo(LabBRenderer)` with a part-wise contract comparator — fewer canvas commits
   (each one re-records twice and sync-reads every bound value in RN Skia 2.6.2).
5. **Result (emulator release):** 0 skipped frames on every big switch (was 216–371); the full
   showcase plays at normal speed. Legacy 216–427 → 33–120 (fix 1 only).
6. **V2 consequence:** per-entity declarative Skia components with animated props are not viable
   at 100+ bodies; per-layer imperative pictures (or Atlases) are. Closure-capture discipline and
   canvas memo boundaries are renderer requirements, not polish.

## 2026-10-01 — WP-2.2 focus state and interaction feedback (L7)

Commits: `11c21745` (pass 1), `0acdc848` (pass 2 tuning), plus the WP-2.2 docs/evidence commit.
Evidence: `evidence/08-wp2.2-focus/`. Device: emulator only (debug while iterating, release
for the final captures and perf).

1. **Architecture follows the switch-stall rules.** No per-body components or SharedValues:
   the reticles are ONE picture (`LabFocusPicture`, between bodies and labels) and all feedback
   is ONE picture (`LabFeedbackPicture`, L7), each from one derived value. Worklets capture
   only shared values and small stable data (accent vec4, scalars, stable `NO_KEYS`). Nothing
   reads the ambient clock: every animation is a `withTiming` SharedValue, so these layers do
   not re-record at rest. Pure maths in `labb-focus-logic.ts` (tested).
2. **Focus state** (`useLabFocusState` in `LabFocusFx.tsx`, exposed as
   `LabRenderContext.focus`): `mix` and `keys` are written ONLY in a `useEffect` keyed on the
   focus identity (joined body keys). `keys` is retained after a clear so the release fades
   out with `mix` (340 ms in / 260 ms out). `lock` follows `camera.active` (new contract field
   `cameraActive`): a new focus "seeks" while the recovery flies in, then locks over 380 ms
   once the camera settles (a 160 ms grace if no fly-in starts).
3. **Target-lock reticle replaces the accent focus ring** (flag `fxFocus`): four corner
   L-brackets, cardinal inner ticks, a soft additive under-glow (dark themes), a faint dashed
   range circle once locked, and a one-shot lock flash ring. While seeking, spread and spin are
   a pure function of the body's remaining on-screen distance to the usable-rect centre, so the
   reticle converges WITH the camera. This is the "weight" cue; camera semantics are unchanged.
   Cluster focus: a reticle per member plus a dashed hull ring. Satellite focus: a 0.8× reticle.
   The legacy accent ring (bodies picture, moon ring, sun `focusColor`) is suppressed while
   the flag is on.
4. **World response** (flag `fxFocusDim`): body shader `uK.w` = +mix on the focused world
   (atmosphere ×1.8 plus a soft halo even on atmosphere-less statuses, a slightly brighter
   status limb) and −mix on every other world (30 % desaturation, 22 % toward the sky, ×0.68
   luminance; atmosphere ×0.45). There is no new uniform, because the spare `uK.w` slot is
   used. Flat fallbacks and moons dim alpha ×0.6. Rings dim from the animated mix (replacing
   the static React dims); the focused ring's glow and lock line fade in with the mix.
   Non-focused label tags ×0.62. The vignette deepens up to +16 %. The sun is never dimmed,
   because it is the light source.
5. **Feedback** (flag `fxFeedback`): `resolveTap`'s stamp (C-20) now also fires from `onNorth`
   (kind `north`; the recovery is unchanged). On a body tap, a sonar ping (two rings, the
   second an echo) follows the body. On empty space, a ripple on the world plane (circle at
   the unprojected tap point under the plane homography, i.e. a projected ellipse). On the
   north tap, a Polaris flare (cross spikes plus a ring). 620 ms each.
6. **Reorder hold language** (flag `fxReorder`, replaces the accent ghost path): a hold-charge
   arc fills around the body over `HOLD_MS` from touch-down; once active, the held body's ring
   glows on the plane (its radius is the candidate slot), flashes on every slot change, and a
   locked reticle rides the body. The haptic is unchanged. Verified on device that the
   motion-event drag reordered and committed (EN moved slots after reload, `12`/`16`).
7. **Focus card anchoring** (flag `focusCardAnchor`, `orrery-focus-placement.ts`, tested):
   a keep-out box covers the body plus a label reserve on both sides (58 dp × fontScale; the
   allocator may flip the tag above). The card tries below, above, right, left; if nothing
   fits whole, it takes the roomier vertical side with a height cap (the card scrolls),
   else it docks. Natural height comes from `onContentSizeChange`, so a capped card can grow
   back. Content and actions are unchanged. With `hudChrome`, the two actions share one
   wrapping row (pass 1 found "Open Profile" clipped under the cap).
8. **HUD chrome** (flag `hudChrome`, Orrery components only): `OrreryHudCorners` adds accent
   hairline corner brackets (the reticle's language) and an instrument radius (`RADII.sm`)
   on the selector, View options, the three controls and the focus card. "View options" is
   in tracked caps. The System name stays in its own case (user content; pass 1 uppercased
   it and the extra width truncated it). Glass tint and opacity are untouched (ADR-149 / C-02).
   The shell "+" FAB and the app header are shared across screens and are NOT restyled.
9. **Standard Dark identity** (flag `stdChart`, `LabChart.tsx`, profile `chart`): the
   Standard package gets a quiet graphite sky (`STANDARD_DARK_ENV`: nebula ≈⅓ strength, no
   ember, crisp sparse stars, almost no twinkle, softer vignette, half-strength ring flow)
   plus a navigational chart graticule on the world plane. The graticule has range rings at
   a nice step, 30° bearing spokes and a 10°/30° degree scale, in `textSecondary` hairlines at
   alpha 0.10, as one picture under the homography. Standard Light also gets the chart. Galaxy
   is unchanged. `stdChart` off restores the pre-WP-2.2 Standard profiles.
10. **Reduced motion:** the reticle is locked immediately (no seek, spin or flash) and the
    world response is instant. Pings and ripples become a fixed ring that fades over 150 ms.
    On device, 0 changed pixels outside the HUD between 3 s and 5 s while focused (`08`).
11. **Visual iteration.** Debug pass 1: reticle, dims, ripple, ping, card below the label;
    the card was clipped by the height cap, which led to the one-row actions; the System name
    was truncated by uppercase, which led to keeping its case. Pass 2: chart alpha 0.13 →
    0.10 (spokes too present at identity zoom); ripple alpha 0.5 → 0.7 (faint in pass-1
    frames). Release: final captures plus perf.
12. **Matrix covered:** photo (Wren Ellis, Dev Holm) and initials (Rosa Brook, Eli Novak, Cleo
    Okafor) focus; Dense 120; identity/near zoom via fly-in (overview at Home); all four
    themes; reduced motion; reorder hold and drag; a System switch while focused (the focused
    contact was not a destination member, so focus cleared and no stale reticle remained);
    background → foreground while focused (focus restored, reticle re-locks); satellite focus
    (release `15`). **Not covered:** a far zoom preset while focused, a cluster (group) tap,
    and the Polaris north tap on device. The flare is built and unit-tested but was not
    captured.

## 2026-10-01 — R1 performance envelope and legibility (emulator; phone pass prepared)

Commits: `bba4cf5b` (seed, probe, deep links, idle-clock/opaque flags), `83c9033a` (density
fixes + crash fix), `2d043162` (focus-card occlusion, point LOD), `89c2f1dd` (projection fast
path, ring culling), `80852701` + `5547b519` + `7c3ec0e6` (legibility, opaque default) — see
`git log 3422d06c..`. Report: `research/R1-REPORT.md`. Evidence: `evidence/09-r1/`.

1. **Density fixture.** `seedLabBStressIfAbsent` adds 800 synthetic contacts (unique names,
   light histories, procedural photos on every 4th, 111 moons) and the Systems "Lab B Stress
   400" / "Lab B Stress 800" through the real DAOs; idempotent by name, so an existing debug
   install gains them without `pm clear` (53 s on the emulator).
2. **Measure first.** A committed per-worklet probe (`perfProbe`, off by default) plus a
   deep-link harness (`tools/r1-perf.sh`, `r1-matrix.sh`) replaced panel taps; `focus=`,
   `clear=1`, `theme=` deep links were added for scripting (C-65).
3. **The 800-body crash (both renderers).** Mounting or focusing an 800/940-body System killed
   the app: SIGSEGV on the JS thread inside RN Skia `JsiHostObject::get` →
   `jsi::Function::createFromHostFunction` (symbolised from the debug `librnskia.so`). Every
   focus / scene / cluster change rebuilt a Skia Paragraph per label (~1 900). Caching prepared
   paragraphs by (role, width, text) made it 0/5 (from 3/3 + 5/5). Root cause inside
   RN Skia/Hermes is inferred (host-object churn), not proven (C-63).
4. **Hidden per-tick work.** Reanimated subscribes a derived value to EVERY SharedValue
   reachable from its closure; worklets that captured the whole lab context re-ran on every
   clock tick (trim picture, switch-FX states, star placements). Worklets now capture
   `LabStillContext` (no clocks) or single values.
5. **O(N²) → O(N) in the model half** (no semantic change): label allocation body lookups,
   `deriveSatelliteBodies`, and `projectFrame` (per-frame constants hoisted; it called
   `usableCameraRect` — obstacle region splitting + sort — once per body). The projection is
   bit-identical (new test). 800-body frame projection 35.7 → 3.4 ms.
6. **LOD instead of cost.** Wakes (one shader per ring) and ring energy flow are off above 160
   rings; wakes hide while the camera recovers and fade back (C-59, C-60). Rings and switch
   trims skip rings that cannot touch the screen. A point LOD for sub-6 dp bodies exists behind
   a flag but rarely triggers at today's MIN_ZOOM (C-62).
7. **Idle mode.** The lab clock is a pausable frame callback, active only while an ambient effect
   can animate (`labAmbientNeeded`). Reduced motion or all-ambient-off now draws 0 frames when
   untouched (was 190 per 10 s). C-29 resolved (C-64).
8. **Opaque canvas default ON.** SurfaceView presents 60 fps where TextureView presented
   ~28 fps on this emulator (SurfaceFlinger latency); overlays still composite. gfxinfo cannot
   see it, so the harness pins `opaqueCanvas:0` for gfx A/B and the phone script measures both
   (C-07, PHONE-PASS-SCRIPT §4).
9. **Legibility.** `tools/r1-contrast.py` computes ADR-149-style model ratios (tint/plate over
   the raw extreme pixel under the element, raw backdrop from a labels-off twin capture) and
   measured ratios (rendered text vs rendered backdrop). Findings and fixes: the sun reached
   pure white (Standard Dark glass `textSecondary` 4.42:1) → a composite-aware glow cap on dark
   themes (`SUN_GLOW_CAP_DARK` 0.94; now bounded at 4.45 by the initials glyph ink, a palette
   token outside ADR-149's proof set — owner item, not retuned); defocused labels dimmed plate
   and text together (model 2.2–2.9:1 over a bright/dark extreme) → text-only dim with a 0.66
   floor (≥ 4.95:1 model, all four themes); the focus card ghosting → canvas occlusion under the
   card (C-61) with the ADR-149 glass untouched.
10. **Not done here (phone needed):** absolute frame times, thermal, Mali GPU fill, Perfetto
    thread split — `research/PHONE-PASS-SCRIPT.md`.

## 2026-10-01 — R2 art direction and hero moments (emulator, release `r2a`…`r2d`)

Commit `ff90df99` (code + tooling); report `research/R2-REPORT.md`; evidence `evidence/10-r2/`.

1. **Art review first** (`00-before`, R2-REPORT §1): the R1 renderer was depth-capable (plane
   homography, far-side fade, haze, perspective) but Home was tilt 0, so the map read as a
   radar target; the sun lit nothing; overview bodies were pins.
2. **Default tilt as a flag, not a product change.** Tilt is already a product gesture and
   every model-half consumer (projection, hit test, labels, focus framing) runs through the
   tilted projection, so a tilted Home is safe for taps/labels — but docs/systems/orrery.md
   defines Home as tilt 0 for Recenter. `labHomePose` wraps the three OrreryScreen Home call
   sites (switch destination, scene framing, Recenter); `deriveHomePose` is untouched. 0.56 rad
   chosen from a 0.45 / 0.7 / 0.95 probe (`01-tilt-probe`): 0.7+ squashes the far side under
   the selector pills. C-66.
3. **The sun lights its plane** with ONE full-screen shader (`stagePlane`): inverse plane
   homography per pixel → world radius → gaussian + core falloff in the sun's glow token, plus
   the optional gravity-well grid in the same pass. Uniforms derive from `frame` only, so the
   idle clock and reduced-motion stillness are unaffected (0 changed pixels, `06-final/09`).
4. **Rim light lives in the existing ring shader** (`uSpin.zw` were unused zeros), not in a new
   pass: per-pixel e^(−r/R) on the world-space stroke.
5. **Overview size floor is visual only** (max 1.4×, below 12 dp) in the bodies picture.
6. **Iteration log.** iter 1 (`02-iter1`): pool radius 0.55·extent tinted the whole sky brown;
   cartesian grid drew a crosshair through the sun; deep links did not apply poses (the
   remount re-framed) → pose deep links now honour `delay`, captures recentre after each
   remount. iter 2 (`03-iter2`): pool 0.32·extent; bloom at threshold 0.62 flattened the sun;
   tilt-shift failed. iter 3 (`04-iter3`): grid offset half a cell + well radius 0.3·extent,
   flare ghosts ×1.5, bloom 0.74 / 0.7, all four themes, shock filter elliptical + doubled.
   Final (`06-final`, release `r2d`): defaults ON for the five art flags.
7. **Experiment verdicts** (R2-REPORT §3): bloom = beautiful but too costly; shock filter =
   failed (invisible at speed); lens flare = simplify to the streak; tilt-shift = failed;
   plane grid / gravity well = simplify (texture). Experiments stay committed, flag-off.
8. **Not changed:** switch choreography constants, focus lock, labels/allocation, reorder, theme
   tokens (all new colours are uniforms from existing tokens), reduced motion.

## 2026-10-01 — R3 integration polish (emulator, release `r3a`…`r3e`)

Commits `13c706ad` (presets, near-size clamp, immersive chrome, rail, comment fixes, harness on
presets), `1c339064` (moonShader crash fix), `23bedb9c` (Home tilt lab-only), plus the R3 docs commit.
Report: `research/R3-REPORT.md`. Evidence: `evidence/11-r3/`.

1. **Legibility re-measured first** (R1 method; `tools/r3-legibility.sh` adds a Recentre so the
   Home tilt + stage plane are in frame). No regression from R2's stage: label model ratios
   10.96–15.27, defocused labels vs median ≥ 5.14, overlay glass model unchanged (Standard Dark
   `textSecondary` 4.42–4.47, the R1 owner item C-02). Nothing retuned.
2. **Near bodies** are clamped on the FRAME, not in the bodies picture: a drawn-only clamp would
   leave hit radii, label gaps, the reticle and the card keep-out on the old size. Positions keep
   full perspective (the plane still recedes); size growth from perspective is knee'd at +6 %
   and the radius soft-caps at 8 % of the short side (iteration 1 had 9.5 %). C-71. Framing /
   preset changes were not used: the "detail" preset is a debug path (C-25) and a real pinch
   zooms around the fingers.
3. **Immersive chrome is route-local.** The Orrery screen renders its own `ShellAppBar`, so it may
   float that bar over a full-route canvas; the status band, tab bar and "+" FAB belong to the
   shared shell and were left alone (C-72). The bar registers as an obstacle, so the camera's
   usable rect, Home framing and card placement are unchanged in window terms; the pills get a
   `topInset` instead of being wrapped (a wrapper broke their zIndex/elevation ordering against
   the controls when the selector opens). The controls become ONE HUD rail (hud + immersive).
4. **Presets** (`LAB_PRESETS`, `labPresetFlags`, `applyPreset`, deep link `preset=`): presets
   set the renderer and every non-debug flag; debug instrumentation keeps its value except
   `forceFallback` / `freezeClock` (off); `ringsPathRebuild` (an A/B baseline that replaces the
   rings) is never on. "Lab B best" = the registry defaults (so Reset = best); "Ship-safe" drops
   the costly / owner-glance / failed effects (C-73); "Everything" turns on every effect and the
   experiments; "Legacy" = legacy renderer.
5. **Final defaults ("Lab B best")**: every R2 art flag ON, R3 `nearSizeClamp` + `immersiveChrome`
   ON, experiments (`bloom`, `lensFlare`, `tiltShift`, `fxShockFilter`, `nebulaLive`,
   `moonShader`) OFF — R2 verdicts unchanged on the emulator.
6. **Found and fixed while exercising "Everything":** `moonShader` + layer pictures crashed the
   app (`makeShaderWithChildren` without a children array; the moon effect has no children →
   `makeShader`). The Skia test mock silently defaulted the array; it now throws like native.
7. **Home tilt is lab-renderer only** now: the Legacy preset showed a tilted legacy map
   (`labHomePose` ignored the renderer), which made Legacy a non-baseline.
8. **Less-tested paths** (`tools/r3-paths.sh`): cluster tap on the tilted plane opens the group
   panel with a reticle per member; far-zoom (0.4) focus flies in and locks; reorder hold/drag
   on the tilted plane shows the elliptical held-ring glow and commits (RB moved a slot);
   background 1 s into a big switch → foreground lands settled on the destination; reduced
   motion with "Everything" (bloom + flare + tilt-shift on) = 0 changed pixels over 3 s; the
   Polaris flare fires on a Polaris tap. **Open:** a Polaris tap fires the flare (so
   `hitPolaris` passed and `camera.recover(northTarget)` ran) but no visible north recovery on the
   emulator, flat or tilted; the rail's Reset north works. Not diagnosed (model-half gesture /
   recovery path, shared with legacy; legacy comparison inconclusive).
9. **Stale comments corrected** (coordinator audit): `LabEnvironment` (768² @ 0.45 texel/dp, far
   stars in the nebula shader), `LabRings` (wake = shaded circle per ring, pictures), `LabBRenderer`
   (actual layer order incl. stage / bloom / tilt-shift / flare), `labb-effects` (what warm-up
   really compiles). PHONE-PASS-SCRIPT + `r1-matrix.sh` now run the presets plus `bloom` /
   `nostage` rows into `evidence/12-phone/`.

## 2026-10-01 — Final validation (release from `883b84ed`, preset best)

1. **Polaris tap: no code change.** Intended behaviour = dossier phase 08 §O D-08-069 (tap
   resets yaw only), `docs/systems/orrery.md` "Reset north changes yaw only". The `onNorth`
   handler in `OrreryWorld` is shared by both renderers. After `yaw=0.75`, a tap on Polaris
   rotates back to north in **both** Legacy and Lab B best
   (`evidence/13-final/01-polaris/legacy-vs-best-before-after.jpg`). Starting the recording
   1.5 s before the tap shows the turn plus the flare (`best-polaris-tap-sequence.jpg`). R3's
   "no rotation" was a recording that started after the 180–850 ms recovery had finished.
2. **Exercise list** (contract) validated on the emulator: all PASS
   (`research/FINAL-VALIDATION.md`). Pinch, twist and tilt are left to the phone (adb is
   single-pointer).
3. **"Unavailable System" after a cold start with a custom last System:** pre-existing on
   main (`OrreryScreen` restore passes no name; the store resolves names only for built-ins
   and categories). Listed for main, not fixed in the lab.


## 2026-10-01 — Pixel 6 Pro phone pass (release arm64)

- **Measurement.** Opaque canvas ON, the shipping default. Frames counted from
  SurfaceFlinger presents: a new `tools/sf-sampler.py` polls `--latency`, takes the union,
  and uses the highest canvas layer id. `r1-perf.sh` gained `SF=1` and pid-filtered
  Choreographer skips; `r1-matrix.sh` gained a `notilt` config and per-cell thermal status
  (`25f82cdf`).
- **Finding.** The tilted Home turns the WP-1.3 stroked world-circle rings and wakes into a
  Mali GPU cliff (Dense 3–9 fps, GPU 99.7 %, UI thread blocked about 150 ms per frame in
  `eglSwapBuffers`). Untilted: 92–99 fps.
- **Not patched in the lab.** It is a draw-strategy rewrite (affine ovals or one ring
  shader); handed to V2 as a must-fix (PRODUCTIONIZATION "Phone additions").
- **Workaround tried.** A plain world saveLayer, built and measured on the phone: no effect.
  Reverted, never committed.
- **Opaque canvas stays default.** Every RuntimeEffect compiled on Mali; no visible
  artefacts.
- **Cuts for battery.** The soak was cut to 5 min and the Everything soak skipped (battery
  7 % at the end of the pass).

## 2026-10-02 — Tilt fix (phone pass P-1)

- The orbit layer draws as ONE full-screen analytic ring field (`ringField`, default ON). The per-ring screen-space ellipse routes are kept as the fallback when that effect is unavailable (`ringField:0`), not as the default. Phone numbers are in PHONE-PASS-RESULTS §10, and the losing routes are in DEAD-ENDS (tilt fix).
- The untilted per-ring fallback draws exactly as before the fix: an affine CTM plus the circle op, with no shader local matrix.
- Stroke widths in the field are the pre-fix world widths, seen through the analytic radial screen scale. The comet is drawn as the pre-fix effective mean (C-74).
- `homeTilt` default: **kept ON provisionally**. Dense 120 tilted 64.8 vs untilted 66.1 fps, same session. Stress 400 is still to be measured; if it fails the rule, flip the flag OFF.
