---
phase: 21
reviewers: [codex, cursor, claude]
reviewed_at: 2026-08-31T19:20:05Z
cycle: 2
plans_reviewed: [21-01-PLAN.md, 21-02-PLAN.md, 21-03-PLAN.md, 21-04-PLAN.md, 21-05-PLAN.md, 21-06-PLAN.md]
models:
  codex: "gpt-5.6-terra (reasoning=low)"
  cursor: "unknown"
  claude: "sonnet (reasoning=low)"
model_sources:
  codex: "banner"
  cursor: "unknown"
  claude: "pinned"
---

# Cross-AI Plan Review — Phase 21 (Cycle 2)

Convergence cycle 2. Plans were revised in commit `cd55776` to address cycle-1
feedback (3 HIGH + 9 actionable). All three lanes (codex, cursor, claude) ran
source-grounded against the repo on disk and produced genuine reviews (none
stubbed). The orchestrator independently re-verified every load-bearing claim
below against the actual source (see Verification Coverage).

## Consensus Summary

All three reviewers agree the **cycle-1 HIGH findings are genuinely resolved in
the current plan text**, not merely re-asserted:

- **HIGH-1 (nested-mutex hang):** `markAssistLogged` (21-01-PLAN.md:96) composes
  `insertInteractionCore` + `recomputeLastContactCore` + `bumpDataRevisionCore`
  inside ONE `inWriteTransaction` and never calls the mutexed `recordTouchpoint`
  — matching the documented compose-don't-nest idiom (transaction.ts) and the
  `createContactFull` precedent. Verified on disk.
- **HIGH-2 (Compose/Router handoff divergence, draft loss):** a single shared
  `performReachOut(exec, {…, messageBody?})` helper (21-02-PLAN.md:100) is called
  by both the router (empty body) and Compose (its draft, 21-03), with
  create-before-launch + `markAssistFailed`-on-throw centralized. 21-03 grep-gates
  that Compose does not call `createPendingAssist`/`SMS.sendSMSAsync` directly.
- **HIGH-3 (idempotency):** status-guarded read-then-write inside one transaction
  (`WHERE status='pending'`), explicitly NOT UNIQUE-error sniffing.

Reviewers also agree the migration numbering is correct (`TARGET_VERSION = 13` on
disk → 014 is the next slot), the merge-reparent gap is real and correctly
targeted (`interaction_assists` genuinely absent from merge-dao.ts:153), the purge
FK-cascade path is right, the widget allow-list extension follows the anchored
regex pattern, and no plan introduces network egress, passive observation, or a
widget-side assist writer (local-first preserved). No plan reverses a locked
dossier cluster (Z/AA/AB/AC/F).

### Agreed Strengths
- Cores-only composition preserves DATA-04 single-writer invariant —
  `recomputeLastContactCore` remains the sole `contacts.last_contact` writer
  (verified: every other interaction path, incl. widget-mark and notification
  marks, routes through `recordTouchpoint`→`recomputeLastContact`).
- Tracer-first wave ordering; node-verifiable data spine before device-only UI.
- Merge/purge/widget cross-phase wiring (21-05) correctly identified as the
  highest residual correctness risk and scoped with node tests.
- Eligibility (15s buffer / 24h expiry) is timer-free, computed off stored
  `handoff_at`, consistent between the SQL filter and the client re-check.

### Agreed Concerns
- **Missing `rejectFutureOccurredAt` parity on the confirmation path** (codex: HIGH;
  cursor: MEDIUM; claude: not raised). `recordTouchpoint` rejects a future
  `occurredAt` before opening its transaction (recency-dao.ts:228), and so does
  every other interaction writer — but the exported cores do NOT, and
  `markAssistLogged` (21-01-PLAN.md:96) composes the cores directly with
  `occurredAt = assist.handoff_at` and never invokes the guard. Verified on disk:
  the guard lives only in the wrappers (recency-dao.ts:228, :268), not in
  `insertInteractionCore`/`recomputeLastContactCore` (recency-dao.ts:426-427).
- **Stale "recordTouchpoint" prose in 21-01** (codex: LOW; cursor: MEDIUM). The
  Objective (:59), `<done>` (:117), threat T-21-02 (:165), and success summary
  (:177) still say the confirmation "logs/routes through `recordTouchpoint`",
  directly contradicting the must_haves (:33-34, :96) that forbid calling it. An
  executor following the wrong paragraph could reintroduce the HIGH-1 nesting hang.
- **Wave-3 shared-file coordination** (cursor: MEDIUM; claude: related double-expiry
  note). 21-02 and 21-04 both edit `App.tsx`, `assist-store.ts`, and
  `AssistBanner.tsx`; 21-04 extends artifacts 21-02 creates. No plan states an
  explicit "21-04 after 21-02" ordering.

### Divergent Views
- **Severity of the future-date guard gap:** Codex rates it HIGH (a concrete
  data-integrity gap in a shared interaction writer — a future-dated row would push
  `last_contact` into the future, violating LOG-06). Cursor rates it MEDIUM (a
  latent path, since `handoff_at ≤ now` normally holds at confirmation). Claude did
  not raise it. Orchestrator assessment: the trigger requires abnormal conditions
  (backward clock skew or corrupt `handoff_at`), but the guard is a documented
  invariant (LOG-06) enforced by EVERY sibling writer, on the phase's central
  tracer path, and is absent from both plan text and the test list — so it is
  carried as the one unresolved HIGH, following the most source-grounded lane.
- **Plan 02 interim multi-endpoint routing:** Codex flags that until 21-03 lands,
  21-02 hands off a multi-endpoint channel via the primary endpoint directly,
  contradicting dossier:80-82 ("if multiple endpoints exist: show a second
  method-selection menu"). Cursor reads the same as acceptable within-phase wave
  sequencing (21-02 builds the router, 21-03 adds the ≥2-endpoint selector). The
  plans explicitly scope this deferral (21-02-PLAN.md:28, :136), and the phase
  never ships between waves (21-06 gates the whole phase), so it is recorded as a
  documented intra-phase deferral, not an unresolved actionable.
- **Plan 06 autonomous vs owner sign-off:** Codex flags `autonomous: true` (:9) as
  contradicting the owner sign-off / blocked checkpoints. The plan reconciles this
  via `workflow.human_verify_mode=end-of-phase` — the sign-off is harvested as an
  end-of-phase human-check, and device-dependent failure rows are recorded as
  explicit BLOCKED checkpoints, never force-passed (:113-116, :124). Treated as
  already-addressed.

---

## Codex Review

## Summary

The revised six-plan sequence is substantially stronger and is grounded in the existing architecture. It correctly adopts the non-reentrant transaction composition required by the codebase, preserves the local-only model, and covers the crucial merge/purge/widget seams. I found one correctness gap that should be fixed before execution, plus two planning-quality risks.

## Strengths

- **Cycle-1 transaction/idempotency high findings are genuinely addressed.** Plan 01 specifies one outer `inWriteTransaction`, composes `insertInteractionCore`, `recomputeLastContactCore`, and `bumpDataRevisionCore`, and status-guards the assist before writing ([21-01-PLAN.md](/home/bwales/projects/orbit-app/.planning/phases/21-interaction-assist-reach-out/21-01-PLAN.md:96)). This matches the repository’s explicit non-reentrancy rule ([transaction.ts](/home/bwales/projects/orbit-app/src/db/transaction.ts:15)) and the exported core pattern ([recency-dao.ts](/home/bwales/projects/orbit-app/src/db/recency-dao.ts:417)).

- **The single-writer invariant is preserved by the intended composition.** `recomputeLastContactCore` is the only production statement updating `contacts.last_contact` ([recency-dao.ts](/home/bwales/projects/orbit-app/src/db/recency-dao.ts:145)), while `recordTouchpoint` itself composes insert → recompute → revision bump in one transaction ([recency-dao.ts](/home/bwales/projects/orbit-app/src/db/recency-dao.ts:217)). The proposed assist path mirrors that sequence rather than introducing a direct contact update.

- **Migration planning is correct for the current repository state.** The checked-in database head is migration 013 and `TARGET_VERSION = 13` ([database.ts](/home/bwales/projects/orbit-app/src/db/database.ts:37), [database.ts](/home/bwales/projects/orbit-app/src/db/database.ts:48)); Plan 01 correctly makes the next migration 014.

- **The merge and purge mechanism is correctly derived from existing code.** `mergeContacts` currently reparents child tables before deleting the absorbed contact ([merge-dao.ts](/home/bwales/projects/orbit-app/src/db/merge-dao.ts:153), [merge-dao.ts](/home/bwales/projects/orbit-app/src/db/merge-dao.ts:184)); adding `interaction_assists` there is necessary. Purge deletes the contact after its explicit child fan-out ([purge-dao.ts](/home/bwales/projects/orbit-app/src/db/purge-dao.ts:244), [purge-dao.ts](/home/bwales/projects/orbit-app/src/db/purge-dao.ts:261)), so the planned FK cascade is appropriate.

- **The widget security approach extends an existing strict boundary.** The current resolver uses anchored digit-only URI patterns and safe-integer validation ([widget-linking.ts](/home/bwales/projects/orbit-app/src/navigation/widget-linking.ts:91), [widget-linking.ts](/home/bwales/projects/orbit-app/src/navigation/widget-linking.ts:100)). Plan 05’s `reach` form follows this rather than adding ad-hoc parsing.

- **The shared handoff repair is sound.** Plan 02/03 centralize pending-write ordering, native-launch failure handling, and SMS draft propagation in `performReachOut`, avoiding two divergent Compose/router implementations. That directly resolves the earlier draft-loss/duplicated-failure-path risk.

- **The settings backup coverage is correctly scoped.** The existing portable snapshot explicitly selects/maps settings ([app-settings-dao.ts](/home/bwales/projects/orbit-app/src/db/app-settings-dao.ts:379)), and the restore allow-list is explicit ([backup-schema.ts](/home/bwales/projects/orbit-app/src/backup/backup-schema.ts:106)). Plan 04 correctly updates both.

## Concerns

- **HIGH — Plan 01 bypasses the existing future-interaction guard.** `recordTouchpoint` rejects a future `occurredAt` before opening its transaction ([recency-dao.ts](/home/bwales/projects/orbit-app/src/db/recency-dao.ts:217)), but the proposed `markAssistLogged` calls `insertInteractionCore` directly with `handoff_at` ([21-01-PLAN.md](/home/bwales/projects/orbit-app/.planning/phases/21-interaction-assist-reach-out/21-01-PLAN.md:96)). If the device clock moves backward after handoff, or corrupted/manual data yields a future `handoff_at`, confirmation can insert a future interaction and violate LOG-06.  
  **Fix:** export/reuse `rejectFutureOccurredAt` from `src/db/log-guards.ts` immediately before the outer transaction (or add a core-safe equivalent), with a test for `handoff_at > now` proving no interaction/status transition occurs.

- **MEDIUM — Plan 02 temporarily violates the locked multi-endpoint routing behavior.** The dossier says multiple endpoints must show method selection ([21-interaction-assist-reach-out.md](/home/bwales/projects/orbit-app/docs/dossier/21-interaction-assist-reach-out.md:80)). But Plan 02 says it will use the primary endpoint directly until Plan 03. That creates an interim user-visible route that silently chooses an endpoint.  
  **Fix:** have Plan 02 hide/disable channels with more than one actionable endpoint until Plan 03, or move the minimal selector into Plan 02. Do not silently hand off via the primary when user selection is required.

- **MEDIUM — Plan 06 is marked autonomous while requiring non-automatable acceptance.** It requires owner sign-off and potentially unavailable “no compatible app” failure cases ([21-06-PLAN.md](/home/bwales/projects/orbit-app/.planning/phases/21-interaction-assist-reach-out/21-06-PLAN.md:113)), while its acceptance criteria require every matrix row to pass or be owner-accepted ([21-06-PLAN.md](/home/bwales/projects/orbit-app/.planning/phases/21-interaction-assist-reach-out/21-06-PLAN.md:119)).  
  **Fix:** mark Plan 06 non-autonomous / checkpointed, and distinguish “automated evidence complete” from “owner approval pending.” This avoids reporting the phase complete while a required human gate remains blocked.

- **LOW — A few Plan 01 labels remain inaccurate after the correct core-composition change.** Its completion/threat text still says the DAO “logs through `recordTouchpoint`” ([21-01-PLAN.md](/home/bwales/projects/orbit-app/.planning/phases/21-interaction-assist-reach-out/21-01-PLAN.md:117), [21-01-PLAN.md](/home/bwales/projects/orbit-app/.planning/phases/21-interaction-assist-reach-out/21-01-PLAN.md:165)), while the actual intended design correctly must *not* call the mutexed wrapper.  
  **Fix:** replace this with “through the authoritative recency cores” to prevent an executor from reintroducing the nested-transaction deadlock.

## Suggestions

1. Add the future-time validation and its node test to Plan 01.
2. Remove the temporary “primary endpoint direct handoff” behavior from Plan 02.
3. Convert Plan 06 into an explicit end-of-phase human checkpoint.
4. Update stale `recordTouchpoint` wording to say “authoritative recency-core composition.”

## Risk Assessment

**MEDIUM.** The revised plans resolve the previous high-risk transaction nesting, duplicate-write, and shared-handoff issues, and their merge/purge/widget integration is well aligned with the real source. The remaining future-timestamp bypass is a concrete data-integrity gap in a shared interaction writer path; fixing it should reduce the implementation risk to low.

---

## Cursor Review

# Phase 21: Interaction Assist & Reach Out — Cross-AI Plan Review (Cycle 2)

**Repository:** `/home/bwales/projects/orbit-app`  
**Plans reviewed:** `21-01` through `21-06` (commit context: cycle-2 revision after cd55776)  
**Head schema on disk:** `TARGET_VERSION = 13` (`src/db/database.ts:48`); migration 014 not yet present (expected).

---

## Executive Summary

The cycle-2 plans are substantially improved and grounded in real code. The tracer-first wave ordering is sound, the dossier clusters are referenced concretely, and all three cycle-1 HIGH findings are addressed in plan text with mechanisms that match existing composition patterns in `recency-dao.ts`, `contacts-dao.ts`, and `transaction.ts`. Cross-phase wiring (merge reparent, purge cascade, widget allow-list) is correctly identified as the highest residual correctness risk and is scoped to plan 21-05 with node tests.

Remaining issues are mostly execution-coordination (Wave 3 parallel edits to shared files), a few internal wording contradictions in 21-01, and one parity gap (`rejectFutureOccurredAt`) on the confirmation path. No plan contradicts a locked dossier cluster in a way that would reverse a `[DECIDED]` decision. Overall the phase is ready to execute with the caveats below.

---

## Cycle-1 HIGH Findings — Resolution Status

| ID | Issue | Cycle-2 status | Code-grounding |
|----|-------|----------------|----------------|
| **HIGH-1** | Nested `inWriteTransaction` / mutex hang if confirmation calls `recordTouchpoint` | **Resolved in plan text** | `transaction.ts:11-29` documents non-reentrancy; `recency-dao.ts:425-428` exports `insertInteractionCore` + `recomputeLastContactCore`; `createContactFull` in `contacts-dao.ts:189-195` is the established compose-inside-one-txn precedent. 21-01 correctly specifies ONE outer txn composing cores + `bumpDataRevisionCore` (`data-revision-dao.ts:5`), NOT the mutexed `recordTouchpoint` (`recency-dao.ts:217-242`). |
| **HIGH-2** | Divergent Compose vs Reach Out handoffs (draft loss / duplicated failure logic) | **Resolved in plan text** | Current `ComposeScreen.onSend` (`ComposeScreen.tsx:436-458`) calls `SMS.sendSMSAsync` directly with the draft and writes nothing. 21-02 introduces `performReachOut(..., messageBody?)`; 21-03 routes Compose through it with `messageBody: draft`. Single failure/Alert path is coherent. |
| **HIGH-3** | Idempotency via driver-specific UNIQUE sniffing or non-atomic confirm | **Resolved in plan text** | 21-01 specifies status-guarded read-then-write + `WHERE status='pending'` flip inside ONE txn. Matches SQLite semantics; crash mid-txn rolls back to `'pending'` for safe retry. |

---

## Plan 21-01 — TRACER: Migration 014 + Assist DAO + Eligibility

### Summary

The tracer plan correctly front-loads the phase's architectural hazard: confirmation must reuse the authoritative recency cores without nesting the mutex. Migration 014 shape follows `013-reconciliation-and-merge.ts:4-6` and settings-column idiom from `005-digest-settings.ts`. Pure eligibility in `assist-eligibility.ts` with shared constants is the right split from SQL reads.

### Strengths

- **Single-writer composition is code-aligned:** Plan mirrors `contacts-dao.ts:189-195` (insert + recompute inside one txn) and explicitly imports exported cores from `recency-dao.ts:425-428`.
- **Mutex hazard is named and avoided:** References `transaction.ts:11-29` non-reentrancy rule; forbids calling mutexed `recordTouchpoint`.
- **Schema claims verified:** `interactions.channel` / `.direction` / `.source` are free TEXT with no CHECK (`001-initial.ts:97-110`); `source='assist'` is safe.
- **Cap-5 + tiebreak:** `(created_at DESC, id DESC)` ordering matches dossier Cluster M/O needs.
- **Eligibility field unified:** Both 15s and 24h bounds against `handoff_at` (not `created_at`) — consistent with 21-04 sweep and fixes cycle-1 Codex LOW.
- **Hermes / timestamp landmines addressed:** `newUid()` (`uid.ts:18`), `localDateTime()` (`database.ts:74`), no `setTimeout`.

### Concerns

- **MEDIUM — Stale “recordTouchpoint” wording contradicts must_haves:** Objective (`21-01-PLAN.md:59`), `<done>` (`:117`), `success_criteria` (`:177`), and threat T-21-02 (`:165`) still say confirmation goes “through recordTouchpoint” while must_haves explicitly forbid calling it. Executor following the wrong paragraph could reintroduce HIGH-1.
- **MEDIUM — Missing `rejectFutureOccurredAt` parity:** `recordTouchpoint` rejects future `occurredAt` before opening a txn (`recency-dao.ts:227-228`, `log-guards.ts:68`). `markAssistLogged` plan does not mention this guard. Normally `handoff_at ≤ now` at confirmation, but omitting the guard breaks parity with every other interaction writer and leaves a latent path for a future-dated row if clock skew or bad data appears.
- **LOW — Threat model drift:** T-21-02 mitigation text says “routes ONLY through recordTouchpoint” while the actual design routes through cores — undermines review/traceability.

### Suggestions

- Global find-replace in 21-01: “through recordTouchpoint” → “through `insertInteractionCore` + `recomputeLastContactCore` + `bumpDataRevisionCore` (same operations as `recordTouchpoint`, without the mutex wrapper).”
- Add to `markAssistLogged` behavior: call `rejectFutureOccurredAt(assist.handoff_at, now)` before txn (or at txn start), matching `recency-dao.ts:227-228`.
- Add an acceptance grep/test: confirmed interaction with `handoff_at` after `now` is rejected.

### Risk Assessment

**MEDIUM** — Data-layer design is correct and precedented; risk is executor confusion from contradictory plan prose and the missing future-date guard.

---

## Plan 21-02 — Reach Out Router + Handoff + Banner + Profile Entry

### Summary

Delivers the first user-visible vertical slice: shared router, write-before-handoff ordering, non-modal app-global banner, and AppState-driven re-query. Correctly reuses `ComposeScreen.tsx:436-458` SMS idiom and `launch-sweep.ts:108-114` transition model (separate subscription for banner vs sweep dedupe).

### Strengths

- **Cluster E ordering:** `createPendingAssist` before native launch; failure is a separate `markAssistFailed` — matches dossier write-before-handoff.
- **Cluster F/J semantics:** Only thrown launch errors mark `'failed'`; resolved `sendSMSAsync` `'unknown'` is not treated as sent/failed — matches current Compose comment (`ComposeScreen.tsx:447-448`).
- **Cluster H:** Banner as absolute overlay, not `Modal` — aligns with dossier line 217 Back-pass-through exception.
- **HIGH-2 centralization:** `performReachOut(exec, {..., messageBody?})` with default `''` — router and Compose share one path.
- **Widget freshness:** `notifyWidgetDataChanged()` after confirm mirrors `ContactProfileScreen.tsx:336` and `notification-actions.ts:161`.
- **No false sync claims:** Correctly reframes “no spinner” as defined empty initial state, not synchronous SQLite.
- **Profile entry gated:** `deriveReachRoutes` + `listActionablePrimaryMethods` (`contact-methods-read.ts:30-39`) enforce Cluster A (hide when no actionable methods).

### Concerns

- **MEDIUM — Compose error copy regression (intentional but UX-visible):** Plan replaces Compose's fallback body “Your message is ready to copy instead.” with UI-SPEC Text copy (no copy mention in Alert). 21-03 `<decisions>` documents this; acceptable if owner-approved, but it weakens the guaranteed handoff story on Send failure (CMP requirement spirit).
- **LOW — Temporary settings read:** Defensive raw read of `interaction_assist_enabled` until 21-04 — documented, but 21-02/21-03/21-04 may ship with three slightly different read paths briefly.
- **LOW — `tel:`/`mailto:` greenfield:** No existing `tel:` usage in repo; plan correctly avoids `canOpenURL` false negatives. Special-character phone encoding not specified (first Call handoff in app).

### Suggestions

- In `performReachOut`, document which `ContactMethodRow` field is passed to `tel:`/`sms:`/`mailto:` (`canonical_value` vs `display_value`) — match whatever `ComposeScreen` uses for `actionablePhone`.
- Consider preserving Compose's copy-fallback sentence in the Text failure Alert when `messageBody` is non-empty (product call, not blocking).

### Risk Assessment

**LOW–MEDIUM** — Strong orchestration plan; native handoff timing remains device-only (correctly deferred to 21-06).

---

## Plan 21-03 — Endpoint Selector + Compose Send Seam

### Summary

Completes the ≤3-tap contract (Cluster B) and wires Compose into assist creation (Cluster AC) without writing interactions at Send time. Explicit `<decisions>` block resolves M2 Phase 12 ownership vs Phase 21 scope cleanly.

### Strengths

- **Cluster AC honored:** Compose Send creates pending assist then launches; interaction only on banner confirm — matches dossier lines 573-591 and current `ComposeScreen.tsx:435` “Writes NOTHING to the DB.”
- **HIGH-2 closed:** Task 2 grep gates enforce `performReachOut` delegation and forbid direct `createPendingAssist` / `SMS.sendSMSAsync` in Compose.
- **Cluster D:** Endpoint is operational handoff context only; interaction stores coarse channel.
- **Wave-3 independence:** Raw column read for `assistEnabled` allows parallel execution with 21-04 — reasonable tradeoff with documented follow-up.

### Concerns

- **LOW — No automated test for Compose seam:** Acceptance is grep/tsc-only; handoff behavior is covered in `handoff.test.ts` but Compose wiring isn't node-tested.
- **LOW — ReachOutRouter grows in two plans:** 21-02 creates modal; 21-03 adds multi-endpoint branch — fine sequentially, but executor must not ship 21-03 before 21-02's router exists.

### Suggestions

- Add a minimal Compose unit test mocking `performReachOut` to assert `messageBody: draft` and `assistEnabled` threading.
- After 21-04 lands, add a cleanup task (even a comment in 21-04 SUMMARY) to swap raw reads to `getAppSettings().interactionAssistEnabled`.

### Risk Assessment

**LOW** — Focused scope, clear dossier alignment.

---

## Plan 21-04 — Settings Toggle + Review Sheet + Launch Sweep

### Summary

Closes durable-queue lifecycle: default-on toggle with off-clears-queue (Cluster G), `{N} more pending` review surface (Cluster P), and foreground-only sweep (Cluster N/Q). Backup portability for the new setting follows the proven `digestEnabled` pattern.

### Strengths

- **Settings wiring precedent is real:** `digestEnabled` appears in `TOGGLE_FIELDS`, `COLUMN_OF`, and `PORTABLE_SETTINGS_KEYS` (`app-settings-dao.ts:256-276`, `backup-schema.ts:106-113`); plan mirrors at every site — gap is real and plan closes it.
- **Cluster G “off means off”:** One txn: settings update + expire all pending — test-enforced.
- **Sweep architecture matches platform constraints:** `registerSweepHook` (`launch-sweep.ts:45-47`), no module-scope side effects (`:10-16`), `handoff_at`-based 24h expiry shares `EXPIRE_AFTER_HOURS` with eligibility.
- **AppState coexistence test:** Joint fake for sweep dedupe vs banner every-return refresh addresses a real double-subscription hazard.
- **Widget freshness on review sheet:** Consistent with 21-02 banner handler.

### Concerns

- **MEDIUM — Wave 3 file overlap with 21-02:** Both modify `App.tsx`, `assist-store.ts`, and `AssistBanner.tsx`. Parallel wave execution can cause merge conflicts or lost hunks if not serialized (21-04 extends artifacts 21-02 creates).
- **LOW — `interaction_assists` excluded from backup:** No assist rows in backup corpus (grep confirms no assist references in `src/backup/`). Operational/ephemeral by design (Cluster X), but restore to another device won't carry pending queue — acceptable if intentional; worth one line in KB.

### Suggestions

- Add explicit wave note: **21-04 should run after 21-02 completes** (not strictly parallel on shared files), or merge 21-04 Task 2 into 21-02 follow-up commit.
- Sweep test: assert expired pending writes zero `interactions` rows (Cluster N).

### Risk Assessment

**MEDIUM** (execution coordination) / **LOW** (design) — Lifecycle semantics are well specified.

---

## Plan 21-05 — Merge / Purge / Widget Cross-Phase Wiring

### Summary

The phase's correctness core. Correctly identifies that `mergeContacts` reparent loop (`merge-dao.ts:153`) currently omits `interaction_assists`, which would CASCADE-delete pending assists on absorbed contact deletion — defeating Cluster AA. Widget Message→Contact swap matches shipped code (`widget-render.tsx:452-459` → `orbit://compose/`). Allow-list extension follows anchored regex pattern (`widget-linking.ts:91-92`).

### Strengths

- **Merge reparent gap verified on disk:** Line 153 array is `["interactions", "events", "fuel", ...]` — no `interaction_assists`; plan's one-string fix is necessary and sufficient given `reparent()` sets `contact_id + modified_at` (`merge-dao.ts:88-90`).
- **Purge cascade verified:** `purgeContact` deletes contact row (`purge-dao.ts:261-263`); FK ON DELETE CASCADE on `interaction_assists.contact_id` (migration 014 plan) removes assists without PURGE_CHILDREN fan-out — matches dossier Cluster AB (`21-interaction-assist-reach-out.md:561-563`).
- **Widget writer-free path verified:** `widget-task-handler.tsx:78-83` — OPEN_URI writes nothing; only WIDGET_MARK writes.
- **Security boundary preserved:** New `REACH_URI = ^orbit://reach/([0-9]+)$` mirrors `CONTACT_URI`/`COMPOSE_URI`; `parseWidgetId` safe-integer guard (`widget-linking.ts:100-105`).
- **Discriminated guard enables AB navigation half:** Current `guardWidgetIntent` collapses missing and archived to `null` (`widget-quick-action-guard.ts:33-35`); refactor to `{ ok, reason }` is required for purged vs archived UX split — plan documents owner-flippable archived-initiation policy explicitly.
- **Cluster Z preserved on banner path:** Archived contacts still confirmable via banner; widget reach-initiation silently dropped — consistent with CRUD-05 + plan `<decisions>`.

### Concerns

- **MEDIUM — Guard refactor blast radius:** `guardWidgetIntent` has one production caller (`widget-linking.ts:222`) plus tests, but return-type change is breaking; plan says “update EVERY caller” — adequate if tests are extended per acceptance criteria.
- **LOW — `openReachOut` param on Profile:** Requires consume-once via `setParams` to avoid reopen loops — plan mentions this; worth explicit test or UAT row (21-06 covers it).
- **LOW — Archived widget policy is planner-owned:** Recorded in `<decisions>` but is a product call (reviewer alternative: allow archived reach-initiation). Not a dossier violation.

### Suggestions

- Merge test should assert `markAssistLogged` after merge writes interaction against **survivor** `contact_id`, not absorbed id.
- Widget-linking test matrix in plan is thorough; add case: archived contact + `orbit://reach/<id>` → silent drop, no Alert (distinct from missing).

### Risk Assessment

**MEDIUM** — Highest correctness impact if skipped or mis-implemented; plan mitigations (node tests + allow-list) are appropriate.

---

## Plan 21-06 — Full-Suite Gate + Pixel UAT

### Summary

Appropriate end-of-phase gate for device-only surfaces (native intents, AppState banner timing, RemoteViews, irreversible migration 014 on hardware). DB verification via `run-as` matches project “review the code, not the diff” discipline.

### Strengths

- **Node gate before device work:** `npm test`, `tsc`, `check:colors` — catches DAO/guard regressions cheaply.
- **Time-travel strategy for 15s/24h:** DEBUG constants or run-as `handoff_at` backdate — avoids flaky waits; documented per row.
- **Explicit BLOCKED checkpoints:** Handoff-failure rows and owner sign-off not auto-passed — honest for device-dependent cases.
- **Matrix covers cycle-2 findings:** Widget freshness (#1), archived vs purged deep-link (#4), Compose draft via shared handoff, Back-through-banner, process death, cap-5, merge/purge/archived (Clusters Z/AA/AB).
- **DB invariants spelled out:** `occurred_at === handoff_at`, `source='assist'`, `direction='outbound'`, connected per action.

### Concerns

- **LOW — adb tap false-negatives:** Plan references project MEMORY and uiautomator — good, but small banner buttons remain UAT fragility.
- **LOW — Depends on all Wave 3 plans:** Missing transitive note that 21-01/21-02 must be complete (implicit via 21-03/04/05 dependencies).

### Suggestions

- Add UAT row: toggle Assist OFF while banner visible → queue cleared, banner hides immediately (Cluster G live check).
- Record which `canonical_value` was handed off in run-as evidence for one Text case (operational debug, not history).

### Risk Assessment

**LOW** (plan quality) — **HIGH** (phase gate importance) — migration 014 is irreversible on device; owner sign-off is the right final control.

---

## Cross-Cutting Observations

### Dependency / Wave Ordering

```
Wave 1: 21-01 (tracer) ✓
Wave 2: 21-02 (depends 21-01) ✓
Wave 3: 21-03, 21-04, 21-05 (all depend 21-02, not each other)
Wave 4: 21-06 (depends 21-03, 21-04, 21-05)
```

Tracer-first ordering is correct. **Recommend serializing 21-04 after 21-02** (or merging shared-file work) to avoid `App.tsx` / `AssistBanner.tsx` / `assist-store.ts` conflicts.

### Dossier / Invariant Compliance

| Invariant | Plans |
|-----------|-------|
| DATA-04 single `last_contact` writer | 21-01 cores-only path ✓ |
| Local-first / no passive monitoring (Cluster AJ) | No network, no call-log reads ✓ |
| Write before handoff (Cluster E) | 21-02 `performReachOut` ✓ |
| Merge reparent not cascade (Cluster AA) | 21-05 ✓ |
| Widget emits URI only (Cluster AF/AG) | 21-05 + `widget-task-handler.tsx:78-83` ✓ |
| Compose no interaction at Send (Cluster AC) | 21-03 ✓ |

### Local-First / Security

No plan introduces network egress, Android observation permissions, or widget-side assist writers. `orbit://reach/<id>` treated as untrusted with anchored allow-list — consistent with `widget-linking.ts:9-19` threat model.

---

## Overall Phase Risk Assessment

**MEDIUM**

**Justification:** Cycle-1 architectural HIGHs are genuinely resolved in plan text and align with on-disk patterns (`recency-dao.ts`, `transaction.ts`, `contacts-dao.ts`, `merge-dao.ts`). The remaining risks are: (1) executor confusion from 21-01’s stale “recordTouchpoint” prose reintroducing mutex nesting; (2) missing `rejectFutureOccurredAt` on the assist confirmation path; (3) Wave 3 parallel edits to shared shell files; (4) device-only verification of native handoff/banner/widget (properly gated by 21-06). None of these are dossier reversals; all are addressable without replanning the phase structure.

**Recommendation:** Proceed with execution after a quick 21-01 wording cleanup and adding the future-date guard to `markAssistLogged`. Serialize 21-04’s shell/UI extensions after 21-02 lands. Treat 21-05 merge reparent as non-optional — it is the silent data-loss path if omitted.

---

## Claude Review

# Cross-AI Plan Review — Phase 21 (Cycle 2)

## Overall Summary

This is a mature, unusually well-grounded plan set. Every load-bearing claim I spot-checked against the repo held up exactly as stated: `TARGET_VERSION = 13` (database.ts:48), the merge reparent array literal (merge-dao.ts:153), the non-mutexed core exports `insertInteractionCore`/`recomputeLastContactCore` (recency-dao.ts:426-427), the non-reentrant-mutex hazard documented in transaction.ts, the current `guardWidgetIntent` collapsing "missing" and "archived" into one `null` branch (widget-quick-action-guard.ts:20-43), Compose's `onSend` writing nothing (ComposeScreen.tsx:434-454), and the widget's current `Message`→`orbit://compose/<id>` button (widget-render.tsx:452-459). The cycle-1 HIGH findings (mutexed `recordTouchpoint` nested inside `inWriteTransaction`; UNIQUE-error-sniffing idempotency; the two-divergent-handoffs draft-loss bug) are genuinely resolved in the current plan text, not just re-asserted — Plan 01's `markAssistLogged` composes cores atomically with a status-guarded check-then-write, and Plan 02/03 centralize handoff+failure logic in one `performReachOut(messageBody?)` helper that Compose also calls.

## Strengths

- **HIGH-1/HIGH-3 resolution is structurally sound.** `markAssistLogged` (Plan 01, must_haves) composes `insertInteractionCore` + `recomputeLastContactCore` + `bumpDataRevisionCore` inside one `inWriteTransaction`, never calling the mutexed `recordTouchpoint` — this exactly matches the documented compose-don't-nest pattern in `src/db/transaction.ts:17-24`, which explicitly names "Plan 03's `deleteOrQuarantineField`" as the precedent. Not a novel risk; a proven idiom in this codebase.
- **Migration numbering is correct and re-verified.** `database.ts:48` confirms `TARGET_VERSION = 13` with migrations 001–013 registered; migration 014 is genuinely the next slot, and the plan explicitly calls out re-verifying this on disk (a documented past-drift hazard).
- **HIGH-2 (Compose/Router handoff divergence) is genuinely fixed by a single shared `performReachOut`.** Plan 02 Task 1 defines `performReachOut(exec, {…, messageBody?})` with create-before-launch + failure marking centralized; Plan 03 Task 2 explicitly forbids Compose from calling `createPendingAssist`/`SMS.sendSMSAsync`/`markAssistFailed` directly and grep-gates on it. This removes the double-implementation risk cycle-1 flagged.
- **Merge/purge wiring matches the actual shipped mechanism, not a guess.** `merge-dao.ts:153`'s reparent array is exactly what Plan 05 Task 1 targets, and the plan correctly identifies that purge relies on cascade rather than the `PURGE_CHILDREN` explicit fan-out (verified: purge-dao.ts wasn't touched, only tested).
- **Widget guard refactor is justified by real code, not invented.** The live `guardWidgetIntent` (widget-quick-action-guard.ts:31-34) really does return the same `null` for both `contact === null` and `archived_at !== null` — so Plan 05's discriminated-result refactor is solving an actual ambiguity, and the "byte-for-byte unchanged for existing intents" acceptance criterion is testable.
- **Timer-free eligibility design is consistent across plans.** Both the 15s buffer (Plan 01/02) and 24h expiry (Plan 04's sweep) are computed off the stored `handoff_at`, matching `installSweepTrigger`'s actual background→active tracking pattern (launch-sweep.ts:102-114), and Plan 04 explicitly adds a joint AppState test rather than assuming non-interference.

## Concerns

- **MEDIUM — Plan 01's cap-5 prune and Plan 04's sweep both touch `interaction_assists` but with different WHERE-scopes; verify no double-expire race matters.** Not a correctness bug (both are idempotent status-guarded UPDATEs), but worth noting cap-5 pruning happens synchronously inside `createPendingAssist`'s transaction while the sweep runs at launch — two independent expiry paths converging on the same rows. The plan's tests cover each in isolation; no test explicitly proves they compose correctly when both fire in the same session (e.g., cap-5 expires assist X, then the sweep's 24h check also targets X — harmless since both write `status='expired'`, but not explicitly asserted as a case).
- **LOW — Plan 02 Task 3's defensive read of `interaction_assist_enabled` (raw column, before Plan 04 lands the DAO key) creates a temporary parallel access path to the same column.** This is explicitly a deliberate, documented same-wave independence choice (21-03's `<decisions>` block) rather than an oversight, and it's scoped to one plan-cycle — acceptable, but confirm the "later touch-up" to swap to `getAppSettings().interactionAssistEnabled` is actually tracked somewhere (it isn't in any must_haves/acceptance_criteria I can see — it's just prose in the decisions block, so it could silently never happen and leave two read paths to one column forever).
- **LOW — `markAssistLogged`'s SELECT-then-write is two statements without `SELECT ... FOR UPDATE`-style locking, but SQLite's single-writer transaction model via the existing mutex makes this moot** — since `inWriteTransaction` composes with `withMutex`, no other write can interleave. This is correctly relied upon rather than re-solved, but it's worth flagging as a reviewer note: the correctness here depends entirely on `inWriteTransaction`'s mutex actually serializing all writers app-wide, which is true today (confirmed in transaction.ts) but is an implicit global invariant the plan doesn't re-state as a risk.
- **LOW — Plan 05's `orbit://reach/<id>` reset target `[Home, Profile{contactId, openReachOut:true}]` depends on `ContactProfileScreen` consuming `openReachOut` exactly once (Plan 02 Task 3 "consume-once via setParams").** If the router opens on every focus rather than once, a user backgrounding/foregrounding while the router is already dismissed could reopen it. The plan does specify "consume-once on focus," which is the right mitigation, but there's no explicit test asserting the param is cleared (Plan 02's acceptance criteria for Task 3 don't grep/test for `setParams` being called).

## Suggestions

- Add one integration-level test (could live in Plan 04's sweep test file) that creates 6 pending assists, lets both cap-5 pruning and the sweep run, and asserts a stable end state — closes the double-expiry gap above cheaply.
- Add an explicit acceptance criterion to Plan 02 Task 3 (or Plan 05) asserting `openReachOut` is cleared via `setParams` after consumption, since this is the concurrency/adjacency guard for the widget deep-link reopening bug.
- Track the Plan 03→Plan 04 raw-column-read handoff as a literal TODO/task rather than only prose in `<decisions>`, so it doesn't get silently forgotten after Wave 3 lands.

## Risk Assessment: **LOW**

The plan set resolves the cycle-1 HIGH findings with mechanisms that trace correctly to real, verified code (not just restated intent), the migration numbering and cross-phase wiring targets are accurate on disk, and the remaining concerns are minor test-coverage gaps rather than architectural or correctness flaws. This is executable as written.

---

## Verification Coverage (orchestrator, cycle 2)

Independent re-verification against the source on disk, per CLAUDE.md ("review the
code, not the diff"). Authority resolved once: `EFFECTIVE_AUTHORITY = grep`.

### 1. Source-grounding (cited pre-existing symbols; excludes each plan's own "Artifacts this phase produces")

All symbols the plans cite as existing were resolved in source. Under `grep`
authority a MISSING would be `needs-acknowledgement` / `hardBlock:false` (no
source-grounding HIGH is possible this cycle); none were MISSING regardless.

| Symbol | Status | Evidence |
|---|---|---|
| `recordTouchpoint` | VERIFIED | src/db/recency-dao.ts:217 (mutexed wrapper; `rejectFutureOccurredAt` at :228) |
| `insertInteractionCore` (alias) | VERIFIED | src/db/recency-dao.ts:426 (non-mutexed core; NO future-guard) |
| `recomputeLastContactCore` (alias) | VERIFIED | src/db/recency-dao.ts:427 (sole `last_contact` writer, body :159-176) |
| `bumpDataRevisionCore` | VERIFIED | src/db/data-revision-dao.ts:5 |
| `inWriteTransaction` | VERIFIED | src/db/transaction.ts:49 (non-reentrant mutex; nesting = permanent hang) |
| `rejectFutureOccurredAt` | VERIFIED | src/db/log-guards.ts:68 (imported by recency-dao.ts:52) |
| `newUid` | VERIFIED | src/db/uid.ts:18 |
| `mergeContacts` | VERIFIED | src/db/merge-dao.ts:92; reparent array :153 omits `interaction_assists` (Plan 05 fix genuinely required) |
| `purgeContact` | VERIFIED | src/db/purge-dao.ts:204 (deletes contact row → FK cascade path valid) |
| `guardWidgetIntent` | VERIFIED | src/services/widget/widget-quick-action-guard.ts:20 (collapses missing+archived to `null` — refactor justified) |
| `parseWidgetId` | VERIFIED | src/navigation/widget-linking.ts:100 (safe-integer guard) |
| `listActionablePrimaryMethods` | VERIFIED | src/db/contact-methods-read.ts:30 |
| `notifyWidgetDataChanged` | VERIFIED | src/services/widget/widget-refresh.ts:74 |
| `registerSweepHook` | VERIFIED | src/services/launch-sweep.ts:45 |
| `TARGET_VERSION` | VERIFIED | src/db/database.ts:48 = 13; migration013 is head (:64); 014 is next slot |
| `TOGGLE_FIELDS` / `COLUMN_OF` | VERIFIED | src/db/app-settings-dao.ts:252 / :93 |
| `PORTABLE_SETTINGS_KEYS` | VERIFIED | src/backup/backup-schema.ts:106 (`digestEnabled` precedent :49) |
| `SMS.sendSMSAsync` (Compose) | VERIFIED | src/screens/ComposeScreen.tsx (expo-sms; onSend writes nothing) |
| widget Message→compose button | VERIFIED | src/services/widget/widget-render.tsx:458 `orbit://compose/${tile.id}` (Plan 05 swaps to Contact) |
| `CONTACT_URI`/`COMPOSE_URI` anchored patterns | VERIFIED | src/navigation/widget-linking.ts:11-12 (Plan 05 `orbit://reach/<id>` mirrors these) |

- MISSING: none.
- AMBIGUOUS: none.
- UNCHECKABLE / skipped: symbols under each plan's "Artifacts this phase produces"
  (e.g. `markAssistLogged`, `createPendingAssist`, `performReachOut`,
  `deriveReachRoutes`, `assist-eligibility.ts`, migration014) — excluded by
  contract as this-phase outputs. Native `Linking.openURL`/`tel:`/`mailto:` are
  greenfield in this repo (no existing `tel:` usage) and are device-verified in
  21-06, not node-checkable here.

Minor citation drift (advisory, not a finding): 21-01-PLAN.md cites the core
exports at `recency-dao.ts:425-428`; on disk they are at :426-427. Same block,
off by ~1 line.

### 2. Cross-artifact fact-drift (advisory — never counts toward HIGH/actionable)

`drift-guard phase-status --phase 21` → verdict `lag` (STATE.md "Ready to execute"
rank 1 vs ROADMAP "Not started" rank 0). Per the convergence contract, `lag` is
ignored (only `drifted` under STATE.md authority would be reported). No genuine
ROADMAP↔PLAN success-criteria/requirement-ID/glossary contradiction found.

### Lane execution
All three named lanes ran and returned genuine (non-stubbed) source-grounded
reviews: codex (~100s), cursor (~110s), claude/sonnet (~55s). No lane dropped or
timed out; no hook-trust bypass flag used.
