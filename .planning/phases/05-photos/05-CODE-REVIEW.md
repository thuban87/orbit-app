# Phase 5 (Photos) — Code Review

**Date:** 2026-08-15
**Reviewers:** codex (`codex-cli 0.144.1`, `codex exec` read-only over full source) + claude (read-only, subsystem-level)
**Scope:** the Phase-5 photo subsystem — capture (library/URL), Skia crop, 512px master pipeline, crash-safe storage chokepoint, atomic photo DAO writers, avatar, custom photo field, purge cleanup, launch reconcile sweep.
**Method:** read the actual files on disk (not the diff) plus every writer of `contacts.photo` / `profile.photo` and every deleter of `avatars/*`, per the project review rule.

## Gates (claude, on-box)

- `npx tsc --noEmit` → **pass** (exit 0)
- `npm run check:colors` → **pass** (exit 0; the only hex literals are in `theme-presets.ts`, the token source, which is allowed)
- `npx vitest run` (phase-5 suites) → **75 passed / 75** across 8 files
- (codex ran in a read-only sandbox where Vitest could not create its tmp dir; tsc + check:colors reproduced there)

## Verdict

**blockers=0  high=1  medium=5  low=4** (claude-adjudicated severities; where codex rated a finding higher, both labels are shown).

The subsystem is unusually well-built: the crash-safe `.bak`-swap in `persistMaster` is correct under delete-then-rename `File.move` (verified against all four crash windows); every photo DAO writer is `?`-bound with a `changes===1` guard; the launch reconcile sweep is `ready`-gated with no timer; purge cleanup derives filenames from `contactId` post-commit and includes quarantined defs; `CropPhotoScreen` drives the transform entirely through Reanimated shared values with no per-frame `setState`; all colours (incl. Skia draws) resolve through theme tokens. No blockers found. The findings below are hardening and edge-case correctness.

---

## Findings (most severe first)

### H1 — [codex HIGH / claude HIGH] url-image size cap is not enforced during download in the no-stream fallback
**`src/services/photos/url-image.ts:182-204`** (`readCappedBytes` fallback branch)

When `response.body.getReader` is unavailable, the code validates `content-length` up front and then calls `response.arrayBuffer()`, checking `byteLength` only *after* the whole body is buffered (line 197-204). A malicious server can send a small/forged `content-length` header and then stream an arbitrarily large body — `arrayBuffer()` buffers all of it into memory before the post-read cap check fires, an OOM/DoS on a user-pasted URL. This defeats the phase's explicitly-required "streamed byte cap enforced *during* download, not after" invariant. It matters more than it looks: on many React Native runtimes `getReader` is absent, so **the fallback is the path that actually runs on device**, not the streamed path.

**Fix:** fail closed when no readable stream is available (throw `content`), OR replace the transfer with a native downloader that exposes a streamed, abortable byte limit. Do not call `arrayBuffer()` behind a spoofable length header. If the streamed path is confirmed unavailable on the target RN runtime, this fallback becomes the primary path and must be replaced, not relied on.

### M1 — [codex HIGH / claude MEDIUM] custom-field photo mutates disk before the DB value commits
**`src/components/PhotoSourcePicker.tsx:176-182`** (customField Remove) · **`src/screens/CropPhotoScreen.tsx:283-291`** + **`photo-pipeline.ts:103`** (customField Change)

For a custom photo field the file is mutated eagerly but the DB value only changes on the edit form's Save:
- **Remove** calls `deletePhoto(customFieldPhotoRelPath(...))` inline and defers the value clear to Save. Backing out of the edit leaves the committed `contact_custom_values` value pointing at a now-missing file.
- **Change** overwrites the canonical `cv-…jpg` (a stable derivable path) via `persistCroppedMaster` before Save. Because the stored value equals that stable path, cancelling the edit still leaves the *new* bytes on disk under the unchanged committed value — the saved photo silently changes on Cancel.

Both degrade gracefully (a missing file → `Avatar` `onError` → initials; the change case shows the new photo), do not corrupt the DB, and are a documented tradeoff ("if uncertain, don't delete"; self-healing + purge-cleaned). claude therefore rates MEDIUM; codex rates HIGH because Cancel can still alter committed user data. **This is the contact/profile-vs-customField asymmetry:** contact/profile Remove clears the DB *and* deletes the file in the same handler (`PhotoSourcePicker.tsx:166-174`), so only the customField path has the gap.

**Fix (needs planner/owner input — intersects the DECIDED derivable-filename invariant):** stage the customField crop to a non-canonical temp path, promote it to the canonical derivable path only inside the successful Save flow, and defer the file delete until after the value clear commits. Keep the canonical path derivable so purge (05-07) still works. Do not change the derivable-filename scheme itself without an owner decision.

### M2 — [codex MEDIUM / claude MEDIUM] redirect scheme re-validation is fail-open when `response.url` is empty
**`src/services/photos/url-image.ts:244`**

`if (response.url && !isImageUrl(response.url))` skips the redirect-downgrade check entirely when `response.url` is falsy. Some RN fetch runtimes report `response.url` as `""`, in which case an `https → http` (or other-scheme) redirect would not be re-validated — the exact SSRF/downgrade gap the re-check exists to close. Theoretical (requires empty `response.url` *and* a downgrade redirect the platform follows), hence MEDIUM.

**Fix:** require `isImageUrl(response.url)` unconditionally; if the runtime cannot expose a final URL (`response.url` empty), fail closed rather than accept.

### M3 — [codex MEDIUM / claude MEDIUM] content-type check is a family prefix, not a raster allowlist
**`src/services/photos/url-image.ts:257-263`**

`contentType.startsWith("image/")` accepts every `image/*` subtype, including `image/svg+xml`, `image/tiff`, `image/avif`, `image/bmp` (all present in `CONTENT_TYPE_MAP`) and any unknown subtype. SVG in particular is a script/XXE-bearing format. Mitigated because the downstream `expo-image-manipulator` re-encodes to JPEG and an undecodable body surfaces the "couldn't be used" copy — so exploitation is unlikely, but the gate is broader than the phase's raster-only intent.

**Fix:** normalize the MIME (strip params, lowercase — `extFromContentType` already does this) and require membership in a finite raster set (`image/jpeg`, `image/png`, `image/webp`; `image/gif` only if deliberately supported). Drop svg/tiff/avif from the accepted set.

### M4 — [codex MEDIUM / claude MEDIUM] photo DAO setters do not enforce the relative-path invariant
**`src/db/contacts-dao.ts:479-496`** (`setContactPhoto`) · **`src/db/profile-dao.ts:36-52`** (`setProfilePhoto`) · custom values via **`src/db/field-values-dao.ts:126`**

The setters persist any string. Today every caller passes a `persistMaster`-validated relative path, so this is not currently exploitable — but there is no guard at the write boundary. If a future caller ever stored an absolute/`cache://`/`file://` value, `Avatar` → `resolvePhotoUri` → `assertSafeRelative` would **throw synchronously during render** (not caught by `onError`), crashing the screen. Defense-in-depth gap against a documented invariant ("the stored value is the RELATIVE filename, never an absolute/cache URI").

**Fix:** extract the `SAFE_RELATIVE` allowlist from `photo-storage.ts` into a node-pure shared module and assert it in `setContactPhoto` / `setProfilePhoto` before the UPDATE; validate custom photo values before the generic `upsertValueCore` too.

### M5 — [codex MEDIUM / claude MEDIUM] cross-restart cache can serve a stale decode after a same-second replace
**`src/stores/photo-cache-bust-store.ts:18-22`** (comment claim) · **`src/components/Avatar.tsx:64-78`**

The store header claims correctness holds across restart, but it does not for this sequence: initial set at `modified_at=T` renders with `cacheKey = photo#T` (rev undefined), so `cachePolicy="memory-disk"` writes a **disk** decode of v1 under key `photo#T`. A same-second replace bumps rev → renders under `photo#T#1` (v2). After a restart, rev resets to undefined and the key falls back to `photo#T` — which still resolves to the v1 disk entry from the first session, serving the stale decode. The in-memory rev counter cannot cover this because the disk cache key persists. Narrow (same-second replace + restart), hence MEDIUM — but it is exactly the same-second case the store was built to fix.

**Fix:** either persist a monotonic per-path generation so the cross-session key is always fresh, or set `cachePolicy="memory"` for these local document-dir masters (the file already lives on local disk, so disk-caching its decode buys little and is the source of the staleness).

### L1 — [codex LOW / claude LOW] custom-value UPSERT discards the row-count guard
**`src/db/field-values-dao.ts:136-144`** (`upsertValueCore`)

`runAsync(...).then(() => undefined)` drops the result, so the project's `changes===1` writer contract is not asserted here (the path custom photo values persist through). Weak in practice: an `INSERT … ON CONFLICT DO UPDATE` always affects exactly one row, and this is pre-existing Phase-6 code outside the Phase-5 file set. Included for completeness.

**Fix (optional):** await the result and assert `result.changes === 1`, throwing otherwise — mainly for consistency with the other writers.

### L2 — [claude LOW] crop rect is emitted with non-integer pixel bounds
**`src/services/photos/crop-geometry.ts:82-95`**

`sizeSrc = viewport / eff` and the origins are floats; `originX/originY/width/height` are handed to `ImageManipulator.crop()` unrounded. Manipulators typically floor internally, but a fractional rect risks an off-by-one or a platform-specific reject at the source edge.

**Fix:** `Math.round`/`Math.floor` the rect (and clamp `width/height` so `origin + size <= src`) before returning.

### L3 — [claude LOW] customField crop with a falsy requestId silently orphans the master
**`src/screens/CropPhotoScreen.tsx:283`**

The customField branch is gated on `route.params.requestId` being truthy. If a customField target ever reached the crop screen without a `requestId`, `persistCroppedMaster` has already written the `cv-` master but no `publishCropResult`/`markPhotoStaged` runs — the widget never learns and the file is orphaned until purge. Unreachable today (the picker always threads `requestId` for customField), so LOW.

**Fix:** treat "customField target with no requestId" as an assertion/log rather than a silent `goBack()`.

### L4 — [claude LOW / informational] URL download blocks scheme only, not host (private-IP/localhost SSRF)
**`src/services/photos/url-image.ts:108-117`** (`isImageUrl`)

`isImageUrl` allows any `https:` URL regardless of host, so a pasted `https://` link to a LAN/localhost address is fetched. This is the **DECIDED** scheme-only allowlist posture (T-05-02/T-05-03) and is a risk/security-posture call in the owner's bucket — noted, not a change to make unilaterally. Full host-level SSRF defense (private-range/DNS-rebind blocking) is generally not feasible in the RN fetch layer anyway.

---

## Cross-check confirmations (claude — no issue found)

- **Crash-safe replace:** `persistMaster` (`photo-storage.ts:154-207`) never pre-deletes the sole master — copy→`.tmp`, move-prior→`.bak`, move-`.tmp`→dest, delete-`.bak`. Verified safe across all four crash windows under delete-then-rename `File.move`; `reconcilePhotoDir` restores/cleans correctly incl. the both-sidecars-present case.
- **No absolute/cache URI stored:** the pipeline returns only the relative path (`photo-pipeline.ts:102-104`); every DAO stores that relative value.
- **Purge contract:** `buildPhotoPurgeCleanup` runs post-commit, derives filenames from `contactId`, and reads `listDefs(exec, { includeQuarantined: true })` — matches `PurgeOptions.onPurgeExtensions` and is wired at `ArchivedContactsScreen.tsx:133-135`.
- **Launch sweep:** `registerPhotoReconcileSweep` is registered from the `ready`-gated App effect behind a module-scope idempotency guard, no timer (`App.tsx:77-95`).
- **No network on read path:** `getContactHeader`/`getProfile` are pure local SQLite reads; `Avatar` resolves a local `file://` and never a network URL.
- **Reanimated discipline:** `CropPhotoScreen` gesture worklets mutate shared values only; React state is used for one-time geometry init and busy/ready flags, never per frame.
- **DAO safety:** all photo writers `?`-bind and guard `changes===1`; the only interpolated identifier anywhere is a `isSafeColName`-guarded `col_name`.
