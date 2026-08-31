---
phase: 21
reviewers: [codex, cursor, claude]
reviewed_at: 2026-08-31T18:28:15Z
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

# Cross-AI Plan Review — Phase 21: Interaction Assist & Reach Out

Three independent source-grounded reviewers (Codex, Cursor, headless Claude/Sonnet) reviewed all six plans against the code on disk. All three verified their citations against the repo rather than reviewing plan text in isolation; the orchestrator independently re-verified every load-bearing cited symbol (see **Verification coverage** at the end). The claude lane was run at the owner's explicit authorization this cycle (Sonnet, a distinct model from the Opus orchestrator, headless with no shared context).

## Consensus Summary

The plan set is unusually well-grounded: TARGET_VERSION=13 / migration 013 as head (so 014 is the correct next number), the `recordTouchpoint` single-writer routing, the `mergeContacts` reparent array, the `purgeContact` explicit fan-out, the widget deep-link allow-list, and the Compose no-write-at-handoff seam all match what is actually on disk. All three reviewers independently confirmed the plans **enforce** rather than reverse the dossier's [DECIDED] clusters (Z archived-still-loggable, AA merge-reparent, AB purge-at-deletion, AC Compose-no-write, F failed-handoff=launch-failure-only). No decision reversal was found. The 6-plan / 4-wave tracer-first structure correctly sequences the data spine before UI and treats merge/purge/widget cross-phase wiring as the real risk surface.

The concentrated risk is a small number of **implementation-precision gaps the plans almost but do not fully nail**, all in the confirm/handoff path, plus inherently device-limited native-handoff observability.

### Agreed Strengths
- **Single-writer discipline** — all confirmed writes route through `recordTouchpoint` (`src/db/recency-dao.ts:217`); no second `interactions`/`last_contact` writer is introduced. Grep-gated in acceptance criteria across every plan that touches the writer. (all three)
- **Migration grounding** — 014 is correctly the next number; ALTER/two-arg `apply` idioms match shipped migrations. (Codex, Cursor)
- **Merge reparent fix is correctly scoped** — adding `interaction_assists` to the `merge-dao.ts:153` loop before the `DELETE FROM contacts` at `:185` closes a real cascade-loss hole. (all three)
- **Widget allow-list extension mirrors the existing security boundary** — anchored regex + `parseWidgetId` safe-integer guard (`widget-linking.ts:91-106`). (all three)
- **Nested-transaction hazard is identified** — every plan sequences `recordTouchpoint` then a separate status UPDATE rather than nesting. (all three)

### Agreed Concerns
- **`markAssistLogged` transaction shape is ambiguous (HIGH — Codex + Cursor).** Plan 01 Task 1 says "every write uses `inWriteTransaction` for its own multi-statement unit" while also calling `recordTouchpoint`, which itself opens `inWriteTransaction` (`recency-dao.ts:232`), a non-reentrant mutex whose own docstring warns nesting is "a PERMANENT hang" (`transaction.ts:15-17`). `21-PATTERNS.md:72-74` still says "SAME transaction," compounding the ambiguity. An executor who wraps load→`recordTouchpoint`→status-UPDATE in one txn will deadlock.
- **Compose/router handoff is not specified as one shared implementation (HIGH — Codex; MEDIUM — Cursor).** Plan 02's `performReachOut` sends an empty SMS body; Plan 03 both says "route through the shared helper" and separately instructs a direct `createPendingAssist` + `SMS.sendSMSAsync(phone, draft)`. One reading loses the Compose draft, the other duplicates handoff/failure logic.
- **Native "failure" is only launch-failure, never delivery (MEDIUM).** `SMS.sendSMSAsync` returns `unknown` on Android (dossier Cluster F, line 165); plans must not interpret a resolved SMS result as failure. (Codex, Cursor)
- **Widget-freshness after confirmation is missing (MEDIUM — Cursor).** Other foreground `recordTouchpoint` paths call `notifyWidgetDataChanged()` (`notification-actions.ts:161`); Plans 02/04 do not after `markAssistLogged`.

### Divergent Views
- **Idempotency mechanism (Claude HIGH; others silent).** Only Claude escalated Plan 01's UNIQUE-constraint-catch strategy for `markAssistLogged` crash recovery as HIGH: no in-repo precedent exists for distinguishing a SQLite UNIQUE error from any other thrown error, and the error shape differs between the node testkit and on-device Hermes/expo-sqlite (the exact shape of a bug this project has hit before). Recommended a status-guarded check-then-write instead. Codex/Cursor flagged the transaction shape but not the error-detection mechanism.
- **Overall risk rating.** Codex: MEDIUM-HIGH. Cursor: MEDIUM. Claude: LOW-MEDIUM. All agree the gaps are small plan amendments, none reversing a recorded decision, resolvable before Wave 1 lands.

---

## Codex Review

## Summary

The phase is well decomposed: it establishes the schema/DAO tracer first, then the user flow, then settings/lifecycle and merge/widget wiring, ending with device UAT. It correctly reuses the existing recency writer rather than adding another `last_contact` path. However, two implementation ambiguities are serious enough to fix before execution: the Plan 01 transaction boundary around `recordTouchpoint`, and the Plan 03 Compose handoff path.

## Strengths

- The migration plan is correctly grounded in the current schema head: `TARGET_VERSION` is 13 and migration 013 is the final registered migration in [database.ts](/home/bwales/projects/orbit-app/src/db/database.ts:48), [database.ts](/home/bwales/projects/orbit-app/src/db/database.ts:64). App startup also sets WAL, foreign keys, and busy timeout before migrations in [database.ts](/home/bwales/projects/orbit-app/src/db/database.ts:133).

- Plans 01 and 05 correctly identify the authoritative recency mechanism. `recordTouchpoint()` inserts the interaction, recomputes `last_contact`, and bumps the revision in one transaction at [recency-dao.ts](/home/bwales/projects/orbit-app/src/db/recency-dao.ts:217). The actual direct `last_contact` update is internal to that DAO at [recency-dao.ts](/home/bwales/projects/orbit-app/src/db/recency-dao.ts:195).

- Plan 05’s merge reparent is essential and correctly targeted. The existing merge code only reparents the listed child tables at [merge-dao.ts](/home/bwales/projects/orbit-app/src/db/merge-dao.ts:153), then deletes the absorbed contact at [merge-dao.ts](/home/bwales/projects/orbit-app/src/db/merge-dao.ts:184). Adding `interaction_assists` there is the correct way to preserve pending confirms after a merge.

- The widget plan builds on a real strict allow-list. Current widget routes use anchored regexes and safe positive-integer parsing at [widget-linking.ts](/home/bwales/projects/orbit-app/src/navigation/widget-linking.ts:91) and [widget-linking.ts](/home/bwales/projects/orbit-app/src/navigation/widget-linking.ts:100). Extending this pattern for `orbit://reach/<id>` is sound.

- The endpoint design matches existing data semantics. `listActionablePrimaryMethods()` already chooses an actionable primary or first actionable ordered method at [contact-methods-read.ts](/home/bwales/projects/orbit-app/src/db/contact-methods-read.ts:30), and the method grouping query preserves display order at [contact-methods-read.ts](/home/bwales/projects/orbit-app/src/db/contact-methods-read.ts:7).

- Plan 02’s use of a non-modal overlay is appropriate. The existing widget gate demonstrates app-shell, asynchronous navigation handling rather than modal routing at [widget-linking.ts](/home/bwales/projects/orbit-app/src/navigation/widget-linking.ts:213). This supports the requirement that Android Back not dismiss the durable prompt.

## Concerns

- **HIGH — Plan 01 is internally ambiguous about transactions and can deadlock.** Its text says `markAssistLogged` should use `inWriteTransaction` for its multi-statement operation, while also calling `recordTouchpoint`. But `recordTouchpoint` itself calls `inWriteTransaction` at [recency-dao.ts](/home/bwales/projects/orbit-app/src/db/recency-dao.ts:232), and that primitive explicitly forbids nesting because it permanently hangs on the shared non-reentrant mutex at [transaction.ts](/home/bwales/projects/orbit-app/src/db/transaction.ts:49).  
  The plan mentions the danger, but its requested implementation must be made unequivocal: no outer transaction may wrap the `recordTouchpoint` call.

- **HIGH — Plan 03 does not actually specify one shared Compose handoff implementation.** Existing Compose calls `SMS.sendSMSAsync(phone, draft)` directly at [ComposeScreen.tsx](/home/bwales/projects/orbit-app/src/screens/ComposeScreen.tsx:436). Plan 02’s proposed `performReachOut` example sends `""` as the body; Plan 03 both says “route through the shared helper” and separately instructs direct `createPendingAssist` + `SMS.sendSMSAsync`. One interpretation loses the draft; the other duplicates handoff/failure logic. This is a correctness and maintenance risk.

- **MEDIUM — Plan 01’s deterministic interaction UID needs an explicit compatibility check with restore semantics.** Production code outside `recency-dao` also writes interactions during restore using `INSERT ... ON CONFLICT(uid) DO UPDATE` at [restore-apply.ts](/home/bwales/projects/orbit-app/src/backup/restore-apply.ts:170). A deterministic `reachout:${assist.uid}` is reasonable, but the plan should test restore/import of an assist-created interaction and document whether restored assist rows are in scope. Otherwise a restore can alter the idempotency assumptions.

- **MEDIUM — “failed handoff” should distinguish only launch failure from an SMS composer result.** Current Compose deliberately treats Android’s `SMS.sendSMSAsync` result as unknown and does not claim send success at [ComposeScreen.tsx](/home/bwales/projects/orbit-app/src/screens/ComposeScreen.tsx:446). The plans mostly preserve this, but Plan 02 should explicitly prohibit interpreting any resolved SMS result as a failure or delivery outcome.

- **MEDIUM — Plan 05’s purged-target UI requires a deliberate navigation/message mechanism, not merely a null guard.** The current `WidgetLinkingGate` discards every null-guarded intent silently at [widget-linking.ts](/home/bwales/projects/orbit-app/src/navigation/widget-linking.ts:232). `guardWidgetIntent` also returns null for both missing and archived contacts at [widget-quick-action-guard.ts](/home/bwales/projects/orbit-app/src/services/widget/widget-quick-action-guard.ts:33). The plan needs a typed “guard failure reason” or an explicit pre-guard lookup so it can show “no longer available” only for purged/missing Reach targets, without incorrectly treating archived contacts as purged.

- **MEDIUM — Plan 02’s “no loading frame because SQLite is synchronous” is inaccurate.** The database APIs are async throughout, including `listContactMethodGroups()` at [contact-methods-read.ts](/home/bwales/projects/orbit-app/src/db/contact-methods-read.ts:7). Avoiding a spinner may be a UX decision, but the implementation still needs a defined initial state and must avoid briefly rendering a hidden/unreachable route before the method read completes.

- **LOW — Eligibility and sweep timestamps should use one canonical reference field.** The plans use `handoff_at` for the 15-second eligibility buffer but `created_at` for the 24-hour bound. Creation and handoff are usually close, but the invariant is clearer and less clock-skew-sensitive if both use `handoff_at`, which is already the phase’s source of truth for interaction time.

- **LOW — Plan 06 is a good gate but its UAT matrix is larger than the plan can autonomously complete.** Owner sign-off and device-dependent failed-email/call launch scenarios are legitimate human/device gates. The plan should mark these as explicit blocked checkpoints instead of implying every row can always be forced by automation.

## Suggestions

- Revise Plan 01’s `markAssistLogged` algorithm to:

  1. Read the pending assist without an outer write transaction.
  2. Call `recordTouchpoint()` directly.
  3. On success or unique-UID retry, run a separate status-guarded `inWriteTransaction` update.
  4. Add a test for the crash window between those two steps.

- Make `performReachOut` accept `messageBody?: string`. Then both router Text and Compose call the same helper; router passes an empty body and Compose passes `draft`. Keep the existing in-flight latch from [ComposeScreen.tsx](/home/bwales/projects/orbit-app/src/screens/ComposeScreen.tsx:431) around the shared call.

- Refactor widget guard output from `WidgetNavIntent | null` to a discriminated result such as `{ intent } | { reason: "missing" | "archived" | "ineligible" }`. This makes the required purged-target message reliable and avoids conflating lifecycle states.

- Add integration tests beyond DAO unit tests for:
  - assist creation → merge → confirmation writes against survivor;
  - assist creation → archive → confirmation remains loggable;
  - restore behavior for deterministic assist interaction UIDs;
  - Compose draft preservation through the shared helper.

## Risk Assessment

**Overall: MEDIUM-HIGH.** The architectural direction is strong and the main cross-phase risks are identified correctly. But the transaction composition issue can cause a permanent hang, and the Compose helper ambiguity can either duplicate behavior or discard message text. Resolve those before execution; the remaining work is appropriately scoped and well testable.


---

## Cursor Review

# Cross-AI Plan Review — Phase 21: Interaction Assist & Reach Out

Verified against repo head: `TARGET_VERSION = 13` (`src/db/database.ts:48`), no migration 014 on disk, `mergeContacts` reparent loop at `src/db/merge-dao.ts:153` without `interaction_assists`, widget Message action still emits `orbit://compose/` (`src/services/widget/widget-render.tsx:452-458`), Compose `onSend` writes no assist (`src/screens/ComposeScreen.tsx:436-458`).

---

## Plan 21-01 — TRACER (migration 014 + assist DAO)

### Summary

The tracer plan correctly anchors the phase on the highest-risk invariant — routing confirmations through `recordTouchpoint` (`src/db/recency-dao.ts:217-243`) rather than opening a second `interactions` / `last_contact` writer. Schema shape, cap-5 pruning, deterministic interaction uid, and pure 15s/24h eligibility are well specified and node-testable before UI work.

### Strengths

- **Single-writer discipline is explicit and grep-enforced.** Plan prohibitions align with `recency-dao.ts:148-149` (“ONLY statement… that writes `contacts.last_contact`”) and the only production `INSERT INTO interactions` path outside tests is `insertInteraction` in `recency-dao.ts:194-212`.
- **Mutex non-reentrancy is called out.** Plan 01 `read_first` cites `transaction.ts:11-17` and instructs sequencing the assist-status UPDATE after `recordTouchpoint` returns — matching the documented permanent-hang hazard.
- **Migration idiom matches shipped code.** `005-digest-settings.ts:39-41` ALTER pattern and `013-reconciliation-and-merge.ts` two-arg `apply` are the right templates; `localDateTime()` at `database.ts:74-78` matches the timestamp contract.
- **Route derivation reuses real reads.** `listActionablePrimaryMethods` (`contact-methods-read.ts:30-39`) and `listContactMethodGroups` (`:7-23`) exist and implement the phone/email-granular actionable model the dossier requires.
- **Tracer-first wave ordering is sound.** Proving handoff-time `occurred_at` and cap-5 at the DAO layer before native handoff (device-only) de-risks Plans 02–05.

### Concerns

- **HIGH — `markAssistLogged` transaction shape is ambiguous.** Task 1 behavior says “Every write uses `inWriteTransaction` for its own multi-statement unit,” while must-haves and `read_first` forbid nesting `recordTouchpoint` inside an outer txn. `recordTouchpoint` already opens `inWriteTransaction` (`recency-dao.ts:232`). An executor who wraps load → `recordTouchpoint` → status UPDATE in one txn will deadlock per `transaction.ts:15-17`. `21-PATTERNS.md:72-74` still says “SAME transaction” before correcting itself — conflicting guidance.
- **MEDIUM — `21-PATTERNS.md` uid example is stale.** Patterns show `uid: newUid()` (`21-PATTERNS.md:63`) but Plan 01 requires deterministic `reachout:${assist.uid}` for crash idempotency against `interactions.uid UNIQUE` (`001-initial.ts:97-100`).
- **LOW — SQL eligibility vs pure eligibility coupling is underspecified.** Task 2 requires shared constants but does not prescribe how SQL computes 15s/24h boundaries (bound cutoff params vs `datetime()` modifiers). Lexicographic compare works for `YYYY-MM-DD HH:MM:SS` only if both sides use the same format from `localDateTime()`.

### Suggestions

- Add an explicit **anti-pattern block** to Task 1: `markAssistLogged` MUST call `recordTouchpoint` **outside** any outer `inWriteTransaction`; status flip is a second, separate txn (or single guarded UPDATE under mutex after `recordTouchpoint` resolves).
- Fix `21-PATTERNS.md` to show deterministic uid and remove the “SAME transaction” phrasing after `recordTouchpoint`.
- Specify eligibility SQL as bound cutoff timestamps computed in TS from `ELIGIBLE_AFTER_SECONDS` / `EXPIRE_AFTER_HOURS` so the read path and pure logic cannot drift.

### Risk Assessment

**MEDIUM** — Schema and writer routing are well designed; the main execution risk is a mutex deadlock from txn nesting, which is recoverable in development but catastrophic if shipped.

---

## Plan 21-02 — Reach Out router + banner + profile entry

### Summary

Plan 02 delivers the first user-visible vertical slice with appropriate reuse of Compose SMS try/catch (`ComposeScreen.tsx:436-457`), LinksEditor `Linking.openURL` without `canOpenURL` (`LinksEditor.tsx:78-83`), and a separate AppState subscription model distinct from `installSweepTrigger` (`launch-sweep.ts:102-114`). Shell-global non-modal banner architecture matches dossier Cluster H.

### Strengths

- **Handoff ordering matches Cluster E.** `createPendingAssist` before native launch is explicit; Compose already writes nothing at Send time (`ComposeScreen.tsx:435-448`), preserving Cluster AC intent for Plan 03.
- **Banner architecture avoids Back capture.** Requirement that `AssistBanner` not use `Modal` is correct — current widget gate silently drops null intents (`widget-linking.ts:232-234`); banner must not replicate Modal back-stack behavior.
- **Store design avoids false durability.** Explicit ban on Zustand `persist` / AsyncStorage for the queue matches “durable queue lives in SQLite.”
- **Profile entry gating is verifiable.** `deriveReachRoutes` hidden-when-no-actionable-methods can be wired into `ContactProfileScreen`’s existing `listContactMethodGroups` read (`ContactProfileScreen.tsx:252-263`).
- **Attestation-only copy is grep-gated.** Aligns with dossier Cluster J/AJ and platform limits documented at dossier line 165 (SMS `unknown` result).

### Concerns

- **MEDIUM — No widget freshness hook after confirmation.** Every other foreground `recordTouchpoint` path calls `notifyWidgetDataChanged()` (e.g. `notification-actions.ts:145-161`, `ContactProfileScreen.tsx:321-336`). Plans 02/04 never require this after `markAssistLogged`; widget tiles can show stale overdue state until the next launch sweep (`widget-refresh.ts:10-15`).
- **MEDIUM — Native failure detection is inherently limited.** `Linking.openURL` often resolves even when no app handles the intent; only thrown errors become `failed`. Dossier Cluster F acknowledges this; Plan 06 UAT should treat “failure” rows as best-effort, not binary pass/fail on all devices.
- **LOW — `performReachOut` hardcodes empty SMS body** (`21-02-PLAN.md` Task 1 behavior: `SMS.sendSMSAsync(endpoint, "")`). Correct for Reach Out, but Plan 03 must not call this helper verbatim for Compose (draft required).

### Suggestions

- After successful `markAssistLogged` / `markAssistDismissed` in banner and review sheet handlers, call `notifyWidgetDataChanged()` mirroring `notification-actions.ts`.
- Extend `performReachOut` with optional `messageBody?: string` (default `""`) so Plan 03 can share failure/assist ordering without duplicating catch/Alert logic.
- Add one integration-style test asserting `createPendingAssist` is invoked before `SMS.sendSMSAsync` / `Linking.openURL` in `handoff.ts` (mocked), not only store transition tests.

### Risk Assessment

**MEDIUM** — UI/shell design is solid; platform handoff observability and widget staleness are the main gaps.

---

## Plan 21-03 — Endpoint selector + Compose seam

### Summary

Completes the ≤3-tap routing contract and wires Compose into the assist lifecycle without writing interactions at Send time. Wave-3 parallelization with Plan 04 via raw column reads is a reasonable trade documented in the plan’s `<decisions>` block.

### Strengths

- **Endpoint selector reuses real data model.** `listContactMethodGroups` (`contact-methods-read.ts:7-23`) provides ordered, primary-flagged rows for ≥2 endpoint UI.
- **Compose seam preserves Cluster AC.** Acceptance grep forbids `recordTouchpoint` / `INSERT INTO interactions` in `ComposeScreen.tsx` — consistent with current `onSend` (`:435-448`).
- **Parallel Wave 3 decision is justified.** `interaction_assist_enabled` column lands in Plan 01 migration; raw read with default `1` is safe until Plan 04 adds `COLUMN_OF` (`app-settings-dao.ts:272-293` pattern for `digestEnabled`).
- **Coarse channel history preserved.** Endpoint is handoff context only (Cluster D), matching plan prohibitions.

### Concerns

- **MEDIUM — Compose/handoff sharing is underspecified.** Task 2 action calls `createPendingAssist` directly while `read_first` references `performReachOut`. Compose must pass **draft text** to SMS (`ComposeScreen.tsx:446`); Plan 02’s handoff uses empty body. Risk of duplicated failure handling or accidental draft loss.
- **LOW — No automated test for Compose seam.** Acceptance is grep + tsc only; a small test mocking DAO + SMS would guard the ordering invariant.

### Suggestions

- Require Compose to call extended `performReachOut(exec, { …, messageBody: draft })` so assist creation, failure marking, and Alerts stay in one module.
- Add a note in Task 2 acceptance: preserve existing Copy path and Compose Alert copy (“ready to copy”) distinct from Reach Out router errors (per `21-PATTERNS.md:141-142`).

### Risk Assessment

**LOW–MEDIUM** — Scope is tight; main risk is DRY drift between Compose and router handoff paths.

---

## Plan 21-04 — Settings toggle + review sheet + launch sweep

### Summary

Covers the durable-queue lifecycle end: default-on toggle, “off means off” queue clear (Cluster G), multi-pending review (Cluster P), and timer-free 24h/30d prune via `registerSweepHook` (`launch-sweep.ts:45-47`, `App.tsx:156-210` registration pattern).

### Strengths

- **Settings wiring follows proven analog.** `digestEnabled` in `TOGGLE_FIELDS` / `COLUMN_OF` (`app-settings-dao.ts:252-276`) and Settings digest row (~`:895-971` cited in plan) are the correct template.
- **`setInteractionAssistEnabled` uses the right txn pattern.** Plan specifies `updateAppSettingsCore` inside one `inWriteTransaction` (`app-settings-dao.ts:617-621` core vs `:604-607` wrapper) — avoids nesting mutexed wrappers.
- **Sweep registration matches shipped constraints.** Lazy executor inside hook, module guard, register before `installSweepTrigger` — mirrors notification/digest/widget sweep comments in `App.tsx:183-210`.
- **No background timers.** Aligns with `launch-sweep.ts:10-16` negative constraints and CLAUDE.md scheduler rule.

### Concerns

- **MEDIUM — Backup/portable settings export omitted.** `digestEnabled` is in `PortableSettingsSnapshot` (`app-settings-dao.ts:136`) and `PORTABLE_SETTINGS_KEYS` (`backup/backup-schema.ts:106-113`). Plan 04 adds a user preference column but does not extend portable snapshot / backup allowlist — restore on another device could drop Assist preference or fail manifest validation depending on restore path.
- **LOW — Sweep expiry uses `created_at`, eligibility also uses `created_at` for 24h.** Consistent with Cluster N; cap-5 prunes at write time separately. Document that sweep and query filter must share `EXPIRE_AFTER_HOURS` import from `assist-eligibility.ts`.

### Suggestions

- Extend Task 1 to also update `PortableSettingsSnapshot`, `getPortableSettingsSnapshot` SELECT/mapping (`app-settings-dao.ts:379-427`), and `backup-schema.ts:106-113` — same scope as `digestEnabled`.
- Add `notifyWidgetDataChanged()` when toggle-off expires pending assists (status changes affect widget-facing recency indirectly via future confirms — lower priority than confirmation path).

### Risk Assessment

**LOW–MEDIUM** — Lifecycle logic is thorough; backup portability is the notable gap.

---

## Plan 21-05 — Merge/purge/widget cross-phase wiring

### Summary

Correctly identifies the phase’s cross-phase correctness core: reparent assists during merge (Cluster AA), purge removal (Cluster AB), and strict `orbit://reach/<id>` allow-list (mirroring `CONTACT_URI` / `COMPOSE_URI` at `widget-linking.ts:91-92`, `parseWidgetId` at `:100-106`).

### Strengths

- **Merge reparent target is accurate.** Current loop at `merge-dao.ts:153` lists seven tables; dossier Cluster AA (line 547) explicitly requires adding `interaction_assists` before absorbed `DELETE` (`merge-dao.ts:185`) — otherwise CASCADE would destroy pending assists and break redirect.
- **Purge strategy matches dossier.** Cluster AB (line 563) allows CASCADE on contact delete; `purgeContact` deletes children explicitly then `DELETE FROM contacts` (`purge-dao.ts:244-262`). FK CASCADE on migration-014 `contact_id` will remove any remaining assist rows.
- **Widget change is bounded.** Only LargeTile Message → Contact (`widget-render.tsx:452-458`); small widget untouched per Cluster AG.
- **Allow-list security mirrors shipped pattern.** Anchored regex + `parseWidgetId` safe-integer guard is proven in `widget-linking.ts:91-106`.
- **Purged fail-safe closes a real gap.** Today null-guarded intents are silently dropped (`widget-linking.ts:232-234`); plan adds Dashboard + copy for reach intents only.

### Concerns

- **MEDIUM — Purge relies on CASCADE while `purge-dao.ts` documents explicit fan-out.** Header at `purge-dao.ts:16-23` says “do not rely on FK CASCADE”; plan intentionally skips `PURGE_CHILDREN` for assists. Functionally OK (dossier-approved), but `computeImpact` (`purge-dao.ts:121`) will not surface pending assists in purge confirm UI.
- **LOW — `openReachOut` consume-once via `setParams` needs careful focus handling.** Plan specifies consume-once; React Navigation param persistence across re-focus is a common footgun — worth a device UAT row (covered in Plan 06).

### Suggestions

- Optionally add explicit `DELETE FROM interaction_assists WHERE contact_id = ?` to purge fan-out for consistency with `purge-dao.ts:16-23` philosophy (not required by dossier).
- Extend `guardWidgetIntent` tests for Profile+`openReachOut:true` on live Unbound contacts (`widget-quick-action-guard.ts:33-36` allows non-archived).

### Risk Assessment

**LOW** — Small, well-scoped diffs against shipped merge/widget code; deep-link pattern is established.

---

## Plan 21-06 — Full-suite gate + device UAT

### Summary

Appropriate release gate for an irreversible migration and device-only behaviors (native intents, AppState banner timing, RemoteViews). DB-verified UAT matrix matches dossier lines 805–825.

### Strengths

- **Node gates are the right preflight.** Full `npm test`, `tsc`, `check:colors` before device work.
- **DB verification requirement is load-bearing.** Reinforces “UI render ≠ correctness” per project rules; run-as reads for `occurred_at === handoff_at`, `source='assist'`, `direction='outbound'`.
- **Matrix covers cross-phase cases.** Merge redirect, purge fail-safe, toggle-off clear, process death, Back-through-banner — maps to Plans 01–05 must-haves.
- **Owner sign-off is explicit.** Appropriate for migration 014 first landing on Pixel.

### Concerns

- **MEDIUM — Time-dependent rows (15s buffer, 24h expiry) are slow/flaky on device.** Plan does not document clock manipulation or test hooks; agent may need adb elapsed-time strategy or owner-assisted waits.
- **LOW — Phase 20 roadmap dependency vs code reality.** Roadmap lists Phase 20 “Not started” (`ROADMAP.md:920`) while `mergeContacts` is shipped (`merge-dao.ts:92`). UAT merge row depends on Plan 05, not full Phase 20 completion — worth noting if merge UI is incomplete.

### Suggestions

- Add UAT scaffolding notes for time travel: temporarily lower `ELIGIBLE_AFTER_SECONDS` in DEBUG, or use run-as UPDATE of `handoff_at`/`created_at` before foreground return tests.
- Include explicit widget refresh check after banner confirmation (overdue tile updates without app restart).

### Risk Assessment

**MEDIUM** — Process is strong; execution cost and time-dependent scenarios are the friction points.

---

## Phase-Level Synthesis

### Overall Strengths

1. **Tracer-first, wave-ordered plans** with clear `depends_on` and honest split of node- vs device-verifiable work.
2. **Dossier alignment is deep** — merge reparent, purge CASCADE, attestation-only copy, cap-5/24h, off-clears-queue, widget supersession all trace to locked clusters in `docs/dossier/21-interaction-assist-reach-out.md`.
3. **Central architectural risk (DATA-04) is treated as first-class** — grep gates, DAO tests, and UAT DB reads for single-writer and handoff-time timestamps.
4. **Security posture preserved** — permissionless intents, no passive monitoring, strict deep-link allow-list extension, widget remains writer-free (`widget-task-handler.tsx:80`).

### Overall Concerns

| Severity | Issue |
|----------|-------|
| **HIGH** | `markAssistLogged` txn nesting ambiguity vs `recordTouchpoint`’s self-transacting mutex (`recency-dao.ts:232`, `transaction.ts:15-17`) |
| **MEDIUM** | Missing `notifyWidgetDataChanged()` after assist confirmation (contrast `notification-actions.ts:161`) |
| **MEDIUM** | `interactionAssistEnabled` not added to portable backup settings (`backup-schema.ts:106-113`) |
| **MEDIUM** | Compose/router handoff sharing needs explicit `messageBody` parameter — draft must not be lost |
| **MEDIUM** | Native handoff “failure” detection limited on Android (dossier Cluster F) |
| **LOW** | `21-PATTERNS.md` conflicts with Plan 01 on uid + transaction sequencing |
| **LOW** | Purge impact summary won’t count pending assists (CASCADE vs explicit fan-out style) |

### Phase-Level Suggestions

1. Unify handoff through `performReachOut` with optional SMS body; Compose and router share assist-before-launch + failure marking.
2. Add a **Plan 01 Task 1 acceptance line**: “`markAssistLogged` does not call `inWriteTransaction` around `recordTouchpoint`.”
3. Extend Plan 04 Task 1 with portable backup/export fields for `interactionAssistEnabled`.
4. Add widget refresh to banner/review-sheet resolve handlers in Plan 02/04.
5. Resolve `21-PATTERNS.md` drift before execution (deterministic uid, sequencing).

### Overall Risk Assessment

**MEDIUM**

The plans are unusually thorough for a brownfield feature touching merge, purge, widget, compose, and the single recency writer. Wave structure and node-test coverage de-risk the core correctness path. The elevated risk is concentrated in **implementation hazards the plans almost but don’t fully nail** (mutex nesting around `recordTouchpoint`, Compose/handoff DRY, widget freshness, backup portability) plus **inherently device-limited native handoff observability**. None of these appear to reverse dossier or ADR decisions; they are execution-precision gaps addressable with small plan amendments before Wave 1 lands. Migration 014 remains irreversible once on device — Plan 06’s owner-gated UAT is the appropriate final gate.


---

## Claude Review

# Cross-AI Plan Review — Phase 21: Interaction Assist & Reach Out

Verified against the live repo (not just the plan text): `src/db/database.ts` (TARGET_VERSION=13, migration list), `src/db/recency-dao.ts` (`recordTouchpoint` signature/body, `inWriteTransaction` non-reentrancy), `src/db/migrations/001-initial.ts` (`interactions.uid TEXT NOT NULL UNIQUE`), `src/db/merge-dao.ts` (reparent loop, line 153), `src/db/purge-dao.ts` (`PURGE_CHILDREN` fan-out), `src/navigation/widget-linking.ts` (allow-list pattern), `src/db/app-settings-dao.ts` (`COLUMN_OF`/`digestEnabled`), `src/services/launch-sweep.ts` (`registerSweepHook`/`installSweepTrigger`), `src/screens/ComposeScreen.tsx` (`onSend`).

## Summary

This is an unusually well-grounded plan set — every load-bearing file/line citation I checked was accurate, not stale or invented. The migration number (014), the `recordTouchpoint` signature, the merge reparent array, the purge fan-out mechanism, and the widget allow-list pattern all match what's actually on disk. The single-writer discipline (all confirmed writes route through `recordTouchpoint`, never a bespoke `interactions` INSERT) is enforced both structurally (Plan 01's task design) and via grep-based acceptance criteria across every plan that touches the writer. The 6-plan/4-wave structure correctly sequences the tracer (data spine) before UI, and correctly identifies cross-phase wiring (merge/purge/widget) as the actual risk surface rather than treating it as an afterthought. The main gap is in Plan 01's crash-recovery idempotency mechanism for `markAssistLogged`, which introduces a UNIQUE-constraint-catch pattern that has zero precedent anywhere in this codebase and is under-specified.

## Strengths

- **`recordTouchpoint` signature is verified correct.** `src/db/recency-dao.ts:217-243` matches Pattern 1 in RESEARCH/PATTERNS exactly — `occurredAt`, `now`, `channel`, `direction`, `connected`, `note`, `source` all present, `source`/`channel`/`direction` confirmed free-TEXT with no CHECK (`migrations/001-initial.ts:97-110`). The plans correctly avoid inventing a "core" variant for it (unlike `recomputeLastContact`, `recordTouchpoint` self-transacts with no exported non-mutexed core), and Plan 01's read_first section explicitly flags this ("there is NO exported non-mutexed core variant") — this is accurate and was clearly verified, not assumed.
- **Merge reparent addition is correctly scoped.** `merge-dao.ts:153` literally reads `for (const table of ["interactions","events","fuel","custom_field_values","contact_links","contact_methods","external_contact_links"] as const)` — Plan 05's "add the string `interaction_assists`" is a one-line, low-risk, high-leverage fix that closes a real correctness hole (without it, `DELETE FROM contacts WHERE id = ?` at `merge-dao.ts:185` would cascade-delete a pending assist before redirect).
- **Purge reliance on cascade is correct and consistent with house style.** `purge-dao.ts` does use an explicit `PURGE_CHILDREN` fan-out (verified, not `ON DELETE CASCADE`) for auditability — Plan 05 correctly does NOT add `interaction_assists` to that map (assists are operational, not tombstoned) and instead adds a guarding test for the cascade path, which is the right call given the house style deliberately avoids relying on cascade elsewhere.
- **`interactions.uid TEXT NOT NULL UNIQUE` is real** (`001-initial.ts:99`), so Plan 01's deterministic-uid idempotency mechanism (`reachout:${assist.uid}`) is architecturally sound in principle — the DB will actually enforce it.
- **Nested-transaction hazard is correctly identified and designed around.** `recency-dao.ts:152-156`'s own docstring warns that a nested `inWriteTransaction` is "a PERMANENT hang," and every plan that calls `recordTouchpoint` followed by a status UPDATE explicitly sequences them as separate statements/transactions rather than nesting — this is the correct mitigation and it's called out in Plan 01's task instructions, not just the must_haves.
- **Widget allow-list extension mirrors the existing security boundary exactly.** `widget-linking.ts:91-92`'s `CONTACT_URI`/`COMPOSE_URI` regex + `parseWidgetId` idiom (Number.isSafeInteger guard) is what Plan 05 proposes to clone for `REACH_URI` — appropriate, since this is genuinely an untrusted-intent surface (another app can send arbitrary URIs to the widget's deep link handler).
- **Compose Send→assist decision (21-03 Task 2) documents its own scope-boundary reasoning inline** ("Decisions" block distinguishing Cluster AC wiring now vs. M2 Phase 12 UX ownership later) — this is exactly the kind of traceable reasoning that prevents silent scope drift.

## Concerns

- **HIGH — Plan 01's crash-recovery idempotency mechanism has no precedent in the codebase and is under-specified.** `markAssistLogged` is supposed to catch a UNIQUE-constraint violation from `recordTouchpoint` (when a deterministic `reachout:<uid>` interaction uid collides on retry) and treat it as "already logged." I grepped the entire `src/db/` tree for any existing UNIQUE-violation-catching pattern (`grep -i "unique\|constraint"` across `*.ts`) and found **zero** examples of this codebase distinguishing a UNIQUE-constraint SQLite error from any other thrown error. `recordTouchpoint` itself has no error-shape contract for this (it just propagates whatever `exec.runAsync` throws). The plan's must-have ("If recordTouchpoint rejects with a UNIQUE violation... treat as already-logged") doesn't specify how to detect that condition from the `SqlExecutor` abstraction (error `.message` substring match on `node-sqlite.ts`'s wrapper vs. on-device `expo-sqlite`'s error shape — these can differ). This is exactly the kind of thing that passes in the node test harness (`__testkit__/node-sqlite.ts`) and silently misbehaves on-device (a recurring pattern this project has already been burned by once — see the Hermes-crypto pitfall). Recommend: either (a) make the DAO query-before-insert with a status-guarded transaction instead of relying on catching a DB-level constraint error, or (b) explicitly verify and document the exact error shape from both `node-sqlite.ts` and Hermes/expo-sqlite before relying on it.
- **MEDIUM — Plan 01's cap-5 prune query has a race with concurrent creates that isn't addressed.** The prune SQL (`UPDATE ... WHERE status='pending' AND id NOT IN (SELECT id FROM interaction_assists WHERE status='pending' ORDER BY created_at DESC, id DESC LIMIT 5)`) runs inside the same `inWriteTransaction` as the INSERT, which is correct for atomicity given the single-writer mutex `recordTouchpoint`/`inWriteTransaction` already provide (confirmed: `transaction.ts` is a non-reentrant mutex, so this is actually fine — flagging as resolved on reflection, downgrading). No action needed; the mutex covers it.
- **MEDIUM — the `assist-store.ts` AppState "separate subscription from the sweep" claim is asserted but not verification-testable at the unit level in the way described.** Plan 02 Task 1's acceptance criteria says the store test "proves refresh triggers on background→active and NOT on inactive→active" using "a hand-rolled AppState fake." This is testable, but the deeper interaction — that the *sweep's* `installSweepTrigger` and the *banner's* subscription don't clobber each other or double-fire when both are registered against the real `AppState` singleton in `App.tsx` — is never verified by any automated test across the whole plan set; it's implicitly deferred to Plan 06 device UAT. Given this is called out in RESEARCH as a "load-bearing negative constraint," a lightweight integration test (both hooks registered against one fake AppState, assert independent firing) would be cheap insurance and isn't currently in the Wave 0 gap list.
- **LOW — `deriveReachRoutes`'s claim that `call === text` is not independently exercised against `listActionablePrimaryMethods`'s actual behavior.** Plan 01 Task 2 asserts this derivation as a must-have and PATTERNS.md correctly cites `contact-method-normalization.ts:15-79` for the phone/email-granular `isActionable` semantics, but I did not independently re-verify that `listActionablePrimaryMethods`'s returned shape (`{phone, email}`) has no hidden channel-specific gate downstream (e.g., a landline flag suppressing Text). This is asserted confidently in three separate documents (RESEARCH, PATTERNS, dossier) as `[VERIFIED]`, which is reasonably strong, so I'm not escalating it, but it's the one claim in the security-adjacent "route derivation" logic I couldn't independently confirm in this session.
- **LOW — Plan 05's purged-widget-deep-link "fail-safe" UX (Task 2) reuses `guardWidgetIntent`'s Profile branch, but the plan text notes that branch currently "allows Bound OR Unbound but drops archived/missing" — it's unclear whether "archived" should actually be droppable for the REACH intent given Cluster Z ("archived target → still loggable").** If the *existing* Profile guard treats archived contacts as invalid the same way as missing/purged ones, reusing it verbatim for `orbit://reach/<id>` could incorrectly hide reachability for an archived-but-loggable contact reached via widget, contradicting Cluster Z. The plan doesn't call this distinction out explicitly — worth a one-line clarification in Plan 05 Task 2 that the reused guard must treat archived-but-existing as valid (only missing/purged/merged-without-redirect should fail).

## Suggestions

- Add a Wave-0 test (or fold into Plan 01) asserting the exact error identity used to detect a UNIQUE-constraint violation in `markAssistLogged`, exercised against the same `__testkit__` executor the rest of the DAO suite uses, and flag in the SUMMARY that this specific behavior (unlike the rest of the DAO) has NOT been device-verified for its error-shape assumption — elevate it explicitly in Plan 06's device matrix rather than leaving it implicit.
- Consider replacing the catch-a-constraint-violation idempotency strategy with a simpler status-guarded check-then-write (read `status` first inside the transaction; if already `'logged'`, no-op) — this avoids relying on driver-specific error shapes entirely and is more consistent with the "status-guarded UPDATE" pattern already used elsewhere in the same plan for `markAssistDismissed`/`markAssistFailed`.
- Clarify in Plan 05 Task 2 that the reused `guardWidgetIntent` Profile-branch guard must NOT reject archived-but-existing contacts for the `orbit://reach/<id>` intent, only missing/purged ones — otherwise Cluster Z's "archived → still loggable" guarantee could be silently violated on the widget path specifically (profile-initiated Reach Out presumably isn't gated the same way, so this would be an inconsistency between entry points, not just a widget quirk).
- Add one integration-level test (even a light one) that registers both `interactionAssistSweep`'s hook and `assist-store`'s AppState subscription against a single shared fake `AppState`, asserting they don't interfere — currently this is asserted as a design constraint in three docs but never jointly tested.

## Risk Assessment: **LOW-MEDIUM**

The architecture is sound, the citations are accurate (verified independently against the repo, not just trusted), and the plan correctly identifies and mitigates the phase's real risk surface (single-writer discipline, merge/purge wiring, deep-link security boundary, no-timer durability). The one genuine gap — the UNIQUE-constraint-catch idempotency mechanism in Plan 01 — is a new pattern with no in-repo precedent and an under-specified detection mechanism, which is exactly the shape of bug this project has been bitten by before (Hermes crypto passing in Node, failing on-device). It's containable (single function, single plan, easily test-hardened before Wave 2 begins) but should not ship to device UAT without tightening.


---

## Verification coverage

Effective drift-guard authority: **grep** (under this authority a MISSING symbol resolves to `needs-acknowledgement`, `hardBlock:false` — no MISSING was found regardless).

### 1. Source-grounding pass

Every symbol the plans cite that already exists in the repo was grep-verified. New artifacts this phase produces (`interaction_assists` table, migration 014, `interaction_assist_enabled` column, `createPendingAssist` / `markAssistLogged` / `markAssistDismissed` / `markAssistFailed`, `performReachOut`, `deriveReachRoutes`, `AssistBanner`, `assist-store`, `assist-eligibility`, `interactionAssistSweep`, `REACH_URI` / `orbit://reach/<id>`) are **excluded** — they are declared outputs, not preconditions.

| Symbol | Verdict | Evidence |
|--------|---------|----------|
| `recordTouchpoint` | VERIFIED | `src/db/recency-dao.ts:217` |
| `insertInteraction` / `INSERT INTO interactions` | VERIFIED | `src/db/recency-dao.ts:179`, `:195` |
| `last_contact` writer (SET last_contact) | VERIFIED | `src/db/recency-dao.ts:166` |
| `inWriteTransaction` non-reentrant PERMANENT-hang warning | VERIFIED | `src/db/transaction.ts:15-17`, export `:49` |
| `TARGET_VERSION = 13` / migration013 as head | VERIFIED | `src/db/database.ts:48`, `:64` (⇒ 014 is correct next) |
| `mergeContacts` reparent loop (7 tables, no `interaction_assists`) | VERIFIED | `src/db/merge-dao.ts:153`; `DELETE FROM contacts` `:185` |
| `listContactMethodGroups` / `listActionablePrimaryMethods` | VERIFIED | `src/db/contact-methods-read.ts:7`, `:30` |
| widget allow-list `CONTACT_URI`/`COMPOSE_URI`/`parseWidgetId`/`isSafeInteger` | VERIFIED | `src/navigation/widget-linking.ts:91-92`, `:100-102` |
| `guardWidgetIntent` rejects archived (`archived_at !== null → null`) | VERIFIED | `src/services/widget/widget-quick-action-guard.ts:20`, `:34-35` |
| `purgeContact` explicit `PURGE_CHILDREN` fan-out (not FK CASCADE) | VERIFIED | `src/db/purge-dao.ts:16-22`, `:76`, `:245` |
| `ComposeScreen` `SMS.sendSMSAsync(phone, draft)`, no `recordTouchpoint`/INSERT | VERIFIED | `src/screens/ComposeScreen.tsx:446` |
| `digestEnabled` in `TOGGLE_FIELDS` / `COLUMN_OF` | VERIFIED | `src/db/app-settings-dao.ts:256`, `:276` |
| `registerSweepHook` / `installSweepTrigger` | VERIFIED | `src/services/launch-sweep.ts:45`, `:102` |
| restore writes `interactions` with `ON CONFLICT(uid) DO UPDATE` | VERIFIED | `src/backup/restore-apply.ts:170` |
| `PORTABLE_SETTINGS_KEYS` includes `digestEnabled` | VERIFIED | `src/backup/backup-schema.ts:106-107` |
| widget Message action → `orbit://compose/{id}` | VERIFIED | `src/services/widget/widget-render.tsx:454-458` |

MISSING: none. AMBIGUOUS: none. UNCHECKABLE / skipped: none (all cited pre-existing symbols resolved on disk). No `hardBlock` MISSING ⇒ no source-grounding HIGH.

### 2. Cross-artifact fact-drift (advisory — never counts toward HIGH/actionable)

- `drift-guard phase-status --phase 21` → verdict **`lag`** (STATE.md "Ready to execute" rank 1 vs ROADMAP "Not started" rank 0; authority STATE.md). Per the convergence contract `lag` is ignored (only `drifted` is reported). No action.
- ROADMAP Success Criteria ↔ PLAN must_haves / dossier [DECIDED] clusters: no genuine contradiction (same fact asserted opposite) found. Plans enforce Clusters Z/AA/AB/AC/F rather than contradicting them. Advisory-clean.
- Note (advisory, not counted): `21-PATTERNS.md` carries stale guidance — `uid: newUid()` (`:63`) vs the plan's required deterministic `reachout:${uid}`, and "SAME transaction" phrasing (`:72-74`) that conflicts with Plan 01's non-nesting requirement. This is the doc-drift that makes HIGH-1 dangerous; correcting it is part of resolving HIGH-1.
