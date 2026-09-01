# Photos

**Last updated:** 2026-08-26
**Updated by phase:** 20-contact-reconciliation-merge
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
- `restore_photo_journal` — committed restore work that finalizes or removes a canonical master after the database transaction.
- `import_session_rows` — a local-only retryable `photo_rel_path` reference to a selected-contact source staged under `import-staging/`.

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
| Restore recovery | `src/services/photos/restore-photo-finalize-sweep.ts` | Finalizes or cleans up only committed journal-backed restore work. |

### Key Files

| File | Role |
|---|---|
| `src/services/photos/photo-storage.ts` | The relative-path and crash-safe file-lifecycle chokepoint. |
| `src/services/photos/photo-pipeline.ts` | Crops and encodes the single JPEG master. |
| `src/services/widget/widget-photo.ts` | Downscales a local master to a transient base64 widget thumbnail. |
| `src/services/photos/crop-geometry.ts` | Converts a crop transform into clamped source-pixel bounds. |
| `src/services/photos/url-image.ts` | Enforces pasted-URL validation and download handling. |
| `src/services/photos/purge-photo-cleanup.ts` | Implements post-commit contact photo cleanup. |
| `src/services/photos/restore-photo-finalize-sweep.ts` | Drains committed restore-photo finalization and deletion entries. |
| `src/services/import/import-photo.ts` | Converts durable import staging into a post-commit contact master and isolates failure. |
| `src/services/photos/reconcile-photo.ts` | Stages current source photos, hashes staged bytes, and promotes a chosen image after reconciliation commit. |
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

### Restoring backup photo bytes

1. Backup serializes image bytes, never the device-local relative path as portable authority.
2. Restore stages validated bytes under the guarded restore-pending namespace before its database transaction.
3. A committed journal row authorizes the finalizer to write the fresh canonical relative master or verify a stale master is absent; launch recovery ignores uncommitted work.

### Importing a selected contact photo

1. Contact Import moves an accepted picker-cache copy into private flat `import-staging/` before it commits the durable session snapshot.
2. After the imported contact transaction succeeds, `import-photo.ts` resolves that relative staging path, produces the ordinary Orbit master, and writes the contact photo reference.
3. Success retires the row reference before best-effort deletion of raw staging. A mastering failure leaves the contact imported and retains the staged input for Retry.

### Reconciling a linked-contact photo

1. Reconciliation copies a current linked-source photo into the guarded `reconcile-staging/` namespace and hashes its bytes for source-change comparison.
2. The detail view offers the staged source photo for a deliberate choice; it never supplies a picker-cache URI to the regular Avatar path.
3. Once the selected data transaction commits, `promoteReconcilePhoto()` produces the usual master and writes the photo reference. A promotion failure leaves the photo snapshot unwritten so it is offered again on a later scan.

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
- **ADR-057:** Full-State Versioned Backups with Verified Manual and Foreground SAF Snapshots — embeds photo bytes in complete portable snapshots.
- **ADR-058:** Optional Encrypted Backups and Previewed Local Restoration — journals committed restore-photo work for durable recovery.
- **ADR-065:** Durable Resumable Contact-Import Sessions with Failure-Isolated Photos — keeps selected-contact photo staging retryable without making photo failure invalidate the contact.
- **ADR-068:** User-Triggered, Source-Only Reconciliation with Durable Review — stages and promotes a selected current source photo around the reconciliation transaction.

## Gotchas

1. **Never store a cache URI or absolute sandbox path.** Cache is evictable and absolute paths fail on restore; store only a validated relative path.
2. **Do not pre-delete a master before replacing it.** Native moves can be delete-then-rename, so the temporary-and-backup swap plus launch reconciliation is load-bearing.
3. **Purge runs after database rows are deleted.** Filenames must stay derivable from the contact identity; custom cleanup must include quarantined photo definitions.
4. **Custom photo fields have a cancel-path tradeoff.** Their stable canonical file can change before the form commits its value; backing out can retain changed bytes beneath the previous reference. The documented safe posture favors a bounded leak or changed file over deleting a possibly committed file.
5. **Treat image cache replacement carefully across restart.** A same-second replace at a stable path has a narrow stale-decode risk after the in-memory revision resets.
6. **Widget images are base64 only.** RemoteViews must not receive `file://` masters or an `http(s)` source; a failed encode is an initials fallback, not a grid failure.
7. **Never restore a serialized path verbatim.** It belongs to another sandbox; use the embedded bytes and a newly derived canonical master.
8. **Only committed journal rows may finalize restore files.** A process interruption before the database commit must not create a visible master or delete an existing one.
9. **Do not pass import staging to `Avatar`.** It is preview-only and outside Avatar's canonical master namespace; resolve it directly in import UI.
10. **Guard WebCrypto in Hermes.** Reconciliation photo hashing must fall back to RNQC when `globalThis.crypto` is unavailable; the original unguarded digest blocked photo-bearing scans before its Phase-20 fix.

## Related Systems

- **Contacts** — owns contact and self-record persistence surfaces.
- **Custom fields** — stores custom photo paths through its guarded values flow.
- **App shell** — owns the crop route, settings entry, theme tokens, and launch registration.
- **Widget** — derives a transient base64 thumbnail from the existing bounded master.
- **Backup & Restore** — embeds image bytes and uses journal-backed staged restoration to recreate local masters.
- **Contact Import** — stages selected-contact photos privately and masters them only after the contact commit.
- **Contact Reconciliation** — uses separate private staging and post-commit promotion for source-photo review.

## Changelog

| Date | Phase | What Changed |
|---|---|---|
| 2026-08-15 | 05 | Created the local photo pipeline, themed fallback avatar, and contact/custom-field lifecycle integration. |
| 2026-08-16 | 12 | Added transient base64 widget thumbnails and refresh publishing after contact photo changes. |
| 2026-08-24 | 17 | Added embedded backup bytes and committed-only restore-photo finalization recovery. |
| 2026-08-26 | 19 | Added selected-contact staging and post-commit failure-isolated import mastering. |
| 2026-08-26 | 20 | Added hashed reconciliation staging and post-commit chosen-source photo promotion. |
