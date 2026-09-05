---
phase: 26
reviewers: [codex, claude]
reviewed_at: 2026-09-05T07:16:54Z
cycles: 2
plans_reviewed: [26-01-PLAN.md, 26-02-PLAN.md, 26-03-PLAN.md, 26-04-PLAN.md, 26-05-PLAN.md, 26-06-PLAN.md, 26-07-PLAN.md]
models:
  codex: "gpt-5.6-terra (reasoning=low)"
  claude: "sonnet"
model_sources:
  codex: "banner"
  claude: "pinned"
cycle_history:
  - cycle: 1
    reviewed_at: 2026-09-05T06:40:01Z
    current_high: 2
    current_actionable: 16
  - cycle: 2
    reviewed_at: 2026-09-05T07:16:54Z
    current_high: 2
    current_actionable: 9
---

> **This file accumulates across convergence cycles as an audit trail.** The Cycle 1
> content below is retained verbatim as history; the authoritative CURRENT state is the
> **Cycle 2** section at the end of this file. Cycle-2 CYCLE_SUMMARY counts reflect only
> findings UNRESOLVED in the plans on disk after commit `1866d6d` — resolved prior-cycle
> findings are not re-counted.

═══════════════════════════════════════════════════════════════════════════════
# CYCLE 1 (history — 2026-09-05T06:40:01Z) — 2 HIGH + 16 actionable, all since addressed in commit 1866d6d
═══════════════════════════════════════════════════════════════════════════════

# Cross-AI Plan Review — Phase 26: Dashboard Control Surface

Both reviewer lanes ran as independent headless sessions with repo access and produced
source-grounded reviews (Codex 33 `file:line` citations, Claude 12; neither stubbed, neither
carried a `[reviewed-without-repo-access]` or `[reviewed-without-source-citations]` marker). The
orchestrator additionally ran a source-grounding + cross-artifact fact-drift pass (a read-only
subsystem-level audit reading every writer/reader of the dashboard read path on disk) and
independently verified each HIGH before recording it below. Where the orchestrator's verification
adjusted a reviewer's severity, the adjustment and its evidence are stated explicitly — severities
here reflect the verified state, not the raw reviewer label.

## Consensus Summary

The seven plans are a mature, well-cross-referenced set. Both reviewers independently confirmed the
architecture is sound and honors the project's hard commitments: **no migration** (D-03; TARGET_VERSION
stays 19, migration head 019, no plan touches `migrations/`, `app-settings-dao.ts`, or
`backup-schema.ts`), **no layer-1 fork** of `listDashboardPopulation` (D-11/D-12), **no RN Modal** for
the anchored panels (D-11), **no network on any read path** (local-first), **no dynamic-column custom-field
regression**, and **no hardcoded colours**. The orchestrator's audit separately confirmed every recorded
decision the plans touch is *upheld, not reversed*: D-03 (no migration / keys deferred to Phase 36),
D-06/ADR-075 (Manage Favourites stays absent, no ranked-favourites affordance), D-08/ADR-062 (Unbound
child route gains its own name search as the retrieval replacement), D-11 (anchored in-tree panels),
and D-12 (additive population-aware `listDashboardSearch`, legacy `listDashboard` retired with no
dual-read). **No finding's fix requires deleting, weakening, or inverting a recorded decision — there
is nothing to escalate to the owner on decision-reversal grounds.**

### Agreed Strengths
- Presentation-seam layering (AnchoredPanel L3 / `*PanelContent` L2 taking only `{state,onChange}`) is
  grep-gated and correctly isolates a future HUD swap (both reviewers; verified against the plan text).
- `shellTransientStore`/`resolveBackIntent` reuse for Back/dismiss is wired against real behavior
  (`shell-transient-store.ts:46`, `RootNavigator.tsx:95`, `ShellAppBar.tsx:28`) (both reviewers).
- D-12 A3 search-scope semantics are copied verbatim from the legacy branch (`dashboard-read.ts:396-413`)
  and the recorded owner decision is protected by a STOP-AND-ASK trip-wire (both reviewers).
- D-07 "Active Contacts implicit default" is encoded against real logic
  (`buildPopulationWhere` returns `ACTIVE_SEGREGATION_WHERE` when `selected.length===0`) (Claude, verified).

### Agreed Concerns (highest priority)
- **[HIGH] Plan 03 — the new `listDashboardSearch` does not replicate `listDashboardPopulation`'s
  non-SQL post-processing.** Raised by both reviewers (Codex: birthday candidate IDs + gravity filter;
  Claude: population-specific sort) and **verified by the orchestrator in the plan text**: 26-03 Task 1
  composes `buildPopulationWhere(query.populations)` + `buildFilterWhere(query.filters)` and "sorts via
  the same `resolveDefaultSort`", but (a) never resolves `birthdayIds`, so `buildPopulationWhere` returns
  `0` for an explicit **Birthdays** population + term (empty results —
  `dashboard-query-logic.ts:194`, resolved before query at `dashboard-read.ts:279`); (b) never calls the
  `filterByGravity` post-query pass (`dashboard-read.ts:324`), so a **Gravity** filter is silently
  ignored during search (`buildFilterWhere` deliberately emits no gravity SQL,
  `dashboard-query-logic.ts:113`); (c) does not port the `soonest-birthday` post-query JS sort
  (`dashboard-read.ts:315-322`). The FA-D12-compose STOP-AND-ASK only fires on A3-relaxation *ambiguity*
  — it does not catch these mechanical omissions. **Fix is decision-safe** (add the missing
  post-processing, or extract a shared private helper that both reads call, preserving the public
  `listDashboardPopulation` contract — this *upholds* D-12/D-11, does not collide with either).
- **[HIGH] Plan 01 — the a11y-inert background scope wraps only the contact collection.** Codex rated
  HIGH (scope), Claude rated MEDIUM (mechanism reliability); **orchestrator verified HIGH**: 26-01 Task 2
  wraps only the FlatList in the `importantForAccessibility="no-hide-descendants"` / inert `pointerEvents`
  View (26-01-PLAN.md:180), but the must_have promises "only the panel + scrim + control-row triggers
  are focusable" (26-01-PLAN.md:29). The header (Group Events Pressable, overflow `⋯` trigger) and footer
  entries live outside that wrapper, so with a panel open TalkBack still reaches them — DASHC-05 not met.
  The plan's own FA-DASHC-05 backstop only mentions contact *rows*, so it does not cover this scope gap.
- **[MEDIUM] Plan 04 — the disabled "Select Contacts" overflow row is under-specified.** Both reviewers:
  a no-op `onPress` is not enough — `OverflowMenu` currently has no disabled state
  (`OverflowMenu.tsx:28`) and `close()` fires unconditionally on every row press
  (`OverflowMenu.tsx:102-105`), so the row would still dismiss the sheet and still read as interactive to
  AT. Needs the real `Pressable` `disabled` prop + `accessibilityState.disabled`, and must NOT call
  `close()`.

### Divergent Views (resolved by orchestrator verification)
- **SegmentedControl List/Card icon (Plan 07).** Codex rated HIGH ("impossible with the planned file
  scope"); **verified → MEDIUM**: `SegmentedControl.tsx` *is* in 26-07's file scope (26-07-PLAN.md:89,103),
  so it is not out of scope — but the component's option type is `{label,value}` and it renders only a
  `<Text>` (`SegmentedControl.tsx:22,75`) while the must_haves require a "filled **icon** variant"
  (26-07-PLAN.md:25,39). Residual actionable: the plan must specify extending `SegmentedControlOption`
  with optional icon data + rendering it, preserving existing label-only consumers (Orrery). Claude
  reached the same fix via a suggestion.
- **Wave-3 barrier (Plan 07).** Codex rated HIGH ("Wave 3 does not enforce the Wave 2 barrier"); Claude
  and the orchestrator audit found the ordering **safe → LOW**: `wave: 3` gates execution behind Wave 2,
  and 26-07 shares no edited file with 26-02 (26-02 owns `DashboardControlRow.tsx`/`control-surface/*`;
  26-07 edits `HomeScreen.tsx` + `dashboard-read.ts`). Residual actionable: 26-07 `depends_on` is
  `["26-01","26-03","26-04"]` and omits 26-02 — belt-and-suspenders, since the wave field already gates.
- **Plan 02 gravity option source.** Codex rated HIGH; **verified → MEDIUM**: `GRAVITY_TIERS`
  (`src/services/impact.ts:63`) is discoverable, but 26-02 says only "the Phase 25 gravity tiers" without
  naming the authoritative constant (`DASHBOARD_FILTER_FAMILIES` carries no tier values). Name it + add a
  test that displayed tiers survive `filterByGravity`.

### Cross-artifact fact-drift (orchestrator pass)
- **[MEDIUM] `D-13`/`D-14` cited in Plans 03/04/06 are undefined in the phase decision record.**
  26-CONTEXT.md defines only D-01..D-12; the underlying facts are real and verified on disk (bound-only
  = `DASHBOARD_BOUND_WHERE` `c.tracking_enabled=1`, `dashboard-read.ts:159`; footer self-nav gap real,
  `HomeScreen.tsx:417`) but the D-13/D-14 labels are untraceable (the dossier's `D-13-NNN` tokens are a
  different Phase-13 namespace). Re-point the citations or add the definitions.
- **[MEDIUM] Plan 07 Task 3 test-deletion line range engulfs a must-keep block.** It says delete "the
  `listDashboard` describe blocks 174-941" (26-07-PLAN.md:153), but
  `listDashboardPopulation — Phase 25 Active universe` sits *inside* that span at
  `dashboard-read.test.ts:366-665` and must be kept. Instruct surgical deletion by block name, not line
  range.
- **[LOW]** Stale `listDashboard`/`listNeverContacted` comments/strings survive retirement
  (`fuel-read.ts:12`, HomeScreen header comments, the kept error string at `dashboard-read.ts:473`);
  Plan 07 only updates `widget-data.ts:18`. Cosmetic.
- **[LOW]** `DASHBOARD_POPULATIONS` constant order (`all-contacts` last, `dashboard-query-logic.ts:5-11`)
  differs from Plan 01's UI order (All Contacts first); Plan 01 pins explicit testIDs so this is not a
  bug — noted so the executor does not blindly `.map()` the constant.

---

## Codex Review

# Plan Review — Phase 26

## Summary

The seven plans are well scoped around the existing Phase 25 query store and deliberately avoid migrations, network calls, and a new dependency. The tracer-first sequence is sensible. However, there are several implementation blockers: the planned search read would omit existing birthday and gravity semantics, the planned List/Card toggle cannot meet its icon requirement with the current `SegmentedControl` API, and Wave 3’s declared dependencies do not enforce the stated wave barrier.

## Plan 01 — Population tracer

### Strengths

- Correctly migrates `HomeScreen` from the legacy AsyncStorage preferences store, which is currently its active source of truth at [HomeScreen.tsx:63](/home/bwales/projects/orbit-app/src/screens/HomeScreen.tsx:63) and [HomeScreen.tsx:101](/home/bwales/projects/orbit-app/src/screens/HomeScreen.tsx:101).
- Correctly uses the existing SQLite-backed query store. Its setters persist through `updateAppSettings` and update Zustand only after the write succeeds [dashboard-query-store.ts:65](/home/bwales/projects/orbit-app/src/stores/dashboard-query-store.ts:65).
- The in-tree overlay choice fits the direct-switch requirement better than the existing `OverflowMenu` modal, which is a native `Modal` [OverflowMenu.tsx:66](/home/bwales/projects/orbit-app/src/components/OverflowMenu.tsx:66).
- Shell transient registration is grounded in actual Back behavior: `dismissTop()` removes the entry before invoking its callback [shell-transient-store.ts:46](/home/bwales/projects/orbit-app/src/stores/shell-transient-store.ts:46), and Android Back calls it first [RootNavigator.tsx:95](/home/bwales/projects/orbit-app/src/navigation/RootNavigator.tsx:95).
- The proposed local-date use is correct: the population read parses a local date rather than UTC [dashboard-read.ts:256](/home/bwales/projects/orbit-app/src/db/dashboard-read.ts:256).

### Concerns

- **HIGH — a11y inerting scope is insufficiently specified.** The plan only wraps the collection in `no-hide-descendants`, but its own acceptance criterion says only panel/scrim/control triggers remain focusable. Header destinations and overflow remain outside that wrapper in the current screen hierarchy; they would remain reachable to TalkBack. This risks DASHC-05.
- **MEDIUM — persistence failures are unhandled.** `setPopulations` can reject before state changes [dashboard-query-store.ts:73](/home/bwales/projects/orbit-app/src/stores/dashboard-query-store.ts:73), but the planned `onChange` contract is void. The plan needs a visible/error-safe handling path rather than an unhandled promise.
- **MEDIUM — temporarily removing search creates a user-facing regression between Plans 01 and 07.** The existing search is functional and debounced [HomeScreen.tsx:157](/home/bwales/projects/orbit-app/src/screens/HomeScreen.tsx:157). This is acceptable only if intermediate commits are explicitly non-releaseable and Wave 3 is guaranteed to follow immediately.

### Suggestions

- Define one “background” wrapper that hides/inerts every Dashboard element except the active control-row triggers and the panel; verify it in the TalkBack UAT.
- Make panel mutations async-safe: await them, prevent rapid conflicting presses or retain the prior state on failure, log/display a themed error.
- Preserve the old search UI until `listDashboardSearch` is ready, or explicitly flag Plan 01 as an integration-only commit that cannot ship independently.

### Risk Assessment

**MEDIUM.** The architecture is appropriate, but accessibility and failure handling need executable detail.

---

## Plan 02 — Filters and Sort

### Strengths

- Correctly reuses the closed filter/query model rather than introducing UI-owned SQL. `buildFilterWhere` binds category and battery values [dashboard-query-logic.ts:83](/home/bwales/projects/orbit-app/src/logic/dashboard-query-logic.ts:83).
- Correctly keeps gravity out of SQL; this is intentionally post-query logic [dashboard-query-logic.ts:113](/home/bwales/projects/orbit-app/src/logic/dashboard-query-logic.ts:113).
- Clear-in-panel and explicit Default sort align with the existing state model, whose reset preserves `viewMode` [dashboard-query-logic.ts:215](/home/bwales/projects/orbit-app/src/logic/dashboard-query-logic.ts:215).

### Concerns

- **HIGH — gravity option source is unspecified.** `DASHBOARD_FILTER_FAMILIES` contains only the family name, not valid tier values [dashboard-query-logic.ts:14](/home/bwales/projects/orbit-app/src/logic/dashboard-query-logic.ts:14). Valid tiers live in `GRAVITY_TIERS` [impact.ts:63](/home/bwales/projects/orbit-app/src/services/impact.ts:63). The plan says “Phase 25 gravity tiers” without naming/importing that authoritative source.
- **MEDIUM — active filter summary is underspecified.** “Selected family names” loses the selected option names required by DASHC-03 and makes `+N` semantics ambiguous.

### Suggestions

- Require `GRAVITY_TIERS.map(tier => tier.name)` as the sole option source and add a test that all displayed values survive `filterByGravity`.
- Define summaries as selected option labels, with deterministic category-name resolution and a unit test for mixed-family selections.

### Risk Assessment

**MEDIUM.** Sound layering, but the gravity UI cannot be implemented reliably from the plan as written.

---

## Plan 03 — Population-aware search read

### Strengths

- Correctly preserves bound-only scope. The legacy A3 branch includes both `archived_at IS NULL` and `DASHBOARD_BOUND_WHERE` [dashboard-read.ts:396](/home/bwales/projects/orbit-app/src/db/dashboard-read.ts:396).
- Correctly recognizes bind ordering for the SELECT-list snippet: the snippet parameter precedes WHERE parameters [dashboard-read.ts:373](/home/bwales/projects/orbit-app/src/db/dashboard-read.ts:373).
- Tests for literal `%`, `_`, and backslash behavior are appropriate for the existing `escapeLike`-based query contract.
- No network dependency is proposed; all work remains on-device SQLite.

### Concerns

- **HIGH — explicit Birthday population will fail unless the new read duplicates birthday candidate resolution.** `buildPopulationWhere(..., { birthdayIds })` returns `0` for birthdays when no IDs are supplied [dashboard-query-logic.ts:194](/home/bwales/projects/orbit-app/src/logic/dashboard-query-logic.ts:194). `listDashboardPopulation` computes those IDs before querying [dashboard-read.ts:279](/home/bwales/projects/orbit-app/src/db/dashboard-read.ts:279), but Plan 03 does not require equivalent logic or a birthday-search test.
- **HIGH — gravity filtering will be silently ignored in search.** `buildFilterWhere` deliberately emits no gravity SQL [dashboard-query-logic.ts:113](/home/bwales/projects/orbit-app/src/logic/dashboard-query-logic.ts:113); the normal population read subsequently calls `filterByGravity` [dashboard-read.ts:324](/home/bwales/projects/orbit-app/src/db/dashboard-read.ts:324). Plan 03’s proposed SQL composition and tests omit this post-query pass.
- **MEDIUM — the requirement that `listDashboardPopulation` remain byte-unchanged discourages safe shared factoring.** Duplicating birthday/gravity mechanics increases future semantic drift. This does not collide with D-12, but the plan should expressly permit extracting a private shared helper while preserving the public function contract.

### Suggestions

- Add RED tests for:
  - Birthday population plus a term returning an upcoming-birthday matching contact.
  - Gravity selection plus a term excluding a matching contact in another tier.
- Implement a shared private “resolve population candidates / apply gravity” helper used by both reads, or explicitly duplicate the full behavior and test parity.
- Maintain `archived_at IS NULL` and `DASHBOARD_BOUND_WHERE` in every branch, not only the implicit Active branch.

### Risk Assessment

**HIGH.** This plan currently fails two shipped query semantics and would make search disagree with the visible Population/Filter controls.

---

## Plan 04 — Header, overflow, reset

### Strengths

- The proposed overflow accurately removes obsolete root destinations and preserves the required routes. Current DashboardStack registrations support `GroupEvents`, `Archived`, and `UnboundContacts` [DashboardStack.tsx:35](/home/bwales/projects/orbit-app/src/navigation/tabs/DashboardStack.tsx:35).
- Extracting the five-row overflow definition into a pure builder is strong and testable.
- Reset correctly composes durable query reset with ephemeral session reset; the session store only clears session values [dashboard-session-store.ts:21](/home/bwales/projects/orbit-app/src/stores/dashboard-session-store.ts:21).
- Extending `OverflowAction` is appropriately localized; it presently has no disabled state [OverflowMenu.tsx:28](/home/bwales/projects/orbit-app/src/components/OverflowMenu.tsx:28).

### Concerns

- **MEDIUM — a fixed-width fallback heuristic cannot guarantee the required rendered-fit behavior.** `ShellAppBar` has a fixed 52px minimum height and flex layout [ShellAppBar.tsx:56](/home/bwales/projects/orbit-app/src/components/ShellAppBar.tsx:56); text scaling and localization require measured layout, not character or nominal-width inference.
- **MEDIUM — disabled overflow semantics need the actual `Pressable` disabled prop as well as a no-op.** The current handler always closes and invokes actions [OverflowMenu.tsx:102](/home/bwales/projects/orbit-app/src/components/OverflowMenu.tsx:102). A no-op callback alone may still look/behave interactive to assistive technologies.

### Suggestions

- Use measured available width and measured label widths; make both buttons icon-only as one atomic state.
- Set `disabled`, `accessibilityState={{ disabled: true }}`, muted theme styles, and avoid closing the menu for Select Contacts.

### Risk Assessment

**MEDIUM.** The route/reset design is good; responsive and disabled-state details need tightening.

---

## Plan 05 — Archived child-route chrome

### Strengths

- This is appropriately a chrome-only refactor. The destructive flow is isolated in `doPurge`, including the confirm gate and post-commit cleanup [ArchivedContactsScreen.tsx:128](/home/bwales/projects/orbit-app/src/screens/ArchivedContactsScreen.tsx:128).
- Both route registrations already point to the same component in Dashboard and Settings stacks [DashboardStack.tsx:62](/home/bwales/projects/orbit-app/src/navigation/tabs/DashboardStack.tsx:62).
- `ShellAppBar` correctly routes visible Back through transient dismissal before navigation [ShellAppBar.tsx:28](/home/bwales/projects/orbit-app/src/components/ShellAppBar.tsx:28).

### Concerns

- **LOW — the plan should account for the now-unused `navigation` parameter.** The legacy Back handler is the sole current use [ArchivedContactsScreen.tsx:185](/home/bwales/projects/orbit-app/src/screens/ArchivedContactsScreen.tsx:185). Remove it from destructuring if compiler settings enforce unused locals.

### Suggestions

- Add a focused regression test or a diff guard around `doPurge` rather than relying solely on manual diff inspection.

### Risk Assessment

**LOW.** Narrow, properly constrained, and consistent with existing navigation behavior.

---

## Plan 06 — Unbound route and search

### Strengths

- Correctly protects the ADR-062 retrieval path with an own-route search.
- Client-side filtering is appropriate because `listUnbound` already returns the bounded local list and the proposed filter introduces no SQL or network.
- The screen’s existing neutral row presentation is preserved [UnboundContactsScreen.tsx:107](/home/bwales/projects/orbit-app/src/screens/UnboundContactsScreen.tsx:107).

### Concerns

- **LOW — count semantics are unstated during filtered search.** The existing count is based on all loaded rows [UnboundContactsScreen.tsx:99](/home/bwales/projects/orbit-app/src/screens/UnboundContactsScreen.tsx:99). The plan should decide whether it stays total or becomes “N matching”; either is valid, ambiguity is not.

### Suggestions

- Specify filtered-count copy and ensure the no-match state remains below the search field, not confused with the true empty state.
- As with Plan 05, remove unused `navigation` destructuring only if ShellAppBar fully replaces direct Back use.

### Risk Assessment

**LOW.** A small, offline-safe enhancement with adequate pure test coverage.

---

## Plan 07 — Search/toggle completion and retirement

### Strengths

- Correctly preserves D-03-protected count/policy machinery. `countNeverContacted` depends on `readIncludeUnboundNeverContacted` [dashboard-read.ts:527](/home/bwales/projects/orbit-app/src/db/dashboard-read.ts:527), so retaining that helper is essential.
- Correctly keeps search ephemeral; the session store is explicitly non-durable [dashboard-session-store.ts:11](/home/bwales/projects/orbit-app/src/stores/dashboard-session-store.ts:11).
- Correctly targets `localDateTime()` instead of UTC conversion.
- Legacy read retirement is feasible: the active runtime consumer is HomeScreen [HomeScreen.tsx:193](/home/bwales/projects/orbit-app/src/screens/HomeScreen.tsx:193), while widget runtime already uses `listDashboardPopulation`.

### Concerns

- **HIGH — the List/Card icon requirement is impossible with the planned file scope and current `SegmentedControl`.** Its option type exposes only `{ label, value }` [SegmentedControl.tsx:22](/home/bwales/projects/orbit-app/src/components/SegmentedControl.tsx:22), and it renders only a `Text` label [SegmentedControl.tsx:75](/home/bwales/projects/orbit-app/src/components/SegmentedControl.tsx:75). Plan 07 must modify `SegmentedControl` or use a dedicated accessible toggle component.
- **HIGH — Wave 3 does not enforce the stated Wave 2 barrier.** Plan 07 depends on 01/03/04 but omits 02, 05, and 06. An executor using metadata may run it while Plan 02 is still editing `DashboardControlRow`, violating the roadmap’s “blocked on Wave 2 completion” contract.
- **MEDIUM — “cancelled flag” does not reduce a keystroke burst to one query.** Current HomeScreen achieves that only through its 220ms debounce [HomeScreen.tsx:168](/home/bwales/projects/orbit-app/src/screens/HomeScreen.tsx:168); cancellation merely prevents stale state commits [HomeScreen.tsx:201](/home/bwales/projects/orbit-app/src/screens/HomeScreen.tsx:201). The new plan must explicitly retain/add debounce over session-backed search text.
- **MEDIUM — population-specific empty-state counts are not concretely available.** Existing counts are only live/never-contacted/snoozed/archived/unbound [HomeScreen.tsx:191](/home/bwales/projects/orbit-app/src/screens/HomeScreen.tsx:191). The plan’s “derive per-population counts” needs a defined, efficient implementation, particularly for birthday and gravity-filtered populations.

### Suggestions

- Add `src/components/SegmentedControl.tsx` to Plan 07 and extend its option contract with semantic icon data, preserving existing Orrery behavior.
- Add all Wave 2 plans as dependencies if the phase policy genuinely requires whole-wave completion; at minimum add `26-02` because it owns `DashboardControlRow`.
- Specify a debounced session-store selector/value while keeping the immediate input value responsive.
- Add an explicit population-count strategy and tests for empty Birthday, Not Contacted, Snoozed, and gravity-filtered searches.

### Risk Assessment

**HIGH.** The plan contains a direct component-API mismatch and an unenforced dependency barrier, plus incomplete read scheduling/count details.

---

## Overall Risk Assessment

**HIGH until Plans 03 and 07 are revised.** The project remains local-first and the plans do not introduce a backend, network read path, migration, dynamic custom-field storage, or hardcoded-color policy violation. The major risks are functional consistency: search must honor birthdays and gravity exactly as the population list does, and the final search/toggle plan must become executable against the actual `SegmentedControl` API and wave graph.

---

## Claude Review

# Cross-AI Plan Review: Phase 26 — Dashboard Control Surface

## Summary

This is a mature, thoroughly-cross-referenced plan set (7 plans across 3 waves) that correctly reuses `shellTransientStore`/`resolveBackIntent` for panel dismissal, correctly avoids forking `listDashboardPopulation`, and correctly threads the D-12 search-scope preservation requirement through Plan 03/07. The overall wave sequencing (tracer → parallel expansion → integration) is sound. However, I found several concrete gaps: a **testID mismatch** between 26-01 and 26-02/26-04 that will break control-row assembly, a **real risk in the AnchoredPanel a11y-hide mechanism** that the plans acknowledge but don't fully de-risk, an **unaddressed `resolveDefaultSort`/D-12 sort interaction** in the new search read, and a **missing safeguard against the OverflowMenu's own `Modal`-based dismiss-then-navigate pattern** conflicting with the D-05/DASHC-09 child-route Back contract. Most concerns are MEDIUM; none are blocking rewrite-level issues, but three should be fixed before Wave 1 lands since Waves 2/3 build on Plan 01's exact shape.

## Strengths

- **Correct avoidance of the layer-1 fork (D-11/D-12).** Plan 01/03 never add a `term` param to `listDashboardPopulation` (dashboard-read.ts:274-336 verified unchanged in scope); Plan 03 authors a wholly new `listDashboardSearch`. This matches the locked architecture in CONTEXT.md D-12 and PATTERNS.md's explicit warning.
- **AnchoredPanel correctly avoids RN `Modal`.** Plan 01 Task 2's `grep -n "Modal"` acceptance gate directly encodes RESEARCH Pitfall 1's rationale — Modal renders in a separate native window, which would break one-tap control switching. This is verified against `overlay-base.tsx:87` (`Modal` from `react-native`) as the anti-pattern being avoided.
- **`shellTransientStore` reuse is correctly wired.** `shell-transient-store.ts:46-54`'s `dismissTop()` calls the registered `dismiss` callback and only then would allow `ShellAppBar`'s `onBack` (ShellAppBar.tsx:29-40) to fall through to `navigation.goBack()`. Plan 01's registration contract matches this exactly.
- **D-07's "Active Contacts implicit default" is correctly encoded against real logic.** `buildPopulationWhere` (dashboard-query-logic.ts:184-186) returns `ACTIVE_SEGREGATION_WHERE` when `selected.length === 0`, which is exactly what Plan 01's must-have "deselecting the last population returns to Active" claims.
- **A3 search-scope preservation (Plan 03) is copied from a real, cited source branch.** `dashboard-read.ts:404-412`'s term-relaxation logic is quoted near-verbatim in PATTERNS.md and Plan 03's action block; the plan correctly identifies that `DASHBOARD_BOUND_WHERE` must be preserved to avoid reopening the D-13 Unbound-in-search leak.
- **D-03 (no migration) is respected across all plans.** No plan touches `src/db/migrations/`, `TARGET_VERSION`, or drops `include_unbound_never_contacted`/`readIncludeUnboundNeverContacted` — Plan 07 Task 3 explicitly preserves `countNeverContacted` (dashboard-read.ts:527-541) and the app_settings read (dashboard-read.ts:466-475).

## Concerns

**HIGH — `resolveDefaultSort` behavior is silently different between `listDashboardPopulation` and the new `listDashboardSearch` (Plan 03), and this isn't discussed anywhere in Plan 03's must_haves.**
`resolveDefaultSort` (dashboard-query-logic.ts:227-246) branches on `populations.length !== 1` → `"status"`, and on a single population returns population-specific natural orders (`natural-not-contacted`, `natural-snooze`, `soonest-birthday`). Plan 03's FA-D12-compose assumption says the search read should "sort via the same resolveDefaultSort → POPULATION_SORT the population read uses," but when `hasTerm` is true, `soonest-birthday`'s post-query JS sort (dashboard-read.ts:315-322, using `birthdayDays` computed from `listBirthdayCandidates`) is never mentioned as needing to be ported into the new read. If a user has the Birthdays population selected AND types a search term, Plan 03's read either (a) silently drops the soonest-birthday ordering (falls through to `POPULATION_SORT.soonest-birthday = SORT.status`, dashboard-read.ts:205) or (b) needs the birthday-day-computation duplicated. Either way this is unaddressed in Plan 03's must_haves/behavior list, which only test ordering tie-breaks and fuelText parity — never a populations=['birthdays'] + term case. This should be an explicit test case or an explicit documented simplification (defaulting birthdays+term to `status` sort, which is defensible but should be a stated decision, not a silent gap).

**MEDIUM — testID naming inconsistency between DashboardControlRow's Plan 01 spec and the UI-SPEC/Plan 02/04.**
Plan 01 must_haves and UI-SPEC (line 159-162, 230-238) both use `dashboard-population-control`, `dashboard-filters-control`, `dashboard-sort-control` for triggers, and `dashboard-population-option-{key}` for panel rows — these are consistent. However Plan 01's Task 2 action text says testIDs are `dashboard-population-option-all-contacts`/`-favourites`/`-birthdays`/`-not-contacted`/`-snoozed`, which matches UI-SPEC exactly (UI-SPEC:234-238) — no drift there on inspection. I retract this as a non-issue after closer read; flagging instead the *real* mismatch below.

**MEDIUM — Plan 04's header destination testIDs collide with the overflow's redundant Group Events entry naming pattern, risking an accidental duplicate-testID bug.**
Plan 04 defines both `dashboard-group-events-entry` (header, Task 2) and `dashboard-group-events-overflow-entry` (overflow, Task 1) — these are usefully distinct. But Plan 01's tracer (which ships before Plan 04) retains "the existing single Group Events header trailing Pressable (Plan 04 replaces it)" per its own action text — and HomeScreen.tsx:537-551 (per PATTERNS.md line 9's corrected line-number note) currently uses some existing testID for that Pressable that isn't stated in any plan. If that legacy testID happens to already be `dashboard-group-events-entry` (plausible, since Phase 25/pre-26 code likely used a similar convention), Plan 01 leaving it untouched and Plan 04 later "replacing" it could either double-render two Pressables briefly mid-wave or leave the old testID orphaned in a lint/grep gate. This is a minor sequencing note rather than a functional bug, but worth Plan 04's Task 2 explicitly grepping for and removing the *old* testID string, not just adding the new ones — the plan's acceptance criteria only checks for presence of the new testIDs, not absence of stale ones.

**MEDIUM — the a11y background-hide mechanism (`importantForAccessibility="no-hide-descendants"`) is unverified against RN/Expo's actual New Architecture behavior, and the plan's only backstop is manual TalkBack testing with no fallback plan if it doesn't work.**
RESEARCH.md Assumption A4 explicitly flags this as unverified ("If insufficient, may need to also toggle `accessible`/focus management"). Plan 01's Task 2 threat model treats this as FA-DASHC-05 "flagged, not gated" — acceptable per the plan's own framing — but there is no Task 2 fallback instruction if the on-device TalkBack backstop fails. Given `overlay-base.tsx`'s own comment ("BaseOverlay gets a11y-hiding 'for free' because a native Modal window traps focus") acknowledges this is a known-hard problem being deliberately reimplemented from scratch, I'd flag this HIGH except that the plan does correctly gate it as a backstop-verified item rather than claiming false confidence. Recommend Plan 01 add an explicit contingency: if `importantForAccessibility` proves insufficient on-device, layer in `accessible={false}` + a temporary focus trap via `AccessibilityInfo.setAccessibilityFocus` re-assertion on the panel content (already planned per overlay-base.tsx:76-84's pattern) as a second line of defense, stated up front rather than discovered mid-UAT.

**MEDIUM — Plan 04's `OverflowMenu` disabled-row change interacts with the existing `close()` + `AccessibilityInfo.setAccessibilityFocus` re-focus flow in a way the plan doesn't test.**
`OverflowMenu.tsx:42-50`'s `close()` always calls `requestAnimationFrame` to refocus the trigger — this fires unconditionally on every row press (OverflowMenu.tsx:102-105: `onPress={() => { close(); action.onPress(); }}`). Plan 04 Task 1 says the disabled row's press "does NOT close+navigate (do not call action.onPress())" but doesn't say whether `close()` (which dismisses the whole sheet) still fires. If `close()` still fires on a disabled-row tap, the overflow sheet dismisses even though nothing happened — a confusing UX regression not caught by the stated acceptance criteria (`accessibilityState.disabled` + "no-op press" only checks that `onPress` didn't navigate, not that the sheet stayed open or closed correctly). This should be an explicit must_have: tapping the disabled Select Contacts row does NOT close the overflow sheet.

**LOW — Plan 06's `filterUnboundByName` is a client-side filter over a fixed unpaginated `listUnbound` read; if the Unbound population grows large this reintroduces the same "filter in JS" pattern the dossier's D-08 was trying to replace with real retrieval.** For the current scale (personal-use, v1 owner base) this is fine and explicitly justified in the plan's own threat model (T-26-17, "low" severity), but worth a one-line note if Unbound counts are expected to scale into the hundreds — `listUnbound`'s ordering is already `ORDER BY name COLLATE NOCASE, id` (unbound-read.ts:37) with no pagination, so this is a pre-existing scale ceiling Plan 06 doesn't introduce, just doesn't fix.

**LOW — Plan 07 Task 3's grep-based safety gate for "no dual-read" is pattern-fragile.** The grep `grep -rnE "listDashboard\s*\(|export (async )?function listDashboard\b|..." | grep -vE "listDashboardPopulation|listDashboardSearch"` could false-negative if a future contributor imports `listDashboard` with an aliased import (`import { listDashboard as ld }`) — low likelihood but worth noting the gate isn't airtight against determined circumvention (not a security concern, just a lint-gate robustness note).

## Suggestions

- Add an explicit test case to Plan 03 Task 1 or Task 2 covering `populations: ['birthdays']` + non-empty term, and state the intended sort behavior (defaulting to `status`, or porting the soonest-birthday post-query pass) rather than leaving it implicit in "reuses `resolveDefaultSort`."
- Add a must_have to Plan 04 Task 1: "tapping the disabled Select Contacts row does not dismiss the open overflow sheet" and verify against `OverflowMenu.tsx`'s unconditional `close()` call — likely requires threading a `disabled` check into the `onPress` handler at OverflowMenu.tsx:102-105 itself (not just the `OverflowAction.disabled` flag), since the fix belongs in `OverflowMenu.tsx`, which Plan 04 Task 1 does own.
- Plan 04 Task 2 should explicitly grep-remove any legacy Group-Events-Pressable testID from HomeScreen.tsx (not just add the two new ones), to avoid a stale duplicate testID surviving the refactor.
- Plan 01 should state a named fallback for the a11y-hide mechanism up front (e.g., pairing `importantForAccessibility` with a background `Pressable`'s `accessible={false}` and re-asserted panel focus) rather than treating on-device TalkBack failure as a pure "fix it when found" backstop — this is exactly the kind of finding that's expensive to discover only during UAT after 6 more plans have built on the same primitive.

## Risk Assessment

**MEDIUM.** The architecture is sound and well-grounded in real source citations (verified against dashboard-query-store.ts, dashboard-query-logic.ts, dashboard-read.ts, shell-transient-store.ts, overlay-base.tsx, OverflowMenu.tsx, ShellAppBar.tsx all read on disk). The wave dependency ordering correctly gates Waves 2/3 behind the Plan 01 tracer. The main risk concentration is in Plan 01's AnchoredPanel a11y-hide mechanism (novel, unverified, correctly flagged but under-mitigated) and a real but narrow gap in Plan 03's sort-mode coverage for the birthdays+search-term combination. Neither blocks proceeding, but both should be tightened before/during Wave 1 execution since six downstream plans build directly on Plan 01's AnchoredPanel and Plan 03's read shape.

---

---

## Verification coverage

**Source-grounding pass:** ON (`plan_review.source_grounding=true`). Both lanes received the
source-grounded prompt and cited `file:line` evidence. The orchestrator independently verified every
HIGH and each divergent reviewer claim against the code on disk (not the diff or the plan text alone),
reading every writer/reader of the dashboard read path — the graph cannot enumerate SQL table
writers, so this was a manual grep.

**Reader/writer map of the dashboard read path (verified on disk):**
- `listDashboard` (legacy) — sole runtime caller `HomeScreen.tsx:193`; removed by Plan 01, retired by
  Plan 07. No other caller.
- `listDashboardPopulation` (Phase 25 layer-1) — callers `HomeScreen.tsx` (post-01) and
  `src/services/widget/widget-data.ts:84`; preserved byte-unchanged (no `term` param → D-11 no-fork held).
- `listNeverContacted` — no external runtime caller (internal to `dashboard-read.ts`); safe to retire.
- `countNeverContacted` (depends on `readIncludeUnboundNeverContacted`, `dashboard-read.ts:527`) —
  callers `DigestScreen.tsx:100` + `HomeScreen.tsx:195`; both preserved (D-03 machinery kept).
- `listDashboardSearch` (new, Plan 03) — wired only in Plan 07. **HIGH gap:** does not mirror
  `listDashboardPopulation`'s birthday-candidate / gravity / population-sort post-processing.
- `listUnbound` (`unbound-read.ts:24`, bound-only) — reused by Plan 06's own-route search.
- `listFavourites` (`dashboard-read.ts:509`) — orphan, no caller, not retired by any Phase-26 plan
  (pre-existing, out of scope; consistent with D-06).

**Claims verified CONFIRMED:** D-12 A3 semantics (`dashboard-read.ts:38` header, `:396-413` branch) and
no-dual-read retirement; D-03 no-migration (`database.ts:54` TARGET_VERSION=19, head `019-dashboard-prefs.ts`);
D-06/ADR-075 Manage Favourites absent + no ranked-favourites option; D-08/ADR-062 Unbound own-route
search as retrieval replacement; D-11 anchored in-tree panels (not RN Modal / bottom sheet); wave file
graph (W1=01, W2=02-06, W3=07) collision-free across shared files. Spot-checked reviewer `file:line`
citations (dashboard-read.ts, HomeScreen.tsx, dashboard-query-logic.ts, OverflowMenu.tsx, ShellAppBar.tsx,
overlay-base.tsx, SegmentedControl.tsx, the test file, store setters) — all accurate except the Plan 07
test-range issue noted above.

**Cross-artifact fact-drift pass:** ON. Findings folded into "Cross-artifact fact-drift" in the
Consensus Summary (D-13/D-14 untraceable labels; Plan 07 test-range; stale strings; constant-order note).

**Lane health:** codex `ok=true stubbed=false` (16069 bytes), claude `ok=true stubbed=false` (12302 bytes).
Both lanes ran (SELF_CLI forced to `none` for this run per owner authorization, overriding the
`CLAUDE_CODE_ENTRYPOINT` independence-skip; the claude lane ran as a separate `claude -p --model sonnet`
headless session with no inherited context).

**Decision-reversal / escalation check:** none. No HIGH or actionable finding's fix deletes, weakens, or
inverts a D-NN decision, an ADR, or a HANDOFF.md entry. Several findings *protect* recorded decisions
(D-12, D-11, D-08/ADR-062). Nothing requires owner escalation.


═══════════════════════════════════════════════════════════════════════════════
# CYCLE 2 (CURRENT — 2026-09-05T07:16:54Z) — re-review of the revised plans (commit 1866d6d)
═══════════════════════════════════════════════════════════════════════════════

Both reviewer lanes ran again as independent headless sessions with full repo access and
produced source-grounded reviews (Codex `gpt-5.6-terra` reasoning=low, 14,358 bytes, 30+
`file:line` citations; Claude `sonnet`, 16,963 bytes, wide file:line coverage). Neither
stubbed; neither carried a `[reviewed-without-repo-access]` or
`[reviewed-without-source-citations]` marker. `SELF_CLI` was forced to `none` for this run
per the owner's explicit authorization, overriding the `CLAUDE_CODE_ENTRYPOINT`
independence-skip, so BOTH lanes ran (the claude lane as a separate `claude -p --model
sonnet` headless session with no inherited context; its output was captured from stdout to
sidestep the known `claude -p` write-permission gap). The orchestrator then ran a
source-grounding + cross-artifact fact-drift pass, reading every writer/reader of the
dashboard read path on disk and independently verifying each HIGH before recording it.

## Cycle-1 resolution (verified against the revised plans + code)

**Both Cycle-1 HIGHs are FULLY RESOLVED, and all 16 Cycle-1 actionable non-HIGH findings
are incorporated** into the current plans (each plan carries a `review_feedback_incorporated`
section mapping the finding to a specific must_have / task / acceptance-criterion edit, and
the orchestrator cross-checked the underlying code claims):

- **[RESOLVED HIGH] Plan 03 search post-processing parity** — `listDashboardSearch` now MUST
  replicate all three passes: birthday-id resolution + `populationMatchColumns`, the
  `filterByGravity` post-pass, and the soonest-birthday post-sort, with a shared private
  helper preferred and birthdays+term / gravity+term / parity tests required. Verified real
  against `dashboard-read.ts:279-291/295/315-322/324-335` and `dashboard-query-logic.ts:196`
  (`buildPopulationWhere` returns `"0"` for birthdays when `birthdayIds` empty). Both lanes
  confirm the fix.
- **[RESOLVED HIGH] Plan 01 a11y-inert background scope** — the inert + `no-hide-descendants`
  wrapper now covers the header destinations + ⋯ overflow, the search/toggle row, the footer,
  AND the collection (not the FlatList alone), with the control-row triggers deliberately left
  focusable; a named fallback (`accessible={false}` + `setAccessibilityFocus` re-assertion) is
  stated up front.
- **[RESOLVED actionable]** gravity source from `GRAVITY_TIERS` (impact.ts:63; both lanes
  re-verified), option-label summaries, `onChange` persistence-failure path, D-13/D-14
  re-pointing to the real DASHQ-08/ADR-062 leak + footer self-nav dead-end, disabled Select
  Contacts (real `disabled` prop + short-circuit `close()`), measured-layout responsive
  header, stale-testID grep, SegmentedControl icon extension + `depends_on: 26-02`, debounce
  requirement, surgical by-block-name test deletion preserving `listDashboardPopulation — Phase
  25 Active universe` (366-665), stale-comment sweep, constant-order pin, unused-`navigation`
  param, `doPurge` diff guard, filtered-count semantics, client-side-filter scale note.

Neither lane, nor the orchestrator audit, found any decision reversal, ADR conflict, or
[REJECTED]-item resurfacing in the revised plans. The revision discipline is good.

## Consensus Summary (Cycle 2)

The revised set is materially stronger and clears the Cycle-1 blockers. Cycle 2 surfaces
**two new HIGH implementability gaps** and a cluster of actionable refinements, concentrated
in the two plans that touch `HomeScreen`'s composition and the empty-state derivation
(Plans 01 and 07). None require a decision reversal, migration, network access, or scope
expansion — every proposed fix upholds the recorded decisions (D-11 in-tree non-Modal panel,
D-12 additive read, D-03 no-migration / preserved include-unbound machinery).

### Agreed Strengths (2+ lanes / orchestrator-verified)
- Both Cycle-1 HIGH fixes are genuinely fixed in code terms, not just reworded (both lanes).
- The D-12 read composition, the presentation seam, and the chrome-only refactors (Plans
  05/06) are sound and grounded in real source (both lanes).
- No decision reversal / ADR conflict / [REJECTED] resurfacing anywhere in the seven plans
  (both lanes + orchestrator).

### Agreed Concerns (highest priority — UNRESOLVED in the current plans)

- **[HIGH] Plan 07 — the birthday `populationCounts` derivation is unimplementable as written
  and would be incorrect.** Raised by BOTH lanes (Codex HIGH, Claude MEDIUM); **orchestrator
  verified**. Plan 07 Task 2 (files_modified = `HomeScreen.tsx` only) must-haves say the
  birthdays empty-state count "reuses the single `listBirthdayCandidates` resolution the read
  already performs — do not re-scan." But `listDashboardPopulation` computes the
  birthday-id/day-window resolution *locally and discards it* (`dashboard-read.ts:279-291`,
  returns only `DashboardRow[]`), so `HomeScreen` cannot reuse it across the module boundary;
  and `listBirthdayCandidates` (`dashboard-read.ts:572-580`) scans `WHERE archived_at IS NULL
  AND birthday IS NOT NULL` — it is **NOT bound-only**, so it includes Unbound contacts and a
  raw count would OVER-COUNT the bound-only Birthdays population, yielding a wrong
  birthday-empty decision (DASHC-07). No shared export exists and none is created in any task.
  **Fix (decision-safe, upholds D-12/D-03):** expose a bound-only birthday-window helper (e.g.
  `resolveBirthdayWindow(exec, now): {ids, days}` or have Plan 03's shared helper return
  `{rows, birthdayCandidateCount}` computed bound-only) and add it to the right plan's
  `files_modified`; or explicitly accept a lightweight bound-only re-scan in `HomeScreen` and
  drop the "do not re-scan / reuse" wording. (Severity divergence resolved to HIGH: a
  must_have is literally unsatisfiable AND the naive path is a correctness bug on a
  requirement.)

- **[HIGH] Plan 01 — the anchored panel/scrim cannot meet the full-screen dismiss + inert
  contract from its planned mount point inside the FlatList header.** Raised by Codex (HIGH);
  Claude did not surface it; **orchestrator verified HIGH**. `HomeScreen` renders
  `<View>` → `<ShellAppBar>` (`HomeScreen.tsx:533`) and `<FlatList>` (`:554`) as SIBLINGS, and
  the control row lives in the FlatList's `ListHeaderComponent` (`:571`, the `listHeader`
  region `:317+`). An absolutely-positioned `AnchoredPanel` + scrim rendered from
  `DashboardControlRow` therefore sits *inside the FlatList subtree*: it cannot physically
  place a scrim over the sibling `ShellAppBar` or catch an outside tap there, and it scrolls
  with the list content. Plan 01's inert-wrapper fix makes the app bar non-interactive but does
  NOT give the scrim full-screen coverage / outside-tap dismissal over the whole screen
  (DASHC-04/05). **Fix (decision-safe, upholds D-11 in-tree non-Modal):** host the panel/scrim
  at a root-level `DashboardOverlayHost` sibling to `ShellAppBar` and `FlatList`, with the
  control row reporting its measured anchor to that host. Not repairable by adding a11y props
  alone.

- **[MEDIUM] Plan 07 Task 3 — the read_first note is internally contradictory and would strand
  D-03-adjacent test coverage.** Raised by Claude; orchestrator concurs. Task 3 lists
  `describe("listNeverContacted")` (line 943) on the by-name DELETION list, yet the same note
  says "preserve intact the countNeverContacted assertions (1030/1039/1088)" — lines 1030/1039
  live INSIDE that `listNeverContacted` block (943-1041) and call `listNeverContacted`
  directly, so they cannot compile once the function is deleted; only 1088 (inside the
  surviving `counts` block) is preservable. Following the letter drops the ONLY coverage for
  the `include_unbound_never_contacted` × `countNeverContacted` interaction — the exact setting
  D-03 says to preserve/coordinate with Phase 36. Fix: drop the false preserve-1030/1039 claim
  (and accept the loss explicitly) OR lift that opt-in scenario into a NEW test in the surviving
  `counts` block before deletion.

### Divergent Views (resolved by orchestrator verification)
- **Overlay host (Plan 01).** Codex HIGH; Claude silent. Orchestrator verified the structural
  facts on disk (ShellAppBar/FlatList siblings; control row in `ListHeaderComponent`) and the
  RN consequence (an in-header absolute overlay cannot scrim the sibling app bar / scrolls with
  the list) → **recorded HIGH**. This is exactly the subsystem-composition catch that
  diff-scoped reading misses.
- **Birthday count severity (Plan 07).** Codex HIGH, Claude MEDIUM. Both found the same defect;
  orchestrator resolved to **HIGH** because a must_have is unsatisfiable as written and the
  naive derivation is a correctness bug on DASHC-07.

### Cross-artifact fact-drift (orchestrator pass, Cycle 2)
- No new untraceable decision labels: the Cycle-1 D-13/D-14 citations were re-pointed to the
  real DASHQ-08/ADR-062 leak and the footer self-nav dead-end, verified in Plans 03/04/06.
- Minor structural nit (not a review finding, noted for the executor): Plan 07 Task 3's
  `<acceptance_criteria>` opening tag appears absent after `</verify>` (~line 171) — cosmetic
  XML-shape drift, does not change content.

---

## Codex Review (Cycle 2)

## Summary

The revised plans are substantially stronger: they correctly preserve the migration boundary (`TARGET_VERSION = 19`), retain local-only SQLite reads, address the former search-read parity gap, and sequence the legacy-read retirement after the replacement is wired. Two cross-plan implementation seams still need correction before execution: the planned in-tree panel host cannot meet its full-screen scrim/inert contract from the proposed `FlatList` header location, and Plan 07 cannot obtain the promised birthday population count from the current read APIs without an explicit shared result/metadata contract.

## Plan 01 — Population tracer

### Strengths

- Correctly replaces the old persisted AsyncStorage prefs consumer. The current screen still imports and calls `useDashboardPrefs` at [HomeScreen.tsx:63](/home/bwales/projects/orbit-app/src/screens/HomeScreen.tsx:63) and [HomeScreen.tsx:101](/home/bwales/projects/orbit-app/src/screens/HomeScreen.tsx:101), while the new SQLite-backed query store already exposes hydration and safe write-through setters at [dashboard-query-store.ts:58](/home/bwales/projects/orbit-app/src/stores/dashboard-query-store.ts:58).
- The no-migration boundary is accurate: migration 019 owns the dashboard columns at [019-dashboard-prefs.ts:14](/home/bwales/projects/orbit-app/src/db/migrations/019-dashboard-prefs.ts:14) and the registered target is 19 at [database.ts:54](/home/bwales/projects/orbit-app/src/db/database.ts:54).
- Reusing `shellTransientStore` is sound. `dismissTop()` removes the entry before invoking its callback at [shell-transient-store.ts:46](/home/bwales/projects/orbit-app/src/stores/shell-transient-store.ts:46), and both Android Back and active-tab retap already call it at [RootNavigator.tsx:95](/home/bwales/projects/orbit-app/src/navigation/RootNavigator.tsx:95) and [RootNavigator.tsx:64](/home/bwales/projects/orbit-app/src/navigation/RootNavigator.tsx:64).
- The fixed UI population order deliberately avoids the source constant’s different order: `all-contacts` is last in [dashboard-query-logic.ts:5](/home/bwales/projects/orbit-app/src/logic/dashboard-query-logic.ts:5).

### Concerns

- **HIGH — The overlay host is not specified at a level that can satisfy the full-screen dismissal/inert requirement.** `HomeScreen` currently renders `ShellAppBar` as a sibling before `FlatList` at [HomeScreen.tsx:533](/home/bwales/projects/orbit-app/src/screens/HomeScreen.tsx:533), while all dashboard controls are in `FlatList`’s `ListHeaderComponent` at [HomeScreen.tsx:571](/home/bwales/projects/orbit-app/src/screens/HomeScreen.tsx:571). An absolutely positioned panel rendered from `DashboardControlRow` in that header remains inside the FlatList subtree; it cannot physically place a scrim over the sibling app bar or catch an outside tap there. Wrapping the app bar in an inert view prevents interaction but does not provide the promised scrim-dismiss route.
- **MEDIUM — The animation requirement omits the repository’s required pause behavior.** The plan requires Reanimated timing, but not pausing or cancelling it off-focus/background. This conflicts with [CLAUDE.md:151](/home/bwales/projects/orbit-app/CLAUDE.md:151)-[CLAUDE.md:152](/home/bwales/projects/orbit-app/CLAUDE.md:152); the existing Orrery explicitly derives focus and AppState for that purpose at [OrreryScreen.tsx:287](/home/bwales/projects/orbit-app/src/screens/OrreryScreen.tsx:287).

### Suggestions

- Define a root-level `DashboardOverlayHost` sibling to both `ShellAppBar` and `FlatList`. Have the control row report its measured anchor and requested content to that host. This preserves the non-Modal decision while letting one scrim cover and dismiss from the entire screen.
- Add `useIsFocused` and an AppState foreground guard to panel and search-collapse motion, with an immediate settled state when inactive.

### Risk Assessment

**HIGH** until the overlay-host ownership is explicit; it is central to DASHC-04/05 and cannot be repaired merely by adding accessibility properties.

## Plan 02 — Filters and Sort

### Strengths

- Gravity options correctly use the authoritative tiers, which are `thin/building/solid/deep` at [impact.ts:63](/home/bwales/projects/orbit-app/src/services/impact.ts:63), rather than incorrectly treating filter-family names as option values.
- The plan preserves the actual query architecture: gravity is intentionally a post-query TypeScript pass, as documented at [dashboard-query-logic.ts:113](/home/bwales/projects/orbit-app/src/logic/dashboard-query-logic.ts:113).
- It correctly keeps category retrieval outside the layer-2 component; `listCategories()` is an async DAO read at [contact-read.ts:49](/home/bwales/projects/orbit-app/src/db/contact-read.ts:49).

### Concerns

- **MEDIUM — “Render Phase 25 copy” has no identified source of truth.** The available query module exports opaque values and filter families, not user-facing labels: [dashboard-query-logic.ts:5](/home/bwales/projects/orbit-app/src/logic/dashboard-query-logic.ts:5), [dashboard-query-logic.ts:14](/home/bwales/projects/orbit-app/src/logic/dashboard-query-logic.ts:14), and [dashboard-query-logic.ts:118](/home/bwales/projects/orbit-app/src/logic/dashboard-query-logic.ts:118). The plan needs an explicit label map/module or it will necessarily re-author strings independently across Population, Filters, Sort, summaries, and empty states.

### Suggestions

- Add a single pure dashboard display-label module, or identify the existing UI-SPEC copy source and make all panel rows and summaries import it.

### Risk Assessment

**MEDIUM.** The query behavior is well-grounded; copy drift is the remaining integration risk.

## Plan 03 — Population-aware search read

### Strengths

- This revision properly addresses the former HIGH concern: `listDashboardPopulation` really does require birthday ID resolution, post-sort, and gravity filtering at [dashboard-read.ts:279](/home/bwales/projects/orbit-app/src/db/dashboard-read.ts:279), [dashboard-read.ts:315](/home/bwales/projects/orbit-app/src/db/dashboard-read.ts:315), and [dashboard-read.ts:324](/home/bwales/projects/orbit-app/src/db/dashboard-read.ts:324).
- The additive-read approach respects D-12. The current population read has no term argument at [dashboard-read.ts:274](/home/bwales/projects/orbit-app/src/db/dashboard-read.ts:274), and the legacy search preserves the A3 archived-only relaxation at [dashboard-read.ts:396](/home/bwales/projects/orbit-app/src/db/dashboard-read.ts:396).
- Bound-only scope is correctly preserved by `DASHBOARD_BOUND_WHERE` at [dashboard-read.ts:158](/home/bwales/projects/orbit-app/src/db/dashboard-read.ts:158).
- The plan’s injection approach matches the existing safe pattern: escaped terms are bound, including the SELECT-list snippet bind first, at [dashboard-read.ts:377](/home/bwales/projects/orbit-app/src/db/dashboard-read.ts:377)-[dashboard-read.ts:412](/home/bwales/projects/orbit-app/src/db/dashboard-read.ts:412).

### Concerns

- No material new concern. The shared-helper recommendation and parity tests are sufficient, provided the helper returns enough metadata for Plan 07’s birthday empty-state requirement.

### Suggestions

- Make the shared private helper return a structured result containing both rows and the resolved birthday candidate IDs/days. That avoids duplicating the birthday-window calculation in Plan 07.

### Risk Assessment

**MEDIUM.** SQL and scope risks are well covered; the remaining dependency is Plan 07’s consumption of birthday metadata.

## Plan 04 — Header, overflow, reset

### Strengths

- The disabled row correction is valid: current `OverflowMenu` always closes and invokes the action at [OverflowMenu.tsx:102](/home/bwales/projects/orbit-app/src/components/OverflowMenu.tsx:102), so an early disabled guard is necessary.
- The removal of old tab destinations is appropriate because the current overflow still contains Backup, Orrery, and Settings at [HomeScreen.tsx:114](/home/bwales/projects/orbit-app/src/screens/HomeScreen.tsx:114)-[HomeScreen.tsx:139).
- Reset can preserve view mode as claimed: `resetDashboardView()` retains `state.viewMode` at [dashboard-query-logic.ts:215](/home/bwales/projects/orbit-app/src/logic/dashboard-query-logic.ts:215).

### Concerns

- **LOW — The pure builder signature is internally inconsistent.** The plan alternates between `buildDashboardOverflowActions(navigation)` and a builder that also accepts a reset callback. Resolve this in the exported API and test it directly.

### Suggestions

- Use `buildDashboardOverflowActions({ navigation, onReset })`; this keeps the builder pure and avoids an implicit closure dependency.

### Risk Assessment

**LOW.** The current code evidence supports the intended refactor.

## Plan 05 — Archived child route

### Strengths

- `ShellAppBar` genuinely implements the transient-first Back policy at [ShellAppBar.tsx:29](/home/bwales/projects/orbit-app/src/components/ShellAppBar.tsx:29).
- Both stacks already register the same Archived component: [DashboardStack.tsx:62](/home/bwales/projects/orbit-app/src/navigation/tabs/DashboardStack.tsx:62) and [SettingsStack.tsx:32](/home/bwales/projects/orbit-app/src/navigation/tabs/SettingsStack.tsx:32).
- The chrome-only diff guard is a good protection for the destructive purge flow.

### Concerns

- No material concern.

### Suggestions

- Keep the planned diff guard and verify the Settings-origin Back path as well as the Dashboard-origin path.

### Risk Assessment

**LOW.**

## Plan 06 — Unbound route search

### Strengths

- The plan preserves a real retrieval path after dashboard search becomes bound-only. Current `listUnbound` remains the appropriate fixed-scope source, and the screen currently presents neutral rows at [UnboundContactsScreen.tsx:95](/home/bwales/projects/orbit-app/src/screens/UnboundContactsScreen.tsx:95).
- The proposed filter is safely in-memory and avoids inventing a second SQL query path.

### Concerns

- **MEDIUM — The count requirement and the prescribed implementation disagree.** `unboundCountLabel()` currently produces “N unbound contacts” at [unbound-list-logic.ts:2](/home/bwales/projects/orbit-app/src/screens/unbound-list-logic.ts:2). Plan 06 requires “N matching” during search but tells Task 2 only to pass the filtered length to that helper. That cannot produce the specified copy.

### Suggestions

- Extend the pure helper to accept a mode, such as `unboundCountLabel(count, { matching: boolean })`, and add node tests for both total and active-search forms.

### Risk Assessment

**MEDIUM.** Retrieval is protected, but the explicit count contract is otherwise unimplementable as written.

## Plan 07 — Search, view toggle, retirement

### Strengths

- Extending `SegmentedControl` is necessary and correctly scoped: the current option type has only `{ label, value }` at [SegmentedControl.tsx:22](/home/bwales/projects/orbit-app/src/components/SegmentedControl.tsx:22), and it renders only text at [SegmentedControl.tsx:75](/home/bwales/projects/orbit-app/src/components/SegmentedControl.tsx:75).
- Preserving `countNeverContacted` and the policy read is correct. `countNeverContacted()` still calls `readIncludeUnboundNeverContacted()` at [dashboard-read.ts:527](/home/bwales/projects/orbit-app/src/db/dashboard-read.ts:527), and Digest uses it at [DigestScreen.tsx:34](/home/bwales/projects/orbit-app/src/screens/DigestScreen.tsx:34).
- Surgical deletion is important: the current population-read test block is distinct from the old legacy blocks, and the plan no longer proposes broad line-range deletion.

### Concerns

- **HIGH — The stated birthday `populationCounts` derivation is unavailable from the current APIs.** `listDashboardPopulation()` computes `birthdayIds` locally and returns only `DashboardRow[]` at [dashboard-read.ts:279](/home/bwales/projects/orbit-app/src/db/dashboard-read.ts:279)-[dashboard-read.ts:335](/home/bwales/projects/orbit-app/src/db/dashboard-read.ts:335). `listBirthdayCandidates()` is a separate scan and includes every non-archived contact, including Unbound contacts, at [dashboard-read.ts:572](/home/bwales/projects/orbit-app/src/db/dashboard-read.ts:572). Plan 07 promises to “reuse the single resolution” without another scan, but no return value or exported helper makes that possible. It also risks a wrong birthday-empty decision if it counts unbound candidates.
- **MEDIUM — The planned read uses the immediate store value rather than the debounced value.** Existing behavior correctly uses `debouncedTerm` for both the DAO and empty state at [HomeScreen.tsx:177](/home/bwales/projects/orbit-app/src/screens/HomeScreen.tsx:177) and [HomeScreen.tsx:193](/home/bwales/projects/orbit-app/src/screens/HomeScreen.tsx:193). Plan 07 instead says `reload()` reads `useDashboardSessionStore.getState().searchText`, which can diverge from the debounced dependency and empty-state term during focus/refresh races.
- **MEDIUM — Search-collapse motion also omits the required focus/AppState pause.** This is the same repository invariant at [CLAUDE.md:151](/home/bwales/projects/orbit-app/CLAUDE.md:151)-[CLAUDE.md:152](/home/bwales/projects/orbit-app/CLAUDE.md:152).

### Suggestions

- Change the shared search/population helper to return `{ rows, birthdayCandidateCount }`, where the count is bound-only and uses the same 0–30-day predicate. Feed that result to the empty-state gate.
- Keep a reactive `debouncedSearchText` selected from the session store and use that exact value for `reload`, `hasTerm`, DAO calls, and no-match copy.
- Add focus/AppState handling to search-collapse animation.

### Risk Assessment

**HIGH** until the birthday-count contract is made implementable. Without it, DASHC-07’s population-specific empty states are either inaccurate or require an unplanned additional read.

## Overall risk assessment

**HIGH, but recoverable with focused plan edits.** The revised plans successfully address the earlier data-read, disabled-action, and sequencing issues. The remaining risks are concentrated in two architectural contracts: a root-level non-Modal overlay host for DASHC-04/05, and an explicit birthday metadata/count interface for DASHC-07. Neither requires a decision reversal, migration, network access, or scope expansion.

---

## Claude Review (Cycle 2)

# Cross-AI Review — Phase 26 Dashboard Control Surface (Cycle 2)

Verified against source on disk (not just plan text): `HomeScreen.tsx`, `dashboard-read.ts` (+ full `dashboard-read.test.ts`), `dashboard-query-logic.ts`, `dashboard-query-store.ts`, `dashboard-session-store.ts`, `dashboard-empty-logic.ts`, `dashboard-gravity-filter.ts`, `shell-transient-store.ts`, `overlay-base.tsx`, `GlassSurface.tsx`, `SegmentedControl.tsx`, `ShellAppBar.tsx`, `OverflowMenu.tsx`, `Icon.tsx`/`icon-registry.ts`, `ArchivedContactsScreen.tsx`, `UnboundContactsScreen.tsx`, `unbound-read.ts`, `unbound-list-logic.ts`, `impact.ts` (`GRAVITY_TIERS`), `app-settings-dao.ts`, `back-intent.ts`, `DashboardStack.tsx`/`SettingsStack.tsx`/`types.ts`, and `motion.ts`/`radii.ts`/`use-reduced-motion.ts`. Cycle-1 fixes (a11y-inert scope, gravity source, D-13/D-14 re-pointing, disabled-row semantics, search-removal sequencing) all check out against the code — good revision discipline. This pass focuses on what's new or still wrong.

---

## Plan 26-01 (Tracer: Population control + HomeScreen migration)

**Strengths**
- The row-order pin for `PopulationPanelContent` (All Contacts, Favourites, Birthdays, Not Contacted, Snoozed vs. the constant's `favourites, birthdays, not-contacted, snoozed, all-contacts` order) is correctly flagged and required explicit — confirmed the constant order differs at `src/logic/dashboard-query-logic.ts:5-11`.
- `AnchoredPanel`'s "borrow the contract, not the `Modal` impl" instruction is well-grounded: `overlay-base.tsx:86-127` really does wrap everything in `RNModal`, which would sit in a separate native window and break one-tap control switching, exactly as reasoned.
- `shellTransientStore.openTransient/closeTransient` + `dismissTop` (`shell-transient-store.ts:22-56`) is the correct, already-shipped free-Back mechanism; `ShellAppBar.tsx:29-40` and the plan's registration story line up.

**Concerns**
- **MEDIUM — the scrim opacity instruction has no numeric anchor.** `overlay-base.tsx:35` defines `SCRIM_OPACITY = 0.85` as a named constant; the plan says "lower... exact value is Claude's discretion/device-tunable" with no starting point. That's fine as discretion, but nothing in the plan requires exporting the new value as a similarly named constant (vs. an inline literal) — worth a one-line note so it doesn't become a magic number duplicated across `AnchoredPanel` size variants.
- **LOW — `getExecutor()` threading isn't explicit for hydrate timing.** `dashboard-query-store.ts:64` `hydrate(exec)` is async and the store's defaults (`populations: []`, `sort: "default"`) render fine pre-hydration (confirmed), so this isn't a blocker, but the plan doesn't say what gates the *first* `listDashboardPopulation` call — if it fires before `hydrate()` resolves, it will correctly query the Active default and then re-query once hydration lands. That's actually correct behavior, just worth confirming the plan intends a re-run on hydrate resolution (a `useEffect` dependency on the hydrated state), since nothing currently in the tracer's task text calls this out as its own must-have.

**Suggestions**
- Add an explicit acceptance line that the first population read re-fires after `hydrate()` resolves (not just that pre-hydration defaults render).

---

## Plan 26-02 (Filters + Sort panels)

**Strengths**
- `GRAVITY_TIERS` verified at `src/services/impact.ts:63-68` exactly as cited, exporting `{name, threshold}[]` with names `thin/building/solid/deep` — `GRAVITY_TIERS.map(t=>t.name)` is correct and the plan is right that `DASHBOARD_FILTER_FAMILIES` (`dashboard-query-logic.ts:14-20`) carries only the family name, not tier values.
- `CONTACT_FREQUENCY_BANDS` (`dashboard-query-logic.ts:29-34`) and `SOCIAL_BATTERY_VALUES`/`NEEDS_ATTENTION_VALUE` (`:38-39`) match the plan's option lists exactly.
- The persistence-failure-path requirement (await + retain-prior-selection + non-blocking error) is real: `dashboard-query-store.ts` setters (`setFilters`/`setSort`, `:81-92`) call `updateAppSettings` (which can reject) *before* `set()` — so an unhandled rejection genuinely would leave the UI silently stale without this guard. Good catch, correctly justified.

**Concerns**
- **LOW — category source ambiguity persists.** Task 1 says "Fetch `listCategories(getExecutor())` in DashboardControlRow (or accept it as a prop from HomeScreen if already loaded)" — this is explicitly left open, but Plan 01's tracer (which owns `HomeScreen.tsx` and `DashboardControlRow.tsx` first) doesn't mention preserving the `listCategories` fetch that today lives in `HomeScreen.tsx`'s `reload()` (`HomeScreen.tsx:199,204`, feeding the old `FilterChipRow`). Since Plan 01 removes `FilterChipRow`, an executor following Plan 01 alone has no signal to keep fetching categories, and Plan 02 (a different wave-2 plan, same wave as 03/04/05/06) doesn't coordinate who owns the single source of truth. Not fatal — either plan can independently fetch it — but as written it's plausible for `listCategories` to end up called twice (once orphaned in a to-be-removed spot, once fresh in `DashboardControlRow`), which isn't a bug so much as slight duplication the plans don't resolve.

**Suggestions**
- Have Plan 02 explicitly say "HomeScreen's `reload()` no longer needs `listCategories`; `DashboardControlRow` owns the fetch," removing the "or" ambiguity.

---

## Plan 26-03 (D-12 `listDashboardSearch` read)

**Strengths**
- Every mechanical claim about `listDashboardPopulation` checks out exactly against `dashboard-read.ts:274-336`: the birthday-id resolution feeding both `buildPopulationWhere` and `populationMatchColumns` (`:293,295`), the soonest-birthday post-sort (`:315-322`), and the `filterByGravity` post-pass (`:324-335`) are all real and all three genuinely need replication — this is not a theoretical gap, it's the exact shape of the existing function.
- `filterByGravity`'s actual signature (`dashboard-gravity-filter.ts:19-24`, `(candidateIds, selectedTiers, loadInputs, now)`) matches what the plan assumes it will thread through the new read.
- The "shared private helper, don't fork the public contract" resolution is sound given both functions would live in the same file (`dashboard-read.ts`) — no cross-module coupling problem.

**Concerns**
- None new beyond what cycle 1 already surfaced and this revision addressed. The birthday+term and gravity+term parity tests in Task 2 are the right verification strategy given the mechanism is real, not hypothetical.

---

## Plan 26-04 (Header destinations + overflow + Reset)

**Strengths**
- The `OverflowMenu.tsx:102-105` bug the plan fixes is real: `onPress={() => { close(); action.onPress(); }}` unconditionally calls `close()` today — a disabled row without this fix genuinely would dismiss the whole sheet on tap. The guard-both-calls fix is correctly scoped.
- Existing `dashboard-group-events-entry`/`dashboard-group-events-overflow-entry` testIDs are distinct in the current code (`HomeScreen.tsx:539` header vs. `:143` overflow) — the plan's grep-count-of-1 acceptance criterion is checking the right thing and won't false-positive against the overflow entry.
- D-06 (no Manage Favorites) and D-10 (no import) are correctly enforced by omission — the current overflow array (`HomeScreen.tsx:107-150`) has no such entries to begin with, so this is upheld, not newly introduced.

**Concerns**
- **LOW — the measured-layout fallback has an inherent first-paint risk the plan doesn't address.** "Driven by MEASURED layout (onLayout/onTextLayout)... not a character-count heuristic" is the right call over a static heuristic, but `onLayout`/`onTextLayout` only fire *after* a render — so the two-destination trailing region will necessarily render once with labels, measure, then potentially re-render icon-only. At worst this is a one-frame flash/reflow on cold mount or an OS-scale change, which the plan's "never wrap... control row invariant" acceptance criteria don't explicitly rule out for that transient first frame. Not a functional bug, but worth a Pixel-observed check since the dossier is emphatic that the control row must never visibly move.

**Suggestions**
- Note in the human-check step to specifically watch for a first-frame flash/reflow of the header on cold launch, not just steady-state at 200% scale.

---

## Plan 26-05 (Archived chrome refactor)

**Strengths**
- Every ADR-018 preservation claim is verified byte-for-byte against `ArchivedContactsScreen.tsx`: `confirmPurge` (58-74), `purgeBody` (84-87), `doPurge`+POST-COMMIT cleanup (128-172), and the danger-token trigger (242-253) all exist exactly as cited. The diff-guard acceptance criterion (zero changes inside the purge functions) is the correct verification mechanism given how much of this file must stay untouched.
- Dual route registration is real: `DashboardStack.tsx:62` and `SettingsStack.tsx:32` both register `Archived → ArchivedContactsScreen` — confirmed via grep. D-05's "one screen, two entry points" is achievable without any navigation change, matching the plan's "keep both, touch neither" instruction.

**Concerns**
- None beyond the already-addressed cycle-1 LOWs (unused `navigation` param, purge diff guard) — both are handled in the current text.

---

## Plan 26-06 (Unbound chrome + own-route search)

**Strengths**
- `listUnbound` (`unbound-read.ts:24-39`) genuinely has no search — fixed WHERE, `ORDER BY name COLLATE NOCASE, id` — confirming the ADR-062 gap is real, not invented. The client-side `filterUnboundByName` approach over the already-loaded, already-neutral `UnboundRow[]` is proportionate given the row shape carries no status/progress chrome to preserve (`unbound-read.ts:12-21`).
- The existing pure-helper module (`unbound-list-logic.ts`) is genuinely the right home and genuinely RN-free today, so the "mirror this idiom" instruction is accurate, not aspirational.

**Concerns**
- **LOW (plan already self-flags, correctly).** The unpaginated-full-list-then-filter approach is a real, if currently harmless, scale ceiling — `listUnbound` has no LIMIT/OFFSET and the filter runs in JS over the full result. The plan's T-26-17 disposition (accept at current scale) is reasonable given there's no pagination anywhere else in this read either.

**Suggestions**
- None beyond what's already written — this is the most tightly-scoped plan of the seven.

---

## Plan 26-07 (Search+toggle row, D-12 wiring, legacy retirement)

**Strengths**
- The `SegmentedControlOption` extension is correctly scoped as backward-compatible: confirmed `OrreryScreen.tsx:670-673` passes only `{label, value}` with no icon field, and `SegmentedControl.tsx:22-26` currently has no icon slot — adding an *optional* field and gating icon-render on its presence will not break the Orrery consumer, and `tsc --noEmit` is a legitimate (if narrow) proof of that specific claim.
- The by-block-name test deletion list in Task 3 is **exactly right** against the actual file: I verified all nine `listDashboard —`/`listNeverContacted` describe blocks the plan names to delete land at the exact line numbers claimed (174, 222, 254, 666, 696, 847, 896, 916, 943), and the one block the plan says must survive (`listDashboardPopulation — Phase 25 Active universe`) really does span 366-665, sitting *inside* the numeric range of blocks being deleted around it — so the "surgical, by name, not by line range" instruction is the only safe way to do this, and it's correctly identified as such.

**Concerns**
- **MEDIUM — Task 3's own read_first note is internally contradictory and will strand test coverage.** The note says: "MUST PRESERVE INTACT: ... the countNeverContacted assertions (1030/1039/1088)." I read the actual file: lines 1030 and 1039 (`expect(await countNeverContacted(exec)).toBe(1)` / `.toBe(2)`) sit *inside* `describe("listNeverContacted", ...)` at `dashboard-read.test.ts:943-1041` — specifically inside the test "excludes Unbound contacts by default and includes them in both list and count after persisted opt-in" (1019-1041), which also calls `listNeverContacted(exec, {...})` directly. That whole describe block is on the *deletion* list (named explicitly: `"listNeverContacted" (943)`) in the very same task. You cannot delete the block by name and simultaneously "preserve intact" two assertion lines living inside a test that calls the function being removed — the test literally will not compile once `listNeverContacted` is deleted from `dashboard-read.ts`. Only line 1088 (inside the surviving `describe("counts", ...)` block, 1069-1124) is actually preservable as written. Concretely: this deletes the *only* test coverage in the suite for the interaction between `include_unbound_never_contacted` and `countNeverContacted` (the "counts" describe block's own tests, 1069-1124, never touch that setting) — which is precisely the setting D-03 says must be preserved and coordinated with Phase 36, not dropped ad hoc. An executor following the letter of this instruction will either (a) silently drop that coverage while believing they "preserved" it per the note, or (b) stall trying to reconcile an impossible instruction.
- **MEDIUM — `populationCounts.birthdays` derivation is specified as reuse of a computation that is not exposed anywhere.** Both Task 2's must-have and action say the birthdays count must "reuse the single `listBirthdayCandidates` resolution the read already performs — do not re-scan." I read `listDashboardPopulation` (`dashboard-read.ts:274-336`) in full: the birthday-id/day-window resolution (candidate fetch → `daysUntilBirthday` filter to the 0–30 day window, `:279-291`) is entirely local to that function — it is computed and discarded, never returned to the caller. `HomeScreen.tsx` (the only file Task 2 touches) has no way to "reuse" that resolution across the module boundary; the only way to get a birthdays count is either (a) call `listBirthdayCandidates(exec)` again from `HomeScreen` and re-implement the exact 0–30-day filter inline — which *is* a re-scan and *is* duplicated (not reused) logic, directly contradicting the instruction's own "do not re-scan" clause — or (b) export the resolution as a shared helper from `dashboard-read.ts`, which isn't in Task 2's `files_modified` (only `HomeScreen.tsx`) and isn't assigned to any other task either. As written, the instruction describes a code-sharing mechanism that doesn't exist and isn't created anywhere in the plan, for the one population (`birthdays`) whose count can't be derived from an existing cheap `count*` DAO the way not-contacted/snoozed can (`countNeverContacted`/`countSnoozed` already exist and are genuinely reusable, `dashboard-read.ts:527-552`).

**Suggestions**
- Fix the Task 3 read_first note to either (a) drop the false "preserve 1030/1039" claim and explicitly accept the coverage loss as in-scope for this retirement, or (b) instruct the executor to lift the countNeverContacted-vs-opt-in scenario into a *new* test inside the surviving `describe("counts", ...)` block before deleting `listNeverContacted`'s block, so the interaction isn't silently dropped.
- Fix Task 2's populationCounts requirement by either naming a concrete new export (e.g. `resolveBirthdayWindow(exec, now): Promise<{ids, days}>` in `dashboard-read.ts`, shared by `listDashboardPopulation`/`listDashboardSearch`/the count) and adding it to `files_modified`, or by explicitly accepting that `HomeScreen` performs its own lightweight `listBirthdayCandidates` + day-window count as an intentional, acceptable small duplication rather than describing it as "reuse... do not re-scan."

---

## Overall Risk Assessment: **MEDIUM**

The architecture (presentation seam, in-tree `AnchoredPanel`, D-12 read composition, chrome-only refactors) is sound and, on this pass, every load-bearing mechanical claim I checked against the actual `dashboard-read.ts`/`dashboard-query-logic.ts`/`dashboard-query-store.ts`/`ArchivedContactsScreen.tsx`/`OverflowMenu.tsx`/`SegmentedControl.tsx` code held up — cycle-1's HIGH findings appear genuinely fixed, not just reworded. No decision reversal, ADR conflict, or [REJECTED]-item resurfacing was found in any of the seven plans.

The residual risk is concentrated entirely in **Plan 26-07's Task 2 and Task 3**, both of which contain concrete, file:line-verifiable internal contradictions rather than open design questions: one instructs "preserve" assertions that live inside a block the same task deletes by name, the other instructs "reuse" a computation that is private to a function never exposed to the caller that needs it. Both are fixable with a one- or two-line edit to Plan 07 before execution, and neither invalidates the plan's overall approach — but both are the kind of thing that produces a confused or silently-regressed executor run if left as-is, since an executor following either instruction literally cannot satisfy it.


---

## Verification coverage (Cycle 2)

**Source-grounding pass:** ON (`plan_review.source_grounding=true`). Both lanes received the
source-grounded prompt and cited `file:line` evidence. The orchestrator independently verified
both HIGHs and each divergent claim against the code on disk (not the diff or plan text alone),
re-reading every writer/reader of the dashboard read path — the graph cannot enumerate SQL
table writers, so this was a manual grep.

**Reader/writer map of the dashboard read path (re-verified on disk, Cycle 2):**
- `listDashboardPopulation` (`dashboard-read.ts:274`) — returns `DashboardRow[]` ONLY; its
  local birthday-id/day-window resolution (`:279-291`) and `filterByGravity` post-pass
  (`:324-335`) are computed and discarded, not returned. Callers: `HomeScreen` (post-01) +
  `widget-data.ts`. Public signature unchanged (no `term`) → D-11 no-fork held.
- `listDashboardSearch` (new, Plan 03) — must replicate the three post-processing passes via a
  shared private helper; wired only in Plan 07. The shared helper is the natural place to also
  expose the bound-only birthday count Plan 07 needs (see HIGH above).
- `listBirthdayCandidates` (`dashboard-read.ts:572`) — scans `archived_at IS NULL AND birthday
  IS NOT NULL`; **NOT bound-only (includes Unbound)** — the root of the Plan 07 birthday-count
  HIGH.
- `countNeverContacted` (`dashboard-read.ts:527`, depends on `readIncludeUnboundNeverContacted`)
  — callers DigestScreen + HomeScreen; preserved (D-03). Its only include-unbound-interaction
  TEST coverage lives in the `listNeverContacted` describe block Plan 07 Task 3 deletes (the
  Task 3 contradiction above).
- `listDashboard` / `listNeverContacted` (legacy) — retired by Plan 07; no runtime caller
  remains (`HomeScreen` migrates in Plan 01).
- `DASHBOARD_BOUND_WHERE = "c.tracking_enabled = 1"` (`dashboard-read.ts:159`) — bound-only
  scope confirmed for the population/search reads.

**Claims verified CONFIRMED (Cycle 2):** cycle-1 fixes present in the revised plans; ShellAppBar
/FlatList sibling composition + control row in `ListHeaderComponent` (`HomeScreen.tsx:533/554/571`);
`buildPopulationWhere` birthdays→`"0"` on empty ids (`dashboard-query-logic.ts:196`); gravity
post-query only (`:113`); `GRAVITY_TIERS` at `impact.ts:63`; `SegmentedControlOption` is
`{label,value}` only (`SegmentedControl.tsx:22-25`); `OverflowMenu` unconditional `close()`
(`:102-105`); the by-block-name test-deletion line numbers (174/222/254/666/696/847/896/916/943)
and the surviving `listDashboardPopulation — Phase 25 Active universe` block (366-665).

**Cross-artifact fact-drift pass:** ON. No new untraceable labels; folded into the Cycle-2
Consensus Summary above.

**Lane health (Cycle 2):** codex `ok=true stubbed=false exit=0` (14,358 bytes); claude
`ok=true stubbed=false exit=0` (16,963 bytes). Both lanes ran as independent headless sessions
(SELF_CLI forced to `none` per owner authorization, overriding the `CLAUDE_CODE_ENTRYPOINT`
independence-skip; claude ran as `claude -p --model sonnet`, output captured from stdout).

**Decision-reversal / escalation check (Cycle 2):** NONE. No HIGH or actionable finding's fix
deletes, weakens, or inverts a D-NN decision, an ADR, or a HANDOFF.md entry. Every proposed fix
UPHOLDS a recorded decision — the overlay-host fix keeps the in-tree non-Modal panel (D-11); the
birthday-count fix keeps the additive read + bound-only scope (D-12) and the include-unbound
machinery (D-03); the Task 3 fix protects D-03-adjacent coverage. Nothing requires owner
escalation on decision-reversal grounds.

## CYCLE_SUMMARY (Cycle 2 — unresolved in the current plans)

- **current_high = 2** — (1) Plan 07 birthday `populationCounts` derivation unimplementable +
  Unbound over-count; (2) Plan 01 anchored panel/scrim cannot dismiss/inert over the sibling
  app bar from inside the FlatList header (needs a root-level overlay host).
- **current_actionable = 9** — see the list below.

### Current Actionable Non-HIGH Concerns (Cycle 2)
1. **Plan 01** — panel enter/exit animation must pause on `useIsFocused === false` + AppState
   background (CLAUDE.md non-negotiable); add to must_have/action (codex MED).
2. **Plan 07** — search collapse/expand animation must honor the same focus/AppState pause
   invariant (codex MED).
3. **Plan 02** — name the single source of truth for filter/sort/population user-facing copy
   (a label map/module or the UI-SPEC copy) so labels are rendered, not re-authored across
   panels/summaries/empty-states (codex MED).
4. **Plan 06** — the "N matching" search count cannot be produced by passing the filtered
   length to today's `unboundCountLabel` ("N unbound contacts"); extend the pure helper with a
   mode (e.g. `unboundCountLabel(count,{matching})`) + node tests for both forms (codex MED).
5. **Plan 07 Task 2** — `reload()` must read the DEBOUNCED search value, not
   `useDashboardSessionStore.getState().searchText` (immediate), so the read/hasTerm/empty-state
   term cannot diverge during focus/refresh races (codex MED).
6. **Plan 07 Task 3** — resolve the contradictory "preserve 1030/1039" note (those lines are
   inside the `listNeverContacted` block being deleted): either accept the coverage loss
   explicitly OR lift the `include_unbound_never_contacted` × `countNeverContacted` scenario into
   the surviving `counts` block before deletion (claude MED).
7. **Plan 04** — settle the pure builder signature (it alternates between
   `buildDashboardOverflowActions(navigation)` and one taking a reset callback); adopt
   `buildDashboardOverflowActions({navigation, onReset})` and test it directly (codex LOW).
8. **Plan 02** — resolve `listCategories` fetch ownership across Plans 01/02 (Plan 01 removes
   `FilterChipRow` without a signal to keep the fetch; Plan 02 leaves it as "DashboardControlRow
   OR HomeScreen") to avoid an orphaned or double fetch (claude LOW).
9. **Plan 04** — add a Pixel human-check for a first-paint header flash/reflow on cold mount /
   OS-scale change (the measured-layout fallback renders-then-measures; the control row must
   never visibly move) (claude LOW).

*Advisory (not counted — within delegated discretion / behavior already correct):* Plan 01 could
export the panel scrim opacity as a named constant with a starting value rather than an inline
literal (claude); Plan 01 could add an explicit acceptance line that the first population read
re-fires after `hydrate()` resolves (claude — behavior is already correct).
