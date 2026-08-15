---
phase: 05-photos
plan: 05
subsystem: ui
tags: [react-native-skia, react-native-reanimated, react-native-gesture-handler, expo-image-picker, photos, crop, avatar, navigation]

# Dependency graph
requires:
  - phase: 05-01
    provides: native module install (skia/reanimated/gesture-handler/image-picker) + config plugin + babel worklets plugin + GestureHandlerRootView root
  - phase: 05-02
    provides: photo-storage crash-safe .bak-swap persistMaster + derivable relPath helpers (contactPhotoRelPath/profilePhotoRelPath/customFieldPhotoRelPath/deletePhoto) + PhotoTargetDescriptor
  - phase: 05-03
    provides: Avatar component + photo-cache-bust-store (bumpPhotoCacheBust/usePhotoCacheBust)
  - phase: 05-04
    provides: crop-geometry cropRectFromTransform (pure) + photo-pipeline persistCroppedMaster + PhotoPipelineError
provides:
  - CropPhotoScreen — the repo's first Skia render-loop surface (pan/pinch 1:1 crop driven by Reanimated shared values)
  - CropPhoto serializable route { rawUri, target, requestId? } + navigator registration
  - PhotoSourcePicker — target-kind-aware Add/Change/Remove for contact/profile/customField (library launch, no permission)
  - contact photo section wired into EditContactScreen with a photo-only focus re-read that preserves unsaved form edits
affects: [05-06 (URL submit uses PhotoSourcePicker), 05-08 (custom-field widget uses PhotoSourcePicker + consumes requestId via photo-result-store), 13-orrery (Skia render-loop precedent)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Skia Canvas transform driven ONLY by Reanimated shared values via useDerivedValue (never per-frame setState) — first render-loop surface in the repo"
    - "One-time geometry init from the decoded Skia image dims + measured viewport, seeding shared values (React state/effects for one-time init only)"
    - "Serializable-only navigation params for a modal editor (target descriptor + string requestId, no callback params)"
    - "Photo held as SEPARATE screen state (not the form model), written through its own DAO, refreshed via a photo-only useFocusEffect that never reseeds the form"

key-files:
  created:
    - src/screens/CropPhotoScreen.tsx
    - src/components/PhotoSourcePicker.tsx
  modified:
    - src/navigation/types.ts
    - src/navigation/RootNavigator.tsx
    - src/screens/EditContactScreen.tsx

key-decisions:
  - "Compute the square viewport from screen width minus padding (deterministic, available before decode) rather than onLayout, so geometry init only awaits the decoded image"
  - "The A4 decode-failure downscale feeds ONE uri to BOTH preview geometry and pipeline crop, so the crop-rect coordinate space always matches the cropped image"
  - "Photo lives in dedicated screen state (not EditFormState) so buildEditInput/updateContactFull stay clean and the focus re-read updates only the photo — edit-contact-logic.ts intentionally untouched"
  - "Remove clears the DB row first, then best-effort deletes the file (DB is source of truth; deletePhoto is idempotent)"

patterns-established:
  - "Skia + Reanimated crop: outer static translate to the square, inner group applies scale-about-centre + pan from shared values; clamp scale>=1 (cover) and pan to image edges in UI-thread worklets"
  - "PhotoSourcePicker is the single target-kind-aware photo affordance reused by later plans without re-touching its file"

requirements-completed: [PHOTO-01, PHOTO-05]

coverage:
  - id: D1
    description: "CropPhoto route exists with serializable { rawUri, target, requestId? } params and is registered in the navigator"
    requirement: "PHOTO-01"
    verification:
      - kind: other
        ref: "npx tsc --noEmit (RootStackParamList type-checks; grep CropPhoto in types.ts + RootNavigator.tsx)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Crop transform driven by Reanimated shared values via useDerivedValue; no setState per frame; no makeImageSnapshot; all Skia draws tokenised"
    requirement: "PHOTO-01"
    verification:
      - kind: other
        ref: "npm run check:colors src/screens/CropPhotoScreen.tsx; grep useSharedValue/useDerivedValue present, makeImageSnapshot absent"
        status: pass
    human_judgment: false
  - id: D3
    description: "One-time geometry init derives srcW/srcH from the decoded image + baseScale=viewport/min(srcW,srcH); Use photo calls cropRectFromTransform with those inputs + live shared values, runs persistCroppedMaster, writes the target DAO, and bumps the cache-bust"
    requirement: "PHOTO-01"
    verification:
      - kind: manual_procedural
        ref: "on-device UAT (Pixel): pick -> crop -> Use photo; framed square matches saved 512px master (A1)"
        status: unknown
    human_judgment: true
    rationale: "Crop framing fidelity (A1) and Skia render-loop smoothness (T-05-08) are only assessable on the physical Pixel; geometry math is unit-tested in 05-04 but the on-screen convention needs one visual check"
  - id: D4
    description: "PhotoSourcePicker launches the system library with no permission request (canceled silent); a pick navigates to CropPhoto threading requestId only for a customField target"
    requirement: "PHOTO-01"
    verification:
      - kind: manual_procedural
        ref: "on-device UAT (Pixel): tap Add photo -> system Photo Picker opens with no runtime permission prompt"
        status: unknown
    human_judgment: true
    rationale: "No-permission library launch (T-05-01) is a native/OS behavior that requires the built APK on the Pixel; not assessable in node/vitest or the emulator"
  - id: D5
    description: "Remove confirms and switches on target.kind (contact/profile/customField), clearing the right store + deleting the correct derivable file inline, never dereferencing a missing contactId"
    requirement: "PHOTO-05"
    verification:
      - kind: other
        ref: "npx tsc --noEmit (exhaustive switch on PhotoTargetDescriptor); grep clearContactPhoto/clearProfilePhoto/deletePhoto/onValueChange in PhotoSourcePicker.tsx"
        status: pass
      - kind: manual_procedural
        ref: "on-device UAT (Pixel): Remove reverts to themed initials avatar and the file is gone"
        status: unknown
    human_judgment: true
    rationale: "Inline file deletion + avatar reversion is UI/FS-observable only on-device; the type-level exhaustiveness is proven by tsc but the runtime file lifecycle needs the Pixel"
  - id: D6
    description: "EditContactScreen holds photo as SEPARATE state (edit-contact-logic.ts untouched), seeds from getContactForEdit, and refreshes ONLY the photo via a useFocusEffect getContactHeader re-read (+ picker onChanged) without reseeding the form"
    requirement: "PHOTO-01"
    verification:
      - kind: other
        ref: "npx tsc --noEmit; git status shows edit-contact-logic.ts unmodified; grep refreshPhoto/useFocusEffect/getContactHeader in EditContactScreen.tsx"
        status: pass
      - kind: manual_procedural
        ref: "on-device UAT (Pixel): edit name (unsaved) -> Change photo -> crop -> return; name edit survives + avatar updated"
        status: unknown
    human_judgment: true
    rationale: "The unsaved-edits-survive-focus-refresh guarantee is a runtime navigation/state interaction only observable by driving the app"

# Metrics
duration: 15 min
completed: 2026-08-15
status: complete
---

# Phase 5 Plan 05: Library pick + Skia crop + target-aware photo picker Summary

**In-app Skia/Reanimated 1:1 crop screen (shared-value transform, one-time geometry init) plus a target-kind-aware PhotoSourcePicker (contact/profile/customField Add/Change/Remove, no-permission system library), wired into EditContactScreen with a form-preserving photo-only focus refresh.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-08-15T14:28:00Z
- **Completed:** 2026-08-15T14:43:00Z
- **Tasks:** 2
- **Files modified:** 5 (2 created, 3 modified)

## Accomplishments
- `CropPhotoScreen` — the repo's first Skia render-loop surface: pan + pinch over a fixed 1:1 viewport, transform driven only by Reanimated shared values read into Skia via `useDerivedValue` (no per-frame `setState`, no `makeImageSnapshot`), all draws tokenised. One-time geometry init from the decoded image dims + measured viewport; "Use photo" → `cropRectFromTransform` → `persistCroppedMaster` → per-kind DAO write + `bumpPhotoCacheBust`.
- `CropPhoto` serializable route `{ rawUri, target, requestId? }` added to `RootStackParamList` and registered in the navigator.
- `PhotoSourcePicker` — genuinely target-kind-aware Add/Change/Remove for contact, profile, and customField; launches the Android 13+ system Photo Picker with no runtime permission; a pick threads a `requestId` (derivable cv- relPath) only for a customField target.
- Contact photo section wired into `EditContactScreen` with photo held as SEPARATE state (form model untouched) and a `useFocusEffect` photo-only re-read that updates the avatar after a crop without discarding unsaved form edits.

## Task Commits

Each task was committed atomically:

1. **Task 1: CropPhotoScreen.tsx (Skia + Reanimated) + CropPhoto route** - `f6d6ef3` (feat)
2. **Task 2: PhotoSourcePicker.tsx + wire the photo section into EditContactScreen** - `b0b853f` (feat)

**Plan metadata:** committed with this SUMMARY (docs).

## Files Created/Modified
- `src/screens/CropPhotoScreen.tsx` (created) - Skia Canvas 1:1 crop; Reanimated shared-value pan/pinch; one-time geometry init; Use photo → pipeline → per-kind DAO write; A4 decode-failure downscale fallback.
- `src/components/PhotoSourcePicker.tsx` (created) - target-kind-aware Add/Change/Remove; system library launch (no permission); customField requestId navigate; inline derivable-file delete on Remove.
- `src/navigation/types.ts` (modified) - added the serializable `CropPhoto` route to `RootStackParamList`.
- `src/navigation/RootNavigator.tsx` (modified) - registered `<Stack.Screen name="CropPhoto">`.
- `src/screens/EditContactScreen.tsx` (modified) - Photo section, separate photo state seeded from `getContactForEdit`, `refreshPhoto` via `useFocusEffect`/`getContactHeader`.

## Decisions Made
- Square viewport computed from screen width minus padding (deterministic, pre-decode) rather than `onLayout` — geometry init only awaits the decoded image.
- The A4 decode-failure downscale feeds ONE uri to both preview geometry and the pipeline crop, keeping the crop-rect coordinate space matched to the cropped image.
- Photo lives in dedicated screen state (not `EditFormState`); `edit-contact-logic.ts` intentionally untouched (RESEARCH Pitfall 6 — the metadata Save path deliberately omits `photo`).
- Remove clears the DB row first, then best-effort deletes the derivable file (DB source of truth; `deletePhoto` is idempotent).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## Known Stubs
- **"Paste image URL" affordance** in `PhotoSourcePicker` (`src/components/PhotoSourcePicker.tsx`) renders the entry point with a no-op `onPress`. This is intentional and matches the plan ("render the entry point, do not stub a fake save") — Plan 05-06 wires the URL download/submit without re-touching this file. Not a data stub; no UI renders fake/empty saved data.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `PhotoSourcePicker` and `CropPhoto` are ready for Plan 05-06 (URL submit wires into the existing "Paste image URL" affordance) and Plan 05-08 (custom-field widget uses PhotoSourcePicker and consumes the threaded `requestId` via the Plan-08 `photo-result-store`).
- On-device UAT on the Pixel is the remaining gate for this plan: no-permission library launch, crop smoothness + framing fidelity (A1/T-05-08), and Remove file-deletion — none assessable in node/vitest or the desktop emulator (Skia render loop).

## Self-Check: PASSED

- `src/screens/CropPhotoScreen.tsx` exists — FOUND
- `src/components/PhotoSourcePicker.tsx` exists — FOUND
- Commit `f6d6ef3` — FOUND
- Commit `b0b853f` — FOUND
- `npx tsc --noEmit` — green
- `npm run check:colors` on CropPhotoScreen, PhotoSourcePicker, EditContactScreen — green
- `npm test` — 399 passed (34 files); no regressions
- `edit-contact-logic.ts` — unmodified (git status clean)

---
*Phase: 05-photos*
*Completed: 2026-08-15*
