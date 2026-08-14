# Orrery platform verification — Skia + Reanimated + Gesture Handler on Expo SDK 57

**Workpaper for dossier domain 09 (orrery).** Verifies HANDOFF §7 "Rendering" decisions against
current official documentation. This app is not yet scaffolded; every claim below is checked against
published docs / release notes / npm as of **August 2026**, not training data.

**Legend:** `[DOCUMENTED]` = stated in an official doc/changelog/source I read and cite.
`[INFERRED]` = a conclusion I drew from documented facts but did not find asserted verbatim.

---

## 0. Version baseline (the stack SDK 57 actually ships)

| Package | Version under SDK 57 | Source |
|---|---|---|
| Expo SDK | **57** (released **June 30 2026**) | Expo changelog — https://expo.dev/changelog/sdk-57 |
| React Native | **0.86** (up from 0.85) | Expo changelog sdk-57 |
| `react-native-reanimated` | **4.5** (SDK 56 shipped 4.3) | Expo changelog sdk-57 |
| `react-native-worklets` | **0.10** (SDK 56 shipped 0.8) | Expo changelog sdk-57 |
| `react-native-gesture-handler` | **2.32** (SDK 56 shipped 2.31) | Expo changelog sdk-57 |
| `@shopify/react-native-skia` | not pinned in the changelog; latest is **2.11.0** (published ~Aug 2026). `npx expo install` resolves the SDK-compatible build. Peer deps: `react-native >=0.79`, `react >=19`. | npm https://www.npmjs.com/package/@shopify/react-native-skia ; Expo doc https://docs.expo.dev/versions/v57.0.0/sdk/skia/ |

`[DOCUMENTED]` Skia **2.10+** requires **Reanimated v4 or above** for its animation integration
(Reanimated v3 only for Skia < 2.10). Source: React Native Skia Animations doc —
https://shopify.github.io/react-native-skia/docs/animations/animations/ (and Context7 mirror of the
same page). SDK 57 ships Reanimated 4.5, so Skia 2.10/2.11 is the correct line. **This trio is
mutually compatible under SDK 57.** `[INFERRED]` from the version matrix above.

### 0.1 Two hard platform facts that constrain everything below

- `[DOCUMENTED]` **New Architecture (Fabric) is mandatory, not optional.** RN 0.85 removed the bridge
  (7 April 2026), and Reanimated 4.x is **New-Architecture-only** — a legacy/old-arch app cannot run
  it. SDK 57 = RN 0.86 = New Arch only. Sources: Reanimated getting-started + compatibility docs
  (https://docs.swmansion.com/react-native-reanimated/docs/guides/compatibility/), crash issue
  software-mansion/react-native-reanimated#8235. **Nothing to do** — SDK 57 is New Arch by default —
  but record it: there is no "fall back to old arch" escape hatch for any orrery problem.
- `[DOCUMENTED]` **Skia, Reanimated, and Gesture Handler are all included in Expo Go** for SDK 57
  (`inExpoGo: true` on the Expo SDK 57 Skia page, https://docs.expo.dev/versions/v57.0.0/sdk/skia/).
  See §7 — this corrects a stale assumption in the task framing.

---

## 1. "Animation runs OFF the JS thread, no setState per frame" (HANDOFF §7)

**Verdict: the guarantee HOLDS, but the mechanism HANDOFF describes is outdated. Flag for the owner.**

HANDOFF §7 says: *"Skia runs its own render loop off the JS thread. Pair with Reanimated for
gestures."* That framing describes the **pre-1.0 Skia value system** (`useValue`, `useClockValue`,
`useComputedValue`, `useSharedValueEffect`), which **has been removed**.

- `[DOCUMENTED]` The Skia-owned value/clock API was deprecated and then removed. `useClockValue`,
  `useComputedValue`, `useValue` are gone (removed around the 0.1.230–0.1.231 line / the 1.0
  rewrite). Sources: Shopify/react-native-skia discussion #2083 (breaking changes in 0.1.230),
  issue #2115 ("Are useClockValue and useComputedValue gone?"), discussion #2152 ("What happened to
  useValue?").
- `[DOCUMENTED]` The **current** model: Reanimated is the animation **engine**, not just the gesture
  layer. *"React Native Skia offers integration with Reanimated, enabling the execution of animations
  on the UI thread… supports the direct usage of Reanimated's shared and derived values as
  properties"* — no `createAnimatedComponent` / `useAnimatedProps` wrapper needed; pass shared values
  straight into Skia props. Source:
  https://shopify.github.io/react-native-skia/docs/animations/animations/

**Current idiomatic pattern** (`[DOCUMENTED]`, from the Animations + Hooks docs):

```tsx
import { Canvas, Circle, useClock, vec } from "@shopify/react-native-skia";
import { useDerivedValue, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";

// time-driven:
const t = useClock();                       // SharedValue<number>, ms since activation
const transform = useDerivedValue(() => [   // runs as a worklet on the UI thread
  { translateX: 200 * Math.cos(t.value) },
  { translateY: 200 * Math.sin(t.value) },
]);
// <Circle c={vec(0,0)} r={50} transform={transform} />

// or property-driven, no clock:
const radius = useSharedValue(50);
// radius.value = withSpring(100)  → Circle re-renders on the UI thread, zero JS re-render
```

`[DOCUMENTED]` Derived-value bodies are worklets executed on the UI thread; Skia reads shared/derived
values and repaints on the UI thread. **No React `setState`, no JS-thread re-render per frame.** The
core HANDOFF requirement is satisfied.

**What changed for the design:** the dependency on Reanimated is now **hard and central**, not the
optional "pair with it for gestures" that HANDOFF implies. Reanimated + Worklets are the render
driver. This is a wording/mental-model correction, not a blocker.

---

## 2. "~5°/day drift" — is a continuous 60fps loop even the right model?

**Verdict: NO — a continuous clock is the wrong tool for the orbital motion. This is a real design
question for the owner.**

- `[DOCUMENTED]` `useClock()` takes **no arguments** and returns time in ms since activation; it
  drives updates continuously while mounted (verified against the current hooks doc source,
  `apps/docs/docs/animations/hooks.md` on `main`, and the API reference). There is **no throttle
  parameter and no `paused` parameter** on the hook itself.
- `[INFERRED]` 5°/day = **0.0000579° per frame at 60fps** — motion far below one pixel per frame for
  any plausible orbit radius. Driving orbital position from `useClock` would repaint the whole canvas
  ~60×/s to move bodies imperceptibly. That is pure battery cost for no visible benefit.
- `[INFERRED, RECOMMENDED]` The idiomatic alternative: **derive each body's angle from timestamp
  math** — `angle = f(daysSinceLastContact, interval)` — inside a `useDerivedValue`, and recompute
  it on mount / on focus / at most once a minute. The orrery's orbital layout then has **no
  per-frame loop at all**; it's a function of the clock-on-the-wall, evaluated lazily. This also
  makes "pause on blur" (§5) trivial, because there is nothing running to pause.

**Design question for owner:** what actually needs a per-frame render loop?
- Orbital drift → does **not** (timestamp-derived; recompute on focus).
- Starfield → HANDOFF §7 already says *"a static image or a very cheap shader"* and warns against a
  redrawing particle field. If the starfield is a static image, it needs no loop either.
- Tap-to-freeze feedback / the two-view morph transition → these are **short, gesture-triggered**
  animations (`withTiming`/`withSpring`), which run their own bounded Reanimated animation and stop
  on their own — not a perpetual clock.

If all three above hold, the orrery may run with **no continuous render loop whatsoever**, only
transient Reanimated animations. That is a materially different (and cheaper) architecture than "a
60fps Skia render loop," and the owner should confirm the intent before it's planned.

---

## 3. Gestures: tap-to-freeze + tap hit-test against Skia circles

**Verdict: fully supported and current. Confirmed.**

- `[DOCUMENTED]` The recommended gesture stack is **`react-native-gesture-handler`'s
  `GestureDetector` + `Gesture.*` recognizers wrapping the `<Canvas>`**, with Reanimated shared
  values holding element positions. Source:
  https://shopify.github.io/react-native-skia/docs/animations/gestures/ (Pan example with
  `Gesture.Pan()`, `useSharedValue`, `withDecay`).
- `[DOCUMENTED]` **Skia has no view hierarchy** — the docs state the canvas mirrors `View`
  accessibility only via **overlaid standard views**, and gestures on a specific drawn element are
  done either by (a) hit-testing coordinates in the gesture handler, or (b) overlaying an
  `Animated.View` that mirrors the element's transform ("Element Tracking" example). So a **tap
  hit-test against a drawn circle is coordinate math** — e.g. in `Gesture.Tap().onEnd((e) => …)`,
  test `(e.x - cx)² + (e.y - cy)² <= r²` per body. Source: Gestures doc + Canvas > Accessibility
  (https://shopify.github.io/react-native-skia/docs/canvas/overview).
- `[INFERRED]` Tap-to-freeze = a `Gesture.Tap()` whose handler sets a `frozen` / `selectedId` shared
  value; the per-body angle `useDerivedValue` reads it and holds position. No new API needed.
- Community helper `react-native-skia-gesture` exists (auto touch-path derivation for Circle), but
  it is **not required** — the official GH + coordinate-math path is enough and is what to build on.

---

## 4. TWO-VIEW orrery: morph between closeness-radius and decay-position on ONE canvas

**Verdict: this is a completely idiomatic Skia + Reanimated pattern. "One canvas, morph a single
`progress` value" is a REAL, well-supported choice — not something that forces two separate
screens. This resolves the central open question in the owner's favor.**

- `[DOCUMENTED]` Interpolating one set of drawn bodies between two layouts is exactly what Skia +
  Reanimated is built for. Two supported mechanisms:
  1. **Per-body scalar interpolation** — a single `progress` shared value (0 = closeness view,
     1 = decay view) plus Reanimated `interpolate()` inside each body's `useDerivedValue`:
     `r = interpolate(progress.value, [0,1], [closenessRadius, decayRadius])` (and likewise for
     angle). This is the retained-mode radius-animation pattern shown verbatim in the docs
     (`RetainedModeExample`, animating `Circle r` via `useSharedValue`/`withSpring`). Source:
     https://shopify.github.io/react-native-skia/docs/canvas/rendering-modes and
     https://shopify.github.io/react-native-skia/docs/animations/animations/
  2. **`usePathInterpolation`** — for interpolating the **ring paths** between two geometries as a
     function of `progress`. Source: hooks doc
     https://shopify.github.io/react-native-skia/docs/animations/hooks/
- `[DOCUMENTED] CAVEAT on option 2:` `usePathInterpolation` requires all paths in the output range to
  have **identical command structure** (same number/type of path commands); dissimilar paths need
  the `flubber` library. **Per-body scalar `interpolate()` (option 1) has no such constraint** and is
  the safer default for interpolating radius/angle per contact.

**Implication for the design menu:** "toggle vs two screens vs morph gesture" is a **UX decision, not
a technical one** — all three are buildable, and the single-canvas morph (a `progress` value driven
by a toggle or by a `Gesture.Pan`/swipe) is the most idiomatic. `[INFERRED]` Because both views draw
the *same* set of bodies, one canvas + one `progress` value is also the cheapest and avoids
duplicate hit-testing logic. Owner should choose the interaction (toggle button, swipe gesture, or
two navigation screens) on feel; none is blocked.

**Design question for owner:** should the transition be a **discrete toggle** (`withTiming(progress,
0→1)`), or a **continuous gesture** (`Gesture.Pan` scrubs `progress` directly, view follows the
finger)? The gesture version is the same amount of code and is where Skia+Reanimated shines, but it
competes for the same touch surface as tap-to-freeze — see §3, the two gestures must be composed
(`Gesture.Exclusive`/`Race`) so a tap doesn't start a drag.

---

## 5. Pause-on-blur: `useIsFocused` + `AppState`

**Verdict: correct hooks, but the stop mechanism needs care — there is NO built-in pause on the Skia
clock. Flag.**

- `[DOCUMENTED]` `useIsFocused` from `@react-navigation/native` and RN's `AppState` are the standard
  focus/background signals (React Navigation navigation-lifecycle docs; RN AppState). These are the
  right hooks — HANDOFF §7 names them correctly.
- `[DOCUMENTED]` `useClock()` has **no `paused`/stop argument** (§2). The clock ticks as long as it
  is mounted.
- `[INFERRED]` Therefore, to actually **stop the render loop and reclaim battery**, the reliable
  lever is to **unmount the `<Canvas>`** — conditionally render it on
  `useIsFocused() && appState === "active"`. Gating the *derived values* on a `paused` shared value
  (the pattern the `useVideo` `paused` example uses) stops visible motion but does **not**
  necessarily stop the clock's underlying frame callback. Prefer conditional-render/unmount for a
  true stop.
- `[INFERRED]` If the orrery follows §2's recommendation (timestamp-derived layout, no continuous
  clock), then **there is nothing to pause** — on refocus you simply recompute angles from the
  current time. Pause-on-blur becomes a non-issue rather than a mechanism to build. This is the
  strongest argument for the §2 architecture.

**Design question for owner:** confirm the pause strategy is "unmount the Canvas on blur/background"
(clean, definitely stops work) vs "keep it mounted but gate motion." The former is recommended;
it also means the Skia surface is recreated on refocus (`[INFERRED]` a sub-frame cost at tens of
bodies, negligible per HANDOFF §7's "performance is not a concern at this scale").

---

## 6. Elliptical orbits wider than viewport, piecewise angle-to-time, off-screen arcs

**Verdict: nothing in the current API obstructs this. Confirmed.**

- `[DOCUMENTED]` Skia draws arbitrary parametric geometry: `vec(x,y)`, `Circle`, `Path` with
  `Skia.Path.MakeFromSVGString(...)` / `PathBuilder` (`moveTo`/`lineTo`/`addRRect`/cubic commands),
  and `transform` arrays on any node. Bodies can be positioned anywhere, including off-screen (Skia
  clips to the canvas; off-canvas coordinates are legal). Sources: hooks/path docs
  (https://shopify.github.io/react-native-skia/docs/animations/hooks/) and the Path API migration
  page (`usePathValue`, `PathBuilder` as a shared value in worklets).
- `[DOCUMENTED] API-change note:` the **Path API was migrated** — `usePathValue` now takes an
  optional transform function (third arg) applied after the path is built, and `PathBuilder` is the
  current dynamic-path construct usable as a shared value inside worklets. Use these, not any
  pre-1.0 path-value hook. Source:
  https://shopify.github.io/react-native-skia/docs/shapes/path-migration
- `[INFERRED]` The piecewise angle→time mapping (top arc = first half of interval, bottom arc =
  second, unseen sides traversed fast) is **pure JS/worklet math** feeding a `useDerivedValue` that
  returns `{ cx, cy }` per body. Skia imposes no constraint on the parameterization. HANDOFF §7's
  "consequence to keep straight" is a math concern, not a platform one.

---

## 7. Expo SDK 57 / New Architecture / Expo Go — corrects a stale assumption

- `[DOCUMENTED]` **The task framing's parenthetical "(it can't run in Expo Go)" is FALSE for the
  orrery stack.** Expo SDK 57 lists **Skia, Reanimated, and Gesture Handler all as included in Expo
  Go** (`inExpoGo: true`, https://docs.expo.dev/versions/v57.0.0/sdk/skia/). The orrery can be
  developed and previewed in Expo Go.
- `[DOCUMENTED]` A **custom dev client / prebuild is forced only by libraries not in Expo Go** — per
  this repo's `CLAUDE.md`, that's the **home-screen widget** feature (`react-native-android-widget`,
  which needs a custom dev client). The widget requirement is real; it is **not** the orrery's
  requirement. `[INFERRED]` Since the app ships widgets anyway, the project will run on a dev client
  regardless — but the orrery itself does not add that constraint and can be iterated in Expo Go in
  isolation.
- `[DOCUMENTED]` **New Architecture (Fabric) is on and mandatory** under SDK 57 (§0.1). Skia's 1.0+
  rewrite and Reanimated 4 both target the New Architecture; there is no Fabric-specific opt-in step
  to remember and no old-arch fallback. Historically Skia had Fabric-specific setup; that era is
  over now that New Arch is the only architecture.

---

## Summary of impacts on HANDOFF §7

| §7 decision | Status | Note |
|---|---|---|
| Use `react-native-skia` | **Confirmed** | 2.11.0 line; in Expo Go; needs Reanimated 4 (have 4.5) |
| Don't animate via React setState | **Confirmed** | Reanimated worklets on UI thread; no JS re-render |
| "Skia runs its own render loop… pair with Reanimated for gestures" | **Correct outcome, outdated mechanism** | Skia's own value/clock system was removed; Reanimated is now the animation engine, a hard dependency |
| Pause on `useIsFocused` false + `AppState` background | **Confirmed hooks; mechanism flagged** | No built-in clock pause — unmount the Canvas; or eliminate the loop entirely (§2) |
| Elliptical orbits, piecewise angle-to-time | **Confirmed** | Pure math; Path API migrated (`usePathValue`/`PathBuilder`) |
| Tap-to-freeze | **Confirmed** | GestureDetector + Gesture.Tap; hit-test is coordinate math |
| Two-view morph (owner's open question) | **Confirmed feasible on one canvas** | `progress` shared value + per-body `interpolate()`; toggle/gesture/two-screens all buildable — UX call, not technical |
| Performance not a concern at this scale | **Confirmed** | Tens of bodies; risk is method not volume; and §2 removes the loop |

## Open design questions surfaced (for the owner)

1. **Does the orrery need a continuous render loop at all?** Recommend timestamp-derived orbital
   layout (recompute on focus) instead of a `useClock` loop — imperceptible 5°/day motion doesn't
   justify 60fps repaints, and it makes pause-on-blur a non-issue. Needs owner confirmation because
   it changes the architecture from "render loop" to "lazy recompute."
2. **Starfield: static image or shader?** HANDOFF already leans static. If static, it adds no loop.
   Confirm, since it's the other candidate reason to keep a loop running.
3. **Two-view transition: discrete toggle or continuous swipe gesture?** Both buildable and same
   cost; a swipe competes with tap-to-freeze for the touch surface and would need gesture
   composition (`Gesture.Exclusive`/`Race`).
4. **Pause strategy:** confirm "unmount Canvas on blur/background" (recommended, truly stops work)
   vs "keep mounted, gate motion."

---

## Sources

- Expo SDK 57 changelog — https://expo.dev/changelog/sdk-57
- Expo SDK 57 Skia doc — https://docs.expo.dev/versions/v57.0.0/sdk/skia/ (and /versions/latest/sdk/skia/)
- Skia Animations — https://shopify.github.io/react-native-skia/docs/animations/animations/
- Skia Hooks (useClock, usePathInterpolation) — https://shopify.github.io/react-native-skia/docs/animations/hooks/
  and source `apps/docs/docs/animations/hooks.md` on `main`
- Skia Gestures — https://shopify.github.io/react-native-skia/docs/animations/gestures/
- Skia Canvas / rendering-modes — https://shopify.github.io/react-native-skia/docs/canvas/rendering-modes
- Skia Path migration — https://shopify.github.io/react-native-skia/docs/shapes/path-migration
- Skia removed-value-API references — GitHub Shopify/react-native-skia discussions #2083, #2152; issue #2115
- npm @shopify/react-native-skia (2.11.0, peer deps) — https://www.npmjs.com/package/@shopify/react-native-skia
- Reanimated 4 New-Arch-only — https://docs.swmansion.com/react-native-reanimated/docs/guides/compatibility/ ;
  getting-started ; issue software-mansion/react-native-reanimated#8235
