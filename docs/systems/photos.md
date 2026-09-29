# Photos

**Last updated:** 2026-09-26
**Updated by phase:** 38.5-background-art-text-contrast
**Owners:** `src/services/photos/`, `src/db/contacts-dao.ts`, `src/db/profile-dao.ts`, `src/components/Avatar.tsx`, `src/components/PhotoSourcePicker.tsx`

## Purpose

The photos system captures, persists, renders, and removes contact, self-record, and custom-field images without a network dependency on any read path. It keeps one bounded local master per target and supplies a tokenized initials fallback whenever no usable photo exists.

## Architecture

### Data Model

SQLite stores only relative filenames; the photo bytes live in the app document directory. There is no server, remote image reference, thumbnail pair, or original-image retention.

**Tables:**
- `contacts` — its nullable `photo` (`TEXT`) holds a relative `avatars/contact-<id>.jpg` path.
- `profile` — its nullable `photo` (`TEXT`) holds the fixed relative `avatars/profile.jpg` path.
- `custom_field_values` — a `photo`-type field holds its derivable `avatars/cv-<contactId>-<colName>.jpg` path in its raw `value` text column.
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
| Canonical owner | `src/services/photos/owned-master.ts` | Locks each master path, settles older journal work before writes, and applies reference-safe delete intents. |
| Pure path builders | `src/db/photo-relative-path.ts` | Derives ADR-021 filenames without importing native file APIs. |
| URL service | `src/services/photos/url-image.ts` | Downloads a user-pasted HTTPS image once on the write path. |
| Contact/profile DAOs | `src/db/contacts-dao.ts`, `src/db/profile-dao.ts` | Persist or clear the contact and self relative path with one-row guards. |
| Merge owner | `src/services/photos/merge-photo-rehome.ts` | Stages absorbed bytes, commits survivor-derived references and journal entries, then finalizes under the same path locks. |
| Purge extension | `src/services/photos/purge-photo-cleanup.ts` | Executes the purge's committed, reference-checked delete intents after commit. |
| Restore recovery | `src/services/photos/restore-photo-finalize-sweep.ts` | Finalizes or cleans up only committed journal-backed restore work. |

### Key Files

| File | Role |
|---|---|
| `src/services/photos/photo-storage.ts` | The relative-path and crash-safe file-lifecycle chokepoint. |
| `src/services/photos/photo-pipeline.ts` | Crops and encodes the single JPEG master. |
| `src/services/photos/derivative-cache.ts` | Retires generated cache copies and sweeps prior-process orphans within guarded cache namespaces. |
| `src/services/widget/widget-photo.ts` | Downscales a local master to a transient base64 widget thumbnail. |
| `src/services/photos/background-storage.ts` | Owns staged replacement and safe cleanup for shared Profile background derivatives. |
| `src/services/photos/background-reconcile-sweep.ts` | Reconciles interrupted Profile background writes against live database references. |
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

1. `owned-master` acquires the canonical path lock and settles every older journal row before a new write. `photo-storage` then copies the cache output through a temporary-file and `.bak` swap; it never pre-deletes the existing master.
2. Contact and profile DAOs store the relative filename; custom fields retain the same derivable value through the existing guarded value writer.
3. `Avatar` resolves the relative path to a local `file://` URI. It renders with `expo-image`, or falls back to initials when the value is absent or the load fails.
4. A photo-write revision changes the image cache discriminator after set, clear, or replace.

### Rendering a widget thumbnail

1. The Widget renderer passes the stored contact-relative path to `encodeWidgetThumb()`.
2. The encoder resolves the existing 512px local master and downsizes it to a bounded JPEG. Installed `expo-image-manipulator` writes a temporary `cache/ImageManipulator/` file even for `base64: true`; the encoder discards it after reading base64 and returns only a `data:` URI. It writes no table row or persistent thumbnail.
3. A missing, evicted, corrupt, or non-base64 result returns `null`; that tile renders deterministic initials instead of a `file://`, network, or broken image source.
4. Contact photo set and clear paths publish a best-effort widget refresh only after their own persistence succeeds.

### Temporary photo-copy lifetime

The crop, import, reconcile, widget, and Profile-background producers discard each ImageManipulator output after its consumer finishes, including failure paths. The crop screen holds its decode-fallback copy only while that source is in use, then discards it on replacement or unmount. Contact Picker's `contact-picker-*.photo` raw copies are discarded after import or reconciliation stages or skips them. Cleanup errors never change a photo operation's result.

A once-per-process cold-start sweep removes files left by an earlier process in `cache/ImageManipulator/`, `cache/photo-dl/`, and cache-root `contact-picker-*.photo`. The deletion guard rejects document-directory masters, `.tmp`/`.bak` sidecars, staging files, and other cache names. `photo-dl` per-operation retention belongs to URL-download handling; this sweep is its restart backstop. `expo-image-picker` source copies remain a follow-up under D-16.

### Removing and purging photos

1. Contact and profile removal clears the reference and enqueues a durable delete intent in one transaction before deleting the derivable file. Custom-field removal enqueues the intent while the form holds its value; Save or Cancel determines whether the reference predicate allows deletion.
2. The launch sweep locks each canonical path and re-reads its sidecars after locking before repairing an interrupted replacement.
3. An archived-contact purge enqueues intents for its main path, stored safe reference, and every custom-field derived path inside the purge transaction. It includes fields of every type, since a former photo field may retain raw path text after a type change. The post-commit extension executes the committed intents; the foreground drain retries failures.
4. Permanent definition deletion and quarantine expiry enqueue each value owner's derived `cv-` path before the value rows disappear. Changing a field's type never deletes its file or rewrites its raw TEXT. Every deletion checks current references before touching bytes.

### Merging contact photos

1. The merge owner locks absorbed sources, survivor destinations, and absorbed derived paths before staging. It settles earlier journal work, then stages any chosen or sole absorbed main photo and chosen photo-typed custom values.
2. The merge transaction verifies the absorbed identity and references, writes survivor-derived paths, journals finalization and absorbed-path deletions, and deletes the absorbed contact. Navigation supplies only the photo choice; the database row supplies the source path.
3. After commit, finalization and deletion run under the held locks. Failures remain in the durable journal for the foreground drain; the committed merge still navigates to the survivor. Reusing the absorbed integer ID cannot alias the survivor's new photo bytes. Pre-fix aliases are outside this forward-only repair and are not swept.

### Restoring backup photo bytes

1. Backup serializes image bytes, never the device-local relative path as portable authority.
2. Restore stages validated bytes under the guarded restore-pending namespace before its database transaction.
3. A committed journal row authorizes the finalizer to write the fresh canonical relative master or verify a stale master is absent; launch recovery ignores uncommitted work.
4. A foreground drain skips staged files owned by an active session and checks each apparent orphan against the current journal before deleting it.

### Crash ordering for a newer normal write

The path lock is process-local. Crash safety comes from settling old journal rows before the new swap; no journal retirement follows the new replacement.

| Interruption point | State after launch reconciliation and journal drain |
|---|---|
| Before settle finishes | Prior master and retry row remain; recovery can retry. |
| After settle, before swap | Recovered master remains; old row is gone. |
| During `.tmp` copy or after prior master moves to `.bak` | Recovered master remains or is restored from `.bak`; old row is gone. |
| After replacement | New master remains; old row is gone. |

### Importing a selected contact photo

1. Contact Import moves an accepted picker-cache copy into private flat `import-staging/` before it commits the durable session snapshot.
2. After the imported contact transaction succeeds, `import-photo.ts` resolves that relative staging path, produces the ordinary Orbit master, and writes the contact photo reference.
3. Success retires the row reference before best-effort deletion of raw staging. A mastering failure leaves the contact imported and retains the staged input for Retry.

### Reconciling a linked-contact photo

1. Reconciliation copies a current linked-source photo into the guarded `reconcile-staging/` namespace and hashes its bytes for source-change comparison.
2. The detail view offers the staged source photo for a deliberate choice; it never supplies a picker-cache URI to the regular Avatar path.
3. Once the selected data transaction commits, `promoteReconcilePhoto()` produces the usual master and writes the photo reference. A promotion failure leaves the photo snapshot unwritten so it is offered again on a later scan.

### Storing a Profile background

1. The Profile cropper computes a bounded selection at the rendered Profile aspect and produces one JPEG derivative with a 2048-pixel maximum long edge.
2. `background-storage.ts` writes only under `profile-backgrounds/<uid>.jpg` through a temporary/backup swap; SQLite stores that validated relative path, never the picker URI.
3. Presentation assignment commits before obsolete-byte cleanup. Shared files are deleted only after a fresh reference check proves no template still owns them.
4. The ready-gated launch sweep repairs interrupted swaps and removes proven orphans; uncertain state prefers a bounded leak over deleting a referenced image.

### Restoring a Profile background

1. Format-v5 restore stages embedded background bytes in the guarded restore-pending namespace before the database transaction; it never accepts a serialized source path.
2. After the parent-UID presentation graph commits, the background finalizer promotes only the candidate owned by the committed template to `profile-backgrounds/<uid>.jpg`.
3. The shared finalization lock and launch reconciliation re-drive an interrupted committed candidate or prune an uncommitted one without overwriting a newer replacement.

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
- **ADR-112:** App-Owned Profile Background Derivatives and Launch Reconciliation — adds bounded local derivatives, shared-reference cleanup, and DB-aware recovery.
- **ADR-138:** Complete Portable Backup Format v5 — stages and restores Profile background bytes with the parent-UID presentation graph.
- **ADR-156:** Foreground Maintenance Fault Isolation with Per-Pass Dependencies — isolates photo-recovery candidate failures and reports incomplete recovery to dependent backup work within the same pass.
- **ADR-157:** Bounded Native Transfer Ownership — assigns byte, time, and cleanup bounds to native photo acquisition, export, and staging boundaries.
- **ADR-158:** Canonical Photo Ownership Across Masters, Staging, and Derivatives — gives each photo namespace one explicit owner and retirement rule.
- **ADR-159:** Commit-Current Restore with Deterministic Pair Completion and No Legacy Repair — finalizes only journal-authorized bytes owned by the committed restore state.
- **ADR-179:** Owner-Ruled Art Treatments Beyond the Signed Table — the Photo source picker "Remove photo" string sits on an opaque root-`background` backing in Galaxy Dark (`persistentDangerScrim`), clearing 4.5:1 over the art.

## Gotchas

1. **Never store a cache URI or absolute sandbox path.** Cache is evictable and absolute paths fail on restore; store only a validated relative path.
2. **Do not pre-delete a master before replacing it.** Native moves can be delete-then-rename, so the temporary-and-backup swap plus launch reconciliation is load-bearing.
3. **Purge journals paths before deleting database rows.** Filenames stay derivable from contact identity; intents include quarantined and type-changed definitions, while the post-commit adapter and foreground drain apply reference checks.
4. **Custom photo fields have a cancel-path tradeoff.** Their stable canonical file can change before the form commits its value; backing out can retain changed bytes beneath the previous reference. The documented safe posture favors a bounded leak or changed file over deleting a possibly committed file.
5. **Treat image cache replacement carefully across restart.** A same-second replace at a stable path has a narrow stale-decode risk after the in-memory revision resets.
6. **Widget images are base64 only.** RemoteViews must not receive `file://` masters or an `http(s)` source; a failed encode is an initials fallback, not a grid failure.
7. **Never restore a serialized path verbatim.** It belongs to another sandbox; use the embedded bytes and a newly derived canonical master.
8. **Only committed journal rows may finalize restore files.** A process interruption before the database commit must not create a visible master or delete an existing one.
9. **Do not pass import staging to `Avatar`.** It is preview-only and outside Avatar's canonical master namespace; resolve it directly in import UI.
10. **Guard WebCrypto in Hermes.** Reconciliation photo hashing must fall back to RNQC when `globalThis.crypto` is unavailable; the original unguarded digest blocked photo-bearing scans before its Phase-20 fix.
11. **A Profile background is shared template data.** Never apply the avatar pipeline's single-owner deletion assumption; re-read every live template reference first.
12. **Background restore is not contact-photo journaling.** Its UID-derived pending/finalization path must retain the incoming bytes until the committed template owns the candidate.
13. **Canonical masters have one owner.** New writes, recovery, removal, and sidecar reconciliation acquire the same path lock. Delete intents are idempotent and delete only when no live contact, profile, custom-field value, or pending finalize references the exact path.
14. **Every transient native copy needs a named owner and terminal cleanup.** Picker copies, downloads, ImageManipulator outputs, staging files, and derivatives retire at their owning operation's success/failure boundary, with a guarded cold-start sweep only as a crash backstop.
15. **Never broaden a cleanup namespace to repair old aliases.** Restore and merge act on current canonical ownership and committed journal evidence; uncertain or pre-fix paths prefer a bounded leak over deleting potentially live bytes.

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
| 2026-09-02 | 31 | Added Profile-aspect background derivatives, safe app-owned storage, reference-aware cleanup, and launch reconciliation. |
| 2026-09-02 | 36 | Added staged format-v5 Profile-background byte restore and committed-candidate reconciliation. |
| 2026-09-23 | 38.2 | Added settle-before-write ownership, reference-safe delete intents, and staging guards for `reliability-testing/AUD-REL-003`. |
| 2026-09-24 | 38.2 | Re-homed merged photos to survivor-derived masters and journaled purge/definition deletion for all derived paths. |
| 2026-09-24 | 38.2 | Corrected the widget thumbnail description against installed native ImageManipulator behavior and added guarded derivative/picker-copy retirement with a cold-start orphan sweep (`data-privacy/AUD-DPI-011`, RG-013). |
| 2026-09-26 | 38.5 | In Galaxy Dark, the Photo source picker "Remove photo" string sits on an opaque backing over the art (D-50; ADR-179). |
