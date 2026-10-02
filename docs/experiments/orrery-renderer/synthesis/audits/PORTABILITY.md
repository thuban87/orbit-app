# Orrery V2 — Cross-platform portability (web, iOS)

Date: 2026-10-02. Scope: A = Skia 2.5D imperative (Labs A/B), B = three.js 0.186.1 WebGPURenderer on react-native-webgpu 0.10.4 (Lab C).
Method: read the installed package sources in `orbit-app` / labs `node_modules`, `npm view` for release data, Context7 docs, and web sources. "Verified-src" means I read it in the installed source. "Unverified" means I could not confirm it.

## 0. Baseline — what is installed and what the labs actually call

| Item | Value | Source |
|---|---|---|
| Expo / RN | expo ~57.0.13, react-native 0.86.2 | `orbit-app/package.json` |
| Skia | `@shopify/react-native-skia` 2.6.2 (published 2026-04-04), Ganesh, `canvaskit-wasm` 0.41.0 for web | package.json, npm |
| Reanimated / worklets / RNGH | 4.5.1 / 0.10.4 / ~2.32.0 (Expo 57 pins worklets 0.10.1) | node_modules, `expo/bundledNativeModules.json` |
| web config | `app.json` has only `web.favicon`. `react-native-web` and `react-dom` are **not installed**, so web has never been built | app.json, node_modules |
| Lab A APIs (`lab/`) | `createPicture` ×10, `<Picture>` ×7, `drawPicture`, `Skia.MakeVertices`/`drawVertices` ×4, `makeShader` ×9 on `Skia.RuntimeEffect.Make` (cached in `deep-field-shaders.ts`), `Skia.Surface.MakeOffscreen` + `makeImageSnapshot` (base-texture bake, `LabScene.tsx:419–433`), `Skia.Image.MakeImage(Data.fromBytes)` (CPU nebula, `nebula-bake.ts:218`), `Skia.ParagraphBuilder`, `runOnUI`, `opaque` | grep |
| Lab B APIs (`labb/`) | `Skia.PictureRecorder` ×15 inside `useDerivedValue` (UI-thread recording, e.g. `LabRings.tsx:505`), `makeShader`/`makeShaderWithChildren`, the ring field as an RGBA8 data texture via `Image.MakeImage` (`LabRingField.tsx:102`), `matchFont(…, fontProvider)` (`LabBodies.tsx:111`), `useFrameCallback`, `PixelRatio.get()`, `<Canvas opaque={flags.opaqueCanvas}>` (`LabCanvas.tsx:202`) | grep |
| SkSL precision | Lab A: 34 `half` / 47 `half4` alongside `float`. Lab B: 16 `half` / 56 `half4`. Fixed 5-iteration loops, no uniform arrays, no `fwidth`/`dFdx` | grep `deep-field-shaders.ts`, `labb-effects.ts` |
| Lab C | `Canvas` from `react-native-webgpu`, `three/webgpu` + `three/tsl`. Lab C creates its own device (`navigator.gpu.requestAdapter` in `three/orrery-gpu.ts:50`), adds a Hermes `TextDecoder` shim and a `device.queue` pin hack, and runs a JS-thread `requestAnimationFrame` loop with `context.present()` (`OrreryWorld3D.tsx:1106,1140`). **It still uses Skia** for the label and photo atlas (Paragraph → `makeImageSnapshot` → readPixels, `three/orrery-textures3d.ts`) | grep |

## 1. Web

### 1A. Skia 2.5D on web (CanvasKit)

| Topic | Finding |
|---|---|
| Loader | `LoadSkiaWeb` / `WithSkiaWeb` import `canvaskit-wasm/bin/full/canvaskit` (verified-src `src/web/LoadSkiaWeb.tsx`). Expo setup: `npx setup-skia-web` copies the wasm to `public/`, and is re-run on every Skia upgrade. Load Skia before the app registers (`index.web.tsx` → `LoadSkiaWeb().then(renderRootComponent)`) or code-split the orrery with `WithSkiaWeb`. Docs: <https://wcandillon.github.io/react-native-skia/docs/getting-started/web> (fetched 2026-10-02). |
| **Local-first** | The documented CDN option (`locateFile` → jsdelivr) puts a network fetch on the dashboard read path, which violates CLAUDE.md. **Self-host the wasm.** A PWA or service-worker cache is needed for a true offline first load. |
| Size / load | `bin/full/canvaskit.wasm` is **8.08 MB raw and 3.25 MB gzip** (measured on 0.41.0). The docs say "2.9MB when gzipped". The JS glue is about 120 KB. Expect roughly 0.3–1 s compile on desktop after download, and several seconds on mid-range mobile on first load (estimate, unverified). This is a one-time cost per session if cached. |
| RuntimeEffect / SkSL | Works: `RuntimeEffect: new JsiSkRuntimeEffectFactory` (verified-src `skia/web/JsiSkia.ts:120`). The backend is **Ganesh on WebGL2**, so SkSL is compiled to GLSL ES 3.0. `Skia.RuntimeShaderBuilder` **throws on web** (`JsiSkia.ts:55`). The labs use `effect.makeShader*`, which is fine. `half` → `mediump`. Desktop GPUs run mediump at fp32, so precision bugs hide on desktop and reappear in mobile browsers. |
| Pictures | `PictureRecorder` / `createPicture` / `drawPicture` work. `ImageFilter.MakePicture` throws on web (verified-src). The labs don't use it. |
| Vertices | `MakeVertices` / `drawVertices` are implemented (`JsiSkCanvas.ts:193`). The perspective-homography path is Ganesh-GL on both Android and web, so behaviour should match. Unverified on web. |
| Offscreen bake | `Surface.MakeOffscreen` on web creates a **new `OffscreenCanvas` + a separate WebGL context** (`JsiSkSurfaceFactory.ts:20–32`). A texture-backed `SkImage` snapshotted there likely cannot be drawn into the main canvas's context. Lab A's base-texture bake (`LabScene.tsx:419–433`) would need `makeNonTextureImage()` or a raster `Surface.Make`. Likely, unverified. |
| CPU nebula | `Image.MakeImage(info, Data.fromBytes)` is implemented on web (`JsiSkImageFactory.ts:86`). Portable as-is. |
| Paragraph / fonts | `ParagraphBuilder.Make` **requires a `TypefaceFontProvider` on web** and throws without one (`JsiSkParagraphBuilderFactory.ts:30`). `FontMgr.System()` returns an empty provider, so there are **no system fonts and no OS fallback**. Contact names in CJK, Arabic, Devanagari, emoji and so on will tofu unless fallback fonts are bundled (several MB). `matchFont(…, provider)` → `TypefaceFontProvider.matchFamilyStyle` **throws on web** (verified-src). Lab B's `useInitialsFont` catches it and returns `null`, so initials silently disappear on web. Use `Skia.Typeface.MakeFreeTypeFaceFromData` + `Skia.Font` instead. `useFonts` works (it fetches the asset URL). |
| `opaque` | **Ignored on web.** `SkiaPictureView.web.tsx` never reads it, and every frame does `canvas.clear(transparent)` (lines 74–76). There is no SurfaceView-style win. The browser composites the canvas like any other element. |
| onSize / pixel ratio | `pd = Platform.PixelRatio` = `window.devicePixelRatio`, **read once at module load** (`SkiaPictureView.web.tsx:219`, `Platform.web.tsx:133`). The backing store is `clientWidth*pd` on layout. Browser zoom or a move to another monitor will not update DPR, so it needs a `matchMedia('(resolution…)')` listener plus a remount. Lab B's `PixelRatio.get()` comes from RN-web and has the same snapshot semantics. |
| Contexts | Each `<Canvas>` = one WebGL2 context, and browsers cap live contexts at about 16 (`__destroyWebGLContextAfterRender` exists for static canvases). The candidate's small, stable Canvas tree is the right shape. Do not add per-row Skia canvases on web. |
| Known bug | "Resolved React Native Web framerate issues" shipped in **2.11.2 (2026-09-01)**. 2.6.2 predates it, so web requires the Skia upgrade (GitHub releases, fetched 2026-10-02: <https://github.com/Shopify/react-native-skia/releases>). |
| Unsupported list (docs) | `PathEffect.MakeSum/MakeCompose`, `Path.MakeFromText`, `ShaderFilter`. Many `ImageFilter.Make*` also throw in source (19 stubs in `JsiSkImageFilterFactory.ts`). Audit the bloom and blur paths (`labBloomPaint`, `ImageFilter.MakeBlur`/`MakeBlend` used in app code) on web. |

### 1A. Reanimated and worklets on web

| Topic | Finding |
|---|---|
| Threading | "There's no separate UI thread available on the Web… worklets are resolved to plain JavaScript functions" (Reanimated docs, Context7 `/websites/swmansion_react-native-reanimated`, guides/worklets). The `'worklet'` directive and Babel plugin are still required. |
| UI-thread picture recording | `useDerivedValue(() => PictureRecorder…)` runs on the **browser main thread** in the Reanimated mapper. That is the same thread as React, RN-web layout, gesture events and the CanvasKit flush. The camera frame, choreography and recording all serialize there. `runOnUI(fn)()` just schedules on the same thread. Correctness ports. The isolation the native design relies on does not exist on web. |
| `useFrameCallback` | rAF-driven. Works. |
| Mitigation | Keep recording cheap and allocation-free. Gate on dirty flags, which the imperative design already wants. A web-only option would move rendering to a Worker with `OffscreenCanvas` + a second CanvasKit instance. That is a large rewrite (estimate). |

### 1A. Performance expectation (web, Skia)

Every Skia call is JS → wasm with object marshalling (`Float32Array`s, paints), so per-draw-call cost is higher than JSI on Hermes. Lab A measured about 8–10 ms on the Pixel main thread per camera frame (`lab-a-production-skia/PRODUCTIONIZATION.md` P2). Expectations, all unverified estimates:
- **Desktop Chrome/Safari:** 60 fps is plausible if per-frame draw calls stay in the low hundreds. The fragment-bound Mali issues mostly vanish on desktop GPUs.
- **Mobile browsers:** worse than native, because the JS, gesture and render work share one thread. Plan a reduced-effects tier (no bloom, static sky).
- SkSL compile happens at first use, so warm the effects behind a loader.

### 1B. three.js WebGPU on web

| Topic | Finding |
|---|---|
| react-native-webgpu web path | `WebGPUViewNativeComponent.web.ts` renders a plain DOM `<canvas>` and `getContext('webgpu')` goes to the **browser's native WebGPU**. Dawn is not involved on web (verified-src). Its `opaque` defaults to `true` on web and paints a **white** background (`backgroundColor: "white"`). Pass `opaque={false}` or style it. `androidSurfaceType` is ignored. |
| Browser WebGPU | Chrome/Edge desktop, Chrome Android 121+ (Android 12+, Qualcomm/ARM), Safari 26 (macOS/iOS/iPadOS 26), and Firefox 141+ on Windows (macOS ARM from 145). Firefox Linux and Android are still in progress (Wikipedia/WebGPU and web.dev, fetched 2026-10-02: <https://en.wikipedia.org/wiki/WebGPU>, <https://web.dev/blog/webgpu-supported-major-browsers>). Reported Baseline in Jan 2026 (unverified secondary: <https://www.webgpu.com/news/webgpu-hits-critical-mass-all-major-browsers/>). |
| Fallback | `WebGPURenderer` auto-falls back to a **WebGL2 backend**, and TSL transpiles to GLSL. `forceWebGL: true` forces it (three.js docs via Context7 `/mrdoob/three.js`, `manual/pages/webgpurenderer.html`). **Lab C bypasses the fallback**: it calls `navigator.gpu.requestAdapter()` itself and throws "No GPUAdapter" (`orrery-gpu.ts:50–53`). The web build needs a code path that lets three own the backend, or a `forceWebGL` branch on a WebGL canvas. |
| Size | `three.webgpu.js` + `three.core.js` ≈ **0.73 MB gzip** unminified (measured). Lab C also needs Skia for labels, so the web total is about **4 MB gzip (CanvasKit + three)**. That is worse than A. |
| Perf | Rendering is GPU-side with a small number of draw calls, so it is the stronger web performance story when WebGPU is present. The WebGL2 fallback is slower and loses compute features. The JS rAF loop is already main-thread on native, so web behaviour is similar. |

## 2. iOS

### 2A. Skia on iOS

| Topic | Finding |
|---|---|
| Backend today | 2.6.2 = **Ganesh on Metal** (`apple/MetalContext.mm`, `MetalWindowContext.mm`). In 2.x, Graphite was "highly experimental… not recommended for production" on `@next` (Context7 README). 2.13.0 (2026-09-24) fixed `GrContextOptions` for the Metal direct context. |
| **Graphite v3 — new today** | On **2026-10-02** the unscoped npm package **`react-native-skia` 3.0.0/3.0.1** shipped from `wcandillon/react-native-skia` (a fork of Shopify's). It is "Graphite… minSDK 26 on Android and… Vulkan instead of OpenGL" (<https://github.com/wcandillon/react-native-skia/releases/tag/v3.0.0>). Its deps are `react-native-skia-graphite-{android,apple-ios,apple-macos}` 154.0.1, and tvOS was dropped. `@shopify/react-native-skia` is still at 2.14.0 (2026-10-01, Ganesh, Skia m154). Whether the Shopify-scoped line continues long-term is **unverified**. iOS v3 = Graphite on Dawn → Metal (inferred from Dawn headers in the 3.0.1 tarball, unverified). |
| SkSL precision | Ganesh-Metal emits MSL. `float` = fp32 and `half` = **real fp16 on Apple GPUs**, the same effective precision as Mali mediump. The "mediump-safe" choices (no hash/fbm, trig granulation, CPU-baked nebula) carry over. Expect fewer artifacts than on Mali, not more. Risk: `half`-accumulated values >65504 or tiny epsilons. Audit the `half` usages in the ring/plane shaders. No derivative intrinsics are used, which avoids a common Metal/GL divergence. |
| `opaque` on iOS | **No-op.** `SkiaUIView setOpaque:` only stores `_opaque`, which nothing reads. `CAMetalLayer.opaque` is hard-coded `false` (`MetalWindowContext.mm:19`). The same holds in 3.0.1 (`MetalWindowContext.mm:21`, `SkiaUIView.mm:133`). iOS has no hole-punch/TextureView split: a `CAMetalLayer` is always composited by Core Animation. The Android SurfaceView gain has no iOS counterpart. The upside is that none of the SurfaceView costs apply either: clipping, transforms and z-order behave normally, there is no 120 Hz pinned-panel idle-CPU issue, and there are no extra EGL buffers. |
| Frame rate | ProMotion devices need `CADisableMinimumFrameDurationOnPhone` in Info.plist for 120 Hz. Reanimated's frame loop follows the display link (verify). Standard Expo config-plugin territory. |
| Fonts | iOS has a system font manager. Paragraph fallback for non-Latin names works natively (unverified for TypefaceFontProvider + fallback combinations). |

### 2B. react-native-webgpu on iOS

| Topic | Finding |
|---|---|
| Stack | Dawn (`dawn: chrome-m154`, commit `3d786993`) → Metal. Ships a prebuilt `libwebgpu_dawn.xcframework`: `libs/apple` is **109 MB** on disk (Android 66 MB across 4 ABIs). Expect a noticeably larger IPA. Size delta unverified. |
| Platforms | "iOS, Android, macOS, and visionOS using Dawn". New Architecture only. RN ≥0.81. Worklets optional, for off-thread rendering (<https://wcandillon.github.io/react-native-webgpu/docs/getting-started/installation>, fetched 2026-10-02). |
| Expo | Has an `app.plugin.js` config plugin. It disables Metal API Validation for the simulator on every prebuild. CocoaPods by default, SwiftPM needs RN 0.87+ (v0.10.2, 2026-09-16). No Expo Go. Custom dev client and prebuild, which Orbit already does. |
| Maturity | Renamed from `react-native-wgpu` (npm deprecation: "renamed to react-native-webgpu"). The new name was created 2026-05-08, with **19 releases from 0.5.11 → 0.10.4 between May and Sept 2026**. It is still 0.x and has had perf hacks (Lab C's `device.queue` pin and `TextDecoder` shim). iOS on-device behaviour was not tested by any lab. **Unverified.** |

## 3. Platform-specific code each architecture needs

| Layer | A: Skia 2.5D | B: three/WebGPU |
|---|---|---|
| Renderer host | Android: `opaque` + `android={{surfaceType}}` (2.13+). iOS: nothing. Web: CanvasKit loader gate, DPR listener, no `MakeOffscreen` cross-context images | Android: `androidSurfaceType`. iOS: none. Web: let three own adapter/backend + `forceWebGL` fallback, drop the Hermes shims, pass `opaque={false}` |
| Render loop | One shared code path on native. On web the worklets are just functions, so the code is the same but the thread budget differs. Needs an effects tier switch | JS rAF on all three. `context.present()` is native-only (a no-op stub on web, unverified) |
| Gestures | RNGH Pan/Pinch/Rotation/Tap port to iOS. Web adds **mouse wheel / ctrl+wheel (trackpad pinch)**. No RNGH wheel gesture was found in the docs, so it needs a DOM `wheel` listener with `{passive:false}`, plus `enableTrackpadTwoFingerGesture` on Pan (iOS/Web) and `activeCursor`. Hover is optional. Same for B | Same input work as A |
| Assets | Self-hosted `canvaskit.wasm` and bundled fonts, including **fallback fonts on web**. Photos via `Data.fromURI` work on all | Same, plus the three bundle, plus Dawn binaries on native |
| Shaders | One SkSL source. The Mali/Ganesh workarounds (geometry-avoidance under homography, band strips, CPU nebula) are harmless elsewhere but encode Android tuning. Graphite v3 changes the Android backend (Vulkan), which **invalidates the Lab perf numbers** | TSL → WGSL (native and web) or GLSL (WebGL2 fallback). Portable by design |
| Text | Native: Paragraph + provider. Web: provider is mandatory, no `matchFont`, bundle fallback fonts | Still Skia Paragraph → atlas readback, so B inherits all of A's text issues **plus** readPixels cost |
| Accessibility | The canvas is opaque to screen readers on every platform. Keep the companion RN layer (the app already has 27 `accessibilityLabel` uses in `orrery/`). RN-web maps these to ARIA (`aria-label`, role). RN-web 0.19+ prefers `aria-*` props over `accessibility*` (unverified for 0.21 deprecation status). TalkBack ↔ VoiceOver: test `accessibilityActions`/focus order separately. Web needs keyboard navigation (tab/arrow) with no native analogue | Identical |

## 4. Dependency maturity and risk (npm `time`, fetched 2026-10-02)

| Package | In app | Latest | Cadence / signals | Risk |
|---|---|---|---|---|
| `@shopify/react-native-skia` | 2.6.2 (Apr 2026) | 2.14.0 (2026-10-01) | 8 minors in 6 months. 2.13.0 removed legacy-arch support and added `android.surfaceType`. 2.14.0 deprecated the mutable SkPath API | Med. Lab A lists the APIs that must be re-verified on any upgrade (`drawVertices` under perspective, `opaque`→SurfaceView, offscreen thread ownership) |
| `react-native-skia` (unscoped, new) | — | 3.0.1 (2026-10-02) | Graphite default. Same author (wcandillon). Fork repo with 64 stars | **High uncertainty.** A package rename/fork plus a backend switch landed today. The future of the Ganesh line is unverified |
| `react-native-reanimated` | 4.5.1 | 4.7.1 (2026-10-02). Peer RN 0.86–0.88, worklets 0.13.x | Monthly minors | Low–Med |
| `react-native-worklets` | 0.10.4 (npm tag `legacy`) | 0.13.0 | 0.10.x is now the legacy line | Med. The bump is coupled to Reanimated 4.7 |
| `react-native-gesture-handler` | ~2.32.0 (2.33.0 = `legacy`) | 3.3.0 | v3 is a hook API (`usePanGesture`) replacing the `Gesture.Pan()` builder (upgrading-to-3 docs) | **Med–High churn.** Orrery gestures use the builder API (`Gesture.Race/Simultaneous/Pan/Pinch/Rotation/Tap`) |
| Expo SDK | 57 (latest 57.0.26) | SDK 58 `next` 58.0.2 (2026-10-01) bundles Skia **2.13.1**, Reanimated 4.7.0, worklets 0.13.0, RNGH **~3.2.1**, RN 0.88.0-rc.3 | Expo already tracks the new Skia and RNGH 3 | The SDK 58 bump forces the RNGH 3 and worklets 0.13 migration for both architectures |
| `react-native-webgpu` | — (Lab C 0.10.4) | 0.10.4 (2026-09-29) | Renamed from `react-native-wgpu` in May 2026. 19 releases in about 5 months. 0.x. Not in Expo's bundled modules | **High** |
| `three` | — (Lab C 0.186.1) | 0.186.1 (2026-09-24) | Monthly, with a history of breaking minors (WebGPU/TSL API still moving) | Med |
| `canvaskit-wasm` | 0.41.0 (pinned by Skia) | 0.42.0 (2026-08-18) | Google-maintained | Low |

**Bus factor:** RN-Skia and react-native-webgpu are both centred on **William Candillon**. The rename and fork pattern (`react-native-wgpu`→`react-native-webgpu`, `@shopify/react-native-skia`→`react-native-skia` 3.x) has now happened to both. B adds a second single-maintainer native dependency on top of A's. Reanimated, worklets and RNGH are Software Mansion: a company, a lower bus-factor risk, but higher API churn.

## 5. Shared-code estimate

Lab B measurement (non-test `orrery|labb` files): about 28.8k lines total. About **10.7k lines** have no RN/Skia/Reanimated imports. About **13.8k lines** import Skia, and 0.9k of those are debug panels.

| Layer | A | B |
|---|---|---|
| Scene/world model (`services/orrery-scene.ts`, `db/orrery-system-read.ts`), frame (`logic/orrery-frame.ts`), camera math (`logic/orrery-camera-logic.ts`), choreography (`logic/orrery-switch-choreography.ts`), label allocation, focus/ring/plane math (`labb-*-logic.ts`, `labb-plane-ellipse.ts`) | **Portable as-is**: plain TS, with `'worklet'` directives that are harmless on web | Same, plus a mapping from the 2.5D homography to a real camera |
| SkSL sources + uniform packing | Portable (one source). Web/iOS precision audit needed | n/a (TSL, portable) |
| Picture recording / draw modules (`LabRings*`, `LabLayerPictures`, `LabEnvironment`, `LabBodies`) | ~95% shared. Web: font, offscreen and image-filter exceptions | Replaced by a three scene graph (~2.9k lines in Lab C), shared across platforms |
| Canvas host, surface flags, DPR, loader | Per platform, but small (~100–300 lines each, estimate) | Per platform, small, plus a web fallback branch |
| Gestures | Shared RNGH plus a web wheel/trackpad adapter | Same |
| A11y companion layer | Shared RN, with per-platform QA | Same |

Rough estimate: **A ≈ 90–95% shared**, with the per-platform work concentrated in a thin host/adapter layer plus web fonts. **B ≈ 90% shared on paper**, but it carries Skia (for text) and WebGPU, so it has two GPU stacks to port and verify.

## 6. Future platform debt — verdicts

**A: Skia 2.5D imperative — portable with moderate, well-bounded debt.**
- iOS: low risk. Same API, Metal backend, `opaque` is a harmless no-op, precision is equal to or better than Mali.
- Web: works, but costs 3.25 MB of wasm, a single thread, mandatory bundled fonts including non-Latin fallbacks, and a changed offscreen-bake path. A reduced-effects tier is needed.
- Biggest risk is **backend churn, not portability**: Graphite v3 (Vulkan on Android, Dawn) and the package rename landed today. The Mali/Ganesh-GL perf tuning may not survive it.

**B: three.js WebGPU — best ceiling on desktop web, highest dependency and debt risk.**
- Native depends on a 0.x, recently renamed, single-maintainer Dawn binding (109 MB iOS framework, untested on iOS).
- Web needs a WebGL2 fallback branch that Lab C currently defeats.
- It still depends on Skia for text, so it inherits every A web issue.

**Android-only choices to isolate behind an interface (`OrreryRenderHost` / `PlatformRenderCaps`):**

| Choice | Why isolate |
|---|---|
| `opaque` → SurfaceView (+ `android.surfaceType`, `zOrderOnTop`) | No-op on iOS and web. Hole-punch semantics (no clip/transform/z-order) are Android-only. Lab A's idle-CPU (120 Hz panel) and +29 MB EGL costs are Android-only |
| Proposed `Surface.setFrameRate(30)` patch (Lab A §6) | A native Android patch. iOS uses `CADisplayLink.preferredFrameRateRange`; web has no control |
| Mali-G78 workarounds: geometry-avoidance under homography, ring field as data texture, band strips, half-res base texture, CPU nebula (the CPU nebula is fine to keep everywhere) | Encode Ganesh-GLES/Mali costs. Make them **capability flags**, not structure, so Graphite/Vulkan, Metal and desktop WebGL can re-tune |
| Offscreen base-texture bake (`MakeOffscreen` + snapshot) | Thread and context ownership differs on web (separate WebGL context) and under Graphite |
| `matchFont` / system-font assumptions | Throws on web. Route all text through one `OrreryTextService` that owns the `TypefaceFontProvider` + fallbacks |
| `PixelRatio.get()` snapshots | Web DPR changes at runtime |
| Image-filter bloom/blur | Partially stubbed on web |
| (B) `TextDecoder` shim, `device.queue` pin, explicit adapter request | Hermes/react-native-webgpu-specific. Breaks three's web fallback |

## Sources (all fetched 2026-10-02)
- RN-Skia web docs: <https://wcandillon.github.io/react-native-skia/docs/getting-started/web> (shopify.github.io redirects here). Canvas Android options: Context7 `/shopify/react-native-skia` `apps/docs/docs/canvas/canvas.md`.
- RN-Skia releases: <https://github.com/Shopify/react-native-skia/releases>. Graphite v3: <https://github.com/wcandillon/react-native-skia/releases/tag/v3.0.0>. Fork repo: <https://github.com/wcandillon/react-native-skia>.
- react-native-webgpu install: <https://wcandillon.github.io/react-native-webgpu/docs/getting-started/installation>. Releases: <https://github.com/wcandillon/react-native-webgpu/releases/tag/v0.10.4>.
- Reanimated worklets on web: <https://docs.swmansion.com/react-native-reanimated/docs/guides/worklets>.
- RNGH v3 upgrade, trackpad, hover: Context7 `/software-mansion/react-native-gesture-handler` (`guides/upgrading-to-3.mdx`, `use-pan-gesture.mdx`, `use-hover-gesture.mdx`).
- three WebGPURenderer fallback: Context7 `/mrdoob/three.js` (`manual/pages/webgpurenderer.html`, `docs/pages/WebGPURenderer.html`).
- WebGPU browser status: <https://en.wikipedia.org/wiki/WebGPU>, <https://web.dev/blog/webgpu-supported-major-browsers>, <https://github.com/gpuweb/gpuweb/wiki/Implementation-Status>.
- npm registry (`npm view … time/dist-tags/dependencies`) for every version and date in §4. Expo SDK 58 `bundledNativeModules.json` from `expo@58.0.2`.
- Installed sources: `orbit-app/node_modules/@shopify/react-native-skia/src/{web,views,skia/web}`, `apple/*.mm`. `orbit-orrery-lab-c/node_modules/react-native-webgpu/src/*.web.ts`. The `react-native-skia@3.0.1` tarball.
