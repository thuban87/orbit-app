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
