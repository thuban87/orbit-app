---
phase: 35
reviewers: [codex, claude]
reviewed_at: 2026-09-13T08:29:05Z
cycle: 1
plans_reviewed: [35-01-PLAN.md, 35-02-PLAN.md, 35-03-PLAN.md, 35-04-PLAN.md, 35-05-PLAN.md, 35-06-PLAN.md, 35-07-PLAN.md, 35-08-PLAN.md, 35-09-PLAN.md]
models:
  codex: "gpt-5.6-terra (reasoning=low)"
  claude: "sonnet (reasoning=low)"
model_sources:
  codex: "banner"
  claude: "pinned"
cycle_summary: current_high=8 current_actionable=7
---

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
