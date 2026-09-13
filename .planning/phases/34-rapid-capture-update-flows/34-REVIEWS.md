---
phase: 34
reviewers: [codex, claude]
reviewed_at: 2026-09-13T00:28:23Z
cycle: 5
plans_reviewed: [34-01-PLAN.md, 34-02-PLAN.md, 34-03-PLAN.md, 34-04-PLAN.md, 34-05-PLAN.md, 34-06-PLAN.md, 34-07-PLAN.md, 34-08-PLAN.md]
models:
  codex: "gpt-5.6-terra (reasoning=low)"
  claude: "claude-opus-4-8 (read-only subagent)"
model_sources:
  codex: "banner"
  claude: "subagent-workaround"
cycle_summary: current_high=0 current_actionable=1
---

# Cross-AI Plan Review — Phase 34 (cycle 5, final)

> Cycle 5 of a convergence loop. The 8 plans were revised (commit 93b9fc0) to incorporate
> the 4 cycle-4 findings. Both reviewers verified against the code on disk per CLAUDE.md
> ("review the code, not the diff"). The Claude lane ran as a read-only subagent (the built-in
> `claude` lane self-skips inside Claude Code and hits the known Write-permission hazard); its
> findings are aggregated at full weight — it is a source-grounded review, not diff-only.

## Consensus Summary

Both reviewers independently confirmed that all four cycle-4 fixes are correctly grounded against
the actual source, and that no plan deletes, weakens, or reverses a recorded decision (§E honored
per the owner's ratified direction; no second `interactions` migration; Allow-AI default OFF (D-04);
local-first read paths intact; forward-only migration head correctly 026→027; 34-05/34-08 invent no
migration). The plans are heavily refined and read as a converged final cycle.

The orchestrator independently re-verified every load-bearing mechanism against disk before
aggregating: `deleteFuelCore`/`deleteFuel` bump composition (fuel-dao.ts:228-298), the absence of
any external `deleteFuelCore` caller today, `listFuelForEditor` returning all kinds (fuel-read.ts:61),
the registry-derived memory `allow_ai` default (memories-dao.ts:126), `getAppSettings`/`setMemoryAllowAi`
existence, `setCurrentStateValueCore` blank-rejection + the reference screen's blank guard
(ThingsToRememberScreen.tsx:272), and migration head 026.

### Agreed Strengths

- The four cycle-4 fixes are accurate against disk (verified independently by both reviewers and the
  orchestrator): the `deleteFuelCore` optional-`bumpRevision` fix mirrors the existing
  `insertTombstoneCore(..., {bumpRevision:false})` precedent (memories-dao.ts:283-287); off-limits
  kind-scoping is defense-in-depth (screen filter + `buildEditInput` re-filter + forced
  `kind:"off_limits"` + preservation test); the create-enrichment injection set matches every
  `*Input` shape (fuel alone requires a caller-minted `uid`; memory `allow_ai` stays registry-derived);
  the MemoryEditor AI-gate props are required and `globalAiEnabled`/`editing`-gated.
- No recorded-decision reversal; the three→five §E scope is honored, not narrowed.
- `data_revision` exactly-once contract, off-limits data-loss class, and AI-egress default-OFF gate are
  each closed with defense-in-depth and targeted tests.
- Dependency ordering is sound (wave 1: 34-01/02/03; wave 2: 34-04 dep 01, 34-05 dep 03; wave 3:
  34-06/07 dep 02+04, 34-08 dep 03+05) with no same-wave shared-file collisions — the `bumpRevision`
  param lands in wave 1 (34-03 on `applyContactMethodDiffCore`) and wave 2 (34-05 on `deleteFuelCore`),
  and `fuel-dao.ts` is touched only by 34-05 in wave 2.

### Agreed Concerns

None. Neither reviewer raised an unresolved HIGH, and the two reviewers did not converge on any shared
unresolved actionable finding.

### Divergent Views

- **34-01 Task 2/3 round-trip ordering (codex flagged; Claude did not).** Codex: Task 2's behavior/
  `<done>` (34-01:124,139) assert a DAO round-trip through `getAppSettings`/`updateAppSettings`, but
  the DAO wiring (COLUMN_OF entry, portable projection, hydration, validators) is added in Task 3;
  the current DAO has neither column in `COLUMN_OF` (app-settings-dao.ts:497) nor its projection
  (app-settings-dao.ts:664). **Orchestrator adjudication: codex is correct on disk.** Task 3 already
  owns the round-trip acceptance (34-01:152-153), and Task 2's read_first analog (020's migration
  test) is migration-only — so Task 2's round-trip claim is both premature (its files omit
  app-settings-dao.ts) and redundant with Task 3. Counted as the one actionable finding this cycle.
- **34-08 FuelEditor kind-picker (codex rated HIGH; Claude and orchestrator: not a HIGH).** Codex:
  `FuelEditor` has no `fixedKind`/hidden-picker prop (FuelEditorProps at FuelEditor.tsx:109-125 offers
  all 5 kinds via KIND_OPTIONS, DEFAULT_KIND="topic"), so a screen-only change cannot make the picker
  "not exposed." **Orchestrator adjudication: real observation, but not a HIGH and not actionable.**
  The data-loss class is independently prevented by 34-05's kind-scoped diff + `buildEditInput` forcing
  `kind:"off_limits"`; and the 34-08 acceptance (34-08:148) is an OR whose achievable branch
  ("cannot set a non-off_limits kind from this section") is satisfiable from EditContactScreen.tsx alone.
  The residual is a UX nicety (hiding the visible picker), an owner/UX call, not an execution blocker.
- **Current-state "cannot clear" (codex MEDIUM x3 on 34-05/07/08; Claude did not flag).** Codex:
  `setCurrentStateValueCore` rejects blank (`assertMeaningfulValue`, current-state-history-dao.ts:39-43)
  and there is no clear/remove writer, so Last Talked About / Current Location can be set but not
  cleared. **Orchestrator adjudication: not a plan defect.** The plans scope current-state to
  update-only ("ONLY when the value changed"; "an unchanged value writes nothing", 34-05:33,151), the
  reference screen already guards blank (`const value = currentDraft.trim(); if (!value) return`,
  ThingsToRememberScreen.tsx:271-272) and the plans tell executors to mirror it, and no dossier
  decision requires a clear semantic. Whether current-state should be clearable is an out-of-scope
  product question for the owner, not an unresolved plan concern.


## Codex Review

_Model: gpt-5.6-terra (reasoning=low). Source-grounded (repo access)._

## 34-01 — Default Interaction Channel foundation

Summary: Sound migration/DAO/backup shape, but task ordering has one executable inconsistency.

Strengths:
- Correctly uses head 026: `TARGET_VERSION` currently resolves to `GROUP_EVENTS_SCHEMA_VERSION = 26`, and migration registration ends with 025/026 ([database.ts](/home/bwales/projects/orbit-app/src/db/database.ts:67)).
- Correctly avoids an `interactions` migration; Phase 32 already added `allow_ai` and remapped vocabulary ([025-interaction-history-schema.ts](/home/bwales/projects/orbit-app/src/db/migrations/025-interaction-history-schema.ts:44)).
- Camel-case backup keys are necessary: restore casts manifest settings into `AppSettingsPatch`, whose mapping keys are camel case ([restore-apply.ts](/home/bwales/projects/orbit-app/src/backup/restore-apply.ts:327), [app-settings-dao.ts](/home/bwales/projects/orbit-app/src/db/app-settings-dao.ts:497)).

Concerns:
- MEDIUM: Task 2 requires a DAO round-trip through `getAppSettings` / `updateAppSettings`, but Task 3 is where those symbols, SQL projection, hydration, `COLUMN_OF`, and validators are added. The current DAO has neither column in its `COLUMN_OF` mapping ([app-settings-dao.ts](/home/bwales/projects/orbit-app/src/db/app-settings-dao.ts:497)) nor its portable projection ([app-settings-dao.ts](/home/bwales/projects/orbit-app/src/db/app-settings-dao.ts:664)). Task 2’s test cannot prove the stated DAO behavior before Task 3. Move the DAO round-trip assertion to Task 3, leaving Task 2 migration-only.

Suggestions: Keep the restore-boundary test in `restore-apply.test.ts`; `updateAppSettingsCore` already re-validates patches even when invoked by restore ([app-settings-dao.ts](/home/bwales/projects/orbit-app/src/db/app-settings-dao.ts:1116)).

Risk: MEDIUM.

## 34-02 — Registry labels and vocabulary verification

Summary: Complete and appropriately bounded.

Strengths:
- The proposed label swap matches current registry facts: `general` is currently “General” and `custom` is currently “Memory” ([memory-registry.ts](/home/bwales/projects/orbit-app/src/db/memory-registry.ts:10), [memory-registry.ts](/home/bwales/projects/orbit-app/src/db/memory-registry.ts:28), [memory-registry.ts](/home/bwales/projects/orbit-app/src/db/memory-registry.ts:49)).
- Correctly treats CAPT-15 as already migrated in 025, including null-preserving `quality` behavior ([025-interaction-history-schema.ts](/home/bwales/projects/orbit-app/src/db/migrations/025-interaction-history-schema.ts:39)).
- No redundant schema work.

Concerns: None unresolved.

Suggestions: Ensure the scripted legacy scan excludes only source/migration/fixture locations, as planned.

Risk: LOW.

## 34-03 — Add Contact and atomic enrichment

Summary: Strong atomic-create direction and data-revision ownership. One prerequisite should be made explicit.

Strengths:
- Existing create path is already one transaction and inserts the contact before optional first interaction/custom-value work ([contacts-dao.ts](/home/bwales/projects/orbit-app/src/db/contacts-dao.ts:116), [contacts-dao.ts](/home/bwales/projects/orbit-app/src/db/contacts-dao.ts:160)).
- The plan correctly identifies that `addMemoryCore`, `addRelationshipCore`, and `setCurrentStateValueCore` are composable transaction cores ([memories-dao.ts](/home/bwales/projects/orbit-app/src/db/memories-dao.ts:94), [relationships-dao.ts](/home/bwales/projects/orbit-app/src/db/relationships-dao.ts:68), [current-state-history-dao.ts](/home/bwales/projects/orbit-app/src/db/current-state-history-dao.ts:55)).
- It correctly fixes the current revision gap: today the aggregate only bumps when method drafts are omitted, while the methods core owns a bump when changed ([contacts-dao.ts](/home/bwales/projects/orbit-app/src/db/contacts-dao.ts:230), [contact-methods-dao.ts](/home/bwales/projects/orbit-app/src/db/contact-methods-dao.ts:99)).

Concerns:
- LOW: The plan changes `applyContactMethodDiffCore` to accept `bumpRevision`, but that core is also used by restore/reconciliation, not only contact create/edit ([reconcile-apply.ts](/home/bwales/projects/orbit-app/src/db/reconcile-apply.ts:206)). The default-preserves-callers intent is stated, but the task should explicitly run the reconciliation-related tests after altering this shared writer.

Suggestions: Add the relevant reconciliation suite to Task 3’s focused verification.

Risk: MEDIUM.

## 34-04 — Log Interaction

Summary: The scoped options and progressive-duration design avoid regressions in the existing shared form.

Strengths:
- Existing form globally exposes legacy `other`/`unspecified` entries ([TouchpointRefineForm.tsx](/home/bwales/projects/orbit-app/src/components/TouchpointRefineForm.tsx:76)); scoping three choices only to ordinary logging is correct.
- Quick Log’s separate hard-coded `unspecified` channel remains untouched ([quick-log-command.ts](/home/bwales/projects/orbit-app/src/services/quick-log-command.ts:91)).
- The plan correctly keeps writes on the recency spine rather than writing `interactions` directly.

Concerns: None unresolved.

Suggestions: Preserve the default five-option form behavior with a component-level regression test, not only a grep/human check.

Risk: LOW.

## 34-05 — Edit-path persistence foundation

Summary: The atomic composition, kind-scoped Off Limits diff, and revision-bump repair are well targeted. Current-state clearing remains unspecified.

Strengths:
- `updateContactFull` already has one metadata transaction and preserves the `last_contact` single-writer rule ([contacts-dao.ts](/home/bwales/projects/orbit-app/src/db/contacts-dao.ts:418)).
- `deleteFuelCore` currently invokes tombstone insertion with its default revision bump ([fuel-dao.ts](/home/bwales/projects/orbit-app/src/db/fuel-dao.ts:228)); adding a suppressible bump is a real required fix.
- `listFuelForEditor` returns every fuel kind ([fuel-read.ts](/home/bwales/projects/orbit-app/src/db/fuel-read.ts:61)), so the plan’s filtering/forced `off_limits` guard is necessary and correctly addresses a data-loss class.

Concerns:
- MEDIUM: The plan claims a complete editable current-state record, but provides only `setCurrentStateValueCore`, which rejects blank values and always inserts a new current row ([current-state-history-dao.ts](/home/bwales/projects/orbit-app/src/db/current-state-history-dao.ts:39), [current-state-history-dao.ts](/home/bwales/projects/orbit-app/src/db/current-state-history-dao.ts:55)). There is no clear/remove-current writer in this subsystem. As written, a user can change Last Talked About/Current Location but cannot clear it, despite optional fields being valid elsewhere in the plan.

Suggestions: Specify either a history-preserving “clear current value” core and its semantics, or explicitly lock the UI to non-empty update-only behavior and obtain product confirmation.

Risk: MEDIUM.

## 34-06 — Quick Log post-log note/memory

Summary: Correctly preserves immediate Quick Log and Undo while adding post-log capture.

Strengths:
- Existing Quick Log is immediate, single-flight, and uses `localDateTime()` ([quick-log-command.ts](/home/bwales/projects/orbit-app/src/services/quick-log-command.ts:81)).
- The existing snackbar model only has one action ([quick-log-command.ts](/home/bwales/projects/orbit-app/src/services/quick-log-command.ts:16)); the optional secondary action is genuinely needed.
- The note path’s proposed read-before-edit protects against an undone interaction.

Concerns: None unresolved.

Suggestions: Make `openPostLogEditor` optional in the dependency type until every caller is updated in the same compile-safe task, or update all callers atomically. Current callers are Home and FAB ([HomeScreen.tsx](/home/bwales/projects/orbit-app/src/screens/HomeScreen.tsx:494), [UniversalFab.tsx](/home/bwales/projects/orbit-app/src/components/UniversalFab.tsx:201)).

Risk: LOW.

## 34-07 — Update Contact and Memory routes

Summary: Correctly separates current-state updates from first-interaction semantics.

Strengths:
- The plan correctly avoids `TriStateLastSpoke`; it is not a current-state writer. Current-state records are read and written through dedicated APIs ([current-state-history-read.ts](/home/bwales/projects/orbit-app/src/db/current-state-history-read.ts:23), [current-state-history-dao.ts](/home/bwales/projects/orbit-app/src/db/current-state-history-dao.ts:55)).
- Memory creation derives AI permission from registry metadata, currently false for all built-in types ([memories-dao.ts](/home/bwales/projects/orbit-app/src/db/memories-dao.ts:94), [memory-registry.ts](/home/bwales/projects/orbit-app/src/db/memory-registry.ts:28)).
- Real global-AI wiring is correctly required because `MemoryEditor` requires both props ([MemoryEditor.tsx](/home/bwales/projects/orbit-app/src/components/MemoryEditor.tsx:60)).

Concerns:
- MEDIUM: Same unresolved current-state clearing gap as 34-05. The plan’s focused Last Talked About/Current Location editors only name `setCurrentStateValue`, which cannot clear a field ([current-state-history-dao.ts](/home/bwales/projects/orbit-app/src/db/current-state-history-dao.ts:39)).

Suggestions: Resolve that policy/API alongside 34-05 so Update Contact and Edit Contact cannot diverge.

Risk: MEDIUM.

## 34-08 — Edit Contact accordions

Summary: The complete-record and explicit seed/reseed approach is strong, but the Off Limits UI cannot be implemented solely in the listed file.

Strengths:
- Correctly identifies that `getContactForEdit` returns metadata, custom values, links, and methods—not Memories, Relationships, Fuel, or current-state data ([contact-read.ts](/home/bwales/projects/orbit-app/src/db/contact-read.ts:180)).
- Correctly preserves the intentional two-transaction Save boundary in the existing screen architecture.
- Correctly requires filtered fuel seeds and partial-reseed filtering.

Concerns:
- HIGH: The plan requires an Off Limits adapter that hides the kind picker and forces `kind: "off_limits"`, but only lists `EditContactScreen.tsx` as modified. `FuelEditor` has no `fixedKind`/filtered-options prop; it hard-codes a five-kind picker ([FuelEditor.tsx](/home/bwales/projects/orbit-app/src/components/FuelEditor.tsx:72)) and exposes `onEdit` directly for kind selection ([FuelEditor.tsx](/home/bwales/projects/orbit-app/src/components/FuelEditor.tsx:280)). A screen-only change cannot satisfy “kind picker is not exposed” or reliably constrain new drafts, whose default is `"topic"` ([FuelEditor.tsx](/home/bwales/projects/orbit-app/src/components/FuelEditor.tsx:81)). Add a narrow `fixedKind` / hidden-kind-picker API to `FuelEditor` and its tests, or use a separate constrained editor.
- MEDIUM: The current-state clear omission from 34-05/34-07 also affects this “complete editable record” screen.

Suggestions: Make the `FuelEditor` API change a prerequisite task and test it against non-Off-Limits fuel preservation.

Risk: HIGH.

Overall: The plans are substantially converged. The remaining blockers are the Task 2/3 ordering bug in 34-01, a missing current-state clear policy/API across 34-05/07/08, and the non-existent FuelEditor constraint API required by 34-08.

---

## Claude Review

_Model: claude-opus-4-8, run as a read-only subagent (built-in claude lane self-skips inside Claude Code). Source-grounded (repo access)._

# Claude Review — Phase 34 (cycle 5)

**Reviewer:** independent cross-AI peer reviewer (Claude, Opus 4.8)
**Scope:** the 8 implementation plans for Phase 34 "Rapid Capture & Update Flows" (34-01 … 34-08), cycle 5 (final) of a convergence loop.
**Method:** read the full review prompt (RESEARCH + CONTEXT + all 8 PLANs), then verified the load-bearing claims — especially the four cycle-4 fixes — against the **actual code on disk** per CLAUDE.md "Review the code, not the diff." Every table writer touched by these plans (`memories`, `relationships`, `current_state_entries`, `fuel`, `contacts`, `contact_methods`) was opened and read.

---

## Disk verification of the cycle-4 fixes (the four claims I was asked to re-check)

All four verified as **correctly grounded**:

1. **34-05 Off-Limits delete double-bump fix.**
   - `deleteFuelCore` (src/db/fuel-dao.ts:228-250) is a **hard delete** that calls `insertTombstoneCore(exec, {...})` with no options → bumps `data_revision` by default. Verified.
   - `insertTombstoneCore` (src/db/tombstones-dao.ts:63-82) has signature `(exec, input, { bumpRevision = true } = {})` and only calls `bumpDataRevisionCore` when `bumpRevision` is true. So the optional-param fix threads cleanly.
   - The exact precedent the plan cites already exists: `purgeMemoryPermanentlyCore` calls `insertTombstoneCore(exec, {...}, { bumpRevision: false })` (src/db/memories-dao.ts:283-287).
   - `deleteMemoryCore` (memories-dao.ts:239-250) and `deleteRelationshipCore` (relationships-dao.ts:146-156) are **soft-delete UPDATEs that never bump** — confirmed, so they correctly need no param.
   - The standalone `deleteFuel` wrapper (fuel-dao.ts:293-298) relies on `deleteFuelCore`'s default bump (it does **not** call `bumpDataRevisionCore` itself, unlike `addFuel`/`editFuel`/`confirmFuel`). Keeping `bumpRevision` default `true` preserves it — no regression. Verified.

2. **34-05/34-08 Off-Limits kind-scoping (data-loss prohibition).** The hazard is real and correctly characterized:
   - `listFuelForEditor` (src/db/fuel-read.ts:50-66) has `WHERE contact_id = ?` with **no kind predicate** — it is the ONE read that returns every kind incl. off_limits (comment at fuel-read.ts:19-23 is explicit). Seeding an off-limits diff from it unfiltered would compute a contact's `recent`/`topic`/`fact`/`gift` rows as DELETEs.
   - `FuelEditor` defaults new rows to `DEFAULT_KIND = "topic"` (src/components/FuelEditor.tsx:81) and offers all 5 kinds in `KIND_OPTIONS` (FuelEditor.tsx:72-79) — so it genuinely must be constrained.
   - The plans' mitigation is defense-in-depth and sound: screen seeds `listFuelForEditor(...).filter(kind==="off_limits")` (34-08 Task 2/3, incl. the partial-reseed path), `buildEditInput` **defensively re-filters** the seed and forces `kind:"off_limits"` on adds/edits (34-05 Task 3), and a preservation test asserts other kinds survive (34-05 Task 2 acceptance). `fuel.kind` union confirmed at fuel-dao.ts:43.

3. **34-03 create-enrichment normalization (full injection set).** Verified against the `*Input` shapes:
   - `NewFuelItem` **requires** a caller-minted `uid` (fuel-dao.ts:55-72) → fuel is correctly the ONLY kind needing `newUid()` injection. `addFuelCore` (fuel-dao.ts:131-152) is a bare INSERT that does **not** mint uid and does **not** bump.
   - `NewMemoryInput`/`addMemoryCore` mints its own uid internally via `newUid()` (memories-dao.ts:112) and derives `allow_ai` from `MEMORY_TYPE_REGISTRY[input.type].aiDefault` (memories-dao.ts:126) — so the plan is right that memory `allow_ai` is **not** a create-time injected field and uid is not injected for memories.
   - `NewRelationshipInput` requires `contactId`/`createdAt`/`now` but **no** caller uid (relationships-dao.ts:8-18) — matches "createdAt+now for memories, relationships AND fuel; uid for fuel only."
   - `setCurrentStateValueCore` (current-state-history-dao.ts:55) is exec-scoped, needs only `now`, and does not self-bump (the wrapper at :87 bumps).
   - The under-bump gap is real: `createContactFullCore` bumps only `if (methodSaveResult === null)` (contacts-dao.ts:244) and `applyContactMethodDiffCore` bumps only `if (changed)` (contact-methods-dao.ts:277) — so an enrichment-only create with supplied-but-unchanged method drafts bumps nowhere today. The "sole-bumper + `bumpRevision:false`" fix closes it. `applyContactMethodDiffCore`'s current signature (contact-methods-dao.ts:99-108) has **no** `bumpRevision` param, so 34-03 genuinely adds it (wave 1), and 34-05 (wave 2, `depends_on: 34-03`) consumes it — ordering correct.

4. **34-07/34-08 MemoryEditor AI-gate wiring.** Verified:
   - `MemoryEditor` **requires** `onSetAllowAi` and `globalAiEnabled` props (src/components/MemoryEditor.tsx:68-69).
   - The "Allow AI to use this" control is `editing`-gated (MemoryEditor.tsx:384-406) and `disabled={!globalAiEnabled}` (line 400) — so a hardcoded `globalAiEnabled={false}` would silently disable it. The plans' warning is accurate.
   - `ThingsToRememberScreen` derives `globalAiEnabled` from `(await getAppSettings(exec)).aiProvider !== "none"` (src/screens/ThingsToRememberScreen.tsx:179) — the exact template the plans reference. `setMemoryAllowAi` exists (memories-dao.ts:319).
   - `getAppSettings` reads local SQLite, not network — no read-path/local-first violation.

Additional cross-checks: migration head on disk is **026** (`TARGET_VERSION = GROUP_EVENTS_SCHEMA_VERSION`, database.ts:54-67; migrations dir ends 026); 34-05/34-08 invent no migration and touch no `interactions` schema. `TouchpointRefineForm` currently maps the channel picker directly over the internal `CHANNEL_OPTIONS` (TouchpointRefineForm.tsx:76-88, 247) with **no** `channelOptions`/`moreOptionsFields` props and Duration rendered **inline** at `fields.has("duration")` (TouchpointRefineForm.tsx:360) — confirming 34-04's two new additive props are genuinely new. `getContactForEdit` returns only `{contact, categoryLabel, values, links, methods}` (contact-read.ts ContactForEdit) with **no** knowledge subdomains — confirming 34-08's requirement that each knowledge section needs its own explicit seed read.

**Conclusion of verification:** every disk claim I checked (~18 file:line citations across 10 files) was accurate. I found no false statement in the plans.

---

## 34-01 — Default Interaction Channel data layer (migration 027 + DAO + declare-only backup)

**Summary.** Ships one `app_settings`-only migration 027 (head+1, verified), the DAO read/write/validate wiring, and declare-only backup portability for `defaultInteractionChannel`/`rememberedInteractionChannel`.

**Strengths.**
- Migration head is correctly verified against disk (026 → 027); no `interactions` change; the one-way migration is gated behind a `checkpoint:decision` (`autonomous:false`), which is the right posture for an irreversible DDL commit (CLAUDE.md: migrations are permanent on unreachable devices).
- The cycle-1 HIGH #2 (camelCase MANIFEST wire keys vs snake_case columns) is correctly resolved with grep gates asserting camelCase present / snake_case absent in backup-schema.ts, and the cycle-2 test-suite split (round-trip in restore-apply.test.ts, membership in backup-schema.test.ts) is correct — restore-apply is where COLUMN_OF + the DB write actually live.
- Restore-boundary value validation via the DAO asserts (T-34-03) rejects adversarial channel values before write.

**Concerns.** None unresolved.

**Suggestions.** None actionable.

**Risk: LOW.**

---

## 34-02 — Memory-type displayName reconciliation + CAPT-15 verification

**Summary.** Swaps `general`→"Memory" and `custom`→"Custom" (D-11), and verifies CAPT-15 (vocabulary migration already shipped by Phase 32/025) via an allowlist-scoped straggler grep + a legacy-value round-trip regression, authoring **no** second `interactions` migration.

**Strengths.**
- Correctly treats CAPT-15 as satisfied-by-dependency and hard-prohibits a second `interactions` migration (the double-migration STOP-AND-ASK). The no-duplicate-displayName assertion prevents the general/custom label collision.
- The cycle-1 LOW is closed: the straggler check is a machine-checkable allowlist-scoped grep plus a behavioral round-trip test (not an informal scan).

**Concerns.** None unresolved.

**Suggestions.** None actionable.

**Risk: LOW.**

---

## 34-03 — Streamlined Add Contact (AccordionSection + create enrichment + atomic persistence)

**Summary.** Restructures Add Contact into 3 sections + Show More, introduces the reusable `AccordionSection` primitive (with a testable validation-focus interface reused by 34-08), extends `createContactFullCore` to persist enrichment atomically, and fixes the create-path `data_revision` bump.

**Strengths.**
- The cycle-4 MEDIUM #1 (full injection set) is verified correct against every `*Input` shape (see verification §3): fuel uid+source injection, createdAt+now for memories/relationships/fuel, registry-derived memory allow_ai. This is the kind of claim that was previously wrong and is now precise.
- The `data_revision` sole-bumper fix is verified against the real bump sites (contacts-dao.ts:244, contact-methods-dao.ts:277) and correctly notes the create path is add-only so the `deleteFuelCore` exception does not apply here.
- Preserves ADR-016 (tri-state last-spoke; "Not yet" → no interaction row) and ADR-062 (Unbound/Bound) with concrete initial-state assertions (flip Monthly+Bound → null+Unbound) and grep gates. HIGH #4 (rendered-but-unpersisted enrichment) is closed by atomic composition + round-trip + rollback tests.

**Concerns.** None unresolved.
- *(Observation, non-actionable):* making the aggregate bump unconditionally-once means a genuinely no-op Save would bump `data_revision`; this is safe (over-bump only flags backup as dirty; under-bump was the real hazard) and CAPT-14 exits unchanged forms before Save anyway. Covered by design.

**Suggestions.** None actionable.

**Risk: LOW.**

---

## 34-04 — Detailed Log Interaction (channel defaults + preference consumer)

**Summary.** Fills the `LogContact` route with the real Log Interaction screen composing `TouchpointRefineForm`; adds two additive scoped props (`channelOptions`, `moreOptionsFields`); wires the Default Channel preference and remembered-on-success-only. This is the phase's privacy-critical surface.

**Strengths.**
- The additive-prop approach (default preserves the shipped 5-option channel set and inline layout) correctly prevents a Phase-32 regression on the shared form — verified the form maps over `CHANNEL_OPTIONS` today (TouchpointRefineForm.tsx:247) and the two props do not yet exist, so they are genuinely additive. Grep gates assert Edit Interaction still passes nothing (keeps 5 → legacy other/unspecified representable).
- Allow AI default OFF (`coerceAllowAi`, touchpoint-refine-logic.ts:176), omitted Tone never Neutral, all writes through the recency spine (grep asserts no bare cores) — the D-04/D-08/ADR-078 invariants are enforced. The non-atomic remembered-channel write has an explicit, documented recovery contract (interaction is source of truth; settings-write failure caught/logged, never rolled back).
- `resolveInitialAllowAi()` seam is a forward reference only (returns OFF today) — does not ship default-ON.

**Concerns.** None unresolved.

**Suggestions.** None actionable.

**Risk: LOW** (invariant-heavy but well-guarded; on-device UAT is the right final gate for the UI behaviors).

---

## 34-05 — Edit-path knowledge persistence (updateContactFull extension)

**Summary.** Extends `updateContactFull` to atomically persist the five §E knowledge subdomains (Memories, Relationships, Last Talked About, Current Location, Off Limits) via composed exec-scoped `*Core` writers, plus `edit-contact-logic` payload assembly + `resolveErrorSection`.

**Strengths.**
- Honors the owner's ratified §E direction (all five subdomains) — correctly does **not** narrow it, and surfaces the three→five scope correction (LinksEditor is URL links; TriStateLastSpoke is the first-interaction control) as a premise refinement, not a reversal. This is the correct handling per CLAUDE.md's decision-authority rules.
- The two data-loss-adjacent cycle-4 fixes are verified sound on disk (see verification §1, §2): the `deleteFuelCore` `bumpRevision` param mirrors an existing precedent, and the off-limits kind-scoping is defense-in-depth (screen filter + logic re-filter + forced kind + preservation test). Threat T-34-28 captures it.
- Correctly composes only non-mutexed `*Core` writers inside the single existing `inWriteTransaction` (non-reentrancy respected), retains the deliberate two-transaction boundary (metadata+knowledge, then links), and the pinned `{add,edit,delete}` diff contract removes the cycle-3 "diff shape OR lists" ambiguity. Replaces the fragile awk static guard with a transaction-count test.
- No migration; verified every target table already exists (head 026).

**Concerns.** None unresolved. This plan carries the phase's highest inherent risk (largest surface on a shared writer), but the round-trip + rollback + no-double-bump + kind-preservation test matrix is comprehensive and each mechanism is verified against disk.

**Suggestions.** None actionable.

**Risk: MEDIUM** (inherent — shared-table writer extension; mitigations are thorough and verified, so residual risk is low, but it warrants the most careful executor attention and the on-device DB-invariant UAT).

---

## 34-06 — Quick Log post-log Note/Memory capture

**Summary.** Adds an Add Note affordance to the Quick Log success snackbar (additive two-action snackbar), opening a post-log editor that saves an Interaction Note XOR a basic Memory, with an Edit Memory path.

**Strengths.**
- The cycle-1 HIGH #3 (single-action snackbar can't show Undo + Add Note) is resolved with an additive `secondaryAction` on the store/type/renderer; every existing single-action caller enumerated in read_first and kept unchanged. Undo (SHELL-11) preserved.
- The Note-XOR-Memory rule, empty-text no-op, and the Add-Note-after-Undo "missing" race are handled in a pure node-tested resolver; the editor carries its own single-flight guard distinct from `runQuickLog`'s `pendingRef`. Quick Log stays immediate/current-time and keeps `channel:'unspecified'` (the pref-adoption question is a properly-surfaced flagged assumption for the owner, not a silent change).
- Basic Memory requested by `DEFAULT_MEMORY_TYPE_KEY` (no hardcoded label); registry-default AI posture (OFF) — no egress widening.

**Concerns.** None unresolved.

**Suggestions.** None actionable.

**Risk: LOW.**

---

## 34-07 — Update Contact chooser loop + full Memory editor

**Summary.** Fills the `UpdateContact` and `Memory` routes: a registry-driven chooser that returns to itself until Done, and the full Memory editor (type inside, metadata behind More Options).

**Strengths.**
- The cycle-3 MEDIUM (TriStateLastSpoke mis-attributed as the Last-Talked-About editor) is correctly fixed: Last Talked About / Current Location route through `setCurrentStateValue` keyed by `CURRENT_STATE_FIELD_KEYS`, writing only `current_state_entries` and never touching `last_contact` — with a regression assertion. This protects the DATA-04 single-writer recency invariant.
- The cycle-4 LOW #4 (MemoryEditor AI-gate wiring) is verified accurate: `globalAiEnabled` from `getAppSettings().aiProvider !== "none"`, `onSetAllowAi`→`setMemoryAllowAi`; create-time default-OFF stays registry-driven; the edit-only control tracks the real provider setting.
- Correctly excludes Category (stays Edit Contact scope), keeps each inner save independent (no giant transaction), and the Memory route stays `{contactId?}` with in-screen selection (edit-in-place via `editMemory`, no duplicate).

**Concerns.** None unresolved.

**Suggestions.** None actionable.

**Risk: LOW.**

---

## 34-08 — Edit Contact top-level accordion IA

**Summary.** Restructures `EditContactScreen` into nine direct-access top-level accordion sections composing existing editors, consuming 34-05's extended `updateContactFull` and 34-03's `AccordionSection`; retains the two-transaction boundary and the dirty-state/validation contract.

**Strengths.**
- The cycle-3 MEDIUM (seed reads / FuelEditor mis-attribution) is verified correct: `getContactForEdit` returns no knowledge subdomains, so each section is seeded by its own explicit read (`listMemoriesForContact`/`listRelationshipsForContact`/`listFuelForEditor` filtered/`getCurrentStateValues`), on both initial hydration AND the links-failure partial reseed. FuelEditor is composed fresh (ThingsToRememberScreen does not compose it) — verified.
- The off-limits kind-scoping is enforced at the screen layer too (filtered seed + constrained FuelEditor + filtered partial-reseed), backing 34-05's DAO-level guard — threat T-34-29. MemoryEditor AI-gate wired from real settings (T-34-30).
- Positive per-subdomain round-trip proofs (add/edit/delete) replace the cycle-1 no-op `grep -ci ThingsToRemember` gate; validation reveal-and-focus uses the tested `resolveErrorSection`; the deliberate two-transaction boundary is retained (not collapsed).

**Concerns.** None unresolved.

**Suggestions.** None actionable.

**Risk: LOW–MEDIUM** (large screen restructure, but persistence is proven in 34-05 and this plan is IA + composition of existing editors; dependency on 34-03 + 34-05 is correctly declared).

---

## Overall Risk Assessment

**Overall: LOW.** After four convergence cycles the plans are heavily refined and, critically, **accurate against the code on disk** — every file:line citation and every mechanism I verified (the four cycle-4 fixes plus the surrounding bump/tombstone/kind-scoping/AI-gate machinery across all six touched tables) checked out precisely. The three genuinely delicate areas — the `data_revision` exactly-once contract, the off-limits kind-scoping data-loss class, and the AI-egress default-OFF gate — are each closed with defense-in-depth and backed by targeted tests, and none deletes/weakens/reverses a recorded decision (§E is honored per the owner's ratified direction; no `interactions` re-migration; Allow-AI default OFF; local-first read paths intact; forward-only migration head correct at 026→027).

Dependency ordering is sound (wave 1: 34-01/02/03; wave 2: 34-04 dep 01, 34-05 dep 03; wave 3: 34-06/07 dep 02+04, 34-08 dep 03+05), with no same-wave shared-file collisions (the `bumpRevision` param lands in wave 1 and is consumed in wave 2; `fuel-dao.ts` is touched only by 34-05 in wave 2; `DashboardStack.tsx`/`UniversalFab.tsx` edits are sequenced across waves).

**Unresolved HIGH concerns: 0.** **Actionable MEDIUM/LOW concerns: 0.** The remaining observations (unconditional-once bump being safe over-bump; Quick Log channel pref adoption) are already covered by design or surfaced as owner-facing flagged assumptions — not actionable defects. I am deliberately not manufacturing marginal nits: this reads as a converged final cycle ready for `/gsd-execute-phase`, with 34-05 (shared-writer extension) and 34-04 (privacy-critical surface) warranting the most careful executor attention and the on-device DB-invariant UAT called out in the plans.

CLAUDE_TALLY: high=0 actionable_nonhigh=0
