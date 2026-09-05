---
phase: 27
reviewers: [codex, claude]
reviewed_at: 2026-09-05T23:57:27Z
cycle: 6
plans_reviewed: [27-01-PLAN.md, 27-02-PLAN.md, 27-03-PLAN.md, 27-04-PLAN.md, 27-05-PLAN.md, 27-06-PLAN.md]
models:
  codex: "gpt-5.6-terra (reasoning=low)"
  claude: "claude-opus-4-8 (in-harness read-only source-grounded lane)"
model_sources:
  codex: "banner"
  claude: "self"
cycle_summary:
  current_high: 0
  current_actionable: 0
---

# Cross-AI Plan Review — Phase 27 (Dashboard List View), Cycle 6 (confirming)

## Consensus Summary

Confirming pass after the owner-authorized final fix (commit 8af7207), which changed
exactly two things: Plan 04's optimistic-favourite SUCCESS path (the cycle-5 HIGH
star-revert) and Plan 01's `isSnoozed` fail-closed guard (the cycle-5 LOW). Both
reviewers independently read the plans against the code on disk and reached the same
verdict: **both fixes are resolved and correctly grounded, no NEW execution-affecting
defect exists, and all six plans are execution-ready.** Trend across the loop:
cycle1 4H/9A → 2H/11A → 0H/9A → 1H/2A → 1H/1A → **cycle6 0H/0A.**

**Plan 04 (cycle-5 HIGH) — RESOLVED.** Verified on disk: `setFavouriteRank`/
`clearFavouriteRank` bump `bumpDataRevisionCore` ONLY (favourites-dao.ts:50/:74), no
`bumpShellRefresh`; HomeScreen's `reload()` fires only from shell-refresh/focus/
foreground/pull (HomeScreen.tsx:341/:346/:359/:375) and NOT on a data-revision bump
(the screen deliberately does not subscribe to that channel, HomeScreen.tsx:340-342 /
DASH-07). So base `rows` (React state, :184; read `favourite_rank !== null` at :688) is
never refreshed by the write, which is exactly why the old "drop overlay so reload truth
shows" rule flipped the star back. The fix patches base via a pure
`applyCommittedMembership(rows, contactId, isFavourite)` and clears the overlay in the
SAME handler continuation (React-18 batched atomic re-render), so
`overlayFor(id) ?? (favourite_rank !== null)` reads committed truth with no reload. The
generation guard is preserved (stale success no-ops) and the cycle-4 React-state overlay
binding is not regressed (ref-only render read still forbidden). Not a decision reversal.

**Plan 01 (cycle-5 LOW) — RESOLVED.** `parseLocalMs` throws on unparseable input
(fuel-age.ts:37-39) and `snooze_until` is unconstrained TEXT; the fix requires
`isSnoozed(snoozeUntil, now)` to guard that throw and return `false` on null or
unparseable input, evaluated against one captured local-calendar `now`, with an
unparseable→false (no-throw) unit test. This matches the SQL predicate
`date(snooze_until) > date('now','localtime')` (dashboard-read.ts:175/:506), where
`date()` on garbage TEXT yields NULL → falsy → not snoozed.

The known false positive (BASE_WHERE "does not exist") did not recur — BASE_WHERE is
present at dashboard-read.ts:172. No decision-reversal escalation.

### Agreed Strengths
- Plan 04 favourite write fires no reload (favourites-dao.ts:50/:74; HomeScreen.tsx:341),
  so patching base `rows` before clearing the overlay in one batched continuation is the
  correct durable fix (both reviewers).
- Plan 01 reuses the shared throwing parser (fuel-age.ts:33) and now catches it, matching
  the SQL snooze predicate's fail-closed behaviour on garbage TEXT (both reviewers).
- Plans 02/03/05/06 anchors re-verified intact: migration head 019 → 020 (database.ts:54);
  `is_current = 1` (current-state-history-read.ts:31); visibility chokepoints
  (memories-read.ts:101, relationships-read.ts:39); corpus `deleted_at`-only + N+1 remedied
  by Plan 06 (knowledge-search-read.ts:99/:124/:281); nav routes + Success haptic
  (DashboardStack.tsx:37, UniversalFab.tsx); relevance-first search order
  (dashboard-search-match.ts:127).

### Agreed Concerns
None. Both lanes returned current_high=0 current_actionable=0.

### Divergent Views
None — the two lanes agree on every plan.

## Codex Review

## Plan 01 — List tracer

Summary: Ready. The fail-closed snooze fix is explicit and testable.

Strengths: SQL uses local-calendar snooze semantics at [dashboard-read.ts](/home/bwales/projects/orbit-app/src/db/dashboard-read.ts:172); the existing shared parser throws on malformed input at [fuel-age.ts](/home/bwales/projects/orbit-app/src/services/fuel-age.ts:33), and the plan now requires `isSnoozed()` to catch that and return `false` at [27-01-PLAN.md](/home/bwales/projects/orbit-app/.planning/phases/27-dashboard-list-view/27-01-PLAN.md:114).

Concerns: None.

Suggestions: None.

Risk: Low.

## Plan 02 — Swipe preference storage

Summary: Ready.

Strengths: Migration head is genuinely 019 and target is 19 at [database.ts](/home/bwales/projects/orbit-app/src/db/database.ts:54), so 020 is correctly next. The derived patch shape makes the planned optional portable key necessary at [app-settings-dao.ts](/home/bwales/projects/orbit-app/src/db/app-settings-dao.ts:218).

Concerns: None.

Suggestions: None.

Risk: Low, aside from the explicitly human-gated forward-only migration.

## Plan 03 — Line-3 primitives

Summary: Ready.

Strengths: Current-state history requires `is_current = 1` at [current-state-history-read.ts](/home/bwales/projects/orbit-app/src/db/current-state-history-read.ts:31). The planned visibility chokepoints correctly reuse registry-aware functions at [memories-read.ts](/home/bwales/projects/orbit-app/src/db/memories-read.ts:101) and [relationships-read.ts](/home/bwales/projects/orbit-app/src/db/relationships-read.ts:39).

Concerns: None.

Suggestions: None.

Risk: Low.

## Plan 04 — Static row content and favourite toggle

Summary: Ready. The cycle-5 success-revert defect is resolved in the plan.

Strengths: Favourite writes only call `bumpDataRevisionCore` at [favourites-dao.ts](/home/bwales/projects/orbit-app/src/db/favourites-dao.ts:50) and [favourites-dao.ts](/home/bwales/projects/orbit-app/src/db/favourites-dao.ts:74), while HomeScreen reloads from shell/focus/foreground/pull paths at [HomeScreen.tsx](/home/bwales/projects/orbit-app/src/screens/HomeScreen.tsx:341). The plan therefore correctly patches base `rows` with `applyCommittedMembership` before clearing the reactive overlay, in the same completion continuation, at [27-04-PLAN.md](/home/bwales/projects/orbit-app/.planning/phases/27-dashboard-list-view/27-04-PLAN.md:166). It also preserves the generation guard and disallows ref-only rendering at [27-04-PLAN.md](/home/bwales/projects/orbit-app/.planning/phases/27-dashboard-list-view/27-04-PLAN.md:165).

Concerns: None.

Suggestions: None.

Risk: Low.

## Plan 05 — Swipe actions

Summary: Ready.

Strengths: The extraction preserves the existing Quick Log success-after-write haptic and refresh behavior at [UniversalFab.tsx](/home/bwales/projects/orbit-app/src/components/UniversalFab.tsx:245). The planned routes match real Dashboard route names, `LogContact` and `Edit`, at [DashboardStack.tsx](/home/bwales/projects/orbit-app/src/navigation/tabs/DashboardStack.tsx:37).

Concerns: None.

Suggestions: None.

Risk: Moderate implementation complexity, adequately covered by the shared-command and device checks.

## Plan 06 — Search and motion

Summary: Ready.

Strengths: The source search engine is relevance-first, with Dashboard order only as a tie-breaker at [dashboard-search-match.ts](/home/bwales/projects/orbit-app/src/logic/dashboard-search-match.ts:127). The plan preserves that order and defines fuel-only append behavior. It correctly remedies current corpus gaps: relationships currently filter only `deleted_at` at [knowledge-search-read.ts](/home/bwales/projects/orbit-app/src/db/knowledge-search-read.ts:99), memories likewise at [knowledge-search-read.ts](/home/bwales/projects/orbit-app/src/db/knowledge-search-read.ts:124), and custom values are currently N+1 at [knowledge-search-read.ts](/home/bwales/projects/orbit-app/src/db/knowledge-search-read.ts:281).

Concerns: None.

Suggestions: None.

Risk: Moderate, but bounded by the specified golden, privacy, ordering, and batch tests.

CYCLE_SUMMARY: current_high=0 current_actionable=0

---

## Claude Review

_Mechanism: the `claude -p` external CLI lane is skipped for independence when the review runs inside Claude Code; per owner approval this lane was performed in-harness as a read-only, source-grounded analysis (files opened on disk, claims verified at file:line)._

## Confirming-pass verdict

Both fixes from the final pass (commit 8af7207) are resolved and correctly grounded in the code on disk. No new execution-affecting defect surfaced. All six plans are execution-ready.

## Plan 04 — favourite SUCCESS star-revert (cycle-5 HIGH) — RESOLVED

Verified against source:
- `setFavouriteRank`/`clearFavouriteRank` call `bumpDataRevisionCore(exec)` ONLY — favourites-dao.ts:50 and :74; a repo-wide grep of the file shows no `bumpShellRefresh` import or call. So a favourite write fires no shell refresh.
- HomeScreen's `reload()` is invoked ONLY from the four freshness paths: `useShellRefresh(reload)` (HomeScreen.tsx:341), `useFocusEffect` (:346), the AppState `active` listener (:359), and pull-to-refresh (:375). The screen deliberately does NOT subscribe to the SQLite/data-revision channel (explicit comment HomeScreen.tsx:340-342, DASH-07). Therefore a data-revision bump does NOT trigger `reload()` — confirming the plan's premise that base `rows` is never refreshed by the write.
- `rows` is React state: `const [rows, setRows] = useState<DashboardRow[]>([])` (HomeScreen.tsx:184), replaced wholesale by `setRows(list)` inside the cancellation-guarded `reload()` (:313). The current base membership read is `isFavourite={item.favourite_rank !== null}` (:688).
- The fix (27-04-PLAN.md:166 action / :115-116 acceptance) patches base `rows` on a LATEST-generation success via a pure `applyCommittedMembership(rows, contactId, isFavourite)` and clears the overlay in the SAME handler continuation, relying on React-18 auto-batching for one atomic re-render — so `overlayFor(id) ?? (favourite_rank !== null)` reads committed truth with NO reload. This is sound: since no reload arrives, the earlier "drop overlay so reload truth shows" rule would have revealed the stale pre-toggle base and flipped the star back; patching base closes that gap.
- Generation guard preserved: only the LATEST success patches; a stale success no-ops (27-04-PLAN.md:113,115). The cycle-4 React-state overlay binding is NOT regressed — the plan still forbids a `useRef`-held overlay read in render and mandates `useSyncExternalStore`/`useState` reactivity (27-04-PLAN.md:78, :112, read_first :103-105). `applyCommittedMembership` uses `favourite_rank` as a null/non-null membership sentinel only (never as order; `listFavourites` remains prohibited), consistent with the DAO's rank write and the `!== null` read at HomeScreen.tsx:688.

Not a decision reversal: patching base state touches no ADR/HANDOFF/D-NN; the star-as-React-state toggle is the correct discrete-state exception, not an animation-from-React-state violation.

## Plan 01 — isSnoozed fail-closed (cycle-5 LOW) — RESOLVED

Verified against source:
- The shared local-ms parser THROWS on unparseable input: `parseLocalMs` at fuel-age.ts:33 does `if (!m) throw new Error(...)` (:37-39). `snooze_until` is unconstrained TEXT, so a garbage value would throw if passed unguarded.
- The SQL parity target `date(c.snooze_until) > date('now','localtime')` is the exact inverse of BASE_WHERE's `... <= ...` clause (dashboard-read.ts:175); the active-snooze count read uses the `>` form at dashboard-read.ts:506. SQLite `date()` on non-date TEXT yields NULL → the comparison is falsy → the row is treated as not-snoozed. Fail-closed (`isSnoozed → false`) therefore matches SQL behaviour on garbage.
- The fix (27-01-PLAN.md:114 behavior / :46 acceptance / :55 action) requires `isSnoozed(snoozeUntil, now)` to return `false` (never throw) on null OR unparseable non-null input by guarding the throwing parser (try/catch or pre-validate), evaluated against one captured `now` on local-calendar semantics, with a unit test asserting unparseable→false and no throw. Correct and complete.

## Plans 02, 03, 05, 06 — no change this cycle, re-verified clean

Spot-checks against source confirm the anchors these plans depend on still hold and the do-not-re-raise items did not recur: migration head 019 / TARGET_VERSION 19 (020 correctly next); current-state `is_current = 1` predicate (current-state-history-read.ts:31); visibility chokepoints (memories-read.ts:101, relationships-read.ts:39); corpus `deleted_at`-only filters + custom-value N+1 that Plan 06 remedies (knowledge-search-read.ts:99/:124/:281); nav routes `LogContact`/`Edit` (DashboardStack.tsx:37) and the Quick Log Success-on-write haptic (UniversalFab.tsx). The known false positive (BASE_WHERE "does not exist") did not recur — BASE_WHERE is present at dashboard-read.ts:172.

## Risk

LOW. The two targeted fixes are the only plan changes this cycle; both are execution-ready and source-grounded. No decision-reversal escalation.

CYCLE_SUMMARY: current_high=0 current_actionable=0
