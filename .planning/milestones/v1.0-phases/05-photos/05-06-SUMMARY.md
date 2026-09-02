---
phase: 05-photos
plan: 06
subsystem: ui
tags: [photos, url-download, fetch, ssrf, https-allowlist, settings, profile, expo-file-system]

# Dependency graph
requires:
  - phase: 05-photos (Plan 05)
    provides: target-kind-aware PhotoSourcePicker (Add/Change/Remove) with the "Paste image URL" affordance stub + the profile Remove branch
  - phase: 05-photos (Plan 04)
    provides: persistCroppedMaster crop→manipulate→persist pipeline
  - phase: 05-photos (Plan 02)
    provides: profile-dao (getProfile / setProfilePhoto / clearProfilePhoto)
  - phase: 05-photos (Plan 03)
    provides: Avatar cacheBust folding + bumpPhotoCacheBust
provides:
  - "url-image.ts: https-only isImageUrl allowlist + extFromContentType map + fetch-based downloadImageToCache (redirect re-validate, image/* content-type, streamed byte cap)"
  - "PhotoSourcePicker URL entry: themed input + 'Add from URL' submit → download-once → crop pipeline"
  - "Settings 'Your photo' entry driving the profile-target picker (set + Plan-05 Remove) with a deterministic self initials avatar"
affects: [05-08 (custom-field photo widget reuses the same picker/pipeline), photos verification/UAT]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "https-ONLY positive allowlist applied to BOTH submitted URL and redirect-resolved response.url (stricter sibling of 04-07 link-open allowlist)"
    - "Streamed byte-cap enforcement (reader.cancel at cap) with content-length up-front + post-read fallback when response.body.getReader is absent"
    - "fetch (not File.downloadFileAsync) so headers + final redirect URL are inspectable for a content-type/redirect policy"

key-files:
  created:
    - src/services/photos/url-image.ts
    - src/services/photos/url-image.test.ts
  modified:
    - src/components/PhotoSourcePicker.tsx
    - src/screens/SettingsScreen.tsx

key-decisions:
  - "isImageUrl is a scheme-only (https:) allowlist — extension is NOT required, because extensionless CDN image URLs are legitimate and the image/* content-type check at download time is the authoritative image gate (matches the plan's 'OR let content-type decide')."
  - "DEFAULT_EXTENSION = 'jpg' (the pipeline re-encodes to a JPEG master regardless, so the cache-file extension is a decode hint only; an undecodable body still surfaces the SPEC 'That image couldn't be used.' copy downstream)."
  - "URL entry is a reveal toggle: 'Paste image URL' affordance → themed input + 'Add from URL' submit, matching the two UI-SPEC states (No-photo affordance / URL entry)."

requirements-completed: [PHOTO-02, PHOTO-01]

coverage:
  - id: D1
    description: "isImageUrl https-only positive allowlist rejects http/file/intent/javascript/ftp/data and non-URL input"
    requirement: "PHOTO-02"
    verification:
      - kind: unit
        ref: "src/services/photos/url-image.test.ts#isImageUrl — https-only positive allowlist (T-05-02)"
        status: pass
    human_judgment: false
  - id: D2
    description: "extFromContentType maps common image content-types with a default fallback (params stripped, case-insensitive)"
    requirement: "PHOTO-02"
    verification:
      - kind: unit
        ref: "src/services/photos/url-image.test.ts#extFromContentType — content-type → extension map"
        status: pass
    human_judgment: false
  - id: D3
    description: "downloadImageToCache: fetch, re-validate redirect-resolved response.url as https, require image/* + response.ok, streamed byte-cap (with content-length fallback), write to cache subdir"
    requirement: "PHOTO-02"
    verification: []
    human_judgment: true
    rationale: "Native fetch/redirect/stream + FS write is device-only (the RN fetch runtime, response.body.getReader availability, and expo-file-system File write cannot be exercised in node); pure allowlist/mapping is unit-tested (D1/D2), the download path is on-device UAT."
  - id: D4
    description: "'Add from URL' wired into PhotoSourcePicker: https validate → download once → crop pipeline; three error states use the SPEC copy"
    requirement: "PHOTO-02"
    verification:
      - kind: automated
        ref: "npx tsc --noEmit && npm run check:colors src/components/PhotoSourcePicker.tsx"
        status: pass
    human_judgment: true
    rationale: "End-to-end paste→download→crop→save and the invalid/network/decode error toasts are UI-observable on-device only; static checks (types, tokenised colours) pass here."
  - id: D5
    description: "Settings 'Your photo' entry seeded from getProfile (name+photo+modified_at) with a stable 'You' fallback, reload-on-focus, set via profile pipeline + Plan-05 profile Remove"
    requirement: "PHOTO-01"
    verification:
      - kind: automated
        ref: "npx tsc --noEmit && npm run check:colors src/screens/SettingsScreen.tsx"
        status: pass
    human_judgment: true
    rationale: "The self-photo set/remove round-trip and the deterministic initials avatar render are UI-observable on-device only; static checks pass here."

# Metrics
duration: 4min
completed: 2026-08-15
status: complete
---

# Phase 5 Plan 6: URL Photo Path + Self Photo Summary

**Pasting an https image URL now downloads once (fetch, redirect-re-validated, image/* + streamed byte cap) into the same local 512px master pipeline, and the user can set/remove their own photo from Settings through the identical target-kind-aware picker.**

## Performance

- **Duration:** 4 min
- **Started:** 2026-08-15T14:49:36Z
- **Completed:** 2026-08-15T14:53:14Z
- **Tasks:** 2 completed
- **Files modified:** 4 (2 created, 2 modified)

## Accomplishments
- `url-image.ts` — the pasted-URL one-time WRITE path: an https-ONLY `isImageUrl` allowlist (applied to both the submitted URL and the redirect-resolved `response.url`), the re-ported `extFromContentType` content-type→extension map, and `downloadImageToCache` using `fetch` (not `File.downloadFileAsync`, which cannot expose headers/final URL) with `image/*` content-type enforcement and a streamed byte cap that never trusts `content-length` alone.
- Wired "Add from URL" into `PhotoSourcePicker` — a themed input (`surface`/`border`, `https://…` placeholder) + a 44px "Add from URL" submit that validates, downloads once, and hands the raw cache uri to the SAME crop→pipeline flow, threading the `requestId` only for a customField target. The three failure classes map to the SPEC copy by error `kind`.
- Added the Settings "Your photo" entry driving the `profile`-target picker, seeded from `getProfile` with a stable `'You'` name fallback (so the self initials avatar is deterministic, never a blank swatch) and `cacheBust={modified_at}`, reloading on focus so a crop-screen set/remove refreshes. Remove reuses Plan 05's profile branch — no Settings-side Remove logic, no contactId.

## Task Commits

1. **Task 1 (RED): failing test for https-only allowlist + content-type map** - `62d4f26` (test)
2. **Task 1 (GREEN): url-image https-only download-once** - `b90f8eb` (feat)
3. **Task 2: wire Add-from-URL into PhotoSourcePicker + Settings self photo** - `4d61b7d` (feat)

**Plan metadata:** (this commit) (docs: complete plan)

## Files Created/Modified
- `src/services/photos/url-image.ts` - https-only `isImageUrl`, `extFromContentType`, and `downloadImageToCache` (fetch + redirect re-validate + streamed byte cap + cache-subdir write).
- `src/services/photos/url-image.test.ts` - node unit tests for the pure allowlist + mapping (accept/reject schemes, content-type→ext, default fallback).
- `src/components/PhotoSourcePicker.tsx` - completed the "Paste image URL" affordance into a real reveal → input + "Add from URL" submit → download-once → crop navigate; error toasts by `UrlImageError.kind`.
- `src/screens/SettingsScreen.tsx` - added the "Your photo" section (was a static screen): focus-reloaded `getProfile` seed + the profile-target `PhotoSourcePicker`.

## Decisions Made
- `isImageUrl` is scheme-only (https:), not extension-gated — extensionless CDN image URLs are valid and the `image/*` content-type check is the authoritative image gate (the plan explicitly permits deferring to content-type).
- `DEFAULT_EXTENSION = 'jpg'` — the cache file's extension is a decode hint only (the pipeline re-encodes to a JPEG master); an undecodable body surfaces the SPEC decode-error copy downstream.
- URL entry implemented as a reveal toggle to match the two distinct UI-SPEC states (affordance → entry) without adding a render-loop concern.

## Deviations from Plan

None - plan executed exactly as written.

---

**Total deviations:** 0 auto-fixed.
**Impact on plan:** None. Both tasks implemented as specified; all automated verification passed.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Verification Results
- `npm test -- src/services/photos/url-image.test.ts` — 7 passed.
- `npm test` (full suite) — 406 passed (35 files).
- `npx tsc --noEmit` — exit 0.
- `npm run check:colors src/services/photos/url-image.ts src/components/PhotoSourcePicker.tsx src/screens/SettingsScreen.tsx` — exit 0 (no hardcoded colours).
- On-device UAT (deferred, per plan): paste https URL → download → crop → save master; http/invalid URL → invalid-URL copy; self photo set/remove from Settings. Native fetch/FS + Skia/picker are device-only; not run here.

## Threat Surface
Both `<threat_model>` mitigations are implemented in `url-image.ts`:
- **T-05-02 (SSRF / cleartext):** `isImageUrl` https-only allowlist on both submitted URL and redirect-resolved `response.url`; `image/*` content-type required; fetch is user-initiated, one-time, write-path only (no read-path network).
- **T-05-03 (DoS / decode bomb):** download to evictable cache (not document dir); streamed byte cap aborts at the limit (content-length fallback with post-read re-verify); the 512px re-encode bounds output; decode failure → SPEC copy, no crash.

No new security surface beyond the plan's threat register.

## Self-Check: PASSED
- `src/services/photos/url-image.ts` — FOUND
- `src/services/photos/url-image.test.ts` — FOUND
- `src/components/PhotoSourcePicker.tsx` — FOUND (modified)
- `src/screens/SettingsScreen.tsx` — FOUND (modified)
- Commits `62d4f26`, `b90f8eb`, `4d61b7d` — present in git log.
