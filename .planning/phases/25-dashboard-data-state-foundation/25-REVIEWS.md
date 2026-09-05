---
phase: 25
cycle: 3
reviewers: [codex, claude]
reviewed_at: 2026-09-05T02:00:42Z
plans_reviewed: [25-01-PLAN.md, 25-02-PLAN.md, 25-03-PLAN.md, 25-04-PLAN.md, 25-05-PLAN.md, 25-06-PLAN.md, 25-07-PLAN.md]
models:
  codex: "gpt-5.6-terra (reasoning=high)"
  claude: "opus (read-only subagent)"
model_sources:
  codex: "banner"
  claude: "subagent-invocation"
note: >
  Cycle 3 of the convergence loop. Plans revised after cycle-2 (commit 3eb66b8) and owner decisions
  D-13 (Unbound search — legacy Home term branch made bound-only NOW; searchUnbound dropped; one-phase
  Unbound name-lookup gap ACCEPTED, replacement coordinated with Phase 26) and D-14 (Not-Contacted —
  NeverContactedScreen retired NOW; one-phase control gap ACCEPTED). D-13 and D-14 are OWNER-AUTHORIZED
  and were NOT re-escalated — their implementations were verified for correctness instead. The Claude
  lane ran as an owner-authorized read-only subagent (the `claude -p` lane has a known Write-permission
  gap in this repo). Every load-bearing claim in both reviews was independently re-verified against the
  code on disk by the orchestrator.
---

# Cross-AI Plan Review — Phase 25 (Dashboard Data & State Foundation) — CYCLE 3

## Consensus Summary

Both reviewers independently agree: **all 5 cycle-2 HIGHs and all 4 cycle-2 actionables are FULLY
RESOLVED on disk** against the revised plans (commit 3eb66b8) plus owner decisions D-13/D-14, and
**no finding this cycle is an owner escalation** — nothing deletes, weakens, or inverts an
ADR/HANDOFF/CONTEXT decision beyond what D-13/D-14 explicitly authorize. Migration numbering is
re-verified head+1 = 019 (head 018, `TARGET_VERSION = 18` at `database.ts:53`). The orchestrator
independently re-verified every load-bearing claim below against the code on disk (not the reviewers'
summaries).

The two reviewers found **non-overlapping** residual issues, and **the residuals are all plan-text /
spec-precision imprecisions, not execution-blocking defects** — the engineering architecture is sound
and each cycle-2 fix lands against real symbols/columns:

- **HIGH-1 (Plan 04 phone/email):** now sourced via a `contact_methods` LEFT JOIN
  (`method_type IN ('phone','email')`, `display_value`). Verified `contacts` has no phone/email
  (migration 009 `CREATE_CONTACTS_V9` at `009-…:16-34`; no later migration re-adds them) and that
  `contact_methods` carries those columns (`009-…:226-234`). **RESOLVED.**
- **HIGH-2 (Plan 04 descriptor contract):** `KnowledgeSearchEntry` widened (memory `type` + part
  split, relationship `relation_type` + `note`, direct-field/category labels) + an offset-preserving
  match surface added inside `knowledge-search.ts`. Verified the disk gaps the plan claims
  (`knowledge-search-read.ts:56-59,73-83,101-108`; `knowledge-search.ts` `tokenize`→strings at 32-40,
  `tokenScore`→number at 81-87) and that all widened target columns exist in migration 016
  (`memories.type` `:15`, `relationships.relation_type` `:36` / `note` `:38`). **RESOLVED.**
- **HIGH-3 (Plan 06 widget intent):** adds a Home-only `WidgetNavIntent` variant (`index:0`, one
  route), re-points `resolveWidgetUri('orbit://favourites')`, and handles it in **all three**
  unconditional `routes[1]` consumers — the guard (`widget-quick-action-guard.ts:32`) and both gate
  reads (`widget-linking.ts:301` and `:326`). **RESOLVED.**
- **HIGH-4 (Plan 07 Unbound leak → D-13):** Plan 07 Task 3(1) adds `AND ${DASHBOARD_BOUND_WHERE}` to
  Branch 1's inline `where` only; `BASE_WHERE` (`dashboard-read.ts:155-158`) is byte-unchanged; no
  `searchUnbound` is added; `unbound-read.ts` / `UnboundContactsScreen.tsx` untouched. Exactly D-13.
  **RESOLVED (owner-authorized) — not re-escalated.**
- **HIGH-5 (Plan 07 Not-Contacted gap → D-14):** `NeverContactedScreen` retirement is clean — every
  consumer re-pointed (`types.ts:65`, `DashboardStack.tsx:16,65`, `DigestScreen.tsx:163`,
  `HomeScreen.tsx:417`, `focused-route-classification.test.ts:38`), `countNeverContacted` kept (still
  read by `DigestScreen.tsx:100`, `HomeScreen.tsx:198`, `digest-read.test.ts:414`).
  **RESOLVED (owner-authorized) — not re-escalated.**
- **A1** (Plan 01 `restore-apply.test.ts` + mig 019 in local chain), **A2** (Plan 06
  `rewriteFavouriteRanks` grep-gate swept incl. `ring-seq-dao`), **A3** (Plan 03 single read-scoped
  `now` for Gravity), **A4** (Plans 06/07 stale-comment cleanup): all incorporated. **RESOLVED.**

**Overall risk: LOW.** Residual = 0 HIGH, 0 owner escalation, and a cluster of MEDIUM/LOW plan-text
corrections (below), most of them caught by the plans' own `tsc`/`vitest` gates but worth fixing so
the executor is not misdirected.

### Agreed Strengths (both reviewers, verified)

- Every cycle-2 fix lands against **real symbols and columns** — the widened corpus targets exist in
  migrations 009/016; the Home-only widget variant handles all three `routes[1]` sites; the D-13
  bound predicate is the exact one-line inline-`where` change with `BASE_WHERE` frozen.
- D-13 and D-14 are implemented **exactly as authorized** — the legacy term branch is bound-only, no
  `searchUnbound` is re-added, the Never-Contacted retirement re-points (not strands) consumers, and
  `countNeverContacted` survives for Digest. No unauthorized ADR/CONTEXT reversal.
- Migration 019 = head+1 (018 / `TARGET_VERSION 18`), additive `ADD COLUMN` only, one-way
  `checkpoint:decision` gate, `restore-apply.test.ts` chain registered.

### Agreed Concerns (raised or corroborated by both — highest priority)

- **Plan 07 NeverContacted grep-gate yields benign false positives** (raised by Claude AND the
  orchestrator's independent pass). The gate `grep -rn 'name="NeverContacted"\|navigate("NeverContacted")\|"NeverContacted",' src`
  cannot return empty after the retirement: the `"NeverContacted",` alternative matches the seed-name
  fixtures `name: "NeverContacted",` in **`queries.test.ts:135`** AND **`contact-status-read.test.ts:160`**.
  Plan 07 flags only `queries.test.ts` as benign and omits `contact-status-read.test.ts:160` entirely.
  Same class as the cycle-2 A2 gate bug that was fixed for `rewriteFavouriteRanks`. **MEDIUM actionable.**

### Divergent Views

- **Severity framing of the three cross-plan spec gaps (Codex).** Codex rates its three findings
  (reset-clears-search coordination; `contact_methods` join fan-out; Plan 06 widget call signature)
  as HIGH; Claude did not surface them and rated the set LOW. Reconciled by the orchestrator against
  disk: none is execution-blocking or a decided-contract reversal — the widget-call and reset items
  are `tsc`/scope-precision fixes, and the reset "cleared search" clause is a **Phase-26** requirement
  (DASHC-10) whose two primitives already exist in P25. The fan-out item is the only one not caught by
  a gate, but the corpus is inherently per-`contactId`-keyed. All three are treated as **MEDIUM
  actionable**, not HIGH.
- **Non-overlapping coverage (not disagreement).** Codex found the three cross-plan contract seams;
  Claude found three plan-text precision errors (Plan 07 symbol misname; Plan 06 `widget-linking.ts`
  header comments; Plan 04 "existing categories join" wording). Both sets were re-verified on disk and
  are treated as live.

---

## Codex Review

<!-- model: gpt-5.6-terra (reasoning=high); source-grounded, file:line evidence; independently re-verified on disk -->

Summary: the five prior HIGH findings and four actionables are now planned correctly. Three new
unresolved cross-plan seams remain (Codex rated them HIGH; the orchestrator reconciled them to MEDIUM
actionable — see Divergent Views).

**FULLY RESOLVED (Codex):** HIGH-1 direct `contact_methods` sourcing; HIGH-2 provenance + offset
surface; HIGH-3 Home-only widget intent/guard; HIGH-4 D-13 bound-only legacy term branch; HIGH-5 D-14
clean Never-Contacted retirement; A1 restore-chain mig 019 registration; A2 comment-aware
`rewriteFavouriteRanks` sweep; A3 injected read-scoped Gravity `now`; A4 stale retirement-comment
cleanup. No owner escalation — none weakens D-13, D-14, or any ADR.

- **[reconciled MEDIUM; Codex HIGH] Plan 01 / Plan 05 — global Reset Dashboard View does not clear
  search.** The dossier's Reset contract restores Active / no filters / Default sort / **cleared
  search** while preserving List/Card (`dossier:250-263` [DECIDED]). Plan 01's `resetDashboardView()`
  is explicitly "search-not-owned-here" (`25-01-PLAN.md:38`) and Plan 05 provides a separate
  `clearSession()` (`25-05-PLAN.md` Task 1) — nothing coordinates them. **Orchestrator note:** the
  full Reset control + its "cleared search" behavior is **DASHC-10, a Phase-26 (Control Surface)
  requirement** (`REQUIREMENTS.md:98`); P25's DASHQ-13 owns the shared query-state + durable-axis
  reset, and the two clearing primitives (durable `resetDashboardView()` + ephemeral `clearSession()`)
  both exist in P25. So this is a recorded-ownership gap, not an execution-blocking defect. Required
  change: in Plan 01 (or Plan 05) explicitly record that "Reset Dashboard View = `resetDashboardView()`
  (durable axes) + `clearSession()` (search), coordinated by the Phase-26 Control Surface (DASHC-10)"
  — so the decided "cleared search" clause is not silently orphaned. (Or add a foundation-level reset
  coordinator if the owner wants it in P25.)

- **[reconciled MEDIUM; Codex HIGH] Plan 04 — the `contact_methods` LEFT JOIN can fan one contact into
  multiple corpus candidates.** Only the *primary* method per `(contact_id, method_type)` is unique
  (`009-…:235`, `WHERE is_primary = 1`); the DAO models ordered method arrays
  (`contact-methods-dao.ts:69`), so a contact may have multiple phones/emails. A literal join onto the
  `id,name` contact read would duplicate contact rows (and name entries), violating the
  per-deduplicated-contact result shape (`25-UI-SPEC.md:195`). **Orchestrator note:** the existing
  corpus is per-`contactId`-keyed (`contacts.map(...)`, one `KnowledgeSearchCandidate` per contact,
  1-to-many sources grouped via a `Map` exactly like `memories`/`relationships`), so an executor
  mirroring that pattern would not fan out — but the plan's repeated literal "LEFT JOIN" wording plus
  the absence of a multi-method test is a genuine trap (a logic-level fan-out is NOT `tsc`-caught).
  Required change (Plan 04 Task 1): specify the phone/email read as a **separate scoped
  `contact_methods` query grouped by `contact_id`** (mirroring the memory/relationship reads), NOT a
  join onto `LIST_CONTACTS`, and add a test that one contact with two phones/emails yields exactly one
  candidate carrying both method entries.

- **[reconciled MEDIUM; Codex HIGH] Plan 06 — widget repoint uses a call that cannot type-check.** Plan
  06 Task 4 instructs `listDashboardPopulation(['favourites'])` (`25-06-PLAN.md:102`), but Plan 02
  defines `listDashboardPopulation(exec, query)` (`25-02-PLAN.md:121`) and Plan 03 adds a required
  injected `now: string` (`25-03-PLAN.md:167`) → the real signature is
  `listDashboardPopulation(exec, query, now)`. The literal array-arg call fails `tsc` (the widget
  loader already holds an executor, `widget-data.ts:79`). Caught by Plan 06's own `tsc` gate, but the
  action misdirects the executor. Required change (Plan 06 Task 4): specify the complete call —
  `listDashboardPopulation(exec, { populations: ['favourites'], filters: {}, sort: 'default' }, now)` —
  and thread one local wall-clock `now` (with a fixed `now` in `widget-data.test.ts`).

---

## Claude Review

<!-- model: opus (read-only subagent, owner-authorized for this run); source-grounded; independently re-verified on disk -->

**Overall risk: LOW.** All 5 cycle-2 HIGHs and all 4 actionables are resolved on disk against the
revised plans plus D-13/D-14. Every claimed source condition verified holds (Branch 1 omits the bound
predicate; the `WidgetNavIntent` union permits only `index:1` two-route tuples with unconditional
`routes[1]` reads at three sites; `knowledge-search-read.ts` sources only `id,name` and collapses
memory parts; all widened target columns exist in migrations 009/016; mig 019 = head+1). D-13 and D-14
implemented exactly as authorized — no unauthorized reversal. Remaining items are LOW/MEDIUM
plan-text/grep-gate imprecisions, none blocking (caught by the `tsc`/`vitest` gates).

**Cycle-2 disposition (Claude):** HIGH-1..HIGH-5 and A1/A2/A3 — **FULLY RESOLVED**; A4 — **mostly
resolved**, one `widget-linking.ts` header-comment gap (LOW).

- **[LOW-MEDIUM] Plan 07 misnames the HomeScreen consumer.** Task 3(2) says remove "the
  `dashboardSearchRowPresentation` rendering + its import from `HomeScreen.tsx`" — but `HomeScreen.tsx`
  imports **`isNeutralDashboardSearchRow`** (`:70`) and renders it in a ternary at **`:558`**;
  `dashboardSearchRowPresentation` is used **only** by `HomeScreen.test.tsx` (`:2`). Both are exports of
  `dashboard-search-row-logic.ts` (`:8`, `:20`) — verified on disk. Correctness still holds (the module
  is deleted wholesale; `tsc` + the module-path grep catch a leftover import), but Plan 07 should name
  the real symbol + the `:558` render ternary so the executor removes the right code. Required change:
  correct the symbol name and cite `HomeScreen.tsx:70,558`.

- **[LOW] Plan 07 NeverContacted grep-gate false positives** (also raised in the orchestrator's pass —
  see Agreed Concerns). Add `contact-status-read.test.ts:160` to the benign-seed note (the plan notes
  only `queries.test.ts:135`), or scope the pattern to the browseRoutes/route context so the gate
  returns empty.

- **[LOW] Plan 06 A4 gap — `widget-linking.ts` own header comments go stale.** Plan 06 cleans
  `navigation/types.ts:80` but not `widget-linking.ts`'s header doc: line 13
  ("`orbit://favourites → ManageFavourites`"), line 56 ("All four forms reset onto [Home, target]
  (index 1)"), and the `WidgetNavIntent` type doc — all contradict the Home-only variant once it lands.
  Required change: add these to Task 3's doc-comment sweep.

- **[LOW] Plan 04 "existing categories join" wording.** must_haves truth #2 and Task 1 say the category
  label comes "from the existing `categories` join," but the file being edited
  (`knowledge-search-read.ts`) has **no** categories join today — `LIST_CONTACTS` is
  `SELECT id, name FROM contacts` (`:56-59`); the join lives in `dashboard-read.ts`. Non-blocking (the
  executor adds the needed join), but reword to "add a `categories` join / select via
  `contacts.category_id`" so "existing" doesn't misdirect.

---

## Cycle-3 Verdict (orchestrator synthesis)

All findings below were re-verified against the code on disk by the orchestrator (not taken from the
reviewers' summaries). **All 5 cycle-2 HIGHs and all 4 cycle-2 actionables are FULLY RESOLVED**; D-13
and D-14 are implemented exactly as owner-authorized and were not re-escalated. **No HIGH remains and
no owner escalation is required.** The residual is a cluster of MEDIUM/LOW plan-text and spec-precision
corrections (union of the two reviewers' non-overlapping findings), none execution-blocking.

CYCLE_SUMMARY: current_high=0 current_actionable=7

### Current HIGH Concerns (unresolved — 0)

None. (All 5 cycle-2 HIGHs resolved: HIGH-1/2/3 fixed and verified against real symbols/columns;
HIGH-4/5 owner-authorized by D-13/D-14 and implemented cleanly. No new HIGH; no owner escalation.)

### Current Actionable Non-HIGH Concerns (unresolved — 7)

1. **[MEDIUM] Plan 04 Task 1 — specify the `contact_methods` read as a separate scoped query grouped
   by `contact_id`** (mirroring the memory/relationship reads), NOT a literal LEFT JOIN onto
   `LIST_CONTACTS` (which fans a multi-method contact — allowed by `009-…:235`, modeled by
   `contact-methods-dao.ts:69` — into duplicate candidates, violating `25-UI-SPEC.md:195`). Add a test:
   one contact with two phones/emails → exactly one candidate carrying both method entries. (Not
   `tsc`-caught.)
2. **[MEDIUM] Plan 06 Task 4 — give the complete widget population call.** Replace
   `listDashboardPopulation(['favourites'])` (`25-06-PLAN.md:102`) with
   `listDashboardPopulation(exec, { populations: ['favourites'], filters: {}, sort: 'default' }, now)`
   per the Plan 02/03 signature `(exec, query, now)`; thread one wall-clock `now` and pin a fixed `now`
   in `widget-data.test.ts`.
3. **[MEDIUM] Plan 07 — fix the NeverContacted grep-gate so it can return empty.** The
   `"NeverContacted",` alternative matches seed-name fixtures in `queries.test.ts:135` AND
   `contact-status-read.test.ts:160`; the plan notes only the former. Add
   `contact-status-read.test.ts:160` to the benign-seed note or scope the pattern to route context
   (acceptance line 155 + verification line 220).
4. **[MEDIUM] Plan 01 / Plan 05 — record the Reset↔search-clear ownership.** The decided Reset
   contract clears search (`dossier:250-263`; DASHC-10, a Phase-26 requirement), but Plan 01's
   `resetDashboardView()` is "search-not-owned-here" and Plan 05's `clearSession()` is separate.
   Explicitly record that "Reset Dashboard View = `resetDashboardView()` + `clearSession()`, coordinated
   by the Phase-26 Control Surface (DASHC-10)" so the "cleared search" clause is not orphaned (or add a
   P25 reset coordinator if the owner wants it in-phase).
5. **[LOW-MEDIUM] Plan 07 Task 3(2) — name the real HomeScreen symbol.** It is
   `isNeutralDashboardSearchRow` (`HomeScreen.tsx:70` import, `:558` render ternary), not
   `dashboardSearchRowPresentation` (which lives only in `HomeScreen.test.tsx`). Correct the symbol +
   cite the `:558` render site.
6. **[LOW] Plan 06 Task 3 — extend the A4 doc sweep to `widget-linking.ts`'s own header comments**
   (lines 13, 56, and the `WidgetNavIntent` type doc), which go stale once the Home-only variant lands.
7. **[LOW] Plan 04 — reword "existing `categories` join."** `knowledge-search-read.ts` has no categories
   join today (`LIST_CONTACTS` = `SELECT id, name FROM contacts`, `:56-59`); reword to "add a
   `categories` join / select via `contacts.category_id`" so the executor is not misdirected.
