---
phase: 25
cycle: 4
reviewers: [codex, claude]
reviewed_at: 2026-09-04T21:20:00Z
plans_reviewed: [25-01-PLAN.md, 25-02-PLAN.md, 25-03-PLAN.md, 25-04-PLAN.md, 25-05-PLAN.md, 25-06-PLAN.md, 25-07-PLAN.md]
models:
  codex: "gpt-5.6-terra (reasoning=high)"
  claude: "opus (read-only subagent)"
model_sources:
  codex: "banner"
  claude: "subagent-invocation"
note: >
  Cycle 4 of the convergence loop. Plans revised after cycle-3: the 7 cycle-3 actionable nits were
  applied in commit 57982a5. Owner decisions D-12 (snooze→Needs-Attention), D-13 (Unbound search
  bound-only NOW; one-phase gap accepted) and D-14 (NeverContactedScreen retired NOW; one-phase gap
  accepted) are AUTHORITATIVE and were NOT re-escalated — their implementations were verified instead.
  The Claude lane ran as an owner-authorized read-only subagent (the `claude -p` lane has a known
  Write-permission gap in this repo). Every load-bearing claim in both reviews was independently
  re-verified against the code on disk by the orchestrator.
---

# Cross-AI Plan Review — Phase 25 (Dashboard Data & State Foundation) — CYCLE 4

## Consensus Summary

Both reviewers independently agree: **all 7 cycle-3 actionable nits are RESOLVED on disk** against the
revised plans (commit 57982a5), and **no finding this cycle is an owner escalation** — nothing deletes,
weakens, or inverts an ADR/HANDOFF/CONTEXT decision beyond what D-12/D-13/D-14 explicitly authorize.
D-12 (snooze relocated out of the new Active predicate into the Needs-Attention filter; legacy
`BASE_WHERE` frozen byte-unchanged), D-13 (legacy term Branch 1 bound-only; no `searchUnbound`), and
D-14 (NeverContacted retirement re-points every real on-disk consumer; `countNeverContacted` kept for
Digest) are each implemented exactly as authorized. Migration numbering re-verified: head 018,
`TARGET_VERSION = 18` (`database.ts:53,74`), restore chain 001–018 (`restore-apply.test.ts:62,66`) —
Plan 01's schema/DAO claims match disk.

The residual is a small cluster of plan-precision items, all newly-surfaced this cycle and none an
execution-blocking data defect. The two reviewers **converge** on one cross-plan signature/ordering
seam (below) and each additionally raised one non-overlapping Plan-04 input-contract precision point.
The orchestrator independently re-verified every load-bearing claim below against the code on disk
(not the reviewers' summaries).

### Agreed Strengths (both reviewers, verified)

- Every cycle-3 fix lands against **real symbols and columns**: `knowledge-search-read.ts:56-59`
  `LIST_CONTACTS` selects only `id, name` (no categories join, no phone/email today); `contact_methods`
  carries `method_type IN ('phone','email')` + `display_value` (migration `009-…:229-230`); the
  `contact_methods` primary UNIQUE index is scoped `WHERE is_primary = 1` (`009-…:235`), so a contact
  CAN carry multiple methods — vindicating the switch to a **separate scoped read** over a fanning JOIN.
- D-12/D-13/D-14 implemented **exactly as authorized** — new `ACTIVE_SEGREGATION_WHERE` (three ADR-011
  clauses, no snooze) with legacy `BASE_WHERE` (`dashboard-read.ts:155-158`) frozen; the snooze clause
  relocated onto the Needs-Attention filter (Plan 03); Branch 1 (`dashboard-read.ts:234-238`, which
  today omits the bound predicate) gains `AND ${DASHBOARD_BOUND_WHERE}` only; NeverContacted consumers
  (`types.ts:65`, `DashboardStack.tsx`, `DigestScreen.tsx:163`, `HomeScreen.tsx:417`,
  `focused-route-classification.test.ts:38`) re-pointed; `countNeverContacted` (`dashboard-read.ts:346`)
  survives for Digest.
- The real HomeScreen symbol is correctly named `isNeutralDashboardSearchRow` (`HomeScreen.tsx:70`
  import, `:558` render); `dashboardSearchRowPresentation` lives only in `HomeScreen.test.tsx`.

### Agreed Concerns (raised or corroborated by both — highest priority)

- **`listDashboardPopulation` signature is introduced across plan boundaries, and Plan 06 depends on a
  signature it doesn't declare.** Plan 02 defines `listDashboardPopulation(exec, query)` (2-arg) yet its
  Birthdays seam computes `daysUntilBirthday(stored, today)` with a `today` that the declared signature
  never injects (`25-02-PLAN.md:121,138`); Plan 03 introduces the required injected `now: string`
  (`25-03-PLAN.md:167`) — and Plan 03's own posture forbids importing `localDateTime` into
  `dashboard-read.ts`, so Plan 02 cannot legally source `today` on its own. Plan 06 (wave 3,
  `depends_on: [25-02]`) calls the **3-arg** form `listDashboardPopulation(exec, { … }, now)`
  (`25-06-PLAN.md:6,102`) that only Plan 03 creates — and Plan 06 does not depend on Plan 03. Codex rated
  this **HIGH**; Claude rated it **LOW** (fails loudly at `tsc`, and in-place numeric-order execution
  makes 03-before-06 likely). Reconciled to **MEDIUM actionable** (see Divergent Views).

### Divergent Views

- **Severity of the signature/ordering seam (codex HIGH vs claude LOW).** Reconciled by the orchestrator
  to **MEDIUM actionable**: it is a `tsc`-caught plan-signature/ordering imprecision, not a data-invariant
  defect or a decided-contract reversal, so it is not HIGH (same rubric that reconciled cycle-3's
  widget-call-signature HIGH→MEDIUM). But it is more than LOW, because Plan 02 as written references an
  **undefined `today`** in its wave-2 birthday seam — Claude's LOW frames only the Plan 06 dependency
  edge and understates the Plan 02 internal gap. The cleanest fix (codex's) resolves both facets:
  introduce the injected `now` in **Plan 02** (its birthday `today` = `now`), have Plan 03 **consume**
  rather than add it, and Plan 06 depending on 25-02 then gets the 3-arg form.
- **Non-overlapping Plan-04 input-contract findings (not disagreement).** Codex found that
  `searchDashboard(candidates, term, sort)` cannot realize its "sort as tie-breaker" AC; Claude found the
  added `categories` join type is unpinned (must be LEFT). Both were re-verified on disk and are treated
  as live actionables.

---

## Codex Review

<!-- model: gpt-5.6-terra (reasoning=high); source-grounded, file:line evidence; independently re-verified on disk -->

Summary: the 7 cycle-3 nits are correctly planned and grounded (nit #3 named the correct final call but
left the signature introduced too late / with an unstated dependency — see below). One newly-found
Plan-04 input-contract gap. No owner escalation — D-12/D-13/D-14 followed as written.

- **[reconciled MEDIUM; Codex HIGH] Cross-plan clock/signature seam (nit #3 residual).** Plan 02 defines
  `listDashboardPopulation(exec, query)` and calls `daysUntilBirthday(…, today)` without defining or
  injecting `today` (`25-02-PLAN.md:121,138`); Plan 03 only introduces the required `now: string` later
  (`25-03-PLAN.md:167,178`); Plan 06 depends only on 25-02 yet calls the three-argument form
  (`25-06-PLAN.md:6,102`). `computeContactGravity` genuinely needs a supplied local time
  (`impact.ts:88`). This is a plan-order/signature defect, not a current implementation mismatch (the
  read has no such function yet). **Required change:** define the injected local `now` contract in Plan
  02 (including the Birthdays seam), then have Plan 03 consume rather than add it; Plan 06 can remain
  dependent on 25-02.

- **[MEDIUM — NEWLY-FOUND] Plan 04 — `searchDashboard(candidates, term, sort)` cannot implement the
  Dashboard-sort tie-breaker with the inputs it receives** (`25-04-PLAN.md:181`). `KnowledgeSearchCandidate`
  carries only `contactId` + `entries` (`knowledge-search-read.ts:34-36`), and the corpus read orders
  contacts by id (`knowledge-search-read.ts:56-59`, `ORDER BY id`), so passing only a `sort` enum cannot
  tie-break Status / recency / name correctly (no progress, last-contact, or dashboard-order position is
  available). **Orchestrator note:** confirmed — the eligible-id candidates are id-ordered, not
  dashboard-sort-ordered, so the plan's own "relevance-primary with sort tie-break" test
  (`25-04-PLAN.md:181,189`) cannot be written truthfully as specified. **Required change:** pass the
  dashboard-ordered eligible ids (or an explicit dashboard-order rank) into the search composition and
  test tied relevance across each applicable sort — or explicitly scope the tie-break *realization* to
  the render phase that owns the wiring and soften the Plan-04 AC accordingly.

- **Migration/DAO (Plan 01):** no concern — head 018 / `TARGET_VERSION 18` (`database.ts:53,74`), restore
  chain 001–018 (`restore-apply.test.ts:62,66`). D-12 segregation-only Active with legacy `BASE_WHERE`
  preserved. Plans 03/05/07: no additional concern; D-12/D-13/D-14 correctly reflected.

**Overall risk: MEDIUM after fixing the 25-02 clock/signature seam; the rest is grounded.**

---

## Claude Review

<!-- model: opus (read-only subagent, owner-authorized for this run); source-grounded; independently re-verified on disk -->

**Overall risk: LOW / converged.** All 7 cycle-3 nits are genuinely resolved in the current plan text and
every load-bearing disk claim checked is accurate. D-12/D-13/D-14 implemented as written (snooze clause
verifiably relocated out of the new Active predicate into the Needs-Attention filter; legacy term-branch
bound-only edit correctly scoped; NeverContacted retirement re-points every real on-disk consumer). No
HIGH/MEDIUM concern; two LOW newly-found items worth a one-line plan tweak, neither blocking (both fail
loudly at `tsc`/test, not silently). No owner escalation.

- **[LOW — NEWLY-FOUND] Plan 06 depends on Plan 03's 3-arg signature but doesn't declare it.** Plan 06
  Task 1 calls `listDashboardPopulation(exec, { … }, now)`; the 3-arg `(exec, query, now)` form is
  introduced by **Plan 03** (`25-03-PLAN.md:167`), while Plans 01/02 define it 2-arg. Plan 06 declares
  `depends_on: [25-02]` and sits in Wave 3 alongside Plan 03. Under a strict `depends_on`-driven or
  parallel scheduler, Plan 06 could run before Plan 03 and a 3rd arg to a 2-arg function is a hard `tsc`
  error. With git-worktrees disabled + in-place numeric-order execution, 03-before-06 is likely — hence
  LOW. **Required change:** add `25-03` to Plan 06's `depends_on` (or state that Plan 03's `now`-param
  must precede it). *(Same seam as Codex's HIGH; see Divergent Views for the reconciled fix.)*

- **[LOW — NEWLY-FOUND] Plan 04's added `categories` join type is unpinned.** Plan 04 Task 1 adds a
  `categories` join via `contacts.category_id → categories.name` (`25-04-PLAN.md` Task 1) but does not
  specify `LEFT JOIN`. An INNER join would silently drop every uncategorized contact from the entire
  search corpus — **including its primary `name` identity entry** — a DASHQ-08/09 completeness
  regression. The correct precedent is already in a `read_first` file (`dashboard-read.ts:147`,
  `LEFT JOIN categories cat ON cat.id = c.category_id`). **Required change:** pin "LEFT JOIN categories"
  in Plan 04 Task 1's action/AC so an uncategorized contact still yields its name candidate.

- For the record: `listKnowledgeSearchCandidates` has no external callers (grep = 0 outside its module),
  so making `eligibleIds` a required option breaks no existing caller.

---

## Cycle-4 Verdict (orchestrator synthesis)

All findings below were re-verified against the code on disk by the orchestrator (not taken from the
reviewers' summaries). **All 7 cycle-3 actionable nits are RESOLVED**; D-12/D-13/D-14 are implemented
exactly as owner-authorized and were not re-escalated. **No HIGH remains and no owner escalation is
required.** The residual is three newly-surfaced plan-precision actionables (union of the two reviewers'
findings), none an execution-blocking data defect — all fail loudly at `tsc`/test rather than silently.

Cycle-3 nit disposition (both reviewers + orchestrator): #1 separate scoped `contact_methods` read —
RESOLVED; #2 categories-join wording corrected — RESOLVED; #3 real `(exec, query, now)` call named —
RESOLVED *at the call site* (but exposed the signature-introduction/ordering seam recorded below as a new
actionable); #4 widget-linking.ts doc sweep — RESOLVED; #5 Reset = resetDashboardView()+clearSession()
DASHC-10 ownership — RESOLVED; #6 real `isNeutralDashboardSearchRow` symbol — RESOLVED; #7 two benign
NeverContacted seed fixtures carved out — RESOLVED.

CYCLE_SUMMARY: current_high=0 current_actionable=3

### Current HIGH Concerns (unresolved — 0)

None. (All 7 cycle-3 actionables resolved; D-12/D-13/D-14 implemented cleanly as owner-authorized. Codex's
one HIGH is a `tsc`-caught plan-signature/ordering imprecision — reconciled to MEDIUM actionable, no
data-invariant defect and no decided-contract reversal; no new HIGH; no owner escalation.)

### Current Actionable Non-HIGH Concerns (unresolved — 3)

1. **[MEDIUM] Plans 02/03/06 — introduce the injected `now` in Plan 02, not Plan 03.** Plan 02's
   `listDashboardPopulation(exec, query)` references an undefined `today` in its Birthdays seam
   (`25-02-PLAN.md:121,138`) and Plan 03's node-pure posture forbids importing `localDateTime` there, so
   the injected `now` must exist from wave 2. Move the `now: string` parameter introduction into Plan 02
   (its Birthdays `today` = that `now`); have Plan 03 **consume** rather than add it; Plan 06
   (`depends_on: [25-02]`, calling the 3-arg form at `25-06-PLAN.md:102`) then compiles. Equivalent
   minimal alternative: add `25-03` to Plan 06's `depends_on` AND give Plan 02 a legal `today` source —
   but the Plan-02-owns-`now` fix covers both facets in one edit.
2. **[MEDIUM] Plan 04 Task 1 — give `searchDashboard` a dashboard-order input for the sort tie-breaker.**
   `searchDashboard(candidates, term, sort)` (`25-04-PLAN.md:181`) receives only id-ordered candidates
   (`knowledge-search-read.ts:34-36,56-59`) and a `sort` enum, so it cannot break relevance ties by
   Status/recency/dashboard-order as its AC claims. Pass the dashboard-ordered eligible ids (or an
   explicit order rank) into the composition and add a tied-relevance test per applicable sort — or
   explicitly defer the tie-break realization to the render phase and soften the Plan-04 AC.
3. **[LOW] Plan 04 Task 1 — pin `LEFT JOIN categories`.** The added `categories` join
   (`contacts.category_id → categories.name`) must be a LEFT JOIN, or an INNER join silently drops every
   uncategorized contact (and its `name` identity entry) from the whole corpus (DASHQ-08/09 regression).
   Precedent: `dashboard-read.ts:147`.
