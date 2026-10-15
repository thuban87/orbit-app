# ADR-180: Display-Revision Photo URIs and Current Photos on Every Existing-Contact Surface

**Status:** Accepted
**Date:** 2026-09-30
**Phase:** 38.6-photo-handling
**Source decisions:** D-01, D-02, D-14, D-19, D-21, D-25 (dossier `phase-38.6-photo-handling-dossier.md`; device spike `38.6-SPIKE.md`)
**Reversibility:** reversible
**Migration:** None
**Supersedes:** None
**Superseded by:** None

## Context

Each photo is overwritten at its fixed identity-derived path (ADR-021, ADR-158), so the `file://` URI never changes. On Android, expo-image hands `file://` sources to Glide before it reads `cacheKey`. The cache-bust counter therefore did nothing, and the Profile and Contacts page kept showing a replaced photo. Only the crop screen bumped that counter. Several surfaces that show an existing Orbit contact rendered initials, or no avatar at all, even though the contact had a photo.

## Decision

We will put an in-process display revision in the display URI (`file://…/avatars/contact-<id>.jpg?v=<revision>`). `Avatar` renders it with a memory-only cache and a revision-keyed `recyclingKey`. The revision is published only by the ownership layer (`notifyPhotoBytesChanged` in `owned-master.ts`). That happens on every canonical byte change: persist, restore and merge finalize, a confirmed delete, `.bak` recovery, and the Replace-all cleanup delete. The revision is kept apart from the authorization generation. Filenames never change (D-21). On first launch, a one-time sweep clears the legacy expo-image disk cache. A TypeScript-parsed source-scan contract pins the sole publisher, the raw byte writers and the plain `resolvePhotoUri` importers.

Every surface that shows an existing Orbit contact passes the stored relative path to `Avatar`, never a pre-resolved URI. Real photos replace initials in these places:
- Your Week day detail
- Pending confirmations
- the reconcile candidate grid and merge-conflict photo choice
- import's existing-contact choices (F-1)
- the Home assist banner (F-2)
- the "keep Orbit photo" card in Update from Contacts (F-3)

The History DateDetailSheet, reach-out chooser, archived contacts, merge impact summary, F-4 and F-5 stay text-only.

## Alternatives Considered

- **A new filename per write** — the preferred direction under D-19. Rejected by D-21: it reverses ADR-021/ADR-158's identity-derived names and touches backup, merge and purge path handling.
- **`cacheKey` cache-busting** — the previous scheme. Rejected because Android expo-image ignores `cacheKey` for `file://` sources.
- **Explicit cache eviction after each write**, or a no-cache fallback — not needed. The spike proved the revision query on device (`SPIKE_RESULT: revision-query-pass`).
- **Photos on pre-import device-contact surfaces** — already present. Import review, the consolidation prompt and the legacy picker already show the phone photo.
- **Avatars on every text-only list** (archived, reach-out, history day, merge impact, F-4/F-5) — rejected by D-14/D-25. The name is enough there.

## Consequences

### Positive

- Any writer that goes through the ownership layer refreshes every mounted avatar at once, and again after a restart. On the device, 24 of 24 readings matched across 8 surfaces.
- The dead `cacheBust` / `modifiedAt` / `photoCacheBust` prop chain is gone.

### Negative

- A new byte writer that bypasses `owned-master.ts` would leave stale photos. The contract test exists to fail on that.

### Risks

- A display notify can never fail a landed write (review IN-06). A delete publishes only after the file is confirmed gone.

## Implementation

**Key files:**
- `src/components/photo-display.ts` — `PHOTO_DISPLAY_STRATEGY` revision-query, `usePhotoDisplay`, `getPhotoDisplay`.
- `src/components/Avatar.tsx` — renders the display source with a memory cache; the `cacheBust` prop is removed.
- `src/services/photos/photo-storage.ts` — `photoDisplayUriFromDocumentUri` / `resolvePhotoDisplayUri`; filenames unchanged.
- `src/services/photos/owned-master.ts` — `notifyPhotoBytesChanged` at every canonical byte change; the sole publisher.
- `src/stores/photo-cache-bust-store.ts` — the revision store, bumped only by the ownership layer.
- `src/services/photos/legacy-image-disk-cache-sweep.ts` — one-time legacy Glide disk-cache clear behind an AsyncStorage flag.
- `src/services/photos/photo-writer-contract.test.ts` — source-scan contract for publishers, raw writers and resolver importers.
- `src/backup/restore-apply.ts` — publishes after the Replace-all cleanup delete.
- `src/screens/CropPhotoScreen.tsx` — call-site bumps removed.
- `App.tsx` — registers the legacy disk-cache sweep.
- `src/db/your-week-read.ts` — `contactPhoto` in the day rows.
- `src/components/digest/DigestDayDetail.tsx` — day-detail avatars.
- `src/db/interaction-assist-read.ts` — `contact_photo` on eligible pending assists.
- `src/components/PendingConfirmationsSheet.tsx` — per-question avatar.
- `src/components/AssistBanner.tsx` — banner avatar (F-2).
- `src/components/CandidateCardGrid.tsx` — candidate `photo` through Avatar.
- `src/components/PhotoChoice.tsx` — canonical photo through Avatar; staging previews uncached; `keepPhoto` card (F-3).
- `src/screens/ReconcileGridScreen.tsx` — passes the canonical photo path.
- `src/screens/MergeConflictsScreen.tsx` — passes the canonical photo path.
- `src/screens/ReconcileDetailScreen.tsx` — Orbit photo beside the phone photo (F-3).
- `src/screens/existing-contact-choices.ts` — maps candidates to name and photo (F-1).
- `src/components/ExistingContactChoice.tsx` — existing-contact choice sheet and link button with avatars (F-1).
- `src/screens/DuplicateReviewScreen.tsx` — uses the existing-contact choice sheet.
- `src/screens/ImportReviewScreen.tsx` — "might already be in Orbit" choices with avatars.

**Depends on:** ADR-021 (Durable Relative-Path Photo Masters with Crash-Safe Lifecycle Cleanup); ADR-022 (Tokenized Deterministic Initials Avatars); ADR-158 (Canonical Photo Ownership Across Masters, Staging, and Derivatives)
**Required by:** None
