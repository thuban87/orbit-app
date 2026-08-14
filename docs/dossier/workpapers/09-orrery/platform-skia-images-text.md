# Platform Verification — Skia images & text for the orrery (09-orrery)

**Role:** Platform verifier for the pre-roadmap orrery dossier.
**Method:** Verified against current official docs (Shopify Skia docs site, Expo SDK 57 docs, react-native-skia source on `main`, Context7 mirror of the Skia docs site). NOT training data. Versions cited below.
**Date:** 2026-08-13.

## Version pins (the anchor for every claim below)

| Package | Version for Expo SDK 57 | Source |
|---|---|---|
| `@shopify/react-native-skia` | **`2.6.2`** | Expo SDK 57 `bundledNativeModules.json` (`sdk-57` branch): `https://raw.githubusercontent.com/expo/expo/sdk-57/packages/expo/bundledNativeModules.json` |
| `expo-image-manipulator` | **`~57.0.9`** | same file |
| Expo SDK | **57** (docs "latest" resolves to `Reference (v57.0.0)`) | `https://docs.expo.dev/versions/latest/sdk/skia/` |

Note: The Expo Skia SDK page does not pin a Skia version itself; it says run `npx expo install @shopify/react-native-skia`, which resolves to the bundled `2.6.2`. Skia `2.6.2` is below `2.10`, so it targets **Reanimated v3** (Skia docs: "Versions 2.10 and above require Reanimated v4 or higher, while earlier versions support Reanimated v3" — `https://shopify.github.io/react-native-skia/docs/animations/animations`). Flagging this because the orrery is a Reanimated + Skia render-loop feature and the Reanimated major matters for the eventual scaffold.

---

## Item 1 (THE key open item): can current Skia load a raw `file://` sandbox path?

**RESOLUTION: YES — a raw `file://` path is supported through the documented `useImage(string)` → `Skia.Data.fromURI(uri)` path. A base64 decode step is NOT required as the default. Keep base64 (`Skia.Data.fromBase64` → `MakeImageFromEncoded`) only as a fallback for a path that fails to load.**

Evidence (current version, `main` / 2.x):

1. **`useImage` delegates string sources straight to `Data.fromURI` with no rejection of `file://`.** Source `packages/skia/src/skia/core/Data.ts` (`loadData`): for a string source it computes `const uri = typeof source === "string" ? source : Platform.resolveAsset(source)` and calls `Skia.Data.fromURI(uri)`. A `file://` string passes through unchanged — it is only non-string (bundle asset) sources that go through `Platform.resolveAsset`. (`https://raw.githubusercontent.com/Shopify/react-native-skia/main/packages/skia/src/skia/core/Data.ts`)

2. **`fromURI`'s documented contract explicitly covers local URIs.** Interface `DataFactory.fromURI(uri: string): Promise<SkData>`, TSDoc: *"Creates a new Data object from an Uri, either locally or remotely."* (`https://raw.githubusercontent.com/Shopify/react-native-skia/main/packages/skia/src/skia/types/Data/DataFactory.ts`). This is a **documented** capability ("either locally or remotely"), though the doc uses the general word "locally" and does not name the `file://` scheme token specifically — call this documented-by-contract, not documented-by-example.

3. **The community-recommended local-file idiom is exactly this call.** The maintainer guidance is that `useImage` is a shortcut for `Skia.Data.fromURI(uri)` + `Skia.Image.MakeImageFromEncoded(data)`, and the caching example uses `Skia.Data.fromURI("file://" + uri)` for local paths. (Discussions #1068, #1941, #1248.)

**Caveat / what remains INFERRED, not documented:** The Skia *docs page* for images (`https://shopify.github.io/react-native-skia/docs/images/`) still lists only three `useImage` sources by example — `require()`, network URL, and named bundle image. A raw `file://` disk path is **not shown as an example on the docs page**; the support comes from the `fromURI` interface contract + source, not a worked example. Historically there were reports (iOS `Library/Caches`, issue #1248) of `Could not load data` on specific sandbox paths that worked in RN's `<Image>`. Our case is narrower and friendlier: Android-first, one 512×512 JPEG per contact under the app document dir, resolved to an absolute `file://…` at read time (07-photos DECIDED). That is a normal readable app-sandbox file.

**Design consequence:** Default path = `useImage(absoluteFileUri)` per planet, no per-photo base64 step. Provide `useImage`'s optional second-arg error handler and, on error, fall back to `expo-file-system` base64 → `Skia.Data.fromBase64` → `Skia.Image.MakeImageFromEncoded`. This should be a spike-verified item on a real Pixel 6 Pro before it is treated as settled, because the happy path is documented-by-contract but not documented-by-example.

---

## Item 2: circular clip / masking a photo into a disc + ring/stroke

**CONFIRMED. Two current idioms, both from the docs; ring/stroke is trivial.**

- **ImageShader-in-Circle (the natural "planet" idiom):** render the photo as a shader that fills a `<Circle>`, `fit="cover"`. The circle *is* the disc; no separate clip needed.
  ```tsx
  <Circle cx={128} cy={128} r={128}>
    <ImageShader image={image} fit="cover" rect={{ x: 0, y: 0, width: 256, height: 256 }} />
  </Circle>
  ```
  Source: `https://shopify.github.io/react-native-skia/docs/shaders/images` (ImageShader / cover fit).

- **`<Group clip={path}>` with `<Image fit="cover">`:** clip any child to a path (circle/rrect/SVG path via `Skia.Path.MakeFromSVGString`). Source: `https://shopify.github.io/react-native-skia/docs/group` — the `clip` prop "defines a clipping region… Elements outside this region are hidden," supports `rrect`/`rect` and custom paths; `invertClip` also available.

- **Ring / stroke around it:** a `<Circle>` accepts multiple `<Paint>` children including stroked ones — e.g. `<Paint color="…" style="stroke" strokeWidth={10} />`. Source: `https://shopify.github.io/react-native-skia/docs/paint/overview` (Circle with fills and strokes). So a themed ring around the planet is a single stroked Paint (or a concentric second `<Circle>`).

---

## Item 3: Skia text for the initials fallback

**CONFIRMED, with a change to note. A font file MUST be bundled — there is no default system font baked in.**

- **Simple text (legacy but current):** `useFont(require("./my-font.ttf"), fontSize)` → `<Text x y text font={font} />`. The `<Text>` `y` is the **baseline**, not the top. Source: `https://shopify.github.io/react-native-skia/docs/text/text`.
- **`matchFont` / `useFonts`:** load one or more `require`d `.ttf`s and pick a style. Same page. **The docs explicitly recommend the Paragraph API over this legacy `useFont`/`matchFont` approach for new projects** — this is the notable "what changed": *"The Paragraph API is recommended for new projects over this legacy approach."*
- **Centering (the actual need — initials centered in the disc):** the Paragraph API centers horizontally with `textAlign: TextAlign.Center` via `Skia.ParagraphBuilder.Make({ textAlign: TextAlign.Center })` rendered in a `<Paragraph … width={W} />`. Source: `https://shopify.github.io/react-native-skia/docs/text/paragraph`. (Horizontal centering is a prop; vertical centering in the disc is manual math off the measured height either way.)
- **Font bundling requirement:** every text example loads a real font file (`require("./Roboto-*.ttf")` etc.). There is no "use the OS default" path shown. **This surfaces a concrete owner/design question — see below.**

---

## Item 4: themed color passed at runtime into Skia (no hardcoded/compiled colors)

**CONFIRMED. Colors are ordinary runtime values; nothing forces a compiled/literal color. The no-hardcoded-color rule is fully satisfiable in Skia.**

- `color` props accept **runtime** CSS strings, ARGB numbers, and **HSL strings** directly: `<Group color="hsl(120, 100%, 50%)">`, `<Group color={0xffff0000}>`. Source: `https://shopify.github.io/react-native-skia/docs/paint/properties`. This directly matches 07-photos' HSL-hash-quantized-to-palette fallback swatch — an HSL string computed per contact is a legal runtime color value.
- Imperative form: `Skia.Paint()` + `paint.setColor(Skia.Color("lightblue"))` — `Skia.Color(token)` converts any theme token string at runtime. Source: `https://shopify.github.io/react-native-skia/docs/paint/overview`.
- Gradients take runtime color arrays: `Skia.Shader.MakeRadialGradient(…, [Skia.Color("magenta"), Skia.Color("yellow")], …)`. Source: `https://shopify.github.io/react-native-skia/docs/text/paragraph`.

So every Skia draw call can be fed a color resolved from a JS theme token at call time. There is **no** API that requires a literal/compiled color. (Project rule reminder: route the swatch/ring/text colors through the theme tokens, not string literals in the component — the platform does not stand in the way of that.)

---

## Item 5: threading & the decode cost at mount (no benchmark — statement of record)

- **Rendering / animation runs on the UI thread**, driven by Reanimated worklets, not React state. `useClock`/`useDerivedValue` values and even offscreen texture creation (`runOnUI`, `"worklet"`, `Skia.Surface.MakeOffscreen`) execute on the UI thread. Sources: `https://shopify.github.io/react-native-skia/docs/animations/animations` ("integrates with Reanimated to enable UI thread animations"), `https://shopify.github.io/react-native-skia/docs/animations/textures`. This aligns with the project rule "never drive animation from React state."
- **Image loading is asynchronous.** `useImage` "returns null until the image is fully loaded" and `Data.fromURI` returns a `Promise<SkData>`. Sources: `https://shopify.github.io/react-native-skia/docs/images/` and `DataFactory.ts`. Load/decode is native async I/O, not a synchronous JS-thread call — so the ~8 photos (HANDOFF §10 scale) resolve as promises around mount, each planet rendering its themed-swatch+initials fallback until its `SkImage` is non-null.
- **Consequence for the base64 fallback path (item 1):** if a photo ever needs the `expo-file-system` base64 read → `Skia.Data.fromBase64` route, note that `readAsStringAsync` and the base64 string handling run on the **JS thread**. At 8 contacts this is a one-time mount cost, not per-frame, but it is the one place decode work could touch the JS thread. The default `useImage(file://)` path keeps decode off the JS thread.
- **Measurement caveat (dossier rule, restated):** any perf claim about the orrery must come from the **physical Pixel 6 Pro**, never the remote/desktop emulator (Skia is a GPU render-loop feature the emulator cannot represent). And `dumpsys gfxinfo` / render-thread timing ≠ JS-thread jank — state which thread any future evidence covers. No benchmark performed here.

---

## Concrete design questions this verification surfaced (for the owner)

1. **Bundle a font for the initials fallback.** Skia has no default system font; text requires a `require`d `.ttf`. Which font, and does it come from the app's theme/type system? (Also: legacy `useFont`/`matchFont` vs. the docs-recommended `Paragraph` API — Paragraph is recommended for new code and gives `textAlign: Center` for free.)
2. **`file://` happy path is documented-by-contract, not documented-by-example — spike it on the Pixel before it is treated as DECIDED.** Confirm `useImage("file:///…/<contact>.jpg")` on a real app-document-dir JPEG renders, with the base64 fallback wired to `useImage`'s error handler. Low risk (Android, plain readable sandbox file), but the only prior "it just works" reports for arbitrary sandbox paths are community, and there is a documented history of specific-path failures (#1248).
3. **Reanimated major:** Skia `2.6.2` (SDK 57) pairs with Reanimated **v3** (v4 only from Skia 2.10+). If the orrery plan assumes Reanimated v4 APIs, that is a mismatch to resolve at scaffold time.

---

### Sources
- Expo SDK 57 bundled versions: https://raw.githubusercontent.com/expo/expo/sdk-57/packages/expo/bundledNativeModules.json
- Expo Skia SDK page (v57): https://docs.expo.dev/versions/latest/sdk/skia/
- Skia images doc: https://shopify.github.io/react-native-skia/docs/images/
- `Data.ts` (`loadData`, source resolution) — `main`: https://raw.githubusercontent.com/Shopify/react-native-skia/main/packages/skia/src/skia/core/Data.ts
- `DataFactory.ts` (`fromURI` contract) — `main`: https://raw.githubusercontent.com/Shopify/react-native-skia/main/packages/skia/src/skia/types/Data/DataFactory.ts
- Group / clipping: https://shopify.github.io/react-native-skia/docs/group
- ImageShader / cover fit: https://shopify.github.io/react-native-skia/docs/shaders/images
- Paint overview (fills/strokes, Skia.Paint/setColor): https://shopify.github.io/react-native-skia/docs/paint/overview
- Paint properties (HSL/argb/string color): https://shopify.github.io/react-native-skia/docs/paint/properties
- Text: https://shopify.github.io/react-native-skia/docs/text/text
- Paragraph (center, gradients): https://shopify.github.io/react-native-skia/docs/text/paragraph
- Animations (UI thread, Reanimated v3/v4 by version): https://shopify.github.io/react-native-skia/docs/animations/animations
- Textures (runOnUI / UI-thread rendering): https://shopify.github.io/react-native-skia/docs/animations/textures
- Community local-file discussions: #1068, #1941, #1248 (github.com/Shopify/react-native-skia)
