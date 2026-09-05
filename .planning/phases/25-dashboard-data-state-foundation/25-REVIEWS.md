---
phase: 25
cycle: 5
reviewers: [codex, claude]
reviewed_at: 2026-09-05T02:44:32Z
plans_reviewed: [25-01-PLAN.md, 25-02-PLAN.md, 25-03-PLAN.md, 25-04-PLAN.md, 25-05-PLAN.md, 25-06-PLAN.md, 25-07-PLAN.md]
models:
  codex: "gpt-5.6-terra (reasoning=low)"
  claude: "claude read-only subagent"
model_sources:
  codex: "banner"
  claude: "subagent"
---

# Cross-AI Plan Review — Phase 25 (Cycle 5, final convergence)

## Consensus Summary

Both reviewers independently verified the current plan text against the code on disk and agree the **three cycle-4 actionables are RESOLVED**: (1) the cross-plan `now`/wave seam is re-homed with no `depends_on` gap and no compile-order seam; (2) `searchDashboard(candidates, term, orderedEligibleIds)` is realizable, with a tied-relevance test; (3) the categories join is pinned `LEFT JOIN` with an uncategorized-contact (`NULL category_id`) regression test. Migration numbering re-verified on disk (head 018, `TARGET_VERSION = 18` → Plan 01's migration 019 is head+1). D-12/D-13/D-14 are implemented as authorized and were **not** re-escalated by either reviewer. No owner escalation was raised.

Both reviewers **independently found one NEW item at the birthday seam** and it is the sole open concern.

### Agreed Concerns

- **[HIGH — adjudicated] `daysUntilBirthday(stored, now)` passes a `string` to a `Date` parameter (Plan 02, propagates to Plan 03).** Verified on disk: `daysUntilBirthday(stored: string | null, today: Date)` at `src/logic/birthday-logic.ts:165-168` requires a `Date` and reads `.getFullYear()/.getMonth()/.getDate()`. The injected `now` is a **string** (`localDateTime()`; and `computeContactGravity(inputs, now: string)` at `impact.ts:88-90` requires a string, so the single shared `now` cannot also be a `Date`). Plan 02 writes `daysUntilBirthday(stored, now)` verbatim in three places (`25-02-PLAN.md:28,133,142`) **and** instructs "pass the injected `now`, never a `Date`/`localDateTime()` call inside the read" (`25-02-PLAN.md:133,142`). Three compounding problems: (a) it will not type-check — a `string` is not assignable to `today: Date`; (b) the plan misstates the parser's real signature; (c) the plan forbids the natural in-read `Date` construction, and the obvious remediation `new Date(now)` reintroduces the exact UTC evening off-by-one that CLAUDE.md flags as already-fixed-once and must not be reintroduced (a `"YYYY-MM-DD HH:MM:SS"` string parse is engine-dependent, not reliably local). The safe fix is a node-pure local-parts construction (`new Date(y, m-1, d)` from the parsed date portion), which the plan neither states nor permits.

  **Severity divergence (recorded, not hidden):** Codex rated this **HIGH / compile-blocking**; the Claude subagent rated it **LOW** ("tsc-caught, one-line fix"). Adjudication → **HIGH**: it is an objective compile error (not impressionistic), the plan makes a false claim about an existing shared function's signature, forbids the correct fix location, and the naive remediation the Claude reviewer proposed (`new Date(now)`) reintroduces a CLAUDE.md-forbidden data-correctness bug. Widening `daysUntilBirthday` to accept a string is the alternative, but it touches the other live caller `notification-schedule.ts:249` (`daysUntilBirthday(c.birthday, today)`, a `Date`) and must preserve local-midnight / Feb-29 semantics — a wider blast radius the plan does not scope. This is **not** an owner escalation (no recorded decision is reversed); it is an unresolved planning defect requiring a Plan 02 change.

### Agreed Strengths

- Plan 01 migration 019 follows the additive multi-`ALTER TABLE` pattern (precedent migration 015); restore chain 001–018 correctly accounted for (`restore-apply.test.ts:62,66`). Legacy `BASE_WHERE` correctly frozen so D-12 snooze relocation does not weaken the ADR-011 segregation trip-wire.
- Plan 03 Gravity as a reversible post-query TS pass (never a SQL clause, never a cached column), reusing `computeContactGravity` + `GRAVITY_TIERS` (`impact.ts:88`), with the one-way-door recorded as an assumption — the reversible path is correctly taken without an owner checkpoint.
- Plan 04 correctly rejects reuse of the all-terms-required `scoreQuery`/`rankCandidates` gate for partial-coverage Dashboard search; the `LEFT JOIN` and `orderedEligibleIds` tie-break are both grounded in the actual id-ordered corpus read (`knowledge-search-read.ts:56`).
- Plan 06 Home-only widget intent correction accurately traces the runtime failure (both paths dereference `routes[1]`; `widget-linking.ts:61,301`, `widget-quick-action-guard.ts:32`).
- Plan 07 bound-only legacy term-branch change is precisely scoped (D-13); `countNeverContacted` kept for Digest (D-14).

### Divergent Views

- **Severity of the birthday `Date`/`string` seam** — Codex HIGH vs Claude LOW (adjudicated HIGH above). This is the only divergence.
- **Codex-only MEDIUM (Plan 04 `scoreCandidate` ambiguity):** Codex read "thread the new descriptor/coverage behavior through the `scoreCandidate` seam" as implying `scoreCandidate` (`string × string → number|null`, `knowledge-search.ts:94`) must expose provenance/highlights, contradicting "leave it unchanged." On close reading this is a **wording** concern, not a defect: Plan 04 already specifies the resolution — the new coverage aggregator and per-entry match-info/offset helper are **additive** functions that *call* `scoreCandidate`/`tokenScore` as a matching primitive, the plan explicitly acknowledges the offset gap ("Neither yields positions — the offset surface must track original indices," `25-04-PLAN.md:141`), and the acceptance criterion pins `scoreCandidate` unchanged + `tsc` clean (`25-04-PLAN.md:138,158`). Because the resolution is already in PLAN.md, this is **not** counted as an unresolved actionable; a one-line wording tightening ("reuse `scoreCandidate` as the matcher; do not change its signature") would remove the ambiguity if the planner revisits Plan 04 for the birthday fix.
- **Claude-only LOW (mixed clock sources):** SQL `date('now','localtime')` in the Snoozed/Needs-Attention predicates vs the injected `now` for Birthdays/Gravity. Mirrors shipped code (`dashboard-read.ts:158,369`); informational, no change required.

---

## Codex Review

# Phase 25 Plan Review — Cycle 5

## Summary

The convergence fixes are largely in place: the Plan 02→03→06 `now` dependency is explicitly ordered, Plan 04’s sort tie-break now has a realizable ordered-ID input, and the category corpus query is correctly specified as a `LEFT JOIN` with an uncategorized-contact regression test. One compile-blocking date-type seam remains in the new Birthday population design.

## Plan 01 — Schema, DAO, tracer

### Strengths

- Migration 019 correctly follows the established additive multi-`ALTER TABLE` migration pattern used by migration 015. The runner performs each step and its `PRAGMA user_version` update in one transaction, so the planned forward-only migration shape is appropriate. [015-theme-settings.ts](/home/bwales/projects/orbit-app/src/db/migrations/015-theme-settings.ts:27), [runner.ts](/home/bwales/projects/orbit-app/src/db/migrations/runner.ts:56)
- The plan correctly accounts for the independently hard-coded restore chain: it is currently explicitly limited to migrations 001–018 and target 18. [restore-apply.test.ts](/home/bwales/projects/orbit-app/src/backup/restore-apply.test.ts:38), [restore-apply.test.ts](/home/bwales/projects/orbit-app/src/backup/restore-apply.test.ts:62)
- Keeping legacy `BASE_WHERE` untouched while adding a new predicate is sound: today it includes the snooze suppression clause, so reusing it would violate D-12. [dashboard-read.ts](/home/bwales/projects/orbit-app/src/db/dashboard-read.ts:155)

### Concerns

- None newly found.

## Plan 02 — Population engine

### Strengths

- The corrected 3-argument signature is dependency-safe: Plan 02 introduces it, Plan 03 depends on Plan 02, and Plan 06 also depends on Plan 02.
- All Contacts and the snoozed behavior are correctly separated from the legacy default predicate. The current legacy predicate still excludes snoozed contacts, confirming why the new engine must not reuse it. [dashboard-read.ts](/home/bwales/projects/orbit-app/src/db/dashboard-read.ts:150)
- Birthday candidates already have an archived-only source read, allowing the later population predicate to apply the Bound restriction structurally. [dashboard-read.ts](/home/bwales/projects/orbit-app/src/db/dashboard-read.ts:391)

### Concerns

- **HIGH — the Plan 02 Birthday implementation cannot type-check as specified.** The plan defines `listDashboardPopulation(..., now: string)` and repeatedly directs it to call `daysUntilBirthday(stored, now)` while forbidding a `Date` conversion in the read. But the existing parser requires `today: Date`, and accesses `getFullYear()`, `getMonth()`, and `getDate()`. [birthday-logic.ts](/home/bwales/projects/orbit-app/src/logic/birthday-logic.ts:165)  
  This is the remaining `now` seam: a `YYYY-MM-DD HH:MM:SS` string cannot be passed directly. Add an explicit, node-pure local-date parser/helper in `birthday-logic.ts` (or change the parser’s accepted input contract), then have Plan 02 call that helper. It must preserve local-calendar semantics and avoid UTC parsing.

## Plan 03 — Filters, sort, Gravity

### Strengths

- Reusing the existing injected local-wall-clock string for Gravity is correct: `computeContactGravity` already accepts `now: string`. [impact.ts](/home/bwales/projects/orbit-app/src/services/impact.ts:88)
- The proposed post-query Gravity path matches the current architecture: Gravity is derived from interactions and explicitly documented as never stored. [impact.ts](/home/bwales/projects/orbit-app/src/services/impact.ts:8)
- The Needs-Attention relocation is feasible: the current legacy code shows the exact status threshold expression to reuse. [dashboard-read.ts](/home/bwales/projects/orbit-app/src/db/dashboard-read.ts:253)

### Concerns

- None newly found, contingent on resolving Plan 02’s `now` type mismatch.

## Plan 04 — Scoped semantic search

### Strengths

- The sort tie-break correction is resolved and implementable. Current corpus candidates are emitted in `id` order and contain no dashboard ordering fields, so an ordered eligible-ID sequence is the necessary input—not merely a sort enum. [knowledge-search-read.ts](/home/bwales/projects/orbit-app/src/db/knowledge-search-read.ts:56)
- The `LEFT JOIN categories` correction is necessary and correctly planned: the current corpus reads all contacts, so an inner join would indeed drop uncategorized contacts and their name entries. [knowledge-search-read.ts](/home/bwales/projects/orbit-app/src/db/knowledge-search-read.ts:56)
- The plan correctly rejects reuse of `rankCandidates` for Dashboard partial matching: the existing scorer rejects a candidate as soon as any term does not match. [knowledge-search.ts](/home/bwales/projects/orbit-app/src/services/knowledge-search.ts:111), [knowledge-search.ts](/home/bwales/projects/orbit-app/src/services/knowledge-search.ts:148)
- Phone/email sourcing from `contact_methods` is well grounded; it avoids inventing columns on `contacts`.

### Concerns

- **MEDIUM — scorer-extension instructions remain internally ambiguous.** The plan says existing exported functions, including `scoreCandidate`, must remain unchanged, but also directs the new descriptor/coverage behavior through the `scoreCandidate` seam. Today `scoreCandidate` has the fixed scalar signature `string × string → number | null`; it cannot expose entry provenance or raw-text highlight ranges. [knowledge-search.ts](/home/bwales/projects/orbit-app/src/services/knowledge-search.ts:94)  
  Clarify that Plan 04 adds a separate exported/internal `scoreKnowledgeEntries`-style surface which reuses the existing private matching primitive and normalization rules, while preserving `scoreCandidate` byte-for-byte behavior for current callers.

## Plan 05 — Session and empty state

### Strengths

- The planned in-memory session store follows the existing plain Zustand transient-store pattern. [shell-transient-store.ts](/home/bwales/projects/orbit-app/src/stores/shell-transient-store.ts:22)
- Keeping the empty-state API additive is justified: HomeScreen is the current live caller and supplies the legacy filter-based shape. [HomeScreen.tsx](/home/bwales/projects/orbit-app/src/screens/HomeScreen.tsx:308), [dashboard-empty-logic.ts](/home/bwales/projects/orbit-app/src/logic/dashboard-empty-logic.ts:51)

### Concerns

- None newly found.

## Plan 06 — Favourites retirement

### Strengths

- The Home-only widget intent correction is necessary and accurately traces the current failure mode: the union only permits two-route, index-1 resets, and both runtime paths unconditionally dereference `routes[1]`. [widget-linking.ts](/home/bwales/projects/orbit-app/src/navigation/widget-linking.ts:61), [widget-linking.ts](/home/bwales/projects/orbit-app/src/navigation/widget-linking.ts:301), [widget-quick-action-guard.ts](/home/bwales/projects/orbit-app/src/services/widget/widget-quick-action-guard.ts:32)
- Retaining `favourite_rank` while removing only user-facing rank order is appropriate: current legacy favourites reads still use the rank. [dashboard-read.ts](/home/bwales/projects/orbit-app/src/db/dashboard-read.ts:324)

### Concerns

- None newly found.

## Plan 07 — Retirements and legacy search bound

### Strengths

- The bound-only legacy term-branch change is precisely scoped. The current term branch filters only `archived_at`, while the other population branches already use `DASHBOARD_BOUND_WHERE`; adding it only to the term branch resolves the Unbound leak without modifying `BASE_WHERE`. [dashboard-read.ts](/home/bwales/projects/orbit-app/src/db/dashboard-read.ts:230), [dashboard-read.ts](/home/bwales/projects/orbit-app/src/db/dashboard-read.ts:244)
- Keeping `countNeverContacted` is correct because it includes policy handling independent of the screen. [dashboard-read.ts](/home/bwales/projects/orbit-app/src/db/dashboard-read.ts:346)
- The owner-approved D-13 and D-14 gaps are properly treated as accepted sequencing, not escalations.

### Concerns

- None newly found.

## Suggestions

1. Fix Plan 02 by specifying one canonical conversion from injected local timestamp string to the `Date` required by `daysUntilBirthday`; test it around local midnight and DST.
2. Clarify Plan 04’s additive scorer API so descriptor provenance/highlights do not imply a breaking change to `scoreCandidate`.
3. Keep the explicit tied-relevance and uncategorized-contact tests exactly as written; they materially verify the two Cycle 4 fixes.

## Risk Assessment

**MEDIUM.** The phase is otherwise well converged, with prior routing, ordering, and join issues addressed. The remaining Plan 02 `string` versus `Date` mismatch is a concrete compile/implementation blocker, but has a contained, node-pure fix.

---

## Claude Review

## Phase 25 Plan Review — Cycle 5 (Final Convergence)

### 1. Summary

All three cycle-4 actionables are **RESOLVED** in the current plan text and consistent with the code on disk. The `now`/wave seam is correctly re-homed (introduced in Plan 02, consumed — not re-added — in Plan 03, Plan 06 depends on `25-02` which is where the 3-arg form is born, so no compile-order gap exists across waves); `searchDashboard(candidates, term, orderedEligibleIds)` is realizable because Plan 03's `listDashboardPopulation` returns the fully-filtered rows already in resolved dashboard-sort order, and the render-phase caller derives `orderedEligibleIds` from that same row sequence; and the `categories` join is pinned `LEFT JOIN` with an uncategorized-contact test, matching the on-disk precedent at `dashboard-read.ts:147`. Migration numbering re-verified on disk (head 018, `TARGET_VERSION = 18`, restore chain 001–018), so Plan 01's migration 019 is head+1. D-12/D-13/D-14 are implemented exactly as authorized and were not re-escalated. I found **one new item**: the plans' literal `daysUntilBirthday(stored, now)` call passes a `string` to a parameter whose real signature is `today: Date` (`birthday-logic.ts:165-168`) — a `tsc`-caught type inconsistency at the exact seam cycle 4 tightened. No HIGH, no owner escalation. (Reviewer rated this LOW; see Consensus for the adjudicated severity.)

### 2. Concerns (per-plan and cross-cutting)

**[NEW] Plan 02/03 — `daysUntilBirthday(stored, now)` passes a string to a `Date` parameter.** The injected `now` is defined as a string (`= localDateTime()`, and `computeContactGravity(inputs, now: string)` at `impact.ts:88-90` requires a string). But `daysUntilBirthday(stored, today)` takes `today: Date` (`src/logic/birthday-logic.ts:165-168`), not a string. The plans write `daysUntilBirthday(stored, now)` verbatim in three places (`25-02-PLAN.md:28,133,142`) and instruct "pass the injected `now`, never a `Date`/`localDateTime()` call inside the read" (`25-02-PLAN.md:133`) — which actively conflicts with the `new Date(now)` bridge the type mismatch forces. Two consumers of the single `now` want different types (gravity=string, birthday=Date), so a conversion at the Birthdays seam is unavoidable; the plan neither states it nor allows it cleanly. Impact: fails loudly at `tsc`; the naive `new Date(now)` fix sits on the app's known timezone-footgun (CLAUDE.md's UTC off-by-one, "do not reintroduce").

**[LOW — informational] Mixed clock sources within one read.** The Snoozed-population predicate (`25-02-PLAN.md:91`) and the Needs-Attention snooze-suppression clause (`25-03-PLAN.md:102`) use SQL `date('now','localtime')`, while Birthdays/Gravity use the injected `now`. This mirrors shipped code (`dashboard-read.ts:158,369`), so it is not a regression, but the plans' claim that "one dashboard read cannot straddle a day boundary" (`25-03-PLAN.md:92`) is only true for the injected-`now` paths, not the SQL snooze clauses. Purely theoretical; no change required.

No concerns on Plans 01, 05, 06, 07 beyond the above.

### 3. Verdict on the three cycle-4 items

**Item 1 — cross-plan `now`/wave seam: RESOLVED.** Plan 01 stays 2-arg with a forward-ref note (`25-01-PLAN.md:188`). Plan 02 WIDENS to `(exec, query, now)` and updates the tracer's call sites (`25-02-PLAN.md:50,121,138,155`), `depends_on: [25-01]`, wave 2. Plan 03 CONSUMES the same `now`, explicitly "does not re-introduce" it (`25-03-PLAN.md:92,167,187`), `depends_on: [25-02]`, wave 3. Plan 06 calls the 3-arg form (`25-06-PLAN.md:102`) and declares `depends_on: [25-02]` (`25-06-PLAN.md:6`) — the 3-arg signature is born in `25-02`, so there is **no depends_on gap**. Wave/file-contention check: `dashboard-read.ts` is edited sequentially across waves (01→02→03→07); Plans 03 and 06 share wave 3 but 06 edits `widget-data.ts`/nav/favourites (never `dashboard-read.ts`) and compiles against the wave-2 signature — **no compile-order seam**. The residual is the Date/string type detail above, which is adjacent to but distinct from the seam itself.

**Item 2 — `searchDashboard` tie-breaker: RESOLVED.** Signature is `searchDashboard(candidates, term, orderedEligibleIds)` (`25-04-PLAN.md:50,182`), with `orderedEligibleIds` = the fully-filtered eligible ids in resolved dashboard-sort order (the `.id` sequence of `listDashboardPopulation`'s returned rows). Realizability verified: the corpus read is id-ordered and carries no progress/last-contact (`knowledge-search-read.ts:56-59` `ORDER BY id`), so the bare enum genuinely cannot tie-break — confirming the need for `orderedEligibleIds`. The caller **does** have the sorted id list: Plan 03's `listDashboardPopulation` returns rows fully-filtered (population + SQL filters + post-query Gravity, preserving order; Birthdays soonest-first applied as a JS re-sort), so a render-phase caller's `rows.map(r => r.id)` yields exactly that ordered set, and the corpus is scoped to the same ids — internally consistent. A tied-relevance test is specified (`25-04-PLAN.md:182,190`).

**Item 3 — categories `LEFT JOIN`: RESOLVED.** Plan 04 pins "LEFT JOIN categories, never INNER" with rationale and an uncategorized-contact (`NULL category_id`) test proving the name-identity corpus entry is retained (`25-04-PLAN.md:27,94,110,122`). Precedent confirmed on disk: `dashboard-read.ts:147` is `LEFT JOIN categories cat ON cat.id = c.category_id`; and `knowledge-search-read.ts:56` today selects only `id, name` with no join, so the plan correctly treats the join as newly added.

### 4. New findings

Only the two items in §2. The primary one is the `daysUntilBirthday` `Date`-vs-`string` mismatch — genuinely new (neither cycle-4 reviewer caught that `daysUntilBirthday` takes a `Date`; they only fixed the *injection/ordering* of `today`→`now`). Everything else — migration forward-only/additive shape, no network on any read path, Zustand patterns (durable `dashboard-query-store` via DAO with no AsyncStorage; ephemeral `dashboard-session-store` mirroring `shell-transient-store`), `check:colors` gates present, D-12 snooze relocation with legacy `BASE_WHERE` frozen (`dashboard-read.ts:155-158`), D-13 bound-only fix (Branch 1 at `:234-238` omits the bound predicate today — the leak is real and the fix is correctly scoped), D-14 NeverContacted retirement with `countNeverContacted` kept (`:346`) — checks out. The 7 plans as a set achieve the phase goal: durable population/filter/sort axes (Plan 01/02/03) + scoped search (Plan 04) + ephemeral session state and cause-aware empty gate (Plan 05); actual Dashboard→Profile→Back restoration wiring is explicitly deferred to render phases 26–28, consistent with the non-visual phase boundary.

### 5. Overall risk: **LOW** (reviewer's own rating; see Consensus for adjudication)

All three cycle-4 actionables are resolved in the plan text and verified against the code on disk; migration numbering, local-first, store, and D-12/13/14 invariants all hold. The single new item is a `tsc`-caught type inconsistency on the birthday clock parameter — worth a one-line plan correction (specify the local-parts conversion at the Birthdays seam and reconcile the "never a Date call inside the read" wording) but not a data-invariant defect. No owner escalation.
