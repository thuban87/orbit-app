---
phase: 32
reviewers: [codex, claude]
reviewed_at: 2026-09-11
cycle: 2
plans_reviewed: [32-01-PLAN.md, 32-02-PLAN.md, 32-03-PLAN.md, 32-04-PLAN.md, 32-05-PLAN.md, 32-06-PLAN.md, 32-07-PLAN.md, 32-08-PLAN.md]
models:
  codex: "gpt-5.6-terra (reasoning=high)"
  claude: "claude read-only subagent"
model_sources:
  codex: "banner"
  claude: "subagent"
---

# Cross-AI Plan Review — Phase 32 (Interaction History & Insights) — Convergence Cycle 2

Both lanes ran with full repo read access and cited `file:line` evidence throughout; both are weighted as grounded plan reviews. This cycle judges the plans as revised in commit `2befa75` (cycle-1 fixes). The orchestrator independently source-verified the load-bearing claims below (migration head = 24, the two `quality` literal consumers, the `restore-apply.ts:189` verbatim writer, `SettingsStack` route registrations, the `computeIntensity` core signature).

## Consensus Summary

**Overall:** The revision holds all three settled boundaries — no Phase-33 group schema in migration 025, no Phase-36 `BACKUP_FORMAT_VERSION` bump, no `quality` column rename. Both reviewers independently confirmed no forbidden-reversal defect (D-07/D-12, backup format, column name are all intact). Cycle-1's HIGH findings (restore/export vocabulary miscount, the checkpoint reopening a settled rename, pause-on-blur ownership, delete-DAO test homing) are genuinely resolved on disk. What remains are correctness-detail and specification gaps in individual plans, not architectural flaws.

**Verdict split:** codex "changes requested" (4 HIGH); claude MEDIUM (0 HIGH, 3 MEDIUM). The divergence is severity calibration, not disagreement on facts — both reviewers (and the orchestrator's own on-disk check) agree the underlying gaps are real.

### Agreed Strengths (raised by both reviewers)
- Migration 025 is ALTER+UPDATE only (no rebuild) — verified `interactions` has no CHECK on `channel`/`quality`; additive columns + value remap are safe and forward-only.
- `allow_ai INTEGER NOT NULL DEFAULT 0 CHECK(allow_ai IN (0,1))` is fail-closed and stronger than the cited `017` precedent; every INSERT that omits it (restore, benchmark, recency core) lands OFF (D-04 privacy).
- The single-writer recency spine is respected everywhere (`recency-dao.ts` insert/edit/delete cores); the delete regression is correctly homed at the DAO in Plan 01.
- The group seam is inert by construction (no `group_event_id` column exists; `isGroupLinked` resolves hard-false), grep-gated against early group schema — D-12 held.
- Keeping the SQL column `quality` is load-bearing and correctly locked (`export-manifest.ts:52`, `restore-apply.ts:65,189` round-trip by name).

### Agreed Concerns (raised by both reviewers — highest priority)
- **Plan 01 — `markAssistLogged` omits `email → Message`** (codex HIGH, claude MEDIUM). `interaction-assist-dao.ts:98` writes the assist `channel` raw; the `014` CHECK allows `call|text|email`; the plan enumerates only `call→Call`/`text→Message`. An `email` assist reintroduces the retired `email` value into a v25 DB — a live writer re-opening the partial-rename hazard the phase treats as HIGH (T-32-03). **Fix:** route the assist channel through the shared `remapLegacyChannel` and add an `email`-assist test case.
- **Plan 03 — window-scoped intensity is underspecified** (codex HIGH: the `now`/reference-instant passed to `computeIntensity` is unspecified, so a historical window computed against real "now" reads ~0, breaking HIST-06; claude MEDIUM: the window-derived *period* formula is unspecified and only inequality-tested). **Fix:** require passing `effectiveNow = end of the selected window` AND pin the period formula; add a fixed-**value** intensity assertion for a past window that contains interactions (not just "two windows differ").
- **Plan 05 — app-settings persistence seam incompletely named** (codex HIGH: `AppSettingsPatch = Partial<Omit<PortableSettingsSnapshot>>` at `app-settings-dao.ts:286`, so `historyLens`/`historyCycleCount` must be added to `PortableSettingsSnapshot` (`:226`) or `updateAppSettings({historyLens})` will not typecheck; claude MEDIUM: "the SELECT column list" is ambiguous — extend `getAppSettings` (`:496`), not the Phase-36-reserved snapshot SELECT (`:627`)). **Fix:** name `PortableSettingsSnapshot` and `getAppSettings` explicitly among the seams, and assert the portable-snapshot emission path stays untouched.

### Divergent Views (raised by one reviewer — worth investigating)
- **Plan 08 — Settings-originated knowledge-change route crash (codex HIGH; claude did not flag).** Orchestrator-verified on disk: `SettingsStack.tsx` registers neither `ThingsToRemember` nor `MemoryHistory`, while Dashboard/Orrery do; `ContactProfileScreen.tsx:398-413` navigates to `ThingsToRemember`. Plan 08 wires the History `onOpenKnowledgeChange` through "the profile's existing knowledge nav" and claims "no new cross-stack gap." That claim is only half-true: the reused callback already targets a route unregistered in Settings, so a Settings-originated History knowledge-change edit navigates to an unregistered route and throws. The gap is pre-existing (Phase 32 reuses, not introduces, the target) but Phase 32 gives it a new Settings-reachable entry point. **Fix (parallel to what Plan 08 already does for `LogContact`):** register `ThingsToRemember` + `MemoryHistory` in `SettingsStack`, or explicitly scope the knowledge-change action out of Settings-originated History with a Settings-origin UAT.
- **Plan 01 — migration CASE derived from a mutable helper (codex MEDIUM; claude did not flag).** The plan permits migration 025 to build its SQL CASE from `interaction-vocabulary.ts` at runtime; a later helper edit would silently alter a shipped migration's behavior. The plan already offers the safe alternative ("or add a test pinning the migration SQL outputs equal to the helper outputs") — make that the required option: freeze the CASE literals in the migration and test-pin them against the shared helper.
- **Plan 03 — complete-contact knowledge read seam (codex MEDIUM; claude verified the module exists).** codex reads `current-state-history-read.ts:61` as a single-field-at-a-time seam; claude confirmed `getCurrentStateHistory` exists. **Fix:** require the read to surface every registered current-state field (not one `fieldKey`) and test ≥2 distinct field keys + same-timestamp ordering.

### Lower-severity actionable items (LOW)
- **Plan 02:** specify `recordEventCore` `occurredAt = now` and assert `occurred_at === now` in the round-trip test.
- **Plan 07:** confirm `TimelineRow` is actually reused as the sheet's per-record renderer in `DateDetailSheet`; if not, the bind/unbind `EVENT_LABELS` edit is dead code and lifecycle rows need their own renderer.
- **Plan 08:** add a one-line note that HIST-15's real detailed-log form is a Phase-34 deliverable so verification does not over-credit it (the plan already scopes this correctly; this is a verifier-facing note).

---

## Codex Review

_Model: gpt-5.6-terra (reasoning=high). Full repo read access; source-grounded._

# Phase 32 plan review — cycle 2

Overall verdict: **changes requested**. The revision successfully preserves the settled boundaries—no Phase-33 group schema, no Phase-36 backup bump, and no `quality` column rename—but four HIGH gaps remain.

## Plan 01 — Migration and vocabulary

**Summary:** Strong migration/consumer-lockstep plan, but Interaction Assist still leaves one legacy channel path unmigrated.

**Strengths**

- The existing interaction schema has no channel/quality CHECK, so additive columns plus value updates are appropriate; no rebuild is needed. [`001-initial.ts:97`](/home/bwales/projects/orbit-app/src/db/migrations/001-initial.ts:97)
- The plan correctly targets the active aggregate and digest literal comparisons, which currently still test `good`/`fine`/`hard`. [`ai-context-read.ts:132`](/home/bwales/projects/orbit-app/src/db/ai-context-read.ts:132) [`digest-read.ts:158`](/home/bwales/projects/orbit-app/src/db/digest-read.ts:158)
- It respects the single recency writer: current inserts and edits are centralized in [`recency-dao.ts:195`](/home/bwales/projects/orbit-app/src/db/recency-dao.ts:195) and [`recency-dao.ts:281`](/home/bwales/projects/orbit-app/src/db/recency-dao.ts:281).

**Concerns**

- **HIGH — `email` Interaction Assists will continue writing the retired interaction channel.** The source assist table permits `call`, `text`, **and `email`**. [`014-interaction-assists.ts:12`](/home/bwales/projects/orbit-app/src/db/migrations/014-interaction-assists.ts:12) The live assist writer passes that transport value directly into the interaction core. [`interaction-assist-dao.ts:98`](/home/bwales/projects/orbit-app/src/db/interaction-assist-dao.ts:98) Yet the plan only specifies `call → Call` and `text → Message`. [`32-01-PLAN.md:167`](/home/bwales/projects/orbit-app/.planning/phases/32-interaction-history-insights/32-01-PLAN.md:167) An email assist would create `interactions.channel='email'` after migration 025, violating the remapped vocabulary and leaving an unrenderable legacy value in the new form.

- **MEDIUM — historical migration behavior must not depend on a mutable helper.** The plan permits migration 025 to generate its SQL CASE from `interaction-vocabulary.ts`. [`32-01-PLAN.md:135`](/home/bwales/projects/orbit-app/.planning/phases/32-interaction-history-insights/32-01-PLAN.md:135) Since the runner invokes the migration implementation at upgrade time, not from a frozen SQL artifact, a later helper edit would silently alter a shipped migration’s behavior. [`runner.ts:47`](/home/bwales/projects/orbit-app/src/db/migrations/runner.ts:47)

**Suggestions**

- Add `email → Message` to `markAssistLogged`, with a regression test for all three allowed assist channels.
- Choose the plan’s safer option: keep migration 025’s CASE literals frozen in the migration and test-pin them against the shared helper. Restore can consume the helper directly.

**Risk assessment:** **HIGH** until the email path is covered; migration 025 is irreversible.

## Plan 02 — Lifecycle events and restore mapping

**Summary:** Sound dependency placement and transaction composition.

**Strengths**

- `bindContact` and `unbindContact` already own write transactions, making `recordEventCore` the correct composition primitive. [`contact-lifecycle-dao.ts:43`](/home/bwales/projects/orbit-app/src/db/contact-lifecycle-dao.ts:43) [`events-dao.ts:60`](/home/bwales/projects/orbit-app/src/db/events-dao.ts:60)
- Events are schema-flexible `TEXT`, so no event migration is needed. [`001-initial.ts:115`](/home/bwales/projects/orbit-app/src/db/migrations/001-initial.ts:115)
- Restore is a distinct raw interaction writer. [`restore-apply.ts:189`](/home/bwales/projects/orbit-app/src/backup/restore-apply.ts:189) Plan 02 correctly owns its legacy vocabulary remap rather than assuming migration 025 covers restored rows.

**Concerns**

- None beyond the Plan 01 email-map dependency.

**Suggestions**

- Include an email-assisted restored interaction in the restore regression once Plan 01’s mapping is corrected.

**Risk assessment:** **MEDIUM**; implementation is well-scoped but depends on Plan 01’s canonical mapping.

## Plan 03 — Aggregation and history read

**Summary:** The count-only/group-inert redesign is correct, but the proposed intensity wrapper still cannot correctly calculate historical windows.

**Strengths**

- The plan correctly avoids `computeContactIntensity`, whose period is cadence-based and operates over all loaded interactions. [`impact.ts:134`](/home/bwales/projects/orbit-app/src/services/impact.ts:134)
- It correctly preserves the nullable-cadence unavailable guard. [`impact.ts:138`](/home/bwales/projects/orbit-app/src/services/impact.ts:138)
- Group behavior remains inert without introducing `group_event_id`, consistent with D-12.

**Concerns**

- **HIGH — filtering to a historical window is insufficient if `computeIntensity` still receives real “now.”** `computeIntensity` calculates its active period as `now - periodDays` and excludes prior-window rows outside that interval. [`intensity-logic.ts:110`](/home/bwales/projects/orbit-app/src/services/intensity-logic.ts:110) [`intensity-logic.ts:135`](/home/bwales/projects/orbit-app/src/services/intensity-logic.ts:135) Plan 03 requires filtering and then calling that core, but does not require passing a window-end reference instant. [`32-03-PLAN.md:122`](/home/bwales/projects/orbit-app/.planning/phases/32-interaction-history-insights/32-03-PLAN.md:122) Thus navigating to, say, last March would likely show zero current intensity even if that selected month contains interactions.

- **MEDIUM — the knowledge-history source lacks a complete-contact read seam.** The existing history reader only returns one specified field key at a time. [`current-state-history-read.ts:61`](/home/bwales/projects/orbit-app/src/db/current-state-history-read.ts:61) Plan 03 promises the whole date-indexed knowledge-change family but only says to source it from that file. [`32-03-PLAN.md:150`](/home/bwales/projects/orbit-app/.planning/phases/32-interaction-history-insights/32-03-PLAN.md:150) A single-field fixture could pass while other registered current-state histories disappear.

**Suggestions**

- Define `effectiveNow = endOfSelectedWindow at 23:59:59` and pass it to `computeIntensity`; add a regression where a prior-month window has qualifying interactions and reports their non-zero count.
- Add `listCurrentStateHistoryForContact`, or explicitly iterate every registered current-state field. Test at least two distinct field keys and same-timestamp ordering.

**Risk assessment:** **HIGH** because incorrect historical Intensity directly violates HIST-06.

## Plan 04 — Canonical Edit Interaction

**Summary:** Well grounded in the existing recency spine and navigation topology.

**Strengths**

- The plan uses the only safe edit path, which scopes by both interaction and contact, recomputes recency, and rejects future timestamps. [`recency-dao.ts:258`](/home/bwales/projects/orbit-app/src/db/recency-dao.ts:258)
- The future-date copy is already exported and reusable. [`TouchpointRefineForm.tsx:56`](/home/bwales/projects/orbit-app/src/components/TouchpointRefineForm.tsx:56)
- It correctly identifies all three current Profile hosts: Dashboard, Orrery, and Settings. [`types.ts:51`](/home/bwales/projects/orbit-app/src/navigation/types.ts:51) [`types.ts:131`](/home/bwales/projects/orbit-app/src/navigation/types.ts:131) [`types.ts:172`](/home/bwales/projects/orbit-app/src/navigation/types.ts:172)

**Concerns**

- None found.

**Suggestions**

- Add a test that an edit of a historical interaction refreshes the HistorySection data revision/read path after returning.

**Risk assessment:** **LOW**.

## Plan 05 — Heatmap, Intensity UI, and preferences

**Summary:** Presentation boundaries and token discipline are good; preference persistence is not fully threaded through the type/wire contract.

**Strengths**

- The plan correctly uses a presentational, DB-free static heatmap; static RN cells avoid an unnecessary render loop.
- It distinguishes structural blanks from zero-count days, which is important because existing theme palettes only expose ordinary surface/status tokens today. [`theme-types.ts:168`](/home/bwales/projects/orbit-app/src/theme/theme-types.ts:168)

**Concerns**

- **HIGH — `PortableSettingsSnapshot` is omitted, so typed writes and restore portability are incomplete.** `AppSettingsPatch` is defined from `PortableSettingsSnapshot`. [`app-settings-dao.ts:226`](/home/bwales/projects/orbit-app/src/db/app-settings-dao.ts:226) [`app-settings-dao.ts:285`](/home/bwales/projects/orbit-app/src/db/app-settings-dao.ts:285) The plan lists `AppSettings`, row, SELECT, writable union, and `COLUMN_OF`, but not the optional snapshot fields. [`32-05-PLAN.md:82`](/home/bwales/projects/orbit-app/.planning/phases/32-interaction-history-insights/32-05-PLAN.md:82) Without optional `historyLens` and `historyCycleCount` there, `updateAppSettings(..., { historyLens })` cannot typecheck; the intended restore-accept path is also undocumented at its primary type seam.

**Suggestions**

- Add optional keys to `PortableSettingsSnapshot`, retain their intentional omission from `getPortableSettingsSnapshot`, and test:
  1. normal typed UI update;
  2. restore acceptance of incoming values;
  3. current-format export omission.

**Risk assessment:** **HIGH** until the durable preference contract is complete.

## Plan 06 — Rolodex browser

**Summary:** Strong animation, accessibility, and lifecycle ownership plan.

**Strengths**

- The plan follows the existing reduced-motion split: a shared value for worklets and state-backed value for the React tree. [`use-reduced-motion.ts:106`](/home/bwales/projects/orbit-app/src/theme/use-reduced-motion.ts:106)
- Conditional mounting is the established mechanism for halting active Skia animation on blur/background. [`OrreryCanvas.tsx:2`](/home/bwales/projects/orbit-app/src/components/orrery/OrreryCanvas.tsx:2)

**Concerns**

- None found.

**Suggestions**

- Make Pixel UAT explicitly test a non-gesture date adjustment from every wheel position, including today and a leap-day boundary.

**Risk assessment:** **MEDIUM** due to device-only gesture/worklet verification.

## Plan 07 — Detail sheet and deletion

**Summary:** Correctly uses the delete spine and keeps group behavior inert.

**Strengths**

- The hard-delete UI is correctly directed to the existing tombstone-plus-recompute path. [`recency-dao.ts:313`](/home/bwales/projects/orbit-app/src/db/recency-dao.ts:313)
- Bind/unbind labels are necessary because the current renderer only labels archive/restore/snooze/unsnooze. [`TimelineRow.tsx:25`](/home/bwales/projects/orbit-app/src/components/TimelineRow.tsx:25)
- The knowledge-change callback avoids hard-coding a new navigation target.

**Concerns**

- None intrinsic, but this plan inherits the Plan 03 full-knowledge-history gap and Plan 08 Settings navigation gap.

**Suggestions**

- Add a detail-sheet integration test with two knowledge fields once Plan 03 exposes the complete family.

**Risk assessment:** **MEDIUM** due to those downstream integration dependencies.

## Plan 08 — Profile integration

**Summary:** Correctly replaces the interim renderer seam and fixes LogContact reachability, but the knowledge-change callback remains broken from Settings-originated Profiles.

**Strengths**

- The current History renderer is a contained seam, so replacing it need not alter layout persistence. [`ProfileModuleHost.tsx:387`](/home/bwales/projects/orbit-app/src/components/profile/ProfileModuleHost.tsx:387)
- The plan correctly adds `LogContact` to Orrery and Settings, where it is currently absent. [`OrreryStack.tsx:44`](/home/bwales/projects/orbit-app/src/navigation/tabs/OrreryStack.tsx:44) [`SettingsStack.tsx:44`](/home/bwales/projects/orbit-app/src/navigation/tabs/SettingsStack.tsx:44)

**Concerns**

- **HIGH — Settings-originated knowledge-change editing will navigate to an unregistered route.** Plan 08 routes `onOpenKnowledgeChange` through the existing Profile callback. [`32-08-PLAN.md:108`](/home/bwales/projects/orbit-app/.planning/phases/32-interaction-history-insights/32-08-PLAN.md:108) That callback navigates to `ThingsToRemember`. [`ContactProfileScreen.tsx:403`](/home/bwales/projects/orbit-app/src/screens/ContactProfileScreen.tsx:403) SettingsStack registers neither `ThingsToRemember` nor `MemoryHistory`. [`SettingsStack.tsx:44`](/home/bwales/projects/orbit-app/src/navigation/tabs/SettingsStack.tsx:44) Dashboard and Orrery do register both. [`DashboardStack.tsx:46`](/home/bwales/projects/orbit-app/src/navigation/tabs/DashboardStack.tsx:46) [`OrreryStack.tsx:50`](/home/bwales/projects/orbit-app/src/navigation/tabs/OrreryStack.tsx:50)

**Suggestions**

- Add `ThingsToRemember` and `MemoryHistory` route types and registrations to SettingsStack, with a Settings-originated Profile UAT covering a knowledge-change row through to its owning edit flow.

**Risk assessment:** **HIGH** because HIST-10’s editable knowledge changes crash or fail to route from a supported Profile origin.
---

## Claude Review

_Read-only Claude subagent (per project convention — the in-harness `claude -p` reviewer self-skips). Full repo read access; source-grounded._

# Cross-AI Plan Review — Phase 32 (Interaction History & Insights), Convergence Cycle 2

**Overall risk verdict: MEDIUM — plans are well-grounded and cycle-1 HIGHs are genuinely resolved on disk; remaining issues are correctness-detail gaps, not architectural flaws. HIGH concerns: 0. (3 MEDIUM worth fixing before execution; several LOW.)**

I verified every load-bearing claim against the actual code, including grepping **every** writer/reader of `interactions` (`recency-dao`, `restore-apply`, `export-manifest`, `ai-context-read`, `digest-read`, `purge-dao`, `benchmark`, `interaction-assist-dao`, `queries.ts`, `timeline-read`, `merge-candidate-read`). The migration head, the single-writer spine, the closed app-settings model, the navigation gaps, and the intensity core are all as the plans describe.

## Cross-cutting verification (the facts the whole phase rests on)

- **Migration head is 24, next is 25.** `src/db/database.ts:62` `TARGET_VERSION = PROFILE_PRESENTATION_SCHEMA_VERSION`; the last numbered file is `023-…` and the head is the unnumbered `profile-presentation.ts`. Plan 01's `025-` filename + `version: 25` is correct.
- **Literal consumers of `quality` are exactly two:** `ai-context-read.ts:132/134/136` (`=== "good"/"fine"/"hard"`) and `digest-read.ts:158/161`. No other file compares those literals (full-tree grep). Plan 01's consumer list is complete for the *comparison* sites.
- **`queries.ts:39/52` (NEWEST_PER_CONTACT/FOR_CONTACT) and `timeline-read.ts:75` read `channel`/`quality` but never compare literals** — they pass values through, so the migration flows through automatically. Correctly excluded from the lockstep list. `Contact.lastInteraction`/`LastInteractionType` (`types.ts:40,82`) has **no populating code path** — Plan 01 Task 2's "unused legacy type" audit is accurate.
- **Single-writer spine confirmed:** `editTouchpointFull` (`recency-dao.ts:280`) rejects future dates pre-txn, scopes by `id AND contact_id`, asserts `changes===1`, recomputes; `deleteInteractionCore` (`:313-345`) writes the tombstone in-txn then recomputes.
- **`events.type` is `TEXT NOT NULL` with no CHECK** (`001-initial.ts:120`) — D-08's "no migration, TS-union-only" is correct; `bindContact`/`unbindContact` (`contact-lifecycle-dao.ts:27-110`) currently write **no** event.
- **`impact.ts` exposes a pure `computeIntensity(interactions, periodDays, rarelyResponds, now)` core** that `computeContactIntensity` delegates to (`impact.ts:134-147`); the nullable-cadence guard is real. Plan 03's window-scoping strategy is mechanically feasible.
- **Navigation gaps are real:** `Profile` is registered in Dashboard, Orrery **and** Settings; `Edit` (contact) is in Dashboard/Orrery but **not** Settings; `LogContact` is in **Dashboard only**. Plans 04 and 08 correctly target those exact gaps.
- **`app-settings-dao` is a genuinely closed model** with multiple seams (interface `:92`, `WritableSettingsKey` `:312`, `AppSettingsRow` `:353`, `COLUMN_OF` `:438`, and **two** SELECTs at `:496` and `:627`). Plan 05's "accessors alone are insufficient" framing is correct.

## Plan 01 — Migration 025 + vocabulary lockstep
**Summary.** The riskiest plan and the best-specified. Checkpoint, single-source vocabulary module, atomic consumer lockstep, D-12 prohibition all present. ALTER+UPDATE only (no rebuild) — verified `interactions` has no CHECK on `channel`/`quality`.

**Strengths.** `allow_ai INTEGER NOT NULL DEFAULT 0 CHECK(allow_ai IN (0,1))` is stronger than precedent `017-knowledge-egress-datamove.ts:35` (no CHECK); DEFAULT 0 makes `benchmark.ts:120`, `restore-apply.ts:189`, `insertInteractionCore` (`recency-dao.ts:194`) all land OFF (fail-closed). Keeping SQL column `quality` is load-bearing (`export-manifest.ts:52`, `restore-apply.ts:65,189`). Delete-DAO regression correctly homed in `recency-dao.test.ts`.

**Concerns.**
- **MEDIUM — `markAssistLogged` channel mapping omits `'email'`.** `interaction-assist-dao.ts:98-111` writes `channel: transactionAssist.channel` **raw**, and the `014` CHECK allows `'call' | 'text' | 'email'` (`014-interaction-assists.ts:12`). Plan 01's must-have/acceptance enumerate only `'call'→Call` and `'text'→Message` — never `'email'`. An email assist logs a legacy `'email'` value into a v25 DB after migration — a live writer re-introducing pre-migration vocabulary, exactly the partial-rename hazard the phase guards against. Fix: route through shared `remapLegacyChannel` (maps `email→Message`), add an assist-of-`email` test.

**Risk: MEDIUM.**

## Plan 02 — Bind/Unbind events + restore-side remap
**Summary.** Correctly additive at the TS layer (no migration), composes `recordEventCore` inside existing transactions, closes the D-06 restore backdoor using Plan 01's shared map.

**Strengths.** `recordEventCore` (`events-dao.ts:60`) is the non-mutexed in-txn primitive; placement before `bumpDataRevisionCore` inside `bindContact`'s existing `inWriteTransaction` (`contact-lifecycle-dao.ts:43`) avoids nested-transaction hang. Restore backdoor is real (`restore-apply.ts:189` inserts verbatim); single-owning restore-apply here avoids same-wave overlap. Verified no event-type allowlist/exhaustive switch exists — bind/unbind round-trip safely.

**Concerns.**
- **LOW — event `occurred_at` source unspecified.** `recordEventCore({… occurredAt …})` should set `occurredAt = now` (the bind moment); name it so the executor doesn't invent a field. Assert `occurred_at === now` in the test.

**Risk: LOW.**

## Plan 03 — Reusable aggregation seam
**Summary.** Strong architecture — pure window/bucket/cycle/intensity modules plus canonical `history-read`. Window-scoped intensity fix and inert group seam correctly framed against D-12.

**Strengths.** `computeIntensity` pure core exists (`impact.ts:134-147`); inert-seam framing correct (no `group_event_id` column, `isGroupLinked` hard-false, grep-gate enforces D-12); knowledge family sourced from `current-state-history-read.ts` (`getCurrentStateHistory` exists).

**Concerns.**
- **MEDIUM — window-derived intensity period is unspecified and value-untested.** Today `intensityPeriodDays(intervalDays)` returns the *cadence* interval (`impact.ts:139`) — it defines what "intensity" *means*. Plan 03 replaces it with "a period derived from the window span" but gives no formula, and the only test is "two windows yield different results" — which passes for almost any period function. Pin the period formula and add a **value** assertion, not just an inequality.
- **LOW — Unbound returns `{available:false}` for *all* lenses** (consistent with D-09 but confirm intended for 7 Days/Month/Year, not only Cycles).

**Risk: MEDIUM.**

## Plan 04 — Canonical Edit Interaction route
**Summary.** Correctly routes through the sole writer, adds the missing read, closes the Settings registration gap.

**Strengths.** Saves via `editTouchpointFull` (`recency-dao.ts:280`) which currently omits `duration`/`allow_ai` — so the Plan 01 dep is genuinely required + correctly ordered. `readInteractionForEdit` scoped by `id AND contact_id`; reuses `FUTURE_DATETIME_MESSAGE` (`TouchpointRefineForm.tsx:56`). Settings registration gap is real; registering in all three Profile-hosting stacks is correct.

**Concerns.**
- **LOW — shared edits to `navigation/types.ts` across waves.** Plan 04 (wave 2) and Plan 08 (wave 4) both edit it; sequential is safe, but the Plan 08 executor must *add* to param lists Plan 04 created, not regenerate.

**Risk: LOW.**

## Plan 05 — Heatmap / Intensity / tokens + persistence
**Summary.** Correctly identifies the closed app-settings seams; heatmap stays static (no Skia loop). One ambiguity around *which* SELECT to extend.

**Strengths.** Closed-model seam list accurate (interface `:92`, `WritableSettingsKey` `:312`, `AppSettingsRow` `:353`, `COLUMN_OF` `:438`). Static RN Views sidestep the worklet hazard; structural current-cycle marking (no second hue) enforces D-10; `check:colors` gate is real.

**Concerns.**
- **MEDIUM — "the SELECT column list" is ambiguous; there are two SELECTs.** `getAppSettings` (`:496`, the runtime read) vs a second `Pick`-typed snapshot/bookkeeping SELECT (`:627`). To read the pref back at runtime, Plan 05 must extend `getAppSettings` (`:496`) and must **not** add the keys to any emission/snapshot path reserved for Phase 36 (D-11/A4). Name `getAppSettings` explicitly; assert the portable-snapshot path is untouched (mirror Plan 01 Task 3's grep-gate).

**Risk: MEDIUM** (wrong-SELECT edit would cross the Phase-36 boundary).

## Plan 06 — Rolodex History Browser
**Summary.** The only genuinely animated surface; render-loop discipline handled correctly.

**Strengths.** Mirrors proven `OrreryCanvas.tsx` (Reanimated + GestureDetector, conditional-mount pause); moves math into node-tested `rolodex-logic.ts`; explicit `useIsFocused`+`AppState` ownership in `RolodexBrowser`; token-gated-or-dropped Skia glow; precise "gesture→shared values; committed selection→React state after settle" assertion.

**Concerns.**
- **LOW — performance is device-only and unmeasurable here** (three synchronized wheels + markers; correctly deferred to Pixel backstop; emulator can't validate per project MEMORY). No code defect.

**Risk: LOW.**

## Plan 07 — Detail Sheet + Interaction Detail + hard-delete + group seam
**Summary.** Inspect/edit/delete heart, owner-locked invariants at the UI edge.

**Strengths.** Delete consumes `deleteTouchpoint` (`recency-dao.ts:313-345`); UI re-implements no DELETE. Sparkle strictly gated on `allow_ai===1`; group note kept off the AI path (ADR-078). Group seam inert by construction, grep-gated; `TimelineRow.EVENT_LABELS` bind/unbind extension reads lifecycle rows correctly.

**Concerns.**
- **LOW — `TimelineRow`/`timeline-read` appear currently unmounted in production.** No importer of `TimelineRow` and no caller of `timeline-read`'s `LIST_TIMELINE` outside their own files/tests. Plan 07 re-mounts `TimelineRow` in `DateDetailSheet`, so the `EVENT_LABELS` edit becomes live there — but confirm `TimelineRow` is actually reused (not just labeled); else the bind/unbind label edit is dead code.

**Risk: LOW.**

## Plan 08 — Profile History integration
**Summary.** The user-facing payoff. Correctly upgrades only the renderer seam, distinguishes lifecycle-only from empty, owns the typed LogContact contract.

**Strengths.** `ProfileModuleHost.renderHistory` (`:387`) is the exact stub to replace; leaving the summary case + layout persistence untouched is right. `hasLifecycleRecords` drives the empty predicate. `LogContact` registration gap is real (Dashboard-only); adding to Orrery+Settings with typed `prefillDate` is the correct fix.

**Concerns.**
- **MEDIUM (scope-honesty, not a defect) — HIST-15 is only partially delivered.** `LogContact` target is `LogContactPlaceholderScreen`; Phase 32 ships the route/context *contract* only, Phase 34 owns the real form. Plan reframes this correctly, but Success Criterion #5 is not fully closed until Phase 34 — flag so the verifier doesn't over-credit HIST-15.
- **LOW — additive merge on `navigation/types.ts`** (as under Plan 04).

**Risk: LOW–MEDIUM.**

## Dependency ordering & scope (cross-plan)
- **Wave structure is clean and correctly gated.** No two same-wave plans modify the same file. `recency-dao.ts`/`interaction-vocabulary.ts` single-owned by Plan 01; `restore-apply.ts` single-owned by Plan 02. Only cross-wave shared file is `navigation/types.ts` (Plan 04 → Plan 08), safe sequentially.
- **Plan 01 Task 3 gate correctly enforced** (Plans 04/05/07 consume Task 3 outputs; scope-acceptance gates wave-2 promotion on full Plan-01 set).
- **No D-12 / D-07 reversal anywhere.** Group behavior is an inert predicate over an absent `group_event_id`, grep-gated. Migration 025 adds only `duration`, `allow_ai`, `history_lens`, `history_cycle_count` + value remap. No `BACKUP_FORMAT_VERSION` bump. Column stays `quality`. **All three project constraints respected — no forbidden-reversal defects found.**
- **Local-first preserved:** every new read is a `ReadOnlyExecutor`, no transaction, no network.

## Do the plans achieve the phase goal?
Yes, with one honest caveat: HIST-15 is delivered as a route contract only (real form is Phase 34). The one substantive correctness risk to fix before execution is the **Plan 01 `email`-assist channel mapping gap** (MEDIUM), plus the two ambiguity fixes (Plan 03 intensity period, Plan 05 which-SELECT).
