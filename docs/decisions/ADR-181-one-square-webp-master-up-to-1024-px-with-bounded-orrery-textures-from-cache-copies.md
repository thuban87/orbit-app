# ADR-181: One Square WebP Master up to 1024 px with Bounded Orrery Textures from Cache Copies

**Status:** Accepted
**Date:** 2026-09-30
**Phase:** 38.6-photo-handling
**Source decisions:** D-10, D-11, D-12, D-13, D-20, D-22, D-36 (quality), D-37, D-39, D-41 (dossier `phase-38.6-photo-handling-dossier.md`; DISCUSSION-LOG O-1)
**Reversibility:** costly
**Migration:** None
**Supersedes:** ADR-021 (partial — the one 512×512 JPEG master's size and format die; one master per target, the document directory, identity-derived `.jpg` names and the crash-safe swap and cleanup survive)
**Superseded by:** ADR-240 (partial)

## Context

The 224 dp Profile photo and the full-screen lightbox need about 780–1440 px, but masters were 512×512 JPEG (ADR-021, `07-photos` Cluster B). The 512 size was chosen mainly for Orrery GPU texture memory, then for the widget Binder ceiling, and then for backup size. The owner chose a sharper master after asking for that rationale and being told the storage and backup cost.

## Decision

Every new photo write is saved as one square, lossy WebP master by the shared `encodeMaster`. That covers crop/picker, URL download, custom photo field, self photo, device import, import retry and reconcile. The edge is min(source square side, 1024), never upscaled, and `MASTER_QUALITY` is 0.8 (signed off under D-36). The WebP bytes are stored under the unchanged identity-derived `.jpg` names, and readers decode by content (D-21). Existing 512 JPEG masters are never converted (D-12). Every reader, export, restore, merge re-homing step and launch sweep handles the mixed JPEG/WebP, 512/1024 library. Imported phone photos stay at the native picker's thumbnail size (D-22).

Working memory stays flat (D-11). expo-image surfaces already decode at display size. The Skia Orrery never decodes a master larger than `ORRERY_TEXTURE_MAX` 512. Instead it reads a small JPEG copy that is kept on disk under `<cache>/orrery-photo/<basename>/<size>-<mtime>.jpg` (D-41). The copy is made once per byte change, one at a time. It is discarded through `notifyPhotoBytesChanged`, and a chunked launch sweep removes stale copies. The copy is evictable, never backed up and never a second stored master. The widget encodes its 88 px tiles one at a time. The 8 MiB encrypted-backup cap is unchanged (D-39), and over-cap failures now say the backup is "too large".

## Alternatives Considered

- **512 master + a 1024 lightbox-only file** — the owner's own first idea. Rejected because two files use more storage (≈3.5–4×) than one 1024 file (≈2.5–3×), the Profile photo would stay soft, and working memory is flat either way.
- **1024 JPEG** — rejected because it needs ≈4× storage.
- **Keep 512** — rejected because the Profile photo and the lightbox would be soft.
- **Convert existing photos with a launch sweep** — rejected because it gives no sharpness gain (D-12).
- **An in-memory Orrery downsample cache** (D-37) — built, then superseded by D-41. The manipulator re-decoded every 1024 master on each cold start, which left +23 % graphics / +32.5 % GL at 20 s.
- **Raise the encrypted-backup cap** — rejected by D-39. Measured sizes were 3.81 MB at 50 photo contacts and 6.23 MB at 100, with the cap reached at about 145.
- **Full-size phone photos on import** — needs a native picker change; logged for later (D-22).

## Consequences

### Positive

- The Profile hero and the lightbox are sharp, and new masters are about 20–41 KB.
- With the D-41 copies, Orrery memory on the device stays within the 5 % gate: +2.9 % graphics and +4.2 % GL at 20 s.

### Negative

- Storage and backup size for photos grow by about 2.5–3×. Encrypted backups reach the 8 MiB cap at about 145 photo contacts instead of 100–200.
- An Orrery cold start with 1024 photos is still about 4 s slower than with 512 photos (logged).

### Risks

- A one-time memory and latency spike happens while the copies are first made, for example after a large restore or import, or after Android clears the cache (logged).
- The file extension no longer tells you the format. Code must never infer the format from `.jpg`.

## Implementation

**Key files:**
- `src/services/photos/master-encode.ts` — `MASTER_MAX_EDGE` 1024, `MASTER_QUALITY` 0.8, `encodeMaster`; the one master encoder.
- `src/services/photos/photo-pipeline.ts` — crop/URL/self/custom-field masters through `encodeMaster`.
- `src/services/import/import-photo.ts` — import and import-retry masters through `encodeMaster`.
- `src/services/photos/reconcile-photo.ts` — reconcile masters through `encodeMaster`.
- `src/components/orrery/use-orrery-photo.ts` — `ORRERY_TEXTURE_MAX` gate; loads the on-disk copy and disposes SkImages after commit.
- `src/services/photos/orrery-derivative-store.ts` — cache-dir copy store, signature-keyed, discard on notify, chunked launch sweep.
- `src/services/photos/owned-master.ts` — discards Orrery copies on every canonical byte change.
- `src/components/orrery/OrbitBody.tsx` — draws through `useOrreryPhoto`.
- `src/components/orrery/SunBody.tsx` — draws through `useOrreryPhoto`.
- `src/services/widget/widget-photo.ts` — `encodeTileThumbs` sequential encode; releases each rendered ref.
- `src/services/widget/widget-render.tsx` — uses the sequential tile encode.
- `src/services/backup/encryption.ts` — 8 MiB cap unchanged; typed too-large error.
- `src/services/backup/backup-service.ts` — too-large outcome for manual, automatic and passphrase-change paths.
- `src/screens/backup-health-logic.ts` — "too large" automatic-backup copy.
- `src/screens/backup-restore-logic.ts` — "too large" restore/export copy.
- `src/screens/backup-settings-logic.ts` — "too large" passphrase-change copy.
- `App.tsx` — registers the Orrery copy launch sweep.

**Depends on:** ADR-021 (Durable Relative-Path Photo Masters with Crash-Safe Lifecycle Cleanup); ADR-158 (Canonical Photo Ownership Across Masters, Staging, and Derivatives); ADR-058 (Optional Encrypted Backups and Previewed Local Restoration); ADR-180 (Display-Revision Photo URIs and Current Photos on Every Existing-Contact Surface)
**Required by:** ADR-183 (224 Profile Photo Growing Upward, App-Bar Favourite Star and a Reusable Profile Photo Lightbox); ADR-240 (Import Takes Full-Size Phone Photos, Warns Before Photos Outgrow the Encrypted Backup, and Check Linked Contacts Keeps Thumbnails)
