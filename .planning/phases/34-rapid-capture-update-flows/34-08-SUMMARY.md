---
phase: 34-rapid-capture-update-flows
plan: 08
subsystem: ui
tags: [react-native, edit-contact, accordion, contact-knowledge, memories, relationships, fuel, off-limits, current-state, custom-fields, validation, dirty-state]

# Dependency graph
requires:
  - phase: 34-03
    provides: AccordionSection primitive + validation-focus interface (sectionId / controlled expanded / containerRef) + resolveErrorSection resolver shape
  - phase: 34-05
    provides: extended updateContactFull (persists all five §E knowledge subdomains atomically) + edit-contact-logic buildEditInput knowledge diffs + EDIT_SECTION_FIELD_MAP + collectEditBlockingErrors
provides:
  - "Edit Contact restructured into nine DIRECT-ACCESS top-level accordion sections (Identity, Relationship Basics, Contact Methods, Last Talked About, Key People, Current Location, Memories, Custom Fields, Off Limits) — the complete §E editable record in place"
  - "Every knowledge subdomain edits in place and persists through the single Save (updateContactFull) over the retained two-transaction boundary, seeded from its own explicit read"
  - "Off Limits section kind-scoped to off_limits (seed filtered + kind forced) so a contact's other fuel kinds survive an edit (DATA-LOSS guard)"
  - "CAPT-14 reveal-and-focus (via resolveErrorSection + AccordionSection), meaningful dirty-state guard across all sections, and partial-save failure recovery re-reading all five knowledge seeds"
affects: [profile, contact-knowledge, 35-compose]

# Actuals (#2632)
actuals:
  tokens: 14000
  tasks: 3
  commits: 3

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Knowledge-subdomain draft rows in EditFormState with a negative synthetic id for new rows (never collides with a real positive seed id, so a new row always diffs as an add; existing rows keep their real id so the diff routes them to edit/delete)"
    - "Per-subdomain seed adapters (*RowToDraftRow / *RowToItem) that emit the SAME field shape the editor commits, so an untouched seeded row diffs equal (no spurious dirty)"
    - "Display-only side-channel refs (id -> allow_ai, id -> linked contact name) for editor chrome that is not part of the save diff"
    - "Off-limits adapter over the shared FuelEditor: forces kind:\"off_limits\" on every add/edit in the host handlers (data-safe without modifying the shared editor)"

key-files:
  created: []
  modified:
    - src/screens/EditContactScreen.tsx

key-decisions:
  - "Knowledge drafts live in EditFormState (memories/relationships/offLimits/lastTalkedAbout/currentLocation) so buildEditInput reads them directly; seed baselines held as separate state (seeded*) so the seed<->draft diff distinguishes unchanged/added/edited/deleted"
  - "Off Limits kind-scoping enforced in THREE places (belt-and-braces): seed filtered to kind===off_limits, host add/edit handlers force kind:\"off_limits\", and buildEditInput defensively re-filters + forces kind — so recent/topic/fact/gift fuel can never enter the off_limits diff"
  - "FuelEditor is composed unmodified (files_modified is EditContactScreen only); the off-limits constraint is a host-side adapter (forced kind), not a new editor prop — the kind picker stays visible but any non-off_limits selection is coerced back to off_limits, keeping the data-loss property fully enforced"
  - "MemoryEditor globalAiEnabled derived from real app settings (getAppSettings().aiProvider !== 'none'); onSetAllowAi wired to setMemoryAllowAi (persists immediately, not through Save) — never a hardcoded false (D-04)"
  - "Identity is the exhaustive admin section (photo, name, category, birthday, social battery, both reminder toggles); Relationship Basics owns Bound/Unbound + Frequency + never-contacted last-spoke; Contact Methods owns phone/email + links"

patterns-established:
  - "Restructuring a flat edit form into controlled top-level AccordionSections consuming the 34-03 primitive identically to Add Contact, with parent-owned expansion driving reveal-and-focus"
  - "Composing the canonical list-editors (MemoryEditor/RelationshipEditor/FuelEditor) into a single-Save form via draft rows + a pure seed<->draft diff, with each editor's own transient row identity mapped to durable row ids"

requirements-completed: [CAPT-04, CAPT-14]

coverage:
  - id: D1
    description: "Edit Contact renders the complete §E record as nine direct-access top-level accordion sections consuming AccordionSection identically to Add Contact (no nested knowledge drawer)"
    requirement: CAPT-04
    verification:
      - kind: manual_procedural
        ref: "end-of-phase Pixel UAT: all nine sections present as top-level accordions; multiple open simultaneously"
        status: unknown
    human_judgment: true
    rationale: "The IA + multi-open behaviour are visual/on-device; grep gates confirm the primitive + editors are composed and no Things-to-Remember drawer remains"
  - id: D2
    description: "Each knowledge subdomain round-trips through the single Save (add/edit/delete): edit -> Save -> reopen shows the change with no duplicate; delete -> Save -> reopen gone; current-state value changes persist"
    requirement: CAPT-04
    verification:
      - kind: unit
        ref: "34-05 edit-contact-logic.test.ts ({add,edit,delete} diff) + contacts-dao.test.ts (updateContactFull round-trip + off-limits preservation)"
        status: pass
      - kind: manual_procedural
        ref: "end-of-phase Pixel UAT: exercise add/edit/delete per subdomain and reopen"
        status: unknown
    human_judgment: true
    rationale: "The DAO + diff correctness is node-tested (34-05); the screen wiring's end-to-end round-trip is UI-observable on device"
  - id: D3
    description: "Off Limits is kind-scoped: shows only off_limits rows, forces kind:\"off_limits\" on add/edit, and an Off Limits edit leaves the contact's recent/topic/fact/gift fuel intact"
    requirement: CAPT-04
    verification:
      - kind: unit
        ref: "34-05 contacts-dao.test.ts off-limits preservation assertion + edit-contact-logic kind-scoped diff"
        status: pass
      - kind: manual_procedural
        ref: "end-of-phase Pixel UAT: on a contact with other fuel kinds, add/edit/delete an Off Limits entry then confirm other kinds survive"
        status: unknown
    human_judgment: true
    rationale: "The diff-level data-loss guard is node-tested; the screen's seed filter + forced kind is verified end-to-end on device"
  - id: D4
    description: "MemoryEditor Allow-AI control reflects the REAL global AI provider setting (available with a provider configured, unavailable when 'none'); default-OFF on create stays registry-driven"
    requirement: CAPT-04
    verification:
      - kind: manual_procedural
        ref: "end-of-phase Pixel UAT: toggle the AI provider and confirm the edit-only Allow-AI control tracks it"
        status: unknown
    human_judgment: true
    rationale: "getAppSettings-derived value + setMemoryAllowAi wiring are confirmed by grep; the real-vs-stub behaviour is UI-observable"
  - id: D5
    description: "Reveal-and-focus: a blocking validation error on Save expands + scrolls the containing accordion via the tested resolveErrorSection resolver + the AccordionSection interface"
    requirement: CAPT-14
    verification:
      - kind: unit
        ref: "34-05/34-03 resolveErrorSection unit coverage (pure resolver)"
        status: pass
      - kind: manual_procedural
        ref: "end-of-phase Pixel UAT: clear the name in a collapsed Identity section and Save -> section expands + scrolls into view"
        status: unknown
    human_judgment: true
    rationale: "The error->section resolution is node-tested; the expand+scroll is device-observable"
  - id: D6
    description: "Dirty-state guard fires only on meaningful edits (including knowledge-section edits); an unchanged form exits with no prompt; a links-only save failure keeps committed metadata+knowledge, re-seeds all five knowledge subdomains for retry, and never shows completion"
    requirement: CAPT-14
    verification:
      - kind: manual_procedural
        ref: "end-of-phase Pixel UAT: back out unchanged (silent), back out after a knowledge edit (Discard/Keep), induce a links failure (partial-save copy, state preserved)"
        status: unknown
    human_judgment: true
    rationale: "The signature covers the knowledge drafts (buildEditInput with seeded baselines); the failure/reseed path is on-device behaviour"

# Metrics
duration: 9min
completed: 2026-09-12
status: complete
---

# Phase 34 Plan 08: Edit Contact Complete-Record Accordion Summary

**EditContactScreen restructured into nine direct-access top-level accordion sections exposing the complete §E editable record, with every knowledge subdomain editing in place and persisting through one Save over the retained two-transaction boundary, kind-scoped Off Limits, and CAPT-14 reveal-and-focus + dirty-state + failure-safety.**

## Performance

- **Duration:** ~9 min (first task commit 23:04 → last code commit 23:13, 2026-09-12)
- **Tasks:** 3
- **Files modified:** 1 (0 created, 1 modified)

## Accomplishments
- Restructured the flat `EditContactScreen` into nine controlled top-level `AccordionSection`s — Identity, Relationship Basics, Contact Methods, Last Talked About, Key People, Current Location, Memories, Custom Fields, Off Limits — consuming the 34-03 primitive identically to Add Contact (CAPT-04, dossier §E). Multiple sections may stay open.
- Wired all five knowledge subdomains into the SINGLE form-level Save by composing the existing canonical editors (MemoryEditor / RelationshipEditor / FuelEditor / current-state inputs). Each section seeds its draft from its OWN explicit read (`getContactForEdit` returns none of them) and feeds its seed↔draft diff into 34-05's `buildEditInput` → `updateContactFull` (metadata + knowledge, one txn) THEN `applyLinkDiff` (links, second txn) — the deliberate two-transaction boundary retained, not collapsed. No new write path.
- Kind-scoped the Off Limits section (DATA-LOSS guard, cycle-4 MEDIUM #3): seeded from `listFuelForEditor(...).filter(kind === "off_limits")` and forced `kind:"off_limits"` on every add/edit, so a `recent`/`topic`/`fact`/`gift` row can never be shown/created/edited/deleted or computed as a delete.
- Wired MemoryEditor's AI-gate from the real app settings (`getAppSettings().aiProvider !== "none"`, not a hardcoded false) and `onSetAllowAi` → `setMemoryAllowAi` (persists immediately, per-item, not through Save) — D-04.
- Implemented CAPT-14 reveal-and-focus: a blocked Save routes through the tested `resolveErrorSection` + `EDIT_SECTION_FIELD_MAP` to expand + scroll the erroring accordion; the Save button stays pressable when incomplete so a blocked press reveals rather than being inert.
- Extended the dirty signature to cover the knowledge drafts (via `buildEditInput` with the seeded baselines) and the partial-save reseed to re-read ALL five knowledge seeds (off-limits re-read stays off_limits-filtered), so a links-only failure keeps committed metadata+knowledge and a retry neither re-adds nor mis-detects already-persisted rows.

## Task Commits

1. **Task 1 (tracer): restructure into top-level accordions + wire Memories end-to-end** - `1200636` (feat)
2. **Task 2: add the four remaining knowledge sections (Key People, Last Talked About, Current Location, Off Limits)** - `b297a49` (feat)
3. **Task 3: reveal-and-focus validation + failure-safe Save (CAPT-14)** - `4a81483` (feat)

**Plan metadata:** docs commit (this SUMMARY + STATE/ROADMAP/REQUIREMENTS).

## Files Modified
- `src/screens/EditContactScreen.tsx` — Restructured render into nine controlled `AccordionSection`s; added per-subdomain seed adapters + display-only side-channel refs (id→allow_ai, id→linked-contact-name); added memories/relationships/off-limits draft mutators (negative synthetic ids for new rows, forced off_limits kind); threaded the knowledge drafts + seed baselines through `buildEditInput`, the dirty signature, and the partial-save reseed; added reveal-and-focus (`resolveErrorSection` + `revealAndFocus` over the AccordionSection interface).

## Decisions Made
- **Off-limits constraint as a host-side adapter, not a FuelEditor prop.** `files_modified` scopes this plan to `EditContactScreen.tsx`, and the plan says compose the existing editors without rebuilding them. The Off Limits section forces `kind:"off_limits"` in its add/edit host handlers (any non-off_limits picker selection is coerced back immediately), combined with an off_limits-filtered seed and `buildEditInput`'s defensive re-filter+force. The kind picker remains visible but cannot set a non-off_limits kind from this section — the DATA-LOSS property is fully enforced; the picker visibility is cosmetic only.
- **New knowledge rows use negative synthetic ids.** A new row (no DB id yet) is assigned a decrementing negative id so it renders/edits/deletes as a distinct row, yet — because no real positive seed id matches it — `buildEditInput` diffs it as an add (which strips the id). Existing rows keep their real DB id so the diff routes them to edit/delete. This also lets `onSetAllowAi` reach the real memory id (the Allow-AI control only renders for existing rows).
- **Seed adapters mirror the editor's commit shape** so an untouched seeded row diffs equal (no spurious dirty state); a no-op blur on a FuelEditor field re-emits the same `blankToNull` value and stays unchanged.

## Deviations from Plan
- **[Rule 2 — completeness] Reveal-and-focus + full knowledge reseed pulled partly into Task 2.** The plan slots the partial-save reseed of all four remaining knowledge seeds and the dirty-signature extension into Task 3, but they are directly caused by Task 2's introduction of those subdomains into the save path (leaving them out would be a latent partial-save bug), so Task 2 already re-reads all five seeds and covers them in the dirty signature. Task 3 adds the reveal-and-focus wiring and switches the Save button to always-pressable. Net behaviour matches the plan; each commit is self-consistent and green.
- **[minor] Comment references to the standalone knowledge screen reworded** to keep the `grep -c "ThingsToRemember"` acceptance gate at 0 (no nested drawer as an editing container). No behaviour change.

## Issues Encountered
- **Pre-existing Phase 30 orrery suite-load failure** (`orrery-controls-render.test.tsx`, `SyntaxError: Unexpected token 'typeof'`) still fails identically; all 3280 individual tests pass. Logged in `deferred-items.md`; tied to the uncommitted `tsconfig.json` in the working tree — left untouched per plan.
- **Biome `lint/a11y/useValidAriaRole`** fires on the shipped `<AppText role=...>` house idiom (as it does across the codebase). Not a regression; no Biome pre-commit gate; the plan gates (`check:colors` + `npm test`) and `tsc --noEmit` are all green.

## Threat surface
No new security-relevant surface beyond the plan's `<threat_model>`. Mitigations applied: the screen inlines no SQL — metadata + all knowledge persist through 34-05's parameterized `updateContactFull` and links through `applyLinkDiff` (T-34-26); the discard guard fires only on meaningful dirty state and the two-transaction boundary preserves committed metadata+knowledge on a links-only failure with no false completion (T-34-27); Off Limits is triple-guarded against destroying other fuel kinds (T-34-29); the MemoryEditor AI-gate is derived from the real provider setting, never a stub (T-34-30). No new dependencies (package-legitimacy gate N/A).

## Known Stubs
None that block the plan's goal — all nine sections are wired and persist. Intentional no-op callbacks (documented, not defects):
- `MemoryEditor.onRestore` / `RelationshipEditor.onRestore` — the edit form never surfaces soft-deleted rows (`listMemoriesForContact` / `listRelationshipsForContact` exclude them), so Restore is unreachable here (it lives on the standalone Recently Deleted / knowledge surface).
- `FuelEditor.onConfirm` — the AI-unconfirmed confirm flow is not applicable to a private off_limits-only section (off_limits is never transmitted to AI); off_limits draft rows render as `source: "user"`.

## Next Phase Readiness
- 34-08 completes the last runnable plan in Phase 34. Edit Contact now exposes the complete §E editable record.
- End-of-phase Pixel UAT should exercise: the nine top-level sections; add/edit/delete round-trip per knowledge subdomain (no duplicate on edit); Off Limits preservation of other fuel kinds; the Memory Allow-AI control tracking the real provider setting; reveal-and-focus on a blocked Save; the dirty-state guard (silent unchanged exit vs Discard/Keep after a knowledge edit); and an induced links-only save failure (partial-save copy, state preserved, retry).

## Self-Check: PASSED

---
*Phase: 34-rapid-capture-update-flows*
*Completed: 2026-09-12*
