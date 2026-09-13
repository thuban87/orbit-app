---
phase: 34-rapid-capture-update-flows
plan: 03
subsystem: ui
tags: [accordion, add-contact, information-architecture, capt-01, capt-02, capt-03, capt-14, atomic-create, adr-016, adr-062, data-revision, sqlite]

# Dependency graph
requires:
  - phase: 34
    provides: "createContactFull atomic-create DAO + create-contact-logic (canSave/firstInteractionOccurredAt/buildCreateInput) — the shipped create path this plan composes, not rewrites"
  - phase: 34
    provides: "enrichment *Core writers (addMemoryCore/addRelationshipCore/setCurrentStateValueCore/addFuelCore) + applyContactMethodDiffCore composed inside one transaction"
provides:
  - "AccordionSection ui primitive with the validation-focus interface (sectionId, controlled expanded/onExpandedChange, containerRef scroll target) — consumed by 34-08 (Edit Contact IA)"
  - "Add Contact restructured into a three-section accordion (Identity / Relationship Basics / Contact Methods) + Show More revealing advanced enrichment"
  - "CreateContactFullInput extended with optional memories/relationships/currentStateEntries/offLimits arrays; createContactFullCore composes their *Core writers atomically and is the SOLE data_revision bumper (bumpRevision:false on the method core)"
  - "Pure Bound/Unbound coordination (coordinateBoundToggle/coordinateCadenceSelection) + no-cadence/Unbound create defaults"
  - "Pure resolveErrorSection + CREATE_SECTION_FIELD_MAP + collectBlockingErrors error→section reveal-and-focus contract"
affects: [34-08, edit-contact, add-contact, rapid-capture, enrichment-editors]

# Actuals (#2632) — chars/4 over the realized src/ diff
actuals:
  tokens: 11900
  tasks: 4
  commits: 6

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Controlled AccordionSection primitive: parent owns disclosure so a blocked Save can reveal + focus the erroring section (reused by 34-08)"
    - "Draft-collection reuse of profile enrichment editors on the create path: local draft arrays mapped to the editors' committed-row shape with synthetic (index) ids; nothing persists until the single atomic create"
    - "Aggregate-owned single data_revision bump: composed sub-writer (applyContactMethodDiffCore) runs with bumpRevision:false so the aggregate owns exactly one bump"
    - "Pure error→section resolver so reveal-and-focus is node-tested, not device-UAT-only"

key-files:
  created:
    - src/components/ui/AccordionSection.tsx
  modified:
    - src/components/ui/index.ts
    - src/db/contacts-dao.ts
    - src/db/contacts-dao.test.ts
    - src/db/contact-methods-dao.ts
    - src/screens/create-contact-logic.ts
    - src/screens/create-contact-logic.test.ts
    - src/screens/CreateContactScreen.tsx

key-decisions:
  - "Show-More enrichment sections REUSE the profile editors (MemoryEditor/RelationshipEditor/FuelEditor) in a draft-collection mode via synthetic-id adapters, rather than rewriting them — same vocabulary as Edit Contact, and every draft feeds the single atomic create (Review HIGH #4: no rendered control fails to persist)."
  - "Save stays PRESSABLE when the form is incomplete so a blocked press reveals + focuses the erroring accordion (dossier §AD); it is only truly disabled while a save is in flight."
  - "FrequencyPicker still gates behind Bound (matching Edit Contact) with value={intervalDays ?? 0} so binding with no cadence opens an empty custom entry (invalid → Save gated) instead of preselecting Monthly."

patterns-established:
  - "AccordionSection validation-focus interface is the shared reveal target contract for 34-08."
  - "createContactFullCore is the single data_revision bump owner for the composed create."

requirements-completed: [CAPT-01, CAPT-02, CAPT-03, CAPT-14]

coverage:
  - id: D1
    description: "AccordionSection primitive with the validation-focus interface (sectionId, controlled expanded/onExpandedChange, containerRef) and a11y expanded/collapsed state"
    requirement: "CAPT-01"
    verification:
      - kind: other
        ref: "grep -c accessibilityState src/components/ui/AccordionSection.tsx (=2); tsc --noEmit clean; consumed by CreateContactScreen"
        status: pass
    human_judgment: true
    rationale: "On-device expand/collapse a11y announcement and 44x44 touch target verified at the phase UAT gate."
  - id: D2
    description: "Bound/Unbound cadence coordination + tri-state last-spoke ('Not yet' writes no interaction) (CAPT-02/03)"
    requirement: "CAPT-03"
    verification:
      - kind: unit
        ref: "src/screens/create-contact-logic.test.ts#coordinateBoundToggle / coordinateCadenceSelection / firstInteractionOccurredAt"
        status: pass
    human_judgment: false
  - id: D3
    description: "CreateContactScreen initial state flipped to intervalDays=null + trackingEnabled=false (no Monthly + Bound default)"
    requirement: "CAPT-03"
    verification:
      - kind: other
        ref: "grep FREQUENCY_DAYS.Monthly src/screens/CreateContactScreen.tsx (=0); useState<number|null>(null) + useState(false) present"
        status: pass
    human_judgment: false
  - id: D4
    description: "Show-More enrichment persists atomically inside the single createContactFull transaction and round-trips; full rollback on an interrupted create; framework fields injected; data_revision advances by exactly 1 (CAPT-01, ADR-016)"
    requirement: "CAPT-01"
    verification:
      - kind: unit
        ref: "src/db/contacts-dao.test.ts#createContactFull — Show More enrichment (round-trip, rollback, framework-field injection, data_revision exactly once)"
        status: pass
    human_judgment: false
  - id: D5
    description: "buildCreateInput assembles the enrichment arrays from form state (lean name-only path preserved)"
    requirement: "CAPT-01"
    verification:
      - kind: unit
        ref: "src/screens/create-contact-logic.test.ts#buildCreateInput (enrichment assembly + omit-on-empty)"
        status: pass
    human_judgment: false
  - id: D6
    description: "resolveErrorSection maps the first blocking validation error to its AccordionSection id (CAPT-14)"
    requirement: "CAPT-14"
    verification:
      - kind: unit
        ref: "src/screens/create-contact-logic.test.ts#resolveErrorSection / collectBlockingErrors"
        status: pass
    human_judgment: false
  - id: D7
    description: "On-device three-section accordion + Show More; a blocked Save reveals + focuses (expand + scroll) the erroring section; a failed save preserves state and shows no completion; an unchanged form exits with no prompt"
    requirement: "CAPT-14"
    verification: []
    human_judgment: true
    rationale: "Reveal-and-focus scroll, save-failure copy, and the quiet-IA feel are UI-observable only — verified on the Pixel at the phase gate."

# Metrics
duration: 60min
completed: 2026-09-13
status: complete
---

# Phase 34 Plan 03: Rapid Add Contact — Three-Section Accordion + Show More Summary

**Add Contact restructured into an Identity / Relationship Basics / Contact Methods accordion with a Show More that atomically persists advanced enrichment, on a new reusable AccordionSection primitive (shared with 34-08) — composing the shipped createContactFull path, not rewriting it.**

## Performance

- **Duration:** ~60 min
- **Started:** 2026-09-13T01:20Z (approx)
- **Completed:** 2026-09-13T02:21Z
- **Tasks:** 4
- **Files modified:** 8 (1 created, 7 modified)

## Accomplishments
- Built `AccordionSection` — a controlled expand/collapse primitive exposing the validation-focus interface (stable `sectionId`, controlled `expanded`/`onExpandedChange`, `containerRef` scroll target) that 34-08 (Edit Contact IA) will also consume. A11y `accessibilityState={{ expanded }}`, ≥44×44 header, all colours via theme tokens, no React-state-driven animation (plain conditional render).
- Restructured Add Contact into three primary accordion sections (Identity open by default; Relationship Basics; Contact Methods) plus a Show More tertiary action revealing Last Talked About / Key People / Current Location / Memories / Custom Fields / Off Limits — composing the existing enrichment editors in draft-collection mode.
- Extended `CreateContactFullInput` with optional `memories`/`relationships`/`currentStateEntries`/`offLimits` (semantic-only element shapes as `Omit<>` of the writer inputs); `createContactFullCore` injects the full framework set post-insert and composes the `*Core` writers INSIDE the single create transaction (ADR-016). Made `createContactFullCore` the SOLE `data_revision` bumper (passes `bumpRevision:false` to the method core) — closing the knowledge-only under-bump and any double-bump.
- Flipped the create initial state to no-cadence (`intervalDays=null`) + Unbound (`trackingEnabled=false`), with pure `coordinateBoundToggle`/`coordinateCadenceSelection` helpers preserving the tri-state "Not yet" → no-interaction rule and ADR-062 Bound/Unbound semantics.
- Added the pure, node-tested `resolveErrorSection` + `CREATE_SECTION_FIELD_MAP` + `collectBlockingErrors` reveal-and-focus contract; a blocked Save now expands and scrolls the erroring section into view instead of a silent disabled button.

## Task Commits

1. **Task 1: AccordionSection primitive + Identity accordion (tracer)** — `f670780` (feat)
2. **Task 2: Relationship Basics — tri-state + Bound/Unbound** — `5c6e4f7` (test, RED) → `2b62ca3` (feat, GREEN)
3. **Task 3: Contact Methods + Show More atomic enrichment** — `2a9b9d3` (feat, includes DAO + logic + screen + tests)
4. **Task 4: CAPT-14 validation reveal-and-focus** — `7ee7fb7` (test, RED) → `1ee8a9b` (feat, GREEN)

**Plan metadata:** (this docs commit)

## Files Created/Modified
- `src/components/ui/AccordionSection.tsx` — new controlled accordion primitive + validation-focus interface.
- `src/components/ui/index.ts` — barrel export of AccordionSection.
- `src/db/contacts-dao.ts` — CreateContactFullInput enrichment arrays + create-path element types; createContactFullCore composes the enrichment `*Core` writers and owns the single data_revision bump.
- `src/db/contacts-dao.test.ts` — enrichment round-trip, rollback, framework-field injection, and data_revision-exactly-once tests.
- `src/db/contact-methods-dao.ts` — optional `bumpRevision` param (default true) on applyContactMethodDiffCore.
- `src/screens/create-contact-logic.ts` — coordinateBoundToggle/coordinateCadenceSelection, enrichment assembly in buildCreateInput, resolveErrorSection/CREATE_SECTION_FIELD_MAP/collectBlockingErrors.
- `src/screens/create-contact-logic.test.ts` — coordination, enrichment-assembly, and resolver/blocking-error tests.
- `src/screens/CreateContactScreen.tsx` — three-section accordion + Show More; initial-state flip; reveal-and-focus wiring; AppText/Button roles.

## Decisions Made
- Reused the profile enrichment editors in draft mode (synthetic-id adapters) rather than building parallel create-only editors — faithful to "compose the existing editors," and every draft feeds the atomic create so no rendered control silently fails to persist (Review HIGH #4).
- Kept the FrequencyPicker gated behind Bound (matching Edit Contact) with `value={intervalDays ?? 0}`, so binding with no cadence opens an empty custom entry (invalid → Save gated) instead of reintroducing the Monthly default.
- Made Save pressable-when-incomplete so the reveal-and-focus path is reachable (only disabled while saving).

## Deviations from Plan

None requiring a deviation rule. Two faithful implementation choices worth recording:
- The plan describes the FrequencyPicker as always visible ("selecting a cadence turns Bound on"). It is instead gated behind the Bound toggle (Edit-Contact parity), with `coordinateCadenceSelection` still wired so a cadence selection turns Bound on; binding with no cadence gates Save via `intervalValid=false`. This satisfies all CAPT-03 must_haves and the grep gate (no `FREQUENCY_DAYS.Monthly`) without a preselected default.
- "Unchanged form exits without a discard prompt" required no code: CreateContactScreen has no discard guard, so it already exits cleanly.

## Known Stubs

The Show-More enrichment editors are reused in **draft-collection mode** on the create path, so a few of their per-item persistence callbacks are intentional no-ops (there is no committed row to act on before the contact exists):
- `onRestore` (Memory, Relationship), `onSetAllowAi` (Memory), `onConfirm` (Fuel) → `() => {}` in `CreateContactScreen.tsx`.

These are NOT unfinished wiring: add/edit/remove all mutate local draft state, and every draft persists atomically via `createContactFull` on Save. Restore/AI-allow/confirm are edit-time operations on persisted rows and are correctly out of scope for create. (The RelationshipEditor is passed `contactId={0}` — a create-time placeholder used only by its ContactPicker's self-exclusion.) No broken-windows ledger entry filed: no goal-blocking stub, skipped test, or unrun verify.

## Threat Flags

None. No new network endpoints, auth paths, or trust-boundary schema changes. The threat register's create-path mitigations (T-34-08/09/10) are upheld: all writes route through createContactFull's composed `*Core` writers in one transaction (no inlined SQL); the shared future-date guard is unchanged; and the single atomic transaction now also composes every enrichment write so rollback leaves no partial contact or orphan row (asserted by contacts-dao.test.ts).

## Issues Encountered
- `src/components/orrery/orrery-controls-render.test.tsx` fails to load with `SyntaxError: Unexpected token 'typeof'` — **pre-existing and out of scope**, already documented in `deferred-items.md` (verified identical at pre-work commit `df0393a`, tied to the open Phase 30 orrery review). Full suite otherwise green: 3203 tests passing. Not touched.

## User Setup Required
None — no external service configuration.

## Next Phase Readiness
- The `AccordionSection` validation-focus interface is ready for 34-08 (Edit Contact IA) to consume identically.
- On-device UAT at the phase gate should confirm: three-section Add Contact, Show More reveal, name-only save → Profile, "Not yet" → no interaction, and a blocked Save revealing + focusing the erroring section.

## Self-Check: PASSED

- `src/components/ui/AccordionSection.tsx` — FOUND
- `.planning/phases/34-rapid-capture-update-flows/34-03-SUMMARY.md` — FOUND
- Commits f670780, 5c6e4f7, 2b62ca3, 2a9b9d3, 7ee7fb7, 1ee8a9b — all FOUND

---
*Phase: 34-rapid-capture-update-flows*
*Completed: 2026-09-13*
