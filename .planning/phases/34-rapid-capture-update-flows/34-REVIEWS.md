---
phase: 34
reviewers: [codex, claude]
reviewed_at: 2026-09-12T23:23:55Z
plans_reviewed: [34-01-PLAN.md, 34-02-PLAN.md, 34-03-PLAN.md, 34-04-PLAN.md, 34-05-PLAN.md, 34-06-PLAN.md, 34-07-PLAN.md, 34-08-PLAN.md]
models:
  codex: "gpt-5.6-terra (reasoning=low)"
  claude: "claude (read-only subagent workaround)"
model_sources:
  codex: "banner"
  claude: "subagent-workaround"
cycle_summary:
  cycle: 3
  current_high: 0
  current_actionable: 6
notes:
  - "CYCLE 3 (FINAL) of the convergence loop. Re-reviewed the CURRENT 8 plans on disk after commit 10ae78c split the cycle-2 34-05 HIGH into 34-05 (DAO/persistence foundation) + new 34-08 (accordion IA) and incorporated 5 cycle-2 non-HIGH findings. Counts below are only concerns that REMAIN UNRESOLVED now; cycle-1/cycle-2 findings the revised plans incorporated/deferred are NOT re-counted."
  - "BOTH lanes report ZERO unresolved HIGH. The cycle-2 HIGH (34-05 edit-path silent-non-persistence) is FULLY RESOLVED and re-verified on disk: the ten composed *Core writers (addMemoryCore/editMemoryCore/deleteMemoryCore, addRelationshipCore/editRelationshipCore/deleteRelationshipCore, addFuelCore/editFuelCore/deleteFuelCore, setCurrentStateValueCore) all exist as `export async function ...Core(exec, ...)`, are exec-scoped (open no transaction — fuel-dao header states they 'assume a BEGIN is already open'), and compose inside updateContactFull's single inWriteTransaction (contacts-dao.ts:418). Cited line numbers accurate."
  - "The claude lane ran as a READ-ONLY Claude subagent, not `claude -p` — the documented workaround for this repo's `claude -p` Write-permission gap. The lane was NOT dropped."
  - "The orchestrator independently re-verified every load-bearing claim on disk: the ten *Core writer signatures + line numbers; migration head = 26 (GROUP_EVENTS_SCHEMA_VERSION), 34-05/34-08 author no migration; the EditContactScreen two-transaction boundary (updateContactFull:420 then applyLinkDiff:469, comment at :415) 34-08 retains; setCurrentStateValueCore's demote-prior-current + insert-new-current history-preserving semantics; getContactForEdit's return shape; the data_revision bump conditionals; and all 5 cycle-2 non-HIGH incorporations."
  - "All 5 cycle-2 non-HIGH findings are confirmed incorporated in the current plans: 34-04 moreOptionsFields disclosure (truth + grep gates), 34-07 create-path AI=registry-default-OFF (truth + prohibition + T-34-24), 34-03/34-05 AccordionSection validation interface + resolveErrorSection, 34-01 restore round-trip test moved to restore-apply.test.ts, 34-02 objective reworded."
  - "current_actionable=6 are all NEW cycle-3 implementation-precision MEDIUM/LOW items (element-shape/diff-ownership wording, a read-seeding gap, a test-mechanics nit, and a data_revision bump gap). None is a decision reversal; none blocks execution — all are catchable by the round-trip tests the plans already mandate."
  - "DIVERGENCE adjudicated on disk: codex flags a real data_revision bump GAP for knowledge-only edits; the claude lane concluded the existing single bump covers them. The orchestrator verified codex is correct — updateContactFull self-bumps ONLY when methodSaveResult===null (contacts-dao.ts:516) and applyContactMethodDiffCore bumps ONLY when methods `changed` (contact-methods-dao.ts:277), so a save that supplies method drafts with unchanged methods but a changed knowledge subdomain bumps nowhere. Counted as one actionable."
---

# Cross-AI Plan Review — Phase 34: Rapid Capture & Update Flows (Cycle 3, FINAL)

Two independent reviewers (Codex `gpt-5.6-terra` reasoning=low, Claude read-only subagent) re-reviewed all 8 CURRENT plans against the code on disk after the cycle-2 replan (commit 10ae78c). Both cited `file:line` evidence. The orchestrator re-verified every load-bearing claim on disk before writing this consensus.

## Consensus Summary

**The convergence loop has converged. Both reviewers independently report ZERO unresolved HIGH concerns, and the orchestrator re-verified the cycle-2 HIGH is fully resolved.** The cycle-2 blocker — 34-05 exposing knowledge-subdomain sections with no persistence path — was correctly split into 34-05 (the DAO/persistence foundation) and 34-08 (the accordion-screen IA). 34-05's core composition claim is real and safe on disk: `updateContactFull` owns exactly one write transaction (`contacts-dao.ts:418`), and the ten `*Core` writers it composes — `addMemoryCore`/`editMemoryCore`/`deleteMemoryCore` (`memories-dao.ts:94/151/239`), `addRelationshipCore`/`editRelationshipCore`/`deleteRelationshipCore` (`relationships-dao.ts:68/97/146`), `addFuelCore`/`editFuelCore`/`deleteFuelCore` (`fuel-dao.ts:131/165/228`, `FuelKind` includes `off_limits` at :43), and `setCurrentStateValueCore` (`current-state-history-dao.ts:55`) — all exist as exec-scoped functions that open no transaction of their own (the mutex is non-reentrant; the wrappers are the ones that open transactions), so they are correctly composable inside the single metadata transaction. Migration numbering is correct (disk head = 026; 34-01 ships 027; 34-05/34-08 author none). The privacy posture holds (Allow-AI OFF, registry `aiDefault=false` on create, no read-path network, Group-Note ban). All 5 cycle-2 non-HIGH findings are incorporated. The owner-ratified five-subdomain §E scope is respected by both lanes and is NOT flagged.

**Residual risk is a small set of implementation-precision refinements, none blocking.** The remaining findings concern wording of the create-path enrichment element shape (contactId/timestamp injection), the edit-path collection-diff ownership boundary, a not-yet-named set of knowledge-section seed reads in 34-08, a fragile awk-based static guard in 34-05, and a genuine (but non-blocking) `data_revision` bump gap for knowledge-only edits. All are catchable by the round-trip tests the plans already mandate.

**Overall risk: LOW.** No decision reversal against CLAUDE.md, any ADR, or migration 006/ADR-001 is present. Dependency ordering across the three waves is sound (34-01→34-04; 34-03→34-05→34-08; 34-02/34-04→34-06/34-07; shared writers on `DashboardStack.tsx`/`UniversalFab.tsx`/`contacts-dao.ts` correctly sequenced across waves with no intra-wave file collisions).

### Agreed Strengths (2+ reviewers, file:line verified)

- **34-05's `*Core` composition is real, exec-scoped, and safe.** All ten writers exist and open no transaction; `updateContactFull`'s single `inWriteTransaction` (`contacts-dao.ts:418`) already composes `updateContactMetadataCore` + custom-value upserts + conditional `recomputeLastContactCore` (:502) + `applyContactMethodDiffCore` (:504-515) — the exact analog the knowledge writers extend. Composing the `*Core` variants (never the mutexed wrappers) is correct and necessary. (codex, claude, orchestrator-verified)
- **Migration correctness.** `GROUP_EVENTS_SCHEMA_VERSION = 26` (`026-group-events-schema.ts:12`) = `TARGET_VERSION` (`database.ts:67`); no 027 file exists yet; 34-01's head+1 = 027 is right; 34-05/34-08 author no migration and correctly assert every target table already exists. (codex, claude)
- **The cycle-2 HIGH is genuinely resolved.** `updateContactFull` (`contacts-dao.ts:385-519`) has no knowledge-subdomain writers today, so extending `UpdateContactFullInput` + composing the cores is the correct minimal fix; the no-op `grep -ci ThingsToRemember` gate is replaced by positive per-subdomain round-trip + forced-rollback assertions. (codex, claude)
- **34-05's on-disk scope correction is accurate.** `LinksEditor`/`applyLinkDiff` is external URL links (the deliberate second transaction at `EditContactScreen.tsx:415`, retained by 34-08), and `TriStateLastSpoke` is the first-interaction control — neither is a knowledge subdomain; `last_talked_about`/`current_location` are the two `CURRENT_STATE_FIELD_KEYS` (`memory-registry.ts:67-70`). (claude, orchestrator-verified)
- **34-04 scoped `channelOptions` + `moreOptionsFields` are the right non-regressing design.** `CHANNEL_OPTIONS` is module-internal (`TouchpointRefineForm.tsx:76`), `visibleFields` is field-level not option-level (:103/:147), and Duration renders inline whenever `fields.has("duration")` (:360) with no disclosure — so the additive props (defaulting to five options / empty disclosure) close the gap without regressing the five existing consumers. (codex, claude)
- **Privacy posture verified.** `addMemoryCore` derives `allow_ai` from `MEMORY_TYPE_REGISTRY[type].aiDefault` (`memories-dao.ts` ~:94/:126), which is `false` for general/custom/imported — so 34-07's "registry-default-OFF on create, edit-only Allow-AI control" is exactly true; `ai-context-read` never selects note prose; no plan widens egress. (codex, claude)

### Agreed Concerns (2+ reviewers — highest priority)

- **MEDIUM — `data_revision` bump for the composed knowledge writes (34-03 create, 34-05 edit).** Both lanes examined this; they reached opposite conclusions and the orchestrator adjudicated on disk in codex's favor (see Divergent Views). The composed knowledge `*Core` writers do not bump `data_revision`; `updateContactFull` self-bumps only when `methodSaveResult === null` (`contacts-dao.ts:516`) and `applyContactMethodDiffCore` bumps only when methods `changed` (`contact-methods-dao.ts:277`). A save that supplies method drafts (both create and edit screens do) with unchanged methods but a changed knowledge subdomain therefore bumps nowhere. **Fix:** 34-03 and 34-05 should state that the aggregate transaction owner bumps `data_revision` exactly once whenever metadata, methods, OR any knowledge subdomain changed, with a DAO test for a knowledge-only save that supplies unchanged method drafts.

### Divergent Views (worth investigating)

- **`data_revision` bump — codex (real gap, MEDIUM) vs claude (covered as-is, clarify-only LOW).** Codex: the composed knowledge writes can commit without advancing backup-freshness state because both bump sites are conditional. Claude: "`updateContactFull` already bumps exactly once per call … otherwise inside `applyContactMethodDiffCore` … so the composed knowledge writes ARE covered." **Orchestrator adjudication (verified on disk):** codex is correct. `applyContactMethodDiffCore` does NOT always bump when it runs — line 277 gates the bump on `changed`. So when method drafts are supplied but methods are unchanged, neither `updateContactFull` (:516 requires `methodSaveResult === null`) nor `applyContactMethodDiffCore` (:277 requires `changed`) bumps, and the knowledge cores never bump — a knowledge-only edit leaves `data_revision` unchanged. Counted once as an actionable MEDIUM against 34-03/34-05.

## Current Actionable Non-HIGH Concerns (6, all NEW cycle-3)

1. **MEDIUM — 34-03 create-path enrichment element shape vs `contactId`/timestamp injection.** 34-03 says the new `CreateContactFullInput` enrichment arrays "match the corresponding `*Core` writer inputs," but those inputs require `contactId` (and memories require `createdAt`/`now`) which do not exist until `createContactFullCore` inserts the contact. **Fix:** state that create-time enrichment elements OMIT `contactId` (and memory `createdAt`/`now`), which `createContactFullCore` injects post-insert; only semantic fields come from the form. (claude)
2. **MEDIUM — 34-07 Task 3 lists `TriStateLastSpoke` as the Last-Talked-About editor.** `34-07-PLAN.md:180` names "TriStateLastSpoke/Last-Talked-About" as a focused editor, but that control is the first-interaction date control (the exact confusion 34-05 corrected). **Fix:** amend 34-07 Task 3 so the Last Talked About and Current Location rows use `getCurrentStateValue`/`setCurrentStateValue` on `last_talked_about`/`current_location`, with a regression proving no interaction row is written. (codex)
3. **MEDIUM — 34-08 knowledge-section seed reads / partial-reseed path not fully named.** `getContactForEdit` returns only metadata/custom-values/links/methods (`contact-read.ts:158-211`); `EditContactScreen` loads only via it (:230, :362). 34-08 Task 2 names only the current-state read. **Fix:** name `listMemoriesForContact`, the relationships read, and the fuel read as seeds for the memories/relationships/off-limits sections, and include them in both the initial load and the links-failure partial reseed, with an edit/delete diff-correctness test. (Reinforcing: 34-08 claims the editors are "the same set ThingsToRememberScreen composes," but that screen composes MemoryEditor/RelationshipEditor/current-state — NOT FuelEditor; Off Limits needs its own read + editor identification.) (codex, orchestrator-verified)
4. **LOW — 34-05 collection-diff ownership ambiguous.** Task 1 allows the `memories` payload to be "a seeded-vs-current diff shape, **or** `{add,edit,delete}` lists," while Task 3 has `buildEditInput` produce the diffs — the cross-task interface is unpinned. **Fix:** pin one contract (logic computes `{add,edit,delete}` with a row-identity key; DAO applies), removing the "or." (claude)
5. **LOW — 34-05 Task 1 `inWriteTransaction`-count static guard is fragile.** The `awk '/updateContactFull/,/^}/' … | grep -c inWriteTransaction` == 1 guard assumes the awk range cleanly spans the function, but "updateContactFull" appears in comments (:5-7, ~:256-262), so the range can mis-start/stop. **Fix:** scope to an explicit line range or a dedicated `contacts-dao.test.ts` assertion; keep the forced-rollback round-trip as the authoritative proof. (claude)
6. **MEDIUM — `data_revision` bump gap (34-03/34-05).** See Agreed Concerns + Divergent Views. **Fix:** the aggregate transaction owner bumps `data_revision` exactly once whenever metadata, methods, or any knowledge subdomain changed; add a knowledge-only-save DAO test. (codex; claude reached the opposite conclusion, adjudicated on disk)

## Full Reviews

### Codex Review

## Summary

The eight plans are substantially coherent: migrations, recency, privacy, and the five-subdomain §E persistence scope are handled correctly. I found no unresolved HIGH concerns, but three MEDIUM plan gaps could yield stale backup revision state or incomplete/wrong knowledge editors.

## Strengths

- Migration sequencing is correct: the current head is migration 026 and `TARGET_VERSION` is 26 in `src/db/database.ts:53-67,95-96`; 34-01 correctly reserves additive migration 027 and avoids `interactions` changes (`34-01-PLAN.md:57-63,128-129`).

- The 34-05 transaction-composition premise is sound. `updateContactFull` owns exactly one write transaction (`src/db/contacts-dao.ts:418-518`), while all named knowledge writers are real exec-scoped cores: memories (`src/db/memories-dao.ts:94-130,151-249`), relationships (`src/db/relationships-dao.ts:68-156`), current state (`src/db/current-state-history-dao.ts:55-84`), and fuel (`src/db/fuel-dao.ts:131-249`). This correctly avoids the non-reentrant transaction mutex (`src/db/transaction.ts:12-23,49-63`).

- 34-05 preserves the recency invariant: its prohibition against writing `last_contact` matches the sole recomputation writer in `src/db/recency-dao.ts:167-197`, and existing edit composition already recomputes only for the documented triggers (`src/db/contacts-dao.ts:478-503`).

- The revised 34-04 correctly scopes the ordinary form to three channel options while retaining five-option compatibility for existing consumers (`34-04-PLAN.md:143-178`). This aligns with the current shared form's option/duration limitations, rather than assuming `visibleFields` can filter channel choices.

## Concerns

- **MEDIUM — NEW cycle-3 finding:** 34-03 and 34-05 do not specify a single `data_revision` bump for knowledge-only composed writes. The knowledge cores intentionally do not bump it; their standalone wrappers do. Meanwhile `applyContactMethodDiffCore` bumps only when methods changed (`src/db/contact-methods-dao.ts:171-177,277`), and `updateContactFull` only self-bumps when no method draft was supplied (`src/db/contacts-dao.ts:504-516`). Therefore a screen that supplies method drafts—as both create/edit screens do—and changes only a Memory/current-state/etc. can commit durable data without advancing backup freshness state. The plans require new core composition but omit revision ownership (`34-03-PLAN.md:176-184`; `34-05-PLAN.md:128-136`).

- **MEDIUM — NEW cycle-3 finding:** 34-07 ambiguously treats `TriStateLastSpoke` as a possible "Last-Talked-About" editor (`34-07-PLAN.md:177-185`). It is not one: it is a date/first-interaction control (`src/components/TriStateLastSpoke.tsx:1-16,30-45`) whose create path derives an interaction timestamp (`src/screens/create-contact-logic.ts:76-100`). Last Talked About is instead the `current_state_entries` field key `last_talked_about` (`src/db/memory-registry.ts:65-89`) and must use the current-state writer/read model.

- **MEDIUM — NEW cycle-3 finding:** 34-08 requires five knowledge drafts to seed from "the contact's read," but the actual `getContactForEdit` result contains only contact metadata, custom values, links, and methods (`src/db/contact-read.ts:154-212`); current screen loading calls only that read (`src/screens/EditContactScreen.tsx:224-250`). The plan's Task 2 names only the current-state read and does not identify the memories/relationships/fuel reads or extend the initial/partial-reseed path (`34-08-PLAN.md:112-122,142-150`). Without explicit loading/reseeding, collection diffs cannot safely distinguish unchanged rows from additions/deletions.

## Suggestions

- Amend 34-03 and 34-05 to make the aggregate transaction owner bump `data_revision` exactly once whenever metadata, methods, or any knowledge subdomain changes; add DAO tests for knowledge-only saves with supplied unchanged method drafts.

- Amend 34-07 Task 3 to remove `TriStateLastSpoke` from Last Talked About. Specify `getCurrentStateValue`/`setCurrentStateValue` with `last_talked_about` and `current_location`, plus a regression proving no interaction row is written.

- Amend 34-08 Tasks 1–3 to explicitly load and retain baselines via `listMemoriesForContact`, relationship/fuel reads, and `getCurrentStateValues`; include these in normal load and links-failure partial reseed, with a test for edit/delete diff correctness.

## Risk Assessment

**MEDIUM.** The core transaction and persistence design is sound, but the missing revision contract and incomplete/ambiguous read/editor contracts can cause missed automatic-backup freshness and incorrect knowledge editing behavior.

LANE_COUNTS: high=0 actionable=3

---

### Claude Review

# Cross-AI Plan Review — Orbit Phase 34 "Rapid Capture & Update Flows" (CYCLE 3, FINAL)

## Summary

This is a mature, well-converged 8-plan set. I verified every DAO/table/migration claim against the actual source, and the load-bearing infrastructure the plans depend on is real: the five composed `*Core` writers 34-05 and 34-03 rely on (`addMemoryCore`, `editMemoryCore`, `deleteMemoryCore`, `addRelationshipCore`/`editRelationshipCore`/`deleteRelationshipCore`, `addFuelCore`/`editFuelCore`/`deleteFuelCore`, `setCurrentStateValueCore`) all exist, are exec-scoped (take `exec: SqlExecutor`, open no `inWriteTransaction`), and are therefore composable inside `updateContactFull`'s single existing transaction. Migration numbering is correct (disk head = 026; 34-01 correctly ships 027; 34-05 and 34-08 invent none). The privacy posture (Allow-AI OFF, registry `aiDefault=false`, no read-path network, Group-Note ban) holds. All cycle-1/cycle-2 HIGH findings are demonstrably incorporated. I found **zero unresolved HIGH concerns** and a small number of implementation-precision MEDIUM/LOW items, chiefly around the create-path enrichment element-shape contract and the edit-path collection-diff ownership. Overall risk is LOW.

## Strengths (verified on disk)

- **34-05's core composition is real and safe.** Every writer it composes is exec-scoped and non-mutexed: `addMemoryCore` (`src/db/memories-dao.ts:94`, with the explicit "never opens a mutexed transaction" contract at :90-93), `editMemoryCore` (:151), `deleteMemoryCore` (:239); `addRelationshipCore`/`editRelationshipCore`/`deleteRelationshipCore` (`src/db/relationships-dao.ts:68,97,146`); `addFuelCore`/`editFuelCore`/`deleteFuelCore` (`src/db/fuel-dao.ts:131,165,228`, `FuelKind` includes `off_limits` at :43); `setCurrentStateValueCore` (`src/db/current-state-history-dao.ts:55`). The mutexed wrappers (`addMemory` at :296, `addRelationship` at :199, `addFuel` at :255, `setCurrentStateValue` at :87) each open their own `inWriteTransaction`, so the plan's insistence on composing the `*Core` variants only — never the wrappers — is correct and necessary (the mutex is non-reentrant). The target table into which they compose, `updateContactFull`'s single `inWriteTransaction` at `src/db/contacts-dao.ts:418`, is exactly where `updateContactMetadataCore` + custom-value upserts + conditional `recomputeLastContactCore` (:502) + `applyContactMethodDiffCore` (:504-515) already compose — a proven analog.
- **Migration correctness confirmed.** `GROUP_EVENTS_SCHEMA_VERSION = 26` (`src/db/migrations/026-group-events-schema.ts:12`), `TARGET_VERSION = GROUP_EVENTS_SCHEMA_VERSION` (`src/db/database.ts:67`); no `024` or `027` file exists on disk. 34-01's head+1 = 027 is right, and its checkpoint:decision gating the one-way migration shape (34-01 Task 1) is appropriate. 34-05/34-08 correctly assert every target table already exists and author no migration.
- **The cycle-2 HIGH (34-05 edit-path persistence) is genuinely resolved.** `updateContactFull` (`contacts-dao.ts:385-519`) is the real edit path; today it has no knowledge-subdomain writers, so extending `UpdateContactFullInput` + composing the `*Core` writers is the correct, minimal fix. The no-op `grep -ci ThingsToRemember` gate is replaced by positive per-subdomain round-trip + forced-rollback assertions (34-05 Task 1/2 acceptance).
- **34-05's on-disk scope correction is accurate.** `LinksEditor`/`applyLinkDiff` is external URL links (retained as the deliberate second transaction at `EditContactScreen.tsx:415`, which I confirmed 34-08 preserves), and `TriStateLastSpoke` is the first-interaction control — neither is a knowledge subdomain. `last_talked_about`/`current_location` are the two `CURRENT_STATE_FIELD_KEYS` (`src/db/memory-registry.ts:67-70`). The five-subdomain read is correct; per the prompt I do not flag §E scope.
- **HIGH #1 (34-04 channel chooser) mechanism verified.** `CHANNEL_OPTIONS` is a module-internal const (`TouchpointRefineForm.tsx:76`) mapped by the Channel Picker at :247; `visibleFields` (:103) is field-level, not option-level — so the additive `channelOptions` prop defaulting to the five entries is the right non-regressing approach. Duration genuinely renders inline today (`{fields.has("duration")` at :360) with no disclosure, confirming the `moreOptionsFields` gap 34-04 closes.
- **HIGH #2 (34-01 backup key casing) mechanism verified.** `restore-apply.ts:327` casts `manifest.appSettings` entries straight into `AppSettingsPatch` and calls `updateAppSettingsCore`, which maps via `COLUMN_OF` — so a snake_case manifest key would find no `COLUMN_OF` entry and silently drop. camelCase keys are the correct choice; `PORTABLE_SETTINGS_KEYS` (`backup-schema.ts:133`), the `.has` guard (:221), and the declare-only precedent (`historyLens`/`historyCycleCount` at :191-192) all match the plan.
- **Privacy posture verified.** `addMemoryCore` derives `allow_ai` from `MEMORY_TYPE_REGISTRY[input.type].aiDefault` (`memories-dao.ts:126`), which is `false` for general/custom/imported (`memory-registry.ts:35,45,55`) — so 34-07's "registry-default-OFF on create, edit-only Allow-AI control" claim is exactly true. `quick-log-command.ts` keeps `channel:"unspecified"` (:31,:92) and single-flight `pendingRef` (:39), matching 34-06.

## Concerns

### MEDIUM

- **[NEW cycle-3] 34-03 create-path enrichment element shape is under-specified vs `contactId`/timestamp injection.** 34-03 says the new `CreateContactFullInput` enrichment arrays have element shapes that "match the corresponding `*Core` writer inputs" (34-03 Task 3 action; must_haves key_links). But every writer input requires a `contactId` (`NewRelationshipInput.contactId` at `relationships-dao.ts:9`; `NewMemoryInput`/`NewFuelItem` likewise), and `addMemoryCore` additionally requires `createdAt`/`now` (`memories-dao.ts:124-125`). On the **create** path the contact row does not exist until `createContactFullCore` inserts it, so the form-built element cannot carry `contactId` — `createContactFullCore` must inject it (and `now`) after insert. The phrasing "element shape matches its `*Core` writer input" is therefore literally incorrect for create, and a naive executor could build a payload that either fails type-check or double-specifies `contactId`. The round-trip test would catch a hard failure, but the contract should be pinned. (On the **edit** path in 34-05 this is a non-issue since `input.id` is the contactId.) *Actionable.*

### LOW

- **[NEW cycle-3] 34-05 collection-diff ownership is ambiguous between the DAO tasks and the logic task.** 34-05 Task 1 behavior allows the `memories` payload to be "a seeded-vs-current diff shape, **or** `{add,edit,delete}` lists," while Task 3 has `edit-contact-logic.buildEditInput` "producing seeded-vs-current diffs for the collections," and Tasks 1/2 have `updateContactFull` "apply the diff: new rows via `addMemoryCore`, changed via `editMemoryCore`, removed via `deleteMemoryCore`." The intended split (logic computes `{add,edit,delete}`; DAO applies) is inferable but the "or" in Task 1 leaves the cross-task interface unpinned — a risk of the DAO expecting pre-diffed lists while the logic passes raw seed+current (or vice-versa), since these land in the same wave-2 plan. Pin the diff contract (who diffs, what shape crosses the boundary) in one sentence. *Actionable.*

- **[NEW cycle-3] 34-05 Task 1's `inWriteTransaction`-count static guard is fragile.** The acceptance criterion `awk '/updateContactFull/,/^}/' src/db/contacts-dao.ts | grep -c inWriteTransaction` returns 1 assumes the awk range cleanly spans the function. In the real file `updateContactFull` spans :385-519 with nested closures, and "updateContactFull" appears earlier in comments (e.g. the file header at :5-7 and the comment block near :256-262), so the awk address range can start/stop at the wrong lines and mis-count. This is only a supplementary static guard — the authoritative proof is the forced-rollback round-trip test — but the grep line as written may pass or fail for the wrong reason. Prefer scoping to the function via a line-range or a dedicated test assertion. *Actionable.*

- **[NEW cycle-3] `data_revision` bump for the composed knowledge writes is never stated.** The `*Core` writers deliberately do not advance `data_revision` (the wrappers do, e.g. `addMemory` at `memories-dao.ts:301-302`; `app-settings-dao.ts:348` documents the same posture). `updateContactFull` already bumps exactly once per call — `bumpDataRevisionCore` at `contacts-dao.ts:516` when no method diff runs, otherwise inside `applyContactMethodDiffCore` — so the composed knowledge writes ARE covered by the existing single bump. This is correct as-is, but neither 34-05 nor 34-08 states it, leaving a risk that an executor adds redundant per-subdomain bumps (harmless but noisy) or, worse, assumes a bump is needed and refactors the single bump. One line noting "the existing single `data_revision` bump covers the composed knowledge writes; add no per-subdomain bump" would remove the ambiguity. *Actionable.*

  > **Orchestrator note (on-disk adjudication):** this reads the bump as already-covered, which is not correct. `applyContactMethodDiffCore` bumps only when methods `changed` (`contact-methods-dao.ts:277`), and `updateContactFull` self-bumps only when `methodSaveResult === null` (`contacts-dao.ts:516`). When method drafts are supplied but unchanged and a knowledge subdomain changed, neither bumps — so there is a real gap, matching the codex finding. Counted once as actionable.

## Suggestions (specific PLAN edits)

1. **34-03 Task 3 / key_links:** Change "element shape matches its `*Core` writer input" to state that the caller-supplied create-time enrichment elements OMIT `contactId` (and memory `createdAt`/`now`), which `createContactFullCore` injects after inserting the contact row; only the semantic fields (value/label/personName/kind/etc.) come from the form.
2. **34-05 Task 1 behavior:** Remove the "or" — declare a single diff contract: `edit-contact-logic.buildEditInput` computes `{add,edit,delete}` lists (collections) and per-field current-state values (from seed+draft), and `updateContactFull` consumes those lists directly. State the row-identity key (`id`) each list element carries.
3. **34-05 Task 1 acceptance:** Replace the `awk '/updateContactFull/,/^}/'` guard with a function-scoped check (explicit line range, or an assertion in `contacts-dao.test.ts` that the knowledge path opens no additional transaction), keeping the forced-rollback round-trip as the primary proof.
4. **34-05 must_haves / 34-08 key_links:** Add one line: the composed knowledge writes rely on `updateContactFull`'s existing single `data_revision` bump (`contacts-dao.ts:516` / `applyContactMethodDiffCore`); no per-subdomain bump is added. (Per the orchestrator adjudication, ensure the bump fires when only a knowledge subdomain changed with unchanged supplied method drafts.)

## Risk Assessment

**Overall: LOW.** Every persistence primitive the phase composes is present, exec-scoped, and composable inside the one transaction the plans target; migration numbering, the two-transaction edit boundary, the recency-spine invariant, and the privacy defaults are all honored and verified on disk. No decision reversal against CLAUDE.md/ADRs/migration 006 is present, and the owner-ratified §E scope is respected. Dependency ordering across the three waves is sound (34-01→34-04, 34-03→34-05→34-08, 34-02/34-04→34-06/34-07; shared-file writers on `DashboardStack.tsx`/`UniversalFab.tsx`/`contacts-dao.ts` are correctly sequenced across waves with no intra-wave file collisions). The remaining items are implementation-precision refinements to input-shape and diff-ownership wording plus two test-mechanics nits — none blocks execution, and all are catchable by the round-trip tests the plans already mandate.

LANE_COUNTS: high=0 actionable=4

---

## Next step

Incorporate this feedback into planning:

```
/gsd-plan-phase 34 --reviews
```
