---
phase: 27
reviewers: [codex, claude]
reviewed_at: 2026-09-05T18:05:00Z
cycle: 4
plans_reviewed: [27-01-PLAN.md, 27-02-PLAN.md, 27-03-PLAN.md, 27-04-PLAN.md, 27-05-PLAN.md, 27-06-PLAN.md]
models:
  codex: "gpt-5.6-terra (reasoning=low)"
  claude: "claude-opus-4-8"
model_sources:
  codex: "banner"
  claude: "self"
mechanism_note: "The --claude lane was NOT run via the `claude -p` CLI (this review executes inside Claude Code — the self-CLI is skipped for independence, and the headless lane has the known Write-permission/trust gap). Per the owner's explicit approval, the Claude lane was performed by the orchestrator as a read-only, source-grounded analysis (every cited file:line opened and verified on disk) and aggregated here as the Claude lane."
---

# Cross-AI Plan Review — Phase 27 (Dashboard List View) — Cycle 4

This is CYCLE 4 of a plan-review convergence loop. As of cycle 3 there were 0 HIGH and 9
MEDIUM/LOW actionables, all addressed in commit ace15cf. This cycle re-verifies that the
cycle-1/2/3 resolutions hold against the code on disk and looks for anything newly exposed.

## Consensus Summary

The six plans are **exceptionally well-grounded in the current codebase**. Both lanes
independently confirmed that the load-bearing file:line anchors are accurate on disk and that
every cycle-1/2/3 resolution is present and correctly cited (see "Resolved-items re-verification"
below). The plans correctly identify the real gaps — the missing List read-model fields, the
standalone migration-020 boundary, the existing Quick Log behaviour, the real Dashboard route
names, the search-corpus privacy/N+1 defects, and the D-12 relevance ordering — and back them with
tests.

**One new execution-affecting gap emerged this cycle, raised by Codex and independently confirmed
by the Claude lane against source:** Plan 04 specifies the optimistic-favourite overlay/generation
controller purely as logic but never names the **React-state binding** that makes `overlayFor()`
reactive. As written, a `useRef`-held pure controller mutated by `begin`/`resolve` triggers no
re-render, so the "immediate fill/unfill" and revert-on-failure requirements (LISTV-04 E5) can
silently fail on device while **all automated tests pass** (the pure `favourite-optimistic.test.ts`
is green regardless). This is the single blocker; the fix is a small, surgical PLAN.md addition.

Two smaller actionable clarifications remain (Plan 03 budget/visibility ordering — latent today;
Plan 05 Quick Log testability shape). Everything else is a nit or cosmetic line-drift the executor
self-corrects via the on-disk verify anchors.

### Agreed Strengths
- The tracer (Plan 01) targets real gaps: `DashboardRow` has neither recency nor snooze today
  (dashboard-read.ts:91-113) and both projections omit them (:369/:421); the additive widen is the
  correct seam and `BASE_WHERE` (:172) is correctly left untouched. Both lanes verified.
- The `row()` fixture trap (widget-data.test.ts:23-38) is real and correctly pre-empted — an
  explicitly-typed `DashboardRow` literal that fails `tsc` once the fields become required.
- Migration 02 accurately reflects the irreversible boundary: DB at version 19, migrations 001-019
  registered (database.ts:54/:57); head+1 = 020 confirmed; the full writable-key analysis
  (PortableSettingsSnapshot → AppSettingsPatch, WritableSettingsKey, COLUMN_OF) is sound.
- Plans 03/06 correctly route corpus visibility through the existing choke points
  (`resolveVisibility` memories-read.ts:101, `resolveRelationshipVisibility` relationships-read.ts:39),
  fix the `deleted_at`-only leak (knowledge-search-read.ts:104/:135), replace the per-contact
  `getValuesForContact` N+1 (:281), and preserve the quarantine JOIN + live-def-id restriction
  (field-values-dao.ts JOIN; listDefs includeQuarantined:false at :206).
- Plan 05's route/haptic tracing is precise: `LogContact` (DashboardStack.tsx:37) and `Edit` (:57)
  are the real routes (no `EditContact`); the FAB's Success haptic fires after the write resolves
  (UniversalFab.tsx:255) while the Light impact (:165) is dial-open only.
- Plan 06 preserves the product's D-12 relevance decision: `searchDashboard()` already sorts
  coverage → score → Dashboard-tie-break (dashboard-search-match.ts:131-146), and the composition
  preserves that order rather than restoring SQL order.

### Agreed Concerns
- **HIGH (both lanes) — Plan 04 optimistic overlay has no render-invalidation mechanism.** The
  pure controller (`begin`/`overlayFor`/`resolve`) is never bound to React state; a ref-held
  object mutated by those methods re-renders nothing. renderItem currently reads
  `item.favourite_rank !== null` directly (HomeScreen.tsx:688). Immediate optimistic flip and
  revert-on-failure fail silently; automated tests still pass. Blocker.

### Divergent Views
- **Plan 06 test-fixture completeness (Codex LOW).** Codex flags that `dashboard-read.test.ts`
  bootstraps only migrations 001-011 (verified, :57-72), while the new corpus/composition tests
  need the 016+ knowledge tables. The Claude lane concurs the fact is true but rates it **below
  actionable**: a missing table surfaces as a loud test failure (not silent), and
  `knowledge-search-read.test.ts` already exists as a full-chain fixture model, so the new
  `dashboard-search-read.test.ts` author will naturally bootstrap the needed chain. Noted, not
  counted as a blocker.

## Resolved-items re-verification (do NOT re-raise — confirmed still holding)

All cycle-1/2/3 resolutions listed in the convergence context were verified present and
source-accurate this cycle:
- BASE_WHERE exists at dashboard-read.ts:172 (known false positive — confirmed exists).
- D-12/DASHQ-09 relevance-first ordering preserved (dashboard-search-match.ts:131-146).
- is_current = 1 current-state predicate (current-state-history-read.ts:31/:48).
- resolveVisibility / resolveRelationshipVisibility choke points reused (not raw hidden=1).
- Per-contact ROW_NUMBER() bound; batched custom-value read (no N+1); quarantine JOIN + live-def
  restriction (listDefs includeQuarantined:false at :206).
- Typed nav to real routes LogContact/Edit (no EditContact).
- widget-data.test.ts row() fixture defaults; exported statusDisplayLabel (STATUS_LABEL single
  source); snippet==null guard; line-3 skip in list-search; favourite mutation-generation +
  overlay logic (logic correct — only its React binding is unspecified, see the HIGH above).

## Codex Review

**Model:** gpt-5.6-terra (reasoning=low). Source-grounded (workspace-write; opened cited files).

### Summary
Six plans unusually well-grounded in the current codebase — correct read-model gaps, migration
boundary, Quick Log behaviour, route names, and search corpus privacy/perf defects; sensible wave
ordering; meaningful tests for prior findings. **One remaining execution-blocking gap:** Plan 04's
optimistic-favourite controller is a mutable pure overlay with no specified React
state/subscription to make its mutations re-render HomeScreen — so the star cannot reliably become
immediate or revert on settlement.

### Concerns
- **HIGH — Plan 04's optimistic overlay has no render invalidation.** The plan defines
  `begin`/`overlayFor`/`resolve` and renders `overlayFor(contactId) ?? (favourite_rank !== null)`,
  but specifies no state update / external-store subscription / reducer dispatch when the controller
  mutates. HomeScreen renders from React state (`rows` at :184, `setRows` at :312/:313) and
  renderItem reads `item.favourite_rank` directly (:680/:688); a `useRef`-held controller changes no
  rendered props. Immediate fill/unfill fails; a latest-gen failure notifies without visually
  reverting. **Required correction:** specify per-contact overlay React state (e.g.
  `useState<Map<number, boolean>>` + a version, or a subscribed store) updated synchronously after
  `begin` and after an `applied` `resolve`; keep the generation logic pure/tested but make the
  controller→React adapter explicit.
- **MEDIUM — Plan 03 bounded SQL must rank visibility-compatible rows before the per-contact
  budget.** The `ROW_NUMBER()` budget is applied in SQL but `resolveVisibility` runs in TS after
  the window. A `hidden = null` row of a future `visibilityDefault: "hide"` type could occupy the
  budget and starve a later visible row → false completeness prompt. Latent today (all memory types
  default `show`, memory-registry.ts). Define (a) a safe SQL predicate covering known default-hidden
  types + the TS choke point, or (b) over-fetch per contact before TS filtering then re-cap; add a
  regression test.
- **MEDIUM — Quick Log extraction needs an explicit dependency/testability contract.** Plan 05
  permits a hook or an injected command but requires vitest coverage; the repo is node/vitest-only
  (no hook renderer). Choose the injected per-instance `runQuickLog(deps)` shape, define its
  dependency interface (writer, clock/UID, notifier, refresh fns, snackbar, undo controller, pending
  ref), and make `useQuickLog` a thin adapter if kept.
- **LOW — Plan 06 snapshot fixture migration-completeness.** `dashboard-read.test.ts` bootstraps
  only through migration 011 (:57-72); corpus/composition tests need memories/relationships/
  current-state/custom-field tables from later migrations. State which setup runs 016-019 (and 020
  when required). Test-fixture clarification, not a design blocker.

### Risk assessment
After the HIGH is fixed, implementation risk is **moderate** — shared Dashboard reads, a one-way
migration, gesture/nav plumbing, search composition — but strong local tests, explicit cancellation
rules, and device UAT mitigate. Highest residual runtime risks: on-device gesture behaviour and
large-dataset search perf, both covered by planned Pixel validation + batched reads. No unresolved
security/data-migration design issue beyond the already-gated migration.

---

## Claude Review

**Model:** claude-opus-4-8. Mechanism: read-only source-grounded analysis by the orchestrator
(the `claude -p` CLI lane is skipped inside Claude Code and has the known Write-permission gap;
owner explicitly approved performing this lane directly). Every cited anchor below was opened and
verified on disk.

### Summary
The plans are the most source-accurate I have reviewed in this loop. I independently opened and
verified **every** load-bearing anchor the plans cite — dashboard-read.ts (BASE_WHERE:172,
snooze:175, favourite_rank:100, isFavourite:108, CARD_FAVOURITE_RANK:152-153 used at :375/:428,
listFavourites:465-470, termPredicate:416), database.ts TARGET_VERSION=19 + migration head 019,
widget-data.test.ts row() factory:23-38, current-state-history-read.ts is_current:31/:48,
memories-read.ts resolveVisibility:101, relationships-read.ts resolveRelationshipVisibility:39,
DashboardStack.tsx LogContact:37/Edit:57 (no EditContact), knowledge-search-read.ts deleted_at-only
:104/:135 + getValuesForContact N+1:281 + listDefs includeQuarantined:false:206, field-values-dao.ts
custom_field_defs JOIN, UniversalFab.tsx Light:165/Success:255, dashboard-search-match.ts relevance
sort:131-150 — **all correct**. No anchor error found. The KNOWN FALSE POSITIVE (BASE_WHERE) is
confirmed to exist. All cycle-1/2/3 resolutions are present and correctly reflected.

### Concerns
- **HIGH — I concur with the Codex overlay render-invalidation finding after independent source
  verification.** I confirmed on disk that (1) HomeScreen renderItem reads `item.favourite_rank !==
  null` directly from `rows` state (HomeScreen.tsx:688), and (2) Plan 04 contains **no** `useState`,
  `setState`, `useReducer`, `useSyncExternalStore`, subscription, or force-update mechanism for the
  overlay — a grep of 27-04-PLAN.md returns none. The plan's repeated framing — "PURE controller
  owning a per-contact map", `begin` "bumps"/"records", `resolve` "clears", "no render harness
  needed", "node-tested" — actively steers toward a mutable ref-held object that would not
  re-render. The overlay/generation *logic* is correct and complete; only the imperative
  controller→React binding is missing. Because the pure `favourite-optimistic.test.ts` passes
  regardless of that binding, a wrong (ref-based) implementation would ship green and only the
  device human-check would catch it. This is substantive and execution-affecting. **Fix:** add one
  acceptance criterion / action sentence requiring the overlay to be held in React state (pure
  reducer helpers over a `useState<Map<number, boolean>>`, or a small store consumed via
  `useSyncExternalStore`) so `begin` and a latest-`resolve` re-render synchronously; keep the pure
  reconciliation logic + its node test.
- **MEDIUM (actionable, latent) — I concur with Codex on Plan 03's TS-visibility-after-SQL-budget
  ordering.** Verified memory-registry.ts: all four `visibilityDefault` values are `"show"`, so the
  starvation cannot manifest with any shipping type — but the plan explicitly tests a stubbed
  `visibilityDefault:"hide"` type, and against such a type a null-hidden row could consume the
  per-contact `ROW_NUMBER()` budget before the TS choke point drops it, yielding a false
  completeness prompt. Invisible + silent (no test failure), so actionable, but zero impact today.
  **Fix:** one plan sentence — over-fetch beyond `candidateBudget` per contact before the TS
  visibility filter and re-cap, OR document the all-types-default-`show` assumption + a forward
  note.
- **MEDIUM (actionable) — I concur with Codex on Plan 05's Quick Log testability shape.** The plan
  states the `useQuickLog()` hook as **preferred**, yet the repo is node/vitest-only (no
  hook/RN-render harness — consistent with Plan 04's own admission) and Plan 05 *requires* vitest
  coverage of the capture path (success/single-flight/failure-retry/undo). The preferred shape is
  the untestable one. **Fix:** mandate the injected `runQuickLog(deps)` command as the testable
  core (hook, if retained, a thin per-instance adapter over it), so the required tests are
  satisfiable without adding a hook-test framework.

### Nits / cosmetic (NOT actionable — executor self-corrects via on-disk verify anchors)
- Minor line-drift in a few citations (e.g. field-values-dao.ts JOIN cited near ":29-33", actual
  JOIN ~:31; UniversalFab ":158/:165" — only :165 is the impactAsync). All carry accurate on-disk
  verify anchors; no execution impact.
- The Plan 06 test-fixture note (Codex LOW) is real but self-surfaces as a loud test failure and
  has an existing full-chain model (knowledge-search-read.test.ts); below the actionable bar.

### Risk assessment
**MEDIUM**, reducing to **LOW-MEDIUM** once the Plan 04 overlay render binding is specified. The
data-layer discipline (parameterized reads, choke-point visibility, per-contact bounds, quarantine
boundary, forward-only migration 020) is sound and privacy-preserving; no decision-reversal, no
local-first violation, no worktree/push risk. No owner-escalation trigger found (no recorded
ADR/HANDOFF/DASHQ/LISTV/D-NN control is deleted, weakened, or inverted by any plan).
