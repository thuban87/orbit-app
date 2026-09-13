---
phase: 34-rapid-capture-update-flows
plan: 07
subsystem: ui
tags: [react-native, update-contact, memory-editor, contact-knowledge, chooser, custom-fields, current-state, fuel, contact-methods]

# Dependency graph
requires:
  - phase: 34-02
    provides: reconciled memory-registry (general "Memory" / custom "Custom", DEFAULT_MEMORY_TYPE_KEY, registry-driven type requests)
  - phase: 34-04
    provides: shared DashboardStack route-registry file (LogContact -> LogInteractionScreen swap) + TouchpointRefineForm patterns
provides:
  - "Update Contact chooser (CAPT-12): registry-driven compact action surface that returns to itself after each independent inner save until Done"
  - "Full Memory editor in Update Contact (CAPT-06): MemoryScreen composes the shipped MemoryEditor (type inside, metadata below; edit-only AI control) for CREATE + edit-in-place"
  - "Focused editors per row: current-state (Last Talked About / Current Location), Key People, Off Limits, Contact Method, Contact Frequency, named + generic Custom Fields"
  - "Update Contact preselection (CAPT-13) + failure-safety (CAPT-14)"
  - "Node-tested pure chooser row/session model (update-contact-chooser-logic.ts)"
affects: [35-compose, 36-ai-config, profile, contact-knowledge]

# Actuals (#2632)
actuals:
  tokens: 13300
  tasks: 3
  commits: 5

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure RN-free row/session logic module + node test alongside the screen (update-contact-chooser-logic.ts)"
    - "Focused-editor composition: each chooser row composes a canonical editor + its canonical DAO wrapper; each inner save is its own transaction"
    - "Deferred return-to-chooser via a savedTick effect so a child list-editor finishes its own close() before the host unmounts"

key-files:
  created:
    - src/screens/update-contact-chooser-logic.ts
    - src/screens/update-contact-chooser-logic.test.ts
    - src/screens/UpdateContactScreen.tsx
    - src/screens/MemoryScreen.tsx
  modified:
    - src/navigation/tabs/DashboardStack.tsx

key-decisions:
  - "Off Limits uses a focused off_limits-scoped fuel editor (list + add/edit/delete forced kind:\"off_limits\"), NOT the general multi-kind FuelEditor whose kind picker is wrong for a focused action"
  - "Contact Frequency reuses the canonical FrequencyPicker + setProfileContactFrequency (cadence-only; assigning a dormant cadence does not bind an Unbound row) per dossier §AB"
  - "Last Talked About / Current Location persist via setCurrentStateValue (current_state), recording NO interaction and never touching last_contact — NOT TriStateLastSpoke"
  - "MemoryScreen keeps the contactId-only route; existing-Memory selection happens in-screen (no memoryId param), edit-in-place via editMemory, create via addMemory"
  - "New-Memory AI posture stays registry-default OFF via addMemoryCore; no create-time AI control; globalAiEnabled derived from getAppSettings().aiProvider (not a stub)"

patterns-established:
  - "Registry-driven chooser: built-ins from the Contact Knowledge registry + applicability-filtered named custom fields + always-present generic Custom Fields row; never Category, never empty"
  - "Repeated-update session as a pure selector (open/save/cancel/Done) driving an in-screen editor swap rather than navigation for every row"

requirements-completed: [CAPT-06, CAPT-12, CAPT-13, CAPT-14]

coverage:
  - id: D1
    description: "Chooser row model + session selector: fixed built-ins, applicability-filtered named custom fields, always-present generic Custom Fields row (never Category, never empty, order-stable), and the open/save/cancel/Done session loop"
    requirement: CAPT-12
    verification:
      - kind: unit
        ref: "src/screens/update-contact-chooser-logic.test.ts (17 tests)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Update Contact chooser loop end-to-end on device: chooser -> focused editor -> independent save -> return to chooser with same contact + recent-success cue; Done exits; Category absent; generic Custom Fields row always present"
    requirement: CAPT-12
    verification:
      - kind: manual_procedural
        ref: "end-of-phase Pixel UAT: select several rows in sequence, each Save returns with a cue, Done exits"
        status: unknown
    human_judgment: true
    rationale: "UI flow + on-device persistence of the repeated-update session are visual/behavioral; per human_verify_mode end-of-phase, verified on the Pixel"
  - id: D3
    description: "Full Memory editor (CAPT-06): MemoryScreen lists existing Memories + Add, creates via addMemory, edits in place via editMemory (no duplicate), type inside + metadata below, edit-only AI control reflecting the real global AI provider"
    requirement: CAPT-06
    verification:
      - kind: manual_procedural
        ref: "end-of-phase Pixel UAT: Add creates one Memory; selecting an existing edits in place; AI control shows only when a provider is configured"
        status: unknown
    human_judgment: true
    rationale: "Edit-in-place no-duplicate and the edit-only AI control tracking the provider setting are UI-observable on device"
  - id: D4
    description: "Preselection (CAPT-13): Update Contact skips the picker when the invoking context identifies a contact; ContactPicker when untargeted"
    requirement: CAPT-13
    verification:
      - kind: manual_procedural
        ref: "end-of-phase Pixel UAT: opened with a contact -> chooser directly; opened untargeted -> picker"
        status: unknown
    human_judgment: true
    rationale: "Entry-context preselection is verified through the invoking surfaces on device"
  - id: D5
    description: "Failure-safety (CAPT-14): a failed inner save preserves the editor's state, shows the locked failure copy, and never returns to the chooser (no completion)"
    requirement: CAPT-14
    verification:
      - kind: manual_procedural
        ref: "end-of-phase Pixel UAT: induce a save failure and confirm state is preserved with no completion"
        status: unknown
    human_judgment: true
    rationale: "Failure preservation is an on-device behavior; the code path returns false / sets an inline error and skips completeSave"

# Metrics
duration: 35min
completed: 2026-09-12
status: complete
---

# Phase 34 Plan 07: Update Contact Chooser & Full Memory Editor Summary

**Registry-driven Update Contact chooser that returns to itself after each independent inner save until Done, plus the full Memory editor composed from the shipped MemoryEditor — filling both placeholder routes.**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-09-12T22:31:00-05:00 (first task commit)
- **Completed:** 2026-09-12T22:41:00-05:00 (last code commit)
- **Tasks:** 3
- **Files modified:** 5 (4 created, 1 modified)

## Accomplishments
- Filled the `UpdateContact` route with a compact, registry-driven chooser: fixed built-in rows (Last Talked About, Key People, Current Location, Memory, Off Limits, Contact Method, Contact Frequency) + applicable named custom fields + a generic Custom Fields row — never Category, never empty (CAPT-12).
- Each chooser row opens a focused editor composing the canonical control + DAO wrapper; each inner save persists independently and returns to the chooser with the same contact and a subtle "Updated" cue; Done exits (dossier §AA).
- Filled the `Memory` route with `MemoryScreen`, composing the shipped `MemoryEditor` for the full CREATE + edit-in-place experience (type inside, metadata below, edit-only AI control wired from the real AI-provider setting) — contactId-only route, no memoryId param (CAPT-06).
- Preselection from the route param with `ContactPicker` fallback when untargeted (CAPT-13); failure-safe inner saves preserve state and never show completion (CAPT-14).
- Extracted row assembly, applicability filtering, and the repeated-update session into a node-tested pure module (17 tests).

## Task Commits

1. **Task 1 (tracer): chooser logic + Memory route + registration** - `12dd422` (feat)
2. **Task 2: Memory editor return-to-chooser + AI-gate wiring (CAPT-06)** - `7dc8e05` (feat)
3. **Task 3: chooser rows -> focused editors + session (CAPT-12/13/14)** - `0ce1956` (feat)
4. **Biome formatting normalization** - `0eebdf8` (style)

**Plan metadata:** (docs commit — this SUMMARY + STATE/ROADMAP/REQUIREMENTS)

## Files Created/Modified
- `src/screens/update-contact-chooser-logic.ts` - Pure, RN-free row assembly (`buildChooserRows`, `selectApplicableDefs`) + repeated-update session selector (`startSession`/`openRow`/`completeSave`/`cancelRow`/`finishSession`/`targetContact`/`isChooserVisible`).
- `src/screens/update-contact-chooser-logic.test.ts` - 17 node tests: no Category, generic row always present, order-stable, applicability filtering, session transitions.
- `src/screens/UpdateContactScreen.tsx` - The chooser shell + focused editors (current-state, Key People, Off Limits, Contact Method, Contact Frequency, named + generic Custom Fields), preselection/picker, Done, failure-safety.
- `src/screens/MemoryScreen.tsx` - Composes `MemoryEditor` for CREATE + edit-in-place; returns to the chooser after each save; single-flight guard; failure copy.
- `src/navigation/tabs/DashboardStack.tsx` - Registered `UpdateContact -> UpdateContactScreen` and `Memory -> MemoryScreen` (replacing the placeholders).

## Decisions Made
- **Off Limits focused editor over the general FuelEditor:** the shipped `FuelEditor` presents a 5-kind picker, which is wrong for a focused off-limits action; built a focused list+add/edit/delete over the off_limits fuel rows, forcing `kind:"off_limits"` on every write. Off_limits stays the ONE surfaced fuel kind; writes go through the canonical `addFuel`/`editFuel`/`deleteFuel` (bound params).
- **Contact Frequency reuses `setProfileContactFrequency`** (canonical cadence-only writer; assigning a dormant cadence does not bind an Unbound row) rather than an Update-specific cadence system (dossier §AB). Bind/Unbound lifecycle is unchanged.
- **Current-state rows persist via `setCurrentStateValue`** keyed by `last_talked_about` / `current_location` — NOT `TriStateLastSpoke` (which writes `last_contact`). Editing them records no interaction and never touches recency (Review cycle-3 MEDIUM).
- **Generic Custom Fields = pick-then-edit** over `defsForEditForm` live defs (each opens the same `FieldValueInput` editor). New-definition creation is not added here (the Dashboard stack does not host the CustomFields route); the generic entry's primary purpose — selecting a less-prominent existing field — is served. Overflow ranking/search is [DERIVED] tuning left minimal.

## Deviations from Plan

None affecting scope — the plan executed as written. Two in-scope refinements worth noting:
- **[Rule 1/3 - correctness] Deferred return-to-chooser via a savedTick effect** in both `MemoryScreen` and the Key People focused editor: composing `MemoryEditor`/`RelationshipEditor` (which call their own `close()` after a save resolves) meant a direct `navigation.goBack()`/return inside the save handler would unmount the child mid-`close()` (setState-on-unmounted). Navigation/return is deferred to an effect keyed on a save tick. Committed in `7dc8e05` (Memory) and `0ce1956` (Key People).
- **[Rule 3 - blocking, style] Biome formatting** applied post-commit to match house format (`0eebdf8`). No behavior change.

## Issues Encountered
- **Pre-existing TypeScript error in 34-06's `PostLogNoteEditor.tsx`** (2 errors: `interactionId`/`note` not on `PostLogSaveResult` union) is present on HEAD (`7fd3b02`) and untouched by this plan. Logged to `deferred-items.md` (out of scope — 34-06 territory). 34-07's files typecheck clean.
- **Pre-existing Phase 30 orrery suite-load failure** (`orrery-controls-render.test.tsx`, `SyntaxError: Unexpected token 'typeof'`) still fails identically; all 3280 individual tests pass (incl. the 17 new ones). Logged in `deferred-items.md`.
- **Biome `lint/a11y/useValidAriaRole`** fires on `<AppText role=...>` — the shipped house typography idiom (ThingsToRememberScreen triggers it 9 times). Not a regression; no Biome pre-commit gate; plan gates (`check:colors` + `npm test`) both green. Logged in `deferred-items.md`.

## Threat surface
No new security-relevant surface beyond the plan's `<threat_model>`. Mitigations applied as planned: Memory/knowledge writes go through canonical DAOs with `?`-bound params scoped by `contact_id` (T-34-21), rows/edits scoped to the resolved contactId (T-34-22), each inner save is its own transaction (T-34-23), and the Memory AI control stays edit-only with `globalAiEnabled` derived from the real provider setting — no create-time egress widening (T-34-24). No new dependencies (package-legitimacy gate N/A).

## Known Stubs
None — every chooser row routes to a working focused editor; both routes are fully filled (no placeholder screens remain).

## Next Phase Readiness
- Update Contact (34-07) and its Memory editor are complete and route-registered; 34-08 is the remaining runnable plan in the phase.
- End-of-phase Pixel UAT should exercise: the chooser loop + recent-success cue, Memory create/edit-in-place, current-state rows writing no interaction, off-limits/contact-method/frequency/custom-field saves, preselection, and induced save-failure preservation.

## Self-Check: PASSED

---
*Phase: 34-rapid-capture-update-flows*
*Completed: 2026-09-12*
