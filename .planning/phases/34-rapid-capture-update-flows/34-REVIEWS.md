---
phase: 34
reviewers: [codex, claude]
reviewed_at: 2026-09-12T21:55:52Z
plans_reviewed: [34-01-PLAN.md, 34-02-PLAN.md, 34-03-PLAN.md, 34-04-PLAN.md, 34-05-PLAN.md, 34-06-PLAN.md, 34-07-PLAN.md]
models:
  codex: "gpt-5.6-terra (reasoning=low)"
  claude: "claude (read-only subagent workaround)"
model_sources:
  codex: "banner"
  claude: "subagent-workaround"
cycle_summary:
  cycle: 2
  current_high: 1
  current_actionable: 5
notes:
  - "CYCLE 2 of the convergence loop. Re-reviewed the CURRENT plans on disk after commit a463808 revised all 7 plans to address cycle-1's 4 HIGH + 8 actionable findings. Counts below are only concerns that REMAIN UNRESOLVED now; cycle-1 findings incorporated/deferred in the revised plans are NOT re-counted."
  - "All FOUR cycle-1 HIGHs are confirmed FULLY RESOLVED and re-verified against the code on disk by both lanes: 34-01 backup-wire camelCase keys (round-trip through COLUMN_OF), 34-03 Show-More enrichment atomic persistence (the four *Core writers exist and compose into createContactFull's single txn), 34-04 scoped channelOptions prop (five existing consumers unaffected), 34-06 additive two-action snackbar. Plus 34-02 CAPT-15 satisfied-by-dependency."
  - "The claude lane ran as a READ-ONLY Claude subagent, not `claude -p` — the documented workaround for this repo's `claude -p` Write-permission gap. The lane was NOT dropped."
  - "The orchestrator independently re-verified every claimed HIGH/MEDIUM against the code on disk (migration head 026→027, TouchpointRefineForm CHANNEL_OPTIONS = 5 + no channelOptions prop + inline duration render, MemoryEditor Allow-AI gated on `editing`, EditContactScreen editor imports, UpdateContactFullInput field list, ThingsToRemember as a separate screen). The one new HIGH (34-05) was confirmed real."
  - "The new HIGH is in 34-05 (Edit Contact), a plan cycle-1 flagged only at LOW — a subsystem-level read found the deeper defect. This is exactly the 'review the code, not the diff' catch CLAUDE.md mandates."
---

# Cross-AI Plan Review — Phase 34: Rapid Capture & Update Flows (Cycle 2)

Two independent reviewers (Codex `gpt-5.6-terra`, Claude read-only subagent) re-reviewed all 7 CURRENT plans against the code on disk after the cycle-1 replan (commit a463808). Both cited `file:line` evidence. The orchestrator re-verified every load-bearing claim on disk before writing this consensus.

## Consensus Summary

**The cycle-1 replan succeeded.** Both reviewers independently confirmed — and the orchestrator re-verified — that all four cycle-1 HIGH blockers are correctly resolved with the right mechanisms and non-regression gates: the backup-wire keys are camelCase MANIFEST keys that round-trip through `COLUMN_OF` (34-01); Show-More enrichment now composes the real, exec-scoped `addMemoryCore`/`addRelationshipCore`/`setCurrentStateValueCore`/`addFuelCore` writers inside `createContactFull`'s single `inWriteTransaction` (34-03); the shared `TouchpointRefineForm` gains an additive `channelOptions` prop that leaves all five existing consumers on five options (34-04); and the single-action snackbar gains an additive `secondaryAction` (34-06). Migration numbering is correct (head 026 → 027), and CAPT-15 is provably satisfied-by-dependency (migration 025 already shipped the value-only remap; consumers already compare migrated literals). No recorded-decision reversal was found in any plan.

**One new HIGH remains, in a plan cycle-1 under-weighted.** The claude lane's subsystem-level read of Edit Contact (34-05) found the same silent-non-persistence hazard class that cycle-1 HIGH #4 fixed for Add Contact (34-03) — left unaddressed here. 34-05's must_haves require nine top-level accordion sections including the knowledge subdomains **Memories, Key People/Relationships, Last Talked About, Current Location, Off Limits**, but `EditContactScreen` edits none of those today (it composes only ContactMethodsEditor/LinksEditor/FrequencyPicker/FieldValueInput/TriStateLastSpoke), `UpdateContactFullInput` (contacts-dao.ts:276) has no fields for them, 34-05 modifies **no DAO**, and its persistence path is `updateContactFull` + `applyLinkDiff` only — neither writes the memories/relationships/current_state/fuel tables. The plan also rests on a false premise ("remove the nested Things-to-Remember drawer") — there is no such drawer in `EditContactScreen`; those subdomains live in the separate `ThingsToRememberScreen`. Executed literally, editors would render with no save wiring and drop user edits on shared tables; alternatively the must_haves/success-criteria are wrong. This needs an owner/planner scope decision (edit-in-place vs. deep-link to Update Contact / ThingsToRemember), not a silent narrowing.

Both lanes also raised localized, non-HIGH implementation-specification gaps (Duration "More Options" mechanism, Memory AI-permission on creation, the AccordionSection reveal-and-focus API, a restore round-trip test placed in the wrong suite, and two doc/acceptance-gate defects).

**Overall risk: MEDIUM.** Six of seven plans are well-grounded and decision-safe; residual risk is concentrated in 34-05 plus a handful of scoped spec gaps. None are decision reversals; the 34-05 HIGH is a scope/persistence reconciliation the planner or owner must make before execution.

### Agreed Strengths (2+ reviewers, file:line verified)

- **All four cycle-1 HIGHs resolved and re-verified.** camelCase backup keys round-trip through `COLUMN_OF` (`backup-schema.ts:133`, `restore-apply.ts:327`); enrichment `*Core` writers exist and compose atomically (`contacts-dao.ts:152`); scoped `channelOptions` leaves five consumers untouched (`TouchpointRefineForm.tsx:76`, no consumer passes it); additive `secondaryAction` (`snackbar-store.ts:11`, `Snackbar.tsx:25`). (codex, claude)
- **Migration numbering correct; double-migration hazard actively avoided.** Head is 026 (`database.ts:67`, `026-group-events-schema.ts:12`); 34-01 adds 027; 34-01/34-02 ship NO second `interactions` migration and gate it with `grep -c "ALTER TABLE interactions"` → 0. (codex, claude)
- **CAPT-15 satisfied-by-dependency is real, not asserted.** Migration 025 (`025-interaction-history-schema.ts:50-72`) already did the value-only remap with NULL/legacy-preserving `ELSE` arms; `ai-context-read.ts:137-142` and `digest-read.ts` compare migrated literals. (codex, claude)
- **Privacy/egress boundary holds.** `allow_ai` defaults 0 (`025-interaction-history-schema.ts:48`); `ai-context-read.ts:103` never selects note prose; no plan widens the projection. (codex, claude)

### Agreed Concerns (2+ reviewers — highest priority)

- **MEDIUM — reveal-and-focus validation has no implementable/testable focus contract (34-03, 34-05).** The new `AccordionSection` (34-03 Task 1) is specified only as a controlled expand/collapse with an a11y state and a body slot; "expand and scroll to the first blocking field" (34-03 Task 4, 34-05 Task 2) has no ref / field-registration / scroll-target API and only human-check acceptance. Codex raised this against both plans; claude's 34-05 HIGH subsumes the 34-05 side. **Fix:** define an AccordionSection validation interface (section id, `expanded` setter, first-invalid-field ref/scroll target) and add unit coverage for error→section resolution, not only device UAT.

### Divergent Views (worth investigating)

- **34-05 severity — claude HIGH (silent non-persistence + false premise) vs codex MEDIUM (only the validation-focus API).** Codex reviewed 34-05 at the task/API level and flagged only the missing focus contract; claude read the subsystem (EditContactScreen editors, UpdateContactFullInput, ThingsToRememberScreen) and found the must_haves require five knowledge subdomains the screen cannot edit and the plan cannot persist. The orchestrator verified claude's evidence on disk and treats it as the load-bearing (HIGH) view.
- **codex-only MEDIUMs claude did not raise:** (1) **34-04 Duration "More Options"** — `TouchpointRefineForm` renders Duration inline whenever `"duration"` ∈ `visibleFields` (`TouchpointRefineForm.tsx:360`); there is no progressive-disclosure prop, and Plan 04 adds `channelOptions` but no `moreOptions` mechanism, so CAPT-07's "Duration under More Options" is not mechanically delivered (verified on disk). (2) **34-07 Memory AI-permission on creation** — `MemoryEditor` renders "Allow AI to use this" only when `editing` is truthy (`MemoryEditor.tsx:384-411`) and `addMemoryCore` derives `allow_ai` from the registry (`memories-dao.ts:94`); Plan 07's "AI permission behind More Options" for *creation* is unspecified (registry-default-only vs. editor/DAO extension). Both verified real.
- **codex-only LOW:** 34-01's restore round-trip test is assigned to `backup-schema.test.ts`, which only tests parsing/allowlisting; the real `COLUMN_OF` mapping + write live in `app-settings-dao.ts`/`restore-apply.ts`, so the round-trip assertion belongs in `restore-apply.test.ts`. (claude separately notes the extra restore-boundary validation in `backup-schema.ts` is redundant with `validateAppSettingsPatch` — harmless.)
- **claude-only LOWs codex did not raise:** 34-02's objective prose overstates a "current duplicate-label collision" (today `general`="General", `custom`="Memory" — no collision; the swap *prevents* one) — cosmetic reword; and 34-05's `grep -ci "ThingsToRemember" EditContactScreen.tsx` acceptance gate is a no-op (already 0) — subsumed by the 34-05 HIGH fix.

## Full Reviews

### Codex Review

## Summary

The revised plans resolve the cycle-1 blockers: migration 027 is correctly sequenced, backup keys use camelCase wire names, the scoped channel-options design preserves legacy editability, Show More persistence is explicitly transactional, and Quick Log now supports Undo plus Add Note safely. Remaining issues are implementation-specification gaps around progressive disclosure, Memory AI permission on creation, and actionable validation focus.

## Strengths

- Migration sequencing is sound. The registered schema head is 026 in [database.ts](/home/bwales/projects/orbit-app/src/db/database.ts:67), and migration 025 already owns the irreversible interaction vocabulary/Allow-AI migration, including NULL-preserving remaps in [025-interaction-history-schema.ts](/home/bwales/projects/orbit-app/src/db/migrations/025-interaction-history-schema.ts:50). Plans 01–02 appropriately avoid another `interactions` migration.

- The revised backup approach matches the actual restore contract. Portable setting keys are camelCase in [backup-schema.ts](/home/bwales/projects/orbit-app/src/backup/backup-schema.ts:133), while restore converts manifest settings into `AppSettingsPatch` in [restore-apply.ts](/home/bwales/projects/orbit-app/src/backup/restore-apply.ts:327). Plan 01 now specifies the correct camelCase keys.

- Plan 04’s scoped `channelOptions` is the right non-regressive design. The existing shared form has five options, including legacy `other` and `unspecified`, in [TouchpointRefineForm.tsx](/home/bwales/projects/orbit-app/src/components/TouchpointRefineForm.tsx:76); Edit Interaction consumes that same component without field restrictions in [EditInteractionScreen.tsx](/home/bwales/projects/orbit-app/src/screens/EditInteractionScreen.tsx:181). The new optional prop preserves that surface while narrowing ordinary logging.

- The plans honor the privacy boundary. `allow_ai` defaults to 0 in [migration 025](/home/bwales/projects/orbit-app/src/db/migrations/025-interaction-history-schema.ts:48), and AI context deliberately excludes interaction-note prose in [ai-context-read.ts](/home/bwales/projects/orbit-app/src/db/ai-context-read.ts:103). No plan expands that projection.

- The Add Contact transaction proposal correctly builds on the composable cores: the existing create path opens one transaction in [contacts-dao.ts](/home/bwales/projects/orbit-app/src/db/contacts-dao.ts:145), while Memory, relationship, current-state, and fuel cores are explicitly transaction-composable in their respective DAOs.

## Concerns

- **MEDIUM — Plan 04 does not specify a mechanism that actually puts Duration behind “More Options.”** `TouchpointRefineForm` renders Duration directly whenever `"duration"` is in `visibleFields` ([TouchpointRefineForm.tsx](/home/bwales/projects/orbit-app/src/components/TouchpointRefineForm.tsx:360)); it has no progressive-disclosure prop or grouping API. Plan 04 adds `channelOptions`, but its task action does not add a `moreOptions` mechanism or move duration into a screen-owned disclosure. As written, CAPT-07’s required placement is not mechanically delivered.

- **MEDIUM — Plan 07 promises full Memory AI-permission metadata during creation, but the existing editor/API only exposes that control for an existing Memory.** `MemoryEditor` renders “Allow AI to use this” only when `editing` is truthy ([MemoryEditor.tsx](/home/bwales/projects/orbit-app/src/components/MemoryEditor.tsx:390)), and `NewMemoryInput` has no caller-provided `allowAi`; `addMemoryCore` derives it from the registry ([memories-dao.ts](/home/bwales/projects/orbit-app/src/db/memories-dao.ts:94)). Plan 07 modifies `MemoryScreen` but does not specify whether new-Memory AI permission is intentionally registry-default-only or requires an editor/DAO extension. This leaves the plan’s “creation/editing … AI permission behind More Options” claim incomplete.

- **MEDIUM — Plans 03 and 05 require reveal-and-focus validation but do not define the focus contract needed to implement or test it.** The proposed `AccordionSection` is described only as a controlled expanded body slot; no ref, field-registration, scroll-target, or focus API is specified. Existing editors own native inputs internally—for example, the contact-method editor is composed into the create screen rather than exposing a documented focus interface. “Expand it and scroll to the first blocking field” therefore remains a human-check aspiration rather than a testable mechanism.

- **LOW — Plan 01’s restore round-trip test is assigned to the wrong test boundary.** [backup-schema.test.ts](/home/bwales/projects/orbit-app/src/backup/backup-schema.test.ts:1) currently tests parsing/allowlisting only; the real `COLUMN_OF` mapping and database write occur in [app-settings-dao.ts](/home/bwales/projects/orbit-app/src/db/app-settings-dao.ts:497) and [restore-apply.ts](/home/bwales/projects/orbit-app/src/backup/restore-apply.ts:327). The planned behavior can be tested, but it should be added to `restore-apply.test.ts` (or a focused portability integration test), not merely asserted from the schema-parser suite.

## Suggestions

- Add a scoped progressive-disclosure API for `TouchpointRefineForm`, or render Duration in a screen-owned “More Options” section while keeping the value controlled by the form model. Add a UI assertion that Duration is absent before expansion and available afterward.

- Decide and document the creation-time Memory AI-permission rule. If users must set it on initial creation, extend `MemoryDraft`, `MemoryEditor`, and `NewMemoryInput`; if registry default is intentional, state that explicitly and remove the broader creation claim.

- Define an `AccordionSection` validation interface: section ID, `expanded` setter, and registered first-invalid field ref/scroll target. Add unit coverage for error-to-section resolution, not only device UAT.

- Move the Plan 01 end-to-end restore assertion into `restore-apply.test.ts`, proving that a parsed camelCase manifest key updates the intended SQLite column and malformed values are rejected before write.

## Risk Assessment

**MEDIUM.** The data migration, vocabulary, privacy, atomic-create, and dependency-ordering risks are now well handled. The remaining gaps are localized UI/API contracts, but they affect explicit success criteria and should be resolved before execution to avoid a technically functional implementation that misses the intended capture experience.

---

### Claude Review

# Cross-AI Plan Review — Phase 34 "Rapid Capture & Update Flows" (Cycle 2, Claude lane)

## 1. Summary

The four cycle-1 HIGH findings are genuinely and correctly resolved, verified against source: the backup-wire keys are camelCase MANIFEST keys that round-trip through `COLUMN_OF` (34-01); CAPT-15 is provably satisfied-by-dependency because migration 025 already shipped the value-only remap and the consumers already compare migrated literals (34-02); Show-More enrichment now composes real `*Core` writers inside the single `createContactFull` transaction (34-03); the shared `TouchpointRefineForm` gets an additive `channelOptions` prop that leaves all four existing consumers on five options (34-04); and the single-action snackbar gains an additive `secondaryAction` (34-06). Migration numbering is correct (head on disk is 026, next is 027). However, a subsystem-level read surfaces one **unresolved HIGH** that the cycle-1 review missed: plan **34-05 (Edit Contact)** requires knowledge-subdomain sections (Memories, Key People/Relationships, Last Talked About, Current Location, Off Limits) that Edit Contact does **not** currently edit, provides **no persistence path** for them (it modifies no DAO and commits to only `updateContactFull`+`applyLinkDiff`, neither of which writes those tables), and rests on a false premise — there is no "nested Things-to-Remember drawer" in `EditContactScreen` to remove. This is the same silent-non-persistence hazard that cycle-1 HIGH #4 fixed for 34-03, left unaddressed for 34-05.

## 2. Strengths (file:line verified)

- **Migration numbering is correct and the double-migration hazard is actively avoided.** `src/db/database.ts:12`/`67` — `GROUP_EVENTS_SCHEMA_VERSION = 26` (in `026-group-events-schema.ts:12`) is `TARGET_VERSION`; head+1 = 027, exactly what 34-01 claims. 34-01 and 34-02 both explicitly ship NO second `interactions` migration and gate against it with acceptance greps (`grep -c "ALTER TABLE interactions"` → 0). This honors D-07 and the CLAUDE.md forward-only/irreversible rule.
- **CAPT-15 satisfied-by-dependency is real, not asserted.** `src/db/migrations/025-interaction-history-schema.ts:52-72` already performs the value-only remap (`good→Positive`, `fine→Neutral`, `hard→Negative`; `text/email→Message`, `call→Call`, `in-person→In Person`; `ELSE quality`/`ELSE channel` passes `other`/`unspecified`/NULL through). `src/db/interaction-vocabulary.ts` is the single source and its `LEGACY_*_REMAP` maps match the migration's frozen CASE arms. Consumers verified: `src/db/ai-context-read.ts:137-142` compares `"Positive"/"Neutral"/"Negative"` (with an explicit comment that a stale `good/fine/hard` compare would miscount), and `src/db/digest-read.ts:134-146` tallies the migrated Tone vocabulary. 34-02's grep-audit + round-trip regression is a sound way to prove no straggler.
- **Backup-wire casing fix (HIGH #2) is mechanically correct.** `src/backup/backup-schema.ts:133-192` — `PORTABLE_SETTINGS_KEYS` are camelCase MANIFEST keys (`dashboardRightSwipeAction`, `historyLens`, `historyCycleCount`), and `src/backup/restore-apply.ts:327` casts `manifest.appSettings` to `AppSettingsPatch` then routes through `updateAppSettingsCore` → `COLUMN_OF`, so a snake_case key would silently drop. 34-01's camelCase-present / snake_case-absent grep gates enforce this. **Restore value-validation is also genuinely covered**: `updateAppSettingsCore` (app-settings-dao.ts:~1119) calls `validateAppSettingsPatch(patch)`, the same guard block (lines 1000-1055) that holds the per-key asserts — so adding `assertDefault/RememberedInteractionChannel` there protects both the ordinary write and the restore path. No egress widening: the two keys are declare-only, not emitted, no `BACKUP_FORMAT_VERSION` bump.
- **34-03 HIGH #4 persistence fix is backed by real symbols.** All four enrichment writers exist and are exec-scoped/composable: `src/db/memories-dao.ts:94` (`addMemoryCore`), `src/db/relationships-dao.ts:68` (`addRelationshipCore`), `src/db/current-state-history-dao.ts:55` (`setCurrentStateValueCore`), `src/db/fuel-dao.ts:131` (`addFuelCore`). `createContactFull` opens exactly one `inWriteTransaction` (`src/db/contacts-dao.ts:152`) composing `createContactFullCore`. The default-flip target is real: `src/screens/CreateContactScreen.tsx:97-100` initializes `intervalDays = FREQUENCY_DAYS.Monthly` and `trackingEnabled = true`, and `create-contact-logic.ts:96-127` `buildCreateInput` uses `trackingEnabled !== false` (so the initial state must be flipped to `false`) — exactly as the plan states.
- **34-04 shared-form fix (HIGH #1) is non-regressing.** `src/components/TouchpointRefineForm.tsx:76-87` has five `CHANNEL_OPTIONS` and no `channelOptions` prop today; `visibleFields` (line 147) is field-level, not option-level, as claimed. All four consumers are correctly enumerated and none pass `channelOptions` (`grep -rn channelOptions src/` → NONE): `EditInteractionScreen.tsx`, `GroupLogScreen.tsx`, `EditGroupEventScreen.tsx`, `group/ParticipantOverrideEditor.tsx`. The non-atomic remembered-channel recovery contract is correct: `updateAppSettings` opens its own `inWriteTransaction` (`app-settings-dao.ts:1073`), separate from the recency-spine write. The ADR-078 note-egress boundary holds: `ai-context-read.ts:103` deliberately does not select `note`.
- **34-06 snackbar fix (HIGH #3) is additive and the race is handled.** `src/stores/snackbar-store.ts:11-14` has a single `action` today and `src/components/Snackbar.tsx:25-37` renders exactly one Pressable — so the optional `secondaryAction` is genuinely required and additive. `quick-log-command.ts:92-97` hardcodes `channel:"unspecified"` with single-flight `pendingRef`, matching the plan; the Add-Note-after-Undo "missing" path is real because `readInteractionForEdit` (`interaction-edit-read.ts:58-73`) returns `null` for a deleted row keyed by `(interactionId, contactId)`.
- **Recency-spine invariant is respected everywhere.** `src/db/recency-dao.ts:268/310/413` — `recordTouchpoint`/`editTouchpointFull`/`deleteTouchpoint` each wrap `inWriteTransaction` behind the shared mutex; plans route writes through these wrappers, never bare `…Core`. Tone-nullable, Allow-AI-default-OFF, and three-channel scoping are all honored in 34-04's must_haves.
- **Wave/dependency ordering is sound.** Shared-file edits are ordered by `depends_on`: `DashboardStack.tsx` (34-04 W2 → 34-07 W3, `depends_on:["34-02","34-04"]`) and `UniversalFab.tsx` (34-04 W2 → 34-06 W3, `depends_on:["34-02","34-04"]`). 34-06 and 34-07 (both W3) share no files, so parallel execution is safe. Placeholders being replaced are confirmed real (`FabActionPlaceholders.tsx`: LogContact/UpdateContact/Memory registered in `DashboardStack.tsx:45/48-49/51`).

## 3. Concerns

### HIGH

- **[HIGH — 34-05] Edit Contact adds knowledge-subdomain sections with NO persistence path, on a false "nested drawer" premise (silent-non-persistence hazard = cycle-1 HIGH #4, unaddressed here).**
  - **Evidence (current code):** `EditContactScreen.tsx` renders only `FrequencyPicker` (711), `TriStateLastSpoke` (730), `ContactMethodsEditor` (739), `LinksEditor` (767, = external contact-links via `contact-links-dao`, NOT relationships), and `FieldValueInput` (902). It imports no `MemoryEditor`, no relationships editor, no current-state editor, no off-limits editor. `grep -ci "ThingsToRemember" EditContactScreen.tsx` → **0**; the "Things-to-Remember" subdomains live in a **separate screen** (`ThingsToRememberScreen`, route `ThingsToRemember: { contactId }` in `navigation/types.ts:65`, registered in `DashboardStack.tsx:54-55`), not in a nested drawer inside Edit Contact.
  - **Evidence (no persistence):** `src/db/contacts-dao.ts:276` `UpdateContactFullInput` has fields for name/interval/tracking/category/socialBattery/birthday/customValues/methodDrafts/firstInteraction — and **no** `memories`, `relationships`, `currentStateEntries`, or `offLimits`. Plan 34-05 `files_modified` touches only `edit-contact-logic.ts`, `EditContactScreen.tsx`, and their tests — **no DAO** — and its must_haves explicitly commit to persistence via "`updateContactFull` (metadata) then `applyLinkDiff` (links)" only. `applyLinkDiff` writes contact-links, not relationships/memories/current-state/fuel.
  - **Mechanism / impact:** 34-05's must_haves (plan lines ~1193) require Edit Contact to expose "Last Talked About, Key People/Relationships, Current Location, Memories, … Off Limits" as top-level editing sections, and the dossier §E ("expose the complete canonical editable record through direct-access top-level accordion sections") plus phase Success Criterion #2 back that intent. Executed literally, an editor is rendered for each subdomain with **no save wiring** → edits silently dropped on Save — the exact hazard cycle-1 HIGH #4 fixed for 34-03 (by extending `CreateContactFullInput` + composing `*Core` writers), which 34-05 does not replicate. The plan's own key_links list only the five editors that already persist via `updateContactFull`/`applyLinkDiff`, contradicting its must_haves' nine sections. There is also a genuine **scope ambiguity** the plan does not resolve: CAPT-04 says "the full Memory creation/editing experience lives in **Update Contact's** Memory editor" (34-07), so whether Edit Contact should fully edit Memories at all — versus view/deep-link — is an open product question, not a settled IA restructure.
  - **This is not a bug to close.** It needs either (a) the same persistence extension 34-03 got (extend `updateContactFull` or wire per-section `*Core` writers inside the Save path, with round-trip + rollback tests), or (b) an owner/planner decision that these subdomains stay in `ThingsToRememberScreen`/Update Contact and are NOT embedded in Edit Contact — in which case 34-05's must_haves and success criteria must be corrected. Flagging rather than silently narrowing, per CLAUDE.md.

### LOW

- **[LOW — 34-05] The acceptance gate `grep -ci "ThingsToRemember\|Things to Remember" EditContactScreen.tsx` "shows the nested-drawer grouping removed" is a no-op.** The string is already absent (0), so the gate passes without proving anything. It should be replaced by positive assertions that each required subdomain section exists AND round-trips (create→save→re-read), which is also what would surface the HIGH persistence gap. Evidence: `EditContactScreen.tsx` grep → 0 today.
- **[LOW — 34-02] Objective prose misstates a "current duplicate-label collision."** `src/db/memory-registry.ts:10-12/30/50` — today `general.displayName = "General"`, `custom.displayName = "Memory"`, `imported.displayName = "Imported from Contacts App"`: **no** collision exists now. The D-11 swap (general→"Memory", custom→"Custom") *prevents* the collision that renaming only `general` would create. The must_haves and the no-duplicate test are correct; only the objective's "remove the current duplicate-label collision" wording is inaccurate. Cosmetic.

## 4. Suggestions

- **34-05 (HIGH):** Before execution, resolve the scope question with the owner/planner: are Memories / Key People-Relationships / Last Talked About / Current Location / Off Limits *edited in place* inside Edit Contact, or do they remain in `ThingsToRememberScreen`/Update Contact? If edited in place, add the persistence explicitly — extend `UpdateContactFullInput` (contacts-dao.ts:276) with optional `memories`/`relationships`/`currentStateEntries`/`offLimits` arrays composed via `addMemoryCore`/`editMemory…`, `addRelationshipCore`, `setCurrentStateValueCore`, `addFuelCore` inside the Save path (mirroring 34-03's fix), add contacts-dao round-trip + rollback tests, and add the DAO + test to `files_modified` and the estimate. If NOT edited in place, correct the 34-05 must_haves/key_links/success-criteria to list only the subdomains Edit Contact actually owns and note the deep-link to ThingsToRemember/Update Contact. Either way, delete the false "removing the nested Things-to-Remember drawer" framing.
- **34-05 (LOW):** Replace the `grep -ci ThingsToRemember` acceptance criterion with a positive assertion: each required section renders as a top-level `AccordionSection` and a value entered in it round-trips after Save (this doubles as the persistence proof).
- **34-02 (LOW):** Reword the objective from "remove the current duplicate-label collision (today general shows 'General', custom shows 'Memory')" to "rename both so the general/custom pair does not collide once general becomes 'Memory'" — the parenthetical values are right, the word "collision" is not.
- **34-01 (note, no change required):** Task 4's plan to add restore-boundary value validation in `backup-schema.ts` is redundant with the validation already performed by `validateAppSettingsPatch` inside `updateAppSettingsCore` (the restore writer). Harmless defense-in-depth; keep or drop at the executor's discretion.

## 5. Risk Assessment

**MEDIUM.** Six of the seven plans are well-grounded, verified against source, and correctly incorporate every cycle-1 HIGH with the right mechanisms and non-regression gates; migration correctness, the shared-table invariants, the vocabulary-migration dependency, local-first/egress boundaries, Tone-nullability, and wave ordering all hold. The residual risk is concentrated in **34-05**, where an unaddressed silent-non-persistence gap (identical in class to cycle-1 HIGH #4) rides on a factually wrong premise and an unresolved product-scope ambiguity. It is contained to one plan and one screen and is fixable either by adding the persistence extension or by correcting scope — but as written it would either drop user edits on a shared table or ship a plan whose must_haves contradict the code and the DAO. That keeps overall risk at MEDIUM until 34-05 is reconciled.

LANE_COUNTS: high=1 actionable=2

---

## Next step

Incorporate this feedback into planning:

```
/gsd-plan-phase 34 --reviews
```
