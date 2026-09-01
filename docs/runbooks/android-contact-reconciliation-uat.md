# Android Contact Reconciliation UAT Pipeline

## Overview

Use this procedure when changing linked-contact reconciliation, duplicate merge, or the Contacts permission path. It verifies the feature against a debuggable Android build and a WAL-aware SQLite snapshot; it must use isolated device-local fixtures and must never mutate real synced contacts.

## Architecture (Phase 20)

Reconciliation reads an already-linked Android contact through `orbit-contact-picker`, classifies five field families, and persists review work in migration-013 session tables. Merge is a local SQLite transaction that reparents compatible children, deletes the absorbed contact, and writes a generic tombstone.

### Device-to-database evidence chain

**File:** `src/db/migrations/013-reconciliation-and-merge.ts`

`reconciliation_sessions` and `reconciliation_session_cards` retain resumable review state. `reconcile_source_snapshot` records only reviewed canonical source values, while `bulk_review_resolutions` records a `fixed` or `ignored` unreadable-birthday disposition.

### Resolution order

1. **Runtime UI result** — drive the visible reconciliation or merge flow on the debug build.
2. **WAL-aware database snapshot** — copy `orbit.db`, `orbit.db-wal`, and `orbit.db-shm` through `run-as` before querying results.
3. **Targeted automated tests** — use the phase test files when an Android action sheet cannot be driven reliably with adb input.

## File Locations

### Code

| File | Purpose |
|------|---------|
| `src/screens/ReconcileDetailScreen.tsx` | Per-contact source read and review. |
| `src/screens/ReconcileGridScreen.tsx` | Batch linked-contact scan and card workspace. |
| `src/db/merge-dao.ts` | Atomic merge writer and tombstone retirement. |
| `src/db/reconcile-session-read.ts` | Resume and completion-count reads. |
| `src/db/reconcile-relink-dao.ts` | Non-destructive missing-source relink/unlink. |
| `src/db/bulk-review-dao.ts` | Birthday Fix/Ignore resolution writer. |

## How to Run Contact Reconciliation UAT

1. **Confirm the target is the API-37 Pixel debug build.** Do not use this procedure against a device containing fixtures you do not recognize.

   ```bash
   device_serial=1A071FDEE002BU
   adb -s "$device_serial" shell getprop ro.product.model
   adb -s "$device_serial" shell getprop ro.build.version.sdk
   adb -s "$device_serial" shell run-as com.bwales.orbit id
   ```

   Expected: `Pixel 6 Pro`, SDK `37`, and a successful `run-as` identity.

2. **Build and install the debug APK, then confirm migration 013.** Preserve existing isolated `ZZ-UAT-` fixtures unless a test explicitly needs new data.

   ```bash
   adb -s "$device_serial" install -r <debug-apk-path>
   adb -s "$device_serial" shell run-as com.bwales.orbit sh -c 'sqlite3 files/SQLite/orbit.db "PRAGMA user_version;"'
   ```

   Expected: installation succeeds and `user_version` is `13`.

3. **Take a WAL-aware snapshot before and after each scenario.** Copy all three files together; reading only the main database can omit committed WAL pages.

   ```bash
   uat_snapshot_dir=$(mktemp -d)
   adb -s "$device_serial" exec-out run-as com.bwales.orbit cat files/SQLite/orbit.db > "$uat_snapshot_dir/orbit.db"
   adb -s "$device_serial" exec-out run-as com.bwales.orbit cat files/SQLite/orbit.db-wal > "$uat_snapshot_dir/orbit.db-wal"
   adb -s "$device_serial" exec-out run-as com.bwales.orbit cat files/SQLite/orbit.db-shm > "$uat_snapshot_dir/orbit.db-shm"
   ls -lh "$uat_snapshot_dir"
   ```

   Expected: the main database and its WAL/SHM companions are present. Open that directory with a WAL-aware SQLite tool before making an assertion.

4. **Exercise an atomic merge.** From a profile, choose `Merge with another contact`, select the survivor, resolve name/birthday/photo or competing-primary conflicts, and confirm the impact summary. Verify the app lands on the survivor; the absorbed row is absent from `contacts` and has a `tombstones.entity_type='contact'` record. Never treat archive/restore as a merge result.

5. **Exercise per-contact and batch reconciliation.** On a Bound linked fixture, change one Android source value and use `Update from Contacts`. Verify additive values are recommended, conflicts need a manual choice, a kept unchanged source does not re-nag, and a changed-again source reappears. Then use Settings → `Check linked contacts`: only changed contacts form cards; `Use Contact Values` is unavailable for conflict or photo selections.

6. **Exercise resume and missing-source handling.** Resolve one card, leave another unresolved, then force-stop and relaunch:

   ```bash
   adb -s "$device_serial" shell am force-stop com.bwales.orbit
   ```

   Expected: Resume opens only unresolved cards and keeps the committed edit. For a deleted device source, verify `Source missing`; Keep leaves Orbit data alone, Relink retires the stale external link and reviews the replacement, and Unlink changes only the link.

7. **Exercise unreadable-birthday review.** Import a fixture whose raw birthday is `2021-02-29`, then use Settings → `Review flagged items`. Fix with a valid local date and confirm a `fixed` resolution plus a data-revision advance. On a second fixture, choose Ignore and confirm an `ignored` resolution while birthday and other contact data remain unchanged.

8. **Run the automated backstops.**

   ```bash
   npx vitest run src/db/merge-dao.test.ts src/db/reconcile-apply.test.ts src/db/reconcile-session-dao.test.ts src/db/reconcile-session-read.test.ts src/db/reconcile-relink-dao.test.ts src/db/bulk-review-dao.test.ts src/db/bulk-review-read.test.ts
   npx tsc --noEmit
   npm run check:colors
   ```

   Expected: all commands exit zero. Use this evidence for bulk action-sheet behavior when injected adb taps cannot drive the React Native modal.

### What You Don't Need to Change

Do not alter real Google-account contacts, production source data, the system-picker import path, or remote services: reconciliation is local and one-way. Do not manually edit a SQLite fixture to simulate a merge; the point is to prove the UI and `mergeContacts()` transaction together.

## Pitfalls

1. **Do not read only `orbit.db`.** SQLite WAL can hold the committed result; copy the `-wal` and `-shm` files as part of the same evidence snapshot.
2. **Do not use plain tap to select a grid card.** On the tested React Native surface, long-press uses `adb shell input touchscreen swipe X Y X Y 800`; a normal tap inspects the card.
3. **Do not interpret a bulk action-sheet adb limitation as a product failure.** The Phase-20 modal backdrop swallowed injected actions; verify the same writer through its unit tests and the equivalent per-card flow.
4. **Do not classify missing source as removed fields.** A missing source must preserve the Orbit contact and its data.
5. **Record the accepted notification limitation.** After a merge, survivor notification refresh is foreground-launch eventual, not an immediate reschedule.

## Smoke Test

```bash
npx vitest run src/db/merge-dao.test.ts src/db/reconcile-session-read.test.ts src/db/bulk-review-dao.test.ts
```

Expected: the merge, durable-session, and birthday-resolution tests pass.

```bash
adb -s 1A071FDEE002BU shell run-as com.bwales.orbit id
```

Expected: a debuggable installed Orbit build permits WAL-aware evidence collection.
