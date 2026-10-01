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
