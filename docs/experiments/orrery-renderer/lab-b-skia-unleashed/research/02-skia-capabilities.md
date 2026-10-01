# Lab B research 02 — React Native Skia capability catalogue (this repo's versions)

Status: research, read-only. Date: 2026-10-01. Branch `experiment/orrery-skia-unleashed`.

Method: every API below was confirmed against the **installed package source** (`@shopify/react-native-skia/src/**`), not only the docs. Note: this lab checkout has no `node_modules`; its `package.json` is byte-identical to the main checkout's HEAD `package.json`, so the main checkout's installed tree (`~/projects/orbit-app/node_modules`) was **read** (not modified) as the installed reference. Context7 (`/websites/shopify_github_io_react-native-skia`) and the official Canvas docs were used for perf guidance. No perf number in this doc was measured on device; all cost classes are reasoned estimates and must be validated on the physical Pixel (never the desktop emulator).

---

## 1. Versions and runtime

| Thing | Version / status | Source |
|---|---|---|
| `@shopify/react-native-skia` | **2.6.2** (exact pin) | package.json + installed package.json |
| `react-native-reanimated` | **4.5.1** | installed |
| `react-native-worklets` | **0.10.4** (transitive; Babel plugin `react-native-worklets/plugin` is wired directly in `babel.config.js`, last) | installed + babel.config.js |
| `react-native-gesture-handler` | **2.32.0** (`~2.32.0`) | installed |
| `expo` | **57.0.13** (SDK 57) | installed |
| `react-native` | **0.86.2** | installed |
| `react` | 19.2.3 | package.json |
| JS engine | Hermes (Expo default; no `jsEngine` override in app.json). RN ships `hermes-compiler 250829098.0.16` and `sdks/.hermesv1version` (Hermes V1 series) | RN package.json |
| New Architecture | On — mandatory on RN ≥ 0.82; Skia's `Canvas` actively rejects `onLayout` under Fabric | `renderer/Canvas.tsx` |
| Skia GPU backend | **Ganesh (OpenGL)**, not Graphite — `libs/.graphite` marker absent; Graphite needs `SK_GRAPHITE=1` reinstall | `android/build.gradle:62-66` |
| Native project | CNG (no `android/` dir checked in; prebuild) | repo |

Implication of Ganesh: runtime-effect programs are compiled to GLSL on first use (first-use hitch), and the `ReanimatedRecorder` comment warns GPU resources must be owned by the UI thread ("It will crash otherwise on Ganesh").

---

## 2. How drawing actually works in 2.6.2 (read from source — this decides every cost class)

`src/sksg/Container.native.ts`:

1. On any **React** change, the whole Skia tree is re-visited on the JS thread into a native `JsiRecorder` command list (`visit(recorder, root)`), and every SharedValue found in props is collected.
2. A single Reanimated **mapper** is started over *all* collected SharedValues. Whenever *any* of them changes, on the UI thread it runs `sharedRecorder.applyUpdates(sharedValues)` then `recorder.play(picture)` — i.e. it **re-plays the entire Canvas command list** into an `SkPicture` and hands it to the native view.

Consequences:

- Per-frame cost ≈ (number of draw commands in the whole Canvas) + (cost of whatever the GPU must do for them). Animating one tiny value replays everything. There is no per-subtree dirty tracking.
- React re-renders are the expensive path (JS visit + re-record). Animation must be SharedValues only — already the project rule.
- A `<Picture picture={derivedValue}>` whose derived value re-records each frame adds JS-on-UI-worklet recording cost on top.
- Mutating a Skia object in place inside a SharedValue (buffers, PathBuilder) does not notify on its own; Skia's helpers call `notifyChange()` (sets `_value`) — replicate this if you write custom buffers.

Canvas props (`renderer/Canvas.tsx`): `opaque`, `onSize: SharedValue<SkSize>`, `androidWarmup`, `debug`. Per the docs, `opaque` on Android selects **SurfaceView** (no extra copy, one frame less latency) vs default **TextureView** (one extra copy + one frame latency). The orrery has a full-bleed `<Fill>` background, so `opaque` is a free win candidate — verify RN overlays/gestures still composite correctly above a SurfaceView. `androidWarmup` is documented as only safe for static/opaque content; not for us.

---

## 3. API inventory confirmed in 2.6.2

| Capability | Exists? | Exact API (file) |
|---|---|---|
| Runtime shaders | Yes | `Skia.RuntimeEffect.Make(sksl): SkRuntimeEffect \| null` (`skia/types/RuntimeEffect/RuntimeEffectFactory.ts`); `<Shader source uniforms>` with child shaders as children (`renderer/components/shaders/Shader.tsx`); `effect.makeShader(number[])`, `makeShaderWithChildren` |
| Uniforms from SharedValues | Yes | `uniforms` is an animatable prop → pass `useDerivedValue(() => ({ uTime, uRes }))` |
| Runtime shader **image filter** (post-process the layer) | Yes | `<RuntimeShader source uniforms>` inside `layer`/`<Paint>` imageFilter (`imageFilters/RuntimeShader.tsx`); imperative `Skia.ImageFilter.MakeRuntimeShader` / `MakeRuntimeShaderWithChildren` |
| Atlas sprites | Yes | `<Atlas image sprites transforms colors? colorBlendMode? sampling?>` (`dom/types/Drawings.ts:67`) |
| Animated sprite buffers | Yes | `useRSXformBuffer(n, (xf, i) => {"worklet"; xf.set(scos, ssin, tx, ty)})`, `useRectBuffer`, `usePointBuffer`, `useColorBuffer` (`external/reanimated/buffers.ts`) — implemented as a mapper that rewrites the whole array and calls `notifyChange` |
| Textures on UI thread | Yes | `useTexture(element, size, deps?)`, `usePictureAsTexture(picture, size)`, `useImageAsTexture(source)` (`external/reanimated/textures.tsx`) — all `runOnUI` + `Skia.Surface.MakeOffscreen` |
| Pictures | Yes | `Skia.PictureRecorder()`, `beginRecording(bounds)`, `finishRecordingAsPicture()`, `<Picture picture>`; `drawAsPicture(element, bounds)`; `SkPicture.makeShader(...)` (tile a cached picture as a shader) |
| Offscreen surfaces | Yes | `Skia.Surface.MakeOffscreen(w, h, {colorSpace?})` (GPU), `Skia.Surface.Make` (CPU); `drawAsImage(element, size)`, `drawAsImageFromPicture` (worklet) |
| Clock | Yes | `useClock()` = `useFrameCallback` writing `timeSinceFirstFrame` (ms) (`external/reanimated/interpolators.ts:57`) |
| Image filters | Yes | `<Blur blur mode>`, `<DisplacementMap channelX channelY scale>`, `<Morphology>`, `<Offset>`, `<Shadow>`, `<RuntimeShader>`; imperative also `MakeArithmetic`, `MakeMerge`, `MakeMagnifier`, `MakeMatrixConvolution`, `MakeTile`, lit diffuse/specular, `MakePicture`, `MakeImage`, `MakeCrop` |
| Mask filter blur | Yes | `<BlurMask blur style respectCTM>` — cheaper glow than an image-filter blur for single shapes |
| Blend modes | Yes | `blendMode` on any paint/Group (`plus`, `screen`, `colorDodge`, `multiply`, …); `<Blend mode>` for shaders; `Skia.Shader.MakeBlend` |
| Layers / saveLayer | Yes | `layer={true \| SkPaint \| <Paint>…</Paint>}` on `Group` (`dom/types/Common.ts:76`) |
| Backdrop filters | Yes | `<BackdropFilter filter>`, `<BackdropBlur blur>` |
| Vertices / mesh | Yes | `<Vertices vertices textures? colors? indices? mode blendMode?>`; `<Patch>` (Coons) |
| Path effects | Yes | `<DashPathEffect intervals phase>`, `<DiscretePathEffect>`, `<CornerPathEffect>`, `<Path1DPathEffect path advance phase style>`, `<Path2DPathEffect>`, `<Line2DPathEffect>`, `<SumPathEffect>` |
| Path trimming | Yes | `<Path path start end>` (0..1, animatable) + `SkPath.trim()`; `Skia.ContourMeasureIter` → `getPosTan(distance)` for placing particles along a path |
| Path building | Yes | `Skia.Path.Make()` (used in app) and `usePathValue(builder => …)` over `Skia.PathBuilder` |
| Built-in noise | Yes | `<FractalNoise freqX freqY octaves seed>`, `<Turbulence>`; `Skia.Shader.MakeFractalNoise/MakeTurbulence` (CPU-ish Perlin; can be cached into a texture) |
| Gradients | Yes | `<LinearGradient>`, `<RadialGradient>`, `<SweepGradient>`, `<TwoPointConicalGradient>` |
| Text | Yes | `<Paragraph>` + `Skia.ParagraphBuilder` (in use), `<Text>`, `<TextPath>`, `<Glyphs>`, `<TextBlob>` |
| Color filters | Yes | `<ColorMatrix>`, `<BlendColor>`, `<Lerp>`, `<LumaColorFilter>`, linear/sRGB gamma |
| Points | Yes | `<Points points mode>` — cheap for small star fields (animated via `usePointBuffer`) |
| Skottie (Lottie) | Yes | `<Skottie>` — prebaked animations (transitions) |

Not present: Graphite/WebGPU backend in this build (WebGPUCanvas exists in source but needs the Graphite libs); compute shaders; MRT/float render targets for real HDR bloom.

---

## 4. Current app usage of Skia (Orrery)

Files importing Skia: `src/components/orrery/{OrreryCanvas,OrreryWorld,OrbitBody,SunBody,SatelliteBody,Polaris,ProjectedOrbitRing,OrreryLabel,SystemPreviewCanvas}.tsx`, `use-orrery-photo.ts`, `src/screens/{OrreryScreen,SystemBuilderScreen,CropPhotoScreen}.tsx`.

APIs in use: `Canvas`, `Fill`, `Group` (transform/clip/zIndex/layer), `Circle`, `Path` + `DashPathEffect` (static `phase={0}`), `Image` (photo discs clipped by rrect), `Paragraph` + `ParagraphBuilder` (initials, labels), `Paint`, `useClock` (exactly one, in `OrreryCanvas`, shared via `OrreryClockContext`), `useImage`, `Skia.Image.MakeImageFromEncoded`, `Skia.Data.fromURI`, `Skia.Path.Make`.

**Not used anywhere:** `RuntimeEffect`/`Shader`, `Atlas`, `Picture`, offscreen surfaces/textures, image filters (`Blur`, `DisplacementMap`, `RuntimeShader`), `BlurMask`, blend modes, `Vertices`, gradients. Lab B is greenfield for every effect technique.

Patterns worth keeping / noting:
- All motion = `useDerivedValue` over one clock + projection SharedValues; reduced motion read live via `useReducedMotionShared()` (`src/theme/use-reduced-motion.ts:106`) inside worklets.
- Starfield = 44 `<Circle>` children under one Group whose opacity twinkles. Each star is a separate draw command replayed every frame.
- **Every body (`OrbitBody`, `SunBody`, `SatelliteBody`) uses `layer={derivedPaint}`** where the derived value allocates a new `Skia.Paint()` each frame just to set alpha. That is one **saveLayer per body per frame** plus a per-frame Paint allocation. Cheap at today's scale; it is the first thing that will bite when bodies get blur/glow children. Prefer `opacity` on the Group when children don't overlap, or cache one Paint.
- `OrreryLabel.tsx:1` records that Paragraph alpha must go through a real layer (Paragraph ignores Group opacity otherwise) — a known Skia quirk.
- `orrery-worklet-order.test.ts` statically guards the same-file worklet forward-reference crash for listed files; any new Lab B worklet module must be added to its `TARGETS` (or the orrery folder glob it covers).

---

## 5. Technique catalogue

Cost classes (per frame, mid-range Android GPU, full-screen ~1080×2400 unless noted):
- **C0** negligible (a few uniform/transform updates, < 0.3 ms)
- **C1** cheap (< ~1 ms GPU, few draw commands)
- **C2** moderate (1–3 ms; full-screen simple shader, or one blur on a small layer)
- **C3** heavy (3–8 ms; full-screen fbm with many octaves, large blurs, multiple saveLayers)
- **C4** budget-breaking on mid-range (> 8 ms; would need resolution scaling or caching)

16.6 ms is the 60 Hz budget; 8.3 ms at 120 Hz (Pixel 6 Pro). UI-thread JS (worklets + replay) and GPU are separate budgets; say which you measured.

### T1. Runtime-shader nebula (fbm noise, domain warp)

API: `Skia.RuntimeEffect.Make` + `<Fill><Shader source uniforms={u}/></Fill>`; uniforms from `useDerivedValue`.

```tsx
const nebula = Skia.RuntimeEffect.Make(`
uniform float2 uRes; uniform float uTime; uniform float2 uPan; uniform float uZoom;
uniform half3 cA; uniform half3 cB;        // theme tokens → vec3, never literals
float hash(float2 p){ return fract(sin(dot(p, float2(127.1,311.7)))*43758.5453); }
float noise(float2 p){ float2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(hash(i),hash(i+float2(1,0)),f.x), mix(hash(i+float2(0,1)),hash(i+1.),f.x), f.y); }
float fbm(float2 p){ float v=0., a=.5; for(int i=0;i<4;i++){ v+=a*noise(p); p*=2.02; a*=.5; } return v; }
half4 main(float2 xy){
  float2 p = (xy/uRes.y - .5)*uZoom*3. + uPan*0.15;   // parallax: nebula pans slower than world
  float2 q = float2(fbm(p + uTime*.01), fbm(p + 5.2));
  float n = fbm(p + 2.*q);
  half3 col = mix(cA, cB, half(n)) * half(smoothstep(.35, .9, n));
  return half4(col*0.6, 1);
}`)!; // module scope: compile once; null => SkSL error, must fall back
const u = useDerivedValue(() => ({ uRes: [w, h], uTime: (clock.value / 1000) % 1000,
  uPan: [pan.value.x, pan.value.y], uZoom: zoom.value, cA, cB }));
<Fill><Shader source={nebula} uniforms={u} /></Fill>
```

- Cost: 4-octave fbm with domain warp ≈ 3 fbm/pixel = ~12 noise evals → **C3 full-screen**, C2 with 3 octaves. Biggest cheap lever: **render the nebula at reduced resolution** — draw it into a ¼-size offscreen and scale up (nebula is low frequency; upscale is invisible). Or bake: when time doesn't need to move, render once to a texture (`usePictureAsTexture`) and only pan/zoom the image (C1).
- Reduced motion: `uTime` frozen (constant); pan parallax still follows the user's gesture (user-driven, not ambient), or bake to static texture.
- Risk: medium. SkSL compile hitch on first draw (tens–hundreds of ms on Ganesh/GL); `half` precision on Mali/Adreno (mediump) → banding and `sin(large)` garbage: keep time wrapped (`% 1000` s) and use `float` for coordinates/hash. SkSL is GLSL-ES-2-like: loops need constant bounds, no `while`, no dynamic array indexing.

### T2. Multi-depth parallax starfield

Option A — Atlas (best general answer):

```tsx
const starTex = useTexture(<Circle cx={4} cy={4} r={4}><RadialGradient c={vec(4,4)} r={4} colors={[core, transparent]}/></Circle>, {width: 8, height: 8});
const sprites = useMemo(() => stars.map(() => rect(0, 0, 8, 8)), [stars]); // static
const xforms = useRSXformBuffer(N, (xf, i) => { "worklet";
  const s = STARS[i];                     // plain array of numbers captured in closure
  const d = s.depth;                      // 0.1 far .. 1 near
  let x = (s.x - pan.value.x * d) % W; if (x < 0) x += W;
  let y = (s.y - pan.value.y * d) % H; if (y < 0) y += H;
  const sc = s.size * (1 + (zoom.value - 1) * d);
  xf.set(sc, 0, x, y); });
const colors = useColorBuffer(N, (c, i) => { "worklet"; /* twinkle alpha per star */ });
<Atlas image={starTex} sprites={sprites} transforms={xforms} colors={colors} colorBlendMode="dstIn" />
```

- Cost: GPU **C1** for thousands (single draw call). CPU: the buffer mapper loops N in a worklet each frame → ~500–2,000 stars is comfortable; 5,000+ starts to show on UI-thread time. Only re-run when pan/zoom/clock change.
- Option B — shader starfield (hash-grid per layer in one RuntimeEffect): GPU **C2** full-screen, zero CPU, infinite stars, perfect wrap. Combine with T1 in the *same* shader to save a full-screen pass.
- Option C — cheapest: bake each depth layer to a tiled texture once and draw 3 `ImageShader`s with `tx/ty="repeat"` and a translate matrix → **C1**, no per-star twinkle.
- Reduced motion: no twinkle (constant colors), parallax still tracks gestures.
- Risk: low. Watch `useColorBuffer` + `useRSXformBuffer` are separate mappers (two full-array loops).

### T3. Particle systems (sun corona sparks, interaction bursts)

API: Atlas + `useRSXformBuffer`/`useColorBuffer`, particle state in a SharedValue-held Float32Array updated in `useFrameCallback`; or stateless particles (position = f(seed, t)) computed directly in the RSXform worklet (no state, trivially resettable — preferred).

```tsx
const burst = useRSXformBuffer(P, (xf, i) => { "worklet";
  const t = (clock.value - burstStart.value) / 1000; if (t < 0 || t > 1.2) { xf.set(0,0,-99,-99); return; }
  const a = i * 2.399, v = 40 + (i % 7) * 12;      // golden-angle spread
  xf.set(1 - t*0.8, 0, cx + Math.cos(a)*v*t, cy + Math.sin(a)*v*t + 30*t*t); });
```

- Cost: **C1** up to ~1–2k live particles; additive (`blendMode="plus"` on the Atlas) for fire/energy look.
- Reduced motion: no ambient emitters; event bursts replaced by a single static flash/fade (opacity tween ≤ 200 ms) or omitted.
- Risk: low–medium. Fixed capacity (buffer size is a hook arg; changing it remaps). Avoid allocating objects per particle per frame.

### T4. Bloom / glow

Three tiers, cheapest first:
1. **Pre-baked glow sprite** (radial gradient texture) drawn under the body with `blendMode="plus"/"screen"` — **C0/C1**. The current SunBody "glow" circle is a flat-color version of this.
2. **`<BlurMask blur={r} style="normal"|"outer"/>`** on a circle/path — **C1–C2** depending on radius; analytic for circles/rrects in Skia, cheap.
3. **True bloom**: draw emissive elements into a layer with `<Blur>` image filter and composite with `plus`:
```tsx
<Group layer={<Paint blendMode="plus"><Blur blur={18} mode="decal"/></Paint>}>{emissives}</Group>
<Group>{emissives}</Group>
```
   Image-filter blur of a full-screen layer = saveLayer + separable Gaussian (downsampled internally for large sigma) → **C2–C3** per layer. Layer bounds matter: keep the blurred Group's content tight (or clip) so the layer isn't full-screen.
- Reduced motion: glow static (no pulse) — already the SunBody pattern.
- Risk: medium. Animated blur radius forces re-blur every frame; stacking several blurred layers is the classic Android perf cliff. Prefer tier 1/2 for per-body halos, tier 3 at most once (whole emissive pass).

### T5. Orbit energy flow along a path

A. Animated **dash phase** — `<DashPathEffect intervals={[2, 14]} phase={phaseSV}/>` with round caps and `blendMode="plus"`; phase = `(clock*speed) % sum(intervals)`. **C1** (dash re-evaluated each frame on CPU inside replay; fine for a few dozen orbits). Already 90% present (`ProjectedOrbitRing` uses a static dash).
B. **Trimmed comet segment**: `<Path path start={s} end={s+0.08}>` with a stroke `SweepGradient` → **C1**, but wrap-around across 0/1 needs two paths.
C. **Shader along ellipse**: orbit rings are ellipses after projection → in a RuntimeEffect compute the elliptical angle per pixel and modulate a flowing gradient; draw as the stroke shader of the ring path. **C1** (only stroke pixels shaded). Most beautiful; most work.
D. Sprites along path: `ContourMeasureIter(path).next().getPosTan(d)` in a worklet feeding an Atlas.
- Reduced motion: static dash/gradient (phase constant).
- Risk: low (A), medium (C — projection math duplicated in SkSL).

### T6. Trails (moving bodies, transitions)

- Ring-buffer of last K positions in a SharedValue → rebuild a `Skia.Path` each frame in `useDerivedValue` with tapered stroke (draw K segments or one path with a gradient shader), or `<Points mode="polygon">`. **C1** for K ≤ 32 per body, a few bodies.
- Picture re-record (`<Picture picture={derived}>`) for variable command counts (Context7 example) — **C1–C2**, but it's per-frame recording on the UI thread; use for ≤ hundreds of commands.
- "Persistence" trails (accumulate frames, fade) need ping-pong offscreen surfaces drawn from a worklet (`MakeOffscreen` + `makeImageSnapshot` each frame) → **C3**, GPU-sync risk; avoid.
- Reduced motion: no trails (bodies don't move ambiently anyway).
- Risk: low for path trails; high for feedback-buffer trails.

### T7. Atmospheric rim lighting on photo bodies

API: `<Shader>` with a child `<ImageShader image={photo} fit="cover" rect=…/>`, drawn as the fill of the body circle:
```sksl
uniform shader photo; uniform float2 c; uniform float r; uniform float2 lightDir; uniform half3 rim;
half4 main(float2 xy){ float2 d=(xy-c)/r; float l=length(d); if(l>1.) return half4(0);
  half4 base = photo.eval(xy);
  float n = sqrt(1.-l*l); float3 N = float3(d, n);
  float lambert = clamp(dot(N, normalize(float3(lightDir, .6))), 0., 1.);
  float fres = pow(1.-n, 3.);
  return half4(base.rgb*(0.35+0.65*lambert) + rim*fres, 1); }
```
plus an outer `BlurMask` halo in `rim` colour. Light direction = vector from body to sun (already known from projection).
- Cost: **C1** (only the disc pixels; bodies are small). Replaces the current `clip` + `Image` (clip with rrect is itself a stencil/AA cost) — likely a net win.
- Reduced motion: static (light direction only changes when bodies move; ambient motion is already gated).
- Risk: medium. One `<Shader>` per body with different `photo` child → one pipeline but separate draw; fine for tens of bodies. Image lifetime: keyed photo SkImages are owned by `useOrreryPhoto` (512 px cap, explicit disposal) — a disposed image referenced by the recorded command list would crash; keep disposal in sync with React unmount (existing pattern).
- Accessibility: darkened terminator must not hide the face — keep minimum light ≥ ~0.35.

### T8. Depth of field

- Cheap fake: per-body `BlurMask`/`Blur` image filter with sigma = f(|depth - focusDepth|), only on bodies far from focus. Per-body filters = per-body saveLayer → **C2–C3** with many bodies.
- Better: two passes — far bodies grouped into one layer with a single `<Blur>`; near/focus group sharp. **C2**.
- Reduced motion: static DoF fine (it's not motion), but avoid animating sigma.
- Risk: medium-high cost for modest value on a phone screen; blur on photo faces fights legibility. Low priority.

### T9. Lens flare / sun glare

- Additive sprites (Atlas or a few gradient circles) placed along the line from sun through screen centre, opacity from sun on-screen proximity; plus a `RuntimeEffect` streak (anamorphic) drawn in a small rect with `blendMode="plus"`. **C1**.
- Reduced motion: static flare tied to sun position (moves only with user pan).
- Risk: low technically; taste risk (cheesy) — owner call on look.

### T10. Transitions: warp / hyperspace / shockwave

A. **Hyperspace streaks**: stars stretched radially — in the Atlas worklet, scale X by `1 + warp*k*depth` and rotate toward centre (RSXform rotation = radial angle) using a streak texture. **C1**. Drive `warp` with `withTiming` during system switch.
B. **Shockwave displacement**: `<RuntimeShader>` image filter on the world Group layer:
```sksl
uniform shader image; uniform float2 c; uniform float t; uniform float amp;
half4 main(float2 xy){ float2 d=xy-c; float dist=length(d); float ring=t*1400.;
  float w = exp(-pow((dist-ring)/40.,2.)) * amp; return image.eval(xy + normalize(d+1e-4)*w*24.); }
```
   `<Group layer={<Paint><RuntimeShader source={shock} uniforms={u}/></Paint>}>{world}</Group>`. Requires the whole world in a saveLayer → **C2–C3 only while active** (mount the filter only during the transition; with `amp=0` it still costs the layer).
C. `<DisplacementMap>` with a `FractalNoise`/`Turbulence` child for heat-shimmer/warp — **C2–C3**; built-in noise is not cheap.
D. Zoom-through/radial blur in a RuntimeShader filter (8–12 taps toward centre) — **C3** while active.
- Reduced motion: replace with crossfade (opacity tween) — the existing switch choreography already has a reduced-motion path that must be preserved.
- Risk: medium. First activation compiles the filter → hitch exactly at transition start (warm it up — see pitfalls). Layer + filter on content containing Paragraphs and clipped images is the heaviest combination in this catalogue.

---

## 6. Ranking by value / cost

| Rank | Technique | Value | Cost | Feasibility in 2.6.2 |
|---|---|---|---|---|
| 1 | T2 Atlas parallax starfield (+ twinkle via color buffer) | High (depth, motion with pan) | C1 | Confirmed APIs; drop-in replacement for 44 Circles |
| 2 | T7 Rim/terminator lighting on photo bodies | High (bodies read as planets) | C1 | Confirmed (`Shader` + child `ImageShader`) |
| 3 | T4 tier 1–2 glow (gradient sprites, BlurMask, `plus`) | High | C0–C1 | Confirmed |
| 4 | T5A/C orbit energy flow (animated dash phase → stroke shader) | Med-High | C1 | Dash: trivial; shader: moderate effort |
| 5 | T1 Nebula fbm (low-res or baked + panned) | High (atmosphere) | C2 (scaled) / C3 (naive) | Confirmed; needs resolution-scaling or bake |
| 6 | T10A hyperspace streaks on system switch | Med-High (signature moment) | C1 | Reuses T2 Atlas |
| 7 | T3 particle bursts / corona sparks | Medium | C1 | Confirmed |
| 8 | T10B shockwave displacement (RuntimeShader filter) | Medium | C2–C3 transient | Confirmed; warm-up needed |
| 9 | T9 lens flare | Low-Med (taste) | C1 | Easy |
| 10 | T6 path trails | Low (bodies don't move ambiently) | C1 | Easy |
| 11 | T4 tier 3 full-scene bloom | Medium | C2–C3 | Feasible, one pass max |
| 12 | T8 depth of field | Low | C2–C3 | Feasible, poor value |

Suggested composition: one full-screen "background" RuntimeEffect that does nebula + shader-starfield far layer (one pass), an Atlas for near/mid stars and particles, per-body lit-photo shaders with BlurMask halos, dash/shader orbit flow, and a transition-only filter. That is roughly 1 full-screen shader pass + O(bodies) small draws + 1–2 Atlas calls per frame.

---

## 7. Pitfalls (Skia / Hermes / worklets / Android)

1. **Same-file worklet forward reference** (project memory, fix f979263): a worklet calling a worklet declared *later* in the same file captures `undefined` on Hermes; vitest can't see it. Declare helpers above callers; add new modules to `orrery-worklet-order.test.ts` TARGETS.
2. **`globalThis.crypto` is undefined in Hermes** — never use `crypto.randomUUID`/`getRandomValues` for seeds; use the deterministic `seeded()` hash pattern from `OrreryCanvas`.
3. **Whole-canvas replay per SharedValue change** — every animated value replays every command. Keep command count low (Atlas/shader instead of N Circles); never drive anything through React state per frame.
4. **SkSL compile hitch (Ganesh/GL)**: first draw of each new RuntimeEffect/filter/blur pipeline compiles a GL program (tens–hundreds of ms). Create effects at module scope (`RuntimeEffect.Make` once), and warm transition-only effects by drawing them once at alpha≈0 (or into a 1×1 offscreen) when the orrery mounts, not at transition start.
5. **`RuntimeEffect.Make` returns `null` on SkSL errors** (no throw, no message in this API). Always null-check and fall back to the plain renderer; driver differences mean a shader can compile on one GPU and fail on another (reported Android issues, e.g. Shopify/react-native-skia#2434). Test on both test phones.
6. **Precision**: Android fragment `half` is mediump. Wrap time (`% 1000` s), keep hash/coordinates in `float`, avoid `sin(x*43758)` on large x.
7. **SkSL restrictions**: constant loop bounds, no while, no dynamic indexing, uniform arrays fixed size; colours from theme tokens must be passed as uniforms (project rule: no hardcoded colours, including in shaders and Skia draw calls).
8. **saveLayer cost**: every `layer=` (the current per-body alpha layers) and every image filter is an offscreen pass. Keep layers tight, avoid per-body filters, avoid animating blur sigma. Allocating `Skia.Paint()` inside a per-frame derived value (current OrbitBody/SunBody/SatelliteBody) is garbage per frame — cache it.
9. **GPU resource thread ownership**: `ReanimatedRecorder` notes resources must be owned by the UI thread on Ganesh; create textures with `useTexture`/`useImageAsTexture`/`runOnUI`, not on another worklet runtime. Disposed SkImages still referenced by the recorded list crash — tie disposal to unmount.
10. **In-place mutation needs notify**: mutating arrays/objects inside SharedValues won't redraw unless you reassign or call the `notifyChange` pattern; Skia's buffer hooks do this for you.
11. **Buffer hooks re-create on size change** (`useBufferValue` memo on `size`): use a fixed capacity and hide unused slots (scale 0 / off-screen).
12. **Paragraph alpha needs a real layer** (`OrreryLabel.tsx:1`); a shader/filter over a Group containing Paragraphs forces layer composition of text — keep labels outside effect layers.
13. **`opaque` Canvas → SurfaceView on Android**: cheapest path, but confirm RN overlays/gesture handler still layer correctly and that screenshots/transition captures behave.
14. **Animation lifecycle**: `useClock` has no pause; the project stops it by unmounting the canvas subtree on blur/background. Any new `useFrameCallback` must live inside that unmountable subtree and read `useReducedMotionShared()` live.
15. **Perf evidence**: only the physical phone counts; `dumpsys gfxinfo` sees the render thread, not the Reanimated UI-thread worklet time — report both, labelled.
16. **Reanimated 4 + worklets 0.10**: Babel plugin is `react-native-worklets/plugin` and must stay last; Skia hook callbacks (`useRSXformBuffer` modifier) must carry `"worklet"` or they fail at runtime on device.

---

## Sources

- Installed source: `@shopify/react-native-skia@2.6.2/src/{sksg/Container.native.ts, sksg/Recorder/ReanimatedRecorder.ts, renderer/Canvas.tsx, renderer/Offscreen.tsx, external/reanimated/{buffers,textures,interpolators}.ts, dom/types/*.ts, skia/types/**}`, `android/build.gradle`.
- [RN Skia docs — Canvas overview (opaque/SurfaceView, androidWarmup)](https://shopify.github.io/react-native-skia/docs/canvas/overview/)
- [RN Skia docs — Atlas](https://shopify.github.io/react-native-skia/docs/shapes/atlas), [Textures](https://shopify.github.io/react-native-skia/docs/animations/textures), [Pictures](https://shopify.github.io/react-native-skia/docs/shapes/pictures), [Shaders overview](https://shopify.github.io/react-native-skia/docs/shaders/overview) (via Context7)
- [Shopify/react-native-skia#2434 — shader code behaving differently on Android](https://github.com/Shopify/react-native-skia/issues/2434)
- [Flutter — shader compilation jank (same Skia/GL mechanism)](https://liudonghua123.github.io/flutter_website/perf/shader/)
