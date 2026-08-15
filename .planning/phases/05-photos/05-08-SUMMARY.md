---
phase: 05-photos
plan: 08
subsystem: ui
tags: [photos, custom-fields, zustand, react-navigation, skia-crop, avatar]

# Dependency graph
requires:
  - phase: 05-photos (05-02)
    provides: customFieldPhotoRelPath (derivable cv- path), persistMaster
  - phase: 05-photos (05-03)
    provides: Avatar + photo-cache-bust-store (bumpPhotoCacheBust)
  - phase: 05-photos (05-05)
    provides: PhotoSourcePicker (target-kind-aware) + CropPhotoScreen + requestId threading
  - phase: 05-photos (05-07)
    provides: purge photo cleanup adapter (cv- files of surviving photo defs)
provides:
  - Real PhotoFieldWidget — a custom `photo`-type field driving the shared picker/crop pipeline (edit-only)
  - photo-field-logic.ts — pure derive (customFieldValueForTarget) + edit-only guard (isPhotoWidgetEnabled)
  - photo-result-store.ts — serializable-requestId crop-success channel + staged-cv-file orphan ledger
  - CropPhotoScreen customField publish (publishCropResult + bumpPhotoCacheBust)
  - Widened widget prop surface (onChange string|null; optional col_name; contactId/colName threading)
affects: [phase-06, phase-16-restore, custom-fields, photos]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Serializable-requestId crop-success channel (Zustand store keyed on derivable cv- relPath, no callback nav params)"
    - "Staged-file ledger + teardown reconcile: delete only staged files no COMMITTED value references"
    - "Additive/widening prop chain (string|null onChange, optional col_name) keeps existing widgets + callers compiling unchanged"

key-files:
  created:
    - src/components/field-widgets/photo-field-logic.ts
    - src/components/field-widgets/photo-field-logic.test.ts
    - src/stores/photo-result-store.ts
  modified:
    - src/components/field-widgets/PhotoFieldWidget.tsx
    - src/components/field-widgets/types.ts
    - src/components/FieldValueInput.tsx
    - src/screens/CropPhotoScreen.tsx
    - src/screens/EditContactScreen.tsx

key-decisions:
  - "Widget renders PhotoSourcePicker alone (it already contains the preview Avatar) rather than a second standalone Avatar — matches the contact-photo field pattern and avoids a duplicate-avatar UI bug"
  - "Field value equals the derivable cv- relPath (customFieldValueForTarget delegates to customFieldPhotoRelPath) — one source of truth across pipeline, value, and purge"
  - "Orphan cleanup compares staged cv- paths against a committedValuesRef (seeded pre-edit, updated on successful Save) at unmount — re-crop-in-place equals its committed value so a saved photo is never deleted"
  - "FieldSpec.col_name is OPTIONAL (not a widened required Pick) so FieldDefForm's previewField literal keeps compiling; FieldDefForm.tsx + CreateContactScreen.tsx unmodified"

patterns-established:
  - "Photo custom field is EDIT-ONLY: create form / def preview shows a disabled placeholder (no contactId to derive a stable filename)"
  - "Crop-success crosses screens via a transient store keyed on a serializable requestId, consumed once on focus"

requirements-completed: [PHOTO-01, PHOTO-05]

coverage:
  - id: D1
    description: "Pure custom-field derive/guard logic — value equals derivable cv- relPath; widget is edit-only"
    requirement: "PHOTO-01"
    verification:
      - kind: unit
        ref: "src/components/field-widgets/photo-field-logic.test.ts#customFieldValueForTarget / isPhotoWidgetEnabled"
        status: pass
    human_judgment: false
  - id: D2
    description: "photo-result-store crop-success channel + staged-file ledger (requestId-match, drain-once)"
    requirement: "PHOTO-05"
    verification:
      - kind: unit
        ref: "src/components/field-widgets/photo-field-logic.test.ts#photo-result-store crop-success channel / staged ledger"
        status: pass
    human_judgment: false
  - id: D3
    description: "Prop-contract type surface (onChange string|null, optional col_name, contactId/colName threading) type-checks; FieldDefForm + CreateContactScreen compile unchanged"
    verification:
      - kind: automated_ui
        ref: "npx tsc --noEmit"
        status: pass
    human_judgment: false
  - id: D4
    description: "No hardcoded colours in the widget/crop/dispatcher/edit surfaces"
    verification:
      - kind: other
        ref: "npm run check:colors src/components/field-widgets/PhotoFieldWidget.tsx src/screens/CropPhotoScreen.tsx src/components/FieldValueInput.tsx src/screens/EditContactScreen.tsx"
        status: pass
    human_judgment: false
  - id: D5
    description: "On-device: set a custom photo field via library and via URL, it renders, Save persists it, purge removes the cv- file"
    verification: []
    human_judgment: true
    rationale: "Native picker + Skia crop + expo-image render + on-disk persistence are UI/device-observable only; the URL path is jointly owned with 05-06 as a phase-end integration. Requires the Pixel UAT loop (build APK on desktop, drive on device)."

# Metrics
duration: 14min
completed: 2026-08-15
status: complete
---

# Phase 5 Plan 08: Custom Photo Field Summary

**A custom `photo`-type field now drives the exact same library/URL/Skia-crop/512px pipeline as the main avatar (edit-only), storing the derivable `cv-<id>-<col>.jpg` relPath through the edit form's upsert, with a serializable-requestId crop-success channel and a staged-file orphan-cleanup ledger.**

## Performance

- **Duration:** ~14 min
- **Started:** 2026-08-15T09:57:00Z
- **Completed:** 2026-08-15T10:11:00Z
- **Tasks:** 2
- **Files modified:** 8 (3 created, 5 modified)

## Accomplishments
- Replaced the deferred `PhotoFieldWidget` placeholder with a real, edit-only widget that reuses the shared, target-kind-aware `PhotoSourcePicker` (`{kind:'customField'}`) — no picker/crop code re-touched.
- Built the pure `photo-field-logic.ts` (value = derivable `cv-` relPath; edit-only guard) with node Vitest coverage, and the transient `photo-result-store.ts` carrying a requestId-matched crop-success signal plus a staged-cv-file ledger.
- Wired `CropPhotoScreen`'s customField branch to `publishCropResult(route.params.requestId, true)` + `bumpPhotoCacheBust` after persist; the widget consumes on focus → stages the file → `onChange(derivable path)`.
- Widened the prop chain (`onChange: string|null`, optional `col_name`, `contactId`/`colName` threading) so `onChange(null)` Remove type-checks while `FieldDefForm.tsx` and `CreateContactScreen.tsx` compile unmodified.
- Added custom-field orphan cleanup: `EditContactScreen` drains the staged ledger on unmount and deletes only staged files no committed value references — a saved photo (incl. re-crop-in-place) is never deleted.

## Task Commits

1. **Task 1: photo-field-logic.ts + photo-result-store.ts** - `1df643d` (feat, TDD)
2. **Task 2: real PhotoFieldWidget + CropPhotoScreen publish + prop threading + orphan cleanup** - `50bc3e6` (feat)

## Files Created/Modified
- `src/components/field-widgets/photo-field-logic.ts` - pure `customFieldValueForTarget` (= derivable cv- relPath) + `isPhotoWidgetEnabled` edit-only guard
- `src/components/field-widgets/photo-field-logic.test.ts` - node tests: derivable path, edit-only guard, requestId-match consume, drain-once ledger
- `src/stores/photo-result-store.ts` - Zustand: crop-success channel (publish/consume) + staged-cv-file ledger (markStaged/takeStaged)
- `src/components/field-widgets/PhotoFieldWidget.tsx` - real edit-only widget over the shared PhotoSourcePicker; focus-consume → stage → onChange(value)
- `src/components/field-widgets/types.ts` - widened `onChange` to `string|null`; added optional `contactId`/`colName`
- `src/components/FieldValueInput.tsx` - widened `onChange`; optional `col_name` on FieldSpec; forwards `contactId`+`colName` to the photo case only
- `src/screens/CropPhotoScreen.tsx` - customField branch publishes crop-success + cache-bust
- `src/screens/EditContactScreen.tsx` - supplies `contactId` to the photo FieldValueInput; committed-value ref + unmount orphan reconcile

## Decisions Made
- **Render PhotoSourcePicker alone, not a second Avatar.** The plan's action text describes rendering `<Avatar>` AND `<PhotoSourcePicker>`, but the picker already renders its own preview Avatar (as the contact-photo field does). A standalone second Avatar would duplicate the preview and diverge from the established contact-photo pattern. The widget renders only the picker; the "Avatar fallback when empty" requirement is satisfied by the picker's internal Avatar, and the `contains: PhotoSourcePicker` artifact check passes. (See Deviations — Rule 1.)
- **Value = derivable path.** `customFieldValueForTarget` delegates to `customFieldPhotoRelPath`, so the field value, the persisted master filename, and purge cleanup all agree on one path.
- **Orphan cleanup keyed on committed values.** A `committedValuesRef` (seeded pre-edit, updated on successful Save) is compared against the drained staged set at unmount; equality (re-crop-in-place) means referenced → kept. "If uncertain, don't delete."

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Widget renders the shared picker without a duplicate standalone Avatar**
- **Found during:** Task 2 (PhotoFieldWidget implementation)
- **Issue:** The plan action described rendering a standalone `<Avatar>` AND `<PhotoSourcePicker>`, but `PhotoSourcePicker` already renders a preview Avatar internally (the pattern the contact-photo edit field uses). Following the letter would render two avatars stacked — a visual bug and an inconsistency with the contact-photo field directly above it in the same form.
- **Fix:** The widget renders only `<PhotoSourcePicker target={{kind:'customField',...}} onValueChange={onChange}>`; the picker's internal Avatar is the value preview and the empty-state fallback.
- **Files modified:** src/components/field-widgets/PhotoFieldWidget.tsx
- **Verification:** `npx tsc --noEmit` green; the `contains: PhotoSourcePicker` artifact + "Avatar fallback when empty" acceptance criteria both satisfied via the picker's Avatar. Cache-busting still works: Avatar subscribes to `usePhotoCacheBust(photo)` internally, so the CropPhotoScreen `bumpPhotoCacheBust` bump is picked up without threading a `cacheBust` prop.
- **Committed in:** 50bc3e6 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug/UI-consistency)
**Impact on plan:** Cosmetic/consistency correction that keeps the custom photo field visually identical to the contact photo field; no scope change and no impact on the value/persistence/cleanup contracts. All other plan instructions implemented as written.

## Issues Encountered
- `photo-field-logic` transitively imports `photo-storage`, whose top-level `expo-file-system` import cannot load in the node Vitest env. Resolved by stubbing the native module empty in the test (`vi.mock("expo-file-system", () => ({}))`) — the pure filename builder needs none of it. Mirrors the isolation `photo-storage.test.ts` already uses.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 5 (Photos) code is complete across all 8 plans. This plan's automated gates are green: 413/413 unit tests, `tsc --noEmit` clean, `check:colors` clean.
- **On-device UAT outstanding (D5, human_judgment):** set a custom photo field via library and via URL, confirm it renders + persists on Save, and confirm purge removes the `cv-` file. The "via URL" path is jointly owned with 05-06 (same wave) and is a phase-end integration check. Run the Pixel loop per `docs/runbooks/desktop-build-pipeline.md` (build APK on the desktop, drive on the physical Pixel) — do NOT default to human_needed for the render/persist flows.
- No blockers.

## Self-Check: PASSED

All created files exist on disk (photo-field-logic.ts, photo-field-logic.test.ts, photo-result-store.ts, PhotoFieldWidget.tsx, 05-08-SUMMARY.md) and both task commits (`1df643d`, `50bc3e6`) are present in git history. Automated gates: `npm test` 413/413 pass, `npx tsc --noEmit` clean, `check:colors` clean on all four modified surfaces.

---
*Phase: 05-photos*
*Completed: 2026-08-15*
