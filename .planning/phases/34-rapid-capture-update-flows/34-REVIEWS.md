---
phase: 34
reviewers: [codex, claude]
reviewed_at: 2026-09-12T21:09:51Z
plans_reviewed: [34-01-PLAN.md, 34-02-PLAN.md, 34-03-PLAN.md, 34-04-PLAN.md, 34-05-PLAN.md, 34-06-PLAN.md, 34-07-PLAN.md]
models:
  codex: "gpt-5.6-terra (reasoning=low)"
  claude: "claude (read-only subagent workaround)"
model_sources:
  codex: "banner"
  claude: "subagent-workaround"
cycle_summary:
  cycle: 1
  current_high: 4
  current_actionable: 8
notes:
  - "The claude lane ran as a READ-ONLY Claude subagent, not `claude -p` — the documented workaround for this repo's `claude -p` Write-permission gap. The lane was NOT dropped."
  - "Both lanes were source-grounded (file:line evidence). The orchestrator independently re-verified every codex HIGH against the code on disk."
---

# Cross-AI Plan Review — Phase 34: Rapid Capture & Update Flows

Two independent reviewers (Codex, Claude) reviewed all 7 plans against the code on disk. Both cited `file:line` evidence; neither reviewed the plan text in isolation. The orchestrator re-verified each codex HIGH against disk before writing this consensus (migration head, backup key casing, snackbar action shape, TouchpointRefineForm channel options — all confirmed).

## Consensus Summary

This is a disciplined, decision-aware plan set. Both reviewers independently confirmed: **no recorded-decision reversal** (no ADR/HANDOFF/migration-006 reversal); migration numbering is correct on disk (head = `026` / `GROUP_EVENTS_SCHEMA_VERSION = 26`, so Plan 01's additive `027` is right, not assumed); the CAPT-15 "no second `interactions` migration" stance is well-founded (migration 025 already remapped the vocabulary with NULL-preserving `ELSE` arms); and the privacy invariants (Allow AI default OFF, note-egress exclusion, Tone-never-Neutral) are grounded in real code. The recency single-writer spine and wave/dependency ordering are sound.

The material risk is a small cluster of implementation mismatches where a plan asserts UI behavior its listed files/APIs cannot deliver as written. The strongest, shared by both reviewers, is the **channel chooser (CAPT-08)**: the plan composes `TouchpointRefineForm` unchanged, which renders five channel options, so "exactly Message/Call/In Person" is unmet — and the naive global fix would regress Phase 32's legacy-row editing on that shared component. Codex additionally caught a verified backup-wire key-casing bug in Plan 01 that Claude did not flag.

Overall risk: **MEDIUM–HIGH**. Codex rated HIGH (three implementation mismatches would produce an unmet requirement or wrong portability behavior); Claude rated MEDIUM (one HIGH plus two MEDIUM, all fixable with scoped edits, none reversing a decision). All findings are addressable in a replan; none are owner-escalation decision reversals.

### Agreed Strengths (2+ reviewers)

- **Double-migration trap avoided and verified.** Plans 01/02 refuse a second `interactions` migration for CAPT-15 because migration 025 (`src/db/migrations/025-interaction-history-schema.ts:50-64`) already remapped quality and channel values with NULL/legacy-preserving `ELSE` arms. (codex, claude)
- **Migration numbering verified against disk, not assumed** — head `026` → additive `027`, DDL gated behind an owner checkpoint (`src/db/database.ts:67`, `src/db/migrations/026-group-events-schema.ts:12`). (codex, claude)
- **Privacy/AI-egress invariants grounded in real code** — Allow AI defaults OFF (`coerceAllowAi`), note prose never selected into AI context (`ai-context-read.ts`), Tone null-not-Neutral preserved. (codex, claude)
- **Single-writer recency spine respected** — plans route through `recordTouchpoint`/`editTouchpointFull` (`src/db/recency-dao.ts`) and add grep acceptance criteria blocking bare `…Core` calls from screens. (codex, claude)
- **D-11 Memory-label collision correctly diagnosed** — `memory-registry.ts` resolves general → "General" and custom → "Memory"; Plan 02's relabel is well-targeted. (codex, claude)

### Agreed Concerns (2+ reviewers — highest priority)

- **HIGH — Channel chooser cannot be "exactly Message/Call/In Person" as planned (34-04 / Plan 04).** `TouchpointRefineForm` `CHANNEL_OPTIONS` (`src/components/TouchpointRefineForm.tsx:76-82`) has **five** entries (adds `other`/`unspecified`); the only reuse knob is field-level `visibleFields` (`:99/:103`), not an option filter, and no plan task adds one. Composing it as-is renders five chips, violating CAPT-08. The naive fix (editing `CHANNEL_OPTIONS`) is shared with the Phase 32 Edit-Interaction surface, which must keep `other`/`unspecified` representable so legacy rows are never silently rewritten — a global edit regresses legacy editing. **Fix:** add a scoped `channelOptions`/`allowedChannels` prop defaulting to all five, narrowed to the three canonical values only on the ordinary-log surface, with an acceptance criterion asserting both surfaces. (codex HIGH, claude HIGH)

- **HIGH/MEDIUM — Quick Log post-log editor + Undo/Add-Note contract (34-06 / Plan 06).** Two related problems: (1) **[codex HIGH]** `QuickLogSnackbar` has exactly one `action` (`src/services/quick-log-command.ts:19`; `src/components/Snackbar.tsx:25-37`), so it cannot present both Undo and Add Note without a snackbar store/type/component redesign not in Plan 06's files — replacing Undo with Add Note violates CAPT-05. (2) **[claude MEDIUM]** if Undo (which deletes the interaction via `undoController.undo`) and Add Note both bind the same `interactionId`, the Note branch can `editTouchpointFull` a deleted row; and **[codex MEDIUM]** the post-log editor has no save guard of its own (`runQuickLog`'s single-flight only protects the initial write). **Fix:** redesign the snackbar to carry two actions (or an approved alt presentation preserving both), define Undo/Add-Note mutual exclusion (opening the editor consumes/commits Undo), add a post-log save guard, and test double-tap / retry / Add-Note-after-Undo.

- **HIGH/MEDIUM — Add Contact Show More scope & persistence (34-03 / Plan 03).** **[codex HIGH]** Plan 03 promises advanced enrichment sections (Memory, relationship, Off Limits, current-state) but its files omit the required DAOs/logic and do not state whether those records persist atomically after contact creation (`src/screens/create-contact-logic.ts:96` has no such write inputs) — risking editable controls that silently do not save. **[claude MEDIUM]** Task 3 also concentrates Contact Methods + six enrichment sections + CAPT-14 validation reveal-and-focus into one low-confidence `auto` task. **Fix:** define concrete persistence semantics for every Show-More field (or make them intentional post-create additions), and split the validation-focus contract from the enrichment composition.

- **LOW — CAPT-15 straggler grep is too broad / hand-scoped to be a reliable acceptance gate (34-02 / Plan 02).** The repo legitimately holds legacy values in migration/remap code and fixtures; the fixed-literal grep would miss a straggler expressed via a constant alias. **Fix:** make the allowlist machine-checkable and add a value round-trip regression test rather than relying on an informal scan. (codex LOW, claude LOW)

### Divergent Views (worth investigating)

- **Plan 01 backup-wire key casing — codex HIGH, Claude did not flag.** Codex found (and the orchestrator re-verified on disk) that Plan 01 lists the new backup keys as snake_case: `34-01-PLAN.md:48` "PORTABLE_SETTINGS_KEYS additions (declare-only): default_interaction_channel, remembered_interaction_channel". But `PORTABLE_SETTINGS_KEYS` holds **camelCase** manifest keys (`src/backup/backup-schema.ts:174/191/192` — `dashboardRightSwipeAction`, `historyLens`, `historyCycleCount`) and restore casts manifest keys into `AppSettingsPatch` (camelCase, via `COLUMN_OF`). Adding snake_case keys would accept payload fields that never restore. Claude confirmed the declare-only precedent is real but did not check the specific key strings. **Codex is correct; this is a real HIGH.** Fix: use `defaultInteractionChannel`/`rememberedInteractionChannel` in `PORTABLE_SETTINGS_KEYS` and validate both at the backup boundary. (Plan text at line 46 correctly lists the snake_case *columns*; the defect is only in the line-48 *wire-key* list.)

- **Plan 03 severity — codex HIGH (silent non-persistence) vs claude MEDIUM (delivery concentration).** Same task, different framing; treat the persistence-design gap as the load-bearing (higher) concern.

- **Codex-only MEDIUMs Claude did not raise:** remembered-channel write is non-atomic with the interaction write (`updateAppSettings` opens its own `inWriteTransaction` — `src/db/app-settings-dao.ts:1068` — so a settings-write failure after a saved interaction leaves the remembered value stale; 34-04); and Memory full-edit route is underspecified (the `Memory` route carries only `contactId`, no `memoryId`/return signal — `src/navigation/types.ts:59`; 34-07). Both are grounded and worth folding into the replan.

- **Codex-only MEDIUM:** Plan 03 must *explicitly* flip the create screen's current defaults (Monthly interval + Bound — `CreateContactScreen.tsx:89/93`) to no-cadence/Unbound as a concrete assertion, not just prose.

- **Claude-only LOW:** 34-05's "single write path" wording overstates it — `EditContactScreen.tsx:415` documents a deliberate two-transaction boundary; reword to "single Save button; existing two-transaction boundary retained."

## Full Reviews

### Codex Review

# Plan Review — Phase 34

## Summary

The plans have strong decision-awareness: they preserve the existing interaction migration, keep Allow AI default-off, retain ADR-016's tri-state creation rule, and build on the recency DAO rather than issuing direct writes. However, several plans currently cannot deliver their stated UI behavior with their listed files/APIs. The highest-risk gaps are backup-wire key naming, the single-action snackbar preventing "Undo + Add Note," and the detailed-log form exposing legacy channels despite the requirement's exact three-channel chooser.

## Strengths

- Migration head/order is correctly grounded: the actual registered head is v26 (`migration026` is last and `TARGET_VERSION` points to its version) in `src/db/database.ts:63` and `:69`. Plan 01 appropriately proposes additive v27 rather than editing migration 025/026.
- The no-second-interaction-migration boundary is correct. Migration 025 already adds `duration`/`allow_ai` and remaps quality/channel values; Plan 02's verification-only approach avoids an irreversible duplicate data migration.
- The recency-spine intent is sound. Actual interaction writes are centralized in `src/db/recency-dao.ts:236/343/401`. Plans 04 and 06 explicitly avoid bare `…Core` calls from screens.
- Plan 03 correctly preserves the critical "Not yet means no interaction row" behavior: `src/screens/create-contact-logic.ts:76` returns `null`, and `:119` only supplies `firstInteraction` when non-null.
- Plan 02 correctly identifies the current Memory-label collision: general resolves through `"General"` while custom resolves through `"Memory"` in `src/db/memory-registry.ts:10/28/49`.

## Concerns

- **HIGH — Plan 01 uses the wrong backup-wire keys.** `PORTABLE_SETTINGS_KEYS` contains camelCase backup manifest fields, e.g. `dashboardRightSwipeAction`, `historyLens`, `historyCycleCount`, not SQLite column names (`src/backup/backup-schema.ts:133`). Restore casts manifest keys into `AppSettingsPatch` (`src/backup/restore-apply.ts:327`). Adding `default_interaction_channel`/`remembered_interaction_channel` would accept payload fields that `updateAppSettingsCore` cannot map through `COLUMN_OF`; it would not restore the intended preference. Use `defaultInteractionChannel`/`rememberedInteractionChannel` and validate them at the backup boundary.
- **HIGH — Plan 06 cannot offer both Undo and Add Note with the current snackbar contract.** `QuickLogSnackbar` has exactly one `action` (`src/services/quick-log-command.ts:16`), and the renderer has exactly one `Pressable` action (`src/components/Snackbar.tsx:28`). Replacing Undo with Add Note violates CAPT-05; adding "alongside" needs a snackbar store/type/component redesign, none of which is in Plan 06's files.
- **HIGH — Plan 04 cannot make the channel chooser "exactly Message/Call/In Person" by composing `TouchpointRefineForm` as-is.** The existing component deliberately displays five choices, including `other` and `unspecified` (`src/components/TouchpointRefineForm.tsx:76`). `visibleFields` only controls which fields appear, not which channel options appear (`:99`). Plan 04 does not modify that component or add an option-filter prop. A new ordinary interaction must be restricted to three choices while existing legacy interactions remain representable in Edit Interaction.
- **HIGH — Plan 03 promises advanced knowledge creation without a persistence design or sufficient scope.** The existing create input supports contact metadata, methods, custom values, and an optional first interaction (`src/screens/create-contact-logic.ts:96`); it has no Memory, relationship, Off Limits, or current-state write inputs. Plan 03 says Show More will compose those editors, but its files omit the required DAOs/logic and do not say whether those records are created atomically after the contact is created. This risks presenting editable controls that silently do not persist.
- **MEDIUM — Plan 03 must explicitly change the current default cadence.** The actual create screen initializes a Monthly interval and Bound state (`src/screens/CreateContactScreen.tsx:89/93`). That does not meet the intended no-cadence/Unbound initial path unless the plan deliberately changes both defaults.
- **MEDIUM — Plan 04's remembered-channel write is non-atomic with the interaction write.** It proposes `recordTouchpoint`/`editTouchpointFull`, then `updateAppSettings`. Both wrappers open independent transactions; `updateAppSettings` uses `inWriteTransaction` (`src/db/app-settings-dao.ts:1068`). If the interaction succeeds but settings write fails, the interaction is saved but Remember Last Choice is stale. Define recovery behavior and test this partial-success case.
- **MEDIUM — Plan 06's "re-opening after a save does not duplicate" claim is not supported by the listed design.** `runQuickLog`'s existing single-flight reference only protects the initial Quick Log write (`src/services/quick-log-command.ts:81`); it does not protect a post-log editor save. The new editor needs its own saving/commit guard and a defined close/reopen state after either branch commits.
- **MEDIUM — Plan 07's full Memory editing route is underspecified.** The `Memory` route only carries `contactId` (`src/navigation/types.ts:59`); it carries no `memoryId` or return-session signal. Plan 07 needs to state and test how an existing Memory is selected, edited in place, and returns to the originating Update Contact chooser.
- **LOW — Plan 02's grep audit is too broad to be a reliable acceptance condition.** The repository legitimately contains legacy values in migration/remap code and test fixtures. Make the exact allowlist machine-checkable and separately test behavior of the real readers/writers, rather than relying on an informal "straggler" scan.

## Suggestions

- Amend Plan 01 to add camelCase wire keys to `PORTABLE_SETTINGS_KEYS`, add backup-schema validation for both values, and ensure `AppSettingsPatch` accepts exactly those camelCase keys.
- Split Plan 06 into a prerequisite snackbar capability task: support two semantic actions or a product-approved alternate presentation that preserves Undo and Add Note simultaneously. Update the snackbar store, public type, renderer, accessibility ordering, and all existing callers.
- Amend Plan 04 with a `TouchpointRefineForm` API such as `channelOptions` or `allowLegacyChannels`. Ordinary Log Interaction passes only the three canonical options; Edit Interaction retains legacy display options for existing rows.
- Amend Plan 03 with a concrete persistence strategy for every Show More field: either make those fields intentionally post-create additions, or extend the create transaction/DAO contract with all necessary durable writes and tests. Do not render advanced controls before deciding their save semantics.
- Add an integration test for interaction-success/settings-failure in Plan 04.
- Add a separate post-log save gate and tests for double-tap, retry after failure, and closing/reopening the editor after a successful Note or Memory save.

## Risk Assessment

**HIGH.** The plans respect the key data and privacy invariants, but three implementation mismatches would otherwise produce either an unmet requirement or incorrect portability behavior: the backup key mismatch, the one-action snackbar limitation, and the unfiltered legacy channel UI. These should be resolved before execution; the remaining risks are manageable with clearer persistence and failure-state contracts.

---

### Claude Review

# Cross-AI Peer Review — Phase 34 "Rapid Capture & Update Flows" (7 plans)

Reviewer: independent Claude peer review (ran as a read-only subagent — the documented workaround for this repo's `claude -p` Write-permission gap). Method: read all 7 PLAN.md files, then verified every load-bearing claim against the code on disk (migrations, DAOs, shared components, ADR triggers), not just the plan text.

## 1. Summary

This is an unusually disciplined plan set. It composes existing, shipped primitives rather than rebuilding them; splits correctness logic into react-native-free node-tested modules; and shows strong recorded-decision hygiene — most notably refusing to author a second `interactions` migration for CAPT-15 because Phase 32's migration 025 already did the vocabulary remap (verified on disk, including the NULL-quality-preserving `ELSE quality` arm). Migration numbering (head+1 = 027) is correct against disk (`TARGET_VERSION = GROUP_EVENTS_SCHEMA_VERSION = 26`). Privacy invariants (Allow AI default OFF, note-egress exclusion, Group-Note AI ban, Tone-never-Neutral) are all grounded in real code. Wave/dependency ordering is sound and shared-file edits are correctly serialized. The one material defect: Plan 34-04 asserts CAPT-08's "Channel chooser offers exactly Message/Call/In Person" as a must-have truth, but composes `TouchpointRefineForm` — whose `CHANNEL_OPTIONS` renders five options (adds `other`/`unspecified`) with no option-level filtering prop — and provides no task to restrict them, on a shared component where the naive fix would regress Phase 32's legacy-row editing. No recorded-decision reversal was found.

## 2. Strengths

- **Double-migration trap explicitly avoided and verified.** Plans 34-01 and 34-02 refuse to author a second `interactions` migration for CAPT-15. Migration 025 (`src/db/migrations/025-interaction-history-schema.ts:50-64`) already remaps `quality` good/fine/hard → Positive/Neutral/Negative and channel text/email/call/in-person → Message/Call/In Person, with `ELSE quality`/`ELSE channel` preserving NULL and legacy `other`/`unspecified`.
- **Migration numbering verified, not assumed.** `src/db/database.ts:67` sets `TARGET_VERSION = GROUP_EVENTS_SCHEMA_VERSION`, and `src/db/migrations/026-group-events-schema.ts:12` sets that to `26`. Head+1 = 027 as Plan 01 claims; Plan 01 gates the irreversible DDL behind a blocking owner checkpoint.
- **Privacy/AI-egress invariants grounded in real code.** `coerceAllowAi` (`src/components/touchpoint-refine-logic.ts:176-178`) returns 1 only for explicit `1`/`true`, else 0. `ai-context-read.ts:103-118, 281` selects only channel/quality/connected/occurred_at and "no prose selected."
- **Tone-never-Neutral is enforceable.** `TouchpointRefineForm.tsx:55, 88` keeps `quality: string|null` with null = unset; migration 025 preserves NULL.
- **Single-writer recency spine respected.** `recordTouchpoint`/`editTouchpointFull` are mutexed wrappers (`src/db/recency-dao.ts:268, 310`) over `…Core`; Plan 04 adds a grep acceptance criterion blocking bare-core calls. Quick Log's `pendingRef` single-flight and `channel:"unspecified"` are real (`src/services/quick-log-command.ts:31, 82-84`).
- **ADR-062 Bound/Unbound preserved with the actual guard.** `src/db/migrations/011-contact-lifecycle-schema.ts:37` = `CHECK (tracking_enabled = 0 OR interval_days IS NOT NULL)` plus the `contacts_prevent_cadence_clear` trigger (line 181). Plan 03 forbids modeling Unbound as `interval_days = null`.
- **DAO extension follows a real, correctly-cited analog.** Every `dashboardRightSwipeAction` touchpoint Plan 01 cites is accurate in `src/db/app-settings-dao.ts`. Backup declare-only precedent is real (`src/backup/backup-schema.ts:133` Set, 221 restore guard).
- **Correct dependency/wave ordering.** AccordionSection is genuinely absent on disk (34-03 creates it; 34-05 wave-2 depends on 34-03). Shared-file edits are serialized (`UniversalFab.tsx`, `DashboardStack.tsx`).
- **D-11 label collision is real and correctly diagnosed.** `src/db/memory-registry.ts:30` (general → "General") and `:50` (custom → "Memory") collide with the user-facing "Memory" concept; Plan 02's swap to "Memory"/"Custom" is well-targeted.

## 3. Concerns

- **HIGH — CAPT-08 "exactly Message/Call/In Person" is unmet as planned, on a shared component (34-04).** `src/components/TouchpointRefineForm.tsx:76-82` defines `CHANNEL_OPTIONS` with five entries; the only reuse knob is `visibleFields` — a field-level allow-list (`:103`), not an option-level one. The new Log Interaction form will render five channel chips, violating CAPT-08. The naive fix (editing `CHANNEL_OPTIONS`) is shared with the Phase 32 HIST Edit Interaction surface, which must keep `other`/`unspecified` representable — a global edit regresses legacy-row editing. The fix must be a scoped prop that defaults to all five and narrows to three only on the ordinary-log surface.
- **MEDIUM — "Add Note" vs "Undo" on the same Quick Log snackbar can bind the post-log editor to a deleted interaction (34-06).** Undo deletes the just-written interaction (`quick-log-command.ts:55, 70`); a new Add Note action bound to the same `interactionId` would then `editTouchpointFull` a deleted row. Plan 06 does not specify mutual exclusion or dismissal ordering. Opening the editor should consume/commit the Undo; the Note branch should handle a missing interaction gracefully.
- **MEDIUM — Plan 03 Task 3 concentrates a lot of net-new IA in one non-tracer task.** Contact Methods + six Show-More enrichment sections + CAPT-14 validation reveal-and-focus, all as one `type="auto"` low-confidence task. Split the validation-focus contract from enrichment composition.
- **LOW — 34-05's "updateContactFull is the single write path" is slightly overstated.** `EditContactScreen.tsx:415-420` carries a documented "TWO-TRANSACTION BOUNDARY (by design)." True at the button level, not the transaction level.
- **LOW — CAPT-15 straggler detection rests on an executor-run grep whose scope is hand-specified (34-02).** Reasonable but would miss a straggler expressed via a constant alias. Consider a value round-trip test in addition to the grep.
- **LOW — 34-06's depends_on 34-04 is a file-serialization dependency, not a code dependency.** Fine conservative choice (avoids a merge conflict on `UniversalFab.tsx`) but mildly over-serializes wave 3; noting it so it is not mistaken for functional coupling.

## 4. Suggestions

- **34-04:** Add a task to introduce a scoped channel-option allow-list to `TouchpointRefineForm` (optional `channelOptions`/`allowedChannels` defaulting to the current five), passing the three canonical values from `LogInteractionScreen`. Add an acceptance criterion asserting the ordinary-log chooser renders exactly three while HIST edit still renders five for a legacy row.
- **34-06:** Specify Undo/Add-Note interaction ordering — opening the post-log editor finalizes (consumes) the Undo; the Note branch no-ops or surfaces a friendly error if the interaction no longer exists. Add a test for "Add Note after Undo."
- **34-03:** Split Task 3 into (a) Contact Methods + Show-More enrichment composition and (b) the CAPT-14 validation reveal-and-focus contract.
- **34-04:** For CAPT-10's "initialized from Phase 36's new-items-only type default" — since Phase 36 is unbuilt, keep the hardcoded OFF default but leave an explicit resolver seam the future type-default can feed; note as a forward reference in the SUMMARY, not shipped behavior.
- **34-05:** Reword the "single write path" claim to "single Save button; existing two-transaction boundary retained."
- **34-02:** Supplement the grep audit with a value round-trip regression test so CAPT-15 integrity is asserted by code.

## 5. Risk Assessment

**Overall: MEDIUM.** The plans are well-grounded, decision-safe (no ADR/HANDOFF reversal; double-migration and cadence-clear hazards explicitly respected and verified on disk), and correctly ordered. The privacy-critical surface (34-04) gets Allow-AI-OFF and note-egress right. The risk that keeps this above LOW is the single HIGH (CAPT-08 asserted but not deliverable as written, plus the shared-component regression hazard) and two MEDIUM edge/error-handling gaps. All are fixable with scoped edits; none require reversing a recorded decision.

---

## Next step

Incorporate this feedback into planning:

```
/gsd-plan-phase 34 --reviews
```
