# Workpaper 07-photos — Contact photo across non-standard render surfaces

**Purpose:** roadmap-altitude feasibility + constraints for showing one contact photo (stored as a
local `file://` in the app's private sandbox) on four surfaces beyond a normal React `<Image>`.
Verify-only. Findings drive **what/how big we must store**, not implementation.

**Verified against current official docs, Aug 2026.** Confirmed platform versions:
- Expo **SDK 55** ships **React Native 0.83** + **React 19.2** — https://expo.dev/changelog/sdk-55
- `@shopify/react-native-skia` **2.6.x** is current, requires RN 0.79+ / React 19, integrates with
  Expo SDK 55 (RN 0.78-/React 18- must pin Skia ≤ 1.12.4) —
  https://shopify.github.io/react-native-skia/docs/getting-started/installation/
- `react-native-android-widget` docs — https://saleksovski.github.io/react-native-android-widget/
- `expo-notifications` API (SDK 55) — https://docs.expo.dev/versions/latest/sdk/notifications/

---

## 1. Skia orrery (`@shopify/react-native-skia` 2.6.x, RN 0.83 / SDK 55)

**Can it load a local image and clip to a circle? YES.**

- Loading is via the `useImage(source, errorHandler?)` hook, which returns an `SkImage` (or `null`
  until loaded). Manual construction: `Skia.Image.MakeImageFromEncoded(data)` where `data` is an
  `SkData` from `Skia.Data.fromBase64(...)` or `Skia.Data.fromBytes(...)`.
  Source: https://shopify.github.io/react-native-skia/docs/images/
- **Clip-to-circle is a first-class pattern.** Draw a `<Circle>` and fill it with an
  `<ImageShader image={image} fit="cover" rect={...} />` child — the image is painted only inside
  the circle. Verbatim example (Context7, Skia `docs/shaders/images.md`):
  ```tsx
  <Circle cx={128} cy={128} r={128}>
    <ImageShader image={image} fit="cover" rect={{x:0,y:0,width:256,height:256}} />
  </Circle>
  ```
  (Alternatively a `<Group>` with a circular clip, or the `<Image>` element with a clip.)

**Async-load caveats (documented):**
- `useImage` is asynchronous and **returns `null` until the image is fully loaded** — every draw
  path must guard `if (image === null) return null;`. For N planets this means N images each pop in
  independently; the orrery must tolerate partial-load frames.
- `useImage` takes an optional **error handler** as its 2nd arg — use it; a missing/corrupt photo
  file should degrade to a placeholder planet, not crash the render loop.

**`file://` support — PARTIALLY doc-confirmed, flagged:**
- Official docs demonstrate only three `useImage` sources: `require()` bundle asset, a **network URL
  string**, and a **native-bundle image name**. They do **not** explicitly document a `file://` /
  local-sandbox path, and they do **not** document `Skia.Data.fromURI`.
- The doc-*guaranteed* local path is therefore: read the file to base64 (e.g. `expo-file-system`) →
  `Skia.Image.MakeImageFromEncoded(Skia.Data.fromBase64(...))`. This is fully documented and
  removes all ambiguity. (`useImage` with a raw `file://` string works in practice via Skia's
  internal URI resolver, but that is **not** in the current docs — do not rely on it at roadmap
  level without a spike.)

**GPU memory / downscaling — NOT in Skia's own docs; general-GPU reasoning (flagged as inference):**
- The Skia image docs give **no explicit guidance** on decode cost, texture memory, or
  downscale-before-draw. Absence of guidance is not absence of cost.
- An `SkImage` handed to the GPU render loop is a decoded, uploaded texture at the image's **pixel**
  dimensions (its byte cost ≈ `width × height × 4`, independent of the JPEG's on-disk KB). N large
  photos = N large textures resident simultaneously in the orrery's render loop. A 4000×3000 phone
  photo is ~48 MB of texture each; twenty of them is a memory-pressure / GC-stutter risk on the JS
  thread's neighbour, the GPU. A 256×256 planet needs only ~0.25 MB.
- **Conclusion for storage:** decode/downscale to roughly the on-screen planet diameter (a small
  power-of-two like 128–256 px) *before* handing to Skia. Storing only a huge original forces a
  per-frame-ready decode of oversized textures. This is the render-loop-relevant reason to keep a
  small variant, even though Skia's docs don't spell it out.

**Net:** feasible and idiomatic. No hard *scheme* constraint (base64 path is documented and works
from a sandbox file). The real pull on storage is **a downscaled pixel variant**, for texture
memory, not the URI form.

---

## 2. Favourites home-screen widget (`react-native-android-widget`, current)

**What `ImageWidget` accepts — HARD constraint found.**

`ImageWidgetProps.image` is typed `ImageWidgetSource`, documented verbatim as:

> "Image loaded using `require('./path/to/image')`, or a path to image starting with **"http:"**,
> **"https:"**, or **"data:/image"**"

Source: https://saleksovski.github.io/react-native-android-widget/docs/public-api/interfaces/ImageWidgetProps
and primitives overview ("network images, data:/image images, and static resources") —
https://saleksovski.github.io/react-native-android-widget/docs/primitives/

Other props: `imageWidth: number` (required), `imageHeight: number` (required), `radius?` (rounded
corners — supports a circular avatar), `resizeMode?: center|stretch|cover|contain` (default
`contain`), `style?`, `clickAction?`, `clickActionData?`, `accessibilityLabel?`.

- **`file://` is NOT a listed source.** A sandbox photo cannot be passed by its local path. The only
  local option is a **`data:image/...;base64,...` data URI** (require() is for build-time bundled
  assets, not runtime contact photos; http/https would violate local-first — no network on a read
  path). **So: to show a contact photo on the widget, read the file and pass base64.**

**RemoteViews size limits — HARD, and they bite base64 twice:**
An Android widget *is* `RemoteViews`, marshalled across a Binder to the launcher process. Two
documented ceilings apply:
1. **RemoteViews max bitmap memory.** Exceeding it throws
   `IllegalArgumentException: RemoteViews for widget update exceeds maximum bitmap memory usage`.
   The max is **device-screen-dependent** ≈ `1.5 × displayW × displayH × 4` bytes (observed values
   ~5.3–6.2 MB; e.g. 720p → `1280×720×4×1.5 = 5,529,600`). This bounds the **decoded** bitmap
   (pixel dims × 4), summed across all bitmaps in the widget.
   Source: https://github.com/openhab/openhab-android/issues/2053 (error text + limit),
   Glide #5214.
2. **Binder `TransactionTooLargeException`** — the Binder transaction buffer is a fixed **~1 MB**
   shared across the process; a large base64 payload embedded in the RemoteViews update counts
   against it. "Avoid transferring … large bitmaps."
   Source (archived Android reference): TransactionTooLargeException docs.

- A contact avatar is tiny against #1 (256×256 = 0.25 MB decoded), but a *large original* passed as
  base64 risks **both** ceilings — decoded pixels vs #1, and the base64 string (~1.33× the file
  bytes) vs the #1 MB Binder limit. Multiple favourites in one widget compound it.

**Net:** the widget imposes the strongest constraints of the four — **must be `data:` base64 (no
`file://`)** and **must be small** (a downscaled avatar-sized variant), or widget updates throw.

---

## 3. Decay notification large icon (`expo-notifications`, SDK 55)

**Per-notification contact photo as the large icon — NOT SUPPORTED by expo-notifications.**

- The SDK 55 `NotificationContentInput` / `NotificationContentAndroid` surface exposes only
  `badge`, `color`, `priority`, `vibrationPattern` for Android content. **There is no `largeIcon`
  field**, and no per-notification image/attachment mechanism on Android. (iOS has
  `attachments`; that is iOS-only and not a large icon.)
  Source: https://docs.expo.dev/versions/latest/sdk/notifications/
- This is deliberate, not an oversight. The managed-workflow large icon was **removed** because it
  couldn't be set correctly and there was no per-notification tooling —
  https://github.com/expo/expo/pull/10492 . The notification icon configured via the
  `expo-notifications` **config plugin is app-wide and static, set at build time** (the small
  status-bar icon), not a dynamic per-contact photo.
- Related architectural limit even in bare/native: expo's Android builder hardcodes `BigTextStyle`,
  which precludes `BigPictureStyle`, so even the "big image" route is blocked without native code —
  https://github.com/expo/expo/issues/44833 .

**Net:** with `expo-notifications` alone you **cannot** put a contact's photo on a decay
notification. Options, all owner-level scope decisions, not storage-shape decisions:
- accept a static app icon on the notification (no per-contact photo), or
- write a **custom native notification module / config-plugin** that sets `setLargeIcon(Bitmap)` per
  notification from the local file (bare workflow; out of managed expo-notifications), or
- drop the photo-on-notification idea.

This surface therefore imposes **no** storage constraint today — because it can't consume the photo
at all through the supported API. If the owner later wants it, a native path decodes the same local
file to a `Bitmap` (Android caps notification large icons small anyway, ~ status-bar/notification
density), so a small variant would again suffice.

---

## 4. Net takeaway — does any surface hard-constrain the stored photo?

**Yes — two independent hard constraints, both pointing the same way: store a small downscaled
variant, and be ready to emit base64.**

| Surface | `file://` local path OK? | Hard size limit? | What it forces on storage |
|---|---|---|---|
| Skia orrery | Documented path is base64→`MakeImageFromEncoded`; raw `file://` works via undocumented resolver | No fixed cap, but each image = a GPU texture at pixel size | **Downscaled pixel variant** (~128–256 px) to keep texture memory sane in the render loop |
| Android widget | **No** — only `require`/`http(s)`/`data:` | **Yes** — RemoteViews max-bitmap (~5–6 MB, device-dependent) **and** ~1 MB Binder transaction | **Must be `data:` base64, and small.** Strongest constraint. |
| Notification large icon | N/A — unsupported by expo-notifications | N/A | None today (can't consume the photo). Native route would also want small. |
| Normal React `<Image>` (baseline) | Yes (`file://`) | No | none |

**Decision-shaping conclusions for the photo-storage design:**

1. **Keep at least one downscaled variant** (small, avatar-sized, e.g. ≤256 px square). Every
   non-baseline surface that *can* show the photo either needs it (widget's byte ceilings; Skia's
   texture cost) or benefits from it. Storing only a full-res original is not sufficient for the
   widget and is wasteful for the orrery.
2. **Storage scheme:** keep the file on disk as today (`file://` sandbox) — good for Skia (base64
   or resolver) and baseline `<Image>`. But the **widget cannot read a `file://`**, so the pipeline
   must be able to **produce a base64 `data:` URI** from that file on demand, and small enough to
   clear ~1 MB Binder. Base64 of a 256-px JPEG (~10–30 KB → ~13–40 KB base64) clears everything.
3. **No single "specific uri scheme" satisfies all** — Skia wants an `SkImage` (base64 or
   file-resolver), the widget wants `data:`/`http(s)`, notifications want a native `Bitmap`. The
   common denominator is: **a small variant on disk that can be cheaply re-encoded to base64.**
4. The notification surface is a **product/scope decision for the owner**, not a storage constraint:
   photo-on-notification is impossible via managed `expo-notifications` and needs a native module if
   wanted at all.

---

## Sources
- Expo SDK 55 changelog (RN 0.83, React 19.2, expo-notifications Android fixes) — https://expo.dev/changelog/sdk-55
- Skia installation / version compat — https://shopify.github.io/react-native-skia/docs/getting-started/installation/
- Skia images (`useImage`, `MakeImageFromEncoded`, async null, error handler) — https://shopify.github.io/react-native-skia/docs/images/
- Skia image-shader circle clip example (Context7, `docs/shaders/images.md`)
- react-native-android-widget `ImageWidgetProps` — https://saleksovski.github.io/react-native-android-widget/docs/public-api/interfaces/ImageWidgetProps
- react-native-android-widget primitives overview — https://saleksovski.github.io/react-native-android-widget/docs/primitives/
- expo-notifications API (no Android largeIcon field) — https://docs.expo.dev/versions/latest/sdk/notifications/
- expo/expo PR #10492 (large icon removed from managed workflow) — https://github.com/expo/expo/pull/10492
- expo/expo #44833 (BigTextStyle hardcoded, blocks BigPictureStyle) — https://github.com/expo/expo/issues/44833
- RemoteViews max-bitmap-memory error + ~1.5×screen formula — https://github.com/openhab/openhab-android/issues/2053 ; Glide #5214
- Binder ~1 MB TransactionTooLargeException — Android reference (TransactionTooLargeException)
