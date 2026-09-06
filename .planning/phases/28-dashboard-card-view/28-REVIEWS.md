---
phase: 28
cycle: 4
reviewers: [codex, claude]
reviewed_at: 2026-09-06T08:05:00Z
plans_reviewed: [28-01-PLAN.md, 28-02-PLAN.md, 28-03-PLAN.md, 28-04-PLAN.md, 28-05-PLAN.md, 28-06-PLAN.md, 28-07-PLAN.md]
models:
  codex: "gpt-5.6-terra (reasoning=low)"
  claude: "claude-opus-4-8"
model_sources:
  codex: "banner"
  claude: "orchestrator (read-only subagent — CLAUDE_CODE_ENTRYPOINT self-skip workaround)"
summary:
  current_high: 0
  current_actionable: 1
---

# Cross-AI Plan Review — Phase 28 (Dashboard Card View) — CYCLE 4

Both reviewers reviewed the CURRENT 7 plans on disk (post commit `fa06779`, the cycle-3
replan) under the project mandate: **review the code on disk, not the diff/plan text;**
verify every `file:line`; treat any decision reversal (HANDOFF / ADR / D-01..D-12) as an
owner-escalation HIGH. The orchestrator independently re-verified every finding below
against source before counting it.

The cycle-4 replan (`fa06779`) touched only Plans 04/05/06 — the three cycle-3 MEDIUM
UI-wiring findings — and STATE.md; Plans 01/02/03/07 are byte-identical to cycle 3, where
both reviewers cleared them. `git show --stat fa06779` confirms this scope.

## Consensus Summary

- **No HIGH findings. No decision reversals.** Both reviewers independently confirmed no
  recorded decision (HANDOFF, ADR-010/018/024/025/033/071/075, D-01..D-12) is deleted,
  weakened, or inverted, and no data-layer / local-first / migration red line is crossed
  (no schema change — D-03). The bulk data layer (Plan 02) remains correct-by-construction:
  N composed non-mutexed `*Core` primitives in ONE `inWriteTransaction`, the single recency
  writer preserved (ADR-010/024/071), the immutable lifecycle-event trail preserved
  (ADR-025), a single `bumpDataRevisionCore` per op (D-04), no set-based mutation, no mutex
  nesting (D-05).
- **All three cycle-3 MEDIUM UI-wiring fixes are now correctly incorporated** into Plans
  04/05/06 (must_haves, read_first, action, acceptance_criteria), with every new `file:line`
  citation verified accurate against source by both reviewers and the orchestrator:
  - **Finding 1 (28-04 view-independent search descriptors):** `isListSearch` at
    `HomeScreen.tsx:558`, `composeDashboardSearch` producer branch at `:573`, empty
    `resultsByContactId` else branch at `:583/588`, candidate gate at `:601`,
    `isListSearchMode` at `:772` — all confirmed list-only on disk; the plan widens both the
    descriptor gate and the candidate gate view-independently and keeps search/adaptive
    line-3 mutually exclusive.
  - **Finding 2 (28-05 direct LogContact route):** `onLogInteraction` at
    `HomeScreen.tsx:412-425` is genuinely preference-gated (opens `LogContact` only when
    `dashboardRightSwipeAction === "log-contact"`, else `logQuickly`); the direct helper
    `navigateDashboardContactAction` exists at `:133-141`. Plan 05 routes the card menu (and
    the a11y action) to the direct `navigateDashboardContactAction(id, "LogContact")` and
    explicitly bars reuse of the gated handler.
  - **Finding 3 (28-06 awaited 2-arg setViewMode + failure path):** `setViewMode` at
    `dashboard-query-store.ts:79-89` is `async (exec, viewMode)` and carries an idempotency
    guard on disk; the existing idiom `setViewMode(getExecutor(), mode)` is at
    `HomeScreen.tsx:540`. Plan 06's `await setViewMode(getExecutor(), "card")`-before-
    `enterSelection`, the persist-failure path (report + do not enter selection), and the
    already-card fast-path all match.
- **All cycle-1/2 fixes remain SOUND** — both reviewers confirmed independently; nothing
  regressed.

### Agreed Strengths (2+ reviewers)
- The three cycle-3 UI-wiring corrections are necessary and correctly targeted; the widened
  search/candidate gates, the direct detailed-log route, and the awaited persisted view
  switch all match repository constraints on disk (`HomeScreen.tsx:558/601/412`,
  `dashboard-query-store.ts:79`).
- Bulk writers correctly require extracted non-mutexed cores: `contacts-dao.ts:536/541`,
  `favourites-dao.ts:32`, `snooze-dao.ts:79`, `transaction.ts:49` — each existing API opens
  its own txn and bumps revision, so nesting under the shared non-reentrant mutex would
  deadlock; Plan 02's composed-`*Core` approach is the only correct one.
- Quick Log pins `direction: "outbound"` where the reusable insert core defaults it to
  `null` (`recency-dao.ts:178/205`); archive preserves its immutable event trail via
  `recordEventCore` (`contacts-dao.ts:541`) rather than a set-based update.
- GroupLog route-param handoff is additive/serializable over the parameterless placeholder
  (`navigation/types.ts:34`); frozen-universe double fence intact (store guard Plan 03 +
  render filter Plan 06; re-query paths at HomeScreen ~678/690/706).

### Agreed Concerns (2+ reviewers)
- None. The two items below were raised by Codex only; Claude (deep on the data-layer /
  frozen-universe surface) reached zero actionable findings and recommended closing the loop.

### Divergent Views
- **Codex raised two items Claude did not; the orchestrator verified both against source and
  counted one.**
  - Codex **LOW (Plan 01 hit-target)** — COUNTED as the one actionable finding. Verified: the
    `md` icon is 20px (`icon-size.ts:16`) and `hitSlop={SPACING.sm}` is 8px
    (`spacing.ts:12`), so the plan's stated mechanism yields a 36px target — below the plan's
    own must_have E4 (">=44px hit area") and CARDV a11y floor. The repo's established pattern
    (`ListRow.styles.favouriteButton { minWidth/minHeight: SPACING["2xl"] = 48px }`,
    `ListRow.tsx:342-347`) achieves the floor via a min touch-box, NOT hitSlop; `spacing.ts:8`
    explicitly warns "44×44 minimum touch target is a floor, not a spacing token." Plan 01's
    automated gate (tsc + check:colors) would not catch this, so it is a real, verifiable
    execution gap, not style. **Actionable.**
  - Codex **MEDIUM (Plan 03 seed-membership guard)** — NOT counted. Codex is correct that
    `enterSelection(universe, seedId?)` inserts `seedId` without a `universe.includes(seedId)`
    check while only `toggle()` is fenced (`28-03-PLAN.md:86`). But both wired callers pass an
    in-universe seed: Plan 05 seeds the long-pressed card's id, which is by construction a
    member of `currentEligibleIds = rows.map(r => r.id)`; Plan 06 passes no seed. No wired
    path admits an out-of-universe seed, so `/gsd-execute-phase` produces correct behavior; the
    finding is defensive hardening against a hypothetical caller error, not a defect in the
    plans as written. Claude, who manually traced the frozen-universe surface, independently
    did not flag it. Under this cycle's convergence calibration it is a reasonable optional
    consistency improvement, not an actionable blocker. Recorded here so the owner/executor
    may add the guard if desired.

---

## Codex Review

*Model: gpt-5.6-terra (reasoning=low). Source-grounded (repo read access).*

### Summary
The plans are largely execution-ready. Prior high-risk fixes remain sound against the
current code: the recency/event composition strategy, the view-independent search
correction, the direct detailed-log routing, and the awaited persisted Card-view switch all
match repository constraints.

### Strengths
- Bulk writers correctly need extracted non-mutexed cores: current archive, favourite, and
  snooze APIs each open their own transaction and bump revision, so nesting them would
  deadlock under the shared non-reentrant mutex (`contacts-dao.ts:536`, `favourites-dao.ts:32`,
  `snooze-dao.ts:79`, `transaction.ts:49`).
- Quick Log pins `direction: "outbound"`; the reusable insert core otherwise defaults it to
  `null` (`recency-dao.ts:178`).
- Archive's immutable event trail is preserved: the existing writer updates `archived_at`
  then writes `recordEventCore`; a set-based update would violate this (`contacts-dao.ts:541`).
- The view-independent search and card candidate-read changes are necessary and correctly
  targeted: both are currently list-only (`HomeScreen.tsx:558`, `:601`).
- The direct detailed-log routing correction is valid: the existing `onLogInteraction` is
  governed by the right-swipe preference and defaults to Quick Log (`HomeScreen.tsx:412`).
- The persisted two-argument `setViewMode(exec, viewMode)` plan is correct
  (`dashboard-query-store.ts:79`).
- The GroupLog route-param handoff is additive and appropriate: the route is currently
  parameterless and still a placeholder (`navigation/types.ts:34`).

### Concerns
- **[MEDIUM] Selection store seed can violate the frozen-universe invariant.** Plan 03
  `enterSelection(universe, seedId?)` inserts any supplied seed ID, while only `toggle()` is
  constrained to `frozenUniverse`. A caller error could bulk-act on an ID outside the frozen
  eligible result set. Suggest admitting `seedId` only when `universe.includes(seedId)`; add a
  test for `enterSelection([1,2], 99)` producing an empty selection (`HomeScreen.tsx:1055`).
  *(Orchestrator: NOT counted — both wired callers pass an in-universe seed; see Divergent
  Views. Defensive hardening, not a defect in the plans as written.)*
- **[LOW] Plan 01's stated 44px favourite hit-target is not guaranteed by
  `hitSlop={SPACING.sm}`.** `SPACING.sm` is 8px and the token file says 44×44 is a separate
  floor. Unless the visual star is >=28px square, 8px hit slop per side misses the requirement.
  Specify a 44×44 wrapper/minimum layout box, with hit slop only as supplemental forgiveness
  (`spacing.ts:8`). *(Orchestrator: COUNTED — verified 20px icon + 8px slop = 36px; see
  Divergent Views.)*

### Risk Assessment
Data-integrity risk is well controlled by the one-transaction/N-core architecture, batch
receipt-based undo, canonical recency recomputation, and lifecycle-event composition. No
decision reversal, migration violation, network path, or bulk-delete/quarantine regression
was found. The two concerns above are localized and straightforward to resolve.

---

## Claude Review

*Model: claude-opus-4-8 (independent read-only subagent — the in-harness `claude` lane is
self-skipped for independence per the workflow; run as a read-only Agent instead).
Source-grounded (repo read access).*

### Summary
The Phase 28 plan set is execution-ready and converged. Independently re-verified ~20
distinct on-disk citation clusters spanning the cycle-3 fix surface (search-descriptor gates,
Log-Interaction routing, async view-mode switch) and the highest-risk data layer (bulk
composers, recency spine, event trail, extraction targets). Every `file:line` the plans
assert resolved correctly. All three cycle-3 MEDIUM fixes are now concretely reflected in
Plans 04/05/06 with accurate citations, and all cycle-1/2 fixes remain sound. No recorded
decision (HANDOFF, ADR-010/018/024/025/033/071/075, D-01..D-12) is deleted, weakened, or
inverted; no local-first/network red line is crossed; no migration is introduced (D-03).
**Zero actionable findings.**

### Strengths
- **Cycle-3 finding-1 fix verified.** `isListSearch` at `HomeScreen.tsx:558`, the
  `composeDashboardSearch` producer branch at `:573`, the empty-`resultsByContactId` else
  branch at `:583/588`, the candidate-read gate at `:601`, and `isListSearchMode` at `:772`
  are all list-only exactly as Plan 04 Task 3 describes; the plan widens both gates
  view-independently and keeps search/adaptive mutually exclusive.
- **Cycle-3 finding-2 fix verified.** `onLogInteraction` at `HomeScreen.tsx:412-425` is
  genuinely preference-gated; the direct helper `navigateDashboardContactAction` exists at
  `:133-141`. Plan 05 correctly routes the card menu to the direct route and bars reuse of the
  gated handler.
- **Cycle-3 finding-3 fix verified — and strengthened by disk state.** `setViewMode` at
  `dashboard-query-store.ts:79-89` is `async (exec, viewMode)` and now carries an explicit
  idempotency guard (`if (viewMode === get().viewMode) return;`). Plan 06 Task 3's
  `await setViewMode(getExecutor(), "card")`-before-`enterSelection`, failure path, and
  already-card fast-path all match.
- **Data layer correct-by-construction.** `setContactPhotoCore` bumps at `contacts-dao.ts:658`
  inside the core (wrapper adds none); `deleteTouchpoint` (`recency-dao.ts:313-346`) is
  bump-free with dual-key DELETE scoping; `insertInteraction` defaults `direction ?? null` at
  `:205` (so Plan 02's pinned `direction:"outbound"` is required and specified); `runQuickLog`'s
  canonical column shape matches Plan 02's bulkQuickLog.
- **Frozen-universe double fence intact.** Re-query paths confirmed at `useFocusEffect` (~678),
  AppState (~690), `onRefresh` (~706); Plan 03 store-boundary `toggle` guard + Plan 06
  renderer-boundary `rows.filter` fence both present.
- **Additive handoffs correct.** `GroupLog: undefined` at `navigation/types.ts:34`; overflow
  `Select Contacts` is `disabled:true`/no-op (Plan 06 enables). Pickers grounded:
  `SNOOZE_PRESETS` at `ContactProfileScreen.tsx:122-129`, `SnoozePreset`/`PRESET_MODIFIERS` at
  `snooze-dao.ts:39/46`, `listCategories` at `contact-read.ts:49`, mutexed favourite twins at
  `favourites-dao.ts:32/59`, `updateContactMetadataCore` (the writer to avoid) at
  `contacts-dao.ts:312`.

### Concerns
None actionable.
- **(observational, NOT-ACTIONABLE) Frozen-universe seeding under an active search term.**
  Entering selection via overflow `Select Contacts` while a search term is present would freeze
  the current search-result set as the eligible universe (search then ceases to function per
  D-12). Defensible product behavior ("freeze the eligible universe as it stood"), not a
  defect; the control-area lock (Plan 06) makes it consistent. No plan change needed.
- **(observational, NOT-ACTIONABLE) Plan 07 per-action-eligibility `flagged_assumption`.**
  Properly `owner_bucket`, ships a safe reversible default (apply to all selected), reverses
  nothing (verified schema-legal: migration-011 `CHECK (tracking_enabled = 0 OR interval_days
  IS NOT NULL)` and the `contacts_prevent_cadence_clear` trigger fire only on NULL). RESOLVED.

### Prior-Fix Verification
- **Cycle-1 HIGH-1 (GroupLog additive param / Phase 33 defer): SOUND.** `navigation/types.ts:34`
  is `GroupLog: undefined`; Plan 07's `{ participantIds?: number[] } | undefined` is
  additive/serializable; D-10 authorizes preloading.
- **Cycle-1 HIGH-2 (bulk receipt + atomic undoBulkQuickLog): SOUND.** Plan 02 returns
  `{contactId, interactionId}[]`; `undoBulkQuickLog` composes `deleteInteractionCore`
  (bump-free `deleteTouchpoint:313-346`) per entry + one `bumpDataRevisionCore`, one txn;
  Plan 07 wires Undo to `undoBulkQuickLog`, not `createQuickLogUndoController`.
- **Cycle-2 A1 (frozen-universe double fence): SOUND.** Store guard (Plan 03) + render filter
  (Plan 06) present; re-query necessity confirmed at HomeScreen 678/690/706.
- **Cycle-2 A2 (net-new bulk pickers): SOUND.** Snooze picker from `SNOOZE_PRESETS`, category
  from `listCategories:49`, both composed from Sheet/overlay-base with testIDs + a11y.
- **Cycle-2 A3 (setContactPhotoCore:658 citation): SOUND.** Bump is inside the core at `:658`;
  wrapper adds none; Plan 02 copies only the single-column UPDATE + `changes===1` guard.
- **Cycle-2 A4 (shared formatLocalDate): SOUND.** Plan 04 mandates `@/utils/dates` and forbids
  mirroring `list-row-selection.ts`'s private formatter / `toISOString().split()`.
- **Cycle-3 finding-1 (view-independent search descriptors): SOUND.** Verified above.
- **Cycle-3 finding-2 (direct LogContact route): SOUND.** Verified above.
- **Cycle-3 finding-3 (awaited 2-arg setViewMode + failure path): SOUND.** Verified above;
  store idempotency guard on disk reinforces it.

### Risk Assessment
**LOW.** Every decision-critical claim is grounded in verified on-disk code; the highest-risk
surface (bulk data layer) is architecturally correct; the frozen-universe invariant is
double-fenced; the three cycle-3 UI-wiring gaps are closed with accurate citations; no
recorded decision is weakened; the one product-posture question is owner-routed with a safe
default. Residual risk is ordinary device UAT (Pixel layout, breakpoints, TalkBack), already
routed to the plans' human-checks. Recommend closing the convergence loop.

---

## Orchestrator adjudication (counted result)

- **HIGH: 0.** No decision reversals; no data-layer / local-first / migration red lines
  crossed; all cycle-1/2/3 fixes verified sound against source. The cycle-4 replan (`fa06779`)
  correctly incorporated all three cycle-3 MEDIUM findings into Plans 04/05/06, with every new
  citation confirmed accurate on disk.
- **Actionable: 1** — Codex's LOW (Plan 01 favourite hit-target). Verified independently:
  `md` icon = 20px (`icon-size.ts:16`) + `hitSlop={SPACING.sm}` = 8px (`spacing.ts:12`) yields
  a 36px target, below the plan's own must_have E4 (">=44px") and the a11y floor
  (`spacing.ts:8`). The repo's own control (`ListRow.styles.favouriteButton`,
  `ListRow.tsx:342-347`) reaches the floor via `minWidth/minHeight: SPACING["2xl"]` (48px), not
  hitSlop. **PLAN.md change needed (28-01):** specify a 44/48px minimum touch-box for the
  favourite star (mirror `ListRow.styles.favouriteButton`'s `minWidth/minHeight: SPACING["2xl"]`
  with center alignment), with `hitSlop` as supplemental forgiveness only; update the Task-2
  acceptance criterion (28-01-PLAN.md:125) so the 44px floor is attributed to the min-box, not
  to `hitSlop` alone.
- **Not counted:** Codex's MEDIUM (Plan 03 seed-membership guard) — defensive hardening; no
  wired caller passes an out-of-universe seed, so execution is correct as written. Recorded for
  the owner's optional consideration.

To incorporate: `/gsd-plan-phase 28 --reviews`
