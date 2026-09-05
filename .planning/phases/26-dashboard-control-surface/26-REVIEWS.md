---
phase: 26
reviewers: [codex, claude]
reviewed_at: 2026-09-05T09:01:42Z
cycles: 5
plans_reviewed: [26-01-PLAN.md, 26-02-PLAN.md, 26-03-PLAN.md, 26-04-PLAN.md, 26-05-PLAN.md, 26-06-PLAN.md, 26-07-PLAN.md]
models:
  codex: "gpt-5.6-terra (reasoning=low)"
  claude: "sonnet (reasoning=low)"
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
  - cycle: 3
    reviewed_at: 2026-09-05T07:56:23Z
    current_high: 0
    current_actionable: 10
  - cycle: 4
    reviewed_at: 2026-09-05T08:25:31Z
    current_high: 0
    current_actionable: 4
  - cycle: 5
    reviewed_at: 2026-09-05T09:01:42Z
    current_high: 0
    current_actionable: 3
---

> **This file accumulates across convergence cycles as an audit trail.** The Cycle 1–4
> content below is retained verbatim as history; the authoritative CURRENT state is
> the **Cycle 5** section at the end of this file. Cycle-5 CYCLE_SUMMARY counts reflect only
> findings UNRESOLVED in the plans on disk at commit `b5c1ab1` — resolved prior-cycle
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
# CYCLE 2 (history — 2026-09-05T07:16:54Z) — 2 HIGH + 9 actionable, all since addressed in commit 957aa8c
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


═══════════════════════════════════════════════════════════════════════════════
# CYCLE 3 (history — 2026-09-05T07:56:23Z) — 0 HIGH + 10 actionable, all since addressed in commit a73f5aa
═══════════════════════════════════════════════════════════════════════════════

Both reviewer lanes ran again as independent headless sessions with full repo access and
produced source-grounded reviews (Codex `gpt-5.6-terra` reasoning=low, 15,868 bytes, **98**
`file:line` citations; Claude `sonnet` reasoning=low, 18,867 bytes, 25 `file:line`
citations). Neither stubbed; neither carried a `[reviewed-without-repo-access]` or
`[reviewed-without-source-citations]` marker. `SELF_CLI` was forced to `none` for this run
per the owner's explicit authorization, overriding the `CLAUDE_CODE_ENTRYPOINT`
independence-skip (which would otherwise skip the claude lane), so BOTH lanes ran — the
claude lane as a separate `claude -p --model sonnet` headless session with no inherited
context, its output captured from stdout to sidestep the known `claude -p`
write-permission gap. The orchestrator then ran a source-grounding + cross-artifact
fact-drift pass, reading the actual code on disk (every writer/reader of the dashboard read
path and the query store) and independently verifying each carried-forward and new finding
before recording it.

## Cycle-2 resolution (verified against the revised plans + code)

**Both Cycle-2 HIGHs are FULLY RESOLVED, and all Cycle-2 actionable findings are
incorporated** into the current plans (each plan carries a `review_feedback_incorporated`
section mapping the finding to a specific must_have / task / acceptance-criterion edit; the
orchestrator and BOTH lanes cross-checked the underlying code claims):

- **[RESOLVED HIGH] Plan 01 overlay host / full-surface scrim.** Plan 01 now introduces a
  root-level `DashboardOverlayHost` (new file, in `files_modified` and `<files>`), rendered as
  a sibling to `ShellAppBar` + `FlatList` inside HomeScreen's root View — NOT inside the
  FlatList `ListHeaderComponent`. `DashboardControlRow` measures each trigger with
  `measureInWindow` and reports `{anchorRect, size, content, onDismiss}` to the host over a
  tiny in-tree channel; the host renders the full-surface scrim + `AnchoredPanel` above
  everything. Acceptance criteria grep-assert `AnchoredPanel` appears in
  `DashboardOverlayHost.tsx` and is ABSENT from `DashboardControlRow.tsx`, and that the host is
  mounted outside the list closures. Verified real: `HomeScreen.tsx:533/554/571` (ShellAppBar
  and FlatList are siblings; control row in ListHeaderComponent) and
  `overlay-base.tsx:86` (the existing shared overlay is a `Modal` — correctly avoided). Both
  lanes confirm the fix; upholds D-11 (in-tree, non-Modal).
- **[RESOLVED HIGH] Plan 07 birthday `populationCounts` derivation.** The unimplementable
  "reuse the single `listBirthdayCandidates` resolution — do not re-scan" wording is explicitly
  superseded. Plan 03 now authors a NEW exported bound-only `countBirthdayPopulation(exec, now)`
  that resolves the same 0–30-day window as `listDashboardPopulation` but counts ONLY the
  bound-only (`tracking_enabled=1`), non-archived subset, so it equals the Birthdays
  population's actual row count; Plan 07 Task 2 consumes it in HomeScreen's `Promise.all`
  counts. Verified real against `dashboard-read.ts:572-580` (`listBirthdayCandidates` scans
  `archived_at IS NULL AND birthday IS NOT NULL` — genuinely NOT bound-only, so a raw count
  would over-count by including Unbound; the over-count risk was real) and `:279-291`
  (birthday-id resolution is local to `listDashboardPopulation` and never exposed across the
  module boundary). Plan 03 Task 2 adds a bound-only over-count-guard parity test. Both lanes
  confirm.
- **[RESOLVED MEDIUM] Plan 07 Task 3 "preserve 1030/1039" contradiction + D-03 coverage.** The
  false "preserve lines 1030/1039" claim is dropped; the `include_unbound_never_contacted` ×
  `countNeverContacted` scenario is LIFTED into the surviving `describe("counts")` block as a
  new `countNeverContacted`-only test BEFORE the `listNeverContacted` block is deleted,
  preserving the D-03-adjacent coverage without keeping the retired function. Deletion is now
  by-block-name (not line range). The D-03 machinery itself (`countNeverContacted`,
  `readIncludeUnboundNeverContacted`, the `include_unbound_never_contacted` read, all
  `app_settings`/`PORTABLE_SETTINGS_KEYS`) is explicitly preserved — no reversal.
- **[RESOLVED actionable]** search collapse/expand animation now pauses off-focus/background
  (Plan 07); the cosmetic missing `<acceptance_criteria>` tag is restored; stale-comment sweep
  and the constant-order / label-source refinements are all incorporated.

Neither lane, nor the orchestrator audit, found any decision reversal, ADR conflict, or
[REJECTED]-item resurfacing in the revised plans. The revision discipline is good.

## Consensus Summary (Cycle 3)

**The two Cycle-2 structural HIGHs are resolved with real, code-grounded fixes (not prose
patches), and Cycle 3 surfaces NO new HIGH.** Codex records zero HIGH concerns; Claude's
three "HIGH" mentions are all retrospective ("resolves the cycle-2 HIGH findings" /
"None of these rise to a HIGH-severity blocker") — neither lane raises a new blocker. The
residual findings are a cluster of MEDIUM/LOW implementability and specification gaps,
concentrated in the async query-store mutation path (Plans 01/02), the header measured-fit
fallback (Plan 04), and a few precision gaps in Plan 07. **None require a decision reversal,
migration, network access, or scope expansion — every proposed fix upholds the recorded
decisions (D-03 no-migration, D-04 locked icon-only header fallback, D-11 in-tree non-Modal
panel, D-12 additive bound-only read).**

### Agreed Strengths (2+ lanes / orchestrator-verified)
- Both Cycle-2 HIGH fixes are genuinely fixed in code terms, not just reworded — the
  root-level overlay host and the bound-only `countBirthdayPopulation` are the correct
  corrections and are grounded in real source (both lanes + orchestrator).
- Plan 03 is the strongest-verified plan: A3 relaxation copied verbatim from the real legacy
  branch, all three post-processing paths (birthday-id resolution, soonest-birthday sort,
  `filterByGravity`) correctly identified and ported, bound-only scope preserved (both lanes).
- The chrome-only refactors (Plans 05/06) are narrowly scoped, grep-verified against real
  testIDs and functions, and protect the ADR-018 purge flow via a git-diff guard (both lanes).
- No decision reversal / ADR conflict / [REJECTED] resurfacing anywhere in the seven plans
  (both lanes + orchestrator).

### Agreed Concerns (actionable, UNRESOLVED in the current plans)

- **[MEDIUM] Plan 01 — query-store hydration can clobber a just-made control selection.**
  Codex; orchestrator verified. `dashboard-query-store.ts:64` `hydrate` does
  `set(parseStoredState(await getAppSettings(exec)))` and each setter (`:65-92`) does
  `await updateAppSettings(...); set({...})` — no generation/`hydrated` guard. If the user
  opens Population before hydration settles, a late `hydrate()` applies an older snapshot after
  the user's persisted mutation. Plan 01 permits pre-hydration defaults but specifies no
  ordering / disabled-until-hydrated / generation-guard strategy. **Fix (decision-safe): add a
  must_have to gate mutations until hydrated OR add a generation guard so a late hydrate never
  overwrites a newer setter result.**
- **[MEDIUM] Plan 02 — concurrent async setters can lose a selection (no serialization).**
  Codex; orchestrator verified against the same store. `setFilters`/`setSort` (`:81-92`) each
  `await` then `set` from a rendered snapshot; two fast toggles can persist an older state
  last. Plan 02 says "guard conflicting presses" but names no concrete mechanism. **Fix:
  specify one — disable rows while a write is pending, queue mutations, or derive each mutation
  from `useDashboardQueryStore.getState()` in a serialized async action.**
- **[MEDIUM] Plan 04 — the measured icon-only header fallback is not robustly implementable
  within the stated file scope.** Codex (+ Claude's flash-default point). `files_modified` is
  `HomeScreen.tsx` only; `ShellAppBar` owns the title/trailing/overflow/padding/flex layout
  (`ShellAppBar.tsx:42-66`), so measuring HomeScreen's trailing content alone yields the
  post-flex allocated width, not whether title + two labels + overflow can coexist — the plan
  cannot reserve an explicit trailing budget from HomeScreen. **Fix: add `ShellAppBar.tsx` to
  Plan 04's `files_modified` (expose a measured header-content slot / `compactTrailing`
  decision).** Related (Claude): the pre-measurement first-render default is not mandated —
  Plan 04 gates it only as a conditional human-check ("if a flash is observed, gate the label
  render"); **make icon-only-until-measured the mandated default (fail-safe / expand-if-room)**
  so the label→collapse flash cannot occur. Upholds D-04 (locked icon-only fallback).
- **[MEDIUM] Plan 02 — `DashboardControlRow` owns the `listCategories` fetch but no refetch
  trigger is specified.** Claude. The Filters trigger now holds `categories` state, but no plan
  specifies the refetch lifecycle (mount vs on-focus), so a category renamed/added in another
  screen mid-session leaves a stale list. **Fix: specify the refetch trigger in Plan 02's
  action text.**
- **[MEDIUM] Plan 07 — capture `now` once per reload.** Codex. The reload issues the birthday
  list read and `countBirthdayPopulation` as separate parallel calls, each calling
  `localDateTime()` independently (`listDashboardPopulation` resolves birthdays from the passed
  date, `dashboard-read.ts:274`); across local midnight the list and the empty-state count can
  disagree, producing a wrong empty state for one refresh. **Fix: capture one
  `const now = localDateTime()` per reload and pass it to all related reads/counts.**
- **[MEDIUM] Plan 07 — type the new `SegmentedControl` `icon` field as `IconName`.** Claude.
  Task 1 adds an optional `icon` to `SegmentedControlOption<V>` described only as "a semantic
  icon name"; without an `IconName` (from `icon-registry.ts`) constraint, `tsc` will not catch
  an unregistered icon at the `SegmentedControl` call site. **Fix: type the field `IconName` so
  the compile-time check actually fires; the acceptance criteria only check that it compiles /
  Orrery keeps working.**
- **[LOW] Plan 01 — the `clampAnchorPosition` idempotency must_have is not type-valid.** Codex.
  The helper takes `{x,y,width,height}` but returns `{top,left,width}`, so "re-clamp the
  result" is not a fixed point over the same type. **Fix: redefine the idempotency test to
  assert independently-clamped horizontal geometry / constrained width, or a compatible
  rectangle conversion.**
- **[LOW] Plan 06 — render the search area before choosing the empty/non-empty branch.** Codex
  (+ Claude debounce note). The current screen renders the list only for `rows.length > 0`
  (`UnboundContactsScreen.tsx:72`); the refactor must render search whenever loading/error is
  resolved, then branch true-empty vs no-match vs filtered-list, or a no-match state is
  conflated with the true-empty state. **Fix: specify the branch order (`rows.length` before
  `filteredRows.length`); note debounce is optional given the client-side filter.**
- **[LOW] Plan 05 — state the fixed-chrome structure explicitly.** Codex. The current root is a
  `ScrollView` (`ArchivedContactsScreen.tsx:174`); the refactor must move `ShellAppBar` OUTSIDE
  the scroll container (root `View` → `ShellAppBar` → `ScrollView`), not merely swap the header
  inside it. **Fix: make the expected structure explicit in Task wording.**
- **[LOW] Plan 07 Task 3 — mandate a full re-read of `dashboard-read.test.ts` before
  deleting.** Both lanes flagged the test-file line citations (943-1041, 1019-1041, 1069-1124)
  as the single largest load-bearing claim not re-verified this cycle. By-block-name deletion
  already mitigates line drift; **add an explicit acceptance note that the executor re-reads the
  test file in full and treats cited line numbers as approximate before any deletion.**

### Divergent Views (resolved by orchestrator verification)
- **HIGH count.** Codex: zero HIGH. Claude: no new HIGH (its three "HIGH" strings are
  retrospective confirmations of the resolved Cycle-2 pair). Orchestrator concurs: **0
  unresolved HIGH this cycle.**
- **Header fallback framing.** Codex frames it as a file-scope gap (needs `ShellAppBar` to
  reserve a trailing budget); Claude frames it as a first-render default-direction gap (flash).
  Orchestrator: both are real and complementary — recorded as one MEDIUM with two parts.

### Cross-artifact fact-drift (orchestrator pass, Cycle 3)
- No new untraceable decision labels. Plan 04 correctly re-points the earlier untraceable
  "D-14" to the real footer self-navigation dead-end (`HomeScreen.tsx:410`), consistent with
  26-CONTEXT.md defining only D-01..D-12 (verified in Plan 04 must_haves).
- All spot-checked citations hold on disk: `listBirthdayCandidates` is not bound-only
  (`dashboard-read.ts:572-580`); the query-store setters have no serialization
  (`dashboard-query-store.ts:64-92`); Plan 04 `files_modified` is `HomeScreen.tsx` only
  (`ShellAppBar.tsx` is read-only reference). No fact-drift between plan text and code was
  found beyond the reviewer-side verification gaps (test-file line numbers), which the
  by-block-name deletion and the re-read note above address.

### Decision-collision check (escalation gate)
**No finding collides with a recorded decision.** Every proposed fix is an implementation
detail or an enforcement of an existing decision: the header-fallback fix (Plan 04) UPHOLDS
D-04's locked icon-only rule; the search-branch fix (Plan 06) upholds D-08; the read/count
fixes (Plans 03/07) uphold D-12 (additive bound-only) and D-03 (no migration). Nothing
deletes, weakens, or inverts a D-01..D-12 item, a HANDOFF.md entry, or an ADR. **No owner
escalation is required for this cycle.**

---

## Codex Review (Cycle 3)

# Phase 26 Plan Review — Convergence Cycle 3

## Summary

The revised seven-plan sequence is materially stronger: it resolves the prior structural problems around a header-scoped overlay, birthday population counts, search debouncing, and label ownership. The plans now trace the real Phase 25 store/read seams and preserve the forward-only schema boundary. Two implementation risks remain: hydration can race a user mutation, and the proposed measured header fallback cannot be made reliable from `HomeScreen` alone with the current `ShellAppBar` API.

## Plan 01 — Population tracer

### Strengths

- The root-level `DashboardOverlayHost` is the correct correction to the original overlay-placement flaw. `ShellAppBar` and the `FlatList` are siblings in the current screen, so an overlay inside `ListHeaderComponent` could not cover or intercept the app bar. [`src/screens/HomeScreen.tsx:533-554`](/home/bwales/projects/orbit-app/src/screens/HomeScreen.tsx:533)

- Reusing `shellTransientStore` is sound. `dismissTop()` removes the entry before calling its callback, and both Android Back and active-tab retap already invoke it. [`src/stores/shell-transient-store.ts:46`](/home/bwales/projects/orbit-app/src/stores/shell-transient-store.ts:46), [`src/navigation/RootNavigator.tsx:95`](/home/bwales/projects/orbit-app/src/navigation/RootNavigator.tsx:95), [`src/navigation/RootNavigator.tsx:64`](/home/bwales/projects/orbit-app/src/navigation/RootNavigator.tsx:64)

- The plan correctly avoids `Modal` for the panel. The existing shared overlay is a native `Modal`, which would put the live controls in a different window. [`src/components/ui/overlay-base.tsx:86`](/home/bwales/projects/orbit-app/src/components/ui/overlay-base.tsx:86)

- Replacing the old AsyncStorage preference store and `listDashboard` is accurately targeted: the current screen still reads `useDashboardPrefs` and the old query. [`src/screens/HomeScreen.tsx:101`](/home/bwales/projects/orbit-app/src/screens/HomeScreen.tsx:101), [`src/screens/HomeScreen.tsx:193`](/home/bwales/projects/orbit-app/src/screens/HomeScreen.tsx:193)

### Concerns

- **MEDIUM — Store hydration can overwrite a just-made control selection.** `hydrate()` asynchronously reads settings and directly calls `set(...)`; each setter separately awaits its write and then calls `set(...)`. [`src/stores/dashboard-query-store.ts:64`](/home/bwales/projects/orbit-app/src/stores/dashboard-query-store.ts:64), [`src/stores/dashboard-query-store.ts:73`](/home/bwales/projects/orbit-app/src/stores/dashboard-query-store.ts:73) If the user opens Population before hydration finishes, hydration can apply an older snapshot after the user’s persisted mutation. The plan explicitly permits pre-hydration defaults but does not specify ordering or a disabled-until-hydrated strategy.

- **LOW — The requested anchor-helper “idempotency” is not well-defined by its proposed types.** `clampAnchorPosition` returns `{top,left,width}`, while its input requires `{x,y,width,height}`. Refeeding the result is not a type-valid fixed-point operation. The test should instead assert independently clamped horizontal geometry or define a compatible rectangle conversion.

### Suggestions

- Add a `hydrated`/generation guard to the query store, or await hydration before enabling mutations; ensure a late hydrate never overwrites a newer setter result.
- Define the anchor fixed-point test in terms of `left` and constrained width, not by passing the output directly back as an anchor rectangle.

### Risk Assessment

**MEDIUM.** The architecture is correct, but query-state hydration is a real persistence race on the first interactive render.

---

## Plan 02 — Filters and Sort

### Strengths

- The plan correctly identifies that Gravity cannot be obtained from `DASHBOARD_FILTER_FAMILIES`; its authoritative values are `GRAVITY_TIERS`. [`src/logic/dashboard-query-logic.ts:14`](/home/bwales/projects/orbit-app/src/logic/dashboard-query-logic.ts:14), [`src/services/impact.ts:63`](/home/bwales/projects/orbit-app/src/services/impact.ts:63)

- The summary design is appropriately based on option labels rather than filter-family names. This matters because the persisted state is an array per family and category IDs require name resolution. [`src/logic/dashboard-query-logic.ts:65`](/home/bwales/projects/orbit-app/src/logic/dashboard-query-logic.ts:65)

- The plan preserves the data-layer contract: filter SQL is closed-set/parameterized, while gravity is intentionally a post-query pass. [`src/logic/dashboard-query-logic.ts:75`](/home/bwales/projects/orbit-app/src/logic/dashboard-query-logic.ts:75), [`src/db/dashboard-read.ts:324`](/home/bwales/projects/orbit-app/src/db/dashboard-read.ts:324)

### Concerns

- **MEDIUM — Rapid multi-option changes still need a concrete serialization mechanism.** The plan says to guard conflicting presses, but callbacks will otherwise compute `next` from a rendered snapshot while `setFilters` and `setSort` are asynchronous. The current setters do not serialize writes. [`src/stores/dashboard-query-store.ts:81`](/home/bwales/projects/orbit-app/src/stores/dashboard-query-store.ts:81) Two fast toggles can lose one selection or persist an older state last.

### Suggestions

- Specify one mechanism: disable rows while a write is pending, queue mutations, or derive each mutation from `useDashboardQueryStore.getState()` in a serialized async action.

### Risk Assessment

**MEDIUM.** The data sources and presentation seam are good; mutation ordering needs an explicit implementation decision.

---

## Plan 03 — Population-aware search read

### Strengths

- This is the strongest data-layer plan. It correctly recognizes that `listDashboardPopulation` requires birthday-ID resolution before `buildPopulationWhere`; otherwise a Birthdays population resolves to `0`. [`src/db/dashboard-read.ts:279`](/home/bwales/projects/orbit-app/src/db/dashboard-read.ts:279), [`src/logic/dashboard-query-logic.ts:190`](/home/bwales/projects/orbit-app/src/logic/dashboard-query-logic.ts:190)

- It correctly carries forward the two non-SQL post-processing paths: birthday ordering and gravity filtering. [`src/db/dashboard-read.ts:315`](/home/bwales/projects/orbit-app/src/db/dashboard-read.ts:315), [`src/db/dashboard-read.ts:324`](/home/bwales/projects/orbit-app/src/db/dashboard-read.ts:324)

- It preserves the recorded A3 search behavior from the legacy term branch: archived exclusion, bound-only scope, and name-or-fuel matching with bound parameters. [`src/db/dashboard-read.ts:396`](/home/bwales/projects/orbit-app/src/db/dashboard-read.ts:396)

- Adding a bound-only birthday counter addresses the prior count mismatch. The current birthday candidate read includes all non-archived contacts, including Unbound ones. [`src/db/dashboard-read.ts:571`](/home/bwales/projects/orbit-app/src/db/dashboard-read.ts:571)

### Concerns

- **LOW — The shared-helper extraction must retain parameter ordering exactly.** `populationMatchColumns()` contributes SELECT-list placeholders before `where` and filter placeholders. [`src/db/dashboard-read.ts:293`](/home/bwales/projects/orbit-app/src/db/dashboard-read.ts:293), [`src/db/dashboard-read.ts:312`](/home/bwales/projects/orbit-app/src/db/dashboard-read.ts:312) The new search query adds a snippet placeholder that must precede those. The plan states this, and the proposed tests should make it explicit with a Birthdays-plus-term case.

### Suggestions

- Add a direct test with both birthday IDs and a matching fuel snippet. It will catch accidental placeholder order regressions during helper extraction.

### Risk Assessment

**LOW.** The essential parity cases and security constraints are now directly planned and testable.

---

## Plan 04 — Header and overflow

### Strengths

- The amended five-row overflow is correctly scoped against the existing six-row legacy array. [`src/screens/HomeScreen.tsx:107`](/home/bwales/projects/orbit-app/src/screens/HomeScreen.tsx:107)

- The disabled-row fix is necessary and well targeted: the current menu unconditionally closes and invokes each action. [`src/components/OverflowMenu.tsx:96`](/home/bwales/projects/orbit-app/src/components/OverflowMenu.tsx:96)

- The Reset wiring correctly uses the existing query-store reset, which preserves `viewMode`. [`src/stores/dashboard-query-store.ts:93`](/home/bwales/projects/orbit-app/src/stores/dashboard-query-store.ts:93), [`src/logic/dashboard-query-logic.ts:215`](/home/bwales/projects/orbit-app/src/logic/dashboard-query-logic.ts:215)

### Concerns

- **MEDIUM — The measured icon-only fallback is not implementable robustly within the stated file scope.** `ShellAppBar` owns the title, trailing slot, overflow trigger, padding, and flex layout. [`src/components/ShellAppBar.tsx:42`](/home/bwales/projects/orbit-app/src/components/ShellAppBar.tsx:42), [`src/components/ShellAppBar.tsx:69`](/home/bwales/projects/orbit-app/src/components/ShellAppBar.tsx:69) Measuring only the `HomeScreen` trailing content tells it the post-flex allocated width, not whether title + two labels + overflow can safely coexist. The plan modifies only `HomeScreen.tsx`, so it cannot measure the complete bar or reserve an explicit trailing budget.

### Suggestions

- Add `ShellAppBar.tsx` to Plan 04. Expose a measured header-content slot or a `compactTrailing` decision driven by full bar layout. Gate visible labels until that first measurement is available to avoid the acknowledged first-frame reflow.

### Risk Assessment

**MEDIUM.** Overflow work is sound; the locked header-fit requirement needs ownership at the app-bar level.

---

## Plan 05 — Archived child route

### Strengths

- This is a narrowly scoped chrome refactor. The screen currently has a hand-rolled Back handler. [`src/screens/ArchivedContactsScreen.tsx:180`](/home/bwales/projects/orbit-app/src/screens/ArchivedContactsScreen.tsx:180)

- `ShellAppBar` does use the same transient-first Back resolver as the root navigator. [`src/components/ShellAppBar.tsx:29`](/home/bwales/projects/orbit-app/src/components/ShellAppBar.tsx:29)

- Both stacks already register the same `ArchivedContactsScreen`, so retaining registrations preserves the two entry paths. [`src/navigation/tabs/DashboardStack.tsx:62`](/home/bwales/projects/orbit-app/src/navigation/tabs/DashboardStack.tsx:62), [`src/navigation/tabs/SettingsStack.tsx:32`](/home/bwales/projects/orbit-app/src/navigation/tabs/SettingsStack.tsx:32)

- The plan explicitly protects the existing destructive path, which includes the confirm gate and post-commit cleanup. [`src/screens/ArchivedContactsScreen.tsx:128`](/home/bwales/projects/orbit-app/src/screens/ArchivedContactsScreen.tsx:128)

### Concerns

- **LOW — The refactor must move the app bar outside the `ScrollView`, not merely replace the header inside it.** The current root is itself a `ScrollView`. [`src/screens/ArchivedContactsScreen.tsx:174`](/home/bwales/projects/orbit-app/src/screens/ArchivedContactsScreen.tsx:174) The plan’s wording implies this, but the task should state a root `View` plus scrollable content explicitly; otherwise the “fixed child chrome” intent is not achieved.

### Suggestions

- Make the expected structure explicit: root `View` → `ShellAppBar` → `ScrollView`, while retaining the screen test ID on the outer root or a stable testable node.

### Risk Assessment

**LOW.** The protected destructive-flow diff guard is appropriate.

---

## Plan 06 — Unbound child route and search

### Strengths

- It closes the actual retrieval gap: the current Unbound route has no search and `listUnbound` is already a neutral, name-sorted local read. [`src/screens/UnboundContactsScreen.tsx:95`](/home/bwales/projects/orbit-app/src/screens/UnboundContactsScreen.tsx:95), [`src/db/unbound-read.ts:24`](/home/bwales/projects/orbit-app/src/db/unbound-read.ts:24)

- The matching-count correction is valid. The existing helper can only produce “N unbound contacts.” [`src/screens/unbound-list-logic.ts:2`](/home/bwales/projects/orbit-app/src/screens/unbound-list-logic.ts:2)

- Keeping the filter in pure TypeScript over loaded local rows does not introduce SQL interpolation or a network path.

### Concerns

- **LOW — Search must remain available before a nonempty-list branch is chosen.** The current conditional renders the list only for `rows.length > 0`. [`src/screens/UnboundContactsScreen.tsx:72`](/home/bwales/projects/orbit-app/src/screens/UnboundContactsScreen.tsx:72) The implementation should render the search area whenever loading/error is resolved, then choose among true-empty, no-match, and filtered-list content. Otherwise the no-match state can be accidentally conflated with the true empty state.

### Suggestions

- Model `const filteredRows = filterUnboundByName(rows ?? [], term)` and branch on `rows.length` before `filteredRows.length`.

### Risk Assessment

**LOW.** The route refactor and retrieval replacement are well bounded.

---

## Plan 07 — Search/toggle completion and legacy-read retirement

### Strengths

- The plan correctly restores a real debounce rather than relying on cancellation as a query coalescer. The legacy screen already uses a 220ms settled term. [`src/screens/HomeScreen.tsx:168`](/home/bwales/projects/orbit-app/src/screens/HomeScreen.tsx:168)

- It correctly uses the session store for ephemeral search state. [`src/stores/dashboard-session-store.ts:21`](/home/bwales/projects/orbit-app/src/stores/dashboard-session-store.ts:21)

- Extending `SegmentedControl` is necessary because it currently accepts only `{label,value}` and renders only text. [`src/components/SegmentedControl.tsx:22`](/home/bwales/projects/orbit-app/src/components/SegmentedControl.tsx:22), [`src/components/SegmentedControl.tsx:75`](/home/bwales/projects/orbit-app/src/components/SegmentedControl.tsx:75)

- Legacy-read retirement is feasible: current runtime usage is confined to `HomeScreen`; remaining references outside the database tests are comments. [`src/screens/HomeScreen.tsx:56`](/home/bwales/projects/orbit-app/src/screens/HomeScreen.tsx:56), [`src/services/widget/widget-data.ts:18`](/home/bwales/projects/orbit-app/src/services/widget/widget-data.ts:18)

- The plan correctly preserves `countNeverContacted`, which Digest still consumes. [`src/screens/DigestScreen.tsx:34`](/home/bwales/projects/orbit-app/src/screens/DigestScreen.tsx:34), [`src/db/dashboard-read.ts:527`](/home/bwales/projects/orbit-app/src/db/dashboard-read.ts:527)

### Concerns

- **MEDIUM — Capture `now` once per reload.** The plan repeatedly calls `localDateTime()` in parallel list/count reads. The birthday list and birthday empty-state count can disagree across local midnight, producing an incorrect empty state for one refresh. `listDashboardPopulation` uses the supplied date to resolve birthdays. [`src/db/dashboard-read.ts:274`](/home/bwales/projects/orbit-app/src/db/dashboard-read.ts:274) Capture `const now = localDateTime()` once and pass it to all related reads.

- **LOW — Card mode remains semantically misleading until Phase 28.** `viewMode` will persist and the toggle changes state, but Home still renders `ContactCard` rows. [`src/screens/HomeScreen.tsx:565`](/home/bwales/projects/orbit-app/src/screens/HomeScreen.tsx:565) The plan acknowledges the deferred renderer, but UAT should explicitly confirm this disabled/provisional behavior is acceptable for the phase sequence.

### Suggestions

- Use one local timestamp per reload and per `Promise.all`.
- Ensure the provisional Card selection is visibly communicated or intentionally hidden until the Card renderer is available, if a user-visible no-op is not acceptable.

### Risk Assessment

**MEDIUM.** The search/retirement sequence is now well covered, but timestamp coherence and the pre-Card-mode interaction need deliberate handling.


---

## Claude Review (Cycle 3)

# Cross-AI Plan Review: Phase 26 Dashboard Control Surface (Convergence Cycle 3)

## Summary

The 7 plans present a coherent, well-sequenced tracer→expand→backfill architecture that correctly resolves the cycle-2 HIGH findings (root-level `DashboardOverlayHost` for the overlay scrim; `countBirthdayPopulation` for the empty-state count derivation). Verification against the actual source files on disk confirms most factual claims hold up, but I found several places where plan text asserts a mechanism that doesn't fully match the verified code, plus a few genuinely new risks introduced by the cycle-3 revisions themselves.

## Plan 01 (Population tracer + AnchoredPanel/DashboardOverlayHost)

**Strengths**
- The overlay-host redesign is well-grounded: `ShellAppBar.tsx:42-66` confirms the app bar and its `trailing`/`OverflowMenu` render as siblings inside one `View`, and `HomeScreen.tsx` (per RESEARCH/PATTERNS citations) composes `ShellAppBar` and `FlatList` as top-level siblings — so a root-level `DashboardOverlayHost` genuinely can cover both, which an in-header overlay could not.
- `shellTransientStore` (`src/stores/shell-transient-store.ts:22-56`) really does give free Back-dismiss ordering via `dismissTop()`, and `ShellAppBar.tsx:29-40` really does route Back through `resolveBackIntent` — the plan's reliance on this is accurate.
- `buildPopulationWhere` (`dashboard-query-logic.ts:184-186`) does return `ACTIVE_SEGREGATION_WHERE` for an empty population array — the "deselect last → Active" claim is correct.

**Concerns**
- **MEDIUM — `useReducedMotion()` is a state-backed hook, but `AnchoredPanel`/`DashboardOverlayHost` need it alongside `useIsFocused`+`AppState` gating.** `use-reduced-motion.ts:122-132` shows `useReducedMotion()` triggers a re-render on every OS toggle — combining this with a `useIsFocused`/`AppState` derivation (mirroring `OrreryScreen.tsx:287-295`, not verified in this session's reads but cited consistently across all plans) is plausible but the plan never specifies precedence when both reduced-motion AND unfocused apply simultaneously — likely harmless (both collapse to "no animate") but worth a one-line acceptance check to avoid divergent code paths.
- **LOW — the "single dashboard-panel channel" design (store vs lifted state) is left fully to executor discretion** with no fallback specified if a Zustand store re-render cascades unnecessarily into `FlatList`. Given `DashboardControlRow` will re-render on every keystroke-adjacent state change in Plan 07, an implicit store choice here could set a re-render pattern that Plan 07 then has to work around. Not blocking, but the "Claude's discretion" framing undersells the downstream coupling.
- **MEDIUM — the icon-registry additions in Task 1 and the `AnchoredPanel`/`DashboardOverlayHost` work in Task 2 are bundled as one `tracer` task with `tdd="false"`,** yet the acceptance criteria demand an on-device TalkBack pass before the task is "done." Given plan-level automation only runs `tsc`/`check:colors`/existing vitest suites, the a11y-hide claim (Pattern 2 in RESEARCH.md, `importantForAccessibility="no-hide-descendants"`) is asserted as verified in acceptance criteria bullets but is actually unverifiable until a human runs the Pixel check — the plan does correctly gate this as `<human-check>`, so this is a structural risk (large task, weak automated backstop) rather than a plan defect.

**Suggestions**
- Add an explicit note on what happens if `DashboardOverlayHost`'s subscription to the panel channel causes a full `HomeScreen` re-render on open — since `DashboardControlRow` will grow to 3 triggers in Plan 02, a store-shape decision here should specify shallow-selector usage to avoid `FlatList` re-render thrash.

## Plan 02 (Filters + Sort panels)

**Strengths**
- `GRAVITY_TIERS` sourcing claim is directionally correct per the plan's own citation (`src/services/impact.ts:63`) and matches `dashboard-gravity-filter.ts`'s consumption pattern implied by `dashboard-read.ts:324-335` (`filterByGravity` runs post-query, confirming gravity truly has no SQL predicate, matching `dashboard-query-logic.ts:113-114`'s comment "Gravity deliberately contributes no SQL").
- `DASHBOARD_FILTER_FAMILIES` (`dashboard-query-logic.ts:14-20`) is confirmed to carry only family names, not gravity tier values — the plan's insistence on **not** deriving gravity options from this constant is correct and well-cited.
- `setFilters`/`setSort` signatures (`dashboard-query-store.ts:81-92`) match the plan's described await/reject-handling requirement — both are genuinely async and can reject inside `updateAppSettings`, so the "retain prior selection on rejection" must-have is a real, not hypothetical, concern.

**Concerns**
- **LOW — `CONTACT_FREQUENCY_BANDS` bucket keys (`weekly/monthly/quarterly/yearly`) are referenced but the plan never verifies the exact SQL bucket names surfaced to `buildFilterWhere`'s `frequencyPredicate`** (`dashboard-query-logic.ts:41-67`) match 1:1 with what FilterPanelContent will render as option values — the code confirms `isContactFrequencyBucket` gates on `CONTACT_FREQUENCY_BANDS` keys exactly, so this is fine, but the plan's action text says "the CONTACT_FREQUENCY_BANDS buckets (weekly/monthly/quarterly/yearly)" without citing the actual object keys at `dashboard-query-logic.ts:29-34` — a minor grounding gap, not a functional one.
- **MEDIUM — the `DashboardControlRow` in Plan 02 is described as adding a Filters trigger that "OWNS the category fetch,"** but this creates an implicit invariant: `DashboardControlRow` must now hold `categories` state and re-fetch on some lifecycle event (mount? focus?) that isn't specified anywhere in Plan 02's action text. Since `listCategories` result staleness (a category renamed/added mid-session) isn't addressed, this is a legitimate but minor gap — not a correctness bug given the app's local-first synchronous nature, but worth flagging since no plan specifies a refetch trigger.

**Suggestions**
- Specify when `DashboardControlRow` should re-fetch `listCategories` (mount-only vs on-focus) to avoid a stale category list surviving a category rename in another screen during the same session.

## Plan 03 (listDashboardSearch + countBirthdayPopulation)

**Strengths**
- This is the strongest-verified plan. The A3 relaxation semantics quoted in the plan (`dashboard-read.ts:396-413`) are verified byte-for-byte against the actual `listDashboard` function body read this session — the plan's "copy verbatim" instruction is grounded in real, present code.
- The plan correctly identifies that `listDashboardPopulation` (`dashboard-read.ts:274-336`) already implements birthday-id resolution (279-291), the soonest-birthday post-sort (315-322), and the `filterByGravity` post-pass (324-335) — all three exist and are correctly cited by line number.
- `countNeverContacted` (`dashboard-read.ts:527-541`) and `readIncludeUnboundNeverContacted` (466-475) are both real, currently-consumed functions, confirming the D-03 preservation requirement is grounded in genuine code, not a guess.
- The `countBirthdayPopulation` design — reusing the birthday-window resolution but intersecting with a bound-only, non-archived subset — is architecturally sound and does correctly diagnose that `listBirthdayCandidates` (`dashboard-read.ts:572-580`) has **no** `tracking_enabled` filter, confirming the over-count risk the plan flags is real, not hypothetical.

**Concerns**
- **MEDIUM — the plan instructs extracting a "shared private helper" from `listDashboardPopulation` but the existing function is not structured to trivially decompose** — `birthdayIds`/`birthdayDays` resolution (lines 279-291), the WHERE/filter composition, and the post-processing (315-335) are all inlined in one function body with local closures over `now`/`query`. The plan's "if a clean shared helper is impractical, FULLY duplicate" escape hatch is reasonable, but there's a real risk the executor produces two independently-diverging birthday/gravity implementations if the extraction proves awkward — the plan's parity tests (Task 2) are the correct safety net here, so this is a managed risk, not a plan defect.
- **LOW — the plan's test scaffolding references `dashboard-read.test.ts:696` ("listDashboard — search") as the oracle to port from**, but this file wasn't read in this review session, so I cannot verify the exact line numbers or block structure cited. This is a verification gap on my part, not necessarily a plan defect — but the acceptance criteria's grep-gates (`describe("listDashboardSearch...")`) are self-verifying regardless of whether the ported oracle line numbers are exactly right.

**Suggestions**
- None beyond flagging the extraction-risk as something Task 2's parity tests must catch if it materializes.

## Plan 04 (Header destinations + overflow)

**Strengths**
- `OverflowMenu.tsx:102-105` confirms the current `onPress` handler unconditionally calls `close()` then `action.onPress()` — the plan's diagnosis that a disabled row needs an early return to avoid dismissing the sheet is verified against real code, not speculative.
- `OverflowAction` interface (`OverflowMenu.tsx:28-35`) genuinely lacks a `disabled` field today, confirming the extension is real, additive work, not redundant.
- The single-object-param `buildDashboardOverflowActions({ navigation, onReset })` design is a reasonable, testable contract given `OverflowMenu`'s existing `testID`/`accessibilityLabel` support (lines 33-34, 96-113) can be reused without modification for the 5 new rows.

**Concerns**
- **LOW — the plan's acceptance criteria for the disabled-row Pressable rely on "the REAL Pressable `disabled` prop,"** but React Native's `Pressable` with `disabled={true}` still fires `onPress` in some older RN versions if the handler isn't also gated — the plan does correctly ALSO require the `onPress` handler to short-circuit on `action.disabled` (belt-and-braces), so this is actually handled correctly, not a gap.
- **MEDIUM — the header measured-layout fallback (icon-only under OS scale) is specified only as an on-device backstop with a "gate the label render until first measure lands" contingency,** but no plan specifies what happens on the very first render before any `onLayout` fires — if the initial render defaults to showing labels and only collapses after layout, a fast device could show one paint frame of labels before collapsing, which is the exact flash Task 2 explicitly warns about but does not mandate a concrete default (e.g., "default to icon-only until measured, then expand if it fits" vs the reverse). This ambiguity is real and could cause the very regression the plan is trying to prevent depending on which default the executor picks.

**Suggestions**
- Make explicit that the safe default before first measurement is icon-only (fail-safe / expand-if-room), not label-then-collapse — this removes the ambiguity that could reintroduce the flash the plan is trying to avoid.

## Plan 05 (ArchivedContactsScreen chrome refactor)

**Strengths**
- Verified against the actual `ArchivedContactsScreen.tsx` read this session: the hand-rolled header (lines 180-196), `confirmPurge` (58-74), `purgeBody` (84-87), and `doPurge` (128-172) all match the plan's line citations closely (small drift: plan cites 58-74/84-87/128-172, actual file has `confirmPurge` at 58-74 ✓, `purgeBody` at 84-87 ✓, `doPurge` at 128-172 ✓ — all accurate).
- The plan's "diff guard" acceptance criterion (verify zero changes inside purge functions via `git diff`) is a genuinely strong, mechanically-checkable safeguard against scope creep into the ADR-018 purge flow.
- Testids listed in the plan (`archived-contacts-screen`, `archived-count`, `archived-empty`, `archived-row-{id}`, `archived-restore-{id}`, `archived-delete-{id}`) all match the real testIDs found in the file (lines 176, 211, 199, 220, 234, 243).

**Concerns**
- **LOW — the plan notes `navigation` may become unused after the Back button is removed**, but `ArchivedContactsScreen`'s function signature destructures `{ navigation }` from `RootStackScreenProps<"Archived">` (line 90) and `navigation.goBack()` is the only use found (line 185) — confirmed this is the sole consumer, so the plan's contingency (remove from destructuring if tsc/biome flags it) is correctly scoped and low-risk.

**Suggestions**
- None — this is the cleanest, most tightly-scoped plan of the seven.

## Plan 06 (UnboundContactsScreen chrome + search)

**Strengths**
- `unbound-list-logic.ts:2-4` confirms `unboundCountLabel(count)` today returns only the total-count string with no `matching` mode — the plan's diagnosis that a naive reuse would produce "N unbound contacts" over a filtered count is verified as a real bug the plan correctly avoids by extending the function signature.
- `listUnbound` (`unbound-read.ts:24-39`) is confirmed to have no search parameter and a fixed `WHERE`/`ORDER BY` — the plan's "add a pure client-side filter, don't touch the read" approach is well-matched to the actual code shape.
- `UnboundContactsScreen.tsx:56-70` confirms the hand-rolled header + `unbound-contacts-back` Pressable the plan targets for removal.

**Concerns**
- **LOW (self-acknowledged in the plan) — client-side filtering over the full unpaginated `listUnbound` result** is a genuine, if currently-harmless, scale ceiling; the plan's own threat model (T-26-17) discloses this rather than hiding it, which is good practice.
- **LOW — the plan's Task 2 action doesn't specify debouncing the search input**, unlike Plan 07's HomeScreen search (which explicitly requires a ~220ms debounce). Since Unbound search runs a synchronous in-memory filter (no SQL, no I/O), a debounce is less critical for correctness, but keystroke-by-keystroke re-filtering on every render could theoretically cause visible jank on a long Unbound list — not called out anywhere in this plan even though Plan 07 treats the analogous case as load-bearing enough to specify precisely.

**Suggestions**
- Consider whether a debounce is needed for the Unbound search given potential list size, even though it's client-side (no read-storm risk, but re-render risk).

## Plan 07 (Search + toggle row, D-12 wiring, legacy retirement)

**Strengths**
- This is the most complex plan and shows the most rigorous cycle-2 fixes: the `countBirthdayPopulation` consumption (Task 2) and the debounced-vs-immediate search value distinction (Task 2/3) are both well-reasoned given `dashboard-session-store.ts:21-27`'s confirmed ephemeral, non-debounced `searchText` field.
- `SegmentedControl.tsx:22-26,75-83` confirms `SegmentedControlOption` today truly is `{label, value}` with only a `<Text>` render — the plan's diagnosis that icon support requires an extension is accurate, and the plan's backward-compatibility requirement (Orrery's label-only usage must keep compiling) is testable via `tsc --noEmit` as claimed.
- The Task 3 test-deletion plan is unusually careful — it explicitly names each `describe` block to delete by name rather than by line range, addressing a real fragility (line-number drift across concurrent edits) that a line-range deletion would risk.

**Concerns**
- **MEDIUM — Task 3's plan to "lift" a new test into the `describe("counts")` block asserting `countNeverContacted`'s `include_unbound_never_contacted` interaction is sound in principle, but the plan never verifies the exact current line numbers or block boundaries of `dashboard-read.test.ts`** (this file was not read this session) — the plan's own text acknowledges this test file wasn't independently re-verified ("read_first" cites specific line ranges like 943-1041, 1019-1041, 1069-1124 that I cannot confirm against the actual file in this review). This is the single largest unverified-but-load-bearing claim across all 7 plans: if those line numbers have drifted from a prior edit, the "surgical deletion by name" approach mitigates the risk somewhat (block names are more stable than line numbers), but the specific claim that lines 1030/1039 sit inside the `listNeverContacted` block and cannot be preserved in place is asserted, not verified, in this review.
- **LOW — the debounce interval (~220ms) is stated as "the legacy interval"** but I could not verify this number against any currently-existing HomeScreen code in this session (the current `HomeScreen.tsx` full content wasn't read) — this is plausible given the plan's specificity but is an unverified historical claim.
- **MEDIUM — Task 1's SegmentedControl extension adds an optional `icon` field to `SegmentedControlOption<V>`,** but the type is generic over `V extends string` with no icon-name type constraint specified in the plan text beyond "a semantic icon name" — if the executor doesn't correctly type this as `IconName` from `icon-registry.ts`, this could silently accept a non-registered string with no `tsc` gate (since `Icon.tsx`'s `IconProps.name: IconName` requires the compile-time check to actually happen at the call site inside `SegmentedControl`, not just at `Icon`'s own definition). The plan's acceptance criteria only checks that the option compiles and Orrery keeps working, not that an invalid icon name would be caught by `tsc`.

**Suggestions**
- Explicitly type the new `SegmentedControlOption.icon` field as `IconName` (imported from `icon-registry.ts`) rather than a bare string, so `tsc --noEmit` genuinely catches an invalid icon reference at the `SegmentedControl` call site, not just inside `Icon.tsx`.
- Given the load-bearing nature of Task 3's test-file surgery on `dashboard-read.test.ts`, and that this file's actual current contents weren't re-verified in this review cycle, recommend the executor re-read the file in full before deleting anything, treating the plan's cited line numbers as approximate guidance rather than ground truth.

## Risk Assessment: **MEDIUM**

The architecture is sound and the cycle-2→cycle-3 revisions correctly resolved the two structural HIGH findings (overlay-host scoping, birthday-count derivation) with real code-grounded fixes, not just prose patches. The residual risk is concentrated in Plan 07's Task 3 (legacy-read retirement via surgical test-block deletion against an unverified-in-this-session test file) and a handful of LOW/MEDIUM specification gaps (header flash-prevention default, SegmentedControl icon typing, category-fetch refresh timing) that are unlikely to cause severe failures but could produce subtle regressions if the executor fills the gaps differently than intended. None of these rise to a HIGH-severity blocker; the plan set is executable as written provided the executor treats Plan 07 Task 3's test-file line citations as approximate and re-verifies against the actual file before deleting.

---

## Verification coverage (Cycle 3)

- **Both lanes ran as independent headless sessions with repo access; neither stubbed.** Codex
  (`gpt-5.6-terra`, reasoning=low) produced 15,868 bytes with 98 `file:line` citations; Claude
  (`sonnet`, reasoning=low, separate `claude -p` session, stdout-captured) produced 18,867 bytes
  with 25 `file:line` citations. `SELF_CLI` forced to `none` (owner-authorized) so the
  `CLAUDE_CODE_ENTRYPOINT` independence-skip did not drop the claude lane.
- **Source-grounding pass (orchestrator).** Read the actual code on disk — not the diff or the
  plan text — for the carried-forward and new findings: `src/db/dashboard-read.ts`
  (`listBirthdayCandidates` :572-580 confirmed NOT bound-only; birthday-id resolution :279-291;
  `filterByGravity` :324-335; A3 branch :396-413; `countNeverContacted` :527-541;
  `readIncludeUnboundNeverContacted` :466-475), `src/stores/dashboard-query-store.ts`
  (:64-92 hydrate + setters — no serialization/generation guard confirmed), and the Plan 01/04/07
  `files_modified` scopes.
- **Shared-table writer sweep (custom-fields / contacts / interactions).** This phase ships **no
  migration** (D-03) and writes no shared domain table: it composes existing reads
  (`listDashboardPopulation`, the new additive `listDashboardSearch`/`countBirthdayPopulation`),
  the query-store persists only Dashboard view prefs to `app_settings`, and the only mutating
  paths touched are the pre-existing Archived purge (Plan 05, protected by a git-diff guard) and
  the `app_settings` Dashboard-pref writes. No dynamic custom-field columns and no pairwise type
  converters are introduced (ADR-001 / migration 006 not implicated). Verified by reading the
  read/DAO files above rather than trusting the graph (which cannot enumerate SQL writers).
- **Cross-artifact fact-drift pass.** No untraceable decision labels (the former "D-14" is
  re-pointed to the real footer dead-end); plan citations match code on disk; the only
  reviewer-side gaps are the Plan 07 test-file line numbers, addressed by the by-block-name
  deletion already in the plan plus the re-read acceptance note recommended above.
- **Local-first invariant.** No finding introduces a network dependency on any read path; all
  proposed fixes are on-device (query-store ordering, in-memory Unbound filter, measured layout).
- **Decision-collision gate.** Ran explicitly (see the Cycle-3 Consensus Summary): no finding
  reverses, weakens, or deletes a D-01..D-12 item, a HANDOFF.md entry, or an ADR — no owner
  escalation required.

═══════════════════════════════════════════════════════════════════════════════
# CYCLE 4 (history — 2026-09-05T08:25:31Z) — 0 HIGH + 4 actionable, all since addressed in commit b5c1ab1
═══════════════════════════════════════════════════════════════════════════════

Both reviewer lanes ran again as independent headless sessions with full repo access and
produced source-grounded reviews (Codex `gpt-5.6-terra` reasoning=low, 14,991 bytes, **72**
`file:line` citations; Claude `sonnet` reasoning=low, 20,429 bytes, 25 `file:line`
citations). Neither stubbed (`ok=true, stubbed=false` on both lane results); neither carried a
`[reviewed-without-repo-access]` or `[reviewed-without-source-citations]` marker. `SELF_CLI`
was forced to `none` for this run per the owner's explicit authorization, overriding the
`CLAUDE_CODE_ENTRYPOINT` independence-skip (which would otherwise skip the claude lane), so
BOTH lanes ran — the claude lane as a separate `claude -p --model sonnet` headless session with
no inherited context, output captured from stdout. The orchestrator then ran a source-grounding
+ cross-artifact fact-drift pass (a dedicated read-only subagent read the actual code on disk —
every writer/reader of the dashboard read path, the query store, the migrations dir, and the
management routes — and independently verified each carried-forward and new finding, plus the
seven project-specific invariants: no migration, D-12 seam, shared-table writers, custom-field
storage, store migration, routes, theme/animation) before recording it.

## Cycle-3 resolution (verified against the revised plans + code)

**Cycle 3 had 0 HIGH + 10 actionable. Eight of the ten are FULLY RESOLVED in commit `a73f5aa`;
two are PARTIALLY RESOLVED** (the plan absorbed part of the concern but a sharper residual
remains — carried forward below). Each plan carries a `review_feedback_incorporated` section
mapping the cycle-3 finding to a specific must_have / task / acceptance edit; the orchestrator
cross-checked each against code:

- **[RESOLVED] Plan 01 hydration-race guard.** Plan 01 now adds a `generation` counter + a
  `hydrated` flag to `dashboard-query-store.ts`: `hydrate()` captures the generation before its
  await and applies the parsed snapshot only if unchanged; every setter bumps it. A stale-hydrate
  test case is added. Verified the race was real (`dashboard-query-store.ts:64` applied
  unconditionally after the await).
- **[RESOLVED] Plan 02 listCategories refetch trigger.** The category fetch now lives in
  `DashboardControlRow` inside a `useFocusEffect` (cancelled-flag guarded) — refetch-on-focus,
  not mount-only.
- **[RESOLVED] Plan 07 capture `now` once per reload.** `reload()` computes a single
  `const now = localDateTime()` and threads it to `listDashboardPopulation`/`listDashboardSearch`
  AND `countBirthdayPopulation`, so the birthday list and its empty-state count cannot straddle
  local midnight.
- **[RESOLVED] Plan 07 type the SegmentedControl icon as `IconName`.** The field is now
  `icon?: IconName` (imported from `icon-registry.ts`), so `tsc` catches an unregistered icon at
  the call site, not only inside `Icon.tsx`.
- **[RESOLVED] Plan 01 clampAnchorPosition idempotency type-validity.** Redefined as a fixed
  point over the horizontal `left` axis (an anchorRect whose `x` already equals a returned `left`
  yields the same `left`) + a constrained-width assertion, not a type-invalid re-feed.
- **[RESOLVED] Plan 06 render search before the empty/non-empty branch.** Branch order is now
  `rows.length===0` (true-empty) → `filtered.length===0` (no-match) → filtered list; a no-match is
  never conflated with true-empty.
- **[RESOLVED] Plan 05 fixed-chrome structure explicit.** Root `View` → `ShellAppBar` → scroll
  content stated explicitly, with a git-diff guard on the ADR-018 purge functions.
- **[RESOLVED] Plan 07 Task 3 mandate a full re-read of `dashboard-read.test.ts` before deleting.**
  A mandatory full-re-read directive now opens Task 3, treating every cited line number as
  approximate and block NAMES as authoritative, with an acceptance note recording the drift-tolerant
  approach.
- **[PARTIALLY RESOLVED] Plans 01/02 async setter serialization.** The plans now specify "derive
  each mutation's `next` from `useDashboardQueryStore.getState()` at press time + disable presses
  while a write is in flight," composing with Plan 01's generation guard. **Residual (Codex,
  carried):** this serialization is *incompatible with the stated layer-2 component contract* —
  `PopulationPanelContent`/`FilterPanelContent`/`SortPanelContent` take `{state, onChange}` and
  compute a COMPLETE next object from the `state` render snapshot, so `DashboardControlRow` cannot
  re-derive from `getState()`. See Cycle-4 actionable #1.
- **[PARTIALLY RESOLVED] Plan 04 measured header fallback.** Plan 04 added `ShellAppBar.tsx` to
  `files_modified` (fit decision now owned at the app-bar level) and mandated icon-only-until-measured
  as the fail-safe default (flash eliminated) — both cycle-3 halves resolved. **Residual (Codex,
  carried):** with icon-only as the mandated pre-measurement default, the expanded labels are never
  rendered, so the "measure-and-compare" approach the plan lists as discretion has nothing to compare
  against; the plan does not mandate an intrinsic-width method (hidden probe / reserved budget). See
  Cycle-4 actionable #2.

Neither lane, nor the orchestrator's source-grounding subagent, found any decision reversal, ADR
conflict, [REJECTED]-item resurfacing, new migration, network-read path, custom-field storage
change, or theme-token violation in the revised plans.

## Consensus Summary (Cycle 4)

**Cycle 4 surfaces NO HIGH.** Codex records "No HIGH findings" explicitly; Claude raises no new
HIGH (its risk ratings are MEDIUM, driven by disclosed-and-mitigated Plan 07 test-file surgery).
Both lanes + the source-grounding subagent independently confirm **zero decision reversals**. The
residual set is four MEDIUM/LOW implementation-contract gaps, concentrated in the async
query-mutation path (Plans 01/02), the header fit-measurement method (Plan 04), and the List/Card
toggle write path (Plan 07). **None require a decision reversal, migration, network access, or
scope expansion — every proposed fix upholds the recorded decisions (D-03 no-migration, D-04
locked icon-only fallback, D-11 in-tree non-Modal panel / no layer-1 fork, D-12 additive bound-only
read).**

### Agreed Strengths (2+ lanes / orchestrator-verified)
- All eight fully-resolved cycle-3 items are fixed in code terms, not reworded — the generation
  guard, the single-`now` reload, the `IconName` typing, and the by-block-name deletion are the
  correct corrections and are grounded in real source (both lanes + subagent).
- Plan 03 remains the strongest-verified plan: A3 relaxation copied verbatim from the real legacy
  branch (`dashboard-read.ts:396-413`), all three post-processing paths (birthday-id resolution,
  soonest-birthday sort, `filterByGravity`) correctly identified and ported, bound-only scope
  preserved, and `countBirthdayPopulation` correctly diagnosed as necessary because
  `listBirthdayCandidates` (`:572`) is not bound-only (both lanes + subagent).
- Chrome-only refactors (Plans 05/06) are narrowly scoped, grep-verified against real testIDs and
  functions, protect the ADR-018 purge flow via a git-diff guard, and preserve ADR-062/D-08
  Unbound retrieval via the own-route search (both lanes + subagent).
- No decision reversal / ADR conflict / [REJECTED] resurfacing / migration / network path /
  custom-field change anywhere in the seven plans (both lanes + subagent).

### Agreed Concerns (actionable, UNRESOLVED in the current plans)

- **[MEDIUM] Plans 01 + 02 — the layer-2 `onChange(completeObject)` contract contradicts the
  plans' own "derive next from `getState()` at press time" serialization must_have.** Codex (both
  plans); orchestrator verified against the plan text. The panels take `{state, onChange}` and the
  action text has each option "toggle that value … and call `onChange` with the next
  DashboardFilters/populations" — i.e. the layer-2 component computes the complete `next` from its
  `state` render snapshot. `DashboardControlRow` then only *receives* that object; it cannot
  re-derive from `useDashboardQueryStore.getState()`, so two fast presses computed from the same
  stale snapshot still race (the exact defect the must_have claims to fix). The store setters
  genuinely do not serialize (`dashboard-query-store.ts:81-92`). **Fix (decision-safe): make the
  layer-2 callbacks intent-based (`onTogglePopulation(key)` / `onToggleFilter(family,value)` /
  `onClearFilters` / `onSelectSort(mode)`) and compute `next` from `getState()` in the serialized
  owner, OR move the axis state up so the panel emits the intent, not the resolved object.** No
  decision collision — this is an implementation-contract reconciliation.
- **[MEDIUM] Plan 04 — the expanded-label header fit-measurement METHOD is still underspecified.**
  Codex; orchestrator verified against Plan 04 line 137. The plan correctly moved ownership to
  `ShellAppBar` (measures root width via `onLayout` + rendered title width via `onTextLayout`) and
  mandated icon-only as the pre-measurement default — but *with icon-only as the default the two
  destination labels are never in the tree to measure*, so the "measure-and-compare vs
  reserve-a-budget (Claude's discretion)" wording leaves a viable-looking path (measure-and-compare)
  that cannot work: there is no rendered expanded width to compare against the available space. An
  executor picking it would build a header that never expands (stuck compact) or reflows. **Fix:
  mandate an intrinsic-width method — a hidden/invisible off-screen label probe measured once, or a
  reserved trailing budget — rather than leaving "measure-and-compare" as an option; state that the
  fit test compares available space against a MEASURED-INTRINSIC (not currently-rendered) label
  width.** Upholds D-04 (locked icon-only fallback).
- **[MEDIUM] Plan 07 — the "already-active view is a no-op" must_have is not enforced by the
  proposed write path.** Codex; orchestrator verified. The must_have edge-probe row states
  "Toggling to the already-active view / setting viewMode to its current value is a no-op that does
  not thrash the read (idempotency)," but the action only says `onChange` calls
  `setViewMode(getExecutor(), mode)`, and `setViewMode` (`dashboard-query-store.ts:65`) always
  writes SQLite and calls `set(...)` even for the current value — so re-selecting the active segment
  triggers a persist + a reload, violating the must_have. **Fix: add an equality guard before
  persistence — `if (mode === useDashboardQueryStore.getState().viewMode) return;` at the call site
  (and preferably harden the store setter to no-op on an unchanged value).**
- **[LOW] Plan 04 — the Reset persistence-failure path is unhandled.** Codex; orchestrator
  verified. `OverflowAction.onPress` returns `void` (`OverflowMenu.tsx:28`) and the plan's `onReset`
  `await`s `resetDashboardView(getExecutor())` then `clearSession()` with no rejection handling —
  yet `resetDashboardView`/the store setters can reject before state changes
  (`dashboard-query-store.ts:93`), leaving an unhandled promise rejection and no user feedback, unlike
  the themed-error-on-rejection path Plans 01/02 adopted for the population/filter/sort writes.
  **Fix: wrap `onReset` in a handled async function that surfaces a themed non-blocking error on
  rejection (mirror the Plan 01/02 persistence-failure pattern).**

### Divergent Views (resolved by orchestrator verification)
- **HIGH count.** Codex: "No HIGH findings." Claude: no new HIGH (risk ratings MEDIUM, driven by
  disclosed-and-mitigated Plan 07 test-file surgery, not a new blocker). Orchestrator + subagent
  concur: **0 unresolved HIGH this cycle.**
- **Serialization finding.** Codex raises the onChange-contract contradiction (Plans 01/02) as its
  lead MEDIUM; Claude does not surface it this pass (it read the setters as async-rejectable but did
  not connect the layer-2 API to the getState() requirement). Orchestrator verified Codex's reading
  against the plan text — the contradiction is real and actionable; recorded as Cycle-4 #1.
- **Plan 03 shared-helper drift (Claude MEDIUM).** Claude flags that the "duplicate if a shared
  helper is impractical" escape hatch could let the two reads diverge organically after ship.
  Orchestrator: this is already mitigated in-plan by the mandatory parity tests (Task 2) and the
  plan's stated *preference* for the shared helper — it is represented in PLAN content, so it is NOT
  counted as a new actionable (it is an accepted, test-guarded design tradeoff).

### Cross-artifact fact-drift (orchestrator pass, Cycle 4)
- No untraceable decision labels; 26-CONTEXT.md defines D-01..D-12 and every plan citation resolves
  within that set (the former "D-13"/"D-14" mis-citations were already re-pointed in prior cycles and
  remain correct).
- All spot-checked citations hold on disk. Minor non-load-bearing drift found by the subagent: Plan
  03 cites `buildPopulationWhere` birthdays→`"0"` at `dashboard-query-logic.ts:194`; on disk it is
  `:196`. `buildFilterWhere` "no gravity SQL" cited `:113` (approximate). These are guidance-level and
  the plans already mandate re-locating blocks by name and treating line numbers as approximate — no
  functional drift between plan text and code.
- **Dead file (cleanup nit, not counted):** `src/stores/dashboard-prefs-store.ts` becomes orphaned
  after Plan 01 migrates its sole consumer (`HomeScreen.tsx`); no plan deletes it. Cleanup nit, not a
  correctness gap — the executor may sweep it or a later cleanup pass can.

### Decision-collision check (escalation gate)
**No finding collides with a recorded decision.** Every proposed Cycle-4 fix is an implementation
detail or an enforcement of an existing decision: the serialization fix (Plans 01/02) is an internal
component-API reconciliation; the header fit-measurement fix (Plan 04) UPHOLDS D-04's locked
icon-only rule; the viewMode no-op guard (Plan 07) and the Reset error path (Plan 04) are robustness
additions. Nothing deletes, weakens, or inverts a D-01..D-12 item, a HANDOFF.md entry, or an ADR.
The source-grounding subagent independently confirmed no migration (TARGET_VERSION=19 / head 019),
no shared-domain-table writer beyond the existing `app_settings` DAO, no custom-field storage change
(ADR-001 / migration 006 not implicated; `sortExpr()` untouched, no dynamic columns, no pairwise
converters), and no network dependency on any read path (local-first intact). **No owner escalation
is required for this cycle.**

---

## Codex Review (Cycle 4)

# Cycle 4 Plan Review — Phase 26

Overall: the plans are substantially stronger after prior cycles. I found no decision reversal, migration, network-read path, or theme-token violation. The remaining issues are chiefly implementation-contract gaps around async query mutations and header measurement.

## Plan 01 — Population tracer

Summary: Good architectural tracer: it migrates the Dashboard away from the legacy AsyncStorage state/read and validates the hardest overlay/a11y seam first.

Strengths:

- Correctly targets the real migration seam: `HomeScreen` still uses `useDashboardPrefs` and legacy `listDashboard` at [HomeScreen.tsx:101](/home/bwales/projects/orbit-app/src/screens/HomeScreen.tsx:101) and [HomeScreen.tsx:193](/home/bwales/projects/orbit-app/src/screens/HomeScreen.tsx:193), while the Phase-25 store is presently unconsumed.
- The root-level overlay correction is necessary: `ShellAppBar` and `FlatList` are siblings in the current composition, so a header-mounted scrim could not cover the app bar.
- The hydration-race concern is real: `hydrate()` currently applies after its await unconditionally at [dashboard-query-store.ts:64](/home/bwales/projects/orbit-app/src/stores/dashboard-query-store.ts:64), whereas setters persist and set later at [dashboard-query-store.ts:73](/home/bwales/projects/orbit-app/src/stores/dashboard-query-store.ts:73).
- The selected population order explicitly avoids the query constant’s different order ([dashboard-query-logic.ts:5](/home/bwales/projects/orbit-app/src/logic/dashboard-query-logic.ts:5)).

Concerns:

- **MEDIUM — Population mutation serialization remains underspecified.** `PopulationPanelContent` is planned with `{ state, onChange(next) }`, meaning it computes `next` from a render snapshot. Two fast presses can produce competing full-array writes. The current store likewise has no serializer; each mutation awaits before updating Zustand ([dashboard-query-store.ts:73](/home/bwales/projects/orbit-app/src/stores/dashboard-query-store.ts:73)). “Guard rapid presses” needs a concrete pending lock plus a fresh-state operation contract, not just an error handler.
- **LOW — The overlay channel has no settled file/API.** The plan permits either lifted state or a new store, but neither a panel-store artifact nor a required `DashboardControlRow` callback contract is specified. This makes the Plan-02 “no HomeScreen changes” promise fragile.

Suggestions:

- Define a single mutation API such as `onTogglePopulation(key)`; derive the array in `DashboardControlRow` from `useDashboardQueryStore.getState()` under an axis-level pending lock.
- Settle the overlay channel as either an explicit `dashboard-panel-store.ts` artifact or required callback props.

Risk: **MEDIUM.** The source migration and overlay behavior are high-impact, but the plan’s tests/UAT backstops are otherwise strong.

Prior-cycle status: root-host scope, a11y full-surface scope, animation pause, label centralization, and hydration-race coverage are addressed. Population concurrent-write handling remains only partially resolved.

## Plan 02 — Filters and Sort

Summary: Well-scoped expansion of the tracer, with correct gravity sourcing and category-refresh ownership, but its stated fresh-state serialization is incompatible with its proposed component contracts.

Strengths:

- Correctly uses `GRAVITY_TIERS`; filter SQL intentionally does not implement Gravity ([dashboard-query-logic.ts:113](/home/bwales/projects/orbit-app/src/logic/dashboard-query-logic.ts:113)), so the service tiers at [impact.ts:63](/home/bwales/projects/orbit-app/src/services/impact.ts:63) are the right source.
- Category refresh on focus is sensible because the current HomeScreen only fetches categories as part of reload ([HomeScreen.tsx:191](/home/bwales/projects/orbit-app/src/screens/HomeScreen.tsx:191)).
- A pure filter-summary helper is an appropriate node-testable seam.
- Explicit Default sort aligns with the actual sort union ([dashboard-query-logic.ts:118](/home/bwales/projects/orbit-app/src/logic/dashboard-query-logic.ts:118)).

Concerns:

- **MEDIUM — “Derive next from getState at press time” cannot be achieved with the prescribed `onChange(nextFilters)` contract.** `FilterPanelContent` computes and emits an already-complete filter object from its passed `state`; the parent cannot reconstruct which toggle occurred. The same contradiction exists for the population tracer. This needs operation callbacks (`toggleFilter(family, value)`, `clearFilters`, `selectSort`) or state ownership moved upward.
- **LOW — Category names can still be stale while the Dashboard remains focused.** `useFocusEffect` refreshes on regaining focus, not after an in-place category mutation that returns without focus loss. This is probably acceptable for this phase, but should be stated as the chosen freshness boundary.

Suggestions:

- Replace full-state layer-2 callbacks with typed intent callbacks and calculate next state in the serialized owner.
- Disable the whole relevant panel axis while persisting, including Clear.

Risk: **MEDIUM.**

Prior-cycle status: gravity values, summary labels, persistence-failure path, and focus refresh are addressed. Concurrent setter handling is not yet mechanically coherent.

## Plan 03 — Population-aware search read

Summary: This is the strongest plan. It appropriately treats search as an additive read and preserves the population read’s birthday/gravity/sort behavior.

Strengths:

- Correctly recognizes that Birthday needs resolved IDs: `buildPopulationWhere()` deliberately returns `0` without birthday IDs ([dashboard-query-logic.ts:194](/home/bwales/projects/orbit-app/src/logic/dashboard-query-logic.ts:194)).
- Correctly ports the required post-query Gravity pass; it is not SQL-expressible by design ([dashboard-query-logic.ts:113](/home/bwales/projects/orbit-app/src/logic/dashboard-query-logic.ts:113), [dashboard-read.ts:324](/home/bwales/projects/orbit-app/src/db/dashboard-read.ts:324)).
- Correctly requires the birthday sort parity; the population read currently does it after SQL ([dashboard-read.ts:315](/home/bwales/projects/orbit-app/src/db/dashboard-read.ts:315)).
- Bound-only search is consistent with the existing A3 branch, which explicitly retains `c.tracking_enabled = 1` ([dashboard-read.ts:396](/home/bwales/projects/orbit-app/src/db/dashboard-read.ts:396)).
- `countBirthdayPopulation` is the right correction for the empty-state count: `listBirthdayCandidates()` is non-archived but not bound-only ([dashboard-read.ts:572](/home/bwales/projects/orbit-app/src/db/dashboard-read.ts:572)).

Concerns:

- **LOW — Error text for `localMidnightFromReadNow()` is population-read-specific.** The shared validator currently throws `"listDashboardPopulation: now must start with YYYY-MM-DD"` ([dashboard-read.ts:256](/home/bwales/projects/orbit-app/src/db/dashboard-read.ts:256)). Reusing it for search/count is safe but misleading in diagnostics.

Suggestions:

- Rename the error to a neutral dashboard-read message while preserving validation behavior.

Risk: **LOW.**

Prior-cycle status: birthday IDs, gravity, soonest-birthday ordering, injection binding, and bound-only birthday counting are all directly addressed.

## Plan 04 — Header and overflow

Summary: The overflow plan is solid. The measured header-fit design is directionally right but still lacks enough mechanical detail to prove it can distinguish “labels fit” from “labels do not fit.”

Strengths:

- The five-row overflow matches the phase decision and removes obsolete tab destinations.
- Disabled Select Contacts addresses a real flaw in current `OverflowMenu`: every row currently calls `close()` then `action.onPress()` ([OverflowMenu.tsx:96](/home/bwales/projects/orbit-app/src/components/OverflowMenu.tsx:96)).
- Reset correctly composes durable query reset with session reset; the query reset preserves `viewMode` ([dashboard-query-logic.ts:215](/home/bwales/projects/orbit-app/src/logic/dashboard-query-logic.ts:215)).
- The need to modify `ShellAppBar` is legitimate: it owns the title/trailing/overflow layout ([ShellAppBar.tsx:42](/home/bwales/projects/orbit-app/src/components/ShellAppBar.tsx:42)).

Concerns:

- **MEDIUM — The header fit measurement is not fully implementable as specified.** Measuring only bar width and the currently rendered title does not reveal the natural width of both destination labels plus icons and overflow. Since icon-only is the initial state, those labels are not even rendered to measure. `ShellAppBar` needs a defined measurement method: hidden/invisible intrinsic label probes, or an explicit measured trailing-content callback reporting both compact and expanded widths.
- **LOW — Reset persistence failure is unhandled.** `OverflowAction.onPress` returns void ([OverflowMenu.tsx:28](/home/bwales/projects/orbit-app/src/components/OverflowMenu.tsx:28)); an async reset supplied through it can reject without user feedback. Existing store mutations can reject before state changes ([dashboard-query-store.ts:93](/home/bwales/projects/orbit-app/src/stores/dashboard-query-store.ts:93)).

Suggestions:

- Specify the expanded-width measurement contract before implementation.
- Wrap `onReset` in a handled async function and show a non-blocking failure message if persistence fails.

Risk: **MEDIUM.**

Prior-cycle status: true disabled no-op behavior, pure builder signature, header ownership, and icon-only-first behavior are addressed. The actual expanded-label measurement remains open.

## Plan 05 — Archived child route

Summary: Safe chrome-only refactor with unusually good protection against accidental destructive-flow changes.

Strengths:

- The fixed-chrome correction is appropriate: the current `ScrollView` is the root ([ArchivedContactsScreen.tsx:175](/home/bwales/projects/orbit-app/src/screens/ArchivedContactsScreen.tsx:175)); moving `ShellAppBar` outside prevents it scrolling away.
- Both stack registrations already point to the same component ([DashboardStack.tsx:62](/home/bwales/projects/orbit-app/src/navigation/tabs/DashboardStack.tsx:62), [SettingsStack.tsx:32](/home/bwales/projects/orbit-app/src/navigation/tabs/SettingsStack.tsx:32)).
- The no-touch purge diff guard is well warranted: confirmation and post-commit cleanup live at [ArchivedContactsScreen.tsx:128](/home/bwales/projects/orbit-app/src/screens/ArchivedContactsScreen.tsx:128).

Concerns:

- None material.

Suggestions:

- Keep the root `View`’s `flex: 1` and preserve the former scroll background/content styles exactly, as the plan implies.

Risk: **LOW.**

Prior-cycle status: fixed child chrome, unused navigation cleanup, and purge regression protection are resolved.

## Plan 06 — Unbound route and retrieval search

Summary: Correctly closes the retrieval-path trip-wire without broadening Dashboard search.

Strengths:

- The current dedicated read is correctly neutral and bound to `tracking_enabled = 0` ([unbound-read.ts:23](/home/bwales/projects/orbit-app/src/db/unbound-read.ts:23)).
- Rendering search after loading/error but before the empty/no-match branch addresses the current structure, which chooses true empty before any search UI ([UnboundContactsScreen.tsx:72](/home/bwales/projects/orbit-app/src/screens/UnboundContactsScreen.tsx:72)).
- Client-side filtering preserves the DAO’s `name COLLATE NOCASE, id` ordering ([unbound-read.ts:35](/home/bwales/projects/orbit-app/src/db/unbound-read.ts:35)).
- The explicit matching-count extension fixes the current helper’s total-only semantics ([unbound-list-logic.ts:2](/home/bwales/projects/orbit-app/src/screens/unbound-list-logic.ts:2)).

Concerns:

- **LOW — The search local state survives Profile-back because the route remains mounted, but it resets if navigation reconstructs the route.** That is fine because no persistence requirement is stated; note it explicitly to avoid accidental future interpretation as a Dashboard-session contract.

Suggestions:

- Add one test that a whitespace-only term uses total-count wording, not matching wording.

Risk: **LOW.**

Prior-cycle status: true-empty/no-match ordering and filtered-count wording are resolved.

## Plan 07 — Search/toggle completion and retirement

Summary: Thorough retirement plan, but the view-toggle no-op requirement is not actually enforced by the proposed write path.

Strengths:

- Correctly uses a single `now` through the reload; the population read resolves birthdays from supplied `now` ([dashboard-read.ts:274](/home/bwales/projects/orbit-app/src/db/dashboard-read.ts:274)), so this prevents midnight disagreement with the birthday count.
- Correctly restores the required debounce rather than relying on the cancelled flag; current HomeScreen demonstrates the intended 220ms mechanism ([HomeScreen.tsx:168](/home/bwales/projects/orbit-app/src/screens/HomeScreen.tsx:168)).
- The delete-by-describe-name requirement is prudent because the legacy and must-keep test blocks are interleaved.
- Preserving `countNeverContacted` is necessary: it still reads the deferred `include_unbound_never_contacted` setting ([dashboard-read.ts:527](/home/bwales/projects/orbit-app/src/db/dashboard-read.ts:527)).
- `IconName` is the correct type for the SegmentedControl extension; current options have no icon field ([SegmentedControl.tsx:23](/home/bwales/projects/orbit-app/src/components/SegmentedControl.tsx:23)).

Concerns:

- **MEDIUM — The “already-active view is a no-op” must-have is not satisfied by “onChange calls setViewMode.”** The existing setter always writes SQLite and sets state, even for the current value ([dashboard-query-store.ts:65](/home/bwales/projects/orbit-app/src/stores/dashboard-query-store.ts:65)). The plan needs an equality guard either in `SegmentedControl`’s caller or in `setViewMode`.
- **LOW — SegmentedControl’s active icon color needs an explicit contrast check.** Existing active labels use `colors.background` ([SegmentedControl.tsx:75](/home/bwales/projects/orbit-app/src/components/SegmentedControl.tsx:75)); the new icon path should use the same semantic color and be covered by the existing contrast gate.

Suggestions:

- Add `if (mode === useDashboardQueryStore.getState().viewMode) return;` before persistence, preferably also harden the store setter.
- Add an icon-active/inactive visual token test or verify it through the existing contrast tooling.

Risk: **MEDIUM.**

Prior-cycle status: debounce, one-now-per-reload, `IconName`, birthday counting, and safe by-name test deletion are resolved. Toggle idempotency remains unaddressed.

## Final assessment

No **HIGH** findings. The plan set is ready to execute after tightening three MEDIUM items:

1. Make population/filter/sort mutations intent-based and serialized from fresh store state.
2. Specify a real intrinsic-width measurement contract for the header’s expand-if-room labels.
3. Make List/Card writes idempotent before calling `setViewMode`.


---

## Claude Review (Cycle 4)

# Cross-AI Plan Review — Phase 26: Dashboard Control Surface (Cycle 4)

## Cross-Cutting Assessment

This is a mature convergence cycle (4th pass); the plans show real engineering rigor and have already absorbed substantial prior feedback. Verified against source: `dashboard-query-store.ts`, `dashboard-query-logic.ts`, `dashboard-read.ts`, `shell-transient-store.ts`, `overlay-base.tsx`, `GlassSurface.tsx`, `SegmentedControl.tsx`, `ShellAppBar.tsx`, `OverflowMenu.tsx`, `icon-registry.ts`, `unbound-list-logic.ts`, `unbound-read.ts`, `ArchivedContactsScreen.tsx`, `UnboundContactsScreen.tsx`, `dashboard-empty-logic.ts`, `motion.ts`, `use-reduced-motion.ts`. No dossier/ADR files were opened this pass (not in context), so D-01..D-12 compliance is checked against `26-CONTEXT.md`'s own text, not the underlying dossier — flagged as a limitation below.

---

## Plan 01 (Population tracer + AnchoredPanel + DashboardOverlayHost)

**Summary:** The riskiest architectural bet in the phase — resolving the tracer to a root-level overlay host rather than an in-header one is correct and well-justified by `ShellAppBar.tsx:43` (title/trailing/overflow all siblings in one flex row) and `HomeScreen.tsx` composition. The plan's account of `AnchoredPanel`'s relationship to `overlay-base.tsx` is accurate.

**Strengths:**
- `shellTransientStore` reuse for Back/dismiss is exactly the right mechanism — verified `dismissTop()` semantics at `shell-transient-store.ts:46-54` (removes first, then invokes `dismiss`), which composes correctly with a panel's `onDismiss`.
- The a11y-focus-on-open pattern lifted from `overlay-base.tsx:76-84` is a legitimate, verified reuse target.
- The store hydration-race guard (generation counter) is a real, previously-absent gap: `dashboard-query-store.ts:64` (`hydrate: async (exec) => set(parseStoredState(...))`) indeed has no guard against a stale resolve clobbering a newer `set()` from a setter — the described race is real and the fix (generation captured before await, compare after) is the standard fix.

**Concerns:**
- **[MEDIUM] `SegmentedControlOption.icon` typing claim is not yet true anywhere referenced.** Plan 01 doesn't touch `SegmentedControl.tsx` (that's Plan 07's job), but Task 1's icon-registry additions are consumed nowhere in Plan 01 itself except via `DashboardControlRow`'s Population trigger, which per the plan's own action description doesn't render list/grid icons (only Plan 07 does). This is fine as sequencing, but the plan's "Artifacts index" implies these are Plan-01-owned deliverables when some (list/grid on SegmentedControl) are actually inert until Plan 07. Low material risk, just a documentation-precision nit.
- **[LOW] `GlassSurface` corner/opacity claims.** The plan cites `RADII.lg` and asks for scrim opacity "lower than 0.85" — verified `GlassSurface.tsx:114` already hardcodes `borderRadius: RADII.lg`, so this is consistent, not a new invention. Fine.
- **[LOW, evidence-limited] D-11/D-12 compliance can't be independently verified** since the dossier text itself wasn't opened this session — only `26-CONTEXT.md`'s summary of D-11/D-12 was available. The plan's claims about D-11 ("no layer-1 fork") are consistent with what `dashboard-query-logic.ts` shows (no `term` param anywhere in `buildPopulationWhere`), so this checks out empirically even without the dossier.

**Prior-cycle concern resolution:** The cycle-2 HIGH (in-header overlay can't scrim the app bar) is now resolved via the root-level `DashboardOverlayHost` — verified this is architecturally sound given `ShellAppBar` and `FlatList` are declared as siblings. The cycle-3 MEDIUM (hydration race) is resolved with a concrete, correct mechanism (generation counter). Both hold up.

**Risk:** MEDIUM — the single largest, least-tested-in-review surface (in-tree a11y-hide of a non-Modal overlay) remains fundamentally an on-device UAT bet, which the plan appropriately flags as FA-DASHC-05 rather than hiding it.

---

## Plan 02 (Filters + Sort panels)

**Summary:** Solid horizontal extension of Plan 01's pattern. The Gravity-tier sourcing fix (from `GRAVITY_TIERS` rather than a hand-list or `DASHBOARD_FILTER_FAMILIES`) is verified correct: `dashboard-query-logic.ts:14-20` confirms `DASHBOARD_FILTER_FAMILIES` carries only family names (`"gravity"`), never tier values — so a plan that had derived tier options from that constant would have been broken. Good catch, correctly fixed.

**Strengths:**
- `buildFilterWhere`'s deliberate gravity omission is correctly identified: `dashboard-query-logic.ts:113-115` — "gravity family is intentionally recognized but handled after the SQL candidate read." The plan's insistence that Filters panel gravity options be pulled from `GRAVITY_TIERS` (not from SQL-facing constants) is the right fix for a real bug class.
- Setter serialization design (derive `next` from `getState()` at press time + disable while in-flight) is a reasonable, minimal fix for the identified race in `dashboard-query-store.ts:81-92` (no serialization exists there today — confirmed, the setters are independent async functions with no queue/lock).

**Concerns:**
- **[LOW] `listCategories` fetch — `useFocusEffect` refetch cost not bounded.** The plan mandates the category fetch live inside `DashboardControlRow` on every Dashboard focus. This is reasonable given the review history, but there's no debounce/memoization guard against a focus event firing on every panel-close in rapid succession (e.g., closing the Population panel returns focus to Dashboard, which itself doesn't refocus the screen — but Profile→Back does). Minor perf nit, not correctness.
- **[LOW] `selectedFilterLabels` category-id resolution** depends on `categories` being passed in synchronously-fresh at summary-render time; if the `useFocusEffect` fetch is still in flight when a stale filter selection references a category id not yet in `categories`, the "unknown/missing category id" fallback (called out in must_haves) needs to degrade gracefully — the plan does specify this test case, which is good, but only as a "skip or fallback" without pinning the exact behavior. Minor spec looseness, unlikely to cause a real defect given the explicit test requirement.

**Risk:** LOW-MEDIUM. Mechanically sound; the main residual risk is on-device UI polish (summary correctness with rapid toggling), not architecture.

---

## Plan 03 (listDashboardSearch + countBirthdayPopulation)

**Summary:** This is the most SQL-rigor-heavy plan and holds up well against `dashboard-read.ts`. The birthday-id / gravity / soonest-birthday replication requirement is the single most important correctness fix in the whole cycle, and it's now correctly specified.

**Strengths:**
- Verified `dashboard-read.ts:274-336` (`listDashboardPopulation`) does three things a naive `listDashboardSearch` clone could easily omit: (1) resolves `birthdayIds`/`birthdayDays` from `listBirthdayCandidates` + `daysUntilBirthday` and threads them into `buildPopulationWhere`/`populationMatchColumns`; (2) applies a JS post-sort for `soonest-birthday`; (3) applies `filterByGravity` as a post-query pass since `buildFilterWhere` deliberately emits no gravity SQL (`dashboard-query-logic.ts:113`). The plan's must_haves correctly enumerate all three and forbid a "simplify birthdays+term to status sort" shortcut — this is the correct level of rigor given the real risk of silent omission.
- `countBirthdayPopulation`'s bound-only design is correctly justified: `listBirthdayCandidates` (`dashboard-read.ts:572-580`) scans `archived_at IS NULL AND birthday IS NOT NULL` with **no** `tracking_enabled` filter — so a raw count would indeed include Unbound contacts and over-count relative to the Birthdays *population* (which is bound-only via `DASHBOARD_POPULATION_SCOPE_WHERE`, `dashboard-query-logic.ts:151-152`). This over-count risk is real and the fix (bound-only intersection) is correct.
- A3 semantics preservation is well-grounded: verified `dashboard-read.ts:396-413` is exactly the branch the plan instructs to copy verbatim, and the header comment at `dashboard-read.ts:38-41` documents the semantics the plan must preserve.

**Concerns:**
- **[MEDIUM] The "shared private helper" contract is Claude's-discretion-with-a-fallback, not enforced by an automated gate beyond the parity test.** The plan permits full duplication as an acceptable fallback if a clean shared helper "is impractical" — reasonable pragmatism, but it means the review can't verify (from the plan text alone) that a future maintenance edit to `listDashboardPopulation`'s birthday/gravity logic won't silently diverge from `listDashboardSearch`'s copy, if the executor chooses the duplication path. The parity tests mitigate this at test-time but not for organic drift after this phase ships. Acceptable given the constraints, but worth flagging.
- **[LOW] `snippet` bind ordering note is correctly carried forward** (`dashboard-read.ts:404-405` comment: "SELECT clause — appears first") — verified accurate.

**Risk:** LOW. This plan is data-layer-only, fully unit-testable, and the must_haves are unusually precise about the exact failure mode being guarded against (over-counting, missing post-processing). This is the strongest plan of the seven from a correctness-rigor standpoint.

---

## Plan 04 (Header destinations + overflow)

**Summary:** Reasonable UI refit; the "icon-only is the mandated pre-measurement default" fix directly addresses a real first-paint flash risk, and moving the fit decision into `ShellAppBar` is architecturally correct given `ShellAppBar.tsx:42-66`'s actual flex layout (title `flex:1`, trailing, overflow all in one row — confirmed by reading the file).

**Strengths:**
- The `OverflowMenu` disabled-row fix is precise and necessary: verified `OverflowMenu.tsx:102-105` (`onPress={() => { close(); action.onPress(); }}`) unconditionally calls `close()` today — a naive `disabled` prop addition without also guarding the row's own `onPress` handler would still dismiss the whole sheet on a disabled tap. The plan correctly identifies and fixes this exact line.
- `buildDashboardOverflowActions({ navigation, onReset })` object-param signature is a sensible, testable design; the current `HomeScreen.tsx:107-150` overflowActions array (not shown here but referenced accurately per RESEARCH/PATTERNS) is being replaced with a pure function — good testability improvement.

**Concerns:**
- **[LOW] ShellAppBar `compact` trailing-fit signal is a nontrivial widening of a shared, heavily-reused component** (`ShellAppBar` is used by every screen in the app per the "Modified files" pattern map). The plan asserts backward compatibility is "proven by tsc" for the ReactNode-only consumers, which is true for typing but not for runtime behavior — a bug in the new `compact` measurement logic (e.g., an infinite re-measure loop, or a measurement that never resolves and defaults to compact forever) could regress `ArchivedContactsScreen`/`UnboundContactsScreen`'s trailing content if those pass a function-form `trailing` in the future, though today they don't (Plan 05/06 don't add trailing content to those screens per their tasks). Contained risk, correctly scoped by test coverage requirements (tsc + on-device).

**Risk:** LOW-MEDIUM, mostly concentrated in the on-device text-scaling backstop, which is correctly flagged as such rather than claimed as unit-tested.

---

## Plan 05 (ArchivedContactsScreen chrome refactor)

**Summary:** Narrow, well-scoped, and the ADR-018 purge-flow preservation requirement is taken seriously with an explicit diff-guard acceptance criterion.

**Strengths:**
- Verified against `ArchivedContactsScreen.tsx` in full: the purge flow (`confirmPurge` 58-74, `purgeBody` 84-87, `doPurge` 128-172 with its POST-COMMIT photo/notification cleanup fan-out) is exactly as described, and the plan's instruction to leave it byte-unchanged while only restructuring chrome (root View → ShellAppBar → ScrollView, moving `testID="archived-contacts-screen"` off the ScrollView onto the new root View) is precise and matches the actual current structure (`ScrollView` is root at line 175 today, confirmed).
- The cycle-3 fix (explicit fixed-chrome structure, not swap-header-inside-ScrollView) is a real, previously-missed distinction — a header rendered inside the ScrollView would scroll away, which is not what "first-class child-route chrome" should mean. Good catch.

**Concerns:**
- **[LOW] No new concerns beyond what's already flagged in-plan.** This is the lowest-risk plan of the seven — small diff surface, single file, strong preservation guardrails (git-diff-based acceptance check on the purge functions is a good mechanical enforcement, better than "don't touch it" prose alone).

**Risk:** LOW.

---

## Plan 06 (UnboundContactsScreen chrome + own-route search)

**Summary:** Correctly treats the ADR-062 retrieval-path requirement as load-bearing (STOP-AND-ASK trip-wire framing, not "nice to have"), and the no-match vs true-empty state disambiguation fix (branch order: `rows.length===0` before `filtered.length===0`) is a legitimate UX bug the plan catches before it ships.

**Strengths:**
- Verified `UnboundContactsScreen.tsx:72-94` today does branch as `rows===null` (loading) → `rows.length===0` (true empty) → else FlatList; adding a client-side filter without reordering these branches would indeed have made a filtered-to-zero list render as "No unbound contacts" (the true-empty copy), which is misleading. The plan's explicit branch-order requirement is correct and necessary.
- `unboundCountLabel`'s extension (`{ matching?: boolean }`) rather than reusing the existing total-only helper for a filtered count is correctly identified as necessary — verified `unbound-list-logic.ts:2-4` today only produces "N unbound contact(s)," which has no way to express "N matching."
- `filterUnboundByName` as a pure, node-testable helper mirrors the existing file's idiom (`unbound-list-logic.ts` is already RN-free) — good consistency.

**Concerns:**
- **[LOW] Scale ceiling on the client-side filter is honestly disclosed** (`filterUnboundByName` runs over the full unpaginated `listUnbound` result) but not actually mitigated — acceptable given personal-scale usage per PROJECT.md's "owner is user #1" framing, and the plan explicitly notes this as a pre-existing condition it doesn't worsen.

**Risk:** LOW.

---

## Plan 07 (Search + toggle row, D-12 read wiring, legacy retirement)

**Summary:** The most operationally hazardous plan — it retires `listDashboard`/`listNeverContacted` from a file (`dashboard-read.ts`) that Plans 01-06 don't touch but that has a large, interconnected test file. The plan's response to this (mandatory full re-read of the test file before deletion, block-name-not-line-range deletion) is the correct mitigation for a real risk class.

**Strengths:**
- Verified `dashboard-read.ts:274-336` (`listDashboardPopulation`) validates `now` via `localMidnightFromReadNow` (`dashboard-read.ts:256-272`), which throws unless `now` starts `YYYY-MM-DD` — the plan's insistence on `localDateTime()` never `toISOString()` is correctly grounded and enforceable via the stated grep gate.
- The "capture ONE `now` per reload" fix is a genuinely subtle correctness issue: if `reload()` called `localDateTime()` independently for the list read and for `countBirthdayPopulation`, a call straddling local midnight could make the Birthdays empty-state count disagree with the actual rendered list. This is a real, non-obvious race the plan correctly identifies and fixes with a single-capture pattern.
- `countNeverContacted`/`readIncludeUnboundNeverContacted` preservation is correctly cross-checked against `dashboard-read.ts:466-541` — these functions do exist as described and are legitimately D-03-protected (the `include_unbound_never_contacted` app_settings column is read there, and PROJECT.md's migration-forward-only constraint plus D-03's "coordinate with Phase 36" instruction make ad-hoc removal correctly forbidden).
- The D-03 coverage "lift" (moving the Unbound×countNeverContacted test assertion into the surviving `counts` block before deleting `listNeverContacted`'s test block) is a thoughtful, concrete fix for what would otherwise be a silent coverage loss — verified the two settings interact exactly as described at `dashboard-read.ts:466-475` (`readIncludeUnboundNeverContacted`) and `:527-541` (`countNeverContacted`).

**Concerns:**
- **[MEDIUM] The plan's test-file line-number citations (943-1041, etc.) are self-admittedly unverifiable this session** — `dashboard-read.test.ts` was not opened in this review pass. The plan's own mitigation (treat block names as authoritative, re-read in full before deleting) is the correct engineering response to this uncertainty, but it means this review cannot independently confirm the block-boundary claims are accurate; that verification is deferred to the executor, as the plan itself acknowledges. This is a legitimate, disclosed limitation, not a plan defect — but it is the single highest blast-radius step in the whole phase (deleting exported functions + their tests in a heavily-shared file) and deserves an explicit post-execution `npm test` gate, which the plan does include.
- **[LOW] `SegmentedControlOption.icon?: IconName` typing requirement is correctly specified** — verified `icon-registry.ts:69` exports `IconName` as `keyof typeof ICON_REGISTRY`, confirming the type exists and is importable RN-free (the registry module has no `react-native` import, confirmed). The plan's insistence on this exact type (not `string`) to get a compile-time gate at the SegmentedControl call site is correct and matches the actual type surface available.
- **[LOW] Debounce vs. cancelled-flag distinction is correctly reasoned** — a debounce is necessary to collapse a keystroke burst to one query; a cancelled-flag alone only discards stale *results*, not stale *requests*. This is accurate.

**Risk:** MEDIUM-HIGH — not because the design is wrong, but because this plan performs the highest-blast-radius mechanical operation in the phase (deleting shipped, tested, exported functions from a file with a large existing test suite) under genuine "block names, not verified line numbers" uncertainty. The mitigations (full re-read mandate, `npm test` gate, D-03 coverage lift) are appropriate and about as strong as achievable without this review having opened the target test file directly.

---

## Dependency Ordering / Wave Structure

Waves are internally consistent: Wave 1 (Plan 01) is a true single-point dependency for Waves 2 (Plans 02-06, correctly `depends_on: ["26-01"]`) and Wave 3 (Plan 07, correctly depends on 01/02/03/04). One nit: Plan 07's `depends_on` omits `26-05`/`26-06` even though it doesn't touch those files, which is fine — but it also doesn't explicitly depend on `26-02` in a prior cycle finding that was already addressed (confirmed `depends_on: ["26-01", "26-02", "26-03", "26-04"]` is present in Plan 07's frontmatter — correct, this was fixed).

## Decision-Reversal Check

No plan deletes, weakens, or inverts a D-01..D-12 decision as stated in `26-CONTEXT.md`. Specifically checked: Manage Favourites stays removed (D-06, Plan 04 confirms no reintroduction and greps for absence); no permanent birthday banner is added (D-07, Plan 07's empty-state design keeps Birthdays as population-only); Select Contacts stays disabled (D-09, Plan 04); no migration is introduced (D-03, confirmed no plan touches `src/db/migrations/`); Unbound retrieval is replaced, not dropped (D-08, Plan 06). No escalation-worthy reversal found.

## Overall Risk Assessment

**MEDIUM**, driven almost entirely by Plan 07's legacy-read-retirement mechanics (real but disclosed-and-mitigated risk) and the phase-wide dependency on the in-tree, non-Modal a11y-hide mechanism from Plan 01 (an architecturally sound design that is nonetheless is fundamentally an on-device-only verification, appropriately flagged as such rather than falsely claimed as unit-tested). All seven plans show evidence of genuine engineering correction across the review cycles — the Gravity-tier sourcing fix, the birthday/gravity post-processing replication requirement, the hydration-race guard, and the D-03 coverage lift are all real bugs the plans now correctly avoid, not cosmetic churn.

---

## Verification coverage (Cycle 4)

- **Both lanes ran as independent headless sessions with repo access; neither stubbed.** Codex
  (`gpt-5.6-terra`, reasoning=low, source=banner) produced 14,991 bytes with 72 `file:line`
  citations; Claude (`sonnet`, reasoning=low, source=pinned, separate `claude -p` session,
  stdout-captured) produced 20,429 bytes with 25 `file:line` citations. Both lane results carry
  `ok=true, stubbed=false`. `SELF_CLI` forced to `none` (owner-authorized) so the
  `CLAUDE_CODE_ENTRYPOINT` independence-skip did not drop the claude lane.
- **Source-grounding pass (orchestrator + dedicated read-only subagent).** Read the actual code on
  disk — not the diff or the plan text — and verified seven project-specific invariants plus the
  carried/new findings: (1) no migration — `database.ts:54` `TARGET_VERSION=19`, migrations head
  `019-dashboard-prefs.ts`, no plan touches `src/db/migrations/`; (2) D-12 seam — A3 anchor real at
  `dashboard-read.ts:38`, legacy mechanics at `:396-413`, `listDashboardPopulation(exec,query,now)`
  has no `term` param (`:274`), Plan 07 retires `listDashboard`/`listNeverContacted` with no
  dual-read; (3) shared-table writers — `dashboard-read.ts` has zero writers, the only Phase-26
  write path is `app_settings` via `app-settings-dao.updateAppSettings` (?-bound), no
  `INSERT INTO interactions` / bulk archive (D-09 held, Select Contacts ships DISABLED); (4) custom
  fields — no plan touches `custom_field`/`sortExpr`/dynamic columns (ADR-001 / migration 006 not
  implicated); (5) store migration — `HomeScreen.tsx` old-store usage at `:63/:101-104/:193`
  matches Plan 01, `useDashboardPrefs` has no other consumer (no stranded consumer); (6) routes —
  ADR-080 four-tab shell real (`RootNavigator.tsx:176-200`), both Archived registrations exist
  (`DashboardStack.tsx:62`, `SettingsStack.tsx:32`), `ShellAppBar variant='child'` + resolveBackIntent
  present; (7) theme/animation — every plan mandates `useTheme().colors.*` + `check:colors` and
  forbids setState-per-frame/Skia, pausing animation on `useIsFocused===false`/AppState background.
- **Shared-table writer sweep (custom-fields / contacts / interactions).** Verified by reading the
  read/DAO files directly rather than trusting the graph (which cannot enumerate SQL writers): this
  phase ships no migration (D-03) and writes no shared domain table; it composes existing reads plus
  the new additive `listDashboardSearch`/`countBirthdayPopulation`; the query-store persists only
  Dashboard view prefs to `app_settings`; the only mutating path touched is the pre-existing Archived
  purge (Plan 05, git-diff-guarded).
- **Cross-artifact fact-drift pass.** No untraceable decision labels; plan citations match code on
  disk except minor non-load-bearing line drift (`dashboard-query-logic.ts:194`→`:196`), already
  mitigated by the plans' by-name / approximate-line-number discipline.
- **Local-first invariant.** No finding introduces a network dependency on any read path; all
  proposed fixes are on-device (component-API reconciliation, intrinsic-width measurement, an
  equality guard, a themed error path).
- **Decision-collision gate.** Ran explicitly (see the Cycle-4 Consensus Summary): no finding
  reverses, weakens, or deletes a D-01..D-12 item, a HANDOFF.md entry, or an ADR — no owner
  escalation required.

## CYCLE_SUMMARY (Cycle 4 — unresolved in the current plans, commit a73f5aa)

CYCLE_SUMMARY: current_high=0 current_actionable=4

- **current_high = 0.** No unresolved HIGH. Both lanes + the source-grounding subagent agree; the
  two Cycle-2 structural HIGHs remain fully resolved and no new HIGH was raised.
- **current_actionable = 4** (all MEDIUM/LOW, none colliding with a recorded decision):
  1. [MEDIUM] Plans 01+02 — layer-2 `onChange(completeObject)` contract contradicts the plans' own
     "derive `next` from `getState()` at press time" serialization must_have; needs intent-based
     callbacks (or axis state moved up).
  2. [MEDIUM] Plan 04 — expanded-label header fit-measurement METHOD underspecified: with icon-only
     as the mandated default the labels are never rendered, so "measure-and-compare" cannot work;
     mandate an intrinsic-width probe / reserved budget.
  3. [MEDIUM] Plan 07 — "already-active view is a no-op" must_have not enforced by `setViewMode`
     (which always writes); add an equality guard before persistence.
  4. [LOW] Plan 04 — Reset persistence-failure path unhandled (`onReset` awaits `resetDashboardView`
     with no rejection handling); wrap in a handled async with a themed non-blocking error.

═══════════════════════════════════════════════════════════════════════════════
# CYCLE 5 (CURRENT — 2026-09-05T09:01:42Z) — re-review of the revised plans (commit b5c1ab1)
═══════════════════════════════════════════════════════════════════════════════

Both reviewer lanes ran again as independent headless sessions with full repo access and
produced source-grounded reviews (Codex `gpt-5.6-terra` reasoning=low, 9,725 bytes, **59**
`file:line` citations; Claude `sonnet` reasoning=low, 11,995 bytes, 8 explicit `file:line`
citations plus numerous inline line references, tracing each strength to a real mechanism).
Neither stubbed (`ok=true, stubbed=false` on both lane results); neither carried a
`[reviewed-without-repo-access]` or `[reviewed-without-source-citations]` marker. `SELF_CLI`
was forced to `none` for this run per the owner's explicit authorization, overriding the
`CLAUDE_CODE_ENTRYPOINT` independence-skip (which would otherwise skip the claude lane), so
BOTH lanes ran — the claude lane as a separate `claude -p --model sonnet` headless session
with no inherited context, output captured from stdout. The orchestrator then ran a
source-grounding + cross-artifact fact-drift pass (a dedicated read-only subagent read the
actual code on disk and independently verified each new finding against the current plans and
the source they cite) before recording the counts below.

## Cycle-4 resolution (verified against the revised plans + code)

**Cycle 4 had 0 HIGH + 4 actionable. All four are FULLY RESOLVED in commit `b5c1ab1`:**

- **[RESOLVED] Cycle-4 #1 — layer-2 `onChange(completeObject)` vs `getState()` serialization.**
  The panels now emit an *intent* (a toggle key / axis value), and `DashboardControlRow`
  resolves the complete next object via `useDashboardQueryStore.getState()` at press time,
  composing with Plan 01's generation guard. Claude Cycle 5 independently confirms this as
  "a genuine, well-reasoned fix" verifiable against the store (`dashboard-query-store.ts:73-92`
  has no write serialization), so the intent-based contract removes the lost-update race.
- **[RESOLVED] Cycle-4 #2 — Plan 04 header fit-measurement method underspecified.** Plan 04
  now specifies a concrete API (`trailing?: ReactNode | ((opts:{ compact:boolean }) => ReactNode)`,
  `26-04-PLAN.md:138`) and a named measurement contract — the generic bar measures its own root
  width (`onLayout`) + title width (`onTextLayout`) and compares available trailing space against
  a **measured-intrinsic** expanded-trailing width via a hidden off-screen probe OR a reserved
  trailing-width budget (`26-04-PLAN.md:25`, acceptance `:148-149`). The subagent confirmed this
  is the reviewer's own suggested shape — no residual gap.
- **[RESOLVED] Cycle-4 #3 — `setViewMode` "already-active view is a no-op" not enforced.** Plan 07
  now adds an equality guard so a same-value `setViewMode` performs no write and no generation
  bump (`26-07-PLAN.md:59,109,120,131`), node-tested.
- **[RESOLVED] Cycle-4 #4 — Reset persistence-failure path unhandled.** Plan 04's `onReset` now
  wraps `resetDashboardView` with handled rejection + a themed non-blocking error path.

## Consensus Summary (Cycle 5)

The plan set is mature and both lanes rate it MEDIUM overall risk, converging on the same
verdict: the architecture, dependency ordering, D-12 search seam, data-scope protections, and
test/backstop design are sound; the remaining risk is concentrated in **cross-plan contract
completeness**, not product decisions. No new HIGH survives the source-grounding pass.

### Agreed Strengths
- The D-12 search read (Plan 03) correctly preserves the recorded A3 term-relaxation semantics
  verbatim and keeps `listDashboardPopulation`'s no-term contract un-forked (both lanes, verified
  `dashboard-read.ts:274,396-413`).
- `countBirthdayPopulation`'s bound-only design correctly avoids the over-count bug that a raw
  `listBirthdayCandidates` count would cause (both lanes; `listBirthdayCandidates` at
  `dashboard-read.ts:572` is not bound-only).
- Plan 07's retirement precautions (lifting the policy test before deleting `listNeverContacted`;
  preserving the `include_unbound_never_contacted` DAO/backup contract for the Phase-36 bump) are
  correct (codex; `dashboard-read.ts:527`, `app-settings-dao.ts:275`, `backup-schema.ts:153`).
- Plan 06's local pure-name Unbound filter is a bounded, appropriate replacement after Dashboard
  search becomes bound-only (both lanes; `unbound-read.ts:24`).

### Agreed Concerns
- **Plan 02 sources filter option values from constants that are not exported** —
  `SOCIAL_BATTERY_VALUES` / `NEEDS_ATTENTION_VALUE` are module-private
  (`dashboard-query-logic.ts:38-39`) and `dashboard-query-logic.ts` is not in Plan 02's
  `files_modified` (codex; orchestrator-confirmed). **Actionable #1 below.**
- **Plan 07's `populationCounts` record is incomplete** — only 3 of the 5
  `Record<DashboardPopulation, number>` keys are defined; `favourites` is actually consumed by the
  resolver (`dashboard-empty-logic.ts:100-106`) and `all-contacts` is required by the type
  (codex; orchestrator-confirmed, more severe than the reviewer stated). **Actionable #2 below.**

### Divergent Views
- **Claude raised two HIGHs about `HomeScreen.tsx` line-citation drift; the source-grounding pass
  neutralized both.** Claude flagged them explicitly as open questions BECAUSE `HomeScreen.tsx`
  was not in its prompt context. The subagent read the file on disk and confirmed the plans cite
  the CORRECT current lines (`ShellAppBar` sibling of `FlatList` at `HomeScreen.tsx:533/554`,
  header `Pressable` at `537-551`, `ListHeaderComponent` at `571`), and that `26-PATTERNS.md`'s
  drift flag (537-551, not the stale 640-656 `StyleSheet` block) is itself correct and already
  absorbed by the plans. The residual — Plan 01 lacks the explicit "re-read in full / treat line
  numbers as approximate" mandate that Plan 07 Task 3 carries — is a real asymmetry but a
  robustness nit, not a correctness-material gap, because the citations are verified accurate.
  Not counted (see below).

### Decision-collision gate (ran explicitly)
No Cycle-5 finding reverses, weakens, or deletes a D-01..D-12 item, a `HANDOFF.md` entry, or an
ADR. All three actionables are purely additive (export two constants + add the file to scope;
complete the `populationCounts` record; add an empty-list guard + test). No owner escalation is
required. In particular: exporting `SOCIAL_BATTERY_VALUES`/`NEEDS_ATTENTION_VALUE` and adding
`favourites`/`all-contacts` counts do not touch D-06 (binary favourites — the count is membership,
not rank), D-07 (All Contacts is a selectable population — a count aligns with it), D-03 (no
migration — all fixes are TypeScript/SQL-composition only), or the D-12 search seam.

---

## Codex Review (Cycle 5)

## Summary

The plan set is unusually thorough and correctly targets the real migration points: `HomeScreen` still uses the legacy prefs/read path, while the Phase 25 store and population read are presently unwired ([HomeScreen.tsx:63](</home/bwales/projects/orbit-app/src/screens/HomeScreen.tsx:63), [HomeScreen.tsx:193](</home/bwales/projects/orbit-app/src/screens/HomeScreen.tsx:193), [dashboard-query-store.ts:64](</home/bwales/projects/orbit-app/src/stores/dashboard-query-store.ts:64)). The wave ordering is sensible, particularly the tracer before broader control work and the dedicated D-12 search read before final wiring. There are two material plan gaps to correct before execution: Plan 02 references non-exported query constants, and Plan 07 does not define a complete, valid `populationCounts` record.

## Strengths

- **Plan 01 correctly identifies the actual UI composition hazard.** `ShellAppBar` and `FlatList` are siblings, while the existing control UI is inside `ListHeaderComponent` ([HomeScreen.tsx:533](</home/bwales/projects/orbit-app/src/screens/HomeScreen.tsx:533), [HomeScreen.tsx:554](</home/bwales/projects/orbit-app/src/screens/HomeScreen.tsx:554), [HomeScreen.tsx:571](</home/bwales/projects/orbit-app/src/screens/HomeScreen.tsx:571)). A root-level in-tree overlay host is the right architecture for a scrim that must cover the app bar as well as list content.

- **The plan correctly avoids `Modal` for anchored controls.** The existing `OverflowMenu` demonstrates that this project’s modal implementation is a separate modal layer ([OverflowMenu.tsx:66](</home/bwales/projects/orbit-app/src/components/OverflowMenu.tsx:66)). That would indeed prevent one-tap control switching from a Dashboard control row underneath it.

- **The proposed hydration-race guard is justified.** The current `hydrate` directly applies an async settings snapshot ([dashboard-query-store.ts:64](</home/bwales/projects/orbit-app/src/stores/dashboard-query-store.ts:64)), while setters persist and only then update Zustand state ([dashboard-query-store.ts:65](</home/bwales/projects/orbit-app/src/stores/dashboard-query-store.ts:65)). A late hydrate can overwrite a just-written UI choice. Plan 01’s generation guard plus a slow-hydrate test directly addresses that mechanism.

- **Plans 03 and 07 preserve the intended separation between no-term and search reads.** `listDashboardPopulation` has no term argument ([dashboard-read.ts:274](</home/bwales/projects/orbit-app/src/db/dashboard-read.ts:274)); legacy `listDashboard` contains the recorded A3 branch that widens term searches while retaining the bound predicate ([dashboard-read.ts:365](</home/bwales/projects/orbit-app/src/db/dashboard-read.ts:365), [dashboard-read.ts:398](</home/bwales/projects/orbit-app/src/db/dashboard-read.ts:398)). The additive `listDashboardSearch` design is appropriate.

- **Plan 03 explicitly accounts for the non-SQL parts of the population read.** This is essential because birthdays require ID resolution before `buildPopulationWhere` ([dashboard-read.ts:279](</home/bwales/projects/orbit-app/src/db/dashboard-read.ts:279)), default birthday sort is post-query ([dashboard-read.ts:315](</home/bwales/projects/orbit-app/src/db/dashboard-read.ts:315)), and Gravity is a post-query filter ([dashboard-read.ts:324](</home/bwales/projects/orbit-app/src/db/dashboard-read.ts:324)). The planned parity tests are well chosen.

- **Plan 06 closes a real retrieval gap.** `listUnbound` is intentionally a fixed, alphabetical SQL query with no term support ([unbound-read.ts:24](</home/bwales/projects/orbit-app/src/db/unbound-read.ts:24)). Adding a local, pure name filter is a bounded and appropriate replacement after Dashboard search becomes bound-only.

- **Plan 07’s retirement precautions are good.** `countNeverContacted` still depends on `include_unbound_never_contacted` ([dashboard-read.ts:527](</home/bwales/projects/orbit-app/src/db/dashboard-read.ts:527)), and that setting remains part of the DAO/backup contracts ([app-settings-dao.ts:275](</home/bwales/projects/orbit-app/src/db/app-settings-dao.ts:275), [backup-schema.ts:153](</home/bwales/projects/orbit-app/src/backup/backup-schema.ts:153)). Lifting the policy test before deleting `listNeverContacted` is the correct approach.

## Concerns

- **MEDIUM — Plan 02 cannot source all declared filter values from the stated authoritative constants without modifying another file.** `SOCIAL_BATTERY_VALUES` and `NEEDS_ATTENTION_VALUE` are module-private constants in `dashboard-query-logic.ts` ([dashboard-query-logic.ts:32](</home/bwales/projects/orbit-app/src/logic/dashboard-query-logic.ts:32), [dashboard-query-logic.ts:33](</home/bwales/projects/orbit-app/src/logic/dashboard-query-logic.ts:33)). Yet Plan 02 requires FilterPanelContent to source its option values from them, while its `files_modified` excludes that module. The executor must either export these constants and add `dashboard-query-logic.ts` to the plan scope, or establish an exported closed-options API. Duplicating literals in the component would weaken the anti-drift goal.

- **MEDIUM — Plan 07 does not specify a complete `DashboardPopulationCounts` construction.** The type is `Record<DashboardPopulation, number>` ([dashboard-empty-logic.ts:47](</home/bwales/projects/orbit-app/src/logic/dashboard-empty-logic.ts:47)), covering `favourites`, `birthdays`, `not-contacted`, `snoozed`, and `all-contacts`. Plan 07 only defines count sources for birthdays, not-contacted, and snoozed. The empty-state logic iterates selected populations including `favourites` ([dashboard-empty-logic.ts:98](</home/bwales/projects/orbit-app/src/logic/dashboard-empty-logic.ts:98)); an omitted favourite count either fails typechecking or causes an incorrect fallback. Define cheap counts for Favorites and All Contacts, or deliberately narrow/refactor the empty-state input contract with tests.

- **MEDIUM — Plan 04’s generic ShellAppBar fit mechanism needs a concrete API contract.** `ShellAppBar` currently accepts only `trailing?: ReactNode` and has no layout measurement interface ([ShellAppBar.tsx:9](</home/bwales/projects/orbit-app/src/components/ShellAppBar.tsx:9), [ShellAppBar.tsx:63](</home/bwales/projects/orbit-app/src/components/ShellAppBar.tsx:63)). The plan rightly says the generic bar must own fit, but does not state how it receives the intrinsic expanded width of Dashboard-specific trailing labels. Add a defined prop such as `trailing?: ReactNode | (({ compact }) => ReactNode)` plus `expandedTrailingMinWidth`, or a named measurement contract. Otherwise the generic bar cannot safely create or measure a probe for labels it does not own.

- **LOW — Plan 01’s dashboard-panel channel is an untracked artifact.** The plan allows either lifted state or a “tiny dashboard-panel store,” but neither is named in `files_modified`. Since `DashboardControlRow` must publish content to a root sibling host without reintroducing HomeScreen coupling, the channel’s interface and file ownership should be explicit. This prevents an executor from improvising a global store with unclear cleanup semantics.

- **LOW — Plan 07’s stated file scope conflicts with its stale-comment sweep.** Task 3 requires edits in `src/services/widget/widget-data.ts`, `src/db/fuel-read.ts`, and `HomeScreen.tsx`, but lists only `dashboard-read.ts` and its test under `files_modified`. The stale references are real ([widget-data.ts:18](</home/bwales/projects/orbit-app/src/services/widget/widget-data.ts:18), [fuel-read.ts:12](</home/bwales/projects/orbit-app/src/db/fuel-read.ts:12), [HomeScreen.tsx:3](</home/bwales/projects/orbit-app/src/screens/HomeScreen.tsx:3)). Add them to the formal scope or make that sweep a separate cleanup plan.

- **LOW — `countBirthdayPopulation` needs an explicit empty-candidate SQL path.** `buildPopulationWhere` deliberately returns `0` when no birthday IDs exist ([dashboard-query-logic.ts:194](</home/bwales/projects/orbit-app/src/logic/dashboard-query-logic.ts:194)). Plan 03 should state that the count helper returns `0` before constructing an `IN (...)` clause, avoiding invalid empty-list SQL.

## Suggestions

- Amend Plan 02 to export `SOCIAL_BATTERY_VALUES` and `NEEDS_ATTENTION_VALUE` from [dashboard-query-logic.ts](</home/bwales/projects/orbit-app/src/logic/dashboard-query-logic.ts:32), add that file to scope, and test that panel option values equal the exported sets.

- Amend Plan 07 with a full `DashboardPopulationCounts` table. At minimum define:
  - `favourites`: bound, non-archived favorite membership count.
  - `all-contacts`: bound Active ∪ Not Contacted count, matching `buildPopulationWhere`.
  - Existing birthdays/not-contacted/snoozed sources as planned.

- Make the Plan 04 ShellAppBar interface explicit before execution, including how an intrinsic expanded trailing width is supplied/measured and when `compact` becomes stable.

- Name and test the panel channel as a first-class artifact, including cleanup on Dashboard unmount and replacement behavior when opening another control.

- Add an explicit `birthdayIds.length === 0 → 0` branch to Plan 03’s count helper and test it.

## Risk Assessment

**Overall: MEDIUM.** The plans have strong source grounding, dependency ordering, data-scope protections, and unusually good test/backstop design. The remaining risk is concentrated in cross-plan contracts rather than product decisions: Plan 02 has an immediate non-exported-constant implementation gap, and Plan 07’s incomplete population-count model can either block typechecking or produce incorrect empty states. Addressing those before execution should reduce the phase to manageable UI-integration risk.

---

## Claude Review (Cycle 5)

# Cross-AI Plan Review: Phase 26 Dashboard Control Surface

## Summary

This is an unusually mature set of plans — four review cycles deep with real, traceable fixes (root-level overlay host, intent-based layer-2 callbacks, hydration generation guard, measured header fit). Verifying against the actual source confirms most cited mechanisms exist as described (`shell-transient-store.ts`, `dashboard-query-store.ts`, `dashboard-query-logic.ts`, `dashboard-read.ts`, `SegmentedControl.tsx`, `OverflowMenu.tsx` all match the plans' characterizations). The plans correctly identify that `HomeScreen.tsx` was never actually read in this session (it's referenced extensively but not in the provided context), which is the single largest residual risk — several must_haves (exact line numbers, existing structure like `ShellAppBar` sibling-vs-header placement) are asserted against a file none of the reviewers in this chain could have re-verified this session. The plans are strong on architecture but leave a few concrete gaps: `Sheet.tsx` was never read despite being cited in RESEARCH as a design-system component, `unbound-read.ts`'s `countUnbound` is oddly unused in the new `countBirthdayPopulation` design pattern discussion, and Task-level dependencies between Plan 04 (ShellAppBar changes) and Plan 05/06 (which also touch `ShellAppBar`-consuming screens) aren't cross-checked for merge conflicts within Wave 2.

## Strengths

- **AnchoredPanel architecture is correctly justified against real code.** `overlay-base.tsx:35,57,95` confirms `SCRIM_OPACITY = 0.85` and `justify: center|flex-end` only — the plan's rejection of `BaseOverlay` reuse for a top-anchored, lighter-scrim panel is accurate, not hand-waved.
- **shell-transient-store integration is real and correctly wired.** `shell-transient-store.ts:46-54`'s `dismissTop()` pop-then-callback order and `ShellAppBar.tsx:29-40`'s `resolveBackIntent` call are exactly as described; registering the panel via `openTransient`/`closeTransient` genuinely gets Back-dismissal for free.
- **The D-12 search read plan (26-03) correctly identifies the A3 semantics to preserve.** `dashboard-read.ts:396-413`'s term-relaxation branch is real and the plan's instruction to copy it "verbatim" rather than re-derive is the right call — this is exactly the kind of subtle owner-decision logic that's easy to accidentally narrow.
- **The intent-based (not `onChange(completeObject)`) layer-2 contract is a genuine, well-reasoned fix.** Given `dashboard-query-store.ts:73-92` has no write serialization, a panel emitting a toggle key (not a resolved array) that the owner (`DashboardControlRow`) resolves via `getState()` at press time is a correct pattern to avoid lost-update races — this is verifiable against the actual store code, which indeed has no debounce/mutex.
- **`SegmentedControl.tsx` extension is scoped correctly.** The file at `:22-26` really is `{label, value}`-only with a bare `<Text>` render at `:75-83`, so the plan's mandate to add an optional `icon?: IconName` (typed, not stringly) is both necessary and minimal — it won't break the Orrery consumer since no `icon` prop is passed there.
- **`countBirthdayPopulation`'s bound-only design correctly avoids the over-count bug.** `listBirthdayCandidates` (`dashboard-read.ts:572-580`) indeed has no `tracking_enabled` filter, so a naive reuse would over-count by including Unbound — Plan 03's fix is real and necessary, not overcautious.
- **ArchivedContactsScreen preservation constraints are concrete and testable.** The plan's git-diff guard against touching `confirmPurge`/`purgeBody`/`doPurge` is a good mechanical check given the file (`ArchivedContactsScreen.tsx`) genuinely holds the ADR-018 gate.

## Concerns

**HIGH**
- **`HomeScreen.tsx` itself was never read in this review or, apparently, freshly by RESEARCH/PATTERNS this cycle.** Every plan cites exact line numbers into it (`:63`, `:107-150`, `:224-266`, `:537-551`, `:640-656`) but PATTERNS.md explicitly flags drift ("the HomeScreen header Pressable is at 537-551, not 640-656"). Given four review cycles of citation-based must_haves against this file, and no fresh read available to this reviewer either, there's real risk that further drift exists beyond what's already been caught — Plan 01's Task 2 acceptance criteria hinge on precise structural facts (ShellAppBar/FlatList siblinghood, `ListHeaderComponent` boundaries) that cannot be verified here. **This is a real open question, not a confirmed defect** — recommend the executor re-read the file fully immediately before Task 2, as Plan 01 half-heartedly does for `dashboard-read.test.ts` in Plan 07 Task 3 but not consistently elsewhere.
- **Plan 07 Task 3's line-citation risk is explicitly self-flagged but the same risk exists uncaught in Plan 01/02/04's `HomeScreen.tsx` citations.** Plan 07 Task 3 has an elaborate "MANDATORY re-read before deletion" guard for `dashboard-read.test.ts`, correctly recognizing line-number drift risk. But Plan 01 Task 2 (the tracer, the highest-risk plan in the phase per its own framing) has no equivalent mandate for `HomeScreen.tsx`, despite citing precise structural claims (sibling-vs-header nesting) that if wrong would silently produce the exact HIGH bug Cycle-2 review already found once (overlay inside FlatList header). The fix pattern that worked for Plan 07 wasn't propagated to the plan that needs it most.

**MEDIUM**
- **The `dashboard-query-store.ts` generation-guard (Plan 01) interacts with the newly-added `setViewMode` equality guard (Plan 07) in an unreviewed order.** Plan 01 adds a `generation` counter bumped by every setter including `setViewMode`; Plan 07 then adds an early-return in `setViewMode` for an unchanged value, explicitly placed "above" the generation bump so a no-op skips it too. Reading the actual current `dashboard-query-store.ts` (provided in context), the setter shape is `async (exec, viewMode) => { await updateAppSettings(...); set({viewMode}); }` — inserting an equality check requires reading `get().viewMode` before the `await`, which is fine, but the plan text never states the generation counter itself must not tick on a same-value call in a way that could race with a genuinely concurrent hydrate resolving mid-flight. Low probability of an actual bug, but the plan never node-tests the *interaction* of both guards together (only "setViewMode no-op" and "stale hydrate" separately) — a same-value setViewMode arriving exactly during a stale hydrate window is untested.
- **Plan 04's ShellAppBar `compact` trailing-fit signal changes a shared component consumed elsewhere, but only Plan 04 owns `ShellAppBar.tsx` in `files_modified`.** Plans 05 and 06 both use `ShellAppBar variant="child"` and are Wave 2 (parallel with Plan 04, also Wave 2). If Plan 04's `trailing` prop signature change (`ReactNode | ((opts:{compact}) => ReactNode)`) lands concurrently with Plan 05/06 wiring `ShellAppBar` for Archived/Unbound, there's a possible file-level merge collision or a race where Plan 05/06's PRs are drafted against a stale `ShellAppBar.tsx` signature. The dependency graph declares `depends_on: ["26-01"]` for 04/05/06 but not on each other — since all three are Wave 2, this is presumably intentional (they touch different files: 04→ShellAppBar+HomeScreen, 05→ArchivedContactsScreen, 06→UnboundContactsScreen), so the actual collision risk is low, but it's worth an explicit note that 05/06 must use `ShellAppBar variant="child"` in its OLD (ReactNode-only, ungapped) form since they pass no `trailing` at all — confirmed fine on inspection, just undocumented as deliberately safe.
- **The bound-only `countBirthdayPopulation` parity claim ("equals listDashboardPopulation's row count for populations=['birthdays']") is asserted but the underlying gravity-filter interaction is not addressed.** If a `filters.gravity` selection is simultaneously active, `listDashboardPopulation` post-filters by gravity (dashboard-read.ts:324-335) but `countBirthdayPopulation` (per Plan 03's spec) does NOT apply gravity filtering — it's described as bound-only + 0-30-day window only. This means the parity guarantee "equals listDashboardPopulation... for populations=['birthdays']" implicitly assumes empty filters; Plan 07's empty-state usage passes `query.filters` to the list read but the count derivation for birthdays doesn't take filters into account at all. This could produce an incorrect birthdays-empty-state determination when a gravity filter is also active (count says "3 birthday contacts exist" while the actual filtered+gravity-passed list is empty) — Plan 07 does note "a gravity-filtered zero result is treated as the filter-empty case, not a population-empty" which appears to correctly route around this, but it relies on precedence ordering in `dashboard-empty-logic.ts` being exactly right (checked: `selectDashboardEmptyState`'s step (3) checks `activeFilter !== 'all' || hasActiveDashboardFilters` BEFORE step population-empty, so gravity-filter-active does take the filter-empty branch first — this actually resolves correctly, downgrading this to a documentation gap rather than a functional bug).

**LOW**
- **`OverflowMenu.tsx`'s existing per-row `close()` fires `requestAnimationFrame` refocus onto the trigger** (`OverflowMenu.tsx:42-50`); Plan 04's disabled-row short-circuit correctly skips `close()` for disabled rows, but doesn't address what a11y focus does when a disabled row is "pressed" via TalkBack — the row should probably still receive/retain focus feedback so it doesn't feel silently broken. Not called out as a must_have; likely fine given `accessibilityState.disabled` communicates it, but worth a UAT note.
- **Plan 06's `filterUnboundByName` scale note (T-26-17) is honest about the pre-existing unpaginated-read ceiling but the plan doesn't verify `listUnbound`'s actual row-count ceiling in this codebase** — reasonable to defer, correctly flagged as out of scope.

## Suggestions

- Add an explicit "re-read `HomeScreen.tsx` in full before Task 2" instruction to Plan 01 (mirroring Plan 07 Task 3's mandate), given it's the tracer and the highest-risk file-structure assumptions in the whole phase live there.
- In Plan 03/07, add one line to the `countBirthdayPopulation` must_have clarifying it is filters-naive by design and that the empty-state precedence ordering (filter-empty before population-empty) is what prevents a gravity+birthdays mismatch — this is currently true by construction but undocumented, so a future editor touching `dashboard-empty-logic.ts` precedence could silently reintroduce the bug.
- Consider a node test in Plan 07 that seeds a birthdays population + an active gravity filter with zero gravity-matching birthday rows, asserting the empty state resolves to `filter-empty` (not `birthdays-empty`) — this exercises the precedence interaction the MEDIUM finding above depends on, and currently isn't explicitly tested anywhere in the plan set.

## Risk Assessment

**MEDIUM.** The architecture is sound and heavily cross-verified against real source in this review (store, overlay, icon registry, ShellAppBar, OverflowMenu, dashboard-read.ts, dashboard-query-logic.ts, unbound-read.ts, ArchivedContactsScreen.tsx, UnboundContactsScreen.tsx all check out as described). The residual risk is concentrated entirely in `HomeScreen.tsx`, which no one in this review chain (including me) has read this session, and which is the single most heavily-modified, highest-citation-density file across five of the seven plans. Given the file's own PATTERNS.md entry already documents one line-drift instance, I'd treat any HomeScreen-specific structural must_have (sibling ordering, exact removal targets) as provisional until the executor re-verifies on disk immediately before editing — which the plans already instruct in spirit (D-01/D-02 "read before implementing") but don't always enforce with the same rigor Plan 07 Task 3 uses for its own file.

---

## Verification coverage (Cycle 5)

- **Both lanes ran as independent headless sessions with repo access; neither stubbed.** Codex
  (`gpt-5.6-terra`, reasoning=low, source=banner) produced 9,725 bytes with 59 `file:line`
  citations; Claude (`sonnet`, reasoning=low, source=pinned, separate `claude -p --model sonnet`
  session, stdout-captured) produced 11,995 bytes with 8 explicit `file:line` citations plus
  inline line references. Both lane results carry `ok=true, stubbed=false`. `SELF_CLI` forced to
  `none` (owner-authorized) so the `CLAUDE_CODE_ENTRYPOINT` independence-skip did not drop the
  claude lane.
- **Source-grounding pass (orchestrator + dedicated read-only subagent).** Read the actual code on
  disk — not the diff or plan text — and adjudicated each Cycle-5 finding against the source it
  cites. Confirmed: (1) `SOCIAL_BATTERY_VALUES`/`NEEDS_ATTENTION_VALUE` are module-private
  (`dashboard-query-logic.ts:38-39`, no `export`, contrast the exported `CONTACT_FREQUENCY_BANDS`
  at `:29`), Plan 02 requires sourcing from them (`26-02-PLAN.md:97`) but `dashboard-query-logic.ts`
  is absent from its `files_modified` (`:7-14`) with no export task → **Actionable #1**; (2)
  `DashboardPopulationCounts` is an exact 5-key `Record` (`dashboard-empty-logic.ts:58`), the
  resolver actually indexes `populationCounts['favourites']` (`:100-106`), and Plan 07 defines only
  3 count sources (`26-07-PLAN.md:36,160`) → **Actionable #2**; (3) `countBirthdayPopulation`'s
  suggested `id IN (<candidateIds>)` construction (`26-03-PLAN.md:100`) has no empty-list guard and
  no zero-upcoming-birthday test, while `buildPopulationWhere` itself guards the empty case
  (`dashboard-query-logic.ts:196` `if (birthdayIds.length === 0) return "0"`) → **Actionable #3**.
- **Claude's two HIGHs adjudicated against disk and downgraded.** The subagent confirmed the plans
  cite the CORRECT current `HomeScreen.tsx` lines (`ShellAppBar` sibling of `FlatList` at `:533/554`,
  header `Pressable` at `537-551`, `ListHeaderComponent` at `571`) and that `26-PATTERNS.md`'s drift
  flag is correct and already reflected in Plan 01/04 citations — no stale `640-656` citation
  survives. The drift HIGH is therefore INACCURATE; the "Plan 01 lacks Plan 07's re-read mandate"
  HIGH is a real but non-material asymmetry (citations verified accurate). Neither is a HIGH; neither
  is counted actionable.
- **Shared-table writer sweep (contacts / interactions / custom_field_values / field_history).**
  Verified by reading the read/DAO files directly rather than trusting the graph (which cannot
  enumerate SQL writers): Phase 26 ships no migration (D-03), writes no shared domain table, and
  introduces no dynamic custom-field columns or pairwise type converters (ADR-001 / migration 006
  not implicated). It composes existing reads plus the additive `listDashboardSearch` /
  `countBirthdayPopulation`; the query store persists only Dashboard view prefs to `app_settings`
  (?-bound); the only mutating path touched is the pre-existing Archived purge (Plan 05,
  git-diff-guarded).
- **Local-first invariant.** No finding introduces a network dependency on any read path; all three
  proposed fixes are on-device (export constants, complete a typed count record, add an empty-list
  SQL guard + test).
- **Cross-artifact fact-drift pass.** No untraceable decision labels; plan citations match code on
  disk. The only line drift found is the previously-recorded non-load-bearing
  `dashboard-query-logic.ts:194`→`:196` (buildPopulationWhere birthday guard), already mitigated by
  the plans' by-name / approximate-line discipline.

## CYCLE_SUMMARY (Cycle 5 — unresolved in the current plans, commit b5c1ab1)

CYCLE_SUMMARY: current_high=0 current_actionable=3

- **current_high = 0.** No unresolved HIGH. The two Claude-raised HIGHs were reviewer open
  questions (raised because `HomeScreen.tsx` was outside the prompt context); the source-grounding
  pass read the file on disk and found the plans' citations accurate, downgrading both. No new HIGH
  from codex; the two Cycle-2 structural HIGHs remain fully resolved.
- **current_actionable = 3** (all MEDIUM/LOW, none colliding with a recorded decision):
  1. **[MEDIUM] Plan 02 — filter option values sourced from un-exported, out-of-scope constants.**
     `26-02-PLAN.md:97` requires `FilterPanelContent` option keys to come from `SOCIAL_BATTERY_VALUES`
     / `NEEDS_ATTENTION_VALUE`, but these are module-private (`dashboard-query-logic.ts:38-39`) and
     that file is not in `files_modified` (`:7-14`). PLAN change needed: add a task to `export` both
     constants (or an equivalent exported closed-options API) and add `src/logic/dashboard-query-logic.ts`
     to Plan 02's `files_modified`, plus an assertion that panel option values equal the exported sets.
  2. **[MEDIUM] Plan 07 — incomplete `populationCounts` record.** `DashboardPopulationCounts` is an
     exact 5-key `Record` (`dashboard-empty-logic.ts:58`) and the resolver consumes `favourites`
     (`:100-106`), but Plan 07 defines only `not-contacted` / `snoozed` / `birthdays` count sources
     (`26-07-PLAN.md:36,160`). PLAN change needed: define cheap bound-only counts for `favourites`
     and `all-contacts` (or deliberately narrow/refactor the empty-state input contract with tests) —
     otherwise `tsc` fails on the incomplete Record and a favourites-empty mis-resolves as filter-empty.
  3. **[LOW] Plan 03 — `countBirthdayPopulation` empty-candidate SQL path unguarded + untested.**
     The suggested `SELECT COUNT(*) … id IN (<candidateIds>)` (`26-03-PLAN.md:100`) produces an
     invalid empty `IN ()` when there are zero upcoming birthdays (a common state), and the parity
     test seeds candidates only. PLAN change needed: mandate an explicit `candidateIds.length === 0
     → return 0` branch (mirroring `buildPopulationWhere`'s `:196` guard) and add a zero-upcoming-
     birthday test case.

**Considered but NOT counted actionable (represented in plan content, delegated, or non-material):**
- Claude's "Plan 01 lacks a re-read-before-edit mandate for `HomeScreen.tsx`" (real asymmetry vs
  Plan 07 Task 3, but the cited lines are verified accurate on disk, so it does not materially affect
  correctness — a robustness suggestion only; Plan 01 Task 2 `read_first` already points the executor
  at `HomeScreen.tsx` with the correct lines).
- Codex LOW "dashboard-panel channel not in `files_modified`" — explicitly delegated to Claude's
  discretion (`26-01-PLAN.md:33` "a tiny dashboard-panel store OR lifted HomeScreen state"); a
  discretionary new file omitted from `files_modified` is normal.
- Codex LOW "stale-comment sweep touches `widget-data.ts`/`fuel-read.ts` not in `files_modified`" —
  comment-only cleanup, and the sweep task itself names the files (`26-07-PLAN.md:174-180`), so it is
  represented in plan content and is the kind of cleanup the executor handles correctly anyway.
- Claude MEDIUM "generation-guard × setViewMode interaction not tested together" — the load-bearing
  seam (a no-op `setViewMode` does not bump `generation`, so it cannot clobber an in-flight hydrate)
  IS asserted in Plan 07's test (`26-07-PLAN.md:109`); a combined end-to-end scenario is additional
  coverage, not a correctness gap.
- Claude MEDIUM "`countBirthdayPopulation` gravity parity" and Claude MEDIUM "Plan 04/05/06 Wave-2
  merge collision" — both self-resolved by the reviewer against source (empty-state precedence in
  `dashboard-empty-logic.ts` routes gravity-active to filter-empty first; 05/06 pass no `trailing`
  so the widened signature is backward-compatible).
