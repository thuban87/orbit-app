---
phase: 21
reviewers: [codex, claude, cursor]
reviewed_at: 2026-08-31T21:28:59.651Z
cycle: 5
plans_reviewed: [21-01-PLAN.md, 21-02-PLAN.md, 21-03-PLAN.md, 21-04-PLAN.md, 21-05-PLAN.md, 21-06-PLAN.md]
models:
  codex: "gpt-5.6-terra (reasoning=low)"
  claude: "sonnet (reasoning=low)"
  cursor: "unknown"
model_sources:
  codex: "banner"
  claude: "pinned"
  cursor: "unknown"
---

# Cross-AI Plan Review — Phase 21 (Interaction Assist & Reach Out)

_Convergence cycle 5 (final). Unresolved-finding trajectory across prior cycles: 12 → 6 → 5 → 2. All three lanes (codex, claude, cursor) ran source-grounded against the committed plans at HEAD `10af00f`. The claude lane ran headless as `sonnet` — a distinct model from the Opus orchestrator, no inherited context._

## Consensus Summary

All three reviewers independently traced the load-bearing claims to source and converged on **proceed to execution**. Cursor: "No new HIGH findings." Claude: risk "LOW–MEDIUM", its single HIGH self-retracted to informational on re-read. Codex: risk "MEDIUM", raising one HIGH that the other two lanes examined and cleared (see Divergent Views). The phase's central correctness architecture — the assist-confirmation write composing the non-mutexed recency cores (`insertInteractionCore` + `recomputeLastContactCore` + `bumpDataRevisionCore`) inside ONE `inWriteTransaction`, never the mutexed `recordTouchpoint`; the LOG-06 `rejectFutureOccurredAt(handoff_at, now)` guard before the transaction; the in-transaction full-row re-read defeating the merge/purge TOCTOU; `recomputeLastContactCore` as the sole `contacts.last_contact` writer (DATA-04); migration 014 → TARGET_VERSION 14 with the `full-chain.test.ts` lockstep bump; and the toggle-OFF banner-freshness `refresh()` wiring — is verified sound against the code on disk.

### Agreed Strengths (2+ reviewers)

- **Mutex-nesting hazard correctly avoided** (codex, claude, cursor). `markAssistLogged` composes the exported non-mutexed cores (`recency-dao.ts:414-428`) rather than nesting `recordTouchpoint`'s own `inWriteTransaction` (`recency-dao.ts:217`), sidestepping the permanent-hang hazard documented at `transaction.ts:11-29`.
- **Merge/purge TOCTOU treatment is sound** (codex, claude, cursor). Binding the insert/recompute to an in-transaction full-row re-read (not the pre-txn cache) correctly handles merge reparent-to-survivor (`merge-dao.ts:153`) and purge/absorbed-delete (`:185`).
- **LOG-06 future-date parity restored** (codex, claude, cursor). The exported cores lack the guard the mutexed `recordTouchpoint` applies; the plan calls `rejectFutureOccurredAt` (`log-guards.ts:68`) before the transaction, matching the sibling-writer precedent.
- **Migration-fixture drift caught and fixed** (claude, cursor). Plan 01 updates `full-chain.test.ts:39` (`toBe(13)`→`toBe(14)`); Plan 05 bumps the merge/purge test fixtures' local migration arrays through 014.
- **Deep-link allow-list reuses the anchored-regex + `Number.isSafeInteger` pattern** (codex, claude, cursor) at `widget-linking.ts:91` rather than inventing new parsing — correct security posture for an untrusted launcher intent.
- **data-revision bump correctly required** (codex, cursor). `updateAppSettingsCore` deliberately does not bump (`app-settings-dao.ts:617`) while the public wrapper does (`:606`), so `setInteractionAssistEnabled` must bump exactly once.
- **deriveReachRoutes no-flash seam is mechanically sound** (claude, cursor). The profile already awaits `listContactMethodGroups` into `methodGroups` state (`ContactProfileScreen.tsx:243-252`); the pure `deriveReachRoutes(selectActionablePrimaryMethods(methodGroups))` adds no second async read.

### Agreed Concerns (2+ reviewers)

- **Eligibility SQL cutoff mechanism left implicit** (codex MEDIUM, cursor LOW). Plan 01 requires the SQL WHERE clause and the pure `assist-eligibility.ts` to share the 15s/24h thresholds against `handoff_at`, but does not pin HOW (e.g. compute cutoff strings in JS and bind as `?`, or `julianday()`). Mitigated by the required exact-boundary tests at 15s and 24h, which force filter/re-check agreement at execution — so this is self-correcting under the acceptance criteria rather than a silent-drift risk.

### Divergent Views

- **Codex HIGH — "Plan 03 lacks the data contract to select secondary endpoints"** — NOT sustained by the other two lanes and NOT sustained on disk. Codex argues Plan 02 passes only `reachRoutes` (primary pair) to `ReachOutRouter`, so Plan 03's `EndpointSelector` cannot list secondary endpoints without an unplanned second query. Claude examined the same seam and **self-downgraded to informational** ("on reread, plan 03 Task 1's signature already takes `endpoints: ContactMethodRow[]` as a prop … actually fine"). Cursor verified Plan 03 independently and found it sound. On disk: the router already holds `contactId` (it must, to call `performReachOut(exec, {contactId,…})` in Plan 02), and Plan 03's `<read_first>` cites `listContactMethodGroups` (`contact-methods-read.ts:7`) as the endpoint source — so `ReachOutRouter` can obtain the full per-type actionable list via a tap-time read confined to `ReachOutRouter.tsx` (a modal-open read, not a profile-render flash — the no-flash invariant is scoped only to the profile's route-visibility derivation, which stays pure). The concern reduces to a clarity nicety already covered for execution, not a HIGH. **A one-line clarification in Plan 03 Task 1 pinning the endpoint-list source would still be worthwhile** (see suggestions), but it does not block.
- **Claude MEDIUM — "`bumpDataRevisionCore` import path unverified"** — DISPROVEN on disk. Claude flagged it could not confirm the export; it exists exactly as the plan cites: `src/db/data-revision-dao.ts:5` `export async function bumpDataRevisionCore(exec: SqlExecutor)`, already imported by `app-settings-dao.ts:23`. No action needed. (Claude's own recommendation — grep-verify it first — is harmless but moot.)

## Codex Review

# Plan Review: Phase 21 — Interaction Assist & Reach Out

## Summary

The six plans are unusually thorough and trace the critical data, lifecycle, widget, and device-UAT paths well. The main remaining implementation risk is not the assist DAO—it correctly respects the existing non-reentrant transaction model—but a few interfaces are assumed rather than specified: the multi-endpoint router does not yet receive all methods, and the banner queue does not explicitly include the contact display data it needs.

## Strengths

- Plan 01 correctly avoids nesting `recordTouchpoint()` inside another transaction. `recordTouchpoint()` itself opens `inWriteTransaction` at [recency-dao.ts](/home/bwales/projects/orbit-app/src/db/recency-dao.ts:217), while the exported core functions are explicitly intended for one already-open outer transaction at [recency-dao.ts](/home/bwales/projects/orbit-app/src/db/recency-dao.ts:414). This directly avoids the documented permanent-hang hazard in [transaction.ts](/home/bwales/projects/orbit-app/src/db/transaction.ts:11).

- The Plan 01 merge/purge TOCTOU treatment is sound. Current merge reparents child tables before deleting the absorbed contact at [merge-dao.ts](/home/bwales/projects/orbit-app/src/db/merge-dao.ts:153) and [merge-dao.ts](/home/bwales/projects/orbit-app/src/db/merge-dao.ts:185); binding the logged interaction to an in-transaction assist re-read is the right mechanism.

- The plan correctly adds the future-date guard that the exported recency cores lack. The existing wrapper applies `rejectFutureOccurredAt` before its transaction at [recency-dao.ts](/home/bwales/projects/orbit-app/src/db/recency-dao.ts:217), and the validator is strict about both format and calendar validity at [log-guards.ts](/home/bwales/projects/orbit-app/src/db/log-guards.ts:68).

- Plan 04 correctly identifies data-revision handling as necessary. `updateAppSettingsCore()` deliberately does not bump the revision [app-settings-dao.ts](/home/bwales/projects/orbit-app/src/db/app-settings-dao.ts:610), while the public wrapper does [app-settings-dao.ts](/home/bwales/projects/orbit-app/src/db/app-settings-dao.ts:604). A specialized toggle transaction must therefore include exactly one explicit bump.

- The widget plan extends an actual strict allow-list rather than introducing an ad hoc parser. Existing `contact` and `compose` forms are anchored and safe-integer guarded at [widget-linking.ts](/home/bwales/projects/orbit-app/src/navigation/widget-linking.ts:91), and the widget currently emits the superseded Message route at [widget-render.tsx](/home/bwales/projects/orbit-app/src/services/widget/widget-render.tsx:452).

- Plan 05’s reparent approach is necessary: current purge deletes the parent contact at [purge-dao.ts](/home/bwales/projects/orbit-app/src/db/purge-dao.ts:260), so migration-014’s `ON DELETE CASCADE` cleanly removes purged assists without adding them to the tombstone model.

## Concerns

- **HIGH — Plan 03 lacks the data contract needed to select secondary endpoints.** Plan 02 passes `reachRoutes`, which by design only has the primary phone/email, while Plan 03 needs every actionable endpoint. The profile already holds the complete grouped methods in state at [ContactProfileScreen.tsx](/home/bwales/projects/orbit-app/src/screens/ContactProfileScreen.tsx:179), but the Plan 02 wiring says to pass only `reachRoutes` to `ReachOutRouter`. Without explicitly passing `methodGroups` (or an all-actionable-endpoints prop), the selector cannot truthfully list secondary numbers/emails without introducing an unplanned second query.

- **MEDIUM — The banner’s required contact name is not defined by the queue-read contract.** `interaction_assists` stores `contact_id`, not a display name. Plan 02 requires channel-specific copy such as “Did you text {name}?”, but Plan 01 only specifies a pending-assist query/order, not whether it joins `contacts` and returns `name`. The query must explicitly join `contacts`, retain archived contacts, and return a stable display name; purge remains safe through cascade.

- **MEDIUM — Settings portability test needs an executable seam.** `PORTABLE_SETTINGS_KEYS` is currently module-private at [backup-schema.ts](/home/bwales/projects/orbit-app/src/backup/backup-schema.ts:106). Plan 04 asks for a test proving the set “contains” `interactionAssistEnabled`, but that cannot be tested directly unless it exports a deliberate test seam. Better: test a real export/restore manifest containing the setting, which exercises the actual public contract.

- **MEDIUM — Plan 04’s “same shared constants in SQL” needs a concrete SQL-time strategy.** `ELIGIBLE_AFTER_SECONDS` is a JS constant, but SQLite predicates need a bound value or computed cutoff. Specify `julianday(?) - julianday(handoff_at)` with numeric bound thresholds (or caller-computed local cutoff strings) and test exact 15-second/24-hour boundaries. Otherwise the pure eligibility helper and SQL query can silently drift.

- **MEDIUM — The return-banner refresh has no stated error behavior.** `getAppSettings()` and profile loads currently surface failure through user-visible handling, e.g. [ContactProfileScreen.tsx](/home/bwales/projects/orbit-app/src/screens/ContactProfileScreen.tsx:230). The global banner store should catch/log a queue-query failure and preserve or clear prior state intentionally; an unhandled rejected refresh on AppState return is likely to create noisy runtime failures.

- **LOW — The widget guard refactor affects more callers than the task file list admits.** `WidgetLinkingGate` directly assumes `guardWidgetIntent()` returns `WidgetNavIntent | null` at [widget-linking.ts](/home/bwales/projects/orbit-app/src/navigation/widget-linking.ts:222). Plan 05 describes the needed update, but Task 2’s local file list omits `widget-quick-action-guard.ts` and its test even though the plan-wide list includes them. Make those owned files explicit in the task to avoid an incomplete discriminated-union migration.

- **LOW — Plan 06 cannot be fully autonomous.** It correctly includes owner sign-off and device-dependent failure cases, but its front matter still says `autonomous: true`. Treat it as a checkpointed plan: automated gates can complete, but owner sign-off and intentionally induced native-handoff failure must remain blocked/pending when unavailable.

## Suggestions

- In Plan 02, define `ReachOutRouter` props to include `methodGroups: ContactMethodGroups`; in Plan 03, derive the actionable list from those groups. Keep `deriveReachRoutes()` primary-only.

- Define a single `EligibleAssistRow` in Plan 01, including assist fields plus `contact_name` from an inner join to `contacts`. State that archived contacts remain included in this read.

- Add an integration-style backup round-trip test for `interactionAssistEnabled` instead of asserting against the private allow-list constant.

- Specify and share SQL cutoff helpers/constants for queue reads and sweep expiry, then test exact equality at both 15 seconds and 24 hours.

- Add `refresh()` error handling in `assist-store`: log the failure, do not crash an AppState listener, and choose/document whether prior banner state is retained.

## Risk Assessment

**MEDIUM.** The core correctness architecture is strong: migration order, single-writer recency composition, durable queue semantics, merge reparenting, purge cascade, and deep-link hardening all align with the existing code. The remaining risks are interface gaps between plans—especially multi-endpoint selection and banner display-row shape—which should be resolved before execution so the later UI work does not introduce extra queries or incomplete routing.

---

## Claude Review

# Cross-AI Plan Review: Phase 21 — Interaction Assist & Reach Out

## Summary

This is an unusually mature plan set — the review annotations embedded throughout (HIGH-1, HIGH-2, HIGH-3, findings #1-#6) show this has already been through multiple review cycles and most structural risks (mutex nesting, TOCTOU on merge/purge, single-writer discipline, banner-vs-Modal, deep-link allow-list) are explicitly addressed with concrete mechanisms. I traced the load-bearing claims against the actual repo. The core architecture is sound: `markAssistLogged` composing `insertInteractionCore`/`recomputeLastContactCore`/`bumpDataRevisionCore` inside one transaction is the right call given `recordTouchpoint`'s self-transacting mutex. The remaining concerns are narrower — a couple of details worth double-checking against source before execution, and a few genuine residual risks that survived the review cycles.

## Strengths

- **Correct diagnosis of the mutex-nesting hazard.** `recency-dao.ts:227-231` (per research) shows `recordTouchpoint` opens its own transaction; plan 00 correctly avoids nesting `inWriteTransaction` and instead composes the underlying cores. This is the single most important correctness call in the whole phase and it's made explicitly and tested for (double-call idempotency, no-nesting grep gate).
- **TOCTOU handling for merge/purge race in `markAssistLogged`** (plan 00) is genuinely sophisticated: re-reading the full assist row *inside* the transaction rather than trusting the pre-transaction read, and binding the interaction insert to the in-txn `contact_id`. This closes a real hole that a naive "read once, write once" implementation would have.
- **Migration-fixture drift is caught and fixed** — plan 00 explicitly updates `full-chain.test.ts`'s hardcoded `TARGET_VERSION` assertion, and plan 05 explicitly bumps the merge/purge test fixtures' local migration arrays. Both are exactly the kind of easy-to-miss breakage that silently fails a later gate.
- **Deep-link allow-list reuses the existing anchored-regex + `Number.isSafeInteger` pattern** (`widget-linking.ts`) rather than inventing new parsing — correct security posture for an untrusted launcher intent.
- **Wave/file-ownership analysis in plan 04's `<decisions>` block** is a genuine, checkable claim (file-disjointness across 21-03/21-04/21-05) rather than hand-waving, and it correctly identifies that 21-04 depends on 21-02 (not same-wave with it).

## Concerns

**HIGH — `deriveReachRoutes` purity claim conflicts with its own stated inputs (plan 00/02).**
Plan 00 Task 2 describes `deriveReachRoutes` as pure over an "actionable-primary pair" but plan 02 Task 3's acceptance criteria say it also returns `primaryPhone`/`primaryEmail` and is invoked as `deriveReachRoutes(selectActionablePrimaryMethods(methodGroups))`. This is consistent internally, but note the function signature changed identity between plan 00 (`{phone, email}` → routes) and is then relied upon by plan 02/03/05 for endpoint selection (`EndpointSelector` needs the *list* of endpoints per type, not just the primary pair). Plan 02's Task 1 (`ReachOutRouter`) says "for now use the primary endpoint" for the single-endpoint path, and plan 03 adds `EndpointSelector` reading from `listContactMethodGroups` directly — a *second* async read despite the "no-flash" claim being scoped only to route *visibility* derivation, not endpoint enumeration. This is fine functionally (the profile already awaits `methodGroups` in its unified read per plan 02 Task 3, so `EndpointSelector` in plan 03 could also receive the already-loaded groups) but plan 03's Task 1 `<read_first>` cites `listContactMethodGroups` directly as a data source without clarifying it reuses the profile's already-loaded `methodGroups` rather than re-querying — worth an explicit acceptance criterion that `EndpointSelector` receives `endpoints` as a prop (it does, per the signature: `EndpointSelector(props: { type, endpoints, onPick, onCancel })`) rather than querying itself. On reread, plan 03 Task 1's signature already takes `endpoints: ContactMethodRow[]` as a prop, so this is **actually fine** — downgrading to informational. No action needed, but flag that the "no second async read" invariant depends on every future caller of `ReachOutRouter`/`EndpointSelector` threading `methodGroups` through, which isn't enforced by any test.

**MEDIUM — `bumpDataRevisionCore` import path unverified.** Plan 00's `<read_first>` cites `src/db/data-revision-dao.ts` for `bumpDataRevisionCore` and the acceptance criteria grep for it in `interaction-assist-dao.ts`, but I could not independently verify this export exists with that exact name/signature (only the *research* doc's own citation of `recency-dao.ts:240` calling it, which is secondhand). If `bumpDataRevisionCore` has a different signature (e.g., takes an argument, or is not separately exported from `recordTouchpoint`'s closure), Task 1 of plan 00 will fail at green-gate time and require a scramble. Recommend the plan explicitly instruct the executor to `grep -n "export.*bumpDataRevisionCore" src/db/data-revision-dao.ts` as the very first read-verification step before writing any code, since the whole atomic-compose design depends on this being a standalone composable core.

**MEDIUM — `rejectFutureOccurredAt` guard runs against `handoff_at`, but `handoff_at` is stamped at *assist creation time*, not confirmation time — meaning the LOG-06 guard as designed only catches clock skew between creation and confirmation, not a corrupted `handoff_at` at write time.** Plan 00 correctly reasons "backward clock skew or corrupt handoff_at" as the threat, and the mitigation (checking at confirm time) is reasonable, but note this guard is a check against `now` (confirmation time) — if the device clock is skewed *forward* at assist-creation time and *also* skewed forward (consistently) at confirmation time, the guard won't catch it since both `handoff_at` and `now` are equally skewed. This is a low-probability edge (device clock would have to un-skew between handoff and confirmation) and the plan's own `21-PATTERNS.md` explicitly argues this guard is "unnecessary" since `handoff_at ≤ now by construction" — plan 00 overrides that with the more conservative HIGH finding. Both stances are defensible; flagging as MEDIUM only because the two source documents (PATTERNS.md vs the plan's own must_haves) disagree and the plan doesn't reconcile the disagreement in text — an executor reading PATTERNS.md first could reasonably conclude the guard is optional.

**MEDIUM — Plan 05's `guardWidgetIntent` refactor changes a shared function's return type but only lists a subset of callers in `files_modified`.** The plan's own `<read_first>` says "Update EVERY caller" but `files_modified` for plan 05 Task 2 only touches `widget-quick-action-guard.ts`, its test, `widget-linking.ts`/test, `types.ts`, `widget-render.tsx`, and `ContactProfileScreen.tsx`. If `guardWidgetIntent` has callers elsewhere in the widget stack (e.g., `widget-task-handler.tsx`, which plan 00/research repeatedly cites as reading widget intents) that aren't in this file list, the discriminated-result refactor will break `tsc --noEmit` at a file this plan doesn't declare it's touching — the acceptance criteria only check `npx tsc --noEmit` globally, which would catch it, but the plan's `files_modified` manifest would then be wrong/incomplete relative to actual changes, which matters for review/audit trail. Recommend adding a first-step acceptance criterion: `grep -rn "guardWidgetIntent" src/` to enumerate all call sites before the refactor, and either add missing files to `files_modified` or confirm there are none.

**LOW — `messageBody ?? ""` default and SMS body semantics.** `performReachOut`'s default `messageBody: string = ''` means a bare Call/Email/Text-without-Compose reach-out sends an *empty-body* SMS via `SMS.sendSMSAsync(endpoint, "")`. This matches the router's stated behavior (Text route with no draft) but worth confirming this is intentional UX (an empty pre-filled SMS composer) rather than an oversight — the UI-SPEC doesn't explicitly describe what the native Messages app shows when Reach Out → Text is tapped directly from a profile (as opposed to via Compose). Likely fine (mirrors tapping a phone number's "Text" quick action on stock Android), but not explicitly confirmed in the UI-SPEC.

**LOW — Plan 04's `setInteractionAssistEnabled` toggle-off "expire" vs plan 00's assist statuses.** Marking cleared assists `'expired'` (rather than a distinct `'cleared'`/`'dismissed-by-toggle'` status) means the 30-day retention/audit trail can't distinguish "aged out naturally" from "user turned off Assist while this was pending." This is explicitly logged as Assumption A3 in RESEARCH.md as low-risk and planning discretion, so this is not a new finding — just confirming the assumption is carried through consistently in plan 04 (it is).

**LOW — device-UAT time-travel technique is underspecified in the plan text vs the risk it's covering.** Plan 06 Task 1 offers two named strategies (DEBUG-lowered constants OR run-as backdate) but defers the actual choice to execution time ("record which technique is used per row"). Given the 15s/24h boundaries are load-bearing correctness properties (Cluster I, N) and are two of the harder-to-verify device rows, leaving the technique choice unplanned risks the UAT task discovering mid-flight that DEBUG-lowered constants require a source change that wasn't scoped into `files_modified` (none of plan 06's `files_modified` include `assist-eligibility.ts` or the sweep file, so if the DEBUG-constant approach is chosen it would need an undeclared file edit). Recommend the plan commit to the run-as backdate approach only (no source-code path), since it requires zero additional file edits and is lower-risk to the "reversible" plan01/04 boundary.

## Suggestions

- Add an explicit first acceptance-criterion step to plan 00 Task 1: verify `bumpDataRevisionCore`'s real export name/signature before treating it as a given in the `<action>` prose.
- In plan 05 Task 2, add a `grep -rn "guardWidgetIntent"` enumeration step to the action block so the discriminated-result refactor's blast radius is confirmed complete before/after the edit.
- Resolve the PATTERNS.md vs plan-00-must-haves disagreement about whether `rejectFutureOccurredAt` is "unnecessary" or "HIGH-severity required" with one sentence in the plan itself (e.g., "supersedes PATTERNS.md's earlier reasoning") so a future reader doesn't get whiplash.
- In plan 06, commit to the run-as `handoff_at` backdate technique only for the 15s/24h device rows, to avoid a mid-UAT scope surprise requiring an undeclared source edit.
- Consider explicitly stating in plan 02/03 that `ReachOutRouter`/`EndpointSelector` always receive `methodGroups`/`endpoints` as props from an already-awaited parent read (never self-query), since this invariant is currently implicit in the prop signatures rather than stated as a rule other future callers must follow.

## Risk Assessment

**LOW-MEDIUM.** This plan set has already absorbed multiple review cycles (visible in the extensive "Addresses review HIGH/MEDIUM" annotations) and the remaining structural risks are well-understood and mostly mitigated in the text. The two items I'd actually block on before execution are: (1) verifying `bumpDataRevisionCore`'s real signature before Task 1 of plan 00 starts (cheap to check, expensive to discover mid-execution given how much of the atomic-compose design depends on it), and (2) enumerating all `guardWidgetIntent` call sites before plan 05's refactor. Everything else is either already mitigated, low-probability, or a documentation/consistency nit rather than a functional risk.

---

## Cursor Review

# Cross-AI Plan Review — Phase 21: Interaction Assist & Reach Out

**Reviewed against:** `/home/bwales/projects/orbit-app` on disk (plans in `.planning/phases/21-interaction-assist-reach-out/`, authoritative dossier at `docs/dossier/21-interaction-assist-reach-out.md`).  
**Method:** Load-bearing claims traced to source files; plan text not taken on faith.

---

## Phase-Level Assessment

The six-plan set is source-grounded, dossier-aligned, and ready to execute. Plan 21-01 correctly targets the actual migration head (`TARGET_VERSION = 13`, `MIGRATIONS` through `migration013` in `src/db/database.ts:48-64`) and composes the non-mutexed recency cores the codebase already documents (`src/db/recency-dao.ts:414-428`, `src/db/transaction.ts:11-29`). Prior review cycles’ HIGH findings (mutex nesting, shared handoff divergence, LOG-06 parity, migration-fixture drift, merge/purge TOCTOU, opt-out banner freshness) are addressed in the committed plan text and match verified source locations. Wave ordering is coherent: tracer DAO (W1) → user-visible slice (W2) → parallel completion (W3) → consolidation + device gate (W4).

**Overall phase risk: LOW–MEDIUM** — correctness hazards are front-loaded into Plan 21-01 with strong acceptance criteria; native handoff, banner timing, RemoteViews render, and irreversible migration 014 remain honestly deferred to Plan 21-06 device UAT.

---

## Plan 21-01 — TRACER: Migration 014 + Assist DAO

### Summary

Plan 21-01 is the phase’s load-bearing plan. It correctly identifies the #1 invariant risk (a second `contacts.last_contact` writer) and routes confirmation through `insertInteractionCore` + `recomputeLastContactCore` + `bumpDataRevisionCore` inside one outer `inWriteTransaction`, mirroring the exported-core pattern at `src/db/recency-dao.ts:414-428` and the non-reentrancy contract at `src/db/transaction.ts:11-29`. It restores LOG-06 parity via `rejectFutureOccurredAt` (`src/db/log-guards.ts:68`, same pre-transaction shape as `recordTouchpoint` at `src/db/recency-dao.ts:227-231`) and closes the merge/purge TOCTOU by binding insert/recompute to an in-transaction full-row re-read, not a pre-transaction cache.

### Strengths

- **Single-writer path verified against real exports.** `recordTouchpoint` composes private helpers; the plan correctly uses the aliased cores, not the mutexed wrapper (`src/db/recency-dao.ts:217-243` vs `:425-428`). The sole `SET last_contact` lives in `recomputeLastContact` at `:164-175`.
- **LOG-06 guard is necessary and correctly placed.** Exported cores do not call `rejectFutureOccurredAt`; the plan’s pre-transaction guard matches `recordTouchpoint`’s reject-before-transaction pattern.
- **TOCTOU fix matches merge mechanics on disk.** `mergeContacts` reparents child tables then deletes the absorbed row (`src/db/merge-dao.ts:153`, `:185`); the plan’s in-txn `contact_id` bind correctly handles reparent-to-survivor or no-op-if-gone.
- **Migration fixture drift addressed in-plan.** `src/db/migrations/full-chain.test.ts:37-39` hard-asserts `TARGET_VERSION === 13`; Plan 21-01 includes updating `.toBe(14)` and a version-14 length assertion — verified necessary.
- **Idempotency is status-guarded, not error-sniffing** — appropriate given the non-reentrant mutex (`src/db/transaction.ts:15-17`).
- **`deriveReachRoutes` seam resolved.** Task 2 defines `deriveReachRoutes` as a **pure** function of `selectActionablePrimaryMethods(groups)` with no `exec`/SQL (`21-01-PLAN.md` Task 2, lines 146-149), aligning with Plan 21-02’s no-flash profile entry over already-awaited `methodGroups` (`ContactProfileScreen.tsx:243-263`).

### Concerns

- **MEDIUM — Pre-Plan-05 merge window (execution ordering).** Until Plan 21-05 adds `"interaction_assists"` to the reparent array at `merge-dao.ts:153`, a merge without reparent will CASCADE-delete pending assists when the absorbed `contacts` row is deleted (`ON DELETE CASCADE` on planned `contact_id` FK). Plan 21-01’s TOCTOU handling makes confirmation safe (no orphan interaction); the user may lose a pending prompt. Wave 3 must complete before any incremental device testing that exercises merge — acceptable if waves are treated as atomic.
- **LOW — Eligibility SQL cutoff implementation left implicit.** Task 2 requires SQL and `assist-eligibility.ts` to share `ELIGIBLE_AFTER_SECONDS` / `EXPIRE_AFTER_HOURS` against `handoff_at`, but does not explicitly require computing cutoff timestamp strings in JS and binding them as `?` params. Lexicographic compare works for well-formed `YYYY-MM-DD HH:MM:SS` (`log-guards.ts:11-15`), but parameterized cutoffs would reduce executor ambiguity.

### Suggestions

- In Task 2 action text, add one line: compute `eligibleAfter` / `expireBefore` strings in JS from `now` + shared constants, bind as `?` in `listEligiblePendingAssists`.
- Keep the TOCTOU regression test exactly as specified — it is the cheapest proof the cycle-3 HIGH stays closed.

### Risk Assessment

**LOW** — Acceptance criteria (grep gates, TOCTOU test, LOG-06 test, full-chain bump) are sufficient to catch the phase’s highest correctness hazards before UI work expands.

---

## Plan 21-02 — Reach Out Router + Banner + Profile Entry

### Summary

Plan 21-02 delivers the first user-visible vertical slice: shared router, write-before-handoff ordering, non-modal app-global banner, and profile entry. It correctly centralizes native launch in one `performReachOut` helper, follows existing SMS patterns in `ComposeScreen.tsx:436-458`, and mounts the banner in the `NavigationContainer` subtree (`App.tsx:291-303` — sibling overlay after `RootNavigator` is the correct pattern).

### Strengths

- **`performReachOut` as single handoff** — eliminates duplicated create/fail/Alert logic between router and Compose (Plan 21-03).
- **Failed-handoff semantics match shipped Compose behavior.** `ComposeScreen.tsx:446-448` already treats resolved `sendSMSAsync` as non-failure; plan extends that to Call/Email and forbids `canOpenURL`.
- **Banner architecture respects Cluster H.** Explicit prohibition of `Modal` in `AssistBanner.tsx`; overlay in `App.tsx` after navigator.
- **Canonical handoff value pinned.** Plan requires `canonical_value` via `actionablePrimaryPhoneDestination` (`src/logic/compose-logic.ts:51-57`), not `display_value`.
- **No-flash route derivation is mechanically sound.** Profile already awaits `listContactMethodGroups` in unified `Promise.all` (`ContactProfileScreen.tsx:243-252`); pure `deriveReachRoutes(selectActionablePrimaryMethods(methodGroups))` adds no second async read.
- **AppState refresh separate from launch sweep** — mirrors `installSweepTrigger` pattern (`src/services/launch-sweep.ts:14-17`, `App.tsx:244`) without conflating once-per-launch sweep with every foreground return.

### Concerns

- **LOW — Transitional raw `interaction_assist_enabled` read.** Task 1 reads the column directly until Plan 21-04/21-06 land the canonical getter. Plan 21-04/21-06 track cleanup; acceptable within wave structure.
- **LOW — Assist toggle read timing on profile open.** If settings change between opening router and handoff, behavior follows value at handoff time — consistent with user-initiated model.

### Suggestions

- When implementing `assist-store`, initialize to empty/null (no spinner) as specified.
- Ensure `performReachOut` stamps `endpoint_value` from the same `canonical_value` passed to native intents (operational context only, Cluster D).

### Risk Assessment

**LOW–MEDIUM** — UI/banner/back-button behavior is device-UAT-only (Plan 21-06); node-testable handoff ordering and store transitions are well specified.

---

## Plan 21-03 — Endpoint Selector + Compose Send Seam

### Summary

Plan 21-03 completes the ≤3-tap routing contract and wires Compose Send into the shared assist lifecycle per dossier Cluster AC. It reuses `listContactMethodGroups` (`src/db/contact-methods-read.ts:7-23`) and routes `onSend` through `performReachOut` with `messageBody: draft` instead of direct `SMS.sendSMSAsync` (`ComposeScreen.tsx:446` today). Compose currently writes no interaction at Send time — verified at `ComposeScreen.tsx:435`.

### Strengths

- **Cluster AC [DECIDED] correctly retained** with explicit decision block citing dossier — Send→assist→confirm, not direct interaction write.
- **Wave-3 parallelization with 21-04 is sound.** Raw column read for `assistEnabled` avoids serializing on DAO key; Plan 21-06 consolidates to `getAppSettings().interactionAssistEnabled`.
- **Endpoint selector uses `canonical_value` for handoff, `display_value` for labels** — matches `ContactMethodRow` shape and Compose precedent.
- **No scope creep into email compose** — email remains native `mailto:` handoff.
- **Wave-3 file ownership is disjoint** — verified: 21-03 touches `EndpointSelector`, `ReachOutRouter`, `ComposeScreen`; no overlap with 21-04/21-05 `files_modified`.

### Concerns

- **LOW — Compose failure Alert body text changes.** Shared UI-SPEC copy replaces Compose’s current body `"Your message is ready to copy instead."` (`ComposeScreen.tsx:451-453`). Plan documents this as deliberate consolidation; Copy fallback remains — owner-visible UX delta, not a correctness issue.

### Suggestions

- Preserve Compose’s `sending` latch around `performReachOut` (`ComposeScreen.tsx:437-438`) — prevents double composer launch.
- Add the M2 Phase 12 seam comment as planned.

### Risk Assessment

**LOW** — Narrow, additive UI + one handler change; grep acceptance criteria prevent reintroducing direct interaction writes.

---

## Plan 21-04 — Settings Toggle + Review Sheet + Launch Sweep

### Summary

Plan 21-04 completes the durable-queue lifecycle: default-on toggle with off-clears-queue, `{N} more pending` review surface, and timer-free launch-sweep prune. Settings wiring follows the proven `digestEnabled` pattern (`src/db/app-settings-dao.ts:252-276`, migration idiom in `005-digest-settings.ts`). The plan correctly notes that `updateAppSettingsCore` does not bump revision (`src/db/app-settings-dao.ts:610-616`) while `updateAppSettings` does (`:604-607`), and requires `bumpDataRevisionCore` in `setInteractionAssistEnabled`.

### Strengths

- **Opt-out banner freshness explicitly wired.** Must-have and Task 1 require `SettingsScreen` to `await useAssistBanner.getState().refresh()` after `setInteractionAssistEnabled` in the same user action (`21-04-PLAN.md:33-34`, Task 1 behavior `:117`, test at `:119`) — this closes the prior cycle HIGH where SQLite cleared but in-memory banner could persist until AppState transition. `assist-store` refresh is only on cold start, AppState, and post-resolve in Plan 21-02; the Settings handler is the necessary third trigger.
- **Backup portability specified.** `interactionAssistEnabled` in `PortableSettingsSnapshot` + `PORTABLE_SETTINGS_KEYS` (`src/backup/backup-schema.ts:106-113`) — mirrors `digestEnabled`.
- **“Off means off” is one transaction** — settings update + expire all pending + single revision bump.
- **Sweep follows project no-scheduler rule** — `registerSweepHook` (`src/services/launch-sweep.ts:45`), no `setTimeout`.
- **Double-expiry integration test (cap-5 + sweep)** — addresses composition risk between write-time prune and launch expiry.
- **Joint AppState test** — sweep once-per-launch vs banner every `background→active`.

### Concerns

- **LOW — Wave-3 extends files also touched by 21-02 (`assist-store.ts`, `AssistBanner.tsx`, `App.tsx`).** Plan 21-04’s `decisions` block correctly states 21-04 is Wave 3 **after** Wave 2 21-02 — sequential extension, not a race.
- **LOW — `interaction_assists` excluded from backup/export** (operational state). Consistent with Cluster X; permanent history lives in `interactions`.

### Suggestions

- Reuse `EXPIRE_AFTER_HOURS` from `assist-eligibility.ts` in the sweep module as specified.
- Ensure `setInteractionAssistEnabled` validation runs before txn open, mirroring `updateAppSettings` at `src/db/app-settings-dao.ts:601-604`.

### Risk Assessment

**LOW** — Well-trodden settings/sweep patterns; acceptance tests cover revision-bump, banner-freshness, and cap-5/sweep composition.

---

## Plan 21-05 — Merge Reparent + Purge Cascade + Widget Contact

### Summary

Plan 21-05 is the cross-phase correctness core. It adds `"interaction_assists"` to the reparent loop that currently omits it (`merge-dao.ts:153` — verified: array is `interactions`, `events`, `fuel`, etc., no `interaction_assists`), relies on CASCADE for purge (no `purge-dao.ts` change — purge deletes contact at `:261`), swaps widget Message→Contact (`widget-render.tsx:452-459` today emits `orbit://compose/${tile.id}`), and adds `orbit://reach/<id>` following the anchored allow-list pattern (`widget-linking.ts:91-105`).

### Strengths

- **Merge reparent matches dossier Cluster AA** — survivor redirect at merge time, not lazy lookup at confirmation.
- **Widget remains writer-free** — `widget-task-handler.tsx:78-83` confirms OPEN_URI writes nothing headless.
- **Discriminated `guardWidgetIntent` refactor** — necessary because current guard collapses missing and archived into one `null` return (`widget-quick-action-guard.ts:33-35`), preventing purged vs archived UX split.
- **Migration fixture bumps explicit** — `merge-dao.test.ts:21,34` (migrations through 013, target 13) must reach 014 for assist tests.
- **`openReachOut` consume-once** — prevents widget deep-link reopen loop; device-verified in Plan 21-06.
- **`files_modified` includes guard files** — prior omission corrected.

### Concerns

- **MEDIUM — Phase 20 roadmap dependency vs executable merge path.** `.planning/ROADMAP.md:920` lists Phase 21 depending on Phase 20; progress table shows Phase 20 incomplete. However, `mergeContacts` and `MergeImpactSummary.tsx` already ship — reparent addition is correct regardless, but Cluster AA redirect is only user-testable once merge is reachable in production flows.
- **LOW — Stale guard doc comment.** `widget-quick-action-guard.ts:16-17` says Profile allows “either lifecycle state,” but `:34-35` blocks archived for all routes. Plan behavior (archived → silent drop) matches **code**, not comment — executor should trust the `if`, not the docstring.
- **LOW — Unbound widget Contact → Reach Out.** Aligns with dossier Cluster Y; current guard allows Unbound Profile (`widget-quick-action-guard.test.ts` pattern).

### Suggestions

- Add one executor note in Task 2: ignore stale doc comment at `widget-quick-action-guard.ts:16-17`.
- In `WidgetLinkingGate`, branch on REACH vs non-REACH when mapping discriminated guard results — ensure tests cover `orbit://contact/` (silent drop) vs `orbit://reach/` (purged message) for `reason: 'missing'`.

### Risk Assessment

**LOW–MEDIUM** — Security-sensitive deep-link surface follows proven patterns; merge UI availability is the main sequencing caveat.

---

## Plan 21-06 — Full-Suite Gate + Pixel UAT

### Summary

Plan 21-06 closes device-only gaps honestly: full node gate, consolidation of transitional settings reads onto `getAppSettings().interactionAssistEnabled`, driven Pixel matrix with run-as DB verification, explicit BLOCKED checkpoints for owner sign-off and genuine handoff-failure cases, and documented time-travel for 15s/24h rows.

### Strengths

- **Raw-read retirement is wave-safe.** ContactProfileScreen (21-02) and ComposeScreen (21-03) edits land in Wave 2/3; consolidation in Wave 4 avoids same-wave conflicts.
- **DB verification requirement** — aligns with CLAUDE.md “Review the code, not the diff”; UI render alone insufficient.
- **Time-travel strategy** — pragmatic for 15s buffer / 24h expiry without flaking device tests.
- **Widget reopen-loop + freshness rows** — closes prior findings with behavioral verification.

### Concerns

- **MEDIUM — Device UAT is the real release gate for migration 014.** Irreversible on user devices; node tests cannot substitute for native intents, AppState banner timing, or RemoteViews render.
- **LOW — Handoff-failure rows may be BLOCKED on a device that always has dialer/messages/mail.** Plan correctly marks these as owner checkpoints, not auto-pass.
- **LOW — UAT DB inspection cannot prove sole-writer composition.** Run-as can prove `occurred_at`, `source`, `connected`, and resulting `last_contact`; structural assurance remains Plan 21-01’s node tests and grep gates.

### Suggestions

- Record per-row time-travel technique in `21-UAT.md` as specified.
- Reword the sole-writer UAT criterion to: “DB evidence proves interaction field values and resulting `last_contact`; Plan 21-01 structural tests prove authoritative writer composition.”

### Risk Assessment

**MEDIUM** (inherent to device gate, not plan quality) — Plan structure is appropriate; residual risk is execution/evidence capture, not missing scenarios.

---

## Cross-Cutting Verification

| Invariant | Status | Evidence |
|-----------|--------|----------|
| DATA-04 single writer | **Plan OK** | Cores at `recency-dao.ts:425-428`; sole `last_contact` UPDATE in `recomputeLastContact` `:164-175` |
| No mutex nesting | **Plan OK** | `transaction.ts:11-17`; plan forbids calling `recordTouchpoint` from `markAssistLogged` |
| LOG-06 future-date guard | **Plan OK** | `rejectFutureOccurredAt` at `log-guards.ts:68`; `recordTouchpoint` precedent `:227-231` |
| Merge/purge TOCTOU | **Addressed in Plan 21-01** | In-txn full re-read + test; reparent in Plan 21-05 at `merge-dao.ts:153` |
| Migration 014 = TARGET 14 | **Plan OK** | Head is 13 (`database.ts:48`); `full-chain.test.ts:39` update in Plan 21-01 |
| Local-first / no passive monitoring | **Plan OK** | No network, permissions, or observation paths in any plan |
| Opt-off banner freshness | **Addressed in Plan 21-04** | Settings handler `refresh()` after DB clear; store test specified |
| `deriveReachRoutes` no-flash seam | **Plan OK** | Pure function in Plan 21-01 Task 2; profile uses awaited `methodGroups` |
| Widget no assist writer | **Plan OK** | `widget-task-handler.tsx:78-83`; deep-link only |
| Interactions schema accepts `source='assist'` | **Plan OK** | Free TEXT, no CHECK (`001-initial.ts:97-110`) |

---

## Residual Items for Planner/Owner (Not Blockers)

1. **Treat Waves 1–3 as atomic before merge/device UAT** — pending assists on absorbed contacts are CASCADE-lost until Plan 21-05 lands (`merge-dao.ts:153` + planned FK).
2. **Parameterize eligibility SQL cutoffs in JS** (Plan 21-01 Task 2) — one sentence reduces executor ambiguity.
3. **Confirm Phase 20 merge/reconcile flows are user-reachable** before treating Cluster AA redirect as production-validated (DAO exists; roadmap checkbox may lag).

---

## Convergence Verdict

**Proceed to execution.** No new HIGH findings. Prior-cycle HIGHs (transaction nesting, shared handoff, idempotency, LOG-06, TOCTOU, migration fixture, opt-off banner freshness, `deriveReachRoutes` seam) are present in committed plan text and grounded in verified source locations. Remaining concerns are LOW–MEDIUM execution hygiene and the expected, honestly scoped device/UAT gate in Plan 21-06.

**Overall risk: LOW–MEDIUM.**

---

## Verification Coverage

Two orchestrator-run passes supplement the CLI reviews. Both were executed by reading the code on disk (per CLAUDE.md "Review the code, not the diff"), not the plan text.

### 1. Source-grounding pass (authority = `grep`)

Every concrete symbol the six plans cite as **pre-existing** infrastructure was enumerated and grep-verified against source. Excluded (per convergence contract): each plan's own "artifacts this phase produces", plus the two produced/refactored artifacts `selectActionablePrimaryMethods` and `deriveReachRoutes`.

**Result: every cited pre-existing symbol VERIFIED. Zero MISSING, zero AMBIGUOUS, zero hardBlock.** Severity gating (`drift-guard severity --authority grep`) returns `hardBlock:false` for all statuses under grep authority, so no source-grounding finding can hard-block regardless — moot here since nothing missed.

Load-bearing citations confirmed exact on disk:

| Symbol / claim | Verdict | Evidence |
|---|---|---|
| `recomputeLastContactCore` = SOLE `contacts.last_contact` writer (DATA-04) | VERIFIED | only `UPDATE … SET last_contact` in `src/` is `recency-dao.ts:166` (in `recomputeLastContact`, re-exported `:427`); every other `last_contact` hit is a read/comment/call |
| `insertInteractionCore` / `recomputeLastContactCore` export aliases | VERIFIED | `recency-dao.ts:426-427` (alias block `:415-428`) |
| `recordTouchpoint` mutexed wrapper (do-not-call) | VERIFIED | `recency-dao.ts:217`; LOG-06 guard call `:228` |
| `bumpDataRevisionCore` (standalone, single `exec` arg) | VERIFIED | `data-revision-dao.ts:5` |
| `rejectFutureOccurredAt` (LOG-06) | VERIFIED | `log-guards.ts:68` (exact) |
| `inWriteTransaction` non-reentrant | VERIFIED | `transaction.ts` (non-reentrancy doc `:11-29`) |
| `TARGET_VERSION` = 13 (plan bumps → 14) | VERIFIED | `database.ts:48`; `MIGRATIONS` 001–013 `:51-64`; migration files 001–013 present |
| `full-chain.test.ts` `.toBe(13)` + `version===13` length assert | VERIFIED | `full-chain.test.ts:37-39` (the exact lines Plan 01 updates) |
| merge reparent loop (lacks `interaction_assists` today) | VERIFIED | `merge-dao.ts:153`; absorbed `DELETE FROM contacts` `:185` |
| `purgeContact` cascade trigger + FK enforcement | VERIFIED | `purge-dao.ts:261`; `PRAGMA foreign_keys = ON` at `database.ts:136`, migration runner, and testkit `__testkit__/node-sqlite.ts:21` |
| migration 014 DDL: `contact_id … ON DELETE CASCADE` + `modified_at` (reparent + cascade prereqs) | VERIFIED | Plan 01 Task 1 DDL |
| `listActionablePrimaryMethods` (refactor host) + callers | VERIFIED | `contact-methods-read.ts:30`; `ComposeScreen.tsx:67,:292`; `contact-methods-read.test.ts:4,:93,:105` — signature unchanged by the extraction, so callers/tests stay green |
| profile unified read holding `methodGroups` (no-flash seam) | VERIFIED | `ContactProfileScreen.tsx:243-252` awaits `listContactMethodGroups` into state |
| `updateAppSettings` bumps / `updateAppSettingsCore` does not | VERIFIED | `app-settings-dao.ts:606` vs `:617`; `PORTABLE_SETTINGS_KEYS` + `digestEnabled` `backup-schema.ts:106-107` |
| widget Message action → `orbit://compose/${tile.id}` (to be swapped) | VERIFIED | `widget-render.tsx:454/:458` |
| `guardWidgetIntent` returns `WidgetNavIntent \| null` (refactor premise) | VERIFIED | `widget-quick-action-guard.ts:20`; null-for-missing-or-archived `:34` |
| widget OPEN_URI writer-free (no headless assist writer) | VERIFIED | `widget-task-handler.tsx:80` |
| interactions schema accepts `source='assist'` (free TEXT, no CHECK) | VERIFIED | `001-initial.ts` |

**Produced/refactored artifacts (correctly absent from `src/` now):** `selectActionablePrimaryMethods`, `deriveReachRoutes` (net-new — no pre-existing exec-based version exists, so the "PURE, no exec" framing is a design choice for a new function, internally consistent), plus `interaction-assist-dao.ts`, `interaction-assist-read.ts`, `assist-eligibility.ts`, `assist-store.ts`, `interaction-assist-sweep.ts`, `AssistBanner.tsx`, the `interaction_assists` table / `interaction_assist_enabled` column / `REACH_URI` / Profile `openReachOut` param.

**Minor line-number drift (symbol confirmed; non-blocking):** `actionablePrimaryPhoneDestination` cited `compose-logic.ts:57`, actual `:51`; `insertInteraction` body cited `:178`, actual `:179`; digest-sweep example path cited `src/services/digest-schedule.ts`, actual `src/services/notifications/digest-schedule.ts`. None affect a verdict.

**UNCHECKABLE / skipped:** none — all excluded symbols are this phase's own produced artifacts (listed above), verified absent as expected.

### 2. Cross-artifact fact-drift (advisory — NEVER counts)

`drift-guard phase-status --phase 21` → verdict **`lag`** (STATE.md "Ready to execute" rank 1 vs ROADMAP "Not started" rank 0; authority STATE.md). This is `lag`, not `drifted` — advisory only, ignored per the convergence contract, and does not count toward findings.

## Verdict

**Proceed to execution.** No unresolved HIGH concerns. One actionable non-HIGH (banner `{name}` data source — see below) should be pinned in Plan 01/02 before execution; it is a cross-plan interface gap invisible to `/gsd-execute-phase` as the plans stand. All other reviewer concerns are either already incorporated into the PLAN.md acceptance criteria, covered by the source-grounding pass, or LOW execution-hygiene suggestions.
