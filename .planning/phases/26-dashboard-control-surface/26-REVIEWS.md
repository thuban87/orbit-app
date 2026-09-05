---
phase: 26
reviewers: [codex, claude]
reviewed_at: 2026-09-05T06:40:01Z
plans_reviewed: [26-01-PLAN.md, 26-02-PLAN.md, 26-03-PLAN.md, 26-04-PLAN.md, 26-05-PLAN.md, 26-06-PLAN.md, 26-07-PLAN.md]
models:
  codex: "gpt-5.6-terra (reasoning=low)"
  claude: "sonnet (reasoning=low)"
model_sources:
  codex: "banner"
  claude: "pinned"
---

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
