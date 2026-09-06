---
phase: 28
cycle: 3
reviewers: [codex, claude]
reviewed_at: 2026-09-06T07:38:52Z
plans_reviewed: [28-01-PLAN.md, 28-02-PLAN.md, 28-03-PLAN.md, 28-04-PLAN.md, 28-05-PLAN.md, 28-06-PLAN.md, 28-07-PLAN.md]
models:
  codex: "gpt-5.6-terra (reasoning=low)"
  claude: "claude-opus-4-8"
model_sources:
  codex: "banner"
  claude: "orchestrator (read-only subagent — CLAUDE_CODE_ENTRYPOINT self-skip workaround)"
summary:
  current_high: 0
  current_actionable: 3
---

# Cross-AI Plan Review — Phase 28 (Dashboard Card View) — CYCLE 3

Both reviewers reviewed the CURRENT 7 plans on disk (post commit `4680296`, cycle-2
replan) under the project mandate: **review the code on disk, not the diff/plan text;**
verify every `file:line`; treat any decision reversal (HANDOFF / ADR / D-01..D-12) as an
owner-escalation HIGH. The orchestrator independently re-verified every finding below
against source before counting it (both reviewers' `file:line` citations resolved
accurately on spot-check).

Reviewer split this cycle: **Claude** drove the data-layer / decision-reversal /
frozen-universe surface and cleared it (0 actionable, "converged"); **Codex** traced the
UI-wiring surface (search descriptors, Log-Interaction routing, view-mode switch) and
found three MEDIUM execution gaps. This is the intended cross-AI blind-spot split — the
two reviewers covered different surfaces, and both sets of claims are code-verified.

## Consensus Summary

- **No HIGH findings. No decision reversals.** Both reviewers independently confirmed no
  recorded decision (HANDOFF, ADR-010/018/024/025/033/071/075, D-01..D-12) is deleted,
  weakened, or inverted, and no data-layer red line is crossed. The bulk data layer
  (Plan 02) is correct-by-construction: N composed non-mutexed `*Core` primitives in ONE
  `inWriteTransaction`, the single recency writer preserved (ADR-010/024/071), the
  immutable lifecycle-event trail preserved (ADR-025), a single `bumpDataRevisionCore`
  per op (D-04), no set-based mutation, no schema change (D-03), no mutex nesting (D-05).
- **All cycle-1/2 fixes remain SOUND** — both reviewers confirmed independently (see each
  section). Nothing regressed.
- **Three MEDIUM UI-wiring gaps remain (Codex; orchestrator-verified) — actionable.**
  They are UI-routing/wiring specifications that would produce wrong or unverifiable
  Card-view behavior (search-match rendering, Log-Interaction routing, selection entry)
  under `/gsd-execute-phase` as the plans currently read. None touches the data layer or
  any recorded decision.

### Agreed Strengths (2+ reviewers)
- Data layer honors the non-reentrant mutex and canonical recency/event writers; every
  drift-prone citation (`setContactPhotoCore` bump at contacts-dao.ts:658, `insertInteraction`
  direction-defaults-null at recency-dao.ts:205, `deleteTouchpoint` bump-free 313-346,
  `GroupLog: undefined` at navigation/types.ts:34) is accurate.
- Frozen-universe invariant is fenced at both the store boundary (Plan 03 `toggle`) and the
  renderer boundary (Plan 06 filter); the re-query paths that make the fence necessary are
  confirmed (HomeScreen `useFocusEffect`/AppState/`onRefresh`).
- The per-action-eligibility question is correctly routed to the owner as a properly
  recorded `flagged_assumption` with a safe reversible default (Plan 07) — resolved, not
  actionable.

### Agreed Concerns (2+ reviewers)
- None. (The three actionable items were raised by Codex; Claude did not trace the UI-wiring
  surface in that depth. The orchestrator verified all three against code.)

### Divergent Views
- **Codex vs Claude on convergence.** Claude concluded the set is converged (0 actionable);
  Codex found 3 MEDIUM UI-wiring gaps. The divergence is coverage, not contradiction — Claude
  concentrated on the data layer and decision-reversal surface (and cleared it), Codex on the
  card-view UI wiring. The orchestrator adjudicated in favor of Codex on all three after
  confirming each against `src/screens/HomeScreen.tsx` and `src/stores/dashboard-query-store.ts`;
  they are genuine execution-relevance gaps, not style. Counted: **0 HIGH, 3 actionable MEDIUM.**

---

## Codex Review

*Model: gpt-5.6-terra (reasoning=low). Source-grounded (repo read access).*

### Summary
Two-to-three execution-relevant UI-wiring gaps remain. Card search is list-only at the
query/match-descriptor layer, so Plan 04's card search UI would lack match metadata; the
existing `onLogInteraction` handler is preference-dependent, not reliably the individual
detailed-log route the card menu requires; and Plan 06's `setViewMode` call shape does not
match the persisted async view-mode API.

### Concerns

- **[MEDIUM] Plans 28-04, 28-01 — Card search wiring does not enable the shared descriptor
  read in Card view.** `HomeScreen` defines search mode as list-only at
  `src/screens/HomeScreen.tsx:558` (`isListSearch = query.viewMode === "list" && term !== ""`),
  and only calls `composeDashboardSearch` — the producer of `DashboardSearchResult` match
  descriptors — when that condition is true (`:573`). Card view instead falls to the else
  branch, which builds an EMPTY `resultsByContactId` map (`:583/:588`); `isListSearchMode`
  (`:772`) that gates descriptor props onto the row is likewise list-only. Plan 04 widens
  only the non-search line-3 candidate gate at `:601`; it does not widen this search-query
  gate. Consequently its proposed matched-field label / highlighted snippet cannot render
  from the shared descriptor model in card mode — failing the plan's own device human-check
  (28-04:143) and CARDV-02/03.
  **PLAN.md change needed:** In 28-04 Task 3, make the Dashboard descriptor search
  view-independent for a non-empty term — run `composeDashboardSearch` (and a
  card-inclusive search-mode flag replacing/augmenting `isListSearchMode`) for BOTH list and
  card modes — and pass descriptor results to `CardGrid` only when that shared search mode is
  active. Add a source assertion covering the widened `:558/:573` descriptor gate (not just
  the `:601` candidate gate). Preserve the normal-mode line-3 read exclusion during search.

- **[MEDIUM] Plan 28-05 — Reuse of HomeScreen's existing `onLogInteraction` does not
  guarantee the individual detailed-log flow.** The existing handler reads
  `dashboardRightSwipeAction` and opens `LogContact` only when the swipe preference is
  `"log-contact"`; otherwise it fires Quick Log (`src/screens/HomeScreen.tsx:412-425`; the
  schema default is Quick Log per the handler's own comment). The card long-press menu item
  is locked to "Log Interaction," and D-10 requires its one-contact route to the canonical
  individual detailed-log flow, independent of list-swipe configuration. 28-05 read_first
  cites the existing `onLogInteraction` and names the menu callback `onLogInteraction`,
  creating a reuse trap; the plan's verification ("routes to the individual flow (not Group
  Log)") would not catch a Quick-Log misroute.
  **PLAN.md change needed:** In 28-05 Task 3, specify a dedicated callback that routes
  directly to the individual detailed-log flow (e.g. `navigateDashboardContactAction(id,
  "LogContact")`), NOT the preference-sensitive `onLogInteraction`; thread that same direct
  callback to the GridCard accessibility action; and add a verify that it opens the
  individual flow regardless of `dashboardRightSwipeAction`.

- **[MEDIUM] Plan 28-06 — Overflow `Select Contacts` call shape does not match the persisted
  async view-mode API.** `setViewMode` is `async (exec, viewMode)` and updates Zustand only
  after `updateAppSettings` resolves (`src/stores/dashboard-query-store.ts:79-89`). Plan 06
  writes `if viewMode !== "card" setViewMode("card"); enterSelection(currentEligibleIds);` —
  wrong signature (missing `exec`; tsc-caught) and unawaited, so `enterSelection` can run
  before the view switches/persists, and a failed preference write has no defined behavior.
  **PLAN.md change needed:** In 28-06 Task 3, require an async `onSelectContacts`: `await
  setViewMode(getExecutor(), "card")` before `enterSelection(rows.map(r => r.id))`; define
  the failure path (report the persistence error, do not enter selection); if already in
  Card view, enter directly. (`setViewMode`'s own idempotency guard already no-ops the
  already-card case.)

### Confirmation of prior fixes
All cycle-1/2 fixes remain sound in the current set: GroupLog receives only an additive,
serializable `participantIds` handoff; bulk Quick Log uses a per-row receipt and atomic
core-based undo; Plan 03 store guard + Plan 06 render filter provide the two frozen-universe
fences; bulk pickers are concretely specified; the photo-core citation correctly recognizes
the core itself bumps revision at `contacts-dao.ts:637-659`; the shared `formatLocalDate`
use avoids reproducing the private formatter at `list-row-selection.ts:30`.

### Risk Assessment
**MEDIUM.** The data layer respects the on-disk non-reentrant transaction model and the
canonical recency/event writers; the three UI-routing gaps would produce incorrect
Card-view search, logging, or selection behavior unless resolved.

---

## Claude Review

*Model: claude-opus-4-8 (independent read-only subagent — the in-harness `claude` lane is
self-skipped for independence per the workflow; run as a read-only Agent instead).
Source-grounded (repo read access).*

### Summary
Verified the 7 current plans against actual source — not plan text — focusing on the data
layer (Plan 02), the frozen-universe fence (Plans 03/06/07), and every cited `file:line`.
All load-bearing claims check out. The data-layer design is correct-by-construction:
manually grepped every writer of `contacts.archived_at`, `contacts.last_contact`,
`interactions`, `contacts.category_id`, and `contacts.interval_days` and confirmed the
single-writer / immutable-event invariants hold, no set-based mutation is introduced, and
the extracted `*Core` composition honors the non-reentrant mutex (D-04/D-05/D-06,
ADR-010/024/025/071). Found no decision reversals, no data-layer red-line violations, no
HIGH findings. ~40 spot-checked `file:line` references all accurate. This plan set is
converged (from the data-layer / decision-reversal vantage).

### Concerns
No HIGH or MEDIUM findings from the data-layer/decision surface. LOW / observational, all
**NOT-ACTIONABLE** per cycle-3 calibration:
- **LOW — `assertOneChange` is file-local, not exported** (`bulk-review-dao.ts:34`). Every
  extracted core already carries its own inline `changes !== 1` throw, and the two new cores
  copy that inline shape, so there is no hard dependency on exporting it; Plan 02 permits
  "copy or import." NOT-ACTIONABLE.
- **LOW — `snoozeContactCore` computes the date via an in-loop `SELECT date('now','localtime',?)`**
  (from `snooze-dao.ts:87-90`). Preserved behavior, correctness-neutral (all N get the same
  local date), trivial perf note only. NOT-ACTIONABLE.
- **LOW — `bulkSnooze` uid minting phrasing.** `SnoozeContactInput.uid` is caller-minted
  (`snooze-dao.ts:55`); Plan 02 Task 2 already states "Use `newUid()` for each event uid," so
  execution is unambiguous. NOT-ACTIONABLE.
- **RESOLVED (not a finding) — Plan 07 per-action-eligibility `flagged_assumption`.** Verified
  its basis: migration `011:37` `CHECK (tracking_enabled = 0 OR interval_days IS NOT NULL)` is
  satisfied by any positive value, so `bulkSetFrequency` on an Unbound contact is schema-legal,
  and the `contacts_prevent_cadence_clear` trigger (`011:181-186`) fires only on NULL.
  Properly `owner_bucket`, ships a safe reversible default, reverses nothing. RESOLVED.

### Confirmation of prior fixes — all SOUND
- **Cycle-1 HIGH-1 (28-07 GroupLog additive param): SOUND.** `navigation/types.ts:34` is
  `GroupLog: undefined`; the extension to `{ participantIds?: number[] } | undefined` is
  additive/serializable; D-10 explicitly authorizes preloading participants for the 2+ path;
  the FAB "never preselects" comment (`universal-fab-logic.ts:92`) is genuinely FAB-scoped.
  No decision reversal.
- **Cycle-1 HIGH-2 (28-02 receipt + atomic undo): SOUND.** `insertInteractionCore`
  (`recency-dao.ts:426`) returns `lastInsertRowId` for the `{contactId, interactionId}[]`
  receipt; `undoBulkQuickLog` composes `deleteInteractionCore` (the bump-free body of
  `deleteTouchpoint:313-346`) per entry + one `bumpDataRevisionCore`, in ONE
  `inWriteTransaction`; Plan 07 wires Undo to `undoBulkQuickLog`, not the single-keyed
  controller.
- **Cycle-2 A1 (frozen-universe fence): SOUND.** Store guard (Plan 03 `toggle` no-ops when
  `!frozenUniverse.includes(id)`) + renderer filter (Plan 06) + Plan 07 "must not re-seed."
  Necessity proven — HomeScreen re-queries at `useFocusEffect:678`, AppState `:690`,
  `onRefresh:706`.
- **Cycle-2 A2 (net-new pickers): SOUND.** Snooze picker uses the three `SNOOZE_PRESETS`
  (`ContactProfileScreen:127-129`); category picker from `listCategories`
  (`contact-read.ts:49`); both composed from Sheet/overlay-base with testIDs + a11y.
- **Cycle-2 A3 (setContactPhotoCore:658 citation): SOUND.** `bumpDataRevisionCore` is at
  `contacts-dao.ts:658` inside the core; wrapper `setContactPhoto:661-669` adds no bump; Plan
  02 copies only the single-column UPDATE + `changes===1` guard.
- **Cycle-2 A4 (shared formatLocalDate): SOUND.** Shared helper at `dates.ts:17`; private
  duplicate at `list-row-selection.ts:30`; Plan 04 mandates importing `@/utils/dates` and
  forbids mirroring the private copy or `toISOString().split()`.
- **Cycle-2 A5–A8: SOUND.** A5 `deleteTouchpoint` bump-free (single bump "more correct");
  A6 snooze-preset affordance grounded (`ContactProfileScreen:486`); A7 frozen universe
  seeded from full `rows.map(r => r.id)` (FlatList virtualizes rendering only). Plus
  independent confirmations: OverflowMenu text-only (Sheet composition required), events-dao
  stale comment genuinely wrong (snooze-dao IS the producer), no icon-registry key collisions.

### Risk Assessment
**LOW** (from the data-layer / decision-reversal vantage). Every decision-critical claim is
grounded in verified code; the highest-risk surface (bulk data layer) is architecturally
correct; the frozen-universe invariant is double-fenced; no recorded decision is weakened;
the one product-posture question is owner-routed with a safe default. Residual risk is
ordinary execution/UAT (device layout, TalkBack, breakpoints), already routed to Pixel UAT.

---

## Orchestrator adjudication (counted result)

- **HIGH: 0.** No decision reversals; no data-layer red lines crossed; all cycle-1/2 fixes
  verified sound against source.
- **Actionable MEDIUM: 3** — Codex's three UI-wiring gaps, each independently confirmed
  against `src/screens/HomeScreen.tsx` (`:558/:573/:583/:588/:601/:772`, `:412-425`) and
  `src/stores/dashboard-query-store.ts` (`:79-89`). Each would produce wrong or
  unverifiable Card-view behavior under `/gsd-execute-phase` and each fails or evades the
  plan's own acceptance/human-check. None touches the data layer or a recorded decision.

To incorporate: `/gsd-plan-phase 28 --reviews`
