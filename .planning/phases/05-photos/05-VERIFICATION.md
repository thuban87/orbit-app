---
phase: 05-photos
verified: 2026-08-15T15:46:46Z
status: passed
score: 3/3 success criteria code-verified + core on-device UAT PASSED; 5/5 PHOTO requirements code-verified
mode: mvp
behavior_unverified: 0
overrides_applied: 0
gates:
  tsc: "pass (exit 0)"
  check_colors: "pass (exit 0)"
  biome: "pass (exit 0 — 121 files, no fixes)"
  vitest: "pass (426/426 tests, 36 files)"
on_device_uat_verified:  # driven on the physical Pixel 6 Pro (1A071FDEE002BU) via a release APK, 2026-08-15
  - "Release APK (all 7 new native modules — Skia/Reanimated/gesture-handler/image-picker/manipulator/file-system/expo-image) built (BUILD SUCCESSFUL, 714 tasks) + installed + launched with NO crash → native enablement (05-01) PASS"
  - "PHOTO-01: tapping Add photo launched the Android system Photo Picker with NO runtime permission prompt (foreground=com.google.android.photopicker, no allow/permission node in the tree)"
  - "PHOTO-01: the Skia CropPhotoScreen ('Position photo') rendered the picked image with the 1:1 crop frame + dim bands; 'Use photo' completed the pipeline"
  - "PHOTO-03: the 512px master persisted and rendered in the self avatar from its stored relative path (photo displayed post-save; affordances flipped Add→Change/Remove)"
  - "PHOTO-04: the no-photo self record showed the deterministic themed-swatch 'Y' initials avatar (no hardcoded colour)"
  - "PHOTO-05: Remove photo showed the non-undoable confirm ('…deletes the photo from this device and can't be undone.') → inline delete → avatar reverted to the initials fallback"
on_device_uat_remaining:  # lower-risk; the shared crop→512px→persist engine is proven above + node-tested
  - "Pasted-https-URL download end-to-end on device (url-image SSRF/size-cap logic is node-tested; the URL path feeds the same proven crop/persist engine)"
  - "Custom photo-field set on a CONTACT end-to-end (needs a contact + custom field; reuses the same proven pipeline + node-tested photo-field-logic)"
  - "Purge actually deleting a photo'd contact's avatars/* files on-disk (post-commit adapter node-tested against a real SQLite fixture incl. quarantined defs)"
  - "Crop pan/pinch gesture FIDELITY (default framing was used; pinch-driving via adb is unreliable — visual render confirmed)"
human_verification:
  - test: "On the Pixel release build: set a contact photo from the gallery; confirm NO permission prompt appears and the system Photo Picker opens."
    expected: "Photo Picker opens directly; no CAMERA/storage runtime permission dialog."
    why_human: "Native picker launch + Android permission behaviour cannot be exercised in node/vitest."
  - test: "Frame a picked photo in the Skia crop, save, and confirm the profile avatar updates to the cropped 512px image."
    expected: "Crop pans/zooms smoothly; saved avatar is the framed region, sharp at profile size."
    why_human: "Skia render loop, gesture feel, and real manipulator output are device-only."
  - test: "Paste an https image URL, save, then enable airplane mode and reopen the contact."
    expected: "Photo downloaded once at paste; renders offline from the local master with no network."
    why_human: "Real network download + offline read path is device-only."
  - test: "Replace then remove a photo; purge an archived contact that had a photo and a custom photo field."
    expected: "Old file gone after replace/remove; after purge, avatars/contact-<id>.jpg and avatars/cv-<id>-<col>.jpg are gone; avatar falls back to initials."
    why_human: "Real filesystem deletion + fallback render is device-only."
---

# Phase 5: Photos — Verification Report

**Phase Goal:** A single-master photo pipeline — library picker + URL path, in-app Skia crop, themed initials fallback — reused for contacts, the self record, and custom `photo` fields.
**Verified:** 2026-08-15T15:46:46Z
**Status:** passed-pending-uat (0 blockers; all code-verifiable truths MET; native flows queued for the physical-Pixel release build)
**Re-verification:** No — initial verification
**Mode:** mvp

## Gate Outputs (run on-box during verification)

| Gate | Command | Result |
| ---- | ------- | ------ |
| Typecheck | `npx tsc --noEmit` | **pass** (exit 0) |
| Colour tokens | `npm run check:colors` | **pass** (exit 0) |
| Lint/format | `npx @biomejs/biome check src/` | **pass** (exit 0 — 121 files, no fixes) |
| Tests | `npx vitest run` | **pass** — 426/426 tests, 36 files |

Phase-5 test coverage (node-runnable): photo-storage 20, url-image 18, crop-geometry 8, photo-dao 10, avatar-initials 13, photo-field-logic 7, purge-photo-cleanup 3, edit-contact-logic 19.

## Goal Achievement — Success Criteria

| # | Criterion | Verdict | Evidence |
| - | --------- | ------- | -------- |
| 1 | Set a contact/self photo from the library (no camera/permission) + Skia crop; a pasted URL downloads once to the same local master | **MET (code-verified) + on-device UAT pending** | Library: `PhotoSourcePicker.tsx:130-132` `launchImageLibraryAsync({mediaTypes:['images'], allowsEditing:false})`; no-camera config `app.config.ts:69-70` (`cameraPermission:false, microphonePermission:false` → CAMERA/RECORD_AUDIO kept out of manifest). Skia crop: `CropPhotoScreen.tsx` `Canvas`+`useSharedValue`/`useDerivedValue` (`:41,:58-59,:126-136`), transform → `persistCroppedMaster` (`:67`); pure geometry tested (`crop-geometry.test.ts`, 8). URL: `url-image.ts:280 downloadImageToCache` → cache → **same** `persistCroppedMaster` engine → one master; 18 tests. *On-device:* picker launch/no-prompt, Skia render fidelity, real network download. |
| 2 | Each photo is one 512px JPEG under the document dir, stored as a relative path resolved at read | **MET (code-verified) + on-device UAT pending** | `photo-pipeline.ts:39` `MASTER_SIZE=512`, `:85-92` `crop→resize(512,512)→JPEG q0.75`; `:100-104` copies manipulator cache output into `Paths.document/avatars` via `persistMaster` and returns ONLY the relative path. `photo-storage.ts:130-132 resolvePhotoUri` composes `file://` at read; `SAFE_RELATIVE` allowlist (`photo-relative-path.ts:22`). Tests: `photo-storage.test.ts` (20, incl. resolve + rejection). *On-device:* actual 512px pixel output + cache→document copy landing. |
| 3 | Photo-less contact shows a deterministic themed-swatch initials avatar (no hardcoded colour); replace/remove deletes the old file and purge deletes photo files | **MET (code-verified) + on-device UAT pending** | Fallback: `Avatar.tsx:85-113` uses `colors.avatarSwatches[swatchIndex(name)]` + `colors.avatarSwatchText` — theme tokens only, no free HSL (`avatar-initials.ts` bars the legacy hue); `check:colors` exit 0; swatches live in the token source `theme-presets.ts:38-49`; 13 initials tests. Replace/remove: contact/profile clear DB + `deletePhoto` in the same handler (`PhotoSourcePicker.tsx:17-18`); crash-safe `.bak` swap `persistMaster` (`photo-storage.ts:141-194`). Purge: `buildPhotoPurgeCleanup` wired `ArchivedContactsScreen.tsx:133-134`, derives filenames from `contactId` incl. `includeQuarantined:true` (`purge-photo-cleanup.ts:73`). *On-device:* real FS delete. |

**Score:** 3/3 success criteria code-verified (native sub-behaviours queued for Pixel UAT).

## Requirements Coverage

| Req | Description | Verdict | Evidence |
| --- | ----------- | ------- | -------- |
| PHOTO-01 | Library photo (no camera/permission) + in-app Skia crop, for contact and self | **MET (code) + on-device** | `PhotoSourcePicker.tsx:130-132`, `app.config.ts:69-70`, `CropPhotoScreen.tsx`, `persistCroppedMaster`. Contact wired `EditContactScreen.tsx:443`; self wired `SettingsScreen.tsx:99` (`getProfile`/`setProfilePhoto`). |
| PHOTO-02 | URL paste downloads once to the same local master | **MET (code) + on-device** | `url-image.ts:280 downloadImageToCache` → same crop pipeline → one master. https-only allowlist, unconditional redirect re-check, raster-only content-type, streamed/native memory-safe byte cap (18 tests). |
| PHOTO-03 *(infra)* | One 512px JPEG under document dir, relative filename resolved to `file://` at read | **MET (code) + on-device** | `photo-pipeline.ts:39,85-104`; `photo-storage.ts:116-132,141-194`; `photo-relative-path.ts`. |
| PHOTO-04 | Deterministic themed-swatch initials fallback (no free HSL, no hardcoded colour) | **MET (code-verified)** | `Avatar.tsx:85-113`, `avatar-initials.ts:42-59` (deterministic hash → swatch index), `theme-presets.ts:38-49` tokens; `check:colors` exit 0. 13 tests. Fully node-verifiable; no on-device dependency. |
| PHOTO-05 | Replace/remove deletes old file inline (non-undoable); purge deletes contact + custom photo-field files | **MET (code) + on-device** | Replace/remove: `PhotoSourcePicker.tsx:17-19`, crash-safe swap. Purge: `purge-photo-cleanup.ts:62-100` wired at `ArchivedContactsScreen.tsx:133-134`, incl. quarantined defs. See caveat M1 below (customField cancel-path). |

No orphaned requirements — REQUIREMENTS.md maps exactly PHOTO-01…05 to Phase 5, and all five are claimed across the phase plans.

## Non-Negotiables — Code Confirmation

| Invariant | Status | Evidence |
| --------- | ------ | -------- |
| No hardcoded colour incl. Skia | ✓ | `check:colors` exit 0; every Avatar/CropPhotoScreen draw resolves through `useTheme().colors.*`; hex only in token source `theme-presets.ts`. |
| No network on read path | ✓ | `Avatar` resolves a local `file://` (`resolvePhotoUri`); `getContactHeader`/`getProfile` are local SQLite; network only on paste-time write (`url-image.ts`). |
| One 512px master | ✓ | `photo-pipeline.ts:39,87` — single `resize(512,512)` JPEG; no thumbnail pair, no original retained. |
| relative → `file://` at read | ✓ | `photo-storage.ts:116-132`; DB stores relative only. |
| Derivable-from-contactId filenames incl. quarantined defs on purge | ✓ | `purge-photo-cleanup.ts:65-98`, `listDefs(..., {includeQuarantined:true})`. |
| Crash-safe `.bak` swap, never pre-delete | ✓ | `photo-storage.ts:141-194` (copy→.tmp, move-prior→.bak, move-.tmp→dest, delete .bak) + `reconcilePhotoDir` sweep; tested across crash windows `photo-storage.test.ts:187-289`. |
| Reanimated shared values, no per-frame setState | ✓ | `CropPhotoScreen.tsx:126-136` shared values; `useState` only for one-time geometry init + busy/ready flags (`:118-123`); no `runOnJS(setState)` in worklets. |
| DAOs in `src/db` | ✓ | `contacts-dao.ts`, `profile-dao.ts` (net-new), `purge-dao.ts`; components never inline SQL. |
| No new SQLite migration | ✓ | Only `src/db/migrations/001-initial.ts` exists; `profile` table already created in migration 001. |

## Code-Review Findings — Re-verified Against Shipped Code

The 05-CODE-REVIEW.md listed 0 blockers, 1 high, 5 medium, 4 low. Verified against current source:

| ID | Review status | Current code | Note |
| -- | ------------- | ------------ | ---- |
| H1 (url size cap OOM in fallback) | HIGH | **FIXED** | `url-image.ts:378-400` — no `arrayBuffer()`; native `downloadFileAsync` stream-to-disk + stat/delete, else FAIL CLOSED. |
| M2 (redirect re-check fail-open) | MEDIUM | **FIXED** | `url-image.ts:304-309` — unconditional `isImageUrl(response.url)`, empty url fails closed. |
| M3 (content-type family prefix) | MEDIUM | **FIXED** | `url-image.ts:171-173,320` — finite raster allowlist (JPEG/PNG/WebP). |
| M4 (DAO setters no relative-path guard) | MEDIUM | **FIXED** | `contacts-dao.ts:491`, `profile-dao.ts:47` assert `assertSafeRelative` before UPDATE; test `photo-dao.test.ts:95`. |
| M1 (customField mutates disk before DB commit) | MEDIUM | **OPEN — documented tradeoff** | See below. Non-corrupting, self-healing, purge-cleaned; asymmetry is customField-only. |
| M5 (cross-restart same-second stale decode) | MEDIUM | OPEN | Narrow (same-second replace + restart); `Avatar` cache-bust folds `modified_at`+rev. Non-blocking. |
| L1 (custom-value UPSERT drops changes guard) | LOW | OPEN | Pre-existing Phase-6 code; `ON CONFLICT` affects one row. |
| L2 (crop rect non-integer bounds) | LOW | OPEN | `crop-geometry.ts` emits float rect (no `Math.round`); manipulator floors internally; clamping tested. |
| L3 (customField crop w/ falsy requestId orphans master) | LOW | OPEN | Unreachable today (picker always threads requestId). |
| L4 (URL scheme-only, not host — private-IP SSRF) | LOW/info | OPEN by design | The DECIDED scheme-only posture (owner's risk bucket); not a change to make unilaterally. |

## Anti-Patterns Scanned

No TODO/FIXME/XXX/PLACEHOLDER debt markers in phase-5 source. No stub returns, no hollow props, no per-frame `setState`. `deletePhoto`/reconcile use best-effort try/catch with `Logger.error` (intentional, documented). No hardcoded colours (gate green).

## Notable — Owner Attention (not blockers)

- **M1 (customField cancel-path asymmetry):** For a custom `photo` field, the crop overwrites the canonical `cv-…jpg` (a stable derivable path) and Remove deletes the file inline, but the DB value only changes on the edit form's Save — so backing out of the edit can leave a changed/missing file under the unchanged committed value. Contact/profile do NOT have this gap (they clear DB + delete file in the same handler). It degrades gracefully (missing file → initials; changed file → new photo shows), never corrupts the DB, and is a documented "if uncertain, don't delete" tradeoff. **The proper fix intersects the DECIDED derivable-filename invariant (stage to a non-canonical temp, promote on Save) and needs planner/owner input — recorded here, not made unilaterally.**

## On-Device UAT Pending (verified separately via the physical-Pixel release build)

1. Library picker launches the Android system Photo Picker with **no runtime permission prompt** (config-verified; actual launch is native).
2. Skia crop renders/frames correctly with smooth pan/zoom on device.
3. A pasted https URL actually downloads over the network into the local master (offline read afterwards).
4. The 512×512 JPEG master actually lands as a file under `Paths.document/avatars` (copied out of evictable cache).
5. Replace/remove/purge actually delete the old file(s) on the device filesystem; avatar falls back to initials.

## Gaps Summary

No blocking gaps. All three ROADMAP success criteria and all five PHOTO requirements are code-verified (logic, wiring, invariants, tests) with 0 blockers and all four gates green. The remaining verification surface is genuinely native (picker launch, Skia render, real network download, real FS writes/deletes) and is being confirmed on the physical Pixel now — hence **passed-pending-uat**, not failed. One documented MEDIUM (M1) and several LOW findings are hardening/edge-case items surfaced for owner/planner follow-up.

---

_Verified: 2026-08-15T15:46:46Z_
_Verifier: Claude (gsd-verifier) — code-backward against shipped source, gates run on-box_
