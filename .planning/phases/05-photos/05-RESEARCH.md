# Phase 5: Photos - Research

**Researched:** 2026-08-15
**Domain:** Mobile photo pipeline (Expo SDK 57 / RN 0.86) — system photo-library picker + pasted-URL download, in-app Skia crop, one 512×512 JPEG master under the document dir, deterministic themed-initials fallback avatar
**Confidence:** HIGH (APIs verified against official Expo SDK docs + on-disk code; crop-rect math is the one MEDIUM area, resolved on-device)

## Summary

Phase 5 builds a single photo pipeline reused by contacts, the self/profile record, and custom `photo`-type fields. Every path — picker or pasted URL — converges on **one 512×512 JPEG master (~30–60 KB, q≈0.75)** written under the persistent document dir, stored as a **relative filename** and resolved to `file://` at read. There is no thumbnail pair and no original retained. When there is no photo, a **deterministic initials avatar** renders, coloured from a **finite themed swatch set** (new theme token) — never the plugin's free HSL hue.

The stack is entirely first-party Expo / Shopify / Software Mansion modules, none currently installed: `expo-image-picker`, `expo-image-manipulator`, `expo-file-system` (new class API), `expo-image`, `@shopify/react-native-skia`, `react-native-reanimated`, `react-native-gesture-handler`. All resolve to SDK-57-compatible versions via `npx expo install`. The two subtle correctness areas are (1) the **cache→document copy** (picker/manipulator write to evictable cache; skipping the copy silently loses avatars) and (2) the **purge cleanup adapter**, which receives only `contactId` **post-commit after the rows are already deleted** — so photo filenames must be *derivable from `contactId`* rather than read from the (now-gone) DB rows.

**Primary recommendation:** Build the interactive crop as a **Skia `Canvas` preview driven by Reanimated shared values** (pan + pinch over a fixed 1:1 viewport, no rotation), but do the **actual pixel crop with `expo-image-manipulator.manipulate(originalUri).crop(rect).resize({512,512}).renderAsync().saveAsync(JPEG, 0.75)`** on the *original* source URI — never a Skia `makeImageSnapshot()` (that captures at lossy screen resolution). Compute the crop rect in source-pixel coordinates from the shared-value transform at confirm time. Then copy the manipulator's cache output into `Paths.document` with a **deterministic, `contactId`-derivable filename**, delete-before-copy on replace, and register the `onPurgeExtensions` adapter to delete those derivable filenames on purge.

## User Constraints

> No per-phase CONTEXT.md exists by design (pre-discussion complete). The authoritative locked
> decisions come from `docs/dossier/07-photos.md`, `docs/dossier/INDEX.md` `[photos → *]` rows,
> `HANDOFF.md` §14.3/§14.8/§4, the approved `05-UI-SPEC.md`, and `REQUIREMENTS.md` PHOTO-01…05.
> These are LOCKED — research is HOW to implement, never whether to revisit.

### Locked Decisions (do not reopen)

- **Source = system photo library only. No in-app camera.** `launchImageLibraryAsync` routes through the Android 13+ system Photo Picker with **no runtime permission prompt**. Camera is REJECTED (adds `CAMERA` permission + Play declaration). Config-harden: `cameraPermission: false`, `microphonePermission: false` so `CAMERA`/`RECORD_AUDIO` never enter the manifest.
- **Framing = in-app custom Skia crop.** NOT the native `allowsEditing` crop screen (build-time hex, cannot follow runtime theme) and NOT render-time auto-crop. Skip `allowsEditing`; take the raw picked image; present our own crop.
- **Crop interaction model = pan + pinch-zoom over a fixed 1:1 square viewport; NO rotation** (05-UI-SPEC resolves the deferred question). Portrait-locked.
- **URL entry path is KEPT** (controlled reversal of HANDOFF §14.3) alongside the picker; it **downloads once** to the same local 512px master. Only `ImageScraper`'s download + content-type→extension logic is re-ported (as `fetch`/`downloadFileAsync`, not Obsidian `requestUrl`); its wikilink/vault-path/folder-conflict logic stays deleted. The one network hit is on the **write** path at paste time only — reads are never network.
- **One 512×512 JPEG master, q≈0.75 (~30–60 KB). No thumbnail pair, no original retained.** `expo-image` self-downscales the one master for both grid and profile.
- **Store under the persistent document dir via the new `expo-file-system` class API (`File`/`Paths`), NOT the deprecated `documentDirectory`/`copyAsync`.** The picker AND the manipulator write to **evictable cache** first; the copy-to-`Paths.document` step is **mandatory** or avatars silently vanish when Android purges cache.
- **`contacts.photo` / `profile.photo` store a RELATIVE filename** under the document dir, resolved to an absolute `file://` at read (absolute paths are device-specific and break on restore).
- **Photo is edit-only** — never on the create form.
- **Replace/remove deletes the old file inline, non-undoable** (no `field_history` for binaries). No launch-time orphan sweep in v1.
- **Purge deletes the contact photo file AND any custom photo-field files.** Wired via the existing Phase-4 `onPurgeExtensions` post-commit adapter.
- **Initials fallback = deterministic per-contact colour quantized to a themed swatch set** (new `avatarSwatches` theme token), NOT free HSL. Same hash, indexes the swatch array instead of producing a hue. Empty name → blank swatch, no glyph.
- **Custom `photo` field reuses this exact pipeline** verbatim; purge/backup/orphan/fallback rules extend to it.
- **`MediaTypeOptions` is deprecated** → `mediaTypes: ['images']`; result is `{ canceled, assets[] }` (no flat `result.uri`).
- **`expo-image` render config:** `contentFit="cover"`, `cachePolicy="memory-disk"`, `recyclingKey={contactId}` in grids.

### Claude's Discretion (planner decides)

- Exact on-disk filename scheme (recommend `contactId`-derivable — see Architecture) and document subdir (`avatars/`).
- Whether contact vs custom-field photos separate into subdirs.
- Exact swatch count (05-UI-SPEC recommends **8**) and starter hex seeds (owner-tunable).
- DAO method shapes for the photo write path (net-new — see below).

### Deferred Ideas (OUT OF SCOPE this phase)

- Base64 `data:` URI emission for the widget (Phase 12) and Skia orrery texture use (Phase 13) — the small master satisfies both but the emit code is those phases' work.
- JSON export embedding base64 photo bytes (Phase 16 backup domain).
- Per-notification large icon (Phase 11 notify — **not possible** in managed expo-notifications; not a storage concern).
- Images-as-fuel and the vault importer (cut entirely).

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PHOTO-01 | Set a contact's/own photo from the system photo library (no camera, no runtime permission) + frame with in-app Skia crop | `launchImageLibraryAsync({mediaTypes:['images']})` — no permission; Skia+Reanimated crop surface + ImageManipulator crop/resize (Standard Stack, Architecture Pattern 1 & 2) |
| PHOTO-02 | Also set a photo by pasting a URL, downloading once to the same local master | `File.downloadFileAsync(url, cacheDir)` → same crop/manipulate/copy pipeline; content-type→ext re-ported from `ImageScraper` (Architecture Pattern 3) |
| PHOTO-03 | One 512×512 JPEG master under the persistent document dir (copied out of cache), relative filename resolved to `file://` at read *(infra)* | `expo-file-system` class API `Paths.document` + `File.copy` (delete-before-copy); relative-store/`file://`-resolve helper (Architecture Pattern 4, Pitfalls 1 & 3) |
| PHOTO-04 | No-photo contact shows a deterministic initials avatar from a themed swatch set (no free HSL, no hardcoded colour) | `avatarSwatches`/`avatarSwatchText` theme tokens; ported hash indexes swatch array; `check:colors` gate (Architecture Pattern 5) |
| PHOTO-05 | Replacing/removing deletes the old file inline (non-undoable); purge deletes contact + custom photo-field files | Inline `File.delete()`; `onPurgeExtensions` adapter with `contactId`-derivable filenames (Architecture Pattern 6, Pitfall 2 — the load-bearing finding) |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Pick image from library | Native (system Photo Picker via expo-image-picker) | — | OS-owned picker; no permission, no in-app UI |
| Download pasted URL | Service (one-time write path) | Native FS | `fetch`/`downloadFileAsync`; never on a read path |
| Interactive crop preview | UI (Skia Canvas + Reanimated) | — | Off-JS-thread render loop; gesture transform via shared values |
| Pixel crop + resize + encode | Service (expo-image-manipulator) | Native FS (cache) | Operates on original URI for full fidelity; writes to cache |
| Persist master | Data/Storage (expo-file-system class API) | — | Copy cache→document; relative filename is the stored value |
| Store filename reference | Database (`contacts.photo` / `profile.photo` / `contact_custom_values` TEXT) | — | Already-existing TEXT columns; no new migration |
| Render avatar / fallback | UI (`expo-image` + Skia/RN) | Theme tokens | `file://`-resolved master or themed-initials swatch |
| Delete on replace/remove/purge | Service + Data | Native FS | Inline `File.delete()`; purge adapter post-commit |

## Standard Stack

All packages are first-party (Expo / Shopify / Software Mansion), none currently in `package.json`. **Install with `npx expo install <pkg>`** (not `npm install`) so the SDK-57 `bundledNativeModules` pins resolve — do not hand-pin `latest`, since Skia/Reanimated/gesture-handler are RN-version-coupled native modules.

### Core
| Library | Version (SDK 57) | Purpose | Why Standard |
|---------|------------------|---------|--------------|
| `expo-image-picker` | 57.0.x `[CITED: docs.expo.dev/versions/latest/sdk/imagepicker]` | Launch the system photo library, get a local cache URI | Android 13+ Photo Picker, no runtime permission; the Expo-blessed picker |
| `expo-image-manipulator` | 57.0.x `[CITED: docs.expo.dev/versions/latest/sdk/imagemanipulator]` | Crop + resize + JPEG-encode the 512px master | Context-based `manipulate()` API; off-thread; first-party |
| `expo-file-system` | 57.0.x `[CITED: docs.expo.dev/versions/latest/sdk/filesystem]` | New `File`/`Paths`/`Directory` class API: copy cache→document, delete, download, base64 | The non-deprecated class API; legacy fns now throw unless imported from `/legacy` |
| `expo-image` | 57.0.x `[CITED: dossier + docs.expo.dev]` | Render local avatar (grid + profile), self-downscaling | One master serves all sizes; `cachePolicy`/`recyclingKey` |
| `@shopify/react-native-skia` | 2.x (expo-install-resolved) `[VERIFIED: npm registry — github.com/Shopify/react-native-skia]` | Crop-preview Canvas; later the orrery | Off-JS-thread render loop; `useImage(file://)` confirmed working (orrery domain) |
| `react-native-reanimated` | 4.x (expo-install-resolved) `[VERIFIED: npm registry — github.com/software-mansion/react-native-reanimated]` | Shared values driving the crop transform | Animation engine (HANDOFF §7 stale "Skia clock" superseded — Reanimated drives) |
| `react-native-gesture-handler` | 3.x (expo-install-resolved) `[VERIFIED: npm registry — github.com/software-mansion/react-native-gesture-handler]` | Pan + pinch gestures feeding shared values | Standard RN gesture layer, pairs with Reanimated |

> **Version note:** the dossier/INDEX platform-verification snapshot cited "Skia 2.6.2 + Reanimated 4.5.1"; current registry latest is Skia 2.11.0 / Reanimated 4.5.3 / gesture-handler 3.2.1. Let `npx expo install` pick the SDK-57-pinned version rather than the table's numbers — the exact pin is whatever `expo install` resolves. `[VERIFIED: npm registry]`

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| (none new) | — | — | The initials hash, `formatLocalDate`, uid gen, logger already live in `src/`. No date/hash util needs adding. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| expo-image-manipulator for the crop | Skia `makeImageSnapshot()` on the crop Canvas | REJECT — snapshots at lossy screen resolution, not source resolution; the manipulator crops the original URI at full fidelity |
| expo-file-system class API | legacy `FileSystem.copyAsync`/`documentDirectory` | REJECT — deprecated; direct use throws at runtime (must import from `expo-file-system/legacy`); most tutorials show the dead API |
| `MediaTypeOptions.Images` | `mediaTypes: ['images']` | REJECT — enum is deprecated |

**Installation:**
```bash
npx expo install expo-image-picker expo-image-manipulator expo-file-system expo-image @shopify/react-native-skia react-native-reanimated react-native-gesture-handler
```
Then add to `app.json` `plugins` (currently `["expo-sqlite","expo-status-bar"]`) — a **rebuild** of the dev/release APK is required for config-plugin changes (not an Expo Go / fast-refresh change):
```json
["expo-image-picker", { "cameraPermission": false, "microphonePermission": false }]
```
Reanimated also needs its Babel plugin (`react-native-reanimated/plugin`) as the **last** entry in `babel.config.js`, and gesture-handler needs the app root wrapped in `GestureHandlerRootView`. `[CITED: docs.expo.dev / reanimated + gesture-handler setup]`

## Package Legitimacy Audit

| Package | Registry | Age | Source Repo | Verdict | Disposition |
|---------|----------|-----|-------------|---------|-------------|
| expo-image-picker | npm | mature (Expo core) | github.com/expo/expo | OK | Approved |
| expo-image-manipulator | npm | mature (Expo core) | github.com/expo/expo | OK | Approved |
| expo-file-system | npm | mature (Expo core) | github.com/expo/expo | OK | Approved |
| expo-image | npm | mature (Expo core) | github.com/expo/expo | OK | Approved |
| @shopify/react-native-skia | npm | mature | github.com/Shopify/react-native-skia | OK | Approved |
| react-native-reanimated | npm | mature | github.com/software-mansion/react-native-reanimated | OK | Approved |
| react-native-gesture-handler | npm | mature | github.com/software-mansion/react-native-gesture-handler | OK | Approved |

All seven are first-party modules from Expo, Shopify, and Software Mansion — among the highest-download RN packages. **No `postinstall` scripts** on the three checked directly (`expo-image-picker`, `expo-image-manipulator`, `@shopify/react-native-skia`). Repository URLs confirmed via `npm view … repository.url`.

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
                  ┌─────────────────────────────────────────────┐
   PICKER PATH →  │ launchImageLibraryAsync({mediaTypes:['images']})
                  │        → { canceled, assets:[{ uri, w, h }] } │
                  │          uri = file://…/cache/…  (EVICTABLE)  │
   URL PATH   →   │ File.downloadFileAsync(url, cacheDir)         │
                  │   (fetch once; content-type→ext; write path) │
                  └───────────────────────┬─────────────────────┘
                                          │ raw source uri (cache)
                                          ▼
                  ┌─────────────────────────────────────────────┐
                  │  SKIA CROP SCREEN (net-new, modal)           │
                  │   useImage(file://raw)  → drawn on Canvas    │
                  │   pan + pinch → Reanimated shared values     │
                  │   (translateX/Y, scale)  [NEVER setState]    │
                  │   fixed 1:1 viewport; clamp so image covers  │
                  │   "Use photo" → compute crop rect in SOURCE  │
                  │                 pixel coords from transform  │
                  └───────────────────────┬─────────────────────┘
                                          │ cropRect {originX,originY,width,height}
                                          ▼
                  ┌─────────────────────────────────────────────┐
                  │  ImageManipulator.manipulate(RAW SOURCE uri) │
                  │    .crop(cropRect).resize({512,512})         │
                  │    .renderAsync().saveAsync(JPEG, 0.75)      │
                  │    → { uri: file://…/cache/… }  (EVICTABLE)  │
                  └───────────────────────┬─────────────────────┘
                                          │ manipulated cache uri
                                          ▼
                  ┌─────────────────────────────────────────────┐
                  │  PERSIST (expo-file-system class API)        │
                  │   dest = new File(Paths.document,            │
                  │            'avatars/<derivable-name>.jpg')   │
                  │   dest.delete()  (if exists — replace)       │
                  │   await srcFile.copy(dest)                   │
                  │   store RELATIVE 'avatars/<name>.jpg' in DB  │
                  └───────────────────────┬─────────────────────┘
                                          │ relative filename (TEXT)
                                          ▼
     DB: contacts.photo / profile.photo / contact_custom_values."<col>"  (existing TEXT cols)
                                          │
                        ┌─────────────────┴──────────────────┐
              READ ▼ (resolve rel→file:// at render)    PURGE ▼ (post-commit adapter)
        ┌───────────────────────────┐          ┌──────────────────────────────────────┐
        │ Avatar component          │          │ onPurgeExtensions(contactId):          │
        │  photo? expo-image        │          │  derive filenames from contactId +     │
        │        file://…/document  │          │  surviving custom_field_defs;          │
        │  else themed swatch +     │          │  File.delete() each (idempotent)       │
        │        initials (tokens)  │          └──────────────────────────────────────┘
        └───────────────────────────┘
```

### Recommended Project Structure
```
src/
├── services/
│   └── photos/
│       ├── photo-pipeline.ts     # pick/download → crop → manipulate → persist orchestration
│       ├── photo-storage.ts      # relative<->file:// resolve; copy-out-of-cache; delete; filename scheme
│       ├── url-image.ts          # ported fetch download + content-type→ext (from ImageScraper)
│       └── crop-geometry.ts      # PURE: transform (translate/scale) → source-pixel crop rect (unit-tested)
├── components/
│   ├── Avatar.tsx                # expo-image master OR themed-initials fallback (reused everywhere)
│   ├── avatar-initials.ts        # PURE: getInitials + hash→swatch index (unit-tested)
│   └── PhotoSourcePicker.tsx     # "Add/Change/Remove photo" + "Paste image URL" affordances
├── screens/
│   └── CropPhotoScreen.tsx       # Skia Canvas + Reanimated gestures, "Position photo"
├── db/
│   ├── contacts-dao.ts           # ADD setContactPhoto / clearContactPhoto (net-new — see below)
│   └── profile-dao.ts            # NET-NEW: read/write profile.photo (no profile DAO exists yet)
└── theme/
    ├── theme-types.ts            # ADD avatarSwatches + avatarSwatchText to ThemePalette
    └── theme-presets.ts          # populate swatches (the ONLY colour-literal file)
```

### Pattern 1: Launch the library (no permission)
**What:** Get a raw local cache URI from the system Photo Picker.
**When:** "Choose from library" tap.
```typescript
// Source: docs.expo.dev/versions/latest/sdk/imagepicker
import * as ImagePicker from 'expo-image-picker';

const result = await ImagePicker.launchImageLibraryAsync({
  mediaTypes: ['images'],   // NOT MediaTypeOptions.Images (deprecated)
  allowsEditing: false,     // skip native off-theme crop — we do our own Skia crop
  quality: 1,               // no compression here; the manipulator step compresses to 0.75
});
if (result.canceled) return;              // silent — no error, no toast
const rawUri = result.assets[0].uri;      // file://…/cache/… (EVICTABLE — do not store as-is)
```
> No `requestMediaLibraryPermissionsAsync()` is needed for launching the library on Android — *"No permissions request is necessary for launching the image library."* `[CITED: docs.expo.dev/versions/latest/sdk/imagepicker]`

### Pattern 2: Crop preview transform (Skia + Reanimated) → crop rect
**What:** Interactive pan/pinch preview whose transform never touches React state; at confirm, convert the transform to a source-pixel crop rect for the manipulator.
**When:** The crop screen.
```typescript
// Source: composed from react-native-skia + reanimated + gesture-handler official patterns
// Shared values (NEVER setState per frame — CLAUDE.md render-loop rule):
const scale = useSharedValue(1);
const tx = useSharedValue(0);
const ty = useSharedValue(0);
// Skia reads them via useDerivedValue → Skia transform on the <Image> node.
// gesture-handler Pinch updates scale; Pan updates tx/ty; clamp so the image
// always covers the square (no empty gutters) and pan stays within image edges.

// crop-geometry.ts (PURE, unit-tested): given the square viewport V (px), the
// source image (Iw, Ih), the base cover-scale, and the live {scale, tx, ty},
// return the crop rectangle in SOURCE pixels:
export function cropRectFromTransform(args: {
  viewport: number; srcW: number; srcH: number;
  baseScale: number; scale: number; tx: number; ty: number;
}): { originX: number; originY: number; width: number; height: number } {
  const eff = args.baseScale * args.scale;            // screen px per source px
  const sizeSrc = args.viewport / eff;                // visible square, in source px
  // top-left of the visible square in source coords (invert the pan/center):
  const originX = (args.srcW - sizeSrc) / 2 - args.tx / eff;
  const originY = (args.srcH - sizeSrc) / 2 - args.ty / eff;
  const clamp = (v: number, max: number) => Math.max(0, Math.min(v, max));
  const width = Math.min(sizeSrc, args.srcW);
  const height = Math.min(sizeSrc, args.srcH);
  return {
    originX: clamp(originX, args.srcW - width),
    originY: clamp(originY, args.srcH - height),
    width, height,
  };
}
```
> The exact algebra depends on the transform convention the implementer picks (center-origin vs top-left, sign of `tx`). The load-bearing points: (a) crop from the **original source URI** at confirm, (b) keep the geometry **pure and unit-tested**, (c) never rasterize the Skia surface. `[ASSUMED — convention-dependent; verify on-device]`

### Pattern 3: Pasted-URL download (one-time write path)
**What:** Download once to cache, then feed the identical crop→manipulate→persist pipeline. Reads never hit the network.
**When:** "Add from URL" submit.
```typescript
// Source: docs.expo.dev/versions/latest/sdk/filesystem (class API) + re-ported ImageScraper logic
import { File, Directory, Paths } from 'expo-file-system';

// isUrl / content-type→ext logic re-ported from ~/projects/Orbit ImageScraper.ts
// (as fetch/downloadFileAsync, NOT Obsidian requestUrl; drop wikilink/vault/conflict logic).
const cacheDir = new Directory(Paths.cache, 'photo-dl');
const downloaded = await File.downloadFileAsync(url, cacheDir); // → File in cache
// downloaded.uri is the raw source; from here it is identical to Pattern 1's rawUri:
// → Skia crop → ImageManipulator → copy to Paths.document.
```
> Validate the URL shape and decode failures with the 05-UI-SPEC error copy ("That doesn't look like an image URL." / "Couldn't fetch that image." / "That image couldn't be used."). `[CITED: 05-UI-SPEC Copywriting Contract]`

### Pattern 4: Manipulate + persist (cache → document)
**What:** Produce the 512px JPEG master and copy it out of evictable cache into the persistent document dir with a `contactId`-derivable relative filename.
**When:** "Use photo" confirm, and after a URL download's crop.
```typescript
// Source: docs.expo.dev/versions/latest/sdk/imagemanipulator + /filesystem
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { File, Directory, Paths } from 'expo-file-system';

const out = await ImageManipulator
  .manipulate(rawUri)
  .crop(cropRect)                     // source-pixel rect from Pattern 2
  .resize({ width: 512, height: 512 })
  .renderAsync()
  .then(img => img.saveAsync({ format: SaveFormat.JPEG, compress: 0.75 }));
// out.uri is in EVICTABLE cache — copy it out or the avatar silently vanishes:
const dir = new Directory(Paths.document, 'avatars');
dir.create({ idempotent: true });
const relative = `avatars/contact-${contactId}.jpg`;   // derivable on purge
const dest = new File(Paths.document, relative);
dest.delete();                                          // delete-before-copy (replace + overwrite-safe)
await new File(out.uri).copy(dest);
// STORE `relative` (not dest.uri) in the DB TEXT column.
```
> `create()` is sync and **throws if the file exists** unless `{ overwrite: true }`/`{ idempotent: true }`; `copy()` is async (`copySync()` exists), overwrite via `{ overwrite: true }`; `delete()` is sync. The dossier's deferred "await/overwrite semantics" question resolves this way: **`delete()`-before-`copy()`** is the safe defensive pattern (matches the dossier's interim recommendation). `[CITED: docs.expo.dev/versions/latest/sdk/filesystem]`
> Read-time resolution: `` const uri = `${Paths.document.uri}${relative}` `` (relative → `file://`). Keep this in one `photo-storage.ts` helper — the single place the relative↔`file://` mapping is observable.

### Pattern 5: Deterministic themed-initials avatar
**What:** Same hash the plugin used, but indexing the themed swatch array instead of producing an HSL hue.
**When:** No photo (or `expo-image` `onError`).
```typescript
// Source: ported verbatim from ~/projects/Orbit ContactCard.tsx getInitials + hash
export function getInitials(name: string): string {
  return name.split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2);
}
export function hashName(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return Math.abs(hash);
}
// In the component (colours via tokens ONLY — check:colors bans hex/hsl outside theme):
const { colors } = useTheme();
const trimmed = name.trim();
const swatch = trimmed === ''
  ? colors.avatarSwatches[0]                                  // empty name → blank swatch, no glyph
  : colors.avatarSwatches[hashName(name) % colors.avatarSwatches.length];
// initials text uses colors.avatarSwatchText; glyph size ≈ 40% of diameter, weight 700.
```
> `avatarSwatches: readonly string[]` (8 recommended) + `avatarSwatchText: string` are **net-new tokens on `ThemePalette`** added in `theme-types.ts` and populated in `theme-presets.ts` — the only file `check:colors` permits colour literals in. The plugin's `hsl(hash % 360, 65%, 45%)` is **barred** by CLAUDE.md and would fail `check:colors` (which greps for `hsl(`). `[CITED: 05-UI-SPEC Color §; VERIFIED: scripts/check-colors.sh bans hsl()]`

### Pattern 6: Purge cleanup adapter (the load-bearing pattern)
**What:** Register `onPurgeExtensions` to delete photo files when a contact is purged.
**When:** Wherever `purgeContact` is invoked (Phase 5 supplies the adapter Phase 4 left as a hook).
```typescript
// Source: src/db/purge-dao.ts (read on disk) — adapter fires POST-COMMIT with only contactId
const onPurgeExtensions = async (contactId: number) => {
  // The contacts row AND contact_custom_values rows are ALREADY DELETED here.
  // Filenames MUST be derivable from contactId — cannot be read from the gone rows.
  const dir = Paths.document;
  // 1. main contact photo (deterministic name):
  new File(dir, `avatars/contact-${contactId}.jpg`).delete();  // idempotent — missing is fine
  // 2. custom photo-field files: custom_field_defs SURVIVES purge (global table). Read the
  //    type='photo' defs, build each derivable filename, delete:
  const photoDefs = await getPhotoFieldDefs(exec);             // reads surviving defs
  for (const d of photoDefs) new File(dir, `avatars/cv-${contactId}-${d.col_name}.jpg`).delete();
};
await purgeContact(exec, id, { onPurgeExtensions });
```
> This dictates the **filename scheme**: it MUST be derivable from `contactId` (+ surviving `custom_field_defs.col_name`), because the adapter runs after the DB rows are gone and receives only `contactId`. A random-uid-per-file scheme would be **un-deletable on purge** without changing the Phase-4 adapter signature. See Pitfall 2. `[VERIFIED: src/db/purge-dao.ts lines 61-68, 205-218]`

### Anti-Patterns to Avoid
- **Storing the raw picker/manipulator cache URI (or an absolute `file://`) in the DB.** Cache is evictable; absolute paths break on restore. Store the relative filename only.
- **`Skia.makeImageSnapshot()` for the crop output.** Captures at screen resolution — lossy. Crop the original URI with ImageManipulator.
- **Driving the crop transform from React `setState`.** Per-frame re-render on the JS thread; use Reanimated shared values.
- **Any hex/`hsl()`/`rgb()` in the Avatar or Skia crop code.** `check:colors` fails; all colour via tokens including the swatch set and the crop mask/frame.
- **Random-uid photo filenames** stored in the column — un-deletable on purge (adapter can't read the deleted rows). Use `contactId`-derivable names.
- **`FileSystem.copyAsync` / `documentDirectory` from `expo-file-system` root.** Deprecated; throws at runtime. Use the `File`/`Paths` class API (or `expo-file-system/legacy` explicitly — but don't).
- **Adding a new migration for the photo column.** `contacts.photo` and `profile.photo` already exist (migration 1, TEXT). No schema change this phase.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Image crop/resize/encode | Manual canvas pixel copy | `expo-image-manipulator.manipulate()` | Off-thread, handles orientation/format/quality |
| Reading directories / copy / delete | Raw RN modules | `expo-file-system` `File`/`Paths` | Handles sandbox paths, sync/async variants, overwrite flags |
| Image download | XHR + blob juggling | `File.downloadFileAsync(url, dir)` | One call to disk; correct for the one-time write path |
| Photo picker UI | Custom gallery browser | `launchImageLibraryAsync` | System Photo Picker = no permission, native UX |
| Avatar downscaling for grid vs profile | Thumbnail pair generation | `expo-image` (`allowDownscaling` default) | One master self-downscales per render size |
| Deterministic per-name colour | New hashing scheme | The ported `charCodeAt` rolling hash → swatch index | Stable across sessions/surfaces; already proven |

**Key insight:** every piece of this pipeline is a solved, first-party Expo primitive. The only genuinely net-new code is (1) the Skia crop *interaction* surface (no plugin predecessor), (2) the pure crop-rect geometry, (3) the swatch-token wiring, and (4) the `contactId`-derivable filename scheme + purge adapter. Everything else is orchestration of existing modules.

## Runtime State Inventory

> Phase 5 is greenfield feature work (adds files, adds theme tokens, adds DAO methods), not a rename/refactor/migration. No stored strings are being renamed. The one persistent-state concern is orphaned photo files, covered under Pitfalls, not a rename inventory. **Not applicable.**

## Common Pitfalls

### Pitfall 1: Cache eviction silently loses avatars
**What goes wrong:** The picker and the manipulator both write to `Paths.cache` (evictable). If you store that URI, Android reclaims the file under storage pressure and the avatar vanishes with no error.
**Why it happens:** Tutorials show the cache URI as the final result.
**How to avoid:** Always `copy()` the manipulated output into `Paths.document` and store the **relative** filename. Never persist a `…/cache/…` URI.
**Warning signs:** Avatars present right after import, gone after days / a reboot / heavy app use.

### Pitfall 2: The purge adapter runs after the rows are gone (load-bearing)
**What goes wrong:** `onPurgeExtensions(contactId)` fires **post-commit**; `contacts` and `contact_custom_values` rows are already deleted. Code that tries to look up the stored photo filename from the DB finds nothing, so files leak forever.
**Why it happens:** The adapter signature is `(contactId: number)` only, by Phase-4 design (OS side effects must not run inside the transaction/mutex).
**How to avoid:** Use a **`contactId`-derivable filename scheme** (`avatars/contact-${id}.jpg`, `avatars/cv-${id}-${col_name}.jpg`). The adapter rebuilds the filenames from `contactId` plus the **surviving** global `custom_field_defs` (photo-type fields) and `File.delete()`s each (idempotent — missing files fine). Do NOT use random-uid filenames unless you also change the Phase-4 adapter to capture paths pre-commit (an owner-level contract change — avoid).
**Warning signs:** `avatars/` grows after purges; files whose `contactId` no longer exists.
`[VERIFIED: src/db/purge-dao.ts]`

### Pitfall 3: Absolute paths break on restore
**What goes wrong:** Storing `file:///data/user/0/…/avatars/x.jpg` — the sandbox root differs across installs/devices, so restored paths point nowhere.
**How to avoid:** Store the relative filename; resolve to `${Paths.document.uri}${relative}` at read. Backup (Phase 16) writes fresh files and repoints — never restores stored paths verbatim.
**Warning signs:** All avatars broken after a reinstall or device migration.

### Pitfall 4: `check:colors` fails on the swatch set / crop canvas
**What goes wrong:** Putting swatch hex or `hsl()` anywhere outside `src/**/theme/**` fails the gate; the ported plugin hash used `hsl(...)` inline.
**How to avoid:** Swatches live only in `theme-presets.ts` as `avatarSwatches`/`avatarSwatchText`; components read `useTheme().colors.*`. Skia crop mask/frame colours also come from tokens (`surface`-derived dim, `borderStrong` outline).
**Warning signs:** `npm run check:colors` red on `Avatar.tsx` / `CropPhotoScreen.tsx`.

### Pitfall 5: Config-plugin change without a rebuild
**What goes wrong:** Adding the `expo-image-picker` plugin (or Reanimated Babel plugin / gesture-handler root) and testing in a stale build — picker crashes or permissions wrong.
**How to avoid:** These are native/config changes — rebuild the APK via the desktop pipeline; they do not fast-refresh. Reanimated's Babel plugin must be **last** in `babel.config.js`; wrap the app root in `GestureHandlerRootView`.
**Warning signs:** "Native module not found", Reanimated worklet errors, `CAMERA` still in the manifest.

### Pitfall 6: `updateContactMetadataCore` does not touch `photo`
**What goes wrong:** Assuming the edit-form save path writes the photo. It writes every mutable column **except** `last_contact` and **except `photo`** (verified on disk).
**How to avoid:** Add dedicated `setContactPhoto(exec, id, relative)` / `clearContactPhoto(exec, id)` DAO methods (and a net-new `profile-dao.ts` for `profile.photo` — no profile DAO exists yet). Photo edits are their own atomic write, decoupled from the metadata form, so the inline old-file delete pairs with the DB update.
**Warning signs:** Photo appears to save in UI state but is not persisted, or the edit form clobbers it.
`[VERIFIED: src/db/contacts-dao.ts lines 244-272; no profile DAO in src/db]`

## Code Examples

(See Architecture Patterns 1–6 above — each is a verified, source-cited snippet: picker launch, crop transform→rect geometry, URL download, manipulate+persist, initials/swatch, purge adapter.)

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `ImagePicker.MediaTypeOptions.Images` | `mediaTypes: ['images']` (array) | SDK ~52+ | Enum deprecated; use array |
| `ImageManipulator.manipulateAsync(uri, actions, opts)` | `manipulate(uri).crop().resize().renderAsync().saveAsync()` | SDK 52+ | Context/chainable, off-thread |
| `FileSystem.documentDirectory` + `copyAsync/readAsStringAsync` | `File`/`Paths`/`Directory` class API | SDK 54+ | Legacy fns throw unless imported from `expo-file-system/legacy` |
| Plugin `hsl(hash % 360, …)` free-hue avatar | `avatarSwatches` token indexed by hash | this phase | Restyles with theme; passes `check:colors` |
| Plugin 3-way photo resolve (URL/wikilink/vault) + `ImageScraper` to vault | one local 512px master; picker + one-time URL download | this phase | Single resolution path; offline reads |

**Deprecated/outdated:**
- Obsidian `requestUrl` → `fetch`/`File.downloadFileAsync`.
- `ImageScraper`'s wikilink return, vault-path naming, folder-conflict resolution — deleted (no vault on mobile); only download + content-type→extension logic re-ports.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The crop-rect geometry algebra (center-origin, sign of pan) in Pattern 2 | Architecture Pattern 2 | Crop framing offset/inverted; MITIGATED by keeping geometry pure + unit-tested + one on-device check |
| A2 | `expo-image-manipulator.crop` accepts fractional/edge rects from a zoomed transform without off-by-one at 512 | Pattern 4 | Slight edge clipping; clamp origin+size to source bounds (shown) |
| A3 | `File.downloadFileAsync(url, Directory)` returns a `File` and sets extension from response; exact signature may differ slightly by patch | Pattern 3 | Download wiring adjustment; verify signature at build time against installed version |
| A4 | Skia `useImage(file://rawUri)` decodes the picked/downloaded image for the crop preview | Pattern 2 | If a large source fails to decode, pre-downscale via manipulator before preview; orrery domain already confirmed `useImage(file://)` for the 512px master |
| A5 | 8 swatches at q≈0.75 / 512px land in the ~30–60 KB range on the Pixel | Standard Stack / Cluster B | Storage/backup size estimate only; measurable on-device |

**These are the items the planner should gate or verify on-device.** Everything else is `[VERIFIED]`/`[CITED]`.

## Open Questions

1. **Exact `File`/`Directory` download + copy signatures for the installed SDK-57 patch**
   - What we know: class API shape, sync/async split, overwrite flags (official docs).
   - What's unclear: minor signature drift between doc "latest" and the exact 57.0.x pin.
   - Recommendation: after `expo install`, open the installed `.d.ts` and confirm; keep FS calls behind `photo-storage.ts` so a signature tweak is one-file.

2. **Crop transform convention → crop rect**
   - What we know: crop from original URI; keep geometry pure.
   - What's unclear: final translate/scale convention the crop screen picks.
   - Recommendation: implement `crop-geometry.ts` pure + unit-tested with fixture transforms; one on-device visual check that the framed square matches the saved master.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Expo SDK 57 toolchain | whole phase | ✓ | expo ~57.0.13 (package.json) | — |
| Desktop build pipeline (ssh droid) | native modules (Skia/Reanimated/gesture-handler/picker) require a custom build | ✓ | per MEMORY build-test-pipeline | — |
| Pixel 6 Pro (adb) | on-device UAT of picker/crop/perf | ✓ (when plugged) | — | desktop emulator (but crop perf/Skia not assessable there) |
| `npx expo install` | resolve SDK-pinned native versions | ✓ | — | — |

**Missing dependencies with no fallback:** none — all seven packages install via `expo install`.
**Note:** Skia crop **performance** claims are only valid on the physical Pixel, not the desktop emulator (CLAUDE.md orrery note; render-loop feature).

## Validation Architecture

> `workflow.nyquist_validation: true` in config — section included. This phase has correctness-critical infra: file lifecycle (cache→document copy, inline delete, purge cleanup), the 512px master invariant, deterministic swatch mapping, and pure crop geometry.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.x (node env) — established across `src/db/*.test.ts`, `src/theme/*.test.ts`, `src/components/*logic.test.ts` |
| Config file | `vitest` in package.json scripts (`vitest run`); node-pure DAO harness in `src/db/__testkit__` |
| Quick run command | `npm test -- <file>` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PHOTO-01 | crop-rect geometry: transform → source-pixel rect, clamped to bounds | unit (pure) | `npm test -- src/services/photos/crop-geometry.test.ts` | ❌ Wave 0 |
| PHOTO-02 | URL isUrl + content-type→ext mapping (ported) | unit (pure) | `npm test -- src/services/photos/url-image.test.ts` | ❌ Wave 0 |
| PHOTO-03 | relative↔`file://` resolution; filename scheme derivable from contactId; delete-before-copy ordering | unit (pure/mocked FS) | `npm test -- src/services/photos/photo-storage.test.ts` | ❌ Wave 0 |
| PHOTO-04 | `getInitials` (incl. single-word, empty) + `hashName % len` swatch index determinism | unit (pure) | `npm test -- src/components/avatar-initials.test.ts` | ❌ Wave 0 |
| PHOTO-04 | `avatarSwatches`/`avatarSwatchText` present in every preset; no hex outside theme | unit + gate | `npm test -- src/theme/theme-presets.test.ts` && `npm run check:colors` | ⚠ extend existing |
| PHOTO-05 | purge adapter derives + deletes contact + custom photo-field filenames from contactId (mocked FS) | unit (mocked FS, real defs read) | `npm test -- src/services/photos/purge-photo-cleanup.test.ts` | ❌ Wave 0 |
| PHOTO-01/02/03 | end-to-end: pick/download → crop → 512px master under document dir renders | manual on-device | UAT on Pixel (build+install+drive) | manual — Skia/picker/native |

### Sampling Rate
- **Per task commit:** `npm test -- <touched test file>` + `npm run check:colors <touched file>`
- **Per wave merge:** `npm test` (full suite) + `npm run check:colors`
- **Phase gate:** full suite green + `check:colors` green + on-device UAT on the Pixel (picker launches with no permission prompt; crop frames + saves a 512px master; fallback swatch/initials render; replace deletes old file; purge deletes files).

### Wave 0 Gaps
- [ ] `src/services/photos/crop-geometry.test.ts` — covers PHOTO-01 (pure geometry)
- [ ] `src/services/photos/url-image.test.ts` — covers PHOTO-02 (isUrl + ext map)
- [ ] `src/services/photos/photo-storage.test.ts` — covers PHOTO-03 (rel↔file://, scheme, delete-before-copy)
- [ ] `src/components/avatar-initials.test.ts` — covers PHOTO-04 (initials + swatch index)
- [ ] `src/services/photos/purge-photo-cleanup.test.ts` — covers PHOTO-05 (derivable deletion)
- [ ] Extend `src/theme/theme-presets.test.ts` — assert `avatarSwatches` non-empty + `avatarSwatchText` in every preset
- [ ] FS-heavy code (copy/delete/download) is thin-wrapped in `photo-storage.ts` so the pure logic is testable and the native calls are mocked/manual
- Framework install: none — Vitest already present.

## Security Domain

> `security_enforcement: true`, ASVS L1. Photo pipeline touches input validation (URL, image bytes) and file paths.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Local-only app, no auth |
| V3 Session Management | no | — |
| V4 Access Control | no | Single-user device |
| V5 Input Validation | **yes** | URL validated (`http(s)` + image content-type/extension) before download; decode failures surfaced with the SPEC error copy, never crash; `contactId`/`col_name` are integers/whitelisted identifiers — filenames never take free user text (no path traversal) |
| V6 Cryptography | no | No secrets in this domain; no crypto hand-rolled |
| V12 Files & Resources | **yes** | Writes confined to `Paths.document`/`Paths.cache`; filename scheme is derived (no user-controlled path segments → no `../` traversal); downloaded bytes size-bounded implicitly by the 512px re-encode |

### Known Threat Patterns for this stack
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Path traversal via crafted filename | Tampering | Filenames derived from integer `contactId` + whitelisted `col_name` (never raw user text); the reserved-columns whitelist already sanitises `col_name` |
| Malicious/huge remote image on URL paste | DoS | `manipulate().resize({512,512})` bounds output; validate content-type; download to cache (evictable) not document until validated |
| SSRF-ish arbitrary URL fetch | Info disclosure | Only user-initiated, one-time, on the write path; no auto-fetch, no fetch on any read path (local-first invariant preserved) |
| Decode-bomb / unsupported format | DoS | Surface "That image couldn't be used." on decode failure; JPEG/PNG only in practice |

## Sources

### Primary (HIGH confidence)
- `docs.expo.dev/versions/latest/sdk/filesystem` — new `File`/`Paths`/`Directory` class API; create/copy/delete/downloadFileAsync/base64; overwrite semantics; legacy-throws note
- `docs.expo.dev/versions/latest/sdk/imagemanipulator` — context `manipulate()` API; crop/resize/renderAsync/saveAsync; SaveFormat.JPEG; compress range
- `docs.expo.dev/versions/latest/sdk/imagepicker` — `launchImageLibraryAsync` signature/result; no library permission; `cameraPermission`/`microphonePermission` config plugin
- On-disk code (read this session): `src/db/purge-dao.ts` (adapter signature + post-commit timing), `src/db/contacts-dao.ts` (`updateContactMetadataCore` excludes `photo`), `src/db/migrations/001-initial.ts` (contacts.photo + profile.photo TEXT exist), `src/theme/theme-types.ts` + `theme-presets.ts` (token contract), `scripts/check-colors.sh` (bans `hsl()`/hex), `src/components/field-widgets/PhotoFieldWidget.tsx` (deferred placeholder), `~/projects/Orbit/src/utils/ImageScraper.ts` + `ContactCard.tsx` (ported logic)
- `npm view` — package existence, versions, repository URLs, absent postinstall scripts

### Secondary (MEDIUM confidence)
- Dossier/INDEX cross-domain rows for Skia `useImage(file://)` resolution (orrery domain) and widget base64 (Phase 12)

### Tertiary (LOW confidence)
- Crop-rect algebra convention (A1) — implementation-dependent, verify on-device

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all first-party, versions verified on npm, APIs cited from official Expo docs
- Architecture: HIGH — pipeline stages each map to a cited API; purge-adapter finding verified against on-disk code
- Pitfalls: HIGH — cache eviction, purge timing, absolute-path, and `photo`-excluded-from-metadata-update all verified in code/docs
- Crop geometry: MEDIUM — convention-dependent, mitigated by pure unit tests + one on-device check

**Research date:** 2026-08-15
**Valid until:** 2026-09-14 (30 days — Expo SDK 57 stable; re-confirm exact `File` signatures against the installed pin at build time)
</content>
</invoke>
