# Orrery Lab C — productionization

What it would take to ship the true-3D renderer, as opposed to only harvesting its ideas. Items marked
**owner** are decisions in the owner's bucket per CLAUDE.md (risk posture, product, or reversal of a
recorded decision).

## Owner decisions first

1. **Adopt a new native GPU stack?** `react-native-webgpu 0.10.4` (renamed from `react-native-wgpu` in
   May 2026, very high release cadence, open Android issues such as #407 "crash when configuring context") plus
   `three 0.186.1`. It costs about **+20.6 MB of native code per ABI**. **owner**
2. **minSdk 24 → 26** (`plugins/withLabCMinSdk.js`). Required by Dawn's `AHardwareBuffer_*` use. It drops
   Android 7.x devices. **owner**
3. **Dense Home framing** (core framing at 50%, MIN_ZOOM 0.08) changes the production readability-floor
   rule (`zoom ≥ 10/minRadius`). **owner**
4. **Never-contacted "spine"** (`NEUTRAL_RESTING_ANGLE = 0` stacks them due north). Spreading them is a
   layout rule change. **owner**
5. **"Unavailable System" for restored custom Systems is a pre-existing bug on main.** On focus,
   `OrreryScreen` restores `preferences.lastSystem` without a name, and the store resolves names only for
   built-ins and categories. It was fixed **lab-only** in f608d35d by reconciling from the catalog. Whether
   and how to fix it on main is the owner's call (DECISIONS.md B.4/B.5, C.1).
6. **Focus cleared on tab return** (seen in release). Needs a comparison with production before deciding
   whether it is a regression.

## Engineering work

### Architecture
- **Move rendering off the JS thread** (worklets Bundle Mode with three, or raw WebGPU on the UI runtime).
  Today: a 60 Hz ceiling, ~10–11 ms JS per frame, contention with gestures and switch-time SQLite reads,
  and up to one frame of lag behind the pose. Investigate why rAF runs at 60 Hz on a 120 Hz panel.
- **Gate every lab change behind the renderer choice.** `HOME_CAMERA`, `MIN_ZOOM`, `MAX_TILT`,
  `deriveHomePose` and the gesture mapping were edited in shared logic files.
- Batch label quads into one atlas and one draw (today: one mesh and one texture per label, LRU 96).
- Replace the atlas `readPixels` → `DataTexture` CPU round trip with a GPU-side upload, or size tiles to the
  real on-screen max.
- Draw the reorder ghost in 3D (currently missing).
- Remove lab-only code: badge presets, stats/mem logging (not stripped in release), `runBitmapProbe`,
  `LogBox.ignoreLogs`, the seed and the app identity changes.

### Memory and lifecycle
- **Find the Hermes `external` retainer** (post-gc floor +~52 MB per mount in release). PSS is flat, but the
  counter drives GC scheduling. Suspects: three's renderer-side WeakMaps keyed on the destroyed device, and
  JS callbacks held by Reanimated. Needs a heap snapshot.
- Soak test: 50+ tab visits and background/foreground cycles on device, watching PSS and the device-lost log.
- Smooth the first-5 s hitch after mount (worst frame 465 ms): stage photo decode and label rasterization
  across frames.

### Visual
- Fix the face-tile text. Tiles show ellipsized names ("Ch…") instead of initials, probably because
  `orreryInitials` falls back to the whole name when `Intl.Segmenter` is missing on Hermes (inferred from code
  and screenshots, **not verified on device**). The same function feeds production, so check the Skia
  Orrery too.
- Light themes: dark night sides on pale ground. Try outline or rim light instead of glow; re-shoot
  Standard-light after the fix.
- Moons slightly faded at 10–14 px. A focus ring on a focused moon is missing (the pool is keyed by contact id).
- Known glitches: a one-frame black upper canvas when the selector closes; a camera step before the switch
  choreography starts; the "Couldn't load this System" transient seen once on relaunch.
- Theme tokens: move the remaining numeric colours (sun core highlight, mask ramps) to tokens or document
  them as non-colour masks; replace the luminance-based light/dark test with the theme store's mode.
- Fix stale comments (ring stroke "world units", "2k star slab").

### Tests
- (Done in df8479b6) The 2 `orrery-screen-framing.test.ts` failures caused by the lab-only "Unavailable System"
  effect reading `requested.ref.kind` are fixed with a `ref?.kind` guard. A production fix of that bug should
  come with its own test.
- Keep and extend the parity tests (camera rig, frame-lite, lifted moons) and the strategy-camera tests.
- Add tests for `switchDepth` (zero at p = 0 and 1, reduced-motion still), `effectiveLabelZoom`, the ring
  density fade, minimum on-screen size, and `focusCardPlacement`.
- `tsc --noEmit` is clean. Add `check:colors` to the gate (not run in the lab).

### Accessibility
- The canvas is not the accessible path (unchanged by design). Verify TalkBack swipe navigation by hand
  (owner checklist), or with a UiAutomator instrumentation test.
- Optional new scope: per-body a11y overlay nodes driven from the projection packet, with throttled updates
  and no per-frame setState.

### Device and dependency matrix
- Only the Pixel 6 Pro (Mali-G78) was tested. Test a low-end GPU, an Adreno device, the
  Pixel 3a, and Vulkan-less fallback behaviour. The emulator is software-only and its perf numbers are
  meaningless.
- Check 16 KB page-size alignment of the Dawn prebuilt for Play.
- Pin and watch upstream issues: react-native-webgpu #407 / #445 / #455, the three `QuadMesh` listener leak
  workaround in `disposeRenderer`, and the InstancedMesh-on-Hermes destructuring issue (avoided because
  `babel-preset-expo` hermes-v1 does not include that transform).
