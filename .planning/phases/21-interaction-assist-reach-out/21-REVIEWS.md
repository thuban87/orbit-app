---
phase: 21
reviewers: [codex, cursor, claude]
reviewed_at: 2026-08-31T20:05:00Z
plans_reviewed: [21-01-PLAN.md, 21-02-PLAN.md, 21-03-PLAN.md, 21-04-PLAN.md, 21-05-PLAN.md, 21-06-PLAN.md]
review_cycle: 4
models:
  codex: "gpt-5.6-terra (reasoning=low)"
  cursor: "unknown"
  claude: "sonnet (reasoning=low)"
model_sources:
  codex: "banner"
  cursor: "unknown"
  claude: "pinned"
---

# Cross-AI Plan Review — Phase 21: Interaction Assist & Reach Out (Cycle 4)

All three lanes ran source-grounded against the code on disk (`CLAUDE_CODE_ENTRYPOINT` runtime-skip
was overridden to `SELF_CLI=none` so the Sonnet `claude -p` lane ran as a distinct model from the
Opus orchestrator). No lane returned an empty/stub result.

## Consensus Summary

Cycle-4 plans are materially stronger than earlier cycles and the prior HIGHs are resolved in the
committed plan text and grounded in real code: transaction non-reentrancy (HIGH-1), the shared
`performReachOut` handoff (cycle-1 HIGH-2), status-guarded idempotency (HIGH-3), the LOG-06
future-date guard before the transaction (cycle-2), and the merge/purge in-transaction re-read
TOCTOU fix (cycle-3) all check out. Two of three reviewers (Cursor, Claude) recommend proceeding to
execution with no new HIGH. Codex raised ONE new HIGH: opt-out clears the SQLite queue but the plans
never wire an in-memory banner-store refresh on an in-place Settings toggle, so the visible banner
can persist until the next AppState transition — contradicting the "off means off" promise the
plan's own threat model (T-21-11, rated high) claims is test-enforced.

### Agreed Strengths
- **Single-writer invariant preserved (all 3).** Confirmation composes `insertInteractionCore` +
  `recomputeLastContactCore` + `bumpDataRevisionCore` in one `inWriteTransaction`, never the mutexed
  `recordTouchpoint`; `recomputeLastContact` (recency-dao.ts:166) remains the sole `last_contact`
  writer (DATA-04). Verified on disk.
- **LOG-06 + TOCTOU fixes correctly targeted (all 3).** `rejectFutureOccurredAt` (log-guards.ts:68)
  runs before the transaction; the in-transaction full-row re-read binds insert/recompute to the
  in-txn `contact_id`, matching merge's reparent-then-delete sequence (merge-dao.ts:154/:185).
- **Migration discipline sound (all 3).** Head is `TARGET_VERSION = 13` (database.ts:48);
  full-chain.test.ts:39 asserts `.toBe(13)`; Plan 01 updates both registration and the fixture in
  lockstep.
- **Widget security grounded (Codex, Cursor, Claude).** Plan 05 extends the anchored allow-list and
  the discriminated `guardWidgetIntent` (widget-quick-action-guard.ts:20) rather than adding a
  parallel parser; the widget remains writer-free.

### Agreed Concerns
- **Device UAT is the true release gate for migration 014 (Cursor, Codex-adjacent).** Irreversible on
  user devices; node tests cannot substitute for native intents / RemoteViews / AppState banner
  timing. Plan 06 handles this honestly with explicit blocked checkpoints — inherent risk, not a plan
  defect.

### Divergent Views
- **Opt-out banner freshness.** Codex rates it HIGH (visible "off means off" gap; no store refresh on
  in-place toggle). Cursor and Claude did not surface it — they verified the DB-clear path and the
  threat-model must-have text without tracing whether the in-memory `useAssistBanner` store is
  actually refreshed on a foreground Settings toggle. Orchestrator verification (below) confirms
  Codex is mechanically correct: the assist-store refreshes only on cold start, AppState
  background→active, and post-resolve — nothing refreshes it on a Settings toggle, and Plan 04's
  SettingsScreen task never calls `store.refresh()`.


## Codex Review

## Summary

The phase is well-structured and materially stronger than earlier cycles. Plan 01 correctly follows the repository’s non-reentrant transaction and recency-core architecture; later plans cover the main cross-phase obligations: merge reparenting, purge cascade, strict widget URI parsing, portable settings, and device-only verification. I found one remaining high-severity execution gap around immediate banner removal after opt-out.

## Strengths

- **Plan 01 preserves the single-writer invariant.** The proposed confirmation path composes `insertInteractionCore`, `recomputeLastContactCore`, and `bumpDataRevisionCore` in one outer transaction, matching the established wrapper’s sequence in [recency-dao.ts](/home/bwales/projects/orbit-app/src/db/recency-dao.ts:232). The exported cores explicitly require an existing transaction and prohibit nesting at [recency-dao.ts](/home/bwales/projects/orbit-app/src/db/recency-dao.ts:414), while nesting would permanently hang under [transaction.ts](/home/bwales/projects/orbit-app/src/db/transaction.ts:12).

- **The future-time and TOCTOU fixes are correctly targeted.** `recordTouchpoint` rejects a future `occurredAt` before opening a transaction at [recency-dao.ts](/home/bwales/projects/orbit-app/src/db/recency-dao.ts:221), and the plan mirrors that guard before composing the cores. Re-reading the assist in-transaction also correctly protects against the current merge sequence, which reparents children before deleting the absorbed contact at [merge-dao.ts](/home/bwales/projects/orbit-app/src/db/merge-dao.ts:153).

- **Migration discipline is sound.** The repository currently ends at migration 013 and `TARGET_VERSION = 13` in [database.ts](/home/bwales/projects/orbit-app/src/db/database.ts:48), with the full-chain test explicitly asserting 13 in [full-chain.test.ts](/home/bwales/projects/orbit-app/src/db/migrations/full-chain.test.ts:37). Plan 01 explicitly updates both registration and the stale fixture assertion.

- **Merge/purge behavior matches the dossier.** The plan adds the new table to merge’s existing reparent mechanism, while purge’s final `DELETE FROM contacts` at [purge-dao.ts](/home/bwales/projects/orbit-app/src/db/purge-dao.ts:261) will honor the proposed FK cascade. This directly implements the dossier’s reparent-before-delete decision.

- **Widget security is grounded in existing controls.** Existing parsing already uses anchored URI patterns and `parseWidgetId`; see [widget-linking.ts](/home/bwales/projects/orbit-app/src/navigation/widget-linking.ts:91). Plan 05 extends that allow-list rather than introducing a separate parser. The existing lifecycle guard currently collapses missing and archived outcomes at [widget-quick-action-guard.ts](/home/bwales/projects/orbit-app/src/services/widget/widget-quick-action-guard.ts:33); the proposed discriminated result is a justified improvement.

- **Plan 04 correctly handles portability and revisioning.** `digestEnabled` currently has to be represented across settings types, mapping, snapshot, and the backup allow-list; [app-settings-dao.ts](/home/bwales/projects/orbit-app/src/db/app-settings-dao.ts:132) and [backup-schema.ts](/home/bwales/projects/orbit-app/src/backup/backup-schema.ts:106) confirm those surfaces. The plan mirrors them and correctly notes that `updateAppSettingsCore` does not bump revisions itself ([app-settings-dao.ts](/home/bwales/projects/orbit-app/src/db/app-settings-dao.ts:610)).

## Concerns

- **HIGH — Plan 04 does not specify a concrete immediate banner-store invalidation when Assist is turned off.** It requires the pending rows to be expired and says the banner “hides at once,” but Settings’ write occurs while the app remains foregrounded. The only existing launch trigger runs on cold start or `background → active` ([launch-sweep.ts](/home/bwales/projects/orbit-app/src/services/launch-sweep.ts:102)), so it cannot refresh the in-memory queue after an in-place settings toggle. Unless `SettingsScreen` explicitly calls an assist-store `refresh()`/`clear()` after successful `setInteractionAssistEnabled(..., 0)`, the banner can continue rendering a stale pending item despite the database being cleared—contradicting “off means off.”

- **MEDIUM — Plan 02’s no-spinner claim conflicts with its proposed data flow.** `ContactProfileScreen` already awaits `listContactMethodGroups` in its unified load at [ContactProfileScreen.tsx](/home/bwales/projects/orbit-app/src/screens/ContactProfileScreen.tsx:230), while Plan 01 defines `deriveReachRoutes(exec, contactId)` as another database read. Plan 02 should not add that second asynchronous route query while claiming the entry derives from the already-awaited method read. It risks a reach-out action flashing late or needing its own loading state.

- **LOW — Plan 06 overstates what on-device DB inspection can prove about the sole writer.** A `run-as` read can prove interaction values and final `last_contact`; it cannot prove that `recomputeLastContactCore` was the only writer. That assurance should remain a structural/code-and-test gate from Plan 01, while UAT documents the observable DB invariants.

## Suggestions

- In Plan 04 Task 1, require this exact post-success behavior: after disabling Assist, call a store action that synchronously clears `queue/newest/morePendingCount` or awaits `useAssistBanner.getState().refresh()`. Add a component/store test proving a visible banner disappears without an AppState transition.

- Change `deriveReachRoutes` to accept the already-loaded `ContactMethodGroups` (or primary-method result) as a pure input. This preserves the intended no-spinner profile behavior and avoids redundant SQLite work.

- Reword Plan 06’s UAT criterion to: “DB evidence proves `occurred_at`, direction, connected, source, and resulting `last_contact`; Plan 01 structural tests prove the authoritative writer composition.”

## Risk Assessment

**MEDIUM**, reduced from prior cycles. The central data-integrity, lifecycle, migration, and deep-link risks are well covered and align with the current repository mechanisms. The remaining high-priority fix is narrow but important: opt-out must immediately clear the rendered banner state, not merely the SQLite rows.

---

## Cursor Review

# Cross-AI Plan Review — Phase 21: Interaction Assist & Reach Out (Cycle 4)

**Reviewed against:** `/home/bwales/projects/orbit-app` on disk (plans in `.planning/phases/21-interaction-assist-reach-out/`, authoritative dossier at `docs/dossier/21-interaction-assist-reach-out.md`).  
**Cycle context:** Cycle 4 of convergence; cycles 1–3 raised mutex nesting, shared handoff divergence, LOG-06 parity, migration-fixture drift, data-revision bump, and merge/purge TOCTOU. This review verifies those fixes in the **current committed plans**, not prior review text.

---

## Phase-Level Assessment

The six-plan set is source-grounded, dossier-aligned, and ready to execute. Plan 21-01 correctly targets the actual migration head (`TARGET_VERSION = 13`, `MIGRATIONS` through `migration013` in `src/db/database.ts:48-64`) and composes the non-mutexed recency cores the way the codebase already documents (`recency-dao.ts:414-428`, `transaction.ts:11-29`). Cycle-3’s merge/purge TOCTOU HIGH is explicitly closed in Plan 21-01 (in-transaction full-row re-read + regression test). Wave ordering is coherent: tracer DAO (W1) → user-visible slice (W2) → parallel completion (W3) → consolidation + device gate (W4). Remaining risks are dependency sequencing (Phase 20), eligibility SQL implementation detail, and device-only surfaces — not architectural gaps in the plans themselves.

**Overall phase risk: LOW–MEDIUM** — correctness hazards are front-loaded into Plan 21-01 with strong acceptance criteria; native handoff, banner timing, and widget render remain honestly deferred to Plan 21-06 device UAT.

---

## Plan 21-01 — TRACER: Migration 014 + Assist DAO

### Summary

Plan 21-01 is the phase’s load-bearing plan. It correctly identifies the #1 invariant risk (a second `contacts.last_contact` writer) and routes confirmation through `insertInteractionCore` + `recomputeLastContactCore` + `bumpDataRevisionCore` inside one outer `inWriteTransaction`, mirroring the exported-core pattern at `recency-dao.ts:414-428` and the non-reentrancy contract at `transaction.ts:11-29`. It restores LOG-06 parity via `rejectFutureOccurredAt` (`log-guards.ts:68`, same pre-transaction shape as `recordTouchpoint` at `recency-dao.ts:227-231`) and closes the cycle-3 TOCTOU by binding insert/recompute to an in-transaction full-row re-read, not a pre-transaction cache.

### Strengths

- **Single-writer path is verified against real exports.** `recordTouchpoint` composes private helpers; the plan correctly uses the aliased cores, not the mutexed wrapper (`recency-dao.ts:217-243` vs `:425-428`).
- **LOG-06 guard is necessary and correctly placed.** Exported cores do not call `rejectFutureOccurredAt`; the plan’s pre-transaction guard matches `recordTouchpoint`’s reject-before-transaction pattern.
- **TOCTOU fix matches merge mechanics on disk.** `mergeContacts` reparents child tables then deletes the absorbed row (`merge-dao.ts:153`, `:185`); the plan’s in-txn `contact_id` bind correctly handles reparent-to-survivor or no-op-if-gone.
- **Migration fixture drift addressed in-plan.** `full-chain.test.ts:37-39` hard-asserts `TARGET_VERSION === 13`; Plan 21-01 includes updating `.toBe(14)` and a version-14 length assertion — verified necessary.
- **Idempotency is status-guarded, not error-sniffing** — appropriate given SQLite driver behavior and the non-reentrant mutex.

### Concerns

- **MEDIUM — Pre-Plan-05 merge window (execution ordering, not plan defect).** Until Plan 21-05 adds `"interaction_assists"` to the reparent array at `merge-dao.ts:153`, a merge without reparent will CASCADE-delete pending assists (`ON DELETE CASCADE` on `contact_id`, per planned migration DDL). Plan 21-01’s TOCTOU handling makes confirmation safe (no orphan interaction); the user may lose a pending prompt. Wave 3 must complete before device UAT (Plan 21-06) — acceptable if waves are atomic, worth noting for any incremental deploy.
- **LOW — Eligibility SQL vs pure logic boundary unspecified.** Task 2 requires SQL and `assist-eligibility.ts` to share `ELIGIBLE_AFTER_SECONDS` / `EXPIRE_AFTER_HOURS` against `handoff_at`, but does not explicitly require computing cutoff timestamps in JS and binding them as `?` params. Lexicographic compare works for `YYYY-MM-DD HH:MM:SS`, but parameterized cutoffs are safer than SQLite datetime functions on string columns.

### Suggestions

- In Task 2 action text, add one line: compute `eligibleAfter` / `expireBefore` strings in JS from `now` + shared constants, bind as `?` in `listEligiblePendingAssists`.
- Keep the TOCTOU regression test exactly as specified — it is the cheapest proof that cycle-3’s HIGH stays closed.

### Risk Assessment

**LOW** — The plan’s acceptance criteria (grep gates, TOCTOU test, LOG-06 test, full-chain bump) are sufficient to catch the phase’s highest correctness hazards before UI work expands.

---

## Plan 21-02 — Reach Out Router + Banner + Profile Entry

### Summary

Plan 21-02 delivers the first user-visible vertical slice: shared router, write-before-handoff ordering, non-modal app-global banner, and profile entry. It correctly centralizes native launch in one `performReachOut` helper (addressing cycle-1 HIGH-2), follows existing SMS patterns in `ComposeScreen.tsx:436-458`, and mounts the banner in the ready `NavigationContainer` subtree after `RootNavigator` (`App.tsx:291-303`). Widget freshness via `notifyWidgetDataChanged()` matches established callers (`ContactProfileScreen.tsx:336`, `notification-actions.ts:161`).

### Strengths

- **`performReachOut` as single handoff** — eliminates duplicated create/fail/Alert logic between router and Compose (Plan 21-03).
- **Failed-handoff semantics match shipped Compose behavior.** `ComposeScreen.tsx:446-448` already treats resolved `sendSMSAsync` as non-failure; plan extends that to Call/Email and forbids `canOpenURL`.
- **Banner architecture respects Cluster H.** Explicit prohibition of `Modal` in `AssistBanner.tsx`; overlay in `App.tsx` after navigator.
- **Canonical handoff value pinned.** Plan requires `canonical_value` via `actionablePrimaryPhoneDestination` (`compose-logic.ts:51-57`), not `display_value` — verified against shipped Compose destination logic.
- **AppState refresh separate from launch sweep** — mirrors `installSweepTrigger` pattern (`launch-sweep.ts:14-17`, `App.tsx:244`) without conflating once-per-launch sweep with every foreground return.

### Concerns

- **LOW — Transitional raw `interaction_assist_enabled` read.** Task 3 reads the column directly until Plan 21-04/21-06 land the canonical getter. Plan 21-04/21-06 track cleanup; acceptable within wave structure.
- **LOW — Assist toggle read timing on profile open.** If settings change between opening router and handoff, behavior follows value at handoff time — consistent with user-initiated model; no plan gap.

### Suggestions

- When implementing `assist-store`, initialize to empty/null (no spinner) as specified — matches dashboard patterns and avoids flash.
- Ensure `performReachOut` stamps `endpoint_value` from the same `canonical_value` passed to native intents (operational context only, Cluster D).

### Risk Assessment

**LOW–MEDIUM** — UI/banner/back-button behavior is device-UAT-only (Plan 21-06); node-testable handoff ordering and store transitions are well specified.

---

## Plan 21-03 — Endpoint Selector + Compose Send Seam

### Summary

Plan 21-03 completes the ≤3-tap routing contract and wires Compose Send into the shared assist lifecycle per dossier Cluster AC (`docs/dossier/21-interaction-assist-reach-out.md:573-591`). It reuses `listContactMethodGroups` (`contact-methods-read.ts:7-23`) and routes `onSend` through `performReachOut` with `messageBody: draft` instead of direct `SMS.sendSMSAsync` (`ComposeScreen.tsx:446` today). Compose continues to write no interaction at Send time — verified current behavior at `ComposeScreen.tsx:435`.

### Strengths

- **Cluster AC [DECIDED] correctly retained** with explicit decision block citing dossier lines — Send→assist→confirm, not direct interaction write.
- **Wave-3 parallelization with 21-04 is sound.** Raw column read for `assistEnabled` avoids serializing on DAO key; Plan 21-06 consolidates to `getAppSettings().interactionAssistEnabled`.
- **Endpoint selector uses canonical_value for handoff, display_value for labels** — matches `ContactMethodRow` shape and Compose precedent.
- **No scope creep into email compose** — email remains native `mailto:` handoff per Cluster AD.

### Concerns

- **LOW — Compose failure Alert body text changes.** Shared UI-SPEC copy replaces Compose’s current body `"Your message is ready to copy instead."` (`ComposeScreen.tsx:451-453`). Plan documents this as deliberate consolidation; Copy fallback remains — owner-visible UX delta, not a correctness issue.
- **LOW — Wave-3 file ownership is disjoint** — verified: 21-03 touches `EndpointSelector`, `ReachOutRouter`, `ComposeScreen`; no overlap with 21-04/21-05 `files_modified`.

### Suggestions

- Preserve Compose’s `sending` latch around `performReachOut` as specified — prevents double composer launch (existing guard at `ComposeScreen.tsx:437-438`).
- Add the M2 Phase 12 seam comment as planned — documents ownership without deferring Cluster AC work.

### Risk Assessment

**LOW** — Narrow, additive UI + one handler change; grep acceptance criteria prevent reintroducing direct interaction writes.

---

## Plan 21-04 — Settings Toggle + Review Sheet + Launch Sweep

### Summary

Plan 21-04 completes the durable-queue lifecycle: default-on toggle with off-clears-queue, `{N} more pending` review surface, and timer-free launch-sweep prune. Settings wiring follows the proven `digestEnabled` pattern (`app-settings-dao.ts:252-276`, migration idiom in `005-digest-settings.ts:39+`). The plan correctly notes that `updateAppSettingsCore` does not bump revision (`app-settings-dao.ts:610-616`) while `updateAppSettings` does (`:604-607`), and requires `bumpDataRevisionCore` in `setInteractionAssistEnabled`.

### Strengths

- **Backup portability specified.** `interactionAssistEnabled` in `PortableSettingsSnapshot` + `PORTABLE_SETTINGS_KEYS` (`backup-schema.ts:106-113`) — mirrors `digestEnabled`.
- **“Off means off” is one transaction** — settings update + expire all pending + single revision bump.
- **Sweep follows project no-scheduler rule** — `registerSweepHook` (`launch-sweep.ts:45`), no `setTimeout`; 24h bound on `handoff_at` matches eligibility canonical field.
- **Double-expiry integration test (cap-5 + sweep)** — addresses composition risk between write-time prune and launch expiry.
- **Joint AppState test** — sweep once-per-launch vs banner every `background→active`; prevents clobbering (`App.tsx:244` sweep trigger vs planned assist-store subscription).

### Concerns

- **LOW — 21-04 extends files also touched by 21-02 (`assist-store.ts`, `AssistBanner.tsx`, `App.tsx`).** Plan 21-04’s `decisions` block correctly states 21-04 is Wave 3 **after** Wave 2 21-02 — sequential extension, not a race.
- **LOW — `interaction_assists` excluded from backup/export** (operational state). Consistent with Cluster X (`docs/dossier/21-interaction-assist-reach-out.md:493-503`); permanent history lives in `interactions`.

### Suggestions

- Reuse `EXPIRE_AFTER_HOURS` from `assist-eligibility.ts` in the sweep module as specified — single tuning point.
- Ensure `setInteractionAssistEnabled` validation runs before txn open, mirroring `updateAppSettings` at `app-settings-dao.ts:601-604`.

### Risk Assessment

**LOW** — Well-trodden settings/sweep patterns; acceptance tests cover the subtle revision-bump and cap-5/sweep composition.

---

## Plan 21-05 — Merge Reparent + Purge Cascade + Widget Contact

### Summary

Plan 21-05 is the cross-phase correctness core. It adds `"interaction_assists"` to the reparent loop that currently omits it (`merge-dao.ts:153` — verified: array is `interactions`, `events`, `fuel`, etc., no `interaction_assists`), relies on CASCADE for purge (no `purge-dao.ts` change — purge deletes contact at `:261`), swaps widget Message→Contact (`widget-render.tsx:452-459` today emits `orbit://compose/${tile.id}`), and adds `orbit://reach/<id>` following the anchored allow-list pattern (`widget-linking.ts:91-105`).

### Strengths

- **Merge reparent matches dossier Cluster AA** — survivor redirect at merge time, not lazy lookup at confirmation.
- **Widget remains writer-free** — `widget-task-handler.tsx:78-83` confirms OPEN_URI writes nothing headless.
- **Discriminated `guardWidgetIntent` refactor** — enables purged (`missing`) vs archived UX split while preserving existing Profile/Compose/Favourites outcomes (`widget-quick-action-guard.test.ts:14-56` documents current behavior).
- **Migration fixture bumps explicit** — `merge-dao.test.ts:21,34` (migrations through 013, target 13) and `purge-dao.test.ts:54-70` (through 011) must reach 014 for assist tests — plan addresses cycle-3 MEDIUM.
- **`openReachOut` consume-once** — prevents widget deep-link reopen loop; device-verified in Plan 21-06.
- **`files_modified` includes guard files** — cycle-3 omission corrected (`widget-quick-action-guard.ts` + test).

### Concerns

- **MEDIUM — Phase 20 roadmap dependency.** `.planning/ROADMAP.md:920` lists Phase 21 depending on Phase 20; progress table shows Phase 20 incomplete, yet `mergeContacts` already ships (`merge-dao.ts:92+`). Plan 21-05’s reparent addition is correct regardless, but merge redirect only matters when users can merge. Confirm Phase 20 merge UI/path is usable before relying on Cluster AA in production.
- **LOW — Stale guard doc comment.** `widget-quick-action-guard.ts:16-17` says Profile allows “either lifecycle state,” but `:34-35` blocks archived for all routes. Plan behavior (archived → silent drop) matches **code**, not comment — executor should trust the `if`, not the docstring.
- **LOW — Unbound widget Contact → Reach Out.** Current guard allows Unbound Profile (`widget-quick-action-guard.test.ts:28-30`); REACH intent uses Profile + `openReachOut` — aligns with dossier Cluster Y (`docs/dossier/21-interaction-assist-reach-out.md:513`).

### Suggestions

- Add one executor note in Task 2: “ignore stale doc comment at `widget-quick-action-guard.ts:16-17`; archived contacts are blocked for all widget routes today.”
- In `WidgetLinkingGate` (`widget-linking.ts:222-234`), branch on REACH vs non-REACH when mapping discriminated guard results — plan specifies this; ensure tests cover `orbit://contact/` (silent drop) vs `orbit://reach/` (purged message) for `reason: 'missing'`.

### Risk Assessment

**LOW–MEDIUM** — Security-sensitive deep-link surface follows proven patterns; merge dependency is the main sequencing caveat.

---

## Plan 21-06 — Full-Suite Gate + Pixel UAT

### Summary

Plan 21-06 closes device-only gaps honestly: full node gate, consolidation of transitional settings reads onto `getAppSettings().interactionAssistEnabled`, driven Pixel matrix with run-as DB verification, explicit BLOCKED checkpoints for owner sign-off and genuine handoff-failure cases, and documented time-travel for 15s/24h rows.

### Strengths

- **Raw-read retirement is wave-safe.** ContactProfileScreen (21-02) and ComposeScreen (21-03) edits land in Wave 2/3; consolidation in Wave 4 avoids same-wave conflicts — correct.
- **DB verification requirement** — aligns with CLAUDE.md “Review the code, not the diff”; UI render alone insufficient.
- **Time-travel strategy** — pragmatic for 15s buffer / 24h expiry without flaking device tests.
- **Widget reopen-loop + freshness rows** — closes cycle-3/4 findings #1 and #5 with behavioral verification.

### Concerns

- **MEDIUM — Device UAT is the real release gate for migration 014.** Irreversible on user devices; node tests cannot substitute for native intents, AppState banner timing, or RemoteViews render.
- **LOW — Handoff-failure rows may be BLOCKED on a device that always has dialer/messages/mail.** Plan correctly marks these as owner checkpoints, not auto-pass.

### Suggestions

- Record per-row time-travel technique in `21-UAT.md` as specified — aids future regression.
- After banner confirmation, verify `occurred_at === handoff_at`, `source='assist'`, and `connected` per action via run-as — plan already requires this.

### Risk Assessment

**MEDIUM** (inherent to device gate, not plan quality) — Plan structure is appropriate; residual risk is execution/evidence capture, not missing scenarios.

---

## Cross-Cutting Verification (Cycle 4)

| Invariant | Status | Evidence |
|-----------|--------|----------|
| DATA-04 single writer | **Plan OK** | Cores at `recency-dao.ts:425-428`; sole `last_contact` UPDATE in `recomputeLastContact` `:164-175` |
| No mutex nesting | **Plan OK** | `transaction.ts:11-17`; plan forbids calling `recordTouchpoint` from `markAssistLogged` |
| LOG-06 future-date guard | **Plan OK** | `rejectFutureOccurredAt` at `log-guards.ts:68`; `recordTouchpoint` precedent `:227-231` |
| Merge/purge TOCTOU | **Addressed in Plan 21-01** | In-txn full re-read + test; reparent in Plan 21-05 at `merge-dao.ts:153` |
| Migration 014 = TARGET 14 | **Plan OK** | Head is 13 (`database.ts:48`); `full-chain.test.ts:39` update in Plan 21-01 |
| Local-first / no passive monitoring | **Plan OK** | No network, permissions, or observation paths in any plan |
| Dossier alignment | **Plan OK** | Cluster AC, AA, AB, E, G, H, J, etc. reflected; no `[DECIDED]` reversals found |
| Widget no assist writer | **Plan OK** | `widget-task-handler.tsx:78-83`; deep-link only |

---

## Residual Items for Planner/Owner (Not Blockers)

1. **Confirm Phase 20 merge is executable** before treating Cluster AA redirect as user-testable (merge DAO exists; roadmap phase checkbox may lag).
2. **Parameterize eligibility SQL cutoffs in JS** (Plan 21-01 Task 2) — one sentence in the plan reduces executor ambiguity.
3. **Note stale guard doc comment** for Plan 21-05 executors.

---

## Convergence Verdict

**Cycle 4 plans absorb cycle-3 findings.** The prior HIGH (merge/purge TOCTOU), cycle-2 HIGH (LOG-06), cycle-1 HIGHs (shared handoff, idempotency), and MEDIUMs (full-chain fixture, data-revision bump, canonical_value, guard files in `files_modified`) are present in the committed plan text and grounded in verified source locations.

**Recommendation:** Proceed to execution. No new HIGH findings. Remaining concerns are LOW–MEDIUM execution hygiene and the expected device/UAT gate in Plan 21-06.

---

## Claude Review

## Summary

I verified the plans' load-bearing claims directly against the repo (not just the plan text). Cycles 1–3 findings (transaction nesting, LOG-06 future-date guard, merge/purge TOCTOU) are correctly resolved in the current plan text and match the real code shape:

- `src/db/database.ts:48` — `TARGET_VERSION = 13` confirmed (migration 014 not yet applied, as expected pre-execution).
- `src/db/recency-dao.ts:426-428` — exports `insertInteractionCore`, `recomputeLastContactCore` exactly as the plans describe; `recordTouchpoint` (the mutexed wrapper) is separate and correctly avoided by `markAssistLogged`.
- `src/db/log-guards.ts:68` — `rejectFutureOccurredAt` exists exactly as cited.
- `src/db/transaction.ts:1-29` — the non-reentrancy doc block confirms the "never nest `inWriteTransaction`" constraint the plans build around.
- `src/db/merge-dao.ts:153` — reparent array matches exactly what the plans cite; adding `"interaction_assists"` is the correct minimal fix.
- `src/db/app-settings-dao.ts` — the `digestEnabled` analog sites and the fact that `updateAppSettingsCore` does *not* self-bump `data_revision` are both confirmed, validating Plan 04's data-revision-bump requirement.
- `src/services/widget/widget-quick-action-guard.ts:20-43` — current `guardWidgetIntent` really does collapse "missing" and "archived" into one `null` return, confirming Plan 05's discriminated-result refactor is necessary, real work.
- `src/db/migrations/full-chain.test.ts:39` — the hard-coded `TARGET_VERSION` assertion is exactly where Plan 01 says it is.

No new HIGH/MEDIUM findings surfaced this cycle beyond what's already tracked in the plans' own decision logs. One low-severity observation: the TOCTOU fix in `markAssistLogged` is scoped/tested against merge and purge (the only two contact-deletion paths today) but generalizes correctly to any future path since it always re-reads inside the transaction — not a defect, just a scope note.

**Risk Assessment: LOW.** The plans' claims check out against the actual source; the architecture (single-writer composition, non-nested transactions, in-txn re-reads for TOCTOU safety, discriminated guard results) is sound and traceable to real code, not aspirational.

---

## Verification Coverage

Orchestrator passes run after the CLI reviews, per the convergence contract.

### 1. Source-grounding (authority: `grep`)

Every load-bearing symbol the plans cite (excluding each plan's own "Artifacts this phase produces")
was grepped against the code on disk. Severity gate: a MISSING under grep authority is
`needs-acknowledgement` (`hardBlock:false`); no MISSING was found, so no hardBlock HIGH arises here.

| Symbol | Verdict | Evidence |
|--------|---------|----------|
| `TARGET_VERSION = 13` | VERIFIED | src/db/database.ts:48 |
| `insertInteractionCore` | VERIFIED | src/db/recency-dao.ts:426 |
| `recomputeLastContactCore` | VERIFIED | src/db/recency-dao.ts (export); sole `SET last_contact` writer at recency-dao.ts:166 |
| `recordTouchpoint` (mutexed wrapper) | VERIFIED | src/db/recency-dao.ts:217 |
| `rejectFutureOccurredAt` (LOG-06) | VERIFIED | src/db/log-guards.ts:68 |
| `bumpDataRevisionCore` | VERIFIED | src/db/data-revision-dao.ts:5 |
| merge reparent array (omits `interaction_assists`) | VERIFIED | src/db/merge-dao.ts:154 (array), :185 `DELETE FROM contacts` |
| purge `DELETE FROM contacts` (cascade) | VERIFIED | src/db/purge-dao.ts:261 |
| `listContactMethodGroups` | VERIFIED | src/db/contact-methods-read.ts:7 |
| `listActionablePrimaryMethods` | VERIFIED | src/db/contact-methods-read.ts:30 |
| `updateAppSettingsCore` (no self-bump) | VERIFIED | src/db/app-settings-dao.ts:605 |
| `PORTABLE_SETTINGS_KEYS` | VERIFIED | src/backup/backup-schema.ts:106 |
| `guardWidgetIntent` (collapses missing/archived) | VERIFIED | src/services/widget/widget-quick-action-guard.ts:20 |
| widget-linking anchored `orbit://` allow-list | VERIFIED | src/navigation/widget-linking.ts |
| full-chain fixture `.toBe(13)` / version===13 | VERIFIED | src/db/migrations/full-chain.test.ts:37-39 |
| `notifyWidgetDataChanged` | VERIFIED | src/services/widget/widget-refresh.ts:16 |
| `installSweepTrigger` / `registerSweepHook` | VERIFIED | src/services/launch-sweep.ts:19 |
| `actionablePrimaryPhoneDestination` (canonical) | VERIFIED | src/logic/compose-logic.ts:51 |
| widget Message action emits `orbit://compose/{id}` (swap target for 05) | VERIFIED | src/services/widget/widget-render.tsx:458 |
| `inWriteTransaction` non-reentrancy contract | VERIFIED | src/db/transaction.ts:4-21 |

**UNCHECKABLE / not independently re-verified:** device-only surfaces (native Call/Text/Email
intents, RemoteViews render, AppState banner timing) cited by Plan 06 — these are device-UAT
observations, not statically grep-able, and are correctly deferred to Plan 06's Pixel matrix.

No MISSING or AMBIGUOUS symbols. All 20 statically checkable cited symbols VERIFIED.

### 2. Cross-artifact fact-drift (advisory — never counts toward findings)

`drift-guard phase-status --phase 21` → verdict **`lag`** (STATE.md "Ready to execute" rank 1 vs
ROADMAP "Not started" rank 0; authority STATE.md). Per the convergence contract, `lag` is ignored
(not `drifted`); STATE.md is authoritative and the roadmap checkbox simply trails pre-execution. No
judgment-pair contradiction.

---

## Cycle-4 Convergence Verdict

**1 new HIGH, 1 actionable non-HIGH.** The three prior-cycle HIGHs remain resolved and grounded. The
new HIGH is a genuine, verified gap between the "off means off" mitigation the plan asserts
(must-have 21-04:32; threat T-21-11 rated high, "test-enforced") and the mechanism actually
specified: no in-memory banner-store refresh is wired or tested for an in-place Settings toggle-off,
so the SQLite queue clears but the visible banner can persist until the next AppState transition. The
actionable non-HIGH is a cross-plan seam on `deriveReachRoutes` (21-01 defines it as its own DB read;
21-02's no-flash must-have assumes it derives from already-loaded method data). Remaining items
(eligibility-SQL cutoff wording, a stale guard docstring, and a Plan-06 sole-writer UAT-wording
overclaim) are polish already substantively covered elsewhere and are not counted.
