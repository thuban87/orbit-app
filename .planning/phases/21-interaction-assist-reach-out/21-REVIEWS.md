---
phase: 21
reviewers: [codex, cursor, claude]
reviewed_at: 2026-08-31T19:52:32Z
plans_reviewed: [21-01-PLAN.md, 21-02-PLAN.md, 21-03-PLAN.md, 21-04-PLAN.md, 21-05-PLAN.md, 21-06-PLAN.md]
review_cycle: 3
models:
  codex: "gpt-5.6-terra (reasoning=low)"
  cursor: "unknown"
  claude: "sonnet (reasoning=low)"
model_sources:
  codex: "banner"
  cursor: "unknown"
  claude: "pinned"
---

# Cross-AI Plan Review — Phase 21: Interaction Assist & Reach Out (Cycle 3)

## Consensus Summary

Three independent reviewers (Codex / gpt-5.6-terra, Cursor, Claude / sonnet — a session distinct from the orchestrator) reviewed the six committed plans source-grounded against the code on disk. All three agree the plan set is unusually well grounded: the migration target is correct (`TARGET_VERSION = 13` on disk → 014 next), the confirmation path composes the non-mutexed recency cores inside ONE `inWriteTransaction` and never calls the mutexed `recordTouchpoint`, LOG-06 future-date parity is restored via `rejectFutureOccurredAt(handoff_at, now)` before the transaction, and there is no network/passive-observation/widget-writer scope creep. The three cycle-1 HIGHs (mutex nesting, Compose/router handoff divergence, non-atomic idempotency) and the cycle-2 HIGH (LOG-06 parity) are all verified resolved in the current plan text.

The reviewers diverge on ONE new finding: Codex raises a HIGH — a merged/purged-target TOCTOU race in Plan 01's `markAssistLogged` (it caches `contact_id` in a pre-transaction, unmutexed read and re-reads only `status` inside the transaction). Cursor and Claude did not surface this and rate the phase LOW–MEDIUM / MEDIUM overall. Independent verification confirms the race is real (transaction.ts mutex model + merge-dao reparent/delete) but bounded — a transient FK-abort that rolls back and self-heals on retry, not silent corruption and not a DATA-04 violation. It sits in the phase's self-declared cross-phase correctness core and is unaddressed, and the fix (re-read the full assist row, not just status, inside the transaction) is cheap.

Beyond that, the actionable items are execution-hygiene test-fixture gaps around the irreversible migration 014, plus one settings-path data-revision omission and one handoff-value convention.

### Agreed Strengths
- **Single-writer composition is correctly grounded** (all three): `insertInteractionCore` + `recomputeLastContactCore` + `bumpDataRevisionCore` composed in one transaction; `recordTouchpoint` never called; `recomputeLastContactCore` remains the sole `contacts.last_contact` writer (DATA-04). Verified against `recency-dao.ts:414-428`, `transaction.ts:49-64`.
- **LOG-06 parity is real, not invented** (all three): `rejectFutureOccurredAt` (`log-guards.ts:68`) mirrors `recordTouchpoint`'s existing pre-transaction guard (`recency-dao.ts:227-231`).
- **Merge reparent gap correctly targeted** (all three): `merge-dao.ts:153` genuinely omits `"interaction_assists"`; Plan 05 closes it (Cluster AA).
- **Widget deep-link boundary preserved** (all three): `orbit://reach/<id>` mirrors the anchored `parseWidgetId` allow-list (`widget-linking.ts:91-100`); no widget-side assist writer.
- **Local-first intact** (all three): no network read paths, no passive call/text/email observation, no egress widening.

### Agreed Concerns
- **MEDIUM — Migration 014 breaks hard-coded migration-test fixtures** (Codex + Cursor): `full-chain.test.ts:39` asserts `expect(TARGET_VERSION).toBe(13)` and is in no plan's scope; Plan 01 bumps to 14 → the 21-06 full-suite gate fails. Codex additionally notes `merge-dao.test.ts:21,34` (local MIGRATIONS through 013, migrates to 13) and `purge-dao.test.ts:54` (through 011) must register migration014 for Plan 05's new pending-assist cases to run.
- **LOW — Handoff endpoint value not pinned to `canonical_value`** (Cursor + Claude): plans reference `ContactMethodRow.display_value` in read_first (`21-03-PLAN.md:93`) and never specify `canonical_value` for `tel:`/`sms:`/`mailto:` construction, while shipped Compose uses `canonical_value` (`compose-logic.ts:57`). Formatted numbers could break handoff.

### Divergent Views
- **Codex HIGH vs Cursor/Claude no-HIGH on the merge/purge confirmation race.** Codex: caching the target before the mutexed transaction can log against a stale merged/purged `contact_id`, contradicting the merged-target-redirect invariant. Cursor/Claude did not raise it. Verification: the race is real but its worst case is a transient FK-abort (post-Plan-05 reparent leaves `contact_id` pointing at the deleted absorbed contact) that rolls back and self-heals on retry; pre-Plan-05 and purge paths cascade-delete the assist and the in-txn status re-check no-ops. Real, bounded, unaddressed, cheap to fix — surfaced as this cycle's HIGH for the planner/owner to right-size.

---

## Codex Review

## Summary

The plans are unusually well grounded in the current codebase: they correctly target migration 014, compose the non-mutexed recency cores, preserve the strict widget URI boundary, and explicitly avoid network/passive-observation scope creep. The main gap is a race in the proposed confirmation DAO: it caches the assist’s target before entering the mutex-protected transaction, which can violate the merged-target redirect guarantee. There are also concrete full-suite migration-fixture and data-revision omissions.

## Strengths

- The migration target is correct. The repo is currently at `TARGET_VERSION = 13` with migrations through `migration013` in [src/db/database.ts](/home/bwales/projects/orbit-app/src/db/database.ts:48), so appending migration 014 and moving the target to 14 is the right forward-only shape.

- Plan 01 correctly avoids nesting the transaction wrapper. The existing wrapper is explicitly non-reentrant and would permanently hang if nested ([src/db/transaction.ts](/home/bwales/projects/orbit-app/src/db/transaction.ts:12)). The plan’s use of `insertInteractionCore`, `recomputeLastContactCore`, and `bumpDataRevisionCore` inside one outer transaction matches the established composition contract ([src/db/recency-dao.ts](/home/bwales/projects/orbit-app/src/db/recency-dao.ts:414)).

- The plan correctly restores LOG-06 protection when bypassing `recordTouchpoint`. The existing wrapper checks `rejectFutureOccurredAt` before it opens a transaction ([src/db/recency-dao.ts](/home/bwales/projects/orbit-app/src/db/recency-dao.ts:217)); the exported cores do not. Calling the guard before the assist transaction is necessary.

- The merge approach is correct in principle. `mergeContacts` reparents child tables before deleting the absorbed contact ([src/db/merge-dao.ts](/home/bwales/projects/orbit-app/src/db/merge-dao.ts:153)), and the dossier requires reparenting rather than a later survivor lookup. Adding `interaction_assists` there is the right lifecycle mechanism.

- The widget plan preserves a real security boundary. Current parsing uses anchored routes plus safe-integer validation ([src/navigation/widget-linking.ts](/home/bwales/projects/orbit-app/src/navigation/widget-linking.ts:91)), so the proposed `orbit://reach/<id>` branch should mirror this approach.

- The handoff plan correctly avoids `Linking.canOpenURL` and treats only thrown launches as failures. This is consistent with the project’s existing direct `openURL` style and avoids interpreting native compose handoff as delivery confirmation.

## Concerns

- **HIGH — confirmation can log against a stale merged or purged contact.** Plan 01 proposes reading the entire assist row before the transaction, then re-reading only its `status` inside the transaction. A merge can occur between those reads: `mergeContacts` changes `contact_id` then deletes the absorbed contact ([src/db/merge-dao.ts](/home/bwales/projects/orbit-app/src/db/merge-dao.ts:153), [src/db/merge-dao.ts](/home/bwales/projects/orbit-app/src/db/merge-dao.ts:185)). The confirmation then uses the stale pre-transaction `contact_id`, causing an FK failure after merge/purge rather than logging to the survivor. This contradicts the dossier’s merged-target redirect invariant.

  Suggestion: perform the future-date guard from a preliminary read if desired, but inside the transaction re-read `contact_id`, `channel`, `handoff_at`, and `status` by `uid`, and use that in-transaction row for the interaction insert/recompute/status update. Add a regression test that pauses confirmation after its preliminary read, merges the contact, then confirms successfully against the survivor.

- **MEDIUM — migration 014 will break existing hard-coded migration fixtures unless the plans update them.** The full-chain test explicitly asserts target version 13 ([src/db/migrations/full-chain.test.ts](/home/bwales/projects/orbit-app/src/db/migrations/full-chain.test.ts:37)). The merge test manually registers only migrations 001–013 and migrates to 13 ([src/db/merge-dao.test.ts](/home/bwales/projects/orbit-app/src/db/merge-dao.test.ts:21)). The purge test is even older, stopping at migration 011 ([src/db/purge-dao.test.ts](/home/bwales/projects/orbit-app/src/db/purge-dao.test.ts:54)). Plan 05’s proposed assist tests cannot create `interaction_assists` using these fixtures.

  Suggestion: add `full-chain.test.ts` to Plan 01 and explicitly update its 014 assertions. In Plan 05, update merge/purge fixtures to include migration 014 (or use central `MIGRATIONS`/`TARGET_VERSION` where practical).

- **MEDIUM — Plan 04’s custom settings writer omits the normal data-revision bump.** `updateAppSettings()` updates the setting and calls `bumpDataRevisionCore` in the same transaction ([src/db/app-settings-dao.ts](/home/bwales/projects/orbit-app/src/db/app-settings-dao.ts:596)). The planned `setInteractionAssistEnabled()` composes `updateAppSettingsCore()` but only describes expiring assists. Without one revision bump, a changed portable setting may not trigger the “backup on change” path, despite being added to the portable snapshot.

  Suggestion: call `bumpDataRevisionCore(exec)` exactly once in `setInteractionAssistEnabled`, after setting update and pending-assist expiry. Add a test asserting one revision increment for both ON and OFF changes.

- **MEDIUM — Plan 05’s declared modified-file list omits files its task explicitly refactors.** The frontmatter does not list `src/services/widget/widget-quick-action-guard.ts` or its test, although Task 2 changes both. The actual function currently returns `WidgetNavIntent | null` ([src/services/widget/widget-quick-action-guard.ts](/home/bwales/projects/orbit-app/src/services/widget/widget-quick-action-guard.ts:20)), so the discriminated-result refactor necessarily edits that file and all callers.

  Suggestion: add both guard files to `files_modified`, and identify all callers before execution. This matters for wave ownership/conflict checking.

- **MEDIUM — the device-UAT terminal state is internally inconsistent.** Plan 06 says device-dependent failure rows and owner sign-off are explicit blocked checkpoints, but its acceptance criteria and done state require every matrix row to pass and owner sign-off to be captured. Since the plan is `autonomous: true`, it needs a defined pause state rather than claiming completion while awaiting an owner.

  Suggestion: define Plan 06 as “automated gates complete; awaiting owner UAT” when blocked, with phase completion conditional on a subsequent human response.

## Risk Assessment

**Overall: Medium.** The architecture is sound and well aligned with the repo’s invariants, with no apparent egress or passive-monitoring expansion. The stale assist-target race is the key high-risk issue because it directly affects merged/purged lifecycle correctness; resolving it, plus fixing migration fixtures and the settings revision bump, would bring the implementation plan to low risk.

---

## Cursor Review

# Phase 21: Interaction Assist & Reach Out — Cross-AI Plan Review

**Repository:** `/home/bwales/projects/orbit-app`  
**Plans reviewed:** `21-01-PLAN.md` through `21-06-PLAN.md` (cycle-2 revision on disk)  
**Head schema verified:** `TARGET_VERSION = 13`, migrations 001–013 registered (`src/db/database.ts:48`, `:64`); migration 014 not yet present (expected)

---

## Summary

The six plans form a coherent, tracer-first brownfield phase that matches the authoritative dossier and the shipped codebase. Cycle-1 architectural hazards (mutex nesting via `recordTouchpoint`, divergent Compose/router handoffs, non-atomic idempotency) are explicitly resolved in plan text with mechanisms that mirror existing patterns in `transaction.ts`, `recency-dao.ts`, and `contacts-dao.ts`. Cross-phase correctness (merge reparent, purge cascade, widget deep-link allow-list) is correctly scoped to 21-05 with node tests, and device-only gaps are honestly gated in 21-06. The phase is ready to execute; the main residual risk is test-suite completeness around migration 014 registration, not product-design ambiguity.

---

## Cycle-1 HIGH Findings — Resolution Status

| ID | Issue | Status | Evidence |
|----|-------|--------|----------|
| **HIGH-1** | Nested `inWriteTransaction` / permanent hang if confirmation calls mutexed `recordTouchpoint` | **Resolved in plan text** | `transaction.ts:11-29` documents non-reentrancy; `recency-dao.ts:425-428` exports `insertInteractionCore` + `recomputeLastContactCore`; `contacts-dao.ts:189-195` is the compose-inside-one-txn precedent. 21-01 forbids calling `recordTouchpoint` and specifies ONE outer txn composing cores + `bumpDataRevisionCore`. |
| **HIGH-2** | Divergent Compose vs Reach Out handoffs (draft loss / duplicated failure logic) | **Resolved in plan text** | Current `ComposeScreen.onSend` (`ComposeScreen.tsx:436-458`) calls `SMS.sendSMSAsync` directly. 21-02 introduces `performReachOut(..., messageBody?)`; 21-03 routes Compose through it with the draft. |
| **HIGH-3** | Idempotency via UNIQUE sniffing or non-atomic confirm | **Resolved in plan text** | 21-01 specifies status-guarded read-then-write + `WHERE status='pending'` inside ONE txn; crash mid-txn rolls back to `'pending'`. |

---

## Plan 21-01 — TRACER: Migration 014 + Assist DAO + Eligibility

### Summary

Correctly front-loads the phase’s central hazard: confirmation must compose the authoritative recency cores without nesting the mutex. Migration numbering matches disk (`TARGET_VERSION = 13` → 014). LOG-06 parity is now explicitly required.

### Strengths

- **Single-writer composition matches shipped code:** Plan mirrors `contacts-dao.ts:189-195` and imports cores from `recency-dao.ts:425-428`; `recomputeLastContactCore` remains the sole `contacts.last_contact` writer per DATA-04.
- **Mutex hazard named and avoided:** References `transaction.ts:11-29`; forbids mutexed `recordTouchpoint` (`recency-dao.ts:217-243`).
- **LOG-06 parity specified:** `rejectFutureOccurredAt(assist.handoff_at, now)` before txn (`log-guards.ts:68`, same shape as `recency-dao.ts:227-231`); acceptance criteria include a future-`handoff_at` rejection test.
- **Schema claims verified:** `interactions.channel` / `.direction` / `.source` are free TEXT with no CHECK (`001-initial.ts`); `source='assist'` is safe.
- **Eligibility unified on `handoff_at`:** 15s buffer and 24h expiry both against `handoff_at`, consistent with 21-04 sweep — not `created_at`.
- **Merge gap correctly identified:** `interaction_assists` absent from `merge-dao.ts:153` reparent array (deferred to 21-05, as dossier Cluster AA requires).

### Concerns

- **MEDIUM — `full-chain.test.ts` not in scope:** Prior migration plans (e.g. 19-01) explicitly update `src/db/migrations/full-chain.test.ts`. Plan 01 only verifies `interaction-assist-dao.test.ts`, but `full-chain.test.ts:39` hard-asserts `TARGET_VERSION === 13`. After 21-01 lands, `npm test` will fail until this file is updated — likely only discovered at the 21-06 full-suite gate unless fixed in 21-01.
- **LOW — No dedicated `014-interaction-assists.test.ts`:** Migration 013 has its own test module; 21-01 relies on DAO tests running migrations through 014. Workable, but weaker than the repo’s migration-test convention.
- **LOW — Residual “recordTouchpoint” references:** Objective (`21-01-PLAN.md:59`) still mentions what `recordTouchpoint` composes (correctly negated). Reduced executor-confusion risk vs cycle 1, but a careless reader could still mis-route.

### Suggestions

- Add `src/db/migrations/full-chain.test.ts` (and optionally `014-interaction-assists.test.ts`) to 21-01 `files_modified`, verify, and acceptance criteria — mirror 19-01-PLAN.
- Add a node test: `markAssistLogged` on a pending assist whose `contact_id` is archived still writes the interaction (Cluster Z data-layer guarantee).

### Risk Assessment

**LOW–MEDIUM** — Data-layer design is sound and precedented; risk is test-harness gap, not architecture.

---

## Plan 21-02 — Reach Out Router + Handoff + Banner + Profile Entry

### Summary

Delivers the first user-visible slice with correct write-before-handoff ordering, non-modal banner architecture, and AppState-driven queue refresh. Wave-2 scope honestly defers multi-endpoint selection to 21-03.

### Strengths

- **Cluster E ordering:** `createPendingAssist` before native launch; `markAssistFailed` only on thrown errors — matches dossier and `ComposeScreen.tsx:447-448` (resolved `'unknown'` is not failure).
- **Cluster H:** Banner as absolute overlay, not `Modal` — aligns with dossier Back-pass-through.
- **HIGH-2 centralization:** Single `performReachOut(exec, {..., messageBody?})` with default `''`.
- **Widget freshness:** `notifyWidgetDataChanged()` after confirmation mirrors `notification-actions.ts:161` and existing `ContactProfileScreen.tsx` pattern (`:336`, etc.).
- **AppState model:** Separate subscription from `installSweepTrigger` (`launch-sweep.ts:108-114`); 21-04 adds joint coexistence test.
- **No local-first violations:** No network, no passive monitoring, no `canOpenURL` gating.

### Concerns

- **LOW — Intra-phase multi-endpoint deferral:** Until 21-03, ≥2 endpoints route via primary only (`21-02-PLAN.md:28`, `:136`). Acceptable because the phase does not ship between waves (21-06 gates), but worth noting in UAT matrix for intermediate wave-2 state if ever executed in isolation.
- **LOW — Transitional raw `interaction_assist_enabled` read:** Task 3 reads the column directly until 21-04/21-06 consolidate (`21-02-PLAN.md:171`). Tracked in 21-06; transient dual read path.

### Suggestions

- In `performReachOut` / router wiring, document that handoff uses `canonical_value` (not `display_value`), matching `compose-logic.ts:57` / `actionablePrimaryPhoneDestination`.

### Risk Assessment

**LOW** — Well-aligned with shipped Compose and notification patterns.

---

## Plan 21-03 — Endpoint Selector + Compose Send Seam

### Summary

Completes the ≤3-tap contract and unifies Compose Send with the shared assist lifecycle (Cluster AC). Wave-3 parallelization with 21-04 is file-disjoint.

### Strengths

- **Cluster AC preserved:** Compose writes no interaction at Send time; confirmation writes later via banner.
- **Cluster B/D:** Endpoint selector emphasizes primary; coarse channel only in interaction history.
- **HIGH-2 closure:** Compose grep-gates against direct `createPendingAssist` / `SMS.sendSMSAsync`.
- **Parallel-safe with 21-04:** `files_modified` disjoint (ComposeScreen vs settings/sweep files).

### Concerns

- **LOW — Endpoint value ambiguity:** Plan says “display/canonical per the handoff need” (`21-03-PLAN.md:101`). Shipped Compose uses `canonical_value` via `compose-logic.ts:57`. Using `display_value` for `tel:`/`sms:`/`mailto:` could break handoff on formatted numbers.

### Suggestions

- Pin handoff input to `canonical_value` (with fallback only if canonical is null — if that case exists in data model).

### Risk Assessment

**LOW**

---

## Plan 21-04 — Settings Toggle + Review Sheet + Launch Sweep

### Summary

Completes durable-queue lifecycle: default-on toggle with off-clears-queue, multi-pending review surface, timer-free 24h/30d prune via `registerSweepHook` (`launch-sweep.ts:45-46`).

### Strengths

- **Cluster G:** Toggle-off clears pending in ONE txn; no confirm dialog.
- **Backup portability:** `interactionAssistEnabled` added to DAO + `PORTABLE_SETTINGS_KEYS` (`backup-schema.ts:106-113`) — `digestEnabled` analog; setting absent from backup today (verified: no assist keys in `src/backup/`).
- **Double-expiry composition test:** Cap-5 (write-time) + sweep (launch-time) convergence explicitly tested.
- **Wave ordering clarified:** `depends_on: [21-02]`; extends 21-02 artifacts rather than racing them.
- **Widget freshness on review sheet:** `notifyWidgetDataChanged()` after sheet confirmation.

### Concerns

- **LOW — `assist-store` extended by both 21-02 and 21-04:** Sequential by wave (21-04 after 21-02); safe, but executor should merge store changes, not rewrite.

### Suggestions

- None beyond executing the documented joint AppState test.

### Risk Assessment

**LOW**

---

## Plan 21-05 — Merge / Purge / Widget Cross-Phase Wiring

### Summary

Correctly identified as the phase’s cross-phase correctness core. Targets real gaps verified on disk.

### Strengths

- **Merge reparent gap is real:** `merge-dao.ts:153` reparents `interactions`, `events`, `fuel`, etc. but not `interaction_assists` — dossier Cluster AA requires addition.
- **Purge path verified:** `purgeContact` explicit fan-out + `DELETE FROM contacts` (`purge-dao.ts:244-263`); FK `ON DELETE CASCADE` on assist table (per 21-01 migration spec) satisfies Cluster AB without PURGE_CHILDREN change.
- **Widget security:** Anchored `REACH_URI` follows `widget-linking.ts:100-157` / `parseWidgetId` pattern; `widget-task-handler.tsx:80` confirms OPEN_URI is deep-link only — no assist writer.
- **Discriminated guard:** Refactor of `guardWidgetIntent` (`widget-quick-action-guard.ts:34-35` currently collapses missing and archived to `null`) enables purged vs archived UX split per dossier AB + CRUD-05.
- **Deep-link reopen loop:** `openReachOut` consume-once via `setParams` — necessary given `WidgetLinkingGate` flush model (`widget-linking.ts:216-244`).
- **Cluster Z preserved on banner path:** Archived widget reach silently dropped; pending assist on archived contact still confirmable via banner (unaffected).

### Concerns

- **LOW — `WidgetLinkingGate` caller update surface:** Discriminated guard requires updating every `guardWidgetIntent` caller; plan says “EVERY caller” — verify `widget-linking.test.ts` and `widget-quick-action-guard.test.ts` cover all paths.
- **LOW — Purged-target UX uses Alert:** Plan allows Alert or routed message; pick one for consistency with app patterns.

### Suggestions

- Grep for all `guardWidgetIntent` call sites before merge to ensure none remain on the old `|null` contract.

### Risk Assessment

**LOW–MEDIUM** — Highest correctness density in the phase, but well-scoped with node tests.

---

## Plan 21-06 — Full-Suite Gate + Device UAT

### Summary

Appropriate owner-bucket gate for irreversible migration 014 on a real device. Closes device-only gaps honestly.

### Strengths

- **Read-path consolidation:** Swaps transitional raw reads to `getAppSettings().interactionAssistEnabled` before full-suite gate (finding #4).
- **DB-verified UAT:** run-as evidence per dossier test matrix (`docs/dossier/21-interaction-assist-reach-out.md:805-825`).
- **Time-travel strategy:** Documented for 15s/24h rows — avoids flaky waits.
- **Explicit blocked checkpoints:** Owner sign-off and genuine handoff-failure rows not auto-passed.
- **Coverage of review findings:** Widget freshness (#1), settings read consolidation (#4), reopen loop (#5).

### Concerns

- **LOW — `autonomous: true` vs owner sign-off:** Reconciled via `<human-check>` and explicit BLOCKED rows; acceptable under `human_verify_mode=end-of-phase`.
- **LOW — Handoff-failure rows may be hard to force:** Plan acknowledges device may always have dialer/messages/mail — owner confirmation or deliberate broken intent required.

### Suggestions

- Add `full-chain.test.ts` failure to 21-06 pre-flight checklist if not fixed in 21-01.

### Risk Assessment

**MEDIUM** (inherent device/native-handoff uncertainty) — mitigated by honest gating and DB verification.

---

## Cross-Cutting Strengths

- **Local-first preserved:** No network read paths, no passive call/text/email observation, no widget-side assist writer (`widget-render.tsx:458` still emits `orbit://compose/` today; plan changes to `orbit://reach/` URI-only).
- **DATA-04 honored:** All interaction/recency paths either use mutexed `recordTouchpoint` or compose the same cores; assist confirmation is explicitly the latter.
- **Dossier alignment:** Clusters A–AC, E, G, H, J, M, N, O, P, T, X, Z, AA, AB, AF–AH referenced with implementation constraints matching shipped Phase 20 code (no survivor pointer in schema).
- **Tracer-first wave ordering:** Node-verifiable data spine before device-only UI.
- **Timer-free eligibility:** Pure `assist-eligibility.ts` + launch sweep; no `setTimeout`/`setInterval` on assist lifecycle.

---

## Cross-Cutting Concerns

| Severity | Finding | Evidence |
|----------|---------|----------|
| **MEDIUM** | Migration 014 landing will break `full-chain.test.ts` unless updated in 21-01 | `full-chain.test.ts:39` asserts `TARGET_VERSION === 13`; 21-01 omits this file |
| **LOW** | Handoff endpoint should be pinned to `canonical_value` | `compose-logic.ts:57`; 21-03 wording ambiguous |
| **LOW** | Cluster Z (archived + pending assist) lacks explicit node test | Dossier `:526-531`; UAT only in 21-06 |
| **LOW** | `interaction_assists` correctly excluded from backup entity set | No matches in `src/backup/`; aligns with Cluster X operational-state model |

---

## Suggestions (Priority Order)

1. **21-01:** Add `full-chain.test.ts` (+ optional `014-interaction-assists.test.ts`) to scope, verify, and acceptance criteria.
2. **21-03 / handoff.ts:** Specify `canonical_value` for native intents; reuse or extract from `actionablePrimaryPhoneDestination` pattern.
3. **21-01:** Add node test: confirm assist on archived contact succeeds (Cluster Z).
4. **21-01:** Tighten prose — replace any “through `recordTouchpoint`” with “through recency cores (same operations as `recordTouchpoint`, without mutex wrapper).”

---

## Risk Assessment

**Overall: LOW–MEDIUM**

Justification: Cycle-1 HIGH architectural risks are substantively resolved in current plan text with code-grounded mechanisms. Cross-phase wiring targets verified real gaps (`merge-dao.ts:153`, `widget-quick-action-guard.ts:34-35`, `widget-render.tsx:458`). LOG-06 parity is now specified. Remaining risk is primarily execution hygiene (migration chain test update, endpoint value convention) and inherent device-handoff uncertainty — both bounded and addressable without design reversals. No plan contradicts a locked `[DECIDED]` dossier cluster.

---

## Claude Review

# Cross-AI Plan Review — Phase 21: Interaction Assist & Reach Out

## Verification method
I opened source files directly rather than trusting the plans' citations: `src/db/database.ts`, `src/db/recency-dao.ts`, `src/db/log-guards.ts`, `src/db/merge-dao.ts`, `src/db/purge-dao.ts`, `src/db/app-settings-dao.ts`, `src/backup/backup-schema.ts`, `src/navigation/widget-linking.ts`, `src/services/widget/widget-quick-action-guard.ts`. All load-bearing factual claims below are confirmed against these reads, not the plan text.

**Confirmed accurate:**
- `TARGET_VERSION = 13`, migrations run through `013-reconciliation-and-merge` (`database.ts:48,64`) — migration 014 is correctly the next slot.
- `insertInteractionCore`/`recomputeLastContactCore` are real exported aliases of `insertInteraction`/`recomputeLastContact` (`recency-dao.ts:426-427`) — the plans' "compose the cores, not the mutexed wrapper" pattern is grounded in real exports, not invented.
- `rejectFutureOccurredAt` exists (`log-guards.ts:68`) and `recordTouchpoint` already calls it pre-transaction (`recency-dao.ts:228`) — the LOG-06-parity requirement in Plan 01 mirrors a real, existing pattern rather than inventing one.
- `merge-dao.ts:153`'s reparent array does **not** currently include `"interaction_assists"` — Plan 05's core fix is real and necessary, not phantom.
- `app-settings-dao.ts` `digestEnabled` appears at exactly the sites Plan 04 enumerates (types :49/:136, keys :188, `COLUMN_OF` :276, both SELECT/mapping blocks :312-333/:409-427) — the "follow digestEnabled at every site" instruction is concrete and checkable.
- `backup-schema.ts:106-107` `PORTABLE_SETTINGS_KEYS` is a real allow-list containing `digestEnabled` — Plan 04's finding-#2 fix (adding `interactionAssistEnabled`) is a real gap, not invented risk.
- `widget-linking.ts:91-92` confirms `CONTACT_URI`/`COMPOSE_URI` shape and `parseWidgetId` guarding (:100) — the `REACH_URI` pattern in Plan 05 mirrors this exactly.
- `widget-quick-action-guard.ts:20-43`: the guard currently returns `null` (blocks) for **any** archived target on **any** route, not just Compose — contrary to its own doc comment ("Allow live Profile opens for either lifecycle state"), which appears stale/inaccurate relative to the code. This actually supports Plan 05's claim that archived widget targets are "already silently dropped" today — but flags that the plan's own justification text ("matching the existing widget Profile policy") is citing a comment that mismatches the code it's attached to. Worth a note, not a blocker.

---

## Plan 01 (21-01, Wave 1 — DAO tracer)

**Strengths**
- The core correctness bet — compose `insertInteractionCore`+`recomputeLastContactCore`+`bumpDataRevisionCore` inside one `inWriteTransaction`, never call the mutexed `recordTouchpoint`, apply `rejectFutureOccurredAt` before the transaction — is verified against real exports and real prior art (`recency-dao.ts:228,426-428`). This is the single highest-risk piece of the phase and the plan grounds it correctly.
- Idempotency via status-guarded check-then-write (not UNIQUE-error sniffing) is a sound, portable pattern and is tested for (double-call, no double interaction).
- Cap-5 tie-break by `(created_at DESC, id DESC)` is deterministic and matches the SQL idiom already used elsewhere in the codebase.

**Concerns**
- MEDIUM: the plan calls for `markAssistLogged` to re-SELECT status *twice* — once before the transaction (to short-circuit on non-pending) and once inside it (to be safe against a race). Between those two reads, nothing else in this phase can mutate `interaction_assists.status` concurrently except a second confirmation call — the double-tap case is covered, but there's no `SELECT ... FOR UPDATE`-equivalent in SQLite; the correctness actually rests entirely on SQLite's single-writer file lock + the `WHERE status='pending'` guard on the final UPDATE. That's fine, but the plan's phrasing ("in-txn re-check for double-tap/crash-retry safety") slightly overstates what the outer pre-check buys — worth noting the real safety net is the final `WHERE status='pending'` on the UPDATE and the atomicity of the transaction, not the pre-check.
- LOW: `endpoint_value` is nullable in the schema but no acceptance criterion checks that a null/empty value doesn't break `markAssistLogged`'s downstream `channel` handling — minor, channel is a separate CHECK-constrained column so this is low risk.

---

## Plan 02 (21-02, Wave 2 — Router/handoff/banner UI)

**Strengths**
- Correctly identifies that `Linking.canOpenURL` false-negatives on Android 11+ and mandates try/openURL/catch — this matches the existing `LinksEditor.tsx` idiom the plan cites (not independently re-verified this pass, but consistent with the research doc's citation and general RN knowledge).
- The non-Modal banner requirement (Cluster H — Back passes through) is explicitly gated by a `grep -n "Modal" AssistBanner.tsx` acceptance criterion — a good mechanical check for an easy-to-regress requirement.
- Widget-freshness call (`notifyWidgetDataChanged`) after `markAssistLogged` is a reasonable addition; not independently verified that `notifyWidgetDataChanged` exists at the cited call sites, but the pattern (call after other foreground recency writes) is plausible given the shipped `ContactProfileScreen.tsx:336`/`notification-actions.ts:161` citations from research.

**Concerns**
- MEDIUM: `performReachOut`'s single shared-helper design (Task 1) is good deduplication, but the interface takes `assistEnabled: boolean` as a caller-supplied parameter rather than reading it internally from settings — meaning every call site (router, Compose in Plan 03) must independently fetch and thread the flag correctly. Given Plan 03/04's explicit acknowledgment that two call sites read the *raw column* defensively until Plan 06 consolidates onto the DAO getter, this is a real, tracked transitional risk (correctly flagged as finding #4) rather than an oversight — but it does mean for one full wave (Wave 3) there are three different ways `assistEnabled` gets determined (ContactProfileScreen raw read, ComposeScreen raw read, Settings via DAO). This is architecturally messier than passing `getAppSettings` into `performReachOut` itself and doing the read once, one level lower. Not wrong, but a design that trades a cleaner data flow for parallelizability.
- LOW: AppState transition testing ("mirror `installSweepTrigger`'s background→active but as a separate subscription") is described narratively but the plan doesn't specify what happens if `subscribeAppState` is invoked before the first migration completes (cold start ordering). Given `interaction_assists` doesn't exist until migration 014 runs, a banner refresh racing app startup before `ready` is set could throw. Task 3's action text does gate registration on `ready`, which mitigates this — acceptable.

---

## Plan 03 (21-03, Wave 3 — EndpointSelector + Compose seam)

**Strengths**
- The decision to route Compose Send through the *same* `performReachOut` (rather than a parallel handoff path) directly fixes the HIGH-2 finding from the prior review cycle and is testable via the specified greps (`grep -n "performReachOut" ComposeScreen.tsx`).
- Correctly retains Compose's Copy-button fallback and `sending` in-flight latch rather than removing UX that already works.
- The explicit acknowledgment that this plan is independent of 21-04's settings-DAO landing (raw column read, defensively defaulted) with a tracked swap-back task in 21-06 is good process discipline — it names the debt rather than silently accumulating it.

**Concerns**
- MEDIUM: reading the raw `interaction_assist_enabled` column directly in ComposeScreen (rather than via a shared tiny helper) means the "default to enabled=1 if missing" defensive logic is duplicated independently in two files (ContactProfileScreen from Plan 02, ComposeScreen here) with no shared implementation to keep them consistent. A one-line shared helper (`readAssistEnabledRaw(exec)`) in `handoff.ts` or similar would have removed this duplication risk without requiring either screen to depend on Plan 04. As written, a divergence between the two raw-read implementations (e.g., different column-missing handling) is a plausible way for Wave 3 to introduce an inconsistency that neither individual acceptance criterion would catch (each screen is tested independently, not cross-checked for identical logic).
- LOW: the endpoint value passed into `performReachOut` for the 3rd-tap case is sourced from `ContactMethodRow` per the read_first list, but the plan doesn't specify whether it's the raw stored value or a normalized/display value — given Cluster D says endpoint_value is "operational handoff context only," this is low-stakes, but SMS/tel/mailto URI construction is sensitive to formatting (e.g., a phone number with extension or formatting characters could break `tel:`). Not addressed in acceptance criteria.

---

## Plan 04 (21-04, Wave 3 — Settings, review sheet, sweep)

**Strengths**
- Verified: the plan's mandate to extend `digestEnabled`'s exact site list in `app-settings-dao.ts` is accurate against the file (confirmed above) — this is executable, not hand-wavy.
- Verified: the `PORTABLE_SETTINGS_KEYS` fix is real and necessary — without it, a restored backup silently drops the user's toggle state, which is a genuine defect the plan correctly targets.
- The double-expiry composition test (cap-5 write-time prune + 24h sweep-time expiry both converging on `status='expired'`, idempotent under a second sweep) is a good defensive test for a real interaction between two independently-triggered code paths that both touch the same rows.
- The joint-AppState test (sweep's `installSweepTrigger` + banner's `subscribeAppState` coexisting against one fake AppState) directly addresses a plausible regression class (two listeners on one AppState instance stepping on each other) that would otherwise only surface in device UAT.

**Concerns**
- MEDIUM: `setInteractionAssistEnabled` clearing pending assists to `status='expired'` on toggle-off is a reasonable choice (documented as Assumption A3 in research), but note it means "expired" is now overloaded with two distinct real-world meanings (aged-out vs deliberately-cleared-by-toggle). Nothing downstream appears to distinguish these two causes (no `expired_reason` column), so if a future UX wants to say "you turned this off" vs "this timed out," that data is already gone. Low likelihood of being needed, but worth flagging since it's a one-way door once ships (irreversible migration).
- LOW: the plan's "off means off" toggle UI explicitly forbids a confirmation dialog per the dossier — correctly implemented as a plain Switch. No concern there, just confirming it's correctly sourced from Cluster G.

---

## Plan 05 (21-05, Wave 3 — merge/purge/widget wiring)

**Strengths**
- Verified: the core fix (`merge-dao.ts:153` reparent array missing `"interaction_assists"`) is real — this plan closes a genuine, dossier-flagged cross-phase hazard (Cluster AA), and the "no code change" purge approach (rely on `ON DELETE CASCADE`) matches the schema's `contact_id ... REFERENCES contacts(id) ON DELETE CASCADE` pattern used throughout `001-initial.ts` and other migrations for child tables.
- Verified: `widget-linking.ts:91-92` confirms the `CONTACT_URI`/`COMPOSE_URI` regex shape and `parseWidgetId` (:100) guard the plan instructs `REACH_URI` to mirror — this is not invented, it's copying a real, already-battle-tested pattern.
- The discriminated `guardWidgetIntent` refactor (`{ok:true,intent}|{ok:false,reason}`) is a clean, minimal-blast-radius way to let the REACH gate distinguish "purged" from "archived" without changing existing Profile/Compose/Favourites behavior — and the plan explicitly requires a test proving those three intents are byte-for-byte unchanged, which is the right guardrail for a refactor touching a security-relevant function.
- The "consume the `openReachOut` param exactly once" fix (clearing via `navigation.setParams` in the same effect that opens the router) directly targets a real, plausible deep-link reopen-loop bug class in React Navigation params (stale params re-firing on refocus) — good catch, correctly tied to a device-UAT verification row in Plan 06.

**Concerns**
- MEDIUM: as flagged in verification, `guardWidgetIntent`'s current doc-comment ("Allow live Profile opens for either lifecycle state") does **not** match its own code (`archived_at !== null` blocks *all* routes, Profile included, not just Compose). Plan 05's Task 2 read_first correctly instructs reading this file, but its behavior description says "reason `archived` → SILENT drop (no purged message), matching the existing widget Profile policy" — this is *actually accurate to the code* (archived is already blocked everywhere today), but the plan's own citation trail (via the stale comment) could mislead an executor who trusts the comment over the code. Worth a one-line note in the plan to executor: "the code comment is stale — verify against the actual `if` condition, not the docstring."
- LOW: the plan asserts `resolveWidgetUri` and `guardWidgetIntent` are cleanly separable (allow-list parse vs lifecycle guard) — confirmed structurally true from the file, so this is a correct architectural read, not a concern; noting only that the refactor touches a function used by every existing widget intent, so its test surface (Task 2 acceptance criteria) is appropriately broad and should not be trimmed during execution.

---

## Plan 06 (21-06, Wave 4 — consolidation + device UAT)

**Strengths**
- Correctly scheduled as the first wave-safe point to retire the two transitional raw-column reads (ContactProfileScreen from Wave 2, ComposeScreen from Wave 3) onto the canonical `getAppSettings().interactionAssistEnabled` — the dependency ordering (`depends_on: [21-03, 21-04, 21-05]`) is right: it needs 21-04's DAO key to exist and 21-03/21-05's files to have landed before editing them again.
- Explicit "blocked checkpoint, not auto-passable" treatment of owner sign-off and device-dependent handoff-failure rows (a device may always have a compatible app, making a genuine "no compatible app" failure hard to force) is honest engineering — it doesn't pretend automation can close a gap it can't.
- The time-travel strategy for 15s/24h device rows (DEBUG-lowered constants or `run-as` backdating `handoff_at`) is a practical, necessary technique given the alternative (waiting 24 real hours on-device) is untenable — good that it's specified rather than left implicit.

**Concerns**
- LOW: the acceptance criteria for Task 1's raw-read retirement rely on `grep -n "interactionAssistEnabled"` appearing in both screens as proof of the swap — this only proves the *canonical* name appears somewhere, not that the *raw* `interaction_assist_enabled` column read was actually removed. The stated acceptance criterion does also say "neither screen retains a direct raw settings-column read... (verify by reading the two handoff call sites)" — good, this is a manual-read criterion, not a mechanical grep, which is appropriate since a negative-grep for a substring like `interaction_assist_enabled` could false-positive against SQL text elsewhere. No actual defect, just noting the criterion correctly relies on human verification rather than an insufficient grep.
- MEDIUM: this plan is the only one that touches an irreversible migration's real-device gate, and it's a single wave-4 plan bearing the entire owner-signoff + full device matrix. Given the matrix size (16+ scenarios enumerated in Task 2), there's a risk of the human-check becoming a rubber-stamp under time pressure rather than a genuine per-row DB-verified pass — the plan does mandate screenshot + run-as evidence per row, which mitigates this, but it's worth the owner budgeting real time for this gate given its blast radius (migration 014 reaching a real device is a one-way door per CLAUDE.md's forward-only migration rule).

---

## Cross-Plan / Systemic Observations

1. **Local-first invariant**: no plan introduces any network call, telemetry, or remote read/write. All new state (`interaction_assists`, the settings column) is on-device SQLite; the widget deep-link and native handoffs are OS intents, not network egress. **No violation found.**

2. **Single-writer invariant (DATA-04)**: Plan 01's `markAssistLogged` composes `insertInteractionCore` + `recomputeLastContactCore` in one transaction and never calls the mutexed `recordTouchpoint` — verified as architecturally sound against the actual exports. This is the plan set's central correctness bet and it is well-grounded, not hand-waved.

3. **LOG-06 parity**: Plan 01 correctly requires `rejectFutureOccurredAt(handoff_at, now)` before the transaction — verified this mirrors real, existing behavior in `recordTouchpoint` itself (`recency-dao.ts:228`), not an invented guard.

4. **Migration numbering**: `TARGET_VERSION = 13`/migrations-through-013 is confirmed current on disk, so Plan 01's "next migration = 014" is accurate as of this review. Given the phase's own valid-until note ("re-verify before writing the migration — it drifts every schema phase"), this should be re-checked again immediately before Plan 01 actually executes, since other phases may land migrations in the interim.

5. **Cross-phase wiring (merge/purge/widget)**: this is genuinely the highest-risk area per the dossier's own revision log, and Plan 05 correctly treats it as such — the merge-reparent gap is real (verified), and the widget allow-list extension mirrors a real, proven pattern rather than introducing a novel parsing path.

## Risk Assessment

**Overall: MEDIUM**, trending LOW on the mechanical/schema work and MEDIUM on the Wave-3 transitional-state management (raw-read duplication across two files, tracked-but-real settings-flag inconsistency window) and the Wave-4 device-gate execution discipline. The plan set correctly identifies and grounds its own highest-risk decisions (single-writer composition, merge reparent, deep-link allow-list) against real code rather than assumption, which is the strongest evidence of plan quality here. The remaining risk is less about wrong design and more about coordination discipline across a 6-plan, 4-wave brownfield phase: whether the transitional raw-settings-read cleanup actually lands in Wave 4 as promised, and whether the device UAT gate gets the attention its blast radius (irreversible migration 014) warrants.

---

## Verification coverage

Effective authority (drift-guard): **grep** — MISSING resolves to `needs-acknowledgement` (hardBlock:false), AMBIGUOUS→MEDIUM, VERIFIED→none.

### 1. Source-grounding (cited symbols, excluding each plan's "Artifacts this phase produces")

| Symbol / claim | Location | Verdict |
|---|---|---|
| `TARGET_VERSION = 13`, head migration `013` | src/db/database.ts:48,64 | VERIFIED |
| `insertInteractionCore` / `recomputeLastContactCore` exported cores | src/db/recency-dao.ts:414-428 | VERIFIED |
| `recordTouchpoint` applies `rejectFutureOccurredAt` before its txn | src/db/recency-dao.ts:227-231 | VERIFIED |
| `rejectFutureOccurredAt` (LOG-06 guard) | src/db/log-guards.ts:68 | VERIFIED |
| `inWriteTransaction` = single non-reentrant mutex + BEGIN/COMMIT | src/db/transaction.ts:49-64 | VERIFIED |
| merge reparent array omits `interaction_assists` | src/db/merge-dao.ts:153 | VERIFIED |
| merge deletes absorbed contact after reparent | src/db/merge-dao.ts:185 | VERIFIED |
| `updateAppSettings` bumps data-revision; `updateAppSettingsCore` does not | src/db/app-settings-dao.ts:605-606,617 | VERIFIED |
| `PORTABLE_SETTINGS_KEYS` allow-list (digestEnabled analog) | src/backup/backup-schema.ts:106 | VERIFIED |
| `guardWidgetIntent` returns `WidgetNavIntent \| null` (collapses missing+archived) | src/services/widget/widget-quick-action-guard.ts:20-43 | VERIFIED |
| widget URI allow-list `parseWidgetId` (CONTACT_URI/COMPOSE_URI) | src/navigation/widget-linking.ts:91-100 | VERIFIED |
| `full-chain.test.ts` hard-asserts `TARGET_VERSION).toBe(13)` | src/db/migrations/full-chain.test.ts:39 | VERIFIED |
| `merge-dao.test.ts` local MIGRATIONS through 013, migrates to 13 | src/db/merge-dao.test.ts:21,34 | VERIFIED |
| `purge-dao.test.ts` local MIGRATIONS through 011 | src/db/purge-dao.test.ts:54 | VERIFIED |
| Plan 05 frontmatter DOES list `widget-quick-action-guard.ts`(+test) | 21-05-PLAN.md:14-15 | VERIFIED (refutes Codex "files_modified omits guard") |

No load-bearing cited symbol resolved MISSING, AMBIGUOUS, or UNCHECKABLE. No hardBlock MISSING. UNCHECKABLE/skipped: none.

### 2. Cross-artifact fact-drift (advisory — never counts toward the cycle gate)

`drift-guard phase-status --phase 21` → verdict **`lag`** (STATE.md "Ready to execute" rank 1 vs ROADMAP "Not started" rank 0; authority STATE.md). Per the convergence contract, `lag` is ignored (only `drifted` is reported). No judgment-pair contradiction found.

### Reviewer-claim adjudication (verified against code on disk)

- **Codex HIGH (stale merged/purged target):** UPHELD as real but bounded. Plan 01:100,105 re-reads only `status` in-txn; the pre-txn read (unmutexed) captures `contact_id`/`handoff_at`. Worst case post-Plan-05 = FK-abort → rollback → self-heals on retry; not corruption, not a DATA-04 breach. Fix: re-read the full assist row by uid inside the transaction.
- **Codex MEDIUM (Plan 05 files_modified omits widget-quick-action-guard):** REFUTED — the guard and its test ARE in Plan 05 frontmatter (21-05-PLAN.md:14-15) and Task 2 (:130,:146). Not actionable.
- **Codex MEDIUM (Plan 06 autonomous vs owner sign-off):** already reconciled by Plan 06's explicit BLOCKED checkpoints + `<human-check>` under `human_verify_mode=end-of-phase` (Cursor/Claude concur). Not actionable.
- **Claude MEDIUM (Plan 03 raw-read duplication):** explicitly tracked as finding #4 and DEFERRED to Plan 06 read-path consolidation (`depends_on: [21-03,21-04,21-05]`). Deferred in plan → not actionable.
