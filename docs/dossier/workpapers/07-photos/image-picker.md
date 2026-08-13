# Workpaper — expo-image-picker (native photo capture for contact avatars)

**Domain:** 07-photos
**Decision anchor:** HANDOFF §14.3 — "native image picker with local file storage" [DECIDED]
**Verified against:** Expo SDK **55.0.0** official docs (versioned page dated 2026-07-20). react-native 0.83.4.
**Task type:** read/verify only — no code changed.

Primary sources:
- SDK 55 versioned API: https://docs.expo.dev/versions/v55.0.0/sdk/imagepicker/
- Latest (tracks 55): https://docs.expo.dev/versions/latest/sdk/imagepicker/
- Tutorial (usage patterns): https://docs.expo.dev/tutorial/image-picker/
- CHANGELOG: https://github.com/expo/expo/blob/main/packages/expo-image-picker/CHANGELOG.md

---

## 1. Current API (SDK 55)

Both entry points return `Promise<ImagePickerResult>`:

- `launchImageLibraryAsync(options?: ImagePickerOptions)` — opens the OS photo library/picker.
- `launchCameraAsync(options?: ImagePickerOptions)` — opens the camera.

### `mediaTypes` — spelling changed (stale-tutorial trap)

- **Current:** `mediaTypes` takes an **array of string literals**: `MediaType[]` where `MediaType = 'images' | 'videos' | 'livePhotos'`.
  - e.g. `mediaTypes: ['images']`.
- **Deprecated:** the `MediaTypeOptions` enum (`.All` / `.Images` / `.Videos`). Docs verbatim: *"Deprecated: To set media types available in the image picker use an array of `MediaType` instead."*
- Almost every tutorial older than ~SDK 51 still shows `mediaTypes: ImagePicker.MediaTypeOptions.Images`. That still resolves for now but is on the deprecation path. For avatars use `['images']`.

### Result shape — `ImagePickerResult`

```ts
{
  canceled: boolean,
  assets: ImagePickerAsset[] | null   // null when canceled
}
```

`ImagePickerAsset` (relevant fields):

| field | type | notes |
|---|---|---|
| `uri` | string | local `file://` path (see §4) |
| `width` | number | pixel width of the returned image |
| `height` | number | pixel height |
| `fileName` | string \| null | may be null |
| `mimeType` | string | e.g. `image/jpeg` |
| `fileSize` | number | bytes |
| `assetId` | string \| null | Android/iOS media-store id |
| `type` | `'image' \| 'video' \| 'livePhoto' \| 'pairedVideo' \| null` | |
| `base64` | string \| null | only when `base64: true` requested |
| `exif` | object \| null | only when `exif: true` requested |
| `duration` | number \| null | videos only |

**Always read `assets[0]`, and gate on `!result.canceled`.** There is no top-level `uri` anymore — the pre-SDK-48 flat result (`{ cancelled, uri, width, height }`, note old British `cancelled` spelling) is gone. Stale tutorials that read `result.uri` or `result.cancelled` will break.

---

## 2. Cropping / editing

- `allowsEditing: true` gives an in-flow crop/edit UI. Docs verbatim: on **"Android the user can crop and rotate the image and on iOS simply crop it."** So on Android you get crop **+ rotate**; iOS is crop-only.
- `aspect: [number, number]` forces a fixed crop ratio — e.g. `aspect: [1, 1]` for a **square** (ideal for round "planet" avatars, since a square source crops cleanly to a circle in the UI).
  - **`aspect` is Android-only.** Docs verbatim: *"This is only applicable on Android."* On iOS the system editor always uses a square crop and ignores `aspect`. For our square-avatar goal this is actually convenient: `aspect: [1,1]` on Android + iOS's default square = square on both, but for different reasons.
- Free-form vs fixed: with `allowsEditing` and no `aspect`, Android crop is free-form; setting `aspect` locks the ratio. iOS is effectively fixed-square regardless.
- **Known Android `allowsEditing` caveats:**
  - The crop UI is provided by a bundled cropper, not the OS — behavior/appearance is styleable via the config plugin `colors.*` props (see §3), which implies it's Expo's own crop screen.
  - `allowsEditing` is **incompatible with `allowsMultipleSelection: true`** (multi-select disables editing). Not relevant for single-avatar capture, but worth knowing.
  - The crop output is written to cache as a **new** file (e.g. `cropped<n>.jpg`), separate from the original — so the persisted file is the cropped one.

---

## 3. Permissions on modern Android (API 33+ / Android 13+)

### Library (`launchImageLibraryAsync`) — **no runtime permission prompt**

- Docs verbatim: **"No permissions request is necessary for launching the image library."**
- On Android 13+ the picker routes through the **system Photo Picker**, which grants scoped, per-selection access. Your app never holds broad storage permission and the user sees no allow/deny dialog — the picker itself is the consent surface. This satisfies Google Play's photo/video permissions policy without a runtime prompt.
- `requestMediaLibraryPermissionsAsync()` still exists and the tutorial calls it defensively, but on Android it is effectively a no-op for the picker path. The one place an upfront request matters is **iOS video** (a system dialog can appear *after* selection). Not relevant to image-only avatars.

### Camera (`launchCameraAsync`) — **DOES need CAMERA permission**

- Camera is a genuine runtime permission. Call `requestCameraPermissionsAsync()` (returns a status object; also `useCameraPermissions()` hook) before `launchCameraAsync`, and handle denial.
- This is the asymmetry to design around: **"choose from library" needs no prompt; "take a photo" does.**

### Config plugin / manifest

Add the plugin in `app.json`/`app.config`:

```json
["expo-image-picker", {
  "photosPermission": "…",            // iOS only (NSPhotoLibraryUsageDescription)
  "cameraPermission": "Allow Orbit to take a contact photo.",  // → NSCameraUsageDescription + Android CAMERA
  "microphonePermission": false,      // drops RECORD_AUDIO — we never record audio
  "colors": { "cropToolbarColor": "#…", "cropBackgroundColor": "#…", /* … */ }
}]
```

- The library **auto-adds** Android `CAMERA`, `READ_EXTERNAL_STORAGE`, `WRITE_EXTERNAL_STORAGE` to the manifest (and on API 33+, `READ_MEDIA_IMAGES`). Setting a permission string to `false` removes it at prebuild.
- Since we do image-only and want minimal footprint: set `microphonePermission: false`. Consider dropping camera entirely (set `cameraPermission: false`) **if** the owner decides avatars are library-only — that removes the `CAMERA` permission and the Play Store camera-permission declaration.
- `colors.*` (cropToolbarColor, cropToolbarIconColor, cropToolbarActionTextColor, cropBackButtonIconColor, cropBackgroundColor) style the Android crop screen. Note: these are **hex string** plugin inputs baked at build time — they will NOT resolve through our runtime theme tokens. If the crop screen must match an active theme profile, that's a mismatch to flag (crop UI is a separate native screen, not part of our Skia/React tree).

---

## 4. Returned URI lifetime — **CACHE, must copy to persist**

- The returned `uri` is a **`file://`** path in the app's **cache** directory. Docs example verbatim: `"uri": "file:///data/user/0/host.exp.exponent/cache/cropped1814158652.jpg"`.
- It is **`file://`, not `content://`** — usable directly by `expo-file-system`, `<Image>`, and Skia image loaders without resolving a content resolver. (The system Photo Picker hands the native module a `content://`, but expo-image-picker copies it into app cache and returns the `file://` copy.)
- **Cache is OS-evictable.** Android can purge the cache dir under storage pressure, and it is cleared on "Clear cache." Therefore the picked file is **not safe as the permanent avatar store.** To honor "local file storage" [DECIDED], we must **copy the returned file into a persistent app directory** (`expo-file-system` document directory, e.g. `documentDirectory + 'avatars/<contactId>.jpg'`) and store that persistent path — never persist the raw picker `uri`.
- Corollary for the data layer: store a stable relative path/filename in SQLite, resolve to an absolute `file://` at read time. Do not store the cache URI.

---

## 5. `quality` / compression

- `quality: number` in **`0`–`1`** (0 = max compression/smallest, 1 = best). Applies to the JPEG re-encode the picker performs.
- **`quality` compresses; it does NOT resize dimensions.** The returned `width`/`height` reflect the source (or cropped) pixel dimensions, not a downscale. A 4000×3000 phone photo comes back at full resolution even at `quality: 0.5`. For small round avatars we will want an **explicit downscale/resize step** (e.g. `expo-image-manipulator`) after the pick — the picker alone won't shrink dimensions.
- iOS caveat (verbatim): *"On iOS, if a .bmp or .png image is selected from the library, this option is ignored."* Android honors it for the JPEG output.

---

## 6. Surprises / stale-tutorial traps (summary)

1. `MediaTypeOptions` enum is deprecated → use `mediaTypes: ['images']`.
2. Result is `{ canceled, assets: [] }` — no flat `result.uri`; old spelling was `cancelled` (double-l) pre-SDK-48.
3. Library pick needs **no** runtime permission on Android 13+ (system Photo Picker); **camera still does**.
4. Returned file lives in **evictable cache** — must copy to persistent storage; it's `file://` not `content://`.
5. `aspect` is **Android-only**; iOS crop is always square.
6. `quality` compresses but does **not** resize — need `expo-image-manipulator` for a true avatar downscale.
7. Crop-screen styling is a **build-time hex** plugin input, not a runtime theme token.

---

## Open items for the owner (decision-shaping)

- **Camera or library-only?** Library-only removes the `CAMERA` runtime permission and a Play Store declaration; adds zero friction. Camera adds a genuine permission prompt to design around.
- **Resize pipeline:** picker does not downscale — do we pull in `expo-image-manipulator` to cap avatar dimensions (recommended: something like 512×512) before persisting? Affects on-disk footprint.
- **Crop-screen theming:** the Android crop UI cannot follow our runtime theme tokens (build-time hex only). Accept the visual seam, or skip `allowsEditing` and crop in-app with our own Skia UI?
