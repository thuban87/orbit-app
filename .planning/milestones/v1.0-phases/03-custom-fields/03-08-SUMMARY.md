---
phase: 03-custom-fields
plan: 08
subsystem: ui
tags: [custom-fields, react-native, expo, sqlite, theme-tokens, forms]

# Dependency graph
requires:
  - phase: 03-01
    provides: makeColName / isSafeColName — the single safe col_name producer
  - phase: 03-03
    provides: field-defs-dao (rename/reorder/changeFieldOptions/updateFieldCuration/quarantine/restore/listDefs/isFieldEmpty)
  - phase: 03-05
    provides: field-type-change (preflightTypeChange/preflightOptionsChange/applyTypeChange)
  - phase: 03-06
    provides: FieldValueInput + the 7 value widgets (live preview dispatcher)
  - phase: 03-07
    provides: getExecutor() over the migrated connection; the launch sweep registry
provides:
  - FieldDefForm — create/edit ONE field definition, composing the full NewFieldDef on create
  - CustomFieldsScreen — Settings-style list, reorder, dynamic delete/quarantine, restore, and pre-flight-gated type/options change
  - A dependency-free HomeScreen route to reach the Custom Fields surface
affects: [phase-04-contacts, phase-05-photos, phase-14-ai]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Dependency-free screen routing via a local useState route selector (no navigation library)"
    - "Form emits an edited-draft delta; the screen diffs it against the original def and routes each change to the matching DAO op"
    - "Promise-wrapped Alert so a pre-flight summary reads as a single confirmation gate"

key-files:
  created:
    - src/components/FieldDefForm.tsx
    - src/screens/CustomFieldsScreen.tsx
  modified:
    - src/screens/HomeScreen.tsx

key-decisions:
  - "FieldDefForm owns `now` (localDateTime at submit) and mints the full NewFieldDef on create; the screen supplies existingColNames + nextDisplayOrder"
  - "Edit emits a FieldDefDraft delta; CustomFieldsScreen diffs it and calls rename/updateFieldCuration/changeFieldOptions/applyTypeChange as needed"
  - "The pre-flight summary Alert IS the single confirmation (Cancel/Apply) — no separate second prompt, per §14.4"
  - "Reorder implemented as move up/down over the full (active + quarantined) id set so display_order stays a clean contiguous total order"
  - "Dropdown options edited as an add/remove entry list (nicer for the --to 3 gate than a comma string); stored as a JSON array TEXT"

patterns-established:
  - "Screen-state routing: HomeScreen renders CustomFieldsScreen when route==='custom-fields'; the child returns home via onBack"
  - "Colour-name string literals avoided in option placeholders/examples so check:colors stays clean repo-wide"

requirements-completed: [FLD-02, FLD-03, FLD-04, FLD-05, FLD-07]

coverage:
  - id: D1
    description: "A user can create a custom field — the full NewFieldDef (col_name via makeColName over listDefs({includeQuarantined:true}), uid, append display_order, now, share_with_ai 0) is composed and passed to createField"
    requirement: "FLD-02"
    verification:
      - kind: manual_procedural
        ref: "owner --to 3 gate on the Pixel: New field → create → uiautomator dump shows the row"
        status: unknown
    human_judgment: true
    rationale: "No RN-component test harness exists; behaviour is reviewed at the --to 3 gate on-device"
  - id: D2
    description: "Rename, reorder, and the dynamic delete/quarantine (empty→Delete, populated→Quarantine) with a Restore action for quarantined fields"
    requirement: "FLD-03"
    verification:
      - kind: manual_procedural
        ref: "owner --to 3 gate: rename/reorder, quarantine a populated field and confirm data retained, restore it"
        status: unknown
    human_judgment: true
    rationale: "Data-retention across quarantine/restore is UI-observable only at the gate; underlying DDL is covered by Plan 02/03/05 node tests"
  - id: D3
    description: "A type change shows the preflightTypeChange summary as the single confirmation then applyTypeChange (current type passed); an options edit shows preflightOptionsChange before changeFieldOptions"
    requirement: "FLD-04"
    verification:
      - kind: manual_procedural
        ref: "owner --to 3 gate: retype a populated field, observe the N-convert/K-need-input summary"
        status: unknown
    human_judgment: true
    rationale: "Summary presentation is a visual/UX judgment; the pre-flight/apply logic itself is node-tested in Plan 05"
  - id: D4
    description: "show_on_new / always_show curation flags set from the form persist via updateFieldCuration"
    requirement: "FLD-07"
    verification:
      - kind: manual_procedural
        ref: "owner --to 3 gate: toggle the flags, reopen the field, confirm they stuck"
        status: unknown
    human_judgment: true
    rationale: "Persistence is UI-observable at the gate; updateFieldCuration is node-tested in Plan 03"
  - id: D5
    description: "The Custom Fields screen is reachable in-app from HomeScreen with no navigation library and no hardcoded colour"
    requirement: "FLD-05"
    verification:
      - kind: automated_ui
        ref: "npm run check:colors -- src/components/FieldDefForm.tsx src/screens/CustomFieldsScreen.tsx src/screens/HomeScreen.tsx"
        status: pass
    human_judgment: false

# Metrics
duration: 5min
completed: 2026-08-15
status: complete
---

# Phase 3 Plan 08: Custom Fields Definition Editor Summary

**A Settings → Custom Fields screen (reachable via a dependency-free HomeScreen route) that creates/renames/reorders/retypes and dynamically deletes-or-quarantines field definitions, driving type/options changes through the §14.4 pre-flight summary — the last plan of Phase 3.**

## Performance

- **Duration:** 5 min
- **Started:** 2026-08-15T02:29:22Z
- **Completed:** 2026-08-15T02:34:16Z
- **Tasks:** 3
- **Files modified:** 3 (2 created, 1 modified)

## Accomplishments
- `FieldDefForm` composes the FULL `NewFieldDef` on create (col_name via `makeColName` over the caller's existing-col_name set, uid via `newUid`, append `display_order`, `now` for both created_at/modified_at, `share_with_ai` 0) and emits an edit delta otherwise; a live `FieldValueInput` preview renders the selected type. No `share_with_ai` toggle (deferred to Phase 14).
- `CustomFieldsScreen` lists defs, reorders them, runs the dynamic delete/quarantine action (`isFieldEmpty` → Delete vs Quarantine, both through `deleteOrQuarantineField`), restores quarantined fields, and gates type/options changes behind the pre-flight summary.
- The create path builds its existing-col_name set from `listDefs({ includeQuarantined: true })` so re-creating a quarantined field's label cannot collide with its still-present column.
- HomeScreen now reaches the screen through a local `route` `useState` — zero new dependencies.

## Task Commits

Each task was committed atomically:

1. **Task 1: FieldDefForm — create/edit a field definition with a live widget preview** - `fabca67` (feat)
2. **Task 2: CustomFieldsScreen — list, reorder, dynamic delete/quarantine, type-change summary** - `79c82ea` (feat)
3. **Task 3: Reach the screen from HomeScreen (dependency-free route)** - `a8c6c64` (feat)

## Files Created/Modified
- `src/components/FieldDefForm.tsx` - Themed create/edit form for one field definition (label, 7-type picker, dropdown options entry list, curation switches, live preview); composes NewFieldDef on create, emits FieldDefDraft on edit.
- `src/screens/CustomFieldsScreen.tsx` - The management surface: list/reorder, create via FieldDefForm, edit-diff routing to the DAO ops, pre-flight-gated type/options change, dynamic delete/quarantine + restore.
- `src/screens/HomeScreen.tsx` - Added a dependency-free `route` toggle and a themed "Custom Fields" entry Pressable.

## Decisions Made
- **The pre-flight summary Alert is the single confirmation.** A `Cancel`/`Apply` Alert carrying the "N convert / K need your input" text satisfies §14.4's "show the summary then commit on confirm-of-summary, no separate second prompt" — the summary itself is the gate, not a precursor to another dialog.
- **Edit is a diff, not per-field callbacks.** The form emits one `FieldDefDraft`; the screen compares it to the original def and calls only the ops whose inputs changed (rename / updateFieldCuration / changeFieldOptions / applyTypeChange). This keeps all DAO wiring in the screen (Task 2) as the plan specified while the form stays a pure state capture.
- **`now` is owned by the producer of each write.** The form stamps `now` for the create payload (Task 1's explicit instruction); the screen stamps `now` for each edit-time DAO op.
- **Reorder covers the full id set.** Move up/down reorders the active list but passes `[...active, ...quarantined]` ids to `reorderFields`, keeping `display_order` a clean contiguous total order rather than leaving gaps.
- **Dropdown options use an add/remove entry list**, stored as a JSON-array TEXT — a friendlier surface for the owner's visual review than a comma string, and it round-trips cleanly through `FieldValueInput`.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Biome flagged formatting on the initial `CustomFieldsScreen.tsx` write (multi-attribute JSX element wrapping); resolved with `biome check --write`. No logic change.

## Known Deferrals (intentional, not stubs)
- **`share_with_ai` toggle** — deliberately not surfaced (Phase 14). Defaulted to `0` on create. Documented in-code; the plan's scope fence excludes it.
- **Photo field input** — the `photo` type renders the deferred Plan-06 placeholder (native picker lands with the Phase 5 photo pipeline). The field type itself is fully selectable/creatable.

These do not block the plan's goal (create/rename/reorder/retype/delete-quarantine a custom field), which is fully achieved.

## Next Phase Readiness
- Phase 3 (Custom Fields) is functionally complete pending the owner's --to 3 on-device gate. All data-layer capabilities (FLD-02/03/04/05/07) now have a user-facing surface.
- Phase 4 will introduce the real navigation shell and relocate the HomeScreen "Custom Fields" entry into a Settings surface; the screen-state route here is the explicit, documented interim.
- Verification status: `tsc` clean, `biome` clean, `check:colors` clean on all three files, full `npm test` suite green (231 tests). On-device UX review is the remaining gate.

## Self-Check: PASSED

- All 3 source files + SUMMARY.md present on disk.
- All 3 task commits present in git (fabca67, 79c82ea, a8c6c64).

---
*Phase: 03-custom-fields*
*Completed: 2026-08-15*
