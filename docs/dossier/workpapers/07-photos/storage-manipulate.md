# Workpaper 07-photos — Photo storage & manipulation (platform verification)

**Verified against:** Expo **SDK 55** official docs (`docs.expo.dev/versions/v55.0.0/...`), fetched 2026-08-13.
**Repo state at verification:** `orbit-app` has no `package.json`/`src/` yet (docs-only pre-implementation repo). Nothing to reconcile against existing code; this is forward-looking platform research for a future photos phase. Target stack per prompt: Expo SDK 55, react-native 0.83.4.

**Scope reminder (product):** each contact's photo is a local file; a nullable TEXT path column points at it. Picked image must be copied into the app's private persistent sandbox, rendered on cards/profile, deleted on purge or replacement. `allowBackup=false`, data gone on uninstall.

---

## 1. expo-file-system — SDK 55 current (non-legacy) API

**Source:** https://docs.expo.dev/versions/v55.0.0/sdk/filesystem/ (page marked SDK v55.0.0, modified 2026-05-23).
**Blog (context):** https://expo.dev/blog/expo-file-system ("Expo File System gets a major upgrade in SDK 54").
**Changelog:** https://github.com/expo/expo/blob/main/packages/expo-file-system/CHANGELOG.md

The class-based `File` / `Directory` / `Paths` API is the **default export** of `expo-file-system` as of SDK 54 and remains default in SDK 55. Import: `import { File, Directory, Paths } from 'expo-file-system';`

### Paths
- `Paths.document` — **the persistent document directory**, returned as a `Directory` object with a `.uri`. Docs describe it as "a place to store files that are **safe from being deleted by the system**." This is the successor to the legacy `FileSystem.documentDirectory` string. **Yes — use `Paths.document` now.**
- `Paths.cache` — a `Directory`; "files that **can be deleted by the system** when the device runs low on storage." Successor to `cacheDirectory`.
- `Paths.bundle`, `Paths.availableDiskSpace`, `Paths.totalDiskSpace` also exist.
- `Paths.*` directories are `Directory` instances (have `.uri`), not bare strings — a behavioral change from the legacy string constants.

### File construction
- `new File(Paths.document, 'avatars', 'abc.jpg')` — path segments are joined into a URI. First arg may be a `Directory` or a string.
- `new File(uriString)` — **accepts a `file://` URI string directly** (confirmed by the document-picker example in the docs, which does `new File(result.assets[0].uri)`). This is what lets us wrap a picker/manipulator output URI.

### Instance methods / properties (the ones we need)
- `.copy(destination)` — copies the file; `destination` may be a `File` or a `Directory`. Used as `sourceFile.copy(destFile)`.
- `.move(destination)` — same shape, moves instead of copies.
- `.delete()` — deletes the file.
- `.exists` — **property** (boolean), not a method. Replaces `getInfoAsync().exists`.
- `.size` — **property** (bytes). Replaces `getInfoAsync().size`.
- `.uri` — the file's URI (store THIS string in the TEXT column).
- `.create()` on a `Directory` creates it; **throws if it already exists** — guard with `.exists` first.
- Static `File.downloadFileAsync(url, destination)` exists (not needed for local photos, but that's the download path).
- Read/write helpers: `.write()`, `.text()`/`.textSync()`, `.bytes()`, `.base64()`.

### Concrete: copy a picked/manipulated image into the persistent sandbox (NEW API)

```ts
import { File, Directory, Paths } from 'expo-file-system';

// sourceUri = file:// URI from expo-image-picker OR from image-manipulator saveAsync()
function persistAvatar(sourceUri: string, contactId: string): string {
  const dir = new Directory(Paths.document, 'avatars');
  if (!dir.exists) dir.create();

  const src = new File(sourceUri);
  const dest = new File(dir, `${contactId}.jpg`);
  if (dest.exists) dest.delete();     // .copy() does not silently overwrite; clear first

  src.copy(dest);                      // dest.uri is the persistent path
  return dest.uri;                     // <- store in the nullable TEXT photo_path column
}

function deleteAvatar(storedUri: string): void {
  const f = new File(storedUri);
  if (f.exists) f.delete();            // call on purge AND before replacement
}
```

Notes:
- `.copy()` / `.delete()` / `.exists` / `.create()` in the docs are shown **synchronous** (no `await`) in the class API — a deliberate design of the rewrite. Verify blocking behavior on the real device during the phase; wrap in try/catch regardless.
- Store `dest.uri` (a `file://...` string), not the `File` object.

### Legacy API — still available, still what most tutorials show
- The old function API lives at **`expo-file-system/legacy`**: `documentDirectory`, `cacheDirectory`, `copyAsync`, `deleteAsync`, `getInfoAsync`, `readAsStringAsync`, `writeAsStringAsync`, `downloadAsync`.
- It **still works** in SDK 55 (explicit back-compat shim) but the top-level (non-`/legacy`) forms are **deprecated** — the docs stamp "Deprecated: Import this method from `expo-file-system/legacy`."
- **Most blog posts / Stack Overflow / LLM-recalled snippets still show `FileSystem.documentDirectory + copyAsync/deleteAsync`.** Treat any such snippet as legacy. For a brand-new file written in SDK 55, use the `File`/`Paths` API; do not mix — a `Paths.document` `Directory` is not a drop-in for the old string concatenation.

---

## 2. Where persistent files live on Android

- `Paths.document` (== legacy `documentDirectory`) maps to the app's **private internal storage** on Android — under `/data/data/<package>/files/` (app sandbox). Not world-readable, not on shared/external storage.
- **Survives app restarts and OS cache eviction.** Docs explicitly contrast `document` ("safe from being deleted by the system") vs `cache` ("can be deleted by the system when the device runs low on storage"). Avatars MUST live under `Paths.document`, never `Paths.cache`.
- Because it is inside the app private sandbox, it is **deleted on uninstall** — consistent with the app's local-first, no-backup posture (`allowBackup=false` means it is also excluded from Android auto-backup, so photos never leave the device via cloud backup either). This is the desired behavior: photo lifecycle == app lifecycle.
- Image-picker and image-manipulator both write their outputs to the **cache** directory first, so the copy-to-`document` step in §1 is mandatory — a picked/manipulated URI left un-copied can be evicted by the OS at any time.

---

## 3. expo-image-manipulator — SDK 55 current API

**Source:** https://docs.expo.dev/versions/v55.0.0/sdk/imagemanipulator/ (SDK v55.0.0, modified 2026-01-22). npm current major: **14.x**.

- `manipulateAsync(...)` is **deprecated** (since SDK 52) — "replaced by the new, contextual and object-oriented API." Still functional for one-shot back-compat, but do not write new code against it.
- **New API:**
  - `ImageManipulator.manipulate(source)` — returns an `ImageManipulatorContext`. `source` accepts a URI string (the picker's `file://` uri).
  - `useImageManipulator(source)` — React hook variant returning the same context, with automatic memory management; use inside components.
- Context methods are **chainable + synchronous** (scheduled on a background thread): `.resize(...)`, `.crop(...)`, `.rotate(...)`, `.flip(...)`, `.extent(...)`.
- Finish with `await context.renderAsync()` → returns an `ImageRef`, then `await imageRef.saveAsync(options)` → returns `{ uri, width, height }` (+ `base64` if requested). The saved file lands in the **cache** dir → must be copied to `Paths.document` per §1.
- `SaveOptions`: `compress` (0..1, `1` = highest quality / least compression), `format` = `SaveFormat.JPEG | SaveFormat.PNG | SaveFormat.WEBP`, `base64` (boolean).
- `.resize({ width, height })` — pass one dimension and omit/null the other to preserve aspect ratio.
- `.crop({ originX, originY, width, height })` — yes, it can crop to a square by cropping to equal width/height (compute the centered square offset yourself).

### Concrete: downscale a 4000px camera photo to ~512px square JPEG

```ts
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

async function makeAvatar(sourceUri: string): Promise<string> {
  const ctx = ImageManipulator.manipulate(sourceUri);

  // 1) center-square crop, 2) downscale to 512. (Ideally read real dims first —
  //    from the picker asset .width/.height — to compute the centered square.)
  // Assuming a square source for illustration:
  ctx.resize({ width: 512, height: 512 });

  const rendered = await ctx.renderAsync();
  const out = await rendered.saveAsync({
    compress: 0.75,          // ~0.7–0.8 is a good avatar sweet spot
    format: SaveFormat.JPEG, // JPEG for photos; smallest, universal
  });
  return out.uri; // cache dir → then persistAvatar(out.uri, contactId) per §1
}
```

Correct order for a non-square source: get the source `width`/`height` (expo-image-picker returns them on the asset), compute the centered square `crop`, THEN `resize` to 512×512, then save. Cropping before resizing keeps the aspect handling explicit.

---

## 4. Recommended avatar sizing (engineering guidance — estimates, not a spec)

No Expo doc prescribes avatar dimensions; this is standard mobile-image practice, flagged as estimate.

- **Store one square JPEG per contact.** A single **512×512** master avatar is enough for both the profile view and the dashboard grid (expo-image downsamples per-view, §5). 256×256 is viable if profile display size is small, but 512 gives headroom for larger profile headers and high-DPI screens at trivial cost.
- **Quality ~0.7–0.8** (`compress: 0.7–0.8`). JPEG format.
- **Rough file sizes** (photographic content, JPEG q≈0.75): **512×512 ≈ 30–60 KB**; **256×256 ≈ 10–20 KB**. For "tens" of contacts this is well under ~1–3 MB total on disk — negligible. Do NOT store the original multi-MB camera capture; always run it through §3 first.
- One size is simpler than maintaining a thumbnail+full pair, and avoids a second file to track/delete. Let expo-image handle display-size downscaling rather than persisting multiple resolutions.

---

## 5. expo-image as the avatar render component

**Source:** https://docs.expo.dev/versions/v55.0.0/sdk/image/ (SDK v55.0.0). Already an intended dep.

- **Yes — `expo-image` is the right render component for local `file://` avatars.** Its `source` accepts "a remote URL, **a local file resource**, or a `require()` number." (Docs don't call out `file://` by name but local file resources are supported; standard usage passes `{ uri: 'file://...' }` or the bare uri string.)
- **Own caching:** `cachePolicy` prop with `'memory' | 'disk' | 'memory-disk' | 'none'`. For our own on-disk avatars, disk caching is partly redundant (the file already persists), but **`'memory'` or `'memory-disk'` is worth it** for a scrolling dashboard grid so repeated small avatars stay decoded in memory.
- **Own downscaling:** `allowDownscaling` prop, **default `true`** — "the image should be downscaled to match the size of the view container." So one 512×512 master rendered into a small round grid cell is downsampled by expo-image automatically; no need to persist a separate thumbnail (confirms §4).
- **Recommended avatar props:** `contentFit="cover"` (fill the round frame, crop overflow), `cachePolicy="memory-disk"`, `recyclingKey={contactId}` (critical in FlashList/FlatList grids — prevents showing the previous contact's avatar before the new one loads), optional short `transition` (e.g. `150`) for a soft fade. Round shape via container `borderRadius` / overflow-hidden wrapper.

---

## Decision-changing summary

1. **Use the new `File`/`Directory`/`Paths` API, not the legacy string API.** `Paths.document` is the persistent dir; wrap picker/manipulator output with `new File(uri)`, `.copy()` into a `avatars/` `Directory` under `Paths.document`, `.delete()` on purge/replace. `.exists`/`.size` are properties. Legacy (`documentDirectory`+`copyAsync`) still works under `expo-file-system/legacy` and is what nearly every tutorial/LLM snippet shows — reject those on sight. (SDK v55.0.0 filesystem docs.)
2. **Avatars MUST live under `Paths.document`, never `Paths.cache`.** Picker and manipulator both output to cache, which the OS can evict; the copy-to-document step is mandatory. Document dir is app-private, survives restarts, deleted on uninstall — matches `allowBackup=false` local-first posture. (Same doc.)
3. **`manipulateAsync` is deprecated; use `ImageManipulator.manipulate(uri)` → chain `.crop()/.resize()` → `renderAsync()` → `saveAsync({ compress, format: SaveFormat.JPEG })`.** Can crop to square and downscale to 512. (SDK v55.0.0 imagemanipulator docs, pkg 14.x.)
4. **Store one 512×512 JPEG at quality ~0.75 (~30–60 KB).** No thumbnail pair needed — expo-image downsamples per view (`allowDownscaling` default true). (Engineering estimate + expo-image docs.)
5. **`expo-image` is the correct renderer for local avatars:** `contentFit="cover"`, `cachePolicy="memory-disk"`, `recyclingKey` per contact in list grids. Handles its own caching + downscaling. (SDK v55.0.0 image docs.)

**Open item to nail down during the phase:** confirm whether the class-API `.copy()/.delete()/.create()` are truly synchronous-blocking on-device (docs show no `await`) and their overwrite behavior on an existing destination — the snippets above defensively `delete()` before `copy()`.
