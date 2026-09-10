---
phase: 31-profile-experience
plan: 14
subsystem: profile presentation UI and local SQLite assignment
tags: [react-native, profile-layout, drag-reorder, local-picker, sqlite]
requires:
  - phase: 31-13
    provides: focused Profile layout editor and physical-Pixel gesture workflow
provides:
  - release-driven, parent-validated Profile layout reordering
  - shared layout-template library entry from every Profile chooser
  - selected-contact local template assignment preserving independent axes
affects: [31-15, profile presentation, ContactPicker]
actuals:
  tokens: 6507
  tasks: 3
  commits: 5
tech-stack:
  added: []
  patterns:
    - NestedReorderableList release callbacks dispatch the existing closed reducer.
    - Profile-only picker callers can exclude archived contacts while preserving canonical picker behavior elsewhere.
key-files:
  created:
    - src/components/profile/profile-layout-editor.contract.test.ts
    - src/components/profile/profile-template-manager.contract.test.ts
  modified:
    - src/components/profile/ProfileLayoutEditor.tsx
    - src/components/profile/ProfileTemplateManager.tsx
    - src/components/ContactPicker.tsx
    - src/db/profile-presentation-dao.test.ts
key-decisions:
  - "Drag release dispatches the existing parent-aware reorder reducer; Move controls remain the accessible fallback."
  - "The reusable template manager is shared at the chooser boundary, while inherited layout remains explicitly host-contact-only."
  - "Selected-contact assignment uses the existing layout-axis DAO and a picker mode that never surfaces archived contacts."
patterns-established:
  - "Contact presentation writes preserve sibling background and contact data through the DAO's axis-specific upsert."
requirements-completed: [PROF-02, PROF-03, PROF-06, PROF-20]
coverage:
  - id: D1
    description: Direct Profile layout drag/release reordering with accessible Move fallbacks.
    requirement: PROF-20
    verification:
      - kind: unit
        ref: src/profile/layout-editor-reducer.test.ts#drag and named moves are byte-equal
        status: pass
      - kind: manual_procedural
        ref: owner-approved physical Pixel press-drag-release, 2026-09-10
        status: pass
    human_judgment: false
  - id: D2
    description: Shared template library access and selected-contact template-only assignment.
    requirement: PROF-03
    verification:
      - kind: integration
        ref: src/db/profile-presentation-dao.test.ts#assigns a selected second contact only a layout-template override
        status: pass
      - kind: unit
        ref: src/components/profile/profile-template-manager.contract.test.ts
        status: pass
    human_judgment: false
duration: 24min
completed: 2026-09-10
status: complete
---

# Phase 31 Plan 14: Profile Experience Summary

**Profile sections now reorder on real release drag, while every Profile can open one local template library and apply a template-only override to an explicitly selected active contact.**

## Performance

- **Duration:** 24 min
- **Started:** 2026-09-10T10:01:50Z
- **Completed:** 2026-09-10T10:25:50Z
- **Tasks:** 3/3
- **Files modified:** 9

## Accomplishments

- Replaced the threshold-based responder shim with the installed nested reorder control; drop positions enter only the parent-aware layout reducer.
- Added the shared template-library entry to every Profile Layout chooser and a truthful selected-contact assignment route.
- Proved contact-template writes preserve category, contact fields, and background while clearing only collapse overrides; recorded owner-approved Pixel drag evidence.

## Task Commits

1. **Task 1: Make one top-level layout section move by direct drag and release** — `92f48bb` (RED), `9301173` (GREEN)
2. **Task 2: Expose the shared template library and assign a template to a chosen contact** — `261762f` (RED), `08ed497` (GREEN)
3. **Task 3: Confirm the direct-drag interaction on the physical Pixel and record owned UAT results** — `2bc8f6f` (docs)

## Files Created/Modified

- `src/components/profile/ProfileLayoutEditor.tsx` — release-driven nested reorder buckets and universal template-library entry.
- `src/components/profile/ProfileTemplateManager.tsx` — selected active-contact assignment via the canonical picker.
- `src/components/ContactPicker.tsx` — opt-in archived-search restriction for template assignment.
- `src/db/profile-presentation-dao.test.ts` — durable selected-contact layout-axis preservation coverage.
- `src/components/profile/*.contract.test.ts` — source-level contracts for drag and shared-template reachability.
- `.planning/phases/31-profile-experience/31-UAT.md` and `31-NATIVE-CHECKLIST.md` — bounded UAT 7–8 and rows 36/39 results.

## Decisions Made

- Release callbacks dispatch `{ type: "reorder", parent, id, toIndex }`; no drag path mutates layout arrays directly.
- The manager's inherited action remains scoped and labelled for its host Profile; the new selector explicitly targets another local contact.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected the drag-handle function signature during GREEN integration**
- **Found during:** Task 1
- **Fix:** Repaired the TypeScript signature before rerunning the focused gate.
- **Verification:** reducer/session/component tests, TypeScript, and color gate passed.
- **Committed in:** `9301173`

**2. [Rule 2 - Missing critical functionality] Prevented archived contacts from appearing in template assignment search**
- **Found during:** Task 2
- **Issue:** The canonical picker normally includes archived rows after a search, which violates the plan's active-contact assignment boundary.
- **Fix:** Added an opt-in `allowArchivedSearch` picker mode and used `false` only for template assignment; all existing callers retain their prior behavior.
- **Verification:** template-manager contract and focused 46-test gate passed.
- **Committed in:** `08ed497`

**Total deviations:** 2 auto-fixed (1 Rule 1, 1 Rule 2). No migration, network, telemetry, or presentation-schema scope expanded.

## Known Stubs

None.

## Self-Check: PASSED

- Confirmed task commits `92f48bb`, `9301173`, `261762f`, `08ed497`, and `2bc8f6f` exist.
- Confirmed both contract tests and all modified implementation files exist.

## Next Phase Readiness

Plan 31-15 remains the sole UAT gap owner for template Preview appearance and background clear/inherit behavior.

---
*Phase: 31-profile-experience*
*Completed: 2026-09-10*
