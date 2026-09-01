# Photos

**Last updated:** 2026-08-15
**Updated by phase:** 12-home-screen-widget
**Owners:** `src/services/photos/`, `src/db/contacts-dao.ts`, `src/db/profile-dao.ts`, `src/components/Avatar.tsx`, `src/components/PhotoSourcePicker.tsx`

## Purpose

The photos system captures, persists, renders, and removes contact, self-record, and custom-field images without a network dependency on any read path. It keeps one bounded local master per target and supplies a tokenized initials fallback whenever no usable photo exists.

## Architecture

### Data Model

SQLite stores only relative filenames; the photo bytes live in the app document directory. There is no server, remote image reference, thumbnail pair, or original-image retention.

**Tables:**
- `contacts` — its nullable `photo` (`TEXT`) holds a relative `avatars/contact-<id>.jpg` path.
- `profile` — its nullable `photo` (`TEXT`) holds the fixed relative `avatars/profile.jpg` path.
- `contact_custom_values` — a `photo`-type field holds its derivable `avatars/cv-<contactId>-<colName>.jpg` path in its existing `TEXT` column.

**Types** (`src/services/photos/photo-storage.ts`):
- `PhotoTargetDescriptor` — distinguishes contact, profile, and custom-field persistence targets.

### Store, Service & DAO Layer

| Layer | File | Responsibility |
|---|---|---|
| Capture UI | `src/components/PhotoSourcePicker.tsx` | Starts library or pasted-URL acquisition and presents add/change/remove controls. |
| Crop UI | `src/screens/CropPhotoScreen.tsx` | Uses Skia and Reanimated shared values for a themed square crop. |
| Pipeline | `src/services/photos/photo-pipeline.ts` | Crops the original source, produces the 512px JPEG, and returns a relative path. |
| Storage | `src/services/photos/photo-storage.ts` | Validates paths, derives names, persists masters, deletes files, and reconciles interrupted writes. |
| URL service | `src/services/photos/url-image.ts` | Downloads a user-pasted HTTPS image once on the write path. |
| Contact/profile DAOs | `src/db/contacts-dao.ts`, `src/db/profile-dao.ts` | Persist or clear the contact and self relative path with one-row guards. |
| Purge extension | `src/services/photos/purge-photo-cleanup.ts` | Deletes derivable contact and custom-field files after database purge commits. |

### Key Files

| File | Role |
|---|---|
| `src/services/photos/photo-storage.ts` | The relative-path and crash-safe file-lifecycle chokepoint. |
| `src/services/photos/photo-pipeline.ts` | Crops and encodes the single JPEG master. |
| `src/services/widget/widget-photo.ts` | Downscales a local master to a transient base64 widget thumbnail. |
| `src/services/photos/crop-geometry.ts` | Converts a crop transform into clamped source-pixel bounds. |
| `src/services/photos/url-image.ts` | Enforces pasted-URL validation and download handling. |
| `src/services/photos/purge-photo-cleanup.ts` | Implements post-commit contact photo cleanup. |
| `src/components/Avatar.tsx` | Renders a local master or the themed initials fallback. |
| `src/components/PhotoSourcePicker.tsx` | Reusable source and lifecycle controls for all photo targets. |
| `src/screens/CropPhotoScreen.tsx` | Registers the Skia crop screen. |

## How It Works

### Capturing and cropping a photo

1. On an edit-only photo surface, `PhotoSourcePicker` opens the system library with no camera path or permission prompt, or accepts a user-pasted HTTPS image URL.
2. A selected or downloaded source is cache-resident and opens `CropPhotoScreen` with a serializable target descriptor.
3. The screen drives pan and pinch with Reanimated shared values, derives a clamped source-pixel square, and gives it to `persistCroppedMaster()`.
4. The pipeline crops the original source, resizes it to a 512×512 JPEG at approximately 0.75 quality, and returns the persisted relative filename.

### Persisting and rendering the master

1. `photo-storage` copies the cache output into the document directory through a temporary-file and `.bak` swap; it never pre-deletes the existing master.
2. Contact and profile DAOs store the relative filename; custom fields retain the same derivable value through the existing guarded value writer.
3. `Avatar` resolves the relative path to a local `file://` URI. It renders with `expo-image`, or falls back to initials when the value is absent or the load fails.
4. A photo-write revision changes the image cache discriminator after set, clear, or replace.

### Rendering a widget thumbnail

1. The Widget renderer passes the stored contact-relative path to `encodeWidgetThumb()`.
2. The encoder resolves the existing 512px local master, downsizes it to a bounded JPEG, and returns a base64 `data:` URI without writing another file or table row.
3. A missing, evicted, corrupt, or non-base64 result returns `null`; that tile renders deterministic initials instead of a `file://`, network, or broken image source.
4. Contact photo set and clear paths publish a best-effort widget refresh only after their own persistence succeeds.

### Removing and purging photos

1. Contact and profile removal clears the database reference, then deletes the derivable file best-effort.
2. The launch sweep reconciles interrupted temporary or backup files from a prior replacement.
3. An archived-contact purge invokes the post-commit cleanup extension. Because database rows are gone by then, it derives the main filename from `contactId` and custom-field filenames from the surviving photo definitions, including quarantined definitions.

## Configuration

| Constant | Value | File | Purpose |
|---|---|---|---|
| Master size | `512 × 512` | `src/services/photos/photo-pipeline.ts` | Bounds storage, image decode, and later consumer cost. |
| JPEG quality | approximately `0.75` | `src/services/photos/photo-pipeline.ts` | Balances photo clarity and bounded master size. |
| Widget thumbnail | `88px`, quality `0.6` | `src/services/widget/widget-photo.ts` | Bounds transient RemoteViews thumbnail work. |
| Picker camera/mic permissions | `false` | `app.config.ts` | Keeps camera and microphone permissions out of the picker configuration. |

## Decisions

- **ADR-020:** Library-Only Photo Capture with Themed In-App Cropping and One-Time URL Download — both write sources converge on one local crop pipeline.
- **ADR-021:** Durable Relative-Path Photo Masters with Crash-Safe Lifecycle Cleanup — defines the master, path, replacement, and deletion contract.
- **ADR-022:** Tokenized Deterministic Initials Avatars — defines the themed no-photo fallback.
- **ADR-043:** Static Globally Mirrored Favourites Widget — reuses local photo masters without widget state.

## Gotchas

1. **Never store a cache URI or absolute sandbox path.** Cache is evictable and absolute paths fail on restore; store only a validated relative path.
2. **Do not pre-delete a master before replacing it.** Native moves can be delete-then-rename, so the temporary-and-backup swap plus launch reconciliation is load-bearing.
3. **Purge runs after database rows are deleted.** Filenames must stay derivable from the contact identity; custom cleanup must include quarantined photo definitions.
4. **Custom photo fields have a cancel-path tradeoff.** Their stable canonical file can change before the form commits its value; backing out can retain changed bytes beneath the previous reference. The documented safe posture favors a bounded leak or changed file over deleting a possibly committed file.
5. **Treat image cache replacement carefully across restart.** A same-second replace at a stable path has a narrow stale-decode risk after the in-memory revision resets.
6. **Widget images are base64 only.** RemoteViews must not receive `file://` masters or an `http(s)` source; a failed encode is an initials fallback, not a grid failure.

## Related Systems

- **Contacts** — owns contact and self-record persistence surfaces.
- **Custom fields** — stores custom photo paths through its guarded values flow.
- **App shell** — owns the crop route, settings entry, theme tokens, and launch registration.
- **Widget** — derives a transient base64 thumbnail from the existing bounded master.

## Changelog

| Date | Phase | What Changed |
|---|---|---|
| 2026-08-15 | 05 | Created the local photo pipeline, themed fallback avatar, and contact/custom-field lifecycle integration. |
| 2026-08-16 | 12 | Added transient base64 widget thumbnails and refresh publishing after contact photo changes. |
