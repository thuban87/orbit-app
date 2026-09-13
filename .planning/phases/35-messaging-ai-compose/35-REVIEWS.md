---
phase: 35
reviewers: [codex, claude]
reviewed_at: 2026-09-13T12:10:00Z
cycle: 5
plans_reviewed: [35-01-PLAN.md, 35-02-PLAN.md, 35-03-PLAN.md, 35-04-PLAN.md, 35-05-PLAN.md, 35-06-PLAN.md, 35-07-PLAN.md, 35-08-PLAN.md, 35-09-PLAN.md]
models:
  codex: "gpt-5.6-terra (reasoning=low)"
  claude: "unknown"
model_sources:
  codex: "banner"
  claude: "unknown"
cycle_summary: current_high=1 current_actionable=6
---

# Cross-AI Plan Review — Phase 35: Messaging & AI Compose (cycle 5)

Convergence **cycle 5** (the final cycle), re-reviewing the CURRENT plans on disk after the cycle-5 replan `5ff1f0b`, which closed all **5** cycle-4 actionable findings (verified on disk this cycle — see delta below). Two source-grounded reviewers ran: **Codex** (`gpt-5.6-terra`, reasoning=**low**, via `codex exec` with read-only repo access) and **Claude** (a read-only Claude Code subagent — the `claude -p` CLI lane is not used in this repo due to a known Write-permission failure; model id not recoverable from a subagent, recorded `unknown`). Both cited concrete `file:line` evidence against the live repo; neither ran without repo access. The orchestrator (this aggregator) independently re-verified EVERY load-bearing claim below against the code on disk per "review the code, not the diff": `resolveComposeControls`'s 2-required-param signature (`compose-logic.ts:71-73`) and its stale 2-arg call site (`ComposeScreen.tsx:798-801`); 35-03's own `tsc --noEmit` gate (`35-03-PLAN.md:106`); `markAssistLogged`'s required `{ assistUid, connected: 0|1, now }` payload (`interaction-assist-dao.ts:74-84`) and its live callers (`AssistBanner.tsx:43`, `PendingConfirmationsSheet.tsx:43`); `readCustomFields` being **private/non-exported** (`profile-knowledge-read.ts:131`); the partial-unique-primary index (`009-contact-method-normalization.ts:235`) and the diff core's clear-before-set discipline (`contact-methods-dao.ts:179-197`); `aiKeyStore.getKey`'s `AiCloudProviderId` param excluding `'none'` (`ai-key-store.ts:48`, `ai-types.ts:48/79`); and the memories read seam (`memories-read.ts:38/54/74/86` — `listMemoriesForContact` filters only `deleted_at IS NULL`, the `allow_ai` predicate lives in the separate `listAiEligibleMemories`).

**Cycle-4 → cycle-5 delta.** Cycle 4 recorded `current_high=0 current_actionable=5`. The replan `5ff1f0b` closed all 5 (aggregator-verified against the current plans):

1. **[closed] 35-08 stale `:215-240` adapter anchor / provider-wiring not re-documented.** 35-08 Task 2/read_first now RE-CREATES the generate adapter with the provider-wiring **inlined as concrete identifiers** (`service.refreshProviders`/`getActiveProvider`/model-selection/`resolveMaxOutputTokens(...,catalogRef.current)`) and an acceptance grep for `resolveMaxOutputTokens`+`getActiveProvider` (`35-08-PLAN.md:114,120,129`); the dead line-anchor is gone.
2. **[closed] 35-08 three-state availability not sourced/wired.** 35-08 Task 4 now OWNS credential-sourcing: on-focus async `aiKeyStore.getKey` presence-only read + a node-pure `isCredentialFailure(code)` predicate on `ai-availability.ts` for observed-unauthorized → needs-attention, with unit coverage (`35-08-PLAN.md:176,186`). Anchors verified: `getKey` at `ai-key-store.ts:48/:86`, `AiErrorCode` at `AiService.ts:98-109`.
3. **[closed] 35-09 origin-aware exit lacked a disposition table.** 35-09 Task 2 now encodes the per-path `composeExitDisposition(exit)` helper in `compose-logic.ts` (Back/Copy/"Not yet"/pending → preserve; confirmed-log → clearSession + removeFinishedRoute) with per-path unit tests (`35-09-PLAN.md:120-125,134`).
4. **[closed] 35-06 Research per-source display-visibility predicate.** 35-06 Task 2 now applies an explicit show/hide predicate per source (memory `resolveVisibility`, quarantine+populated custom fields, `resolveRelationshipVisibility` for hidden relationships, `getCurrentStateValues` only — never `getCurrentStateHistory`) with tests that hidden/soft-deleted/historical entries never render (`35-06-PLAN.md:115-120,135`). All cited helpers verified on disk.
5. **[closed] 35-08 stale `aiErrorText :488-506` anchor.** 35-08 Task 4 now RE-CREATES the sanitized error-code→short-line mapping (not "preserve") and 35-01 Task 3 explicitly REMOVES `aiErrorText` (`35-01-PLAN.md:158`, `35-08-PLAN.md:171,178`).

**But the cycle-5 replan and a deeper source-grounded re-review of the newly-specified seams surfaced NEW findings.** `current_high` is **1** (not 0): a real, unguarded **wave-2 build-breaker** — 35-03 extends `resolveComposeControls` to more required params while the sole consumer `ComposeScreen.tsx:798` (kept at 2 args by 35-01, rewired only by 35-07 in wave 3) is NOT in 35-03's scope, so 35-03's own `tsc --noEmit` gate breaks. This is the *mirror* of build-breaker #1 (AiSuggestionLifecycle), which the phase engineered around by stripping the consumer in wave 1 before narrowing in wave 2 — but here the treatment is left asymmetric. `current_actionable` is **6**. Findings are counted ONLY against the current plans; the 5 resolved cycle-4 items and all resolved cycle-1/2/3 items are excluded and retained verbatim below for convergence history.

## Consensus Summary

Both source-grounded lanes agree the nine-plan sequence is mature, correctly staged, and that the highest-consequence areas are sound. Aggregator-verified points of agreement:

- **All 5 cycle-4 actionable findings are genuinely closed** (aggregator-verified against the current plans; see the delta above).
- **No decision reversal, no owner escalation.** The owner-ratified ADR-107/D-14 off-limits exclusion is enforced exactly (no relaxation, no `avoidanceConstraints` shape, no `fuel` AI-permission column; `fuel-read.ts` structurally excludes `off_limits`, `ai-context-read.ts` reads only channel/quality/connected); the ADR-078 `allow_ai`-gated recent-interaction note carry remains in force. Both lanes independently confirm this is a correct owner-ratified reversal, NOT a regression. Neither lane raised an owner-escalation item.
- **The AI-lifecycle reshape ordering is airtight** — the reshaped `AiSuggestion*` contract has exactly four consumers (`ComposeScreen.tsx` [35-01 strips / 35-08 re-wires], `ai-suggestion-logic.ts`+`.test.ts` [35-04], `ai-suggestion-compose-integration.test.ts` [35-04 Task 1]); all three prior orphaned-test build-breakers remain closed and plan-owned. The HIGH-2 abort-before-null gap (`ai-suggestion-logic.ts:305-308`), the HIGH-1 `performReachOut` return widening, and the migration head (027→028, additive) all re-verify.

**The one HIGH is NOT a consensus finding — it is a divergent, single-lane (Claude) catch that Codex missed, and the orchestrator verified it as real.** Codex and Claude raised **largely non-overlapping** findings this cycle; notably, BOTH found *distinct* defects in 35-03 (Codex: the Task-4 primary-swap ordering contradiction; Claude: the Task-1 `resolveComposeControls` signature break) and BOTH found *distinct* defects in 35-06 (Codex: the private `readCustomFields`; Claude: the Task-1-before-Task-2 `ResearchItem` ordering). This is the value of two lanes — neither alone would have surfaced the full set.

### Agreed Strengths
- **Off-limits egress fully closed and enforced, not relaxed** (both lanes; aggregator-verified `fuel-read.ts`, 35-05 carry-only shape).
- **The full reshaped-AI-contract consumer set is enumerated and plan-owned; 35-01 strips before 35-04 narrows** (both lanes independently grepped the 4-file set).
- **HIGH-2 abort-before-null is a real defect, precisely targeted** (both lanes; `ai-suggestion-logic.ts:305-308`).
- **Migration head verified 027 → 028 additive** (both lanes; `database.ts:68`, mirrors 027 / `PORTABLE_SETTINGS_KEYS` allowlist).
- **Per-source Research eligibility is grounded in verified schema asymmetry** (both lanes; memories `allow_ai`, custom fields `share_with_ai`, relationships/first-class none).

### Agreed Concerns
- **35-03 carries two independent, verified execution defects** (one per lane, non-overlapping): the Task-1 `resolveComposeControls` signature break (Claude — HIGH) and the Task-4 primary-swap ordering contradiction (Codex — MEDIUM, tests fence it).
- **35-06 has two independent, verified defects** (one per lane): the private `readCustomFields` import (Codex) and the Task-1-before-Task-2 `ResearchItem` ordering (Claude).

### Divergent Views
- Codex rated overall risk MEDIUM; Claude rated it MEDIUM. No genuine disagreement on severity of the shared areas. The divergence is in *coverage*: each lane found real defects the other missed. The orchestrator independently verified every finding from both lanes against the code; one (Claude's `resolveComposeControls`) holds as a HIGH (35-03's own `tsc` gate breaks with no in-scope fix), the rest as actionable MEDIUM/LOW.

## Aggregator-Verified Findings (for the planner)

All findings below are verified on disk against the CURRENT plans and are NOT yet incorporated or deferred in any PLAN.md. None reverses a recorded decision; there are **no owner escalations**.

### HIGH (current_high = 1)

**H1. [HIGH · claude · 35-03 Task 1 · VERIFIED] `resolveComposeControls` signature extension is an unguarded wave-2 build-breaker.** `resolveComposeControls(hasPhone: boolean, smsAvailable: boolean | null)` is a 2-**required**-param function (`compose-logic.ts:71-73`); its only consumer calls it with exactly 2 positional args at `ComposeScreen.tsx:798-801`. 35-01 (wave 1) DELIBERATELY keeps that 2-arg call ("do NOT anticipate the plan-35-03 mode extension here" — `35-01-PLAN.md:158`). 35-03 (wave 2) Task 1 "Extend the pure gate to take a `mode` ('text'|'email') and both destination presences (hasPhone, hasEmail) plus smsAvailable" (`35-03-PLAN.md:103`) but does NOT include `ComposeScreen.tsx` in its `files_modified` (`35-03-PLAN.md:8-13`), and gives no instruction to make the new params optional or to preserve a compiling 2-arg call. The ComposeScreen rewire is owned by 35-07 (wave 3; `35-07-PLAN.md:8` files_modified). 35-03 Task 1's own gate is `npx vitest ... && npx tsc --noEmit` (`35-03-PLAN.md:106`) and the phase gate is a project-wide `tsc --noEmit` (`:219`). Under the natural required-param implementation, the stale 2-arg VALUE call at `ComposeScreen.tsx:798` fails to type-check ("Expected N arguments, but got 2"), breaking 35-03's own gate and the wave-2/phase `tsc` gate before 35-07 rewires it. This is the exact failure mode the phase engineered around for `AiSuggestionLifecycle` (strip consumer in wave 1 BEFORE narrowing in wave 2), but here the order is inverted (contract changes wave 2; consumer fixed wave 3) with NO protective strip. It is neutralized ONLY if 35-03 makes the added params optional (e.g. `mode` defaulting to `'text'`, `hasEmail` optional) so the 2-arg Text call keeps compiling through wave 2 — which the plan neither states nor guarantees. **This is a planner call, not an owner escalation** (no recorded-decision reversal). **PLAN edit:** in 35-03 Task 1, require the extension to keep the existing 2-arg Text call at `ComposeScreen.tsx:798` compiling through wave 2 (make `mode`/`hasEmail` optional with `mode` defaulting to `'text'`), OR move the ComposeScreen rewire into 35-03 the way build-breaker #1 was handled; add a typecheck acceptance line asserting the pre-35-07 ComposeScreen still type-checks.

### Actionable non-HIGH (current_actionable = 6)

**A1. [MEDIUM · codex · 35-01 Task 3 · VERIFIED] `markAssistLogged({ assistUid })` under-specifies the required payload.** The DAO requires `markAssistLogged(exec, { assistUid: string; connected: 0 | 1; note?; now: string })` (`interaction-assist-dao.ts:74-84`); both live callers pass `{ assistUid, connected, now: localDateTime() }` (`AssistBanner.tsx:43`, `PendingConfirmationsSheet.tsx:43`). The plan's Task 3 action and acceptance criteria call `markAssistLogged({ assistUid })` (`35-01-PLAN.md:158,169`) — omitting the executor arg, the required `now`, and the required `connected`, whose value for "Yes, log interaction" on an OUTBOUND reach-out is an undecided semantic. An executor following the acceptance verbatim writes a `tsc` error; the `connected` value is a genuine decision the plan should make. **PLAN edit:** specify the confirmation payload — `markAssistLogged(getExecutor(), { assistUid, connected: <decide 0|1 for an outbound handoff>, now: localDateTime() })` — and keep the "only clear the session after the call resolves" guarantee.

**A2. [MEDIUM · codex · 35-06 Task 2 · VERIFIED] 35-06 imports a private read (`readCustomFields`) and omits its owning file from scope.** `readCustomFields` is a **non-exported** function (`profile-knowledge-read.ts:131` — no `export`); only `readProfileKnowledge` (:200, whose `ProfileCollection` construction caps items) and `readProfileOffLimits` (:182) are exported. 35-06 Task 2 composes "via the `readCustomFields`/profile-knowledge projection" (`35-06-PLAN.md:117`) but lists only `compose-research-read.ts`+`.test.ts` in `files_modified` (`:7-9`) — so the new module cannot import `readCustomFields`, and falling back to `readProfileKnowledge` would silently apply the capped Profile-collection behavior. **PLAN edit:** add `src/db/profile-knowledge-read.ts` to 35-06's `files_modified` and export a narrow, populated-only custom-field projection (NOT the capped collection), or define a dedicated read-only DAO helper.

**A3. [MEDIUM · codex · 35-03 Task 4 · VERIFIED] Primary-swap prose is self-contradictory about ordering.** `35-03-PLAN.md:179` says, in one sentence, "FIRST verify the promote target — **set is_primary=1** for the chosen row ... assert EXACTLY ONE row changed; if the promote matches zero rows ... make NO write" (promote-first) and, in the next, "Order the two statements to respect SQLite's statement-immediate partial-unique index ... **clear** the prior is_primary=1 ... and set the new one" (clear-first). The partial-unique index `idx_contact_methods_primary_type ON contact_methods (contact_id, method_type) WHERE is_primary = 1` (`009-contact-method-normalization.ts:235`) is statement-immediate, so a promote-first `UPDATE ... SET is_primary=1` while a different primary of that type still exists throws `SQLITE_CONSTRAINT` on every real swap (it never reaches the "zero rows" branch). The in-scope tests (`contact-methods-dao.test.ts`, `35-03-PLAN.md:186-190`) DO fence the correct behavior (swap clears old; type-mismatch makes no write; exactly-one-row), so a wrong implementation cannot ship — but the contradictory prose will cost executor cycles. **PLAN edit:** rewrite the Task-4 algorithm as pre-READ/validate the target belongs to `(contactId, methodType)` → clear the prior primary → promote with the `id + contact_id + method_type` predicate and assert one changed row, all in one transaction that rolls back on a zero-row promote.

**A4. [MEDIUM · codex · 35-08 Task 4 · VERIFIED] Must narrow `'none'` before calling `aiKeyStore.getKey`.** `getKey(provider: AiCloudProviderId)` (`ai-key-store.ts:48`) where `AiCloudProviderId = Exclude<AiProviderId, "none">` (`ai-types.ts:48`), but `settings.aiProvider: AiProviderId` includes `'none'` (`ai-types.ts:79`). 35-08 Task 4 calls `aiKeyStore.getKey(activeProvider)` (`35-08-PLAN.md:176`) with no `'none'` narrowing — a `tsc` error, and semantically `'none'` = AI Off (no credential needed). **PLAN edit:** add an explicit branch — when the active provider is `'none'`, set `credentialPresent=false` and skip `getKey` (availability resolves to Off); test it as an Off state with zero key-store reads.

**A5. [MEDIUM · claude · 35-06 Task 1 · VERIFIED (import-style dependent)] Task 1 (session store) precedes Task 2 (which defines `ResearchItem`).** Task 1 (`35-06-PLAN.md:76`) extends `compose-session-store.ts` so `addToFocus` "accepts the VALIDATED normalized `ResearchItem` shape from plan Task 2 (`compose-research-read.ts`)" (`:85`); `ResearchItem` does not exist on disk yet (`grep -rn "ResearchItem" src/` returns nothing) — Task 2 (`:101`) creates it. Task 1's gate is `vitest run compose-session-store.test.ts` (`:97`). If the store uses a runtime/value import of the not-yet-created module it fails at Task 1; a `import type` is erased by vitest's esbuild and would instead surface at the next `tsc` gate (Task 2, by which point the module exists). Either way the ordering is fragile. **PLAN edit:** reorder so `compose-research-read.ts`+`ResearchItem` (Task 2) land before the store consumes the type, or specify a type-only import from the Task-2 module.

**A6. [LOW · claude · 35-08 Task 1 · VERIFIED] Acceptance greps against `prompt-template.ts` need `grep -a`.** The file embeds a NUL `FIELD_MARKER` (verified — plain `grep -n "resolvePrompt" src/ai/prompt-template.ts` reports "binary file matches" / no line info although the symbol exists at :142). Any executor acceptance grep pointed at `prompt-template.ts` (35-08 Task 1 verifications) will produce misleading output. No correctness impact (`tsc`/`vitest` are the real gates). **PLAN edit:** note in 35-08 that greps against `prompt-template.ts` must use `grep -a`.

**Observational (not counted; not a required PLAN edit):**
- **[LOW · claude · 35-01] `performReachOut` return-widening touches two callers outside `files_modified`** — `ReachOutRouter.tsx:42` and `ContactProfileScreen.tsx:194`. Claude verified BOTH `await` and ignore the return value, so the `void → { handoffStarted, assistUid }` widening is safe and 35-01's `tsc --noEmit` gate confirms it. A one-line note would help the executor but no plan edit is required for correctness.
- **The uncommitted `tsconfig.json` working-tree change** (carried from cycle 4; drops `.expo/types/**/*.ts` + `expo-env.d.ts` from `include`) — every plan gate is a project-wide `tsc --noEmit`, so confirm this narrowing is intended before the phase runs. Out of Phase-35 plan scope; surfaced for the owner.

## Codex Review

_`gpt-5.6-terra`, reasoning=low, via `codex exec` (read-only repo). Aggregator verified each finding against disk: findings 1/2/4 (markAssistLogged args, private readCustomFields, 'none' narrowing) hold as actionable MEDIUM; finding 3 (primary-swap ordering) holds as a real contradiction but the plan's in-scope tests fence correctness, so it is MEDIUM (clarity), not the "unsafe implementation" HIGH Codex rated it. Codex did not catch the `resolveComposeControls` wave-2 gate break (Claude did)._

## Summary

The plans are substantially converged: wave ordering correctly removes old AI consumers before narrowing lifecycle types, preserves the durable assist lifecycle, and explicitly owns previously orphan-prone tests. I found three execution-blocking inconsistencies and one smaller type-safety gap.

## Strengths

- The assist design preserves the sole-recency-writer invariant: `markAssistLogged` stamps `occurredAt` from `handoff_at` and remaps transport vocabulary centrally. [interaction-assist-dao.ts](/home/bwales/projects/orbit-app/src/db/interaction-assist-dao.ts:74)

- The AI reshape has identified both real stale-contract test consumers—`ai-suggestion-logic.test.ts` and `ai-suggestion-compose-integration.test.ts`—and assigns both to 35-04. Those files currently consume the ack-gated union and `Promise<string>` generator contract. [ai-suggestion-compose-integration.test.ts](/home/bwales/projects/orbit-app/src/logic/ai-suggestion-compose-integration.test.ts:94)

- 35-09 correctly owns the existing orphaned navigation test: it currently imports the retired helper and asserts `requestAiSuggestion`. [ai-suggestion-navigation.test.ts](/home/bwales/projects/orbit-app/src/navigation/ai-suggestion-navigation.test.ts:11)

- The Research plan correctly recognizes that relationships have no AI-permission field and that relationship visibility must be explicitly applied. [relationships-read.ts](/home/bwales/projects/orbit-app/src/db/relationships-read.ts:5)

## Concerns

- **HIGH — 35-01’s confirmation call cannot type-check as written.** The plan repeatedly specifies `markAssistLogged({ assistUid })`, but the actual DAO requires `connected: 0 | 1` and `now: string` in addition to `assistUid`. [interaction-assist-dao.ts](/home/bwales/projects/orbit-app/src/db/interaction-assist-dao.ts:74)  
  The plan must specify the Compose confirmation payload, e.g. `connected: 1, now: localDateTime()`, and preserve failure handling so the session is only cleared after the call resolves.

- **HIGH — 35-06 references an unavailable custom-field read.** `readCustomFields` is a private, non-exported function in `profile-knowledge-read.ts`; the plan’s new `compose-research-read.ts` cannot import it. [profile-knowledge-read.ts](/home/bwales/projects/orbit-app/src/db/profile-knowledge-read.ts:131)  
  Further, the plan does not list `profile-knowledge-read.ts` as modified. Add it to 35-06 and export a narrow read-only custom-field projection, or define a dedicated DAO read. Do not substitute the capped Profile collection behavior accidentally.

- **HIGH — 35-03’s primary-swap algorithm has contradictory ordering.** It requires validating/promoting the new primary before clearing the old one, while the actual partial unique index makes that impossible during a swap. The existing DAO explicitly clears first because SQLite enforces that index per statement. [contact-methods-dao.ts](/home/bwales/projects/orbit-app/src/db/contact-methods-dao.ts:180)  
  Revise the plan to: transactionally pre-read/validate that the target belongs to `(contactId, methodType)`, then clear the old primary, then promote with the exact `id + contact_id + method_type` predicate and assert one changed row. This maintains the “bad target makes no writes” guarantee without violating the unique index.

- **MEDIUM — 35-08 must explicitly narrow away `'none'` before reading SecureStore.** `aiKeyStore.getKey` accepts only `AiCloudProviderId`, while `aiProvider` can be `'none'`. [ai-key-store.ts](/home/bwales/projects/orbit-app/src/services/ai-key-store.ts:45) [ai-types.ts](/home/bwales/projects/orbit-app/src/services/ai-types.ts:23)  
  Add an explicit branch: when provider is `'none'`, set credential presence to false and do not call `getKey`.

## Suggestions

- Amend 35-01’s acceptance criteria to assert the exact `markAssistLogged` arguments and that a rejected confirmation leaves the local panel/session intact.

- Amend 35-06’s file list and task description to introduce an exported, populated-only custom-field projection rather than relying on a private Profile helper.

- Rewrite 35-03 Task 4’s transaction pseudocode around pre-validation → clear → guarded promote.

- Add the `'none'` provider branch to 35-08’s availability-sourcing task and test it as an Off state with zero key-store reads.

## Risk Assessment

**MEDIUM.** The architecture and dependency ordering are strong, and the identified old-contract tests are now assigned to owning plans. However, the two stated implementation contradictions in 35-01 and 35-03 plus the inaccessible read in 35-06 would otherwise cause either immediate type/build failures or an unsafe primary-swap implementation.

## Claude Review

_Read-only Claude Code subagent (model id not recoverable, recorded `unknown`); full source-grounded access. Aggregator verified each finding against disk: the `resolveComposeControls` HIGH holds (35-03's own `tsc` gate breaks with no in-scope fix); the 35-06 task-ordering MEDIUM holds (import-style dependent); the two LOWs hold (the `performReachOut` note is verified-safe/observational, not counted)._

# Phase 35 (Messaging & AI Compose) — Cross-AI Plan Review, Convergence Cycle 5

## 1. Summary

This is a mature, well-anchored plan set. I verified the load-bearing claims against the actual code on disk (not the plan text), and the great majority hold exactly: the reshaped/removed AI contracts have a fully-enumerated, plan-owned consumer set; the three named orphaned-test build-breakers (#2 `lifecycle-consumer-ledger.test.ts:431`, #3 `ai-suggestion-compose-integration.test.ts`, and `ai-suggestion-navigation.test.ts`) are real and each sits in the correct owning plan's `files_modified`; the HIGH-2 abort-before-null gap, the HIGH-1 `performReachOut` return widening, the migration head (027→028), and the off-limits egress exclusion (D-14/ADR-107, correctly treated as owner-ratified, not a regression) are all accurate. The plans are internally consistent across waves for the AI-lifecycle seam. I found **one genuine build-breaker risk the convergence appears to have missed**: the `resolveComposeControls` signature extension in 35-03 (wave 2) is the *mirror image* of build-breaker #1 but is **not** protected the same way — the stale 2-argument call site in `ComposeScreen.tsx` is not rewired until 35-07 (wave 3), so 35-03's own `tsc` gate breaks under the natural (required-param) implementation. Everything else is LOW/MEDIUM polish.

## 2. Strengths

- **The reshaped-AI-contract consumer set is complete and plan-owned.** `grep -rln "AiSuggestionLifecycle\|AiSuggestionState\|AiSuggestionDeps" src/` returns exactly four files: `src/logic/ai-suggestion-logic.ts`, `src/logic/ai-suggestion-logic.test.ts`, `src/logic/ai-suggestion-compose-integration.test.ts`, `src/screens/ComposeScreen.tsx`. 35-01 (wave 1) strips ComposeScreen's usage *before* 35-04 (wave 2) narrows the union — so 35-04's project-wide `tsc` gate has no un-stripped consumer left. This is the correct fix for build-breaker #1 and it is airtight.
- **HIGH-1 (`performReachOut` return widening) is correctly diagnosed and safe.** `handoff.ts:49` returns `Promise<void>`; `assistUid` is created at :50 and used only internally for `markAssistFailed` at :68-69, never returned. The two external callers — `ReachOutRouter.tsx:42` and `ContactProfileScreen.tsx:194` — both `await performReachOut(...)` and ignore the result, so widening `void → { handoffStarted, assistUid }` cannot break them even though they are outside 35-01's `files_modified`. The "no fragile re-query" design (log the returned `assistUid`) is a real correctness improvement over timestamp-matching.
- **HIGH-2 (abort-before-null) targets a real defect.** `ai-suggestion-logic.ts:305-308` — the egress `catch` does `this.stopTimer(); this.controller = null;` with **no** `controller.abort()`, whereas `onTimeout` (:351-353) and `cancel`/`invalidate` do abort. So on a fan-out rejection the in-flight sibling `generate` calls would be orphaned. 35-04's fix (abort before null on a non-stale rejection) is precisely scoped.
- **All three orphaned-test build-breakers are verified real and owned.** `lifecycle-consumer-ledger.test.ts:431` contains the exact `expect(screen).toContain('navigation.navigate("Compose", { contactId })')` string, matching `ContactProfileScreen.tsx:335` verbatim — owned by 35-09 Task 2. `ai-suggestion-compose-integration.test.ts` references the retired contract (`acknowledgeProvider` :94/:135-137, `needs-acknowledgement` :176-177, `generate: … Promise<string>` :121) — owned by 35-04 Task 1. `ai-suggestion-navigation.test.ts` imports `consumeAiSuggestionIntent` (:11) and asserts `requestAiSuggestion` (:47-58) — owned by 35-09 Task 3. Each named file is in the owning plan's `files_modified`.
- **Off-limits egress (D-14/ADR-107) is correctly implemented as a reversal, not a regression.** `docs/decisions/ADR-107-off-limits-excluded-from-all-ai-egress.md` exists; `fuel-read.ts` has no `allow_ai`/`share_with_ai` column and structurally excludes `off_limits` from `getRankedFuel` (:19-22, :58, :95, :121); `ai-context-read.ts` reads only `channel, quality, connected` from interactions (:117) and never selects off-limits. 35-05 correctly drops `avoidanceConstraints`, adds no `fuel` AI-permission column, and carries only the gated-note shape. This matches the owner-ratified decision.
- **HIGH-6 (per-source Research eligibility) is grounded in verified schema asymmetry.** Confirmed on disk: memories carry `allow_ai` (`memories-read.ts:24`, `MEMORY_AI_ELIGIBILITY` :31); custom fields carry `share_with_ai` (`profile-knowledge-read.ts:88`); `RelationshipRow` (`relationships-read.ts:5`) has neither; first-class fields have neither. Normalizing to a `ResearchItem` with a read-boundary `aiEligible` is the right shape, and 35-06's display-visibility predicate correctly distinguishes `getCurrentStateValues` (`is_current=1`, :41-48) from `getCurrentStateHistory` (:67) to prevent historical leakage, and `resolveRelationshipVisibility` (:41) / `resolveVisibility` (`memories-read.ts:99`) for hidden filtering.
- **HIGH-5 (route registration) is real and correctly scoped.** `DashboardStack.tsx:59` and `OrreryStack.tsx:73` register only `Compose`; neither registers `ComposeResearch`, and `navigation/types.ts:102/:171` have no such route. 35-09 registers it in both stacks + both param lists.
- **Migration discipline verified.** Head on disk is `027-default-interaction-channel.ts`; `database.ts:68 TARGET_VERSION = DEFAULT_INTERACTION_CHANNEL_SCHEMA_VERSION`, so next = 028. 35-02's additive `app_settings`-only migration mirrors 027, adds keys to `PORTABLE_SETTINGS_KEYS` (allowlist-not-emit, backup-schema.ts:135 + the :160-200 idiom) with no format bump — consistent with the milestone pattern.
- **The prompt-template construction-order subtlety (35-08 MEDIUM #6) is correctly diagnosed.** `resolvePrompt` (`prompt-template.ts:142`) builds a scaffold, measures `baseCount` on the scaffold-without-fields, runs the shared-field budget loop, then applies a final hard-trim to `TOTAL_LIMIT`. Putting the MESSAGE TO REWRITE block in the scaffold (so it's reserved up front, not appended after the loop where the hard-trim could sever its closing fence) is the right call. The carry-only claim for 35-05 also holds: `resolvePrompt` serializes named fields explicitly and never spreads `context`, so an added optional `PromptContext` field is not transmitted.
- **D-06 remap is genuinely already-done (Trip-Wire 2).** `interaction-assist-dao.ts:112` calls `remapLegacyChannel(transactionAssist.channel)`, and `markAssistLogged` stamps `occurredAt: transactionAssist.handoff_at` (:105). The plans correctly add no translation work and lock these with tests.

## 3. Concerns

- **HIGH: `resolveComposeControls` signature-extension is an un-protected wave-2 build-breaker (the mirror of build-breaker #1, left asymmetric).** Current signature is 2 required params — `resolveComposeControls(hasPhone: boolean, smsAvailable: boolean | null)` (`compose-logic.ts:71-74`) — and `ComposeScreen.tsx:798-801` calls it with exactly two positional args. 35-01 (wave 1) *deliberately* keeps this 2-arg call ("do NOT anticipate the plan-35-03 mode extension here"). 35-03 (wave 2) then "extend[s] the pure gate to take a `mode` … and both destination presences (hasPhone, hasEmail) plus smsAvailable" and **does not modify `ComposeScreen.tsx`** (not in its `files_modified`); the screen is not rewired to the new signature until **35-07 (wave 3)**. 35-03 Task 1's own gate is `npx tsc --noEmit` (project-wide), and the wave-2 merge gate is a full `tsc --noEmit`. Under the natural implementation (adding a required `mode`/`hasEmail`), the stale 2-arg call at `ComposeScreen.tsx:798` fails to type-check ("Expected 4 arguments, but got 2"), breaking 35-03's own gate and the wave-2 gate. This is exactly the failure mode the phase engineered around for `AiSuggestionLifecycle` (strip the consumer in wave 1 *before* narrowing in wave 2), but here the order is inverted (contract changes in wave 2; consumer fixed in wave 3) with **no** protective strip. It is neutralized only if 35-03 makes the added parameters optional / provides a backward-compatible overload so the 2-arg Text call keeps compiling until 35-07 — which the plan neither states nor guarantees. *Actionable fix:* add one sentence to 35-03 Task 1 requiring the extension to preserve a compiling 2-arg Text call through wave 2 (optional `mode` defaulting to `'text'` and optional `hasEmail`), OR move the ComposeScreen rewire into 35-03 the way build-breaker #1 was handled. This is not a recorded-decision reversal, so it is a planner call, not an owner escalation.

- **MEDIUM: 35-06 orders Task 1 (session store) before Task 2 (which defines the type Task 1 imports).** Task 1 extends `compose-session-store.ts` so `addToFocus` "accepts the VALIDATED normalized `ResearchItem` shape from plan Task 2 (`compose-research-read.ts`)". `ResearchItem` does not exist yet (`grep -rn "ResearchItem" src/` returns nothing) — it is created in Task 2. Task 1's verify is `npx vitest run src/stores/compose-session-store.test.ts`; the store importing `ResearchItem` from a not-yet-created `@/db/compose-research-read` will fail module resolution at Task 1. *Actionable fix:* reorder so `compose-research-read.ts` (Task 2) lands before the store consumes its type, or define/import `ResearchItem` type-only from a module created first. Self-contained within 35-06.

- **LOW: `prompt-template.ts` contains an embedded NUL sentinel that makes grep-based acceptance checks on that file unreliable.** `FIELD_MARKER = "\0FIELDS\0"` (verified around byte offset ~9108) causes GNU `grep`/`ripgrep` to treat the file as binary and silently suppress line-level matches (this is why `grep -n "resolvePrompt" src/ai/prompt-template.ts` returned nothing while the symbol exists at :142). This is intentional, pre-existing, and correct design — but any executor acceptance grep pointed at `prompt-template.ts` (35-08 Task 1 verifications) may print "binary file matches" with no line info. *Actionable fix:* note in 35-08 that greps against `prompt-template.ts` must use `grep -a`. No correctness impact; `tsc`/`vitest` are the real gates.

- **LOW: `performReachOut` return-type widening touches two callers outside 35-01's `files_modified`.** `ReachOutRouter.tsx:42` and `ContactProfileScreen.tsx:194` call the function. I verified both ignore the return value, so the widening is safe and 35-01's `tsc --noEmit` gate will confirm it — but this is worth a one-line note in 35-01 so the executor doesn't assume `handoff.ts` is the only affected file.

## 4. Suggestions

- **35-03, Task 1 (fixes the HIGH):** State explicitly that the extended `resolveComposeControls` must keep the existing 2-argument Text call site in `ComposeScreen.tsx:798` compiling through wave 2 — e.g. make `mode` optional (default `'text'`) and `hasEmail` optional — so 35-03's own `tsc --noEmit` gate and the wave-2 merge gate pass before 35-07 (wave 3) supplies the real mode/hasEmail. Add a grep/typecheck acceptance line asserting the pre-35-07 ComposeScreen still type-checks. This makes the treatment symmetric with build-breaker #1.
- **35-06, Tasks 1–2:** Swap task order (create `compose-research-read.ts` + `ResearchItem` first, then extend the store to consume it), or add a `read_first`/note that the store's `ResearchItem` import depends on Task 2 existing.
- **35-08, Task 1 verify:** Change any `grep` acceptance check that targets `src/ai/prompt-template.ts` to `grep -a` (the NUL `FIELD_MARKER` makes plain grep report "binary file matches" without line numbers).
- **35-01, Task 2:** Add a note that `ReachOutRouter.tsx` and `ContactProfileScreen.tsx` also call `performReachOut` and are return-safe (verified: both ignore the result), so the executor confirms them under the `tsc` gate rather than assuming single-caller scope.

## 5. Risk Assessment

**Overall: MEDIUM.** The data-layer invariants (off-limits egress closure, allow_ai gating, single-writer recency, migration additivity), the AI-lifecycle reshape ordering, and every named orphaned-test build-breaker are correct and verified against disk — the highest-consequence areas (privacy egress, irreversible migration, decision reversals) are sound and the owner-ratified D-14/ADR-107 reversal is handled correctly. The residual risk is concentrated in one un-protected wave-2 signature-extension ordering gap (`resolveComposeControls`) that would break the wave-2 `tsc` gate under the natural implementation; it is a one-line planning clarification away from resolved and is a planner call, not an owner escalation. The two remaining items are a self-contained intra-plan task-ordering fix (35-06) and a grep-ergonomics note. No security, data-corruption, or recorded-decision-reversal risk remains open.

---
**Finding counts:** 1 HIGH, 1 MEDIUM, 2 LOW (all actionable). No owner-escalation items.

<!-- ============================================================= -->
<!-- CYCLE 4 + PRIOR ARCHIVE (superseded by cycle 5 / 5ff1f0b).    -->
<!-- Cycle-4 frontmatter was: cycle: 4, cycle_summary: current_high=0 current_actionable=5. -->
<!-- Retained verbatim for convergence history. Counts below are prior-cycle. -->
<!-- ============================================================= -->

# Cross-AI Plan Review — Phase 35: Messaging & AI Compose (cycle 4)

Convergence **cycle 4**, re-reviewing the CURRENT plans on disk after the cycle-3 replan `12e9e64` (closed 7 actionable cycle-3 findings incl. 2 build-breakers) and the plan-checker/orchestrator pass `790b4ab` (closed a THIRD orphaned-test build-breaker inline: 35-04 Task 1 now reshapes `src/logic/ai-suggestion-compose-integration.test.ts`, and records that `settings-ai-logic`'s `buildProviderAckViewState` is deliberately left for Phase 36). Two source-grounded reviewers ran: **Codex** (`gpt-5.6-terra`, reasoning=**low**, via `codex exec` with read-only repo access) and **Claude** (a read-only Claude Code subagent — the `claude -p` CLI lane is not used in this repo due to a known Write-permission failure; model id not recoverable from a subagent, recorded `unknown`). Both cited concrete `file:line` evidence against the live repo; neither ran without repo access. The orchestrator (this aggregator) independently re-verified every load-bearing claim against the code on disk per "review the code, not the diff": migration head (highest registered `027-*`, `DEFAULT_INTERACTION_CHANNEL_SCHEMA_VERSION = 27` at `027-default-interaction-channel.ts:28`, `TARGET_VERSION` at `database.ts:68` → 35-02's `028` = head+1); the ADR-107/D-14 off-limits exclusion (`fuel-read.ts:133` `RANKED_FUEL_EXCLUSIONS = kind != 'off_limits'`, 35-05 carries no `avoidanceConstraints` shape and adds no `fuel` AI column); the full consumer set of the reshaped `AiSuggestion*` contract; the ComposeScreen generate-adapter at `ComposeScreen.tsx:215-240`; and 35-08 Task 2's own wording.

**Cycle-3 → cycle-4 delta:** cycle 3 recorded `current_high=0 current_actionable=7`. The replan + inline fix closed all 7 (verified): the third orphaned-test build-breaker (`ai-suggestion-compose-integration.test.ts`) is now in 35-04's `files_modified` and its retired-ack assertions are scheduled for reshaping in the SAME task that runs the project-wide `tsc` gate; `settings-ai-logic.ts` is confirmed on disk to import no `AiSuggestion*` symbol (not a build-breaker; correctly deferred). **`current_high=0` holds this cycle; `current_actionable` is 5** — a fresh set of plan-completeness gaps, all concentrated in the two ComposeScreen expansion passes (35-08) plus refinements to 35-09 and 35-06. Findings are counted only against the current plans; resolved cycle-1/2/3 items are excluded and retained verbatim below for convergence history.

## Consensus Summary

Both source-grounded lanes agree the nine-plan sequence is in strong shape and **execution-ready modulo small PLAN.md edits**. Aggregator-verified points of agreement:

- **No HIGH-severity concern survives verification (`current_high=0`).** Neither lane raised a HIGH; both explicitly confirm no execution-time build-breaker and no orphaned consumer of any reshaped contract remains unowned by a plan.
- **No decision reversal, no owner escalation.** The owner-ratified ADR-107/D-14 off-limits exclusion is enforced exactly (no relaxation, no `avoidanceConstraints` shape, no `fuel` AI-permission column); the ADR-078 `allow_ai`-gated recent-interaction note carry and the Group Notes AI ban remain in force.
- **All three prior orphaned-test/consumer build-breakers are genuinely closed** (aggregator grep: consumers of `AiSuggestionLifecycle|AiSuggestionState|AiSuggestionDeps` = exactly `ComposeScreen.tsx` [35-01 strips / 35-08 re-wires], `ai-suggestion-compose-integration.test.ts` [35-04 Task 1], `ai-suggestion-logic.ts` + `.test.ts` [35-04]; `app-settings-dao.test.ts`'s `acknowledgeProvider` is the KEPT DAO writer, not the retired lifecycle contract; migration 004 is a comment mention; `settings-ai-logic.ts` references none of the union — no fourth orphan of this class).
- **Migration numbering (028 = head+1) is correct** and gated behind a `blocking-human` irreversibility checkpoint (35-02).
- **The HIGH-2 abort bug is real and correctly targeted** — `ai-suggestion-logic.ts:304-310` nulls `this.controller` in the egress catch with no `controller.abort()`; 35-04 mirrors the `onTimeout`/`cancel` abort-then-null path.

The residual risk is a set of actionable MEDIUM/LOW plan-hygiene items, none a correctness/data-loss/privacy defect. The one non-trivial theme — surfaced by BOTH lanes from different angles — is that **35-08's two ComposeScreen expansion passes lean on screen state and adapter code that 35-01 strips in wave 1 and 35-08 does not fully re-specify**, a plausible source of a silent provider-wiring regression that the pure-logic tests would not catch.

### Agreed Strengths
- **Off-limits egress fully closed and enforced, not relaxed** (both lanes; aggregator-verified `fuel-read.ts:133`, 35-05 carry-only shape + not-serialized regression test).
- **Migration head verified 027 → 028 additive, behind an irreversibility gate** (both lanes; `027-default-interaction-channel.ts:28`, `database.ts:68`).
- **HIGH-2 abort fix precisely located and coherent** (both lanes; `ai-suggestion-logic.ts:304-310`).
- **No orphaned consumer of the reshaped AI contract remains** (both lanes independently grepped the full consumer set).
- **Destination-resolution correctly grounded** — `selectActionablePrimaryMethods` (`contact-methods-read.ts:10`) genuinely loses explicit-primary vs first-actionable, so 35-07's added `listContactMethodGroups` use is necessary, not speculative (both lanes).

### Agreed Concerns
- **35-08 under-specifies the ComposeScreen re-wiring that 35-01 stripped** (both lanes, complementary angles). Codex: the three-state availability input (async credential presence, focus refresh, observed-unauthorized → `needs-attention`) is not sourced/owned. Claude: the `generate`-dep adapter's provider-wiring (`getActiveProvider`, model selection, `resolveMaxOutputTokens`+catalog) is not re-documented, and Task 2 points a "reuse THIS" anchor at code 35-01 deletes.

### Divergent Views
- No genuine disagreement. Codex rated overall risk MEDIUM (concentrated in the availability/credential seam and origin-aware navigation); Claude rated it LOW-MEDIUM (concentrated in the 35-08 stale-anchor re-wiring). Both agree there is no HIGH and no build-breaker. The lanes raised largely non-overlapping actionable items (listed below) rather than contradicting each other.

## Aggregator-Verified Actionable Findings (for the planner)

All five are non-HIGH, verified on disk, and NOT yet incorporated/deferred in the current PLAN.md files. None reverses a recorded decision.

1. **[MEDIUM · claude · 35-08 Task 2 · VERIFIED] Stale "reuse the current adapter body at ComposeScreen.tsx:215-240" anchor points at code 35-01 deletes; provider-wiring not re-documented.** `ComposeScreen.tsx:215-240` is the `generate` dep INSIDE the `new AiSuggestionLifecycle({…})` block that 35-01 Task 3 removes ("remove … the `new AiSuggestionLifecycle({...})` construction and ALL its injected deps/handlers"). It contains non-trivial wiring — `service.refreshProviders(s)` (:219), `service.getActiveProvider(s)` (:220), `model = s.aiProvider === 'custom' ? s.aiCustomModel : s.aiModel` (:222), `resolveMaxOutputTokens(s.aiProvider, model, catalogRef.current)` (:228) — that 35-08 Task 2 does NOT re-document; it cites only the `GenerationInput` shape. 35-08 Task 2's read_first even contradicts itself (acknowledges the tracer removed the wiring, then says "evolve THIS … reusing the current adapter body at :215-240"). Risk: an executor reconstructs the adapter from the type alone and silently drops `maxOutputTokens`/catalog/model-selection (e.g. Anthropic requires `max_tokens`) — a functional regression `tsc` will not catch. **PLAN edit:** in 35-08 Task 2, replace "evolve/reuse the current adapter body at :215-240" with "**re-create** the generate adapter (removed by 35-01 in wave 1)," inline the provider-wiring to reconstruct (or point at the pre-35-01 git blob), and add an acceptance grep that the re-created adapter references `resolveMaxOutputTokens` and `getActiveProvider`.
2. **[MEDIUM · codex · 35-08 Task 4 · VERIFIED] Three-state availability is specified but not sourced/wired.** 35-04 creates the pure `computeAiAvailability(providerId, credentialPresent)`; 35-08 Task 4 renders the three states but assigns no owner for (a) loading credential presence via the async `aiKeyStore.getKey()` (`Promise<string|null>`, `ai-key-store.ts:46`), (b) refreshing it on focus, or (c) converting an observed unauthorized/invalid generation result into `needs-attention` (35-04's derivation says "missing/invalid" but only "missing" is knowable without an observed-unauthorized signal). **PLAN edit:** add a 35-08 task/action step: on focus, async-read only the active provider's key presence into a boolean state and pass it to the adapter; define the observed-unauthorized → session-local "needs attention" transition without exposing key material; add unit coverage for missing-key and observed-unauthorized transitions.
3. **[MEDIUM · codex · 35-09 Task 2 · partially covered] Origin-aware exit lacks an explicit draft/session disposition table.** The session-clear policy IS decided (D-10 + 35-01 store: clears on Transmit-confirmed / relaunch, survives in-app nav + backgrounding) and 35-09 states "no finished Compose route in Back history," but 35-09 Task 2 does not reconcile these into a per-path decision (ordinary Back preserves the in-memory session while removing the route; only confirmed `markAssistLogged` clears; a "Not yet" pending assist is not "finished") or add store/nav-level tests for the clear-on-confirm vs preserve-on-Back distinction. **PLAN edit:** add the decision table to 35-09 Task 2 (Back → preserve session, nav toward origin; Transmit-pending/"Not yet" → preserve session + assist; successful `markAssistLogged` → clear the matching session, replace/pop so no finished route remains; Copy → preserve) plus store/navigation tests; keep the Pixel UAT for actual stack behavior.
4. **[LOW · codex · 35-06 Task 2/3 · partially covered] Research projection needs a per-source display-visibility predicate.** Per-source AI-*eligibility* is thoroughly enumerated (memory `allow_ai`, custom-field `share_with_ai`, first-class/relationship false, `isOffLimits`) and relationship *visibility* is routed through `resolveRelationshipVisibility` (`relationships-read.ts:41`), but the plan does not name the show/hide predicate for every source (e.g. current-state historical vs current entries), risking a composed projection revealing hidden/inactive knowledge. **PLAN edit:** enumerate the exact read helper + visibility predicate per Research group in 35-06 Task 2 and add tests that hidden/inactive/historical entries do not render unless the dossier permits.
5. **[LOW · claude · 35-08 Task 4 / 35-01 Task 3 · VERIFIED] Stale `aiErrorText` anchor.** 35-08 Task 4 says "preserve the existing sanitized error→short-line mapping (:488-506)"; `aiErrorText` is a standalone helper at `ComposeScreen.tsx:488` (used at :727) that does not match 35-01's removal grep, but 35-01's "remove the ENTIRE single-suggestion AI block" prose is ambiguous about it (and its call site renders `aiState.code`, which 35-01 removes). **PLAN edit:** in 35-08 Task 4, change the anchor to "re-create the sanitized error-code→short-line mapping if 35-01 removed it (codes: timeout/cancelled/not_configured/unauthorized/rate_limited/blocked/invalid_endpoint/default)"; and in 35-01 Task 3 state explicitly whether `aiErrorText` is removed or retained.

**Observational (not counted; owner heads-up, not a PLAN edit):** the working tree has an uncommitted `tsconfig.json` change (git diff) that drops `.expo/types/**/*.ts` and `expo-env.d.ts` from `include`. Every plan's gate is a project-wide `tsc --noEmit`, so the type-include surface changed independently of Phase 35 — worth confirming this narrowing is intended before the phase runs (it could mask or surface expo-router type errors). Out of Phase-35 plan scope; surfaced for the owner.

## Codex Review

{model: gpt-5.6-terra, reasoning=low; read-only repo access; source-grounded}

## Summary

The revised nine-plan sequence is substantially coherent: it correctly stages the tracer, preference migration, pure delivery logic, AI lifecycle reshape, closed egress carry, Research, and final navigation wiring. Codex found no remaining unplanned orphaned consumer of the `AiSuggestionLifecycle` contract. Two execution details still need tightening before approval: the three-state availability source is not fully wired, and Compose's origin-aware exit needs an explicit draft/session policy.

## Strengths

- Migration sequencing is grounded correctly: the registered head is migration 027 and `TARGET_VERSION` resolves through its version constant in `database.ts:56`, `:68`, `:71`. Plan 35-02's additive `028` approach is appropriate.
- The plan preserves the durable-assist invariant. `performReachOut` creates its assist before native handoff in `handoff.ts:48`, while `markAssistLogged` remains the canonical confirmation writer and global UI still owns dismissal. Exposing the created UID rather than re-querying is the right correction.
- Plan 35-03 correctly treats SMS availability as Text-specific. The current gate is explicitly phone/SMS-centric in `compose-logic.ts:71`; extending it rather than applying its pending-SMS behavior to email is sound.
- The primary-method picker correction is well grounded. `selectActionablePrimaryMethods` falls back to the first actionable row and loses whether it was explicitly primary in `contact-methods-read.ts:10`. Plan 35-07's additional use of `listContactMethodGroups` is therefore necessary.
- The AI lifecycle reshape has an appropriate dependency order. The old contract is consumed by only `ComposeScreen`, `ai-suggestion-logic.test.ts`, and `ai-suggestion-compose-integration.test.ts`; the revised plans explicitly own all three before narrowing the union. The integration test really does consume retired ack members at `ai-suggestion-compose-integration.test.ts:94`, so adding it to 35-04 fixes a real build-breaker.
- The privacy boundary is handled correctly. `PromptContext` is the closed allowlist in `prompt-types.ts:111`, and `resolvePrompt` serializes fields explicitly rather than spreading context in `prompt-template.ts:142`. Plan 35-05's carry-only gated-note field plus a "not serialized" regression test respects ADR-107: Off Limits remains excluded.

## Concerns

- **MEDIUM — three-state availability is specified but not fully sourced/wired.** Plan 35-04 creates a pure adapter that accepts credential presence, but the current credential API is asynchronous: `aiKeyStore.getKey()` returns `Promise<string | null>` in `ai-key-store.ts:46`. Plan 35-08 says Compose "consumes" `computeAiAvailability`, but does not assign ownership for loading the credential-presence input, refreshing it on focus, or converting an observed unauthorized/invalid credential into `needs-attention`. The existing Compose state only establishes `aiProvider !== "none"` at `ComposeScreen.tsx:318`.
  - Suggestion: add an explicit 35-08 task/action step: on focus, asynchronously read only the active provider's key through `aiKeyStore.getKey`, retain a boolean/presence state, and call the pure adapter with it. Define the provisional invalid path precisely — e.g. an `unauthorized` generation result sets a session-local "credential needs attention" flag — without exposing key material. Add focused unit coverage for missing-key and observed-unauthorized transitions.
- **MEDIUM — origin-aware exit lacks an explicit draft/session disposition.** The current Compose Back handler always resets navigation in `ComposeScreen.tsx:266`, while plan 35-09 says both completed send/log *and Back* become origin-aware and remove the Compose route. Meanwhile COMP-07 requires body/subject/mode/focus to survive in-app navigation. The plan does not explicitly state whether ordinary Back retains the in-memory session, whether only confirmed logging calls `clearSession`, or how a "finished" state is distinguished from a merely handed-off pending assist.
  - Suggestion: amend 35-09 Task 2 with a decision table — ordinary Back: preserve the session and navigate toward origin; Transmit pending / "Not yet": preserve session and assist; successful `markAssistLogged`: clear the matching session, then replace/pop so no finished Compose route remains; Copy: preserve session. Add store/navigation-level tests for the clear-on-confirm versus preserve-on-Back distinction; keep Pixel UAT for actual stack behavior.
- **LOW — plan 35-06's Research projection needs a crisp visibility contract.** The plan correctly identifies source-specific AI eligibility, but it delegates current-state visibility to "its own rule, else false." Existing contact-method and relationship reads have explicit actionability/visibility semantics — for example relationship methods are separately filtered after fetch in `contact-methods-read.ts:22` — so a new composed projection can accidentally reveal hidden/inactive knowledge unless every source's Profile visibility rule is explicitly named.
  - Suggestion: enumerate the exact read helper and visibility predicate for each Research group in 35-06 Task 2, and add tests that hidden/inactive/current-historical entries do not render unless the dossier explicitly permits them.

## Risk Assessment

**MEDIUM.** The migration, assist lifecycle, wave ordering, orphaned-test cleanup, and ADR-107 egress posture are all well defended. The remaining risks are concentrated in implementation seams rather than product scope: making "Needs Attention" real with the existing asynchronous secure-key boundary, and ensuring origin-aware navigation does not accidentally clear — or resurrect — a session draft.

## Claude Review

{model: unknown (read-only Claude Code subagent; the `claude -p` CLI lane is not used in this repo); source-grounded}

## 1. Summary

Reviewed all nine current plans on disk against the actual repository source, tracing every reshaped contract to its consumers via grep (the mandated TS→symbol manual sweep). These plans are in strong shape. All three previously-found orphaned-test build-breakers are genuinely closed, migration numbering is correct, the owner-ratified ADR-107/D-14 off-limits exclusion is enforced exactly (no relaxation, no `avoidanceConstraints` shape, no `fuel` AI column), and the one non-trivial data-layer bug the plans claim to fix (the lifecycle's egress-catch nulling its AbortController without aborting) is real on disk and correctly targeted. No execution-time build-breaker and no orphaned consumer of any reshaped contract is missing from a plan's `files_modified`. The one substantive net-new concern is a stale code-anchor in plan 35-08: it instructs the executor to "evolve/reuse the current generate-dep adapter at ComposeScreen.tsx:215-240," but plan 35-01 deletes that entire block in wave 1, and the non-trivial provider-wiring it says to reuse is not re-documented in 35-08. Overall risk: **LOW-MEDIUM**.

## 2. Strengths (verified against source)

- **Migration numbering is correct.** `027-default-interaction-channel.ts:28` exports `DEFAULT_INTERACTION_CHANNEL_SCHEMA_VERSION = 27`; `database.ts:68` sets `TARGET_VERSION` to it; highest migration on disk is `027-*`. So 35-02's `028` = head+1 is right, and the plan additionally makes the executor re-verify before writing (35-02 Task 2) behind a `blocking-human` irreversibility checkpoint (35-02:70-87) — exactly the posture D-03 requires.
- **All three prior build-breaker classes are genuinely closed.** `grep -rln` for `AiSuggestionLifecycle|AiSuggestionState|AiSuggestionDeps` returns exactly 4 files: `ComposeScreen.tsx` (35-01 strips, 35-08 re-wires), `ai-suggestion-compose-integration.test.ts` (35-04 Task 1 owns it), `ai-suggestion-logic.ts` + `ai-suggestion-logic.test.ts` (35-04). No fifth consumer. The integration test really asserts the retired contract — `acknowledgeProvider` (:94,:135-137), `generate: Promise<string>` (:121), `needs-acknowledgement` (:176-177) — and is in 35-04's `files_modified`. `lifecycle-consumer-ledger.test.ts:431` literally asserts `navigation.navigate("Compose", { contactId })`; 35-09 Task 2 updates it in the same task that edits the caller, preserving the test's intent (comment :421-426). `settings-ai-logic.ts` imports no `AiSuggestion*` symbol — deferral to Phase 36 is accurate.
- **The HIGH-2 abort fix is a real bug, correctly diagnosed.** `ai-suggestion-logic.ts:304-310` does `this.stopTimer(); this.controller = null;` in the egress catch with no `controller.abort()`. The fan-out cancellation design (lifecycle owns the abort; `generateVariants` takes a read-only signal) is coherent.
- **ADR-107/D-14 off-limits exclusion is enforced, not relaxed.** `fuel-read.ts` excludes `off_limits` structurally (`kind != 'off_limits'` at :95 and :121; header :19-23), and `ai-context-read.ts` sources fuel only via `getRankedFuel` (:243). 35-05 adds only the optional `gatedRecentInteractionNotes?` field, carries no off-limits shape, edits neither exclusion, and fences both with regression tests — plus a `prompt-template.test.ts` carry-only regression proving the new field does not serialize.
- **`performReachOut`'s return-type widening is safe.** External callers outside 35-01's `files_modified` (`ContactProfileScreen.tsx:194`, `ReachOutRouter.tsx:42`) both `await performReachOut(...)` and discard the result — widening `Promise<void>` → `Promise<{...}>` is backward-compatible in TS, so not a hidden build-breaker.
- **Destination-resolution design is grounded in the real API.** `selectActionablePrimaryMethods` (`contact-methods-read.ts:10-19`) returns `{phone,email}` and cannot distinguish an explicit stored primary from a first-actionable fallback. 35-07's decision to *additionally* consume `listContactMethodGroups` (:22) is well-founded.

## 3. Concerns

- **MEDIUM — 35-08 relies on reusing a generate-dep adapter that 35-01 deletes; the provider-wiring it says to "reuse" is not re-documented** (not a build-breaker — recoverable, but a real accuracy defect with functional-completeness risk). `ComposeScreen.tsx:188-241` is the `new AiSuggestionLifecycle({ … })` construction, and the `generate` adapter at :215-240 lives inside it. Plan 35-01 Task 3 removes "the `new AiSuggestionLifecycle({...})` construction and ALL its injected deps/handlers." So at wave 4 that adapter no longer exists. Yet 35-08 Task 2 repeatedly says "evolve THIS," "reusing the current adapter body at ComposeScreen.tsx:215-240." The logic that lived only in that block — `service.refreshProviders(s)`, `service.getActiveProvider(s)`, `model = s.aiProvider === 'custom' ? s.aiCustomModel : s.aiModel`, `resolveMaxOutputTokens(s.aiProvider, model, catalogRef.current)` (:215-240) — is not re-documented in 35-08; only the `GenerationInput` shape (via `AiService.ts:45-61`) is cited. The executor, following "reuse the current adapter body," finds nothing at those lines and reconstructs from the `GenerationInput` type alone, easily dropping `maxOutputTokens`/catalog/model-selection — a silent functional regression (e.g. Anthropic requiring `max_tokens`) that tsc will not catch. Current plans do not address this.
- **LOW / informational — the `aiErrorText` sanitized-error mapping 35-08 says to "preserve" may not survive 35-01.** `ComposeScreen.tsx:487-507` (`aiErrorText`) is a standalone helper that does not match 35-01's removal grep, so it may be left as dead code — but 35-01's prose ("remove the ENTIRE single-suggestion AI block") is ambiguous about it. `noUnusedLocals` is not enabled (tsconfig only sets `strict`), so a surviving-unused `aiErrorText` won't fail 35-01's tsc gate either way. Net: 35-08's "preserve the existing mapping at :488-506" is a stale anchor; recoverable because the error codes are enumerable, but it should say "re-create if absent."
- **LOW / observational (out of plan scope) — uncommitted `tsconfig.json` change narrows `include`.** The working tree drops `.expo/types/**/*.ts` and `expo-env.d.ts` from `include` (git diff). Not part of any Phase-35 plan, but since every plan's gate is a project-wide `tsc --noEmit`, an executor should know the type-include surface changed; worth confirming with the owner it is intended before the phase runs.

## 4. Suggestions (specific PLAN.md edits)

- **35-08 Task 2 (MEDIUM):** Replace every "evolve THIS / reuse the current adapter body at ComposeScreen.tsx:215-240" phrasing with "**re-create** the generate adapter (removed by 35-01 during the wave-1 rebuild)." Add to Task-2 read_first/action the provider-wiring it must reconstruct, quoting the pre-35-01 shape or pointing at the git blob: `service.refreshProviders(s)` → `service.getActiveProvider(s)`; `model = s.aiProvider === 'custom' ? s.aiCustomModel : s.aiModel`; `maxOutputTokens = resolveMaxOutputTokens(s.aiProvider, model, catalogRef.current)`; then `provider.generate({ resolvedPrompt: prompt, model, temperature: variantTemperature(base, variantIndex, 3), maxOutputTokens, signal })`. Add an acceptance grep that the re-created adapter references `resolveMaxOutputTokens` and `getActiveProvider`.
- **35-08 Task 4 (LOW):** Change "preserve the existing sanitized error→short-line mapping (:488-506)" to "re-create the sanitized error-code→short-line mapping if 35-01 removed it (codes: timeout/cancelled/not_configured/unauthorized/rate_limited/blocked/invalid_endpoint/default)."
- **35-01 Task 3 (LOW, disambiguate):** State explicitly whether `aiErrorText` is removed or intentionally retained, so 35-08's expectation matches disk.
- **tsconfig (observational):** Confirm with the owner whether the `include` narrowing is intended before executing the phase; not a PLAN edit.

## 5. Risk Assessment

**LOW-MEDIUM.** The data-layer correctness surface — where this repo's real bugs live — is handled well: migration is additive/app_settings-only/head+1 behind an irreversibility gate, the sole AI egress projection is locked against widening with tests, the off-limits reversal is enforced exactly per ADR-107/D-14, and the single genuine runtime bug (missing `abort()`) is correctly fixed. Wave/dependency ordering is sound with no concurrent same-file edits and no orphaned consumer of any reshaped symbol. Residual risk is concentrated in the two ComposeScreen expansion passes (35-08) leaning on line-anchored "reuse the current code" instructions for code that 35-01 removes four waves earlier — recoverable and not a build-breaker, but a plausible source of a silent provider-wiring regression that pure-logic tests won't catch and only device UAT would surface. Tightening 35-08's re-create framing closes it.

---

# Cross-AI Plan Review — Phase 35: Messaging & AI Compose (cycle 3)

Convergence **cycle 3**, re-reviewing the CURRENT plans on disk after the cycle-2 replan (commit `b4d468b`, which implemented owner decision **D-14 / ADR-107** — Off Limits is never sent to AI in any form — and fixed cycle-2 HIGH-2 / HIGH-3 plus four actionable findings). Two source-grounded reviewers ran: **Codex** (`gpt-5.6-terra`, reasoning=**low** this cycle — note the lower effort vs cycle 2's `medium`, via `codex exec` with read-only repo access) and **Claude** (a read-only Claude Code subagent — the `claude -p` CLI lane is not used in this repo due to a known Write-permission failure; model id not recoverable from a subagent, recorded `unknown`). Both cited concrete `file:line` evidence against the live repo; neither ran without repo access. The orchestrator (this aggregator) independently verified every load-bearing claim below against the code on disk — the ADR-107/D-14 off-limits exclusion in `fuel-read.ts` and `ai-context-read.ts`, the abort gap at `ai-suggestion-logic.ts:304-310`, the `resolvePrompt` two-arg signature and budgeting path in `prompt-template.ts`, the `setContactMethodPrimary` DAO contract, the 35-04↔35-01 wave/`depends_on` ordering, and the `lifecycle-consumer-ledger.test.ts:431` exact-string assertion — per "review the code, not the diff."

**Cycle-2 → cycle-3 delta:** cycle 2 recorded `current_high=3 current_actionable=4`. The replan resolved **all 3** cycle-2 HIGHs, verified on disk:
- **HIGH (off-limits avoidance-constraint AI-permission source)** — resolved by the **owner-ratified D-14 / ADR-107**: plan 35-05 drops `avoidanceConstraints` entirely, carries only the `allow_ai`-gated recent-interaction note, leaves `fuel-read.ts`'s off-limits exclusion unrelaxed, and adds no `fuel` AI-permission column. This is decision-**enforcement**, not reversal-by-agent; the reversal was owner-ratified. **No owner escalation.**
- **HIGH-2 (35-04 sibling abort)** — resolved: the current egress catch at `ai-suggestion-logic.ts:304-310` nulls `this.controller` **without** `abort()` (verified on disk); plan 35-04 now aborts the controller before nulling on a non-stale rejection (mirroring `onTimeout`), with a two-level test (unit + fan-out e2e).
- **HIGH-3 (35-08 Rewrite prompt path)** — resolved: `resolvePrompt` is two-arg with no source-draft today (`prompt-template.ts:142`); plan 35-08 now assigns the `resolvePrompt(template, context, sourceDraft?)` extension (files `src/ai/prompt-template.ts` + test) rendering the draft as a fenced/sanitized `MESSAGE TO REWRITE` DATA block — a `resolvePrompt` param, not a `PromptContext` field.
- The **four cycle-2 actionable findings** are incorporated: 35-06 adds structured relationships (Key People) to the normalized `ResearchItem` projection; 35-07 consumes `listContactMethodGroups` for the establish-primary picker condition; 35-09 deletes the orphaned `ai-suggestion-navigation.test.ts` with its module; the off-limits-source ambiguity was resolved by ADR-107.

Findings below are counted **only** against the current plans; resolved cycle-1/cycle-2 items are excluded. Prior cycles are retained verbatim at the bottom for convergence history.

## Consensus Summary

The three headline cycle-3 fixes all landed correctly and are verifiable against the code on disk. **The off-limits privacy posture (never sent to AI in any form) is sound and multiply-defended** — the SQL exclusion in `fuel-read.ts:133`, the absence of any `fuel` AI-permission column, the carry-only shape in `ai-context-read.ts` (only channel/quality/connected on the un-gated path; only `allow_ai`-gated notes carried), the `aiEligible=false`/`isOffLimits=true` marking of off-limits `ResearchItem`s in 35-06, and the never-Message-Focus store rule. **No plan reverses or weakens a recorded decision — there are no owner escalations this cycle** (the off-limits exclusion is owner-ratified ADR-107, faithfully implemented). All eight cycle-1 HIGH groundings and the migration head (028 = head+1; `TARGET_VERSION` 27) re-check out.

**No HIGH-severity concern survives aggregator verification this cycle (`current_high=0`).** Codex (at reduced `low` effort) raised four HIGHs; on verification against the code, none holds as a HIGH:
- **Codex "discard/SHELL-07 contract" (HIGH) — invalidated.** Codex claims Back with a non-empty draft "silently discards a meaningful draft." The opposite is true by design: 35-01's `compose-session-store` **persists** body/subject/mode/destination across in-app navigation and backgrounding (D-10; `35-01-PLAN.md:29,97`), clearing only on Transmit-confirmed or relaunch. The current Compose Back handler already routes home with no discard prompt (`ComposeScreen.tsx:403-413`), and adding a discard prompt would contradict D-10's deliberate session-persistence. Not a defect; at most a LOW doc note that Compose intentionally persists, so SHELL-07's discard prompt does not apply.
- Codex's other three HIGHs (primary-method `method_type` predicate; "meaningfully varied"; Rewrite prompt budget order) are real but are **actionable plan-completeness gaps**, not correctness/data-loss/privacy defects — downgraded to MEDIUM and listed below. Claude independently rated the "varied" item MEDIUM and raised no HIGHs.

The residual risk is a set of actionable MEDIUM plan-hygiene items — two of them **verified execution-time build-breakers** — all fixable with small PLAN.md/artifact edits.

### Agreed Strengths
- **Off-limits egress fully closed and defense-in-depth** (both lanes; aggregator-verified). `fuel-read.ts:133` excludes `off_limits` in SQL; `fuel` has no `allow_ai`/`share_with_ai` column; 35-05 carries no off-limits shape; 35-06 marks off-limits `aiEligible=false`; ADR-107 on disk matches the plans.
- **35-04 abort fix precisely located** (both lanes). Egress catch `ai-suggestion-logic.ts:304-310` nulls without abort vs `onTimeout` which aborts-then-nulls; the plan mirrors the timeout path, with a solid two-level test.
- **Carry-only egress is provably non-transmitting** (both lanes). `resolvePrompt` serializes fields explicitly (no spread), so an optional `PromptContext` field cannot transmit; a sentinel regression fences it.
- **Assist lifecycle reuse / recency-writer invariant** (both lanes). No new `interactions` writer; `markAssistLogged` stamps `occurredAt = handoff_at` and remaps channel; the returned `{ handoffStarted, assistUid }` closes the fragile re-query.
- **Migration 028 = head+1 verified** (both lanes); app_settings-only, allowlisted-not-emitted, no `BACKUP_FORMAT_VERSION` bump.
- **Dual-stack ComposeResearch registration and the new `setContactMethodPrimary` writer are warranted** (both lanes): `ComposeResearch` is registered in neither stack today, and `selectActionablePrimaryMethods` cannot distinguish an explicit primary from a first-actionable fallback.

### Agreed Concerns
- **COMP-12 "meaningfully varied" is not guaranteed by the chosen mechanism** (Codex HIGH; Claude MEDIUM; aggregator: MEDIUM/actionable). The fan-out is three calls with the **same** prompt/payload/signal; no plan sets a distinct per-call `temperature` (the field exists at `AiService.ts:48`) or any variation instruction, and "exact variation instructions" are deferred to Phase 36 (§U/§Q) — yet COMP-12 is a Phase-35 requirement. At low/zero temperature the three could be identical, visibly failing COMP-12. Claude additionally caught that `provider.generate` takes a single `GenerationInput`, **not** `(prompt, signal)` (`AiService.ts:13,92`), so 35-08's "wire `generateOne = provider.generate`" needs an adapter closure — the natural seam for a minimal variation lever. **Not an owner escalation** (no decision reversed). Fix: have 35-08's `generateOne` adapter apply a minimal deliberate per-call variation (e.g. stepped temperature) so "varied" holds this phase, **or** explicitly record in 35-04/35-08 that variation is provider-nondeterminism-dependent for Phase 35 with a device-gate check of actual variation.

### Divergent Views
- **Severity of the "varied" gap** — Codex HIGH vs Claude MEDIUM. Aggregator sides with MEDIUM/actionable: real configured providers vary at default sampling, the deferral of variation *instructions* to Phase 36 is a recorded decision, and the fix is a small plan edit — but the plan must not leave COMP-12's "varied" purely to chance, so it is a genuine unresolved actionable item.
- **Codex-only findings** (Claude did not raise): the SHELL-07 discard claim (aggregator invalidated — see Consensus), the `setContactMethodPrimary` `method_type` predicate hardening (aggregator: valid MEDIUM/actionable), and the Rewrite prompt-budget construction order (aggregator: valid MEDIUM/actionable).
- **Claude-only findings** (Codex did not raise): the two verified build-breakers — 35-04↔35-01 intra-wave `tsc` ordering and the untouched `lifecycle-consumer-ledger.test.ts:431` assertion — plus the stale `COVERAGE.md`. Aggregator confirmed all three on disk; these are the highest-value actionable items this cycle.

## Aggregator-Verified Actionable Findings (for the planner)
1. **[MEDIUM · build-breaker · Claude · verified] 35-04 must depend on 35-01.** Both are `wave: 1, depends_on: []`; ComposeScreen (the sole `AiSuggestionLifecycle` consumer) still uses `isProviderAcknowledged` (:196), `acknowledgeProvider` (:203), `"needs-acknowledgement"` (:568), `"confirm-replace"` (:650), `confirmReplace()` (:697) — every member 35-04 removes. If 35-04's per-plan `tsc --noEmit` gate runs before 35-01 strips ComposeScreen, it fails. **Fix:** set `35-04 depends_on: [35-01]` (or sequence 35-01 strictly first within wave 1); add a truth noting ComposeScreen must be stripped first.
2. **[MEDIUM · build-breaker · Claude · verified] 35-09's `origin:'profile'` edit breaks an untouched ledger test.** `src/db/lifecycle-consumer-ledger.test.ts:431` asserts `toContain('navigation.navigate("Compose", { contactId })')`; 35-09 Task 2 changes `ContactProfileScreen.tsx:335` to add `origin`, so the substring no longer matches and `npm test` (35-09 Task 3 gate) fails. The test is absent from 35-09's `files_modified`/`read_first`. Same orphan-test class 35-09 correctly caught for `ai-suggestion-navigation.test.ts`. **Fix:** add `lifecycle-consumer-ledger.test.ts` to 35-09 scope and update the `:431` assertion to match the `origin`-bearing call while preserving the "Message → Compose is not lifecycle-gated" intent.
3. **[MEDIUM · consensus] COMP-12 "meaningfully varied" mechanism** — see Agreed Concerns. **Fix:** minimal per-call variation lever in 35-08's `generateOne` adapter, or an explicit recorded deferral + device-gate variation check; also correct 35-08's `generateOne` wiring to adapt `GenerationInput` (not `(prompt, signal)`).
4. **[MEDIUM · Claude · verified] `COVERAGE.md:13-14` is stale and contradicts ADR-107/D-14.** It still states plan 35-05 carries "two new ADR-078 shapes (avoidance-constraint + gated…)" and a live "Avoidance-constraint carry … INTEGRATE (carry-only)" row. The plans are correct; the risk is a Phase-36 planner/auditor reading COVERAGE.md and re-introducing off-limits avoidance rendering — **re-widening the egress the owner just excluded.** **Fix:** rewrite `:13-14` to name one carried shape (the gated recent-interaction note only) and delete/retire the avoidance-constraint row with an ADR-107 supersession note.
5. **[MEDIUM · Codex · verified] 35-03 `setContactMethodPrimary` should validate `method_type` in the update predicate.** The plan guards the SET step "to that contact" and clears the prior primary by `(contactId, method_type)`, but does not require `method_type` equality on the promoted row. A caller passing an email method id with `methodType: 'phone'` would clear the phone primary and promote the email row (the partial-unique index would catch a resulting double-primary, but the phone primary is lost). The real picker caller passes consistent data, so this is defensive hardening. **Fix:** `WHERE id = ? AND contact_id = ? AND method_type = ?`, assert exactly one row changed, add a mismatch-type no-write test.
6. **[MEDIUM · Codex] 35-08 Rewrite prompt-budget construction order.** `resolvePrompt` budgets shared fields against the scaffold (`prompt-template.ts:240`) then hard-trims the assembled string to `TOTAL_LIMIT` (`:269`). The plan says the Rewrite block is "placed alongside the other DATA blocks" and "counted against TOTAL_LIMIT" (implying scaffold inclusion) but does not nail the order or add an exact-limit fence test. **Fix:** state that the Rewrite block + its conditional instruction enter the scaffold before shared-field budgeting, reserve space for the truncation notice, and test that all fences stay balanced at `TOTAL_LIMIT`.
7. **[MEDIUM · Codex] Screen-heavy plans (35-07/35-08/35-09) lean on `tsc` + `check:colors` + device UAT for behavior.** Mode fallback, no-destination Copy-only, "Yes" logging with the returned assist UID, the Needs-Attention branch, and origin-aware return are not covered by automated component/navigation tests. Partly mitigated by the project's device-UAT norm, but the pure-logic-testable branches (mode fallback, availability states) warrant targeted tests. **Fix:** add component/navigation tests (or explicitly record which behaviors are device-UAT-only) to the screen plans.

**Lower-priority (LOW, noted, not counted in the actionable total):** (a) `35-06` should state explicitly "exclude `hide` relationships from the Research projection" rather than only "honoring `resolveRelationshipVisibility`"; (b) `35-PATTERNS.md`/`35-RESEARCH.md` still describe the retired avoidance-constraint design (historical inputs the plans supersede); (c) `35-01`'s store contract should clarify whether it is a per-contact map or a single active session replaced on a new Compose route.

---

## Codex Review

_`gpt-5.6-terra`, reasoning=low, via `codex exec` (read-only repo). Note: reduced effort vs cycle 2 (`medium`). Aggregator verified each finding against disk; see the aggregator notes above for the HIGH→MEDIUM re-classifications and the invalidated SHELL-07 claim._


# Phase 35 plan review

## Summary

The plan set is unusually well-grounded in the existing Compose, assist, navigation, and AI code. It correctly preserves the durable assist lifecycle and owner-ratified ADR-107 exclusion of Off Limits from AI egress. The main gaps are: preservation of the shell’s unsaved-changes contract, a method-type integrity hole in the proposed primary-method writer, lack of a mechanism to make three AI outputs meaningfully varied, and a prompt-budget design issue for Rewrite.

## Strengths

- The assist confirmation design is sound. `createPendingAssist()` writes before handoff and returns its UID ([interaction-assist-dao.ts](/home/bwales/projects/orbit-app/src/db/interaction-assist-dao.ts:27)); `markAssistLogged()` uses the stored `handoff_at` for `occurredAt` and the canonical recency cores ([interaction-assist-dao.ts](/home/bwales/projects/orbit-app/src/db/interaction-assist-dao.ts:99)). Plan 35-01’s explicit returned `{ handoffStarted, assistUid }` eliminates an unsafe “find the latest assist” lookup.

- Plans 35-01 and 35-03 correctly keep the current durable-assist failure behavior: `performReachOut()` creates the assist before native handoff and calls `markAssistFailed()` on handoff failure ([handoff.ts](/home/bwales/projects/orbit-app/src/services/reach-out/handoff.ts:50), [handoff.ts](/home/bwales/projects/orbit-app/src/services/reach-out/handoff.ts:67)). The panel gate on both successful handoff and non-null UID is appropriate.

- Plan 35-03 correctly identifies that SMS availability must not gate email. The current pure control gate is explicitly phone/SMS-specific ([compose-logic.ts](/home/bwales/projects/orbit-app/src/logic/compose-logic.ts:64)), while email currently goes through `Linking.openURL` rather than `expo-sms` ([handoff.ts](/home/bwales/projects/orbit-app/src/services/reach-out/handoff.ts:60)).

- Plan 35-05 respects ADR-107. The live AI context gets fuel only through `getRankedFuel()` ([ai-context-read.ts](/home/bwales/projects/orbit-app/src/db/ai-context-read.ts:243)), and its interaction aggregate intentionally excludes free-text note content ([ai-context-read.ts](/home/bwales/projects/orbit-app/src/db/ai-context-read.ts:101)). Carrying only allow-AI-gated notes while keeping Off Limits out of every AI-facing shape is directionally correct.

- Plan 35-09 correctly notices that `Compose` is separately registered in both stack navigators ([DashboardStack.tsx](/home/bwales/projects/orbit-app/src/navigation/tabs/DashboardStack.tsx:59), [OrreryStack.tsx](/home/bwales/projects/orbit-app/src/navigation/tabs/OrreryStack.tsx:73)). Registering `ComposeResearch` in both is necessary.

## Concerns

- **HIGH — plans 35-01/35-09 omit the existing shell discard contract.** Compose presently intercepts Android Back and resets the parent navigation tree directly ([ComposeScreen.tsx](/home/bwales/projects/orbit-app/src/screens/ComposeScreen.tsx:403)), while the new session store would make a typed draft survive navigation. The project already has a generic `beforeRemove` discard/keep guard ([discard-keep-guard.ts](/home/bwales/projects/orbit-app/src/navigation/discard-keep-guard.ts:23)). No plan requires applying it to a non-empty Compose session before Back, origin-aware return, or a completed-flow route replacement. This risks violating SHELL-07 and silently discarding a meaningful draft.

- **HIGH — plan 35-03’s proposed `setContactMethodPrimary()` must validate `methodType` in the update predicate, not only `contactId`.** The existing diff writer clears a primary by both `contact_id` and `method_type` before updating the selected record ([contact-methods-dao.ts](/home/bwales/projects/orbit-app/src/db/contact-methods-dao.ts:183)). The proposed writer’s description only says the selected ID is “guarded to that contact.” A caller could pass an email method ID with `methodType: "phone"`, clear the phone primary, and then promote the email row. Require `WHERE id = ? AND contact_id = ? AND method_type = ?`, assert exactly one updated row, and add a mismatch-type no-write test.

- **HIGH — plan 35-04 cannot guarantee “meaningfully varied” suggestions with three identical requests.** The proposed `generateVariants(provider.generate, prompt, signal, 3)` sends the same resolved payload three times. The current prompt construction contains no variant slot ([prompt-template.ts](/home/bwales/projects/orbit-app/src/ai/prompt-template.ts:64)), and the current provider call has no per-variant seed or distinction ([ComposeScreen.tsx](/home/bwales/projects/orbit-app/src/screens/ComposeScreen.tsx:215)). Three independent calls may happen to differ, but deterministic or low-temperature providers can return identical text. The plan also defers variation instructions to Phase 36, leaving COMP-12 unmet in Phase 35.

- **HIGH — plan 35-08’s Rewrite budget needs a concrete construction order.** `resolvePrompt()` currently budgets fields against a scaffold ([prompt-template.ts](/home/bwales/projects/orbit-app/src/ai/prompt-template.ts:240)) and only afterwards applies a hard truncation to the fully assembled string ([prompt-template.ts](/home/bwales/projects/orbit-app/src/ai/prompt-template.ts:269)). Simply appending a bounded Rewrite block can force the final hard trim, potentially truncating the closing fence or losing the required category-specific truncation disclosure. The plan must include the Rewrite block and its conditional instruction in the scaffold before calculating remaining capacity, reserve space for its notice, and test that all fences remain balanced at `TOTAL_LIMIT`.

- **MEDIUM — plan 35-06 needs an explicit Research visibility policy.** `listRelationshipsForContact()` returns hidden relationships ([relationships-read.ts](/home/bwales/projects/orbit-app/src/db/relationships-read.ts:21)), while `resolveRelationshipVisibility()` exists specifically to determine presentation ([relationships-read.ts](/home/bwales/projects/orbit-app/src/db/relationships-read.ts:41)). The plan says to honor it but does not state whether Research should hide those records. It should explicitly say “exclude `hide` relationships from Research,” unless the owner intends Research to be an administration surface—which would conflict with its read-only, conversation-focused purpose.

- **MEDIUM — screen-heavy plans lack automated behavioral coverage.** Plans 35-07 through 35-09 mostly verify with TypeScript and color checks. Those checks cannot prove mode fallback, no-destination Copy-only behavior, “Yes” logging with the returned assist UID, the Needs Attention branch, origin-aware return, or that a finished route cannot be resurrected. Current Compose has substantial focus-effect and back-handler behavior ([ComposeScreen.tsx](/home/bwales/projects/orbit-app/src/screens/ComposeScreen.tsx:274), [ComposeScreen.tsx](/home/bwales/projects/orbit-app/src/screens/ComposeScreen.tsx:403)); these need component/navigation tests in addition to Pixel UAT.

- **LOW — plan 35-01’s store contract is ambiguous about multiple contacts.** It calls the state “keyed by contactId” but lists one `contactId` and one body/subject/mode/destination. Define whether it is a map of per-contact sessions or exactly one active session that is replaced when another Compose route opens. The former better matches the stated keyed contract; the latter is acceptable if deliberately specified.

## Suggestions

- Add a dedicated task—preferably in 35-01 before the UI rebuild—to integrate the existing discard/keep navigation guard with session-store dirty state. Ensure it applies to hardware Back, visible Back, origin-aware completion navigation, and research navigation only where appropriate.

- Amend 35-03’s DAO contract and tests:

  - require `methodType` equality in the selected-row update;
  - assert exactly one row changed;
  - test an email-ID/phone-type mismatch leaves both primary sets unchanged;
  - preserve the no-op behavior and avoid a revision bump.

- Resolve the variation mechanism before approving 35-04. A minimal compliant approach is a bounded, non-contact-data per-variant instruction added at prompt construction, such as three internally indexed composition approaches. If that is considered Phase 36 scope, then Phase 35 must explicitly downgrade its success criterion from “meaningfully varied” or obtain an owner decision; identical repeated requests do not satisfy the stated requirement.

- In 35-08, make Rewrite budget allocation structural: build and bound the rewrite data block before budgeting shared fields, then test exact-limit and over-limit prompts for balanced delimiters, preserved rewrite instruction, and a category-only truncation notice.

- Add targeted component/navigation tests for:

  - Text probe-pending versus Email availability;
  - Copy and Subject Copy updating remembered mode but an ad-hoc switch not doing so;
  - confirmation shown only for successful assist-backed handoff;
  - discard guard with a non-empty session;
  - profile-origin completion returning to Profile in both Dashboard and Orrery stacks;
  - `requestAiSuggestion` absence and no generation on mount/focus.

## Risk assessment

**Overall: MEDIUM-HIGH.** The data and assist invariants are carefully protected, and the ADR-107 boundary is correctly preserved. However, the missing dirty-draft guard is a user-visible regression against an already-shipped shell invariant; the primary-method writer needs stronger row/type validation; and the planned three-call fan-out does not itself establish meaningful variation. These should be addressed before execution.

---

## Claude Review

_Read-only Claude Code subagent (not the `claude -p` CLI lane). Source-grounded; every file:line opened and confirmed on disk. No owner escalations; no HIGH concerns._


Reviewer: independent cross-AI plan reviewer (Claude / Opus)
Scope: the 9 plans on disk post-b4d618b (35-01..35-09) + context/coverage/requirements, verified against actual source under `src/`.

## 1. Summary

The cycle-3 plans are in strong shape and the three headline fixes all landed correctly and are verifiable against the code on disk: (a) Off Limits is now fully excluded from every AI egress path — plan 35-05 drops `avoidanceConstraints` entirely, carries only the `allow_ai`-gated recent-interaction note, leaves `fuel-read.ts`'s off-limits exclusion unrelaxed, and adds no `fuel` permission column, exactly matching the owner-ratified ADR-107/D-14 (verified on disk: `fuel-read.ts` excludes `off_limits` in SQL and has no `allow_ai`/`share_with_ai` column; `ai-context-read.ts` selects only channel/quality/connected on the un-gated path); (b) the 35-04 sibling-abort fix is real and correctly targeted (the egress catch at `ai-suggestion-logic.ts:306-307` does `this.controller = null` without `abort()` today; the plan aborts before nulling on a non-stale rejection, with a solid end-to-end test); (c) the 35-08 Rewrite prompt path is sound (`resolvePrompt` at `prompt-template.ts:142` is two-arg with no source-draft today; the plan adds an optional bounded/delimited `sourceDraft` param as DATA, not a `PromptContext` field, avoiding a contact-data egress widening). No plan reverses or weakens a recorded decision — there are **no owner escalations**. The remaining concerns are dependency-ordering, test-hygiene, and doc-drift issues, all mechanically fixable; none are correctness, data-loss, or privacy defects.

## 2. Strengths (file:line evidence)

- **Off-limits egress fully closed and defense-in-depth.** `src/db/fuel-read.ts:133` (`RANKED_FUEL_EXCLUSIONS = kind != 'off_limits'`) and the header at `:19-23` confirm `listFuelForEditor` is the ONLY read that surfaces off_limits; a grep confirms `fuel` has no `allow_ai`/`share_with_ai` column. Plan 35-05 correctly leaves this untouched and carries no off-limits shape; plan 35-06 additionally marks off-limits `ResearchItem`s `aiEligible=false`+`isOffLimits=true` and the store rejects them from Message Focus — so off-limits cannot reach AI via the context projection OR the Message-Focus path. ADR-107 on disk (`docs/decisions/ADR-107-...md:16-18,44-46`) matches the plans precisely.
- **HIGH-1 handoff contract is grounded.** `src/services/reach-out/handoff.ts:49` returns `Promise<void>`; `assistUid` is created at `:50-57` and used only internally for `markAssistFailed` at `:68-69`. Plan 35-01's widening to `{ handoffStarted, assistUid }` and its "panel gates on `handoffStarted && assistUid`, never re-queries the assist table" is the correct fix and closes the fragile re-query trap.
- **HIGH-2 abort fix precisely located.** `ai-suggestion-logic.ts:304-310` (catch nulls controller without abort) vs `onTimeout` at `:351-354` (aborts then nulls) — the plan mirrors the timeout path into the egress-failure path. The two-level test (unit: recording generate observes `signal.aborted`; e2e: 2nd of three `generateOne` rejects, siblings' signals abort) is well-designed.
- **Ack-gate removal is clean and correctly scoped.** The `needs-acknowledgement` state (`:87-90`), `confirm-replace` (`:97`), and deps `isProviderAcknowledged`/`acknowledgeProvider` (`:115,:120`) all exist on disk; plan 35-04 removes the logic-module path but deliberately leaves the DAO `acknowledgeProvider` writer and the forward-only `ai_ack_*` columns (D-09/ADR-079). Grep gates enforce no residual reference.
- **Egress carry-only is provably non-transmitting.** `prompt-types.ts:111` (`PromptContext`) with `sharedMemories?` at `:138` is the correct optional precedent; `resolvePrompt` at `prompt-template.ts:142` serializes fields explicitly (no spread), so adding a field cannot transmit it — and plan 35-05 Task 3 adds a regression proving the sentinel never appears in the payload.
- **Migration head verified accurate.** Highest migration on disk is `027-default-interaction-channel.ts` and `TARGET_VERSION = DEFAULT_INTERACTION_CHANNEL_SCHEMA_VERSION` (`database.ts:68`), so 35-02's head+1=028 is correct; the plan is app_settings-only, allowlisted-not-emitted, no format bump — matching the milestone schema→consumers→backup order.
- **HIGH-5/HIGH-7 groundings confirmed.** `ComposeResearch` is registered in neither stack (grep empty) — 35-09's dual-stack registration is warranted. `contact-methods-dao.ts` has no set-primary writer and `contact-methods-read.ts:15-16` shows `selectActionablePrimaryMethods` returns `is_primary&&is_actionable ?? first-actionable`, unable to distinguish an explicit primary from a fallback — validating 35-03's new `setContactMethodPrimary()` and 35-07's use of `listContactMethodGroups` for the picker condition.

## 3. Concerns (severity-tagged, file:line evidence)

- **[MEDIUM] Intra-wave dependency: 35-04 reshapes the lifecycle whose sole consumer (ComposeScreen) is only stripped by 35-01 — both wave 1, no `depends_on` between them, so 35-04's `tsc --noEmit` gate can fail.** `ComposeScreen.tsx` is the ONLY consumer of `AiSuggestionLifecycle` (grep). It currently constructs the lifecycle with `isProviderAcknowledged` (`:196`), `acknowledgeProvider` (`:203`), and reads `aiState.status === "needs-acknowledgement"` (`:568`) / `"confirm-replace"` (`:650`) / calls `ai.confirmReplace()` (`:697`) — every member plan 35-04 removes from the contract. Plan 35-01 (wave 1) strips all of this from ComposeScreen; plan 35-04 (wave 1, `depends_on: []`) reshapes `ai-suggestion-logic.ts`. If 35-04's per-plan tsc gate runs before 35-01 has landed, `tsc --noEmit` fails on the old ComposeScreen. Mechanism: 35-04 narrows the exported `AiSuggestionState` union and `AiSuggestionDeps`, making the pre-35-01 ComposeScreen a type error. Fix: give 35-04 `depends_on: [35-01]` (or sequence 35-01 strictly before 35-04 within wave 1). This is real dependency ordering, not a style nit.

- **[MEDIUM] 35-09's `origin:'profile'` edit breaks an exact-string ledger test that the plan does not touch.** `src/db/lifecycle-consumer-ledger.test.ts:431` asserts `expect(screen).toContain('navigation.navigate("Compose", { contactId })')` against `ContactProfileScreen.tsx`. Plan 35-09 Task 2 changes `ContactProfileScreen.tsx:335` to pass `origin: 'profile'`, producing `navigation.navigate("Compose", { contactId, origin: ... })` — the substring `{ contactId })` no longer matches, so `npm test` (35-09 Task 3's gate) fails. `lifecycle-consumer-ledger.test.ts` is absent from 35-09's `files_modified` and `read_first`, and the ledger assertion is an architectural guard ("Message → Compose is not lifecycle-gated") that needs a deliberate update, not a blind edit. This is the same orphan-test failure class the authors correctly caught for `ai-suggestion-navigation.test.ts` — they found one and missed this second one. Fix: add `src/db/lifecycle-consumer-ledger.test.ts` to 35-09's scope and update the `:431` assertion to match the new `origin`-bearing call (preserving the not-lifecycle-gated intent).

- **[MEDIUM] COVERAGE.md is stale relative to ADR-107/D-14 and contradicts the plans it summarizes.** `COVERAGE.md:13-14` still states "plan 35-05 CARRIES two new ADR-078 shapes (avoidance-constraint + gated recent-interaction note)" and carries a live row "Avoidance-constraint carry (off-limits AI-enabled → negative constraint) | INTEGRATE (carry-only)". This directly contradicts D-14/ADR-107 and the current plan 35-05 (which removed `avoidanceConstraints` entirely). The plans themselves are correct; the risk is that a Phase-36 planner or auditor reads COVERAGE.md and re-introduces an off-limits avoidance-constraint rendering — re-widening egress the owner just excluded. Fix: update `COVERAGE.md:13-14` to describe ONE carried shape (the gated recent-interaction note only) and delete the avoidance-constraint row (or mark it retired by ADR-107). (Note: `35-PATTERNS.md` and `35-RESEARCH.md` also still describe the old avoidance-constraint design — see LOW below.)

- **[MEDIUM] COMP-12's "meaningfully varied" is not guaranteed by the chosen mechanism, and the variation lever is deferred to Phase 36.** The fan-out is three calls to the SAME `provider.generate` with the SAME prompt and SAME signal (`ai-generate-variants.ts` behavior in 35-04; wired in 35-08). `GenerationInput` carries a per-call `temperature` (`AiService.ts:48`), but no plan sets distinct temperatures or any variation instruction — 35-04's own note defers "exact variation instructions" to Phase 36 (§U/§Q). So "three unlabeled *varied* suggestions" (COMP-12) rests entirely on incidental provider sampling nondeterminism; at low/zero temperature the three could be identical, visibly failing COMP-12 in Phase 35 even though COMP-12 is a Phase-35 requirement. Relatedly, `provider.generate` takes a single `GenerationInput` (`AiService.ts:13,92`), not `(prompt, signal)`, so 35-08's "wire `generateOne = provider.generate`" needs an adapter closure — which is the natural seam for a minimal per-call variation lever. Fix: either (i) have 35-08's `generateOne` adapter apply a small deliberate variation (e.g. a nonzero/stepped temperature) so COMP-12's "varied" holds this phase, or (ii) explicitly record in 35-04/35-08 that "meaningfully varied" is accepted as provider-nondeterminism-dependent for Phase 35 with a device-gate check, so the deferral is a conscious call rather than an unstated gap. Not an owner escalation — it does not reverse a decision — but it is a goal-achievement risk worth resolving before execution.

- **[LOW] Upstream research/pattern artifacts still describe the retired avoidance-constraint design.** `35-PATTERNS.md` and `35-RESEARCH.md` (dated before the D-14 revision) reference the avoidance-constraint carry. These are historical inputs the plans supersede, so execution risk is low, but a stale-note pass would prevent confusion. Lower priority than COVERAGE.md because they are not treated as binding contracts.

## 4. Suggestions (specific PLAN.md changes)

1. **35-04-PLAN.md frontmatter:** change `depends_on: []` to `depends_on: [35-01]` (keep `wave: 1` or move to wave 2). Add a truth: "ComposeScreen is the sole lifecycle consumer; 35-01 must strip the old ack/confirm-replace wiring before this reshape so `tsc --noEmit` passes."
2. **35-09-PLAN.md:** add `src/db/lifecycle-consumer-ledger.test.ts` to `files_modified` and Task 2's `read_first`; add a Task 2 action + acceptance line: "update the `:431` exact-string assertion to match `navigation.navigate(\"Compose\", { contactId, origin: 'profile' })` (or relax it to a regex) while preserving the not-lifecycle-gated intent; `npm test` green."
3. **COVERAGE.md:** rewrite lines 13-14 to name ONE carried shape (gated recent-interaction note); delete/retire the "Avoidance-constraint carry" row with an ADR-107 supersession note.
4. **35-08-PLAN.md Task 2:** specify the `generateOne` adapter explicitly (`(prompt, signal) => provider.generate({ ...inputFrom(prompt), signal })`) and decide the "varied" question: either inject a minimal per-call variation there, or add a truth stating variation is provider-nondeterminism-dependent for Phase 35 with a device-gate verification of actual variation.
5. **Optional:** a stale-note sweep of `35-PATTERNS.md`/`35-RESEARCH.md` for the avoidance-constraint design.

## 5. Risk Assessment

**Overall: LOW-MEDIUM.** The three cycle-3 fixes are correctly specified and verified against disk; the privacy posture (off-limits never sent to AI in any form) is sound and multiply-defended; all HIGH-1..HIGH-8 groundings check out; migration numbering is accurate. No plan reverses or weakens a recorded decision — the off-limits reversal is owner-ratified (ADR-107) and faithfully implemented, so there are no owner escalations. The residual risk is concentrated in two build-breakers that would surface at execution — an intra-wave tsc ordering gap (35-04 vs 35-01) and an untouched exact-string ledger test (35-09) — plus a stale COVERAGE.md that could misdirect Phase 36, and an unresolved "meaningfully varied" gap in the fan-out. All four are mechanically fixable with small PLAN.md edits and none imply data loss, privacy leakage, or an architectural dead-end.

<!-- ============================================================ -->
<!-- CYCLE 2 + CYCLE 1 ARCHIVE (superseded by cycle 3 / b4d468b).   -->
<!-- Cycle-2 frontmatter was: cycle: 2, cycle_summary: current_high=3 current_actionable=4. -->
<!-- Retained verbatim for convergence history. Counts below are prior-cycle. -->
<!-- ============================================================ -->


# Cross-AI Plan Review — Phase 35: Messaging & AI Compose (cycle 2)

Convergence **cycle 2**, re-reviewing the CURRENT plans on disk after the cycle-1 replan (commit `ba58631`). Two source-grounded reviewers ran: **Codex** (`gpt-5.6-terra`, reasoning=medium, via `codex exec` with read-only repo access) and **Claude** (a read-only Claude Code subagent — the `claude -p` CLI lane is not used in this repo due to a known Write-permission failure; model id not recoverable from a subagent, recorded `unknown`). Both cited concrete `file:line` evidence against the live repo; neither ran without repo access. The orchestrator (this aggregator) independently verified every load-bearing claim below against the code on disk — the migration head, the `fuel`/`interactions`/`app_settings` schemas, the `PromptContext`/`resolvePrompt` egress seam, the abort/stale-guard machinery, and ADR-078/ADR-079 — per "review the code, not the diff."

**Cycle-1 → cycle-2 delta:** cycle 1 recorded `current_high=8 current_actionable=7`. The replan resolved **all 8** cycle-1 HIGHs; both reviewers independently confirm each is genuinely closed (assistUid return contract, SMS-probe-vs-Email, three-variant mechanism, PromptContext file scope, ComposeResearch route registration, normalized ResearchItem eligibility, `setContactMethodPrimary` DAO, origin-aware caller updates). The findings below are counted **only** against the current plans; resolved cycle-1 items are excluded. The full cycle-1 review is retained verbatim at the bottom of this file for history.

## Consensus Summary

The revised plan set is well-grounded, ADR-aware, and correctly reuses the assist lifecycle, the migration idiom (028 verified as head+1 on disk: `TARGET_VERSION=27`), the fuel-exclusion invariants, and the closed `PromptContext` egress allowlist. The carry-only egress architecture (plan 35-05) is provably safe this phase — `resolvePrompt` serializes fields explicitly and never spreads context (prompt-template.ts:142/164), and a prompt-template regression fences non-transmission. **One consensus concern** carries across both lanes; the remaining unresolved items are single-lane, source-verified plan-completeness gaps.

**Not an owner escalation (recorded for clarity):** plan 35-04 removes the ADR-052 first-send acknowledgement gate. This is **enforcing ADR-079** (owner-ratified 2026-09-01), which supersedes ADR-052 and whose rejected-alternatives list *explicitly rejects* keeping the acknowledgement gate. Both reviewers correctly read this as decision-enforcement, not reversal; neither proposed restoring it; the `ai_ack_*` columns are deliberately left in place (forward-only) and the orphaned DAO writer untouched. Verified against `docs/decisions/ADR-079-*.md` and `src/db/app-settings-dao.ts`. No escalation. (The inverse would be true — restoring the ack gate would reverse ADR-079 and *would* be an owner decision.)

### Agreed Strengths
- Assist lifecycle is additive/reuse-only; Phase 35 adds no new `interactions` writer; `markAssistLogged` stamps `occurredAt = handoff_at` and remaps channel (interaction-assist-dao.ts:105/112). Both reviewers.
- Migration 028 correctly verified as head+1 on disk (027 / `TARGET_VERSION 27`), app_settings-only, with a blocking-human irreversibility checkpoint. Both reviewers.
- D-13 / ADR-078 egress boundary respected: plan 35-05 carries shape only, does not widen egress, leaves `fuel-read.ts` exclusions intact and fenced by regression tests. Both reviewers.
- Backup keys allowlisted-not-emitted with no `BACKUP_FORMAT_VERSION` bump (D-03), matching the Phase 23/25/29/30/31/32/34 precedent. Both reviewers.

### Agreed Concerns
- **Off-limits avoidance-constraint has no per-item AI-permission source (plan 35-05).** Both lanes independently found this. The `fuel` table (migration 011:92) has no `allow_ai`/`share_with_ai` column, and no migration adds one (028 is app_settings-only), yet ADR-078 requires distinguishing **AI-enabled** off-limits items (carried as negative constraints) from **AI-disabled** ones (never sent) — ADR-078 explicitly rejects sending AI-disabled off-limits items. So plan 35-05's must-have ("populate `avoidanceConstraints` from an AI-eligibility-gated off-limits read") and its acceptance tests ("AI-disabled off-limits appears in NEITHER collection", "AI-enabled off-limits appears ONLY in avoidanceConstraints") are **not implementable against the current schema**. The `gatedRecentInteractionNotes` half is fine (`interactions.allow_ai` exists, migration 025). **Severity divergence:** Codex rates this **HIGH / owner escalation under ADR-078**; Claude rates it **MEDIUM** because Phase 35 is carry-only and the regression fence proves nothing serializes this phase (no live leak). **The aggregator elevates it to HIGH and surfaces it as an OWNER DECISION** — it sits on the ADR-078 egress-authorization boundary that D-08/D-13 reserve to the owner, and the naive "carry all off-limits ungated" resolution would seed the ADR-078 *rejected-alternative* shape for Phase 36 to transmit. See the Owner Escalation section below.

### Divergent Views
- **35-04 sibling-abort on rejection (Codex HIGH; Claude did not flag).** Codex: `generateVariants(generateOne, prompt, signal, count)` receives only a read-only `AbortSignal`, so the helper cannot abort siblings; the current lifecycle clears `this.controller = null` on a generate failure *without* calling `controller.abort()` (verified at ai-suggestion-logic.ts). So on one variant's rejection, up to two sibling provider calls stay in flight — the plan claims "the shared AbortController aborts the in-flight siblings" (35-04 truth), a control it does not deliver as scoped. Aggregator verified the current no-abort pattern; kept HIGH because the plan asserts a cancellation control its specified mechanism doesn't keep. Fix is a small, in-plan refinement.
- **35-08 Rewrite source-draft bounded-prompt path (Codex HIGH; Claude considered the cycle-1 MEDIUM addressed).** Codex: `resolvePrompt(template, context)` has no source-draft parameter, `ResolvedPrompt` has no source-draft field, the lifecycle `resolvePrompt` dep is parameterless (verified), and 35-08 modifies only `ComposeScreen.tsx` — so the user's draft cannot enter the promised "closed/delimited prompt-construction path (not raw-concatenated)" (35-04 truth) without an unplanned prompt-layer API change, and it is ambiguous whether "Rewrite with AI" is even functional in Phase 35 given rendering is Phase 36's job. The draft is the user's own text (lower egress risk than contact data), which is why Claude weighted it lower, but the assigned-scope/functional-seam gap is real. Aggregator kept HIGH pending a plan clarification of where/how the draft reaches the provider this phase.

## OWNER ESCALATION (surfaced, not closed)

**Off-limits AI-permission source — plan 35-05 / ADR-078 egress-authorization boundary.** ADR-078 authorizes transmitting *AI-enabled* off-limits items as negative avoidance constraints and forbids transmitting *AI-disabled* ones, but the `fuel` table has no per-item AI-permission column and ADR-078's own Migration note assigns a column only for *per-interaction* Allow-AI (migration 025), not for off-limits fuel. Plan 35-05's specified AI-enabled/AI-disabled gate therefore has nothing to gate on. This is an egress-authorization decision (which is owner-bucket per CLAUDE.md), not a mechanical bug fix. **Decision needed from the owner/planner:** where does off-limits per-item AI-eligibility live, and which phase owns adding it? Options include (a) declare `avoidanceConstraints` a carry-only **empty** typed shape in Phase 35 (defer the off-limits source to the phase that adds the permission model; keep `gatedRecentInteractionNotes` as specified) and rewrite 35-05's off-limits acceptance test accordingly, or (b) assign a `fuel` per-item AI-permission column + its migration and permission UI to an owning phase before 35-05 executes. Do NOT let an executor silently pick "carry all off-limits ungated" — that seeds the ADR-078 rejected-alternative for Phase 36 to transmit.


---

## Codex Review

_Model: gpt-5.6-terra (reasoning=medium). Source-grounded, read-only repo access._

# Cycle 2 Plan Review — Phase 35

## Summary

The revised plan set is substantially stronger: it correctly preserves the durable assist lifecycle, uses the migration head on disk (v27), separates carry-only AI context work from Phase 36 prompt rendering, and sequences Text/Email before screen integration. However, four implementation gaps remain: the AI fan-out cannot abort siblings as specified, Rewrite has no defined bounded prompt-construction API, Off Limits lacks a verified per-item authorization source, and Research omits Relationships.

## Strengths

- **35-01:** Correctly makes the Compose confirmation additive to the durable assist path. `markAssistLogged` already writes at `handoff_at` and remaps transport channels through the shared vocabulary mapper ([interaction-assist-dao.ts:99](/home/bwales/projects/orbit-app/src/db/interaction-assist-dao.ts:99), [interaction-assist-dao.ts:112](/home/bwales/projects/orbit-app/src/db/interaction-assist-dao.ts:112)). Returning the created assist UID avoids an unsafe contact/timestamp lookup.

- **35-02:** The migration plan matches the actual migration head: `TARGET_VERSION` resolves through migration 027 and `MIGRATIONS` ends at 027 ([database.ts:68](/home/bwales/projects/orbit-app/src/db/database.ts:68), [database.ts:96](/home/bwales/projects/orbit-app/src/db/database.ts:96)). The blocking checkpoint is appropriate for irreversible schema work.

- **35-03:** Introducing a narrow primary-method writer is justified. The only current writer is the full seeded/current diff API ([contact-methods-dao.ts:99](/home/bwales/projects/orbit-app/src/db/contact-methods-dao.ts:99), [contact-methods-dao.ts:298](/home/bwales/projects/orbit-app/src/db/contact-methods-dao.ts:298)); its clear-before-set ordering is necessary for the partial unique primary constraint ([contact-methods-dao.ts:179](/home/bwales/projects/orbit-app/src/db/contact-methods-dao.ts:179)).

- **35-05:** The carry-only strategy is well bounded. `resolvePrompt` explicitly serializes selected context fields rather than spreading the context ([prompt-template.ts:164](/home/bwales/projects/orbit-app/src/ai/prompt-template.ts:164)), so a regression test can meaningfully prove the new fields are not yet transmitted.

- **35-09:** Registering Research in both stacks addresses a real current gap: each stack presently registers `Compose` but no `ComposeResearch` ([DashboardStack.tsx:59](/home/bwales/projects/orbit-app/src/navigation/tabs/DashboardStack.tsx:59), [OrreryStack.tsx:73](/home/bwales/projects/orbit-app/src/navigation/tabs/OrreryStack.tsx:73)).

## Concerns

- **HIGH — 35-04: `generateVariants` cannot abort siblings with only an `AbortSignal`.** The plan specifies `generateVariants(generateOne, prompt, signal)` and claims it aborts siblings on one rejection. An `AbortSignal` is read-only; only the lifecycle’s `AbortController` can call `abort()`. The current lifecycle catches a failed generation by clearing its controller, but does not abort it ([ai-suggestion-logic.ts:300](/home/bwales/projects/orbit-app/src/logic/ai-suggestion-logic.ts:300), [ai-suggestion-logic.ts:304](/home/bwales/projects/orbit-app/src/logic/ai-suggestion-logic.ts:304)). This leaves up to two provider calls running after `Promise.all` rejects, violating the stated cancellation/privacy guarantee.

  - Fix: make the lifecycle abort its controller before surfacing any non-stale generation failure, or pass an explicit `abort()` capability to the fan-out helper. Add a test proving sibling providers observe `signal.aborted` after one sibling rejects.

- **HIGH — 35-08: Rewrite source-draft cannot enter the promised bounded prompt path under the planned file scope.** The current resolver accepts only `(template, context)` ([prompt-template.ts:142](/home/bwales/projects/orbit-app/src/ai/prompt-template.ts:142)), and `ResolvedPrompt` has no source-draft field ([prompt-types.ts:159](/home/bwales/projects/orbit-app/src/ai/prompt-types.ts:159)). The current lifecycle’s `resolvePrompt` dependency is parameterless ([ai-suggestion-logic.ts:111](/home/bwales/projects/orbit-app/src/logic/ai-suggestion-logic.ts:111)), while plan 35-08 modifies only `ComposeScreen.tsx`. Therefore it cannot satisfy “delimited within the prompt-construction path” without either raw concatenation or an unplanned API change.

  - Fix: explicitly assign a small `prompt-types.ts`/`prompt-template.ts` extension to a plan: bounded, delimited `sourceDraft` input; a resolver test for trimming/delimiting it; and an inspector/payload identity test. This is user-authored data, but still must follow the same prompt-injection controls.

- **HIGH — 35-05: no verified authorization gate exists for `fuel.kind = 'off_limits'`.** The plan requires “AI-enabled” versus “AI-disabled” Off Limits rows, yet `fuel` reads expose no `allow_ai` field ([fuel-read.ts:32](/home/bwales/projects/orbit-app/src/db/fuel-read.ts:32)); the owner-facing Off Limits reader is likewise only `fuel` columns ([profile-knowledge-read.ts:181](/home/bwales/projects/orbit-app/src/db/profile-knowledge-read.ts:181)). In contrast, the existing explicit gates are on Memories ([memories-read.ts:23](/home/bwales/projects/orbit-app/src/db/memories-read.ts:23)) and interactions ([025-interaction-history-schema.ts:47](/home/bwales/projects/orbit-app/src/db/migrations/025-interaction-history-schema.ts:47)).

  This makes plan 35-05’s required distinction unimplementable without inventing permission semantics or a schema change. Because it governs new AI egress, this is an **owner escalation** under ADR-078, not an implementation detail.

  - Fix: stop before implementation and have the owner specify the durable authorization model for Off Limits: a field on fuel, a migrated/retyped memory representation, or another already-ratified model. Then assign its migration and permission UI to the owning phase.

- **MEDIUM — 35-06: Research planning omits structured Relationships.** The dossier calls Key People / Relationships useful Research content ([phase-14 dossier:280](/home/bwales/projects/orbit-app/docs/dossier/milestone-2/phase-14-messaging-ai-compose-dossier.md:280)), and a dedicated read exists ([relationships-read.ts:21](/home/bwales/projects/orbit-app/src/db/relationships-read.ts:21)). But 35-06’s projection inputs enumerate memories, custom fields, first-class fields, and current state without `relationships-read.ts` ([35-06-PLAN.md:101](/home/bwales/projects/orbit-app/.planning/phases/35-messaging-ai-compose/35-06-PLAN.md:101)).

  - Fix: add `listRelationshipsForContact` and visibility handling to the normalized projection, explicitly mark it AI-ineligible unless/until a permission model exists, and add a populated-relationship test.

- **MEDIUM — 35-07: the proposed picker lacks the data required to know that no stored primary exists.** `selectActionablePrimaryMethods` intentionally falls back to the first actionable row ([contact-methods-read.ts:10](/home/bwales/projects/orbit-app/src/db/contact-methods-read.ts:10)). It cannot tell the screen whether that result was an explicit primary or merely fallback. Plan 35-07 requires a picker “when … multiple candidate destinations and no primary” ([35-07-PLAN.md:96](/home/bwales/projects/orbit-app/.planning/phases/35-messaging-ai-compose/35-07-PLAN.md:96)) but names only that selector.

  - Fix: have the plan explicitly consume `listContactMethodGroups`, or add a pure resolver returning the effective destination plus explicit-primary/candidate metadata. Test the multi-actionable/no-primary picker path.

- **MEDIUM — 35-09 deletes the intent module but leaves its test out of scope.** The plan deletes `ai-suggestion-navigation.ts`, but its existing test imports that module directly ([ai-suggestion-navigation.test.ts:11](/home/bwales/projects/orbit-app/src/navigation/ai-suggestion-navigation.test.ts:11)) and asserts the retired route param ([ai-suggestion-navigation.test.ts:47](/home/bwales/projects/orbit-app/src/navigation/ai-suggestion-navigation.test.ts:47)). `npm test` will fail unless the test is removed or rewritten.

  - Fix: include `src/navigation/ai-suggestion-navigation.test.ts` in 35-09 and delete it with the obsolete helper, or replace it with a current serializable-origin-param test.

## Risk Assessment

**HIGH.** The overall architecture is sound, but the Off Limits authorization ambiguity is an AI-egress owner decision, and the fan-out/Rewrite gaps would otherwise produce a misleading cancellation guarantee and an unbounded prompt-construction workaround. Resolve those two HIGH findings before execution; the remaining items are straightforward plan amendments.
---

## Claude Review

_Read-only Claude Code subagent (not the `claude -p` CLI lane). Source-grounded, verified file:line claims against disk._

# Cross-AI Plan Review — Phase 35: Messaging & AI Compose (Cycle 2)

## 1. Summary

The revised (post-`ba58631`) plan set is in strong shape and materially better than cycle 1. I verified the plans against the actual code on disk — not the diff — and nearly every load-bearing `file:line` citation is accurate (handoff.ts `Promise<void>` at :49; `resolveComposeControls(hasPhone, smsAvailable)` two-arg at compose-logic.ts:71–73; the ack gate + `AI_REQUEST_TIMEOUT_MS=20_000` + `this.gen` stale-guard in ai-suggestion-logic.ts; `channel: "text"` at ComposeScreen.tsx:456; `PromptContext` at prompt-types.ts:111 with `sharedMemories?` at :138; `resolvePrompt` serializing fields explicitly at prompt-template.ts:142; `remapLegacyChannel` at interaction-assist-dao.ts:112 stamping `occurredAt = handoff_at` at :105; nav routes at DashboardStack.tsx:59 / OrreryStack.tsx:73 / types.ts:102,171; the Profile caller at ContactProfileScreen.tsx:335). All eight cycle‑1 HIGH findings are genuinely resolved in the current plans (details below). The migration numbering is correct: the chain is contiguous 1→27 (the apparent "024 gap" is `profilePresentationMigration` = version 24), `TARGET_VERSION = 27`, so plan 35‑02's `028` is truly head+1, and the plan re-verifies at execution time. The one genuinely new, unresolved issue I surface is a data-layer gap under plan 35‑05: the off‑limits **avoidance‑constraint** shape has no per‑item AI‑permission source in the current schema, so its specified AI‑enabled/AI‑disabled gate cannot be built as written. Because Phase 35 is carry‑only (a regression fence proves nothing serializes), the actual egress blast radius this phase is contained, but it touches the ADR‑078 egress‑authorization boundary and warrants an owner/planner decision.

## 2. Strengths (verified on disk)

- **Cycle‑1 HIGH‑1 (assistUid) is properly closed.** handoff.ts today returns `Promise<void>` at :49 and uses `assistUid` only internally for `markAssistFailed` at :68–69 (verified). Plan 35‑01 Task 2 widens the return to `{ handoffStarted, assistUid }` and Task 3 gates the confirmation panel on `handoffStarted === true && assistUid !== null`, eliminating the fragile re-query both cycle‑1 reviewers feared.
- **Assist coexistence / recency-writer invariant is real.** I enumerated every production writer of `interactions`: they all route through `insertInteractionCore` / `recomputeLastContactCore` in recency-dao.ts (contacts-dao, bulk-actions-dao, group-events-dao, merge-dao, interaction-assist-dao). `markAssistLogged` stamps `occurredAt = transactionAssist.handoff_at` (:105) and remaps channel (:112). Phase 35 adds **no** new interactions writer — the "sole recency writer" claim and the D‑04/D‑06 reuse posture are accurate.
- **Carry-only egress architecture is sound.** `resolvePrompt` (prompt-template.ts:142) reads `context.rankedFuel` etc. field‑by‑field and never spreads the context, so adding OPTIONAL fields to `PromptContext` cannot transmit them. Plan 35‑05 correctly places the new fields in prompt-types.ts:111 (HIGH‑4 fix), keeps them optional (no fixture breakage), and adds a prompt-template regression proving the sentinel never reaches `prompt/inspectorDisplay/payload`.
- **ADR‑078 is honored as a superseding decision, not reversed.** ADR‑078 is owner‑ratified (2026‑09‑01) and D‑13 scopes Phase 35 to carry‑only; `fuel-read.ts`'s `RANKED_FUEL_EXCLUSIONS` (:133) stays untouched and fenced by a regression test. No plan relaxes an exclusion.
- **Backup allowlist-not-emit uses a real, exact precedent.** backup-schema.ts already carries this idiom for Phases 23/25/29/30/31/32/34; the Phase‑34 block (:61–66) is the precise template, and it warns that keys must be **camelCase** (`defaultMessageMode`), not snake_case — which plan 35‑02 gets right. No `BACKUP_FORMAT_VERSION` bump, consistent with D‑03.
- **Well-sequenced ack-gate removal with no cross-wave tsc break.** 35‑01 strips all AI/ack wiring from ComposeScreen (re-added in 35‑08 wave 4), while 35‑04 reshapes the lifecycle in wave 1; nothing consumes the reshaped lifecycle until 35‑08, so there's no window where the screen wires the old ack against the new contract. `ai_ack_*` columns are deliberately left (forward-only), with an explicit prohibition against re-adding an `acknowledgeProvider` call.

**Cycle‑1 HIGHs, all resolved:** HIGH‑1 assistUid (35‑01 T2), HIGH‑2 SMS‑probe‑vs‑Email (35‑03/35‑07, probe scoped to Text), HIGH‑3 three‑variant mechanism (35‑04 `generateVariants` fan‑out, AiService unchanged — verified `generate(): Promise<string>` at AiService.ts:92), HIGH‑4 PromptContext file scope (35‑05), HIGH‑5 ComposeResearch route registration in both stacks (35‑09), HIGH‑6 normalized ResearchItem eligibility across `allow_ai`/`share_with_ai`/none (35‑06; verified memories-read.ts:31, profile-knowledge-read.ts:88, first-class-knowledge-read.ts exports `getFirstClassFields`:27 / `getFirstClassDerived`:59, current-state has no AI field), HIGH‑7 `setContactMethodPrimary` DAO (35‑03 T4; verified no such writer exists today), HIGH‑8 origin-aware caller updates (35‑09 T2). The cycle‑1 MEDIUMs (Not‑yet vs Don't‑log semantics, DAO shape threading, Rewrite source-draft placement, wave-ordering note) are also addressed.

## 3. Concerns

- **MEDIUM (new, unresolved; owner/planner touch) — the off‑limits "avoidance‑constraint" shape (plan 35‑05) has no per‑item AI‑permission source in the schema.** Off Limits items live in `fuel` as `kind='off_limits'` (profile-knowledge-read.ts:182–193 `readProfileOffLimits`, selecting `id, contact_id, kind, label, text, url, created_at, source`). The `fuel` table (migration 011:92–97) has **no** `allow_ai`/`share_with_ai`/AI‑permission column, and no migration adds one (028 is `app_settings`‑only). Yet ADR‑078:18 and dossier §355 gate avoidance-constraint egress on whether each Off Limits item is *AI‑authorized*, and ADR‑078:23 explicitly **rejects** sending AI‑disabled Off Limits items. Plan 35‑05's must‑have — populate `avoidanceConstraints` "from an AI‑eligibility‑gated off‑limits read" — and its acceptance test "an AI‑disabled off‑limits item appears in NEITHER collection" / "an AI‑enabled off‑limits item appears ONLY in avoidanceConstraints" **cannot be implemented against the current schema**, because there is no AI‑enabled vs AI‑disabled distinction for off_limits fuel rows. RESEARCH.md line 342 spots the parallel interaction‑note case ("the `allow_ai` gate column already exists; the projection code does not") but only for `interactions.allow_ai` (migration 025, verified) — it never identifies a permission source for off‑limits, and neither does any plan. *Mechanism / why it matters:* the three resolutions an executor could reach all carry risk — (a) carry **all** off‑limits ungated seeds a shape that, when Phase 36 renders it, transmits AI‑disabled off‑limits = the ADR‑078 rejected alternative; (b) carry **none** makes SC‑11's avoidance half vacuous; (c) add a `fuel.allow_ai` column = an unplanned, irreversible schema migration outside this phase's stated one‑migration scope. *Blast radius this phase is bounded* because 35‑05 is carry‑only and the prompt-template regression proves non‑transmission — so nothing actually leaks in Phase 35 regardless. But the spec as written points the executor at an unbuildable gate on the egress‑authorization boundary, which is exactly the class D‑08/D‑13 reserve to the owner.
  - *Contrast:* the **gatedRecentInteractionNotes** half of 35‑05 is well‑grounded — `interactions` has both `allow_ai` (migration 025:48) and `note` (001:107 / 011 rebuild), so that gate is implementable and testable. The gap is specific to off‑limits.

- **LOW — origin‑aware return spans two stacks; verify the `'profile'` pop resolves in the Orrery stack.** ComposeScreen is registered in both DashboardStack and OrreryStack; ContactProfileScreen (the only caller passing `origin:'profile'`) is used in both. Plan 35‑09 T2 correctly leaves HomeScreen/widget/notification callers unmodified (optional param type‑checks). The "pop toward Profile" return path is device‑backstop‑only (no unit test), and stack‑dependent — worth an explicit note that the return dispatch must resolve within whichever stack launched Compose. Not a blocker.

- **LOW — 35‑05's `avoidanceConstraints` empty-shape default should be made the explicit interim.** Given the concern above, if the owner/planner decides off‑limits sourcing is deferred, the cleanest carry‑only posture is for `readComposeResearch`/`readPromptContext` to carry an **empty** `avoidanceConstraints` array this phase (the gated‑note half proceeds normally). The plan currently implies population; it should state the empty‑until‑gate‑exists fallback so the executor doesn't improvise ungated population.

## 4. Suggestions (concrete, per-plan)

- **Plan 35‑05 (must_haves + Task 1 action/acceptance):** Resolve the off‑limits source before execution. Either (a) state that `avoidanceConstraints` is carried as an **empty typed shape** this phase pending a per‑item off‑limits AI‑permission (and drop/replace the "AI‑disabled off‑limits appears in neither collection" acceptance test with a "shape carried empty; no off‑limits text serialized" test), or (b) escalate to the owner that ADR‑078's authorized off‑limits avoidance requires a per‑item permission column on `fuel` that does not exist, so its *source* (not just its rendering) is a decision — likely Phase 36 / knowledge‑foundation scope. Keep the `gatedRecentInteractionNotes` half as specified (it is buildable).
- **Plan 35‑05 (Task 1 read_first):** Add profile-knowledge-read.ts:182 (`readProfileOffLimits` → `fuel.kind='off_limits'`) and migration 011:92 (fuel schema) to the read list so the executor sees there is no `allow_ai` on off_limits before attempting the gate.
- **Plan 35‑09 (Task 2 acceptance):** Add an explicit check that the origin‑aware return dispatch resolves within the launching stack (Dashboard vs Orrery), since the pop‑toward‑Profile path is otherwise only device‑verified.

## 5. Risk Assessment

**Overall: MEDIUM (bordering LOW).** The plan set is unusually well‑grounded — every file:line I spot‑checked was accurate, the migration/recency‑writer/egress invariants hold, all eight cycle‑1 HIGHs are genuinely closed, and the carry‑only egress architecture is provably safe via the prompt‑template regression. The single material open item is the off‑limits avoidance‑constraint source gap in plan 35‑05: it cannot be built as specified against the current schema, and its naive resolution would seed the ADR‑078 rejected‑alternative shape for Phase 36. It is **not** a live egress leak this phase (carry‑only + regression fence contain it), which is why I rate MEDIUM rather than HIGH — but because it sits on the egress‑authorization boundary that D‑08/D‑13 reserve to the owner, it should be resolved (owner decision on off‑limits permission source, or an explicit empty‑shape interim) before 35‑05 executes. With that one clarification, this drops to LOW and is ready to run.

---

<!-- ============================================================ -->
<!-- CYCLE 1 ARCHIVE (superseded — all 8 HIGHs resolved by ba58631) -->
<!-- Retained verbatim for convergence history. Counts below are cycle-1. -->
<!-- ============================================================ -->

# [ARCHIVED] Cycle 1 Review (cycle_summary: current_high=8 current_actionable=7)


# Cross-AI Plan Review — Phase 35: Messaging & AI Compose (cycle 1)

Two source-grounded reviewers ran this cycle — **Codex** (`gpt-5.6-terra`, reasoning=low) and **Claude** (`sonnet`, reasoning=low). Both cited concrete `file:line` evidence against the live repo; neither ran without repo access. Codex read more of the data/navigation layer and surfaced substantially more blocking gaps; Claude verified a narrower set of files in more depth. No finding proposes reversing or weakening an ADR/HANDOFF decision, so none is an owner escalation — every finding is a plan-completeness gap (missing API/route/file-scope) that `/gsd-plan-phase 35 --reviews` can incorporate.

## Consensus Summary

The plan set is product- and ADR-aware, correctly reuses the assist lifecycle, migration pattern, fuel exclusions, and prompt-context allowlist, and sequences waves 1→5 soundly. Both reviewers independently found the **same blocking gap**: the Compose-attached "Did you send it?" confirmation depends on an `assistUid`/handoff outcome that `performReachOut()` (returns `Promise<void>`) never exposes. Beyond that, Codex flags a cluster of unaddressed API/route boundaries (three-suggestion provider contract, `PromptContext` file scope, `ComposeResearch` route registration, Add-to-AI permission-shape normalization, a set-primary DAO, origin-aware caller updates) that would cause execution to compile/run only after unplanned changes. Overall risk: **HIGH** — address the HIGH findings before execution.

### Agreed Strengths
- Assist lifecycle treated as additive/reuse-only; `markAssistLogged()` writes at original `handoff_at` and ADR-070/071 coexistence is guarded by prohibitions + regression tests (both reviewers).
- Migration 028 correctly verified as head+1 on disk (027/`TARGET_VERSION 27`), with plan-time re-verification (both reviewers).
- D-13 egress boundary respected: Plan 05 carries shape only, does not widen what leaves the device; `fuel-read.ts` exclusions left intact (both reviewers).
- ADR-079 ack-gate removal scoped to `ai-suggestion-logic.ts` while preserving the abort/stale-guard machinery (both reviewers).

### Agreed Concerns
- **HIGH (both) — `performReachOut()` never returns the created `assistUid`.** It returns `Promise<void>` and uses the UID only internally for `markAssistFailed` (`src/services/reach-out/handoff.ts`). Plan 35-01's panel must call `markAssistLogged({ assistUid })` directly but no plan changes the signature — executor will improvise a fragile re-query or silently miss the acceptance criterion. Fix: return `{ handoffStarted, assistUid|null }` (or a handoff-session API) in the plan that owns `handoff.ts`.
- **SMS probe-pending vs Email transmit** — Codex rates HIGH, Claude MEDIUM. `resolveComposeControls()`'s `smsAvailable === null` gate is phone/SMS-only (`src/logic/compose-logic.ts:64`); Email handoff uses `Linking.openURL()` and has no SMS dependency. Plans must state that probe-pending precedence applies to Text only and Email stays transmittable while SMS availability is unknown.

### Divergent Views
- **Depth/coverage gap.** Codex raised 7 additional HIGHs (three-suggestion provider contract; `PromptContext` in `prompt-types.ts` missing from Plan 05 file scope; `ComposeResearch` route unregistered in both stacks; Add-to-AI eligibility spanning `allow_ai`/`share_with_ai`/none across three read sources; no `setContactMethodPrimary()` DAO; origin-aware return needs all Compose callers updated) that Claude did not flag as blocking — Claude explicitly did not open some of those files (e.g. `first-class-knowledge-read.ts`) and rated related items LOW. Where the two overlap they agree in direction; the severity gap reflects coverage, not contradiction. Treat Codex's HIGH cluster as the load-bearing set to resolve.

---

## Codex Review

# Phase 35 Plan Review

## Summary

The plan sequence has strong product/ADR awareness and correctly identifies the existing Compose, assist, migration, and prompt-context seams. However, several planned artifacts cannot work with the current APIs or navigation topology as scoped. The most serious gaps are: confirmation state cannot be reliably attached to a handoff with the current `performReachOut()` return contract; Research is never registered as a navigation route; primary-destination selection has no suitable DAO API; and the proposed three-suggestion lifecycle has no provider contract capable of producing three variants.

## Strengths

- The assist lifecycle is correctly treated as additive. `markAssistLogged()` already writes the interaction at the original `handoff_at`, remaps transport values to the canonical interaction vocabulary, and uses the shared recency writer ([interaction-assist-dao.ts](/home/bwales/projects/orbit-app/src/db/interaction-assist-dao.ts:99)). Keeping this unchanged is the right approach.

- Plan 02 correctly uses the established migration pattern. Migration 027 is additive, `app_settings`-only, and uses the same `"remember"` sentinel shape ([027-default-interaction-channel.ts](/home/bwales/projects/orbit-app/src/db/migrations/027-default-interaction-channel.ts:28)). The live migration head is 027 ([database.ts](/home/bwales/projects/orbit-app/src/db/database.ts:68)).

- Plans 03 and 07 correctly reuse `selectActionablePrimaryMethods()` rather than inventing a message-destination model; it selects actionable phone and email methods together ([contact-methods-read.ts](/home/bwales/projects/orbit-app/src/db/contact-methods-read.ts:10)).

- Plan 05 correctly preserves the current positive-fuel exclusion. `getRankedFuel()` excludes off-limits, AI-sourced, and blank rows in SQL ([fuel-read.ts](/home/bwales/projects/orbit-app/src/db/fuel-read.ts:133)), while `listFuelForEditor()` is deliberately the sole owner-facing read that can surface off-limits rows ([fuel-read.ts](/home/bwales/projects/orbit-app/src/db/fuel-read.ts:45)).

- Plan 04 correctly preserves the lifecycle’s useful safety mechanisms: a generation token, one abort controller, and a 20-second timeout ([ai-suggestion-logic.ts](/home/bwales/projects/orbit-app/src/logic/ai-suggestion-logic.ts:151)). Removing the obsolete acknowledgement gate is consistent with the phase decision, provided the entire dependency path is removed.

## Concerns

### Plan 01 — HIGH: the Compose confirmation panel lacks a reliable assist identity/outcome

`performReachOut()` returns `Promise<void>` and catches native handoff failures internally ([handoff.ts](/home/bwales/projects/orbit-app/src/services/reach-out/handoff.ts:39)). It does not expose whether an assist was created, its UID, whether assists were enabled, or whether the OS handoff actually launched. The proposed Compose panel therefore has no safe `assistUid` to pass to `markAssistLogged()` / dismissal, and could appear after a failed handoff.

Plan 01 must either:

- extend `performReachOut()` to return a structured outcome such as `{ handoffStarted, assistUid }`; or
- create a separate, explicit handoff-session API.

This must be available before Plan 01, not deferred to Plan 03.

### Plan 01 — MEDIUM: “Not yet” wording conflicts with the planned dismissal behavior

The plan says “Not yet” dismisses the panel while leaving the durable assist pending. But `markAssistDismissed()` is the durable “Don’t log” route, changing status to `dismissed` ([interaction-assist-dao.ts](/home/bwales/projects/orbit-app/src/db/interaction-assist-dao.ts:141)). The plan needs explicit UI semantics:

- “Not yet”: close only the local panel; leave assist pending.
- “Don’t log” / dismissal: call `markAssistDismissed()`.

Otherwise the required dismissal path is not actually reachable from Compose.

### Plan 02 — LOW: DAO integration scope is underspecified

The current DAO uses one generic `updateAppSettings()` path, with validation before a transaction and a shared `COLUMN_OF` map ([app-settings-dao.ts](/home/bwales/projects/orbit-app/src/db/app-settings-dao.ts:1169)). The plan should explicitly update all of these coupled shapes:

- `AppSettings`
- `AppSettingsRow`
- `AppSettingsPatch`
- `WritableSettingsKey`
- `COLUMN_OF`
- read projection and tests

Adding standalone setters without integrating the generic patch path would make backup restore and settings updates inconsistent.

### Plan 03 — HIGH: SMS probe-pending must not disable Email transmit

The behavior matrix says `smsAvailable === null` hides Transmit “regardless of mode.” That is wrong for Email: email handoff uses `Linking.openURL()` and has no dependency on `expo-sms`. The current SMS gate is explicitly phone/SMS-only ([compose-logic.ts](/home/bwales/projects/orbit-app/src/logic/compose-logic.ts:64)).

Make probe-pending precedence apply only to Text mode. Email with an actionable email destination should remain transmittable while SMS availability is unknown.

### Plan 04 — HIGH: no implementation path produces three suggestions

The current lifecycle dependency is `generate(...): Promise<string>` ([ai-suggestion-logic.ts](/home/bwales/projects/orbit-app/src/logic/ai-suggestion-logic.ts:121)), and the provider interface likewise returns one string ([AiService.ts](/home/bwales/projects/orbit-app/src/services/AiService.ts:92)). Plan 04 modifies neither provider contract nor the provider invocation adapter.

The plan must decide and test one actual mechanism:

- one provider call that requests/parses exactly three variants; or
- three independently cancellable calls sharing a request token and cancellation signal.

That decision affects `AiService`, provider tests, error handling, cost, cancellation, and meaningfully-varied output. It cannot be completed by changing only `ai-suggestion-logic.ts`.

### Plan 05 — HIGH: `PromptContext` changes are missing from the file plan

`PromptContext` is defined in [prompt-types.ts](/home/bwales/projects/orbit-app/src/ai/prompt-types.ts:111), not `ai-context-read.ts`. It is explicitly a closed outbound allowlist: adding fields is the compile-time widening mechanism ([prompt-types.ts](/home/bwales/projects/orbit-app/src/ai/prompt-types.ts:8)).

Plan 05 lists only `ai-context-read.ts` and tests, but must also modify:

- `src/ai/prompt-types.ts`
- all `PromptContext` fixtures
- likely `src/ai/prompt-template.test.ts`

The carry-only decision is viable because `resolvePrompt()` currently explicitly serializes selected fields rather than spreading the context ([prompt-template.ts](/home/bwales/projects/orbit-app/src/ai/prompt-template.ts:164)). But that safety must be locked with tests proving the new shapes are absent from the resolved provider payload until Phase 36.

### Plan 06 / Plan 09 — HIGH: `ComposeResearchScreen` is not registered anywhere

Neither stack currently has a `ComposeResearch` route. Dashboard only registers `Compose` ([DashboardStack.tsx](/home/bwales/projects/orbit-app/src/navigation/tabs/DashboardStack.tsx:59)), and the Orrery stack does the same ([OrreryStack.tsx](/home/bwales/projects/orbit-app/src/navigation/tabs/OrreryStack.tsx:73)). Neither plan modifies those stack files or adds route types.

Add `ComposeResearch` to both relevant param lists and both stacks. Otherwise the proposed navigation from Compose will fail at compile time or runtime.

### Plan 06 — HIGH: Add-to-AI eligibility is not one common `allow_ai` shape

Memories expose `allow_ai` ([memories-read.ts](/home/bwales/projects/orbit-app/src/db/memories-read.ts:23)). Custom fields expose `share_with_ai` ([profile-knowledge-read.ts](/home/bwales/projects/orbit-app/src/db/profile-knowledge-read.ts:160)). First-class fields have neither permission field ([first-class-knowledge-read.ts](/home/bwales/projects/orbit-app/src/db/first-class-knowledge-read.ts:11)). The plan’s generic “all AI-authorized research items” needs a normalized Research-item view model that specifies which source types are selectable and which source-specific permission controls govern them.

Do not make the session store infer eligibility. Give it a validated item shape built at the read/projection boundary.

### Plan 07 — HIGH: no set-primary DAO exists for a lightweight Compose picker

The existing contact-method writer is `applyContactMethodDiff()`, which requires the entire seeded/current method set and handles ordering, tombstones, normalization, and revision updates ([contact-methods-dao.ts](/home/bwales/projects/orbit-app/src/db/contact-methods-dao.ts:99)). There is no `setPrimaryMethod()` function.

Plan 07 says it will use “the set-primary DAO,” but does not modify `contact-methods-dao.ts`. Add a purpose-built, transaction-safe `setContactMethodPrimary()` API, or deliberately invoke the full diff API with all its required inputs. The latter is inappropriate for a quick Compose picker.

### Plan 08 — MEDIUM: rewrite semantics and three-variant transport are still ambiguous

The plan says the lifecycle chooses Draft vs Rewrite based on editor content, but the current provider prompt is body-only and does not receive an explicit source draft in its API shape ([ComposeScreen.tsx](/home/bwales/projects/orbit-app/src/screens/ComposeScreen.tsx:233)). Define where the existing body is incorporated into the prompt and verify it remains within the closed, delimited, bounded prompt construction path.

### Plan 09 — HIGH: origin-aware return cannot work until callers pass origin

Profile currently launches Compose with only `{ contactId }` ([ContactProfileScreen.tsx](/home/bwales/projects/orbit-app/src/screens/ContactProfileScreen.tsx:335)); Home does likewise ([HomeScreen.tsx](/home/bwales/projects/orbit-app/src/screens/HomeScreen.tsx:1287)); widget/deep-link flows also pass only `contactId` ([widget-linking.ts](/home/bwales/projects/orbit-app/src/navigation/widget-linking.ts:178)).

Adding an optional `origin` param only in `ComposeScreen` and `types.ts` will not cause a Profile-launched session to return to Profile. Plan 09 needs to modify all Compose entry points, with defaults only where semantics are genuinely the same.

## Suggestions

- Insert a Wave 1.5 handoff-contract plan before the tracer UI: return assist identity and handoff outcome from `performReachOut()`, then test native-launch failure and assist-disabled behavior.

- Add `ComposeResearchScreen` route registration to both stacks and both param lists in Plan 06, before Plan 09 attempts to navigate there.

- Split `resolveComposeControls()` by transport: SMS availability governs Text only; Email needs its own URL availability/error posture.

- Expand Plan 04’s file scope to include the actual three-variant provider strategy and its `AiService` tests.

- Expand Plan 05’s file scope to include `prompt-types.ts` and prompt-template regression tests that prove carry-only shapes cannot serialize before Phase 36.

- Add a canonical single-method primary writer to `contact-methods-dao.ts`, with a test covering primary swap and data-revision behavior.

- Add navigation tests for:
  - Profile → Compose → confirmed log → Profile
  - dashboard/deep-link → Compose → confirmed log → dashboard root
  - Back cannot resurrect an already-completed Compose route.

## Risk Assessment

**HIGH.** The product direction and decision compliance are mostly sound, but the current plan boundaries omit required APIs and route registrations. Executing in order would likely produce an unusable confirmation panel, an unreachable Research screen, broken primary-method selection, and an AI lifecycle that compiles only after unplanned provider-layer changes. Address the HIGH findings before execution.

---

## Claude Review

# Cross-AI Plan Review — Phase 35: Messaging & AI Compose

## Summary

This is a mature, well-sequenced 9-plan set for a refactor phase, and the supporting documents (RESEARCH/PATTERNS/UI-SPEC/CONTEXT) are unusually well grounded — nearly every cited `file:line` I spot-checked against the actual repo was accurate (migration head 027→028, the D-06 `remapLegacyChannel` fix already in `interaction-assist-dao.ts:112`, the live ack gate in `ai-suggestion-logic.ts`, the hardcoded `channel: "text"` at `ComposeScreen.tsx:456`, `resolveComposeControls`'s current two-argument signature, `RANKED_FUEL_EXCLUSIONS` in `fuel-read.ts`). The dependency graph (waves 1→5) is sound and the ADR-070/071 coexistence trip-wire is treated with real weight (tests, explicit prohibitions, a plan-checkpoint). However, I found one concrete, unaddressed wiring gap that will block Plan 35-01's core acceptance criterion, plus several lower-severity sequencing and scope risks below.

## Strengths

- **Migration numbering verified correct.** `src/db/database.ts:68` confirms `TARGET_VERSION = DEFAULT_INTERACTION_CHANNEL_SCHEMA_VERSION = 27` and the highest file on disk is `027-default-interaction-channel.ts` — 028 is genuinely head+1, and Plan 35-02 Task 2 explicitly re-verifies this at execution time rather than trusting the plan-time snapshot.
- **D-06 correctly treated as reuse-only.** `interaction-assist-dao.ts:105-112` already calls `remapLegacyChannel(transactionAssist.channel)` with a comment citing "review cycle-2 HIGH, T-32-03" — Plan 35-01 Task 3 wisely locks this via regression tests instead of re-implementing it (Pitfall 1 from RESEARCH.md is correctly heeded).
- **ADR-070/071 coexistence guarded on multiple axes**: an ESCALATE-gated checkpoint doesn't appear here, but the `must_haves.prohibitions` in 35-01 explicitly forbid removing `AssistBanner`/`PendingConfirmationsSheet`/dismissal path, Task 3 adds regression tests asserting `occurredAt === handoff_at` (not confirmation time), and the plan correctly identifies `markAssistDismissed` as the "Not yet" analog.
- **ADR-079 ack-gate removal is scoped cleanly.** Plan 35-04 correctly targets `ai-suggestion-logic.ts`'s `needs-acknowledgement` state (verified live at lines 87, 223, 232, 244 in the current file) and preserves the `AbortController`/`this.gen` stale-guard machinery (verified at lines 192, 207, 216, 305, 312, 348) — this is exactly the "reshape cleanly, don't half-wire" risk ADR-079 itself calls out.
- **D-13 egress-widening boundary is respected.** Plan 35-05 correctly scopes to "carry the shape, don't render/transmit" and explicitly prohibits editing `fuel-read.ts`'s exclusions — consistent with the owner-resolved D-13 in CONTEXT.md.
- **Sensible dependency ordering**: schema (35-02) and pure logic (35-03, 35-04, 35-05) are parallelized in early waves before the two ComposeScreen integration passes (35-07, 35-08) which depend on all of them, with a final polish pass (35-09) closing navigation/Research-linking last.

## Concerns

- **HIGH — `performReachOut` never returns the created `assistUid`, but Plan 35-01 depends on the screen calling `markAssistLogged` directly.** I verified `src/services/reach-out/handoff.ts` in full: `performReachOut` returns `Promise<void>`; the `assistUid` from `createPendingAssist` is used internally only for the `catch` block's `markAssistFailed` call and is never returned to the caller. `markAssistLogged` (`interaction-assist-dao.ts:74-79`) requires `{ assistUid: string; ... }` as an argument. Today's `ComposeScreen.onSend` (lines 440-465) calls `performReachOut` and does nothing further — the existing "Did you send it?" experience is handled entirely by the app-global `AssistBanner`, which independently re-queries `listEligiblePendingAssists` rather than being handed an ID. Plan 35-01 Task 2's acceptance criteria state the Compose-attached panel's "Yes, log interaction" button must call `markAssistLogged` directly — but no task in 35-01 (or 35-03, which touches `handoff.ts` next) changes `performReachOut`'s signature to expose the assist UID it just created. As written, the executor will either invent an ad-hoc solution (e.g., re-querying the assist table by contact+timestamp, which is fragile and untested) or silently fail this acceptance criterion. **This must be added explicitly**: either `performReachOut` should return the created `assistUid` (or `null` if assist-disabled), or an equivalent lookup contract must be specified.
- **MEDIUM — Plan 35-01's `compose-logic` dependency is stated as `depends_on: []` but Task 2 explicitly says "gate through the existing `resolveComposeControls`" while Plan 35-03 (wave 2, declared as depending on 35-02 only) is the plan that extends `resolveComposeControls` for mode/no-destination.** Since 35-01 only needs Text-mode behavior (the pre-existing two-argument signature), this is probably fine in practice, but the wave declaration doesn't make the implicit ordering constraint (35-01's Task 2 must run against the *pre-extension* `compose-logic.ts`, and 35-07 must not run before 35-03 lands) airtight — if plans were executed out of the stated wave order, 35-01 could silently start consuming a not-yet-extended API. Worth a note in 35-01 acknowledging it uses only the current 2-arg gate.
- **MEDIUM — `expo-sms` behavior on the email-arm extension isn't cross-checked against `SMS.isAvailableAsync()` gating.** `resolveComposeControls`'s `smsAvailable === null` no-flash discipline is Text-specific (probes device SMS capability). Plan 35-03's mode-aware extension needs an equivalent-but-different treatment for Email (there is no "email availability" probe — `mailto:` is assumed always available via `Linking`). The plan's behavior list doesn't explicitly state whether Email mode ever needs a probe-pending state analogous to `smsAvailable === null`, which could leave an asymmetric implementation (Email always resolves synchronously, Text has a transient unknown state) — likely fine, but the plan should say so rather than leave it implicit.
- **LOW — Plan 35-06's Task 2 (`ComposeResearchScreen`) doesn't fully cross-check `getFirstClassDerived`/`getFirstClassFields` exports against `first-class-knowledge-read.ts`** (I did not open that file this session); the plan's citations of `ThingsToRememberScreen.tsx` imports were accurate for the ones I did check (`MemoryEditor`, `RelationshipEditor`, `Switch`, `setCurrentStateValue`, `getCurrentStateValues` all confirmed present at the cited lines), so this is a minor unverified-but-plausible gap rather than a contradiction.
- **LOW — Plan 35-04's removal of `acknowledgeProvider`/`isProviderAcknowledged` from `ai-suggestion-logic.ts` doesn't mention the DAO-level `acknowledgeProvider` writer in `app-settings-dao.ts` (confirmed present, "the SOLE ai_ack_* writer" at line 1340) or the call site at `ComposeScreen.tsx:201`.** This is actually handled correctly — Plan 35-01 Task 2's "REMOVE" instructions cover the screen-level ack usage, and the DAO writer is explicitly left alone per D-09/ADR-079 ("removal is optional... likely NOT worth it"). Flagging only because the ownership split across three plans (35-01 removes the screen call, 35-04 removes the logic-module ack state, DAO writer untouched) is correct but not stated as a single coherent instruction anywhere — a plan-checker pass should confirm no plan re-adds a call to the now-orphaned `acknowledgeProvider` DAO function.
- **LOW — Plan 35-09 Task 3 says "confirm no remaining caller" for `requestAiSuggestion` via `grep`, but this runs in wave 5, after 35-01/35-07/35-08 have already touched `ComposeScreen.tsx` multiple times.** If an earlier plan (e.g., 35-01's screen rebuild) doesn't fully strip the `route.params.requestAiSuggestion` consumption from the focus effect (confirmed present today at lines 349, 354, 400), the wave-5 grep could still find a live reference and the removal becomes an unplanned larger diff at the end of the sequence. Since 35-01's "rebuild" task doesn't explicitly mention this param, it may survive un-noticed until 35-09 — low risk since 35-09 does catch it, but it means three plans touch the same route-param lifecycle across four waves with no single owner until the very end.

## Suggestions

- Add an explicit task (likely in 35-01 or 35-03) to change `performReachOut`'s return type from `Promise<void>` to `Promise<{ assistUid: string | null }>` (or equivalent), and update its one existing call site (`ComposeScreen.tsx` `onSend`) plus the future compose-attached confirmation handler to consume it. This closes the HIGH gap above and should be called out as a `files_modified` change to `handoff.ts` and its test file in whichever plan owns it (35-01 is Wave 1 with no deps, so it's the natural place, but 35-03 also touches `handoff.ts`'s email arm in Wave 2 — pick one and cross-reference from the other).
- In Plan 35-03, explicitly state whether the no-destination/probe-pending precedence extends symmetrically to Email mode, or whether Email is always treated as "resolved" (no probe state) — this is implicit today and should be a stated behavior-matrix row.
- Consider having Plan 35-01 explicitly grep-and-confirm it has fully removed `route.params.requestAiSuggestion` consumption from the tracer rebuild (even though final retirement is 35-09's job), since 35-01 already deletes the ack gate and fuel-first layout from the same file — doing the two together reduces the chance of a stray reference surviving into later waves.

## Risk Assessment

**MEDIUM.** The plan set is unusually well-researched and grounded in verified file:line citations, the ADR-070/071 coexistence and ADR-078/079 egress/ack boundaries are respected with concrete tests and prohibitions, and the wave sequencing is architecturally sound. The one HIGH finding (missing `assistUid` return from `performReachOut`) is a real, concrete blocker for Plan 35-01's stated acceptance criteria as written — it's a small, mechanical fix, but it isn't specified anywhere in the nine plans and would otherwise surface as an unplanned deviation mid-execution. With that gap closed, this would be a LOW-risk plan set.
