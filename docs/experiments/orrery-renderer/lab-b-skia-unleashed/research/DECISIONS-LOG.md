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
