# Lab C — Renderer Decision Note (true-3D Orrery)

Status: decision for the R&D prototype on `experiment/orrery-3d`. Researched 2026-10-01.
Scope: choose the GPU renderer for a true-3D Orrery (perspective camera, 3D geometry,
camera-facing photo/label billboards, lighting, depth, particles) on the physical
Pixel 6 Pro (Mali-G78, Vulkan), built via Expo prebuild + Gradle.

Legend: **[V]** verified from source/registry/issue on the date given; **[U]** unverified
(plausible, must be proven in the spike).

---

## 1. The app as it is today (verified on disk)

| Item | Value | Source |
|---|---|---|
| Expo SDK | `expo ~57.0.13` (SDK 57, released 2026-06-30) | `package.json`; [expo.dev/changelog/sdk-57](https://expo.dev/changelog/sdk-57) |
| React Native | `0.86.2` — New Architecture only (legacy arch removed upstream; every candidate below requires/assumes new arch) | `package.json` |
| React | `19.2.3` | `package.json` |
| Reanimated / Worklets | `react-native-reanimated 4.5.1`, `react-native-worklets 0.10.4` (babel plugin `react-native-worklets/plugin`) | `package.json`, `babel.config.js` |
| Skia | `@shopify/react-native-skia 2.6.2` (Ganesh/GL backend; latest is 2.14.0) | `package.json`, npm |
| Gesture Handler | `~2.32.0` | `package.json` |
| JS engine | Hermes (Expo default). `babel-preset-expo 57` selects the `hermes-stable` → `hermes-v1` transform profile | `babel-preset-expo/build/index.js` |
| Other native | `react-native-nitro-modules 0.37.0`, `react-native-quick-crypto` (C++/NDK build already in the app), `expo-file-system ~57.0.4` (has `./legacy` export), `expo-image`, `expo-image-manipulator` | `package.json`, package tarball |
| `android/` | **Not checked in** — Continuous Native Generation via `app.config.ts` + local plugins | `ls` |
| Metro config | **None** (Expo default). A WebGPU/three setup may need one. | `ls` |
| Orientation | Portrait-locked | `app.config.ts` |

What the current Orrery renders (Skia, 2.5D): `OrreryCanvas` (`<Canvas>` + `useClock` starfield twinkle,
unmounted on blur/background to stop the loop), `OrbitBody`/`SunBody`/`SatelliteBody` (photo `SkImage`
clipped discs, initials fallback, glow), `ProjectedOrbitRing`, `OrreryLabel` (Skia `Paragraph` with a
`TypefaceFontProvider`, native shaping/ellipsis, theme tokens), `Polaris`. Photos come from
`use-orrery-photo.ts`: local `file://` masters, capped at 512 px via an on-disk derivative
(`ORRERY_TEXTURE_MAX = 512`), explicit `SkImage` disposal. Camera/gesture state is a single
**UI-thread pose owner** (ADR-077, `use-orrery-camera.ts`) with worklet projection
(`src/logic/orrery-camera-logic.ts`, `orrery-frame.ts` — `projectFrame`, `BillboardPose`,
switch choreography all `"worklet"`). This existing worklet projection pipeline is the most
important asset for the migration (see §5).

---

## 2. Comparison table

| | **A. three.js WebGPURenderer + react-native-webgpu** | **B. three.js WebGLRenderer (± R3F 9 native) on expo-gl** | **C. Skia "real projection" (no new dep)** | **D. react-native-filament** | **E. Babylon React Native** |
|---|---|---|---|---|---|
| Current version | `react-native-webgpu 0.10.4` (2026-09-29), `three 0.186.1` (2026-09-24) | `expo-gl 57.0.2` (SDK-57 line), `@react-three/fiber 9.8.1` (2026-09-24), three 0.186.1 | `@shopify/react-native-skia 2.6.2` installed / 2.14.0 latest | `1.11.0` (2026-05-27) | `@babylonjs/react-native 2.0.5` (2026-05-19) |
| GPU API on Pixel | Dawn → **Vulkan** | GLES 3.0 via JSI WebGL2 shim | Skia Ganesh (GL) | Filament → Vulkan/GLES | Babylon Native (bgfx) |
| True 3D (depth buffer, perspective, lights) | Yes | Yes | **No** — painter's-sorted 2D draws with a 4x4 matrix; no depth buffer, fake lighting via SkSL | Yes (PBR) | Yes |
| Expo / new arch status | Official config plugin; **official Expo template on SDK 57 / RN 0.86.3 / Reanimated 4.5.1** [V] | expo-gl is a first-party Expo module, updated each SDK [V]; R3F native fixed for new arch in 9.x (PR #3539, merged 2025-06-29) [V] | Already in app | Open "Expo SDK 54 + New Arch NSException" (iOS) and "Expo v57 Android" MaterialInstance error (2026-09-29) [V] | "Expo not officially supported" (README) [V] |
| Render loop thread | JS thread (three is not workletized). Raw WebGPU can run on the UI runtime; three only via experimental worklets Bundle Mode | JS thread (expo-gl has raw-GL worklet support, but three cannot use it) | **UI thread** (Reanimated/Skia, as today) | Own render thread + worklets-core callbacks | Native thread |
| Local photo textures | Read bytes (`expo-file-system`) → `createImageBitmap(ArrayBuffer)` → texture; or Skia-decode → `writeTexture`. `fetch(file://)` is not a path [U] | R3F's native `TextureLoader` passes `file:` URIs straight to expo-gl's native image loader (no JS decode) [V in 9.8.1 source] | Already solved (`use-orrery-photo`) | Possible via buffers; glTF-centric [U] | [U] |
| Text / labels | No native text. Rasterize with Skia (`Paragraph`, current fonts/tokens) → texture. troika on native: not viable [U] | Same Skia→texture approach; troika/drei `<Text>` on native unreliable [U] | Native (current `OrreryLabel`) | No text API | GUI textures [U] |
| Instancing 100–300 bodies | `InstancedMesh`/`BatchedMesh`/`Sprite`/`Points`; one draw call per kind | Same (WebGL2 instancing) | `Atlas` (RSXform sprites) + per-body draws; ~300 shaded bodies + labels plausible | Instances supported, heavier per-entity | Yes |
| APK impact (arm64) | `libwebgpu_dawn.so` is **17 MB uncompressed** per ABI (arm64-v8a) [V tarball]; compressed APK delta ~6–9 MB [U] | Small native lib + three JS (~1 MB bundle) [U] | 0 | Filament + bullet3, ~tens of MB unpacked per ABI [U] | Large, CMake/Ninja toolchain [V README] |
| Maintenance cadence | Very high (12 releases Jul–Sep 2026) but young (package renamed from `react-native-wgpu` 2026-05) | expo-gl: maintenance-only; pmndrs maintainers call ExpoGL "SIGNIFICANT performance issues", native moving to WebGPU in R3F v10 [V] | High (Shopify) | Low (1 release in 2026; "is this maintained?" issue 2026-02) | Moderate; Expo unsupported |
| Verdict | **Primary** | **Fallback** | Baseline / control | Reject | Reject |

---

## 3. Per-option notes

### A. three.js `WebGPURenderer` on `react-native-webgpu` (Dawn) — RECOMMENDED

- **Integration** [V docs]: `npm i react-native-webgpu`; add `"react-native-webgpu"` to Expo `plugins`
  (the plugin only touches the iOS Xcode scheme; no-op on Android). Requires RN ≥ 0.81, new arch only;
  optional peers `react-native-worklets ≥0.7.2`, `react-native-reanimated ≥4.2.1` (we have 0.10.4 / 4.5.1).
  Android builds `android/cpp` via CMake/NDK against a prebuilt `libwebgpu_dawn.so` — the app already
  does NDK builds (quick-crypto/Nitro), so no new toolchain class.
- **Strongest evidence it works on our exact stack**: the maintainer's Expo template
  (`apps/expo-webgpu/package.json`) pins `expo ^57.0.1`, `react-native 0.86.3`, `react 19.2.3`,
  `react-native-reanimated 4.5.1`, `react-native-worklets 0.10.1`, `three 0.172.0`,
  `@react-three/fiber ^9.4.0`, `react-native-webgpu ~0.8.5`. That is our stack within a patch version.
  Source: https://github.com/wcandillon/react-native-webgpu/tree/main/apps/expo-webgpu (read 2026-10-01).
- **three setup**: import from `three/webgpu`. If any `three/addons/*` are used, a Metro
  `resolveRequest` alias of `three` → `build/three.webgpu.js` is required (doc gives the snippet; the
  template's own `metro.config.js` aliases every `three*` import). Call `renderer.init()` before the first
  `render()`; call `context.present()` after every `render()` (RN does not auto-swap). `TextDecoder`
  may be missing on Hermes → `fast-text-encoding` polyfill (doc says required; whether Hermes V1 in
  RN 0.86 now ships it is [U]).
- **R3F on WebGPU**: possible but needs a `patch-package` patch of `@react-three/fiber/package.json`
  (`react-native` field → web bundle), a hand-written `FiberCanvas` glue, and has an open bug where a
  re-render during the async `gl` factory creates two renderers (pmndrs/react-three-fiber #3782,
  2026-07-13, open). **Decision: use imperative three.js, not R3F.** The Orrery scene is data-driven
  from an existing worklet frame pipeline; a reconciler adds overhead and invites React-state-driven
  animation (forbidden by CLAUDE.md). R3F can be reconsidered for V2.
- **Textures from local files**: `fetch()` on `file://` fails in RN (react-native-webgpu #82 shows the
  iOS variant) — do not use three's `TextureLoader`/`ImageBitmapLoader`. Path: read bytes with
  `expo-file-system` (`File(uri).bytes()` or legacy base64) → `createImageBitmap(arrayBuffer)` (RN
  webgpu accepts ArrayBuffer [V docs]) → `new THREE.Texture(bitmap)`; whether three's WebGPU backend
  uploads an RN-webgpu `ImageBitmap` via `copyExternalImageToTexture` without patching is [U] — spike
  check #3. Alternate path guaranteed to work: decode with Skia (already done by `use-orrery-photo`),
  `readPixels()` → `THREE.DataTexture`. Keep the 512 px derivative cap; pack photos into one atlas
  texture (e.g. 2048² = 64 × 256 px tiles) so all bodies are one instanced draw.
- **Labels**: rasterize with Skia offscreen (reuse `prepareOrreryText` / Paragraph, same fonts and theme
  tokens, correct Unicode shaping) → pixels → label atlas texture; draw as camera-facing instanced
  quads. Re-rasterize only on text/theme/fontScale change, never per frame. (With a Skia **Graphite**
  build, Skia↔WebGPU share one Dawn device and textures zero-copy — but Graphite is `@next`/"experimental
  preview" and would swap the whole app's Skia backend: out of scope for the prototype.)
- **Threading / gestures** — the central design risk: three renders on the **JS thread**
  (`setAnimationLoop` → rAF). Our camera pose lives on the **UI thread** (ADR-077). Options, in order:
  1. Keep RNGH + pose worklets as-is; each UI frame (`useFrameCallback`) pack the camera pose +
     choreography sample into a small array and hand it to JS (`runOnJS`/`scheduleOnRN`); JS sets the
     three camera and renders. Cost: ≤1 frame visual lag on gestures; JS-thread stalls (SQLite reads,
     store updates during System switch) drop GL frames. [U — measure]
  2. Bundle Mode (react-native-worklets experimental) runs three.js on a worklet runtime — showcase
     exists (software-mansion-labs/Bundle-Mode-showcase-app) [U on our versions]. Note
     react-native-webgpu #455 (2026-08-27): one `GPUDevice` touched from two runtimes crashed; the docs
     now say `implicitDeviceSynchronization` is on by default as the mitigation. Keep a device on one
     runtime regardless.
  3. Raw WebGPU (no three) on the UI runtime via `useFrameCallback` — fully UI-thread, but we write our
     own WGSL instanced-billboard renderer. Reserve for V2 if option 1 janks.
- **Accessibility / RN overlays**: do not round-trip projections GPU→JS. Compute screen positions on the
  UI thread with the existing worklet `projectFrame` from the *same* pose/matrix the GL camera uses, and
  drive invisible RN hit/a11y views with `useAnimatedStyle`. Visible labels live in GL so they never
  drift; the RN overlay can lag a frame harmlessly.
- **Known issues to design around** [V]: #407 (2026-07-04, open) "Android: Crash when configuring
  context" — device lost on re-binding a Vulkan window, relevant because our Canvas unmounts on
  blur/background; #333 directional-shadow receiver crash (avoid three shadows — fake them);
  three r184 `QuadMesh` dispose listener leak across remounts (docs: clear listeners after `dispose()`;
  fixed status in r186 [U]); #444 present mode hardcoded FIFO (fine; 120 Hz panel will vsync at the
  display rate [U]). **InstancedMesh-on-Hermes crash** (react-native #57934 / three.js #34227, both
  open, fix PR three.js #34308 open): caused by `@babel/plugin-transform-destructuring` in
  `@react-native/babel-preset`. Our `babel-preset-expo 57` `hermes-v1` profile **does not include that
  transform** (only `hermes-v0` does) [V by reading the preset], so we are likely unaffected — spike
  check #5. If hit: patch-package three with PR #34308, or use `BatchedMesh`/manual instanced
  `BufferGeometry` with a custom TSL node.
- **Emulator**: falls back to a software adapter — perf numbers only from the physical Pixel (matches
  CLAUDE.md).
- **Web/iOS**: same three code runs on web WebGPU; iOS via Metal. Secondary, but a plus.

### B. three.js `WebGLRenderer` on `expo-gl` (optionally R3F 9 native) — FALLBACK

- `expo-gl` versions track the SDK (57.0.2 for SDK 57; 58.x already published). Changelog shows only
  maintenance (SDK 56 added WebGL globals at module init, fixed WebGL2 inheritance). Install with
  `npx expo install expo-gl` (resolves 57.x). [V]
- R3F 9.8.1 native entry (`native/dist/react-three-fiber-native.cjs.js`) depends on `expo-gl`,
  `expo-asset`, `expo-file-system` (uses `/legacy`, which still exists in 57.0.4) [V]. New-arch blank
  screen (#3399) fixed by PR #3539 (merged 2025-06-29); loader Base64 crash fixed in 9.4.2 [V].
  Community evidence of working builds stops around Expo 53/54 — none found for SDK 57 [U].
- Upside: R3F's native `TextureLoader` hands `file:` URIs straight to expo-gl's native loader — local
  photos load without JS decoding [V source].
- Downsides: every GL call crosses JSI; pmndrs states ExpoGL has "SIGNIFICANT performance issues" and
  R3F v10 moves native to WebGPU (`pmndrs/native` README, last push 2026-01-25) [V]. Render loop on JS
  thread. `expo-gl`'s worklet mode only helps raw GL, not three.
- Why fallback: it is the most likely to *build* (first-party Expo module, tiny native footprint) and the
  three scene code ports if we stick to classic materials (see §6).

### C. Skia with real projection — BASELINE / control

- Already installed; UI-thread render via Reanimated; perfect text and theme-token discipline.
  Tools: 4x4 perspective matrices on `Group`, `Vertices` (textured triangle meshes — e.g. pre-projected
  sphere/ring meshes), `Atlas` (RSXform sprites for 100s of billboards in one call), `RuntimeEffect`
  SkSL (impostor-sphere shading with a light direction, glow, nebula), `Picture` caching.
- Limits: no depth buffer (we already depth-sort), per-vertex projection on the CPU/worklet each frame,
  no real lighting model, particle counts bounded by worklet CPU. It is "very good 2.5D", which is
  what lab A/B presumably explore. Useful as the perf/visual control, not the hypothesis of lab C.
- Graphite (`@next`, API 26+, experimental) and `SkiaGraphiteView` (record frames from a worklet)
  exist [V docs] — interesting for V2 interop with WebGPU, not for this spike.

### D. react-native-filament — reject

PBR/glTF-centric (Google Filament), its own worklets runtime (`react-native-worklets-core`, a second
worklets library beside Reanimated 4's `react-native-worklets` — extra babel plugin, conflict risk [U]).
No text; dynamic per-contact photo billboards are against the grain. Release cadence slowed (v1.9.0
2025-10-28 → v1.11.0 2026-05-27), open Expo-v57 Android error 2026-09-29, new-arch Expo crash
2025-10-03. Great for a hero 3D model, wrong for 300 photo billboards + labels.

### E. Others — reject briefly

- **Babylon React Native 2.0.5**: README says Expo is not officially supported; CMake/Ninja native
  build, large binary. No advantage over three for this scene.
- **Unity-as-a-library / Godot**: separate engine runtime, 30–80 MB+, second UI system, breaks theme
  tokens/a11y/RN integration and the debug/Metro loop. Disproportionate.
- **react-native-gl-model-view, expo-three**: unmaintained / superseded.
- **R3F v10 alpha / `@react-three/native`**: README says "DO NOT USE YET", not on npm [V].

---

## 4. Recommendation

**Primary: imperative three.js `WebGPURenderer` on `react-native-webgpu` (Dawn/Vulkan), Skia kept for
label/photo rasterization, existing UI-thread pose/projection pipeline kept as the source of truth.**

Rationale:
1. It is the only option giving a real GPU 3D pipeline (depth, perspective, lighting, instancing,
   compute-capable particles, TSL shaders) *and* has first-hand evidence on our exact stack (Expo 57 /
   RN 0.86 / Reanimated 4.5.1 template by the maintainer).
2. Ecosystem direction: pmndrs is moving R3F native to WebGPU; expo-gl is maintenance-only and
   acknowledged slow. Vulkan on Mali-G78 is the right backend for the target device.
3. three gives us mature primitives (`InstancedMesh`, `Points`, `Sprite`, node materials, bloom via
   post-processing) so the prototype spends time on the look, not on writing an engine.
4. Skia stays for what it is best at in this app — shaping text with our fonts/tokens and decoding
   photos — so label readability and theme discipline survive.
5. Keeping ADR-077's single UI-thread pose owner and worklet projection means gestures, focus,
   reduced motion and a11y overlays keep their existing, tested logic; only the drawing layer changes.

Experimental compromises to document (per contract, lab C may compromise): render loop on the JS
thread; theme colours must be fed into materials/uniforms from tokens (no hardcoded colours in
shaders — pass tokens as uniforms); APK grows by the Dawn library.

### Packages to install (exact pins)

```
react-native-webgpu@0.10.4      # NOT react-native-wgpu (deprecated alias, renamed 2026-05)
three@0.186.1
@types/three@0.186.0            # dev
fast-text-encoding@1.0.6        # only if spike check shows TextDecoder missing on Hermes
```
app config: add `"react-native-webgpu"` to `plugins` in `app.config.ts`'s string list. Metro: add
`metro.config.js` with the `three` → `three/webgpu` alias only if `three/addons/*` are imported.
Do not upgrade Skia/Reanimated/Worklets for this (peers satisfied). If 0.10.4 misbehaves, the
template-proven pair is `react-native-webgpu ~0.8.5` + `three 0.172.0`.

### Expected native build consequences

- Prebuild regenerates `android/`; react-native-webgpu autolinks (codegen spec `RNWgpuViewSpec`,
  Java package `com.webgpu`) and compiles `android/cpp` with CMake against prebuilt
  `libs/android/<abi>/libwebgpu_dawn.so`. First build adds a few minutes of C++ compile [U].
- APK: +17 MB uncompressed per ABI for Dawn (arm64 17 MB, armeabi-v7a 12 MB, x86 19 MB, x86_64
  18 MB) [V]. Debug APKs carry all ABIs; for device builds set `reactNativeArchitectures=arm64-v8a`
  (gradle property) to keep the delta to one ABI.
- minSdk: library uses the project's `minSdkVersion`; Expo SDK 57 default is ≥ 24 [U]; Pixel 6 Pro is
  far above any floor. No new Android permissions. No network on the render path (local-first intact).
- 16 KB page size: Dawn prebuilt alignment [U] — check `zipalign`/Play warnings later, not a spike blocker.

### Fallback if the primary fails at build/run time

`expo-gl` (`npx expo install expo-gl` → 57.0.x) + `three@0.186.1` **`WebGLRenderer`**, imperative (no
R3F needed; R3F `@react-three/fiber@9.8.1` only if its native `TextureLoader` file-URI path is wanted).
To keep the fallback cheap, write the prototype scene with renderer-agnostic three objects
(`MeshStandardMaterial`/`MeshBasicMaterial`, `SpriteMaterial`, `PointsMaterial`, `InstancedMesh`,
custom shaders isolated in one module) and only adopt TSL node materials after the spike passes.
If both 3D paths fail on device, lab C falls back to option C (Skia projection) and records why.

---

## 5. Migration sketch (from current Skia Orrery)

Keep: scene/read models (`orrery-scene.ts`, world/system/satellite/label logic), ADR-077 pose owner,
gesture logic, switch choreography sampling, focus logic, reduced-motion signal, lifecycle
(unmount on blur/background), photo derivative store. Replace: `OrreryCanvas`/`OrreryWorld` drawing
children with one `<Canvas>` from `react-native-webgpu` + a `OrreryScene3D` controller (imperative
three) that consumes `{camera pose, AnimatedFrame}` per frame. World coordinates: lift the current
2D orbit plane into XZ with Y up; the existing tilt becomes real camera elevation. Labels/photos:
atlas textures rebuilt off the frame path. Overlays: existing worklet projection drives RN a11y views.

---

## 6. First spike checks (first hour, on the physical Pixel)

Run on a debug build via `emu-connect` + `adb devices` (do not assume the serial). Record each as
pass/fail with evidence (logcat line, screenshot, fps number) in `PERFORMANCE.md`/`DECISIONS.md`.

1. **Build + GL context**: prebuild + Gradle succeed; `navigator.gpu.requestAdapter()` returns a
   *hardware* adapter (`warnIfNotHardwareAccelerated`); `renderer.init()` resolves; a cleared frame +
   one lit sphere presents. Log adapter info.
2. **Lifecycle**: navigate away/back to the Orrery tab 10× and background/foreground 5× — no
   "Device Lost"/crash (react-native-webgpu #407), loop actually stops when unmounted (logcat/frame
   counter), memory does not climb (`dumpsys meminfo com.bwales.orbit`, Graphics/GL rows).
3. **Local photo texture**: one real contact photo `file://` (512 px derivative) → bytes →
   `createImageBitmap` → `THREE.Texture` on a billboard. If it fails, Skia decode → `readPixels` →
   `DataTexture`. Both paths timed (ms per photo).
4. **Text billboard**: Skia `Paragraph` label (non-Latin name + emoji included) → texture → camera-
   facing quad; readable at overview and close zoom; check `typeof TextDecoder`.
5. **Instancing**: `InstancedMesh` of 200 photo-atlas billboards renders first frame without
   `Cannot read property 'instanceMatrix' of undefined` (RN #57934 / three #34227).
6. **Throughput**: 200 instanced bodies + 200 label quads + 2k-point starfield + additive glow,
   camera orbiting — measure frame time on the phone (`dumpsys gfxinfo` covers UI/render thread only;
   also log JS-side `renderer.info` + rAF deltas, since the loop is on the JS thread). Target 60 fps
   sustained for 60 s; note thermals.
7. **Gesture coupling**: pinch/pan driven from the existing UI-thread pose → JS camera: subjective lag
   and dropped-frame count while JS is busy (trigger a System switch during a pan).
8. **Overlay alignment**: a transparent RN `Pressable` positioned by the worklet `projectFrame` stays
   on its GL body during pan/zoom (≤1 frame drift) and is announced by TalkBack.
9. **APK size delta**: debug and arm64-only release APK size vs current baseline.

If checks 1, 2 or 3 fail with no workaround inside ~1 hour, switch to the fallback (§4) and log it in
`DEAD-ENDS.md`.

---

## 7. Sources (all read 2026-10-01 unless dated otherwise)

- npm registry (`npm view … version time peerDependencies`): react-native-webgpu 0.10.4 (2026-09-29;
  created 2026-05-08), react-native-wgpu 0.5.17 deprecation notice, three 0.186.1 (2026-09-24),
  @react-three/fiber 9.8.1 (2026-09-24, peers react >=19 <19.4, RN >=0.78), expo-gl 57.0.2,
  @shopify/react-native-skia 2.14.0 (2026-10-01; 2.6.2 = 2026-04-04), react-native-filament 1.11.0
  (2026-05-27), @babylonjs/react-native 2.0.5 (2026-05-19).
- react-native-webgpu docs (repo `apps/docs/content/docs/...`): installation, expo, three-js,
  react-three-fiber, worklets, native-api — https://github.com/wcandillon/react-native-webgpu ,
  https://wcandillon.github.io/react-native-webgpu/
- Expo template on SDK 57: https://github.com/wcandillon/react-native-webgpu/tree/main/apps/expo-webgpu
- react-native-webgpu issues: #407 Android crash when configuring context (2026-07-04, open)
  https://github.com/wcandillon/react-native-webgpu/issues/407 ; #455 GPUDevice shared between runtimes
  (2026-08-27) https://github.com/wcandillon/react-native-webgpu/issues/455 ; #333 shadow crash
  (2026-03-11) https://github.com/wcandillon/react-native-webgpu/issues/333 ; #82 file URL fetch
  https://github.com/wcandillon/react-native-webgpu/issues/82 ; #444 FIFO present mode (2026-08-14).
- InstancedMesh/Hermes destructuring: https://github.com/react/react-native/issues/57934 (2026-08-13,
  open), https://github.com/mrdoob/three.js/issues/34227 (open), fix PR
  https://github.com/mrdoob/three.js/pull/34308 (open); `babel-preset-expo@57.0.7`
  `build/configs/hermes-v0.js` vs `hermes-v1.js` (read from tarball).
- R3F native: #3399 new-arch blank (2024-11-21, closed by PR #3539 merged 2025-06-29)
  https://github.com/pmndrs/react-three-fiber/issues/3399 ; #3517 "React Native is no longer supported"
  (2025-04-17) https://github.com/pmndrs/react-three-fiber/issues/3517 ; #3583 loader Base64 fixed in
  9.4.2 ; #3782 async gl factory double-invoke (2026-07-13, open)
  https://github.com/pmndrs/react-three-fiber/issues/3782 ; pmndrs/native README (last push 2026-01-25)
  https://github.com/pmndrs/native ; R3F 9.8.1 `native/dist/react-three-fiber-native.cjs.dev.js` (tarball).
- expo-gl CHANGELOG: https://github.com/expo/expo/blob/main/packages/expo-gl/CHANGELOG.md ;
  `src/GLWorkletContextManager.ts` (tarball 57.0.2).
- Skia: Graphite view + installation docs (repo `apps/docs/docs/canvas/graphite.md`,
  `getting-started/installation.md`) https://shopify.github.io/react-native-skia/
- Filament: https://github.com/margelo/react-native-filament (releases, issues list 2025-10 → 2026-09).
- Babylon RN README: https://github.com/BabylonJS/BabylonReactNative
- Expo SDK 57 changelog: https://expo.dev/changelog/sdk-57
