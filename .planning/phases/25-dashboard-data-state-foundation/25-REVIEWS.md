---
phase: 25
reviewers: [codex, claude]
reviewed_at: 2026-09-04
plans_reviewed: [25-01-PLAN.md, 25-02-PLAN.md, 25-03-PLAN.md, 25-04-PLAN.md, 25-05-PLAN.md, 25-06-PLAN.md, 25-07-PLAN.md]
review_cycle: 6 (confirming — cycle-5 single remaining HIGH "Birthdays clock seam" fixed in commit 9158bcd)
models:
  codex: "gpt-5.6-terra (reasoning=low)"
  claude: "claude (read-only subagent)"
model_sources:
  codex: "banner"
  claude: "subagent"
---

# Cross-AI Plan Review — Phase 25

## Consensus Summary

This was a **confirming re-review (cycle 6)**. The convergence loop had already driven Phase 25 to 0 HIGH / 0 actionable at cycle 5, with a single remaining HIGH — the Birthdays clock seam in Plan 02 — fixed in commit `9158bcd`. Both reviewers (Codex `gpt-5.6-terra`, and a read-only Claude subagent lane) independently verified the fix against the code on disk, and the orchestrator verified it directly as well.

**The Birthdays clock-seam HIGH is RESOLVED (unanimous).** Plan 02 now derives `todayLocal = new Date(y, m-1, d)` from the injected read-scoped `now` string by LOCAL parts and passes that `Date` to `daysUntilBirthday(stored, todayLocal)`. This type-checks against the real parser signature `daysUntilBirthday(stored: string | null, today: Date)` (`src/logic/birthday-logic.ts:165`), while the shared `now` correctly stays a `string` for `computeContactGravity(inputs, now: string)` (`src/services/impact.ts:88`), which Plan 03 consumes unchanged. The plan forbids `new Date(now)` (UTC/ISO parse → the CLAUDE.md-banned evening off-by-one) and every wall-clock read inside the read layer, permitting exactly the node-pure local-parts constructor. The "no Date in read" wording is relaxed to forbid only wall-clock/UTC-parse.

**Zero HIGH concerns across all seven plans.** Owner decisions D-12, D-13, D-14 are implemented as authoritative and are NOT re-litigated. No change deletes, weakens, or inverts a recorded ADR / HANDOFF / CONTEXT decision — no owner escalation is required.

The one net-new finding this cycle is a **MEDIUM raised by Codex only** (not by Claude): the snooze predicates keep SQLite's own `date('now','localtime')` clock while Birthdays and Gravity use the injected `now`, leaving a day-boundary determinism/testability seam. See Divergent Views.

### Agreed Strengths
- **Birthdays seam fix is correct and off-by-one-safe** (both). Type-correct against `birthday-logic.ts:165` (`today: Date`) and Gravity's `impact.ts:88` (`now: string`); explicitly bans `new Date(now)` and wall-clock reads.
- **Plans are unusually well source-grounded** (both). Migration head verified on disk (`src/db/migrations/` tops at `018-*`, `database.ts:53` `TARGET_VERSION = 18` → head+1 = 019); Plan 04's `contact_methods` sourcing (migration `009-contact-method-normalization.ts:229-230`, phone/email moved off `contacts`); Plan 06's unconditional `routes[1]` deref hazard (`widget-quick-action-guard.ts:32`, `widget-linking.ts:301`); Plan 07's real Unbound leak in the legacy term branch (`dashboard-read.ts:234-238` filters only `archived_at`, omits `DASHBOARD_BOUND_WHERE`).
- **D-12 snooze relocation applied consistently** (both): the snooze-suppression clause moves out of the Active/Default predicate into the Needs-Attention filter; a currently-snoozed contact stays in Active and All Contacts and additionally surfaces in the Snoozed population. The ADR-011 segregation clauses (`archived_at IS NULL`, `tracking_enabled = 1`, `last_contact IS NOT NULL`) stay intact.
- **Additive/compat seams avoid cross-wave breakage** (both): Plan 05's empty-state gate keeps the legacy filter-enum input compiling (no HomeScreen edit in Wave 2); Plan 04 extends the scorer rather than replacing `scoreQuery`/`rankCandidates`; Plan 01 keeps the legacy `BASE_WHERE` byte-unchanged.

### Agreed Concerns
- None at HIGH severity. Both reviewers return **0 HIGH**. Claude returns **0 actionable**; Codex returns **1 MEDIUM** (below).

### Divergent Views
- **Snooze-clock determinism (Codex MEDIUM; Claude did not raise).** Codex flags that Plan 02's Snoozed population (`25-02-PLAN.md:91`) and Plan 03's Needs-Attention suppression (`25-03-PLAN.md:29, :102, :115`) specify `date(c.snooze_until) <= date('now','localtime')` — SQLite's own clock — while Birthdays and Gravity are driven by the injected read-scoped `now`. A read begun at a local-day boundary can therefore evaluate its birthday/gravity universe against one moment but snooze membership against SQLite's later clock, and a fixed-`now` test cannot deterministically pin the snooze day-boundary. The orchestrator verified this is factually accurate against the plan text. Codex rates it MEDIUM and explicitly states "This does not negate D-12." Claude, reviewing the same code, treated the snooze clause as a faithful implementation of D-12's verbatim text and returned 0 actionable. **Resolution note:** the `date('now','localtime')` string is quoted verbatim in owner decision D-12, so the semantics are authoritative and correctly implemented; threading the injected `now` into the snooze predicate (as a `?`-bound date) is a determinism refinement that preserves those semantics — it is NOT a reversal of D-12. It is currently in neither plan nor explicitly deferred, so it is carried as the sole actionable item this cycle (a small plan edit — either thread `now` in, or add an explicit note scoping the determinism claim and accepting the SQL-clock snooze seam per D-12's literal text).

---

## Codex Review

## Summary

The seven plans are implementation-ready overall. The cycle-6 Birthdays clock correction is sound: Plan 02 now derives a local-midnight `Date` from the injected local timestamp before calling the birthday parser, matching the real API and avoiding UTC parsing. I found no remaining HIGH concerns. One MEDIUM determinism seam remains around SQL's independent "now" clock for snooze predicates.

## Strengths

- **Plan 01** correctly treats migration 019 as head+1: the repository is currently at migration 018 and `TARGET_VERSION = 18` in `src/db/database.ts:42`, `src/db/database.ts:53`. It also identifies the real restore-test private migration chain at `src/backup/restore-apply.test.ts:62` and its target of 18 at `restore-apply.test.ts:66`.
- **Plan 02's Birthdays seam is resolved.** It now mandates `daysUntilBirthday(stored, todayLocal)` and a local-parts `new Date(y, m - 1, d)` conversion in `25-02-PLAN.md:133`. This is compatible with `daysUntilBirthday(..., today: Date)` in `src/logic/birthday-logic.ts:165`, whose implementation deliberately uses local date parts and local midnights at `birthday-logic.ts:186`. It expressly forbids `new Date(now)`, wall-clock reads, and ISO parsing in the read layer.
- The shared string `now` remains correct for Gravity: `computeContactGravity(inputs, now: string)` is defined in `src/services/impact.ts:88`, matching Plans 02–03's handoff.
- **Plans 02–03** correctly preserve D-12's split. The legacy predicate currently includes the snooze suppression at `src/db/dashboard-read.ts:155`, so creating a new segregation-only predicate rather than mutating it is the safe compatibility approach. The proposed explicit never-contacted projection also mirrors the existing null-status guard at `dashboard-read.ts:271`.
- **Plan 04** is accurately grounded in the current corpus gaps. The corpus is presently global and unscoped at `src/db/knowledge-search-read.ts:116`, relationships currently omit type/note at `knowledge-search-read.ts:61`, and memory entries currently collapse provenance at `knowledge-search-read.ts:101`. Its plan to extend rather than replace the scorer is appropriate because current ranking excludes partial term matches at `src/services/knowledge-search.ts:111`.
- Plan 04 correctly uses `contact_methods` for phone/email, not `contacts`: the normalized table's actual fields are at `src/db/migrations/009-contact-method-normalization.ts:226`.
- **Plan 05** preserves the existing empty-state compatibility seam: the current legacy input requires `activeFilter` and its current caller model is defined at `src/logic/dashboard-empty-logic.ts:51`. Making population inputs additive prevents a Wave-2 compile break.
- **Plan 06** correctly traces the route-removal hazard. `WidgetNavIntent` currently only permits two-route, index-1 resets at `src/navigation/widget-linking.ts:61`, while both the gate and guard unconditionally read `routes[1]` at `widget-linking.ts:301` and `src/services/widget/widget-quick-action-guard.ts:32`. The planned home-only union and early branch are necessary.
- **Plan 07** correctly targets the actual legacy Unbound leak: the term branch currently limits only `archived_at` at `dashboard-read.ts:230`, whereas the durable Bound predicate is `dashboard-read.ts:139`. It also correctly retains `countNeverContacted`, which is still a real DAO surface at `dashboard-read.ts:346`.

## Concerns

- **MEDIUM — snooze time is still not tied to the injected read clock.** Plan 02 specifies the Snoozed predicate with `date('now','localtime')` in `25-02-PLAN.md:91`, and Plan 03 repeats that SQL-clock predicate for Needs Attention. Meanwhile Birthdays and Gravity use the injected `now`. A read started at a local-day boundary can therefore evaluate its birthday/gravity universe using one moment but snooze membership using SQLite's later clock; fixed-`now` tests also cannot deterministically test the snooze boundary. This does not negate D-12, but it weakens the stated single-read determinism.

## Suggestions

- Thread the date component of the already-injected `now` into the Snoozed and Needs-Attention SQL predicates as a `?`-bound value, rather than using SQLite `date('now','localtime')`. Keep all population and filter semantics unchanged; this only aligns clock ownership and makes boundary tests deterministic.
- Add one explicit regression test using a fixed `now` around midnight that proves the Birthday and Snoozed decisions use the same local date. This complements the newly correct local-parts Birthday conversion.

## Risk Assessment

**LOW overall, with one MEDIUM implementation risk.** The plans are unusually well traced to real code, migrations, tests, and route consumers. The prior compile-blocking Birthdays issue is resolved by the committed Plan 02 change. The remaining concern is contained to clock consistency at day boundaries and has a straightforward, non-architectural remedy.

---

## Claude Review

## Summary

The Birthdays clock-seam HIGH is **RESOLVED**. Plan 02 (25-02-PLAN.md, fixed in commit 9158bcd) now derives `todayLocal` at the read seam from the injected read-scoped `now` string by LOCAL parts — `const [y,m,d] = now.slice(0,10).split('-').map(Number); const todayLocal = new Date(y, m-1, d)` — and passes that `Date` to `daysUntilBirthday(stored, todayLocal)`, which on disk (`src/logic/birthday-logic.ts:165-168`) takes `today: Date`. The shared `now` correctly stays a `string` for `computeContactGravity(inputs, now: string)` (`src/services/impact.ts:88-90`), which Plan 03 consumes unchanged. The plan explicitly forbids `new Date(now)` (UTC/ISO parse → the banned evening off-by-one) and every wall-clock read inside the read layer, while permitting exactly the node-pure local-parts constructor. This is type-correct and off-by-one-safe. Across a full re-review of all seven plans against the code on disk, I found **0 HIGH, 0 actionable MEDIUM, 3 LOW** (all cosmetic/advisory). Overall risk: **LOW**.

## Birthdays Clock Seam — Confirmation

**Verdict: RESOLVED.**

Evidence traced against disk:

- **Parser signature (the type constraint that makes the fix load-bearing).** `src/logic/birthday-logic.ts:165-168`: `export function daysUntilBirthday(stored: string | null, today: Date): number | null`. The second arg is a `Date`. Passing the `now` string would fail `tsc`; passing `todayLocal: Date` type-checks. Confirmed.
- **Gravity keeps the string `now`.** `src/services/impact.ts:88-100`: `computeContactGravity(inputs: ImpactInputs, now: string)` forwards `now` (a string) to `computeGravity(...)`. Plan 03 (25-03-PLAN.md:92, :167, :175) consumes this SAME `now` parameter for the Gravity pass without re-declaring it. So one read-scoped `now: string` serves both Birthdays (converted to a Date locally) and Gravity (used raw). Confirmed — no conflict.
- **Plan 02 text now correct in three places:** must-have truth (`25-02-PLAN.md:28`), `read_first` (`:133`, stating the real `today: Date` signature and naming `new Date(y, m-1, d)` as the ONLY permitted Date construction while forbidding wall-clock + UTC/ISO parse), and `action` (`:142`, the local-parts derivation).
- **"No Date in read" wording now permits the safe constructor.** The relaxed wording forbids only wall-clock reads and UTC/ISO parsing, explicitly allowing `new Date(y, m-1, d)`. The correct and only off-by-one-safe route. Confirmed.
- **Candidate source is null-safe.** `listBirthdayCandidates` (`src/db/dashboard-read.ts:391-399`) filters `birthday IS NOT NULL` and types `BirthdayCandidate.birthday: string` (`:108-112`).

Minor, non-blocking: `25-02-PLAN.md:142` writes the parser's first arg as `stored: string` where disk is `stored: string | null`. Cosmetic — the executor reads the real file; candidates are non-null anyway. (LOW-1.)

## Per-Plan Notes (Plans 01–07)

- **Plan 01 (tracer — migration 019, DAO, store, Active read).** Migration head verified: `src/db/migrations/` tops at `018-custom-field-scope-history.ts`, `database.ts:53` `TARGET_VERSION = 18` → head+1 = 019 (Task 1 re-checks at execute time and HALTs if drifted). One-way-door checkpoint on the irreversible schema step is appropriate. Active predicate = the three ADR-011 clauses only, snooze relocated per D-12, matching `dashboard-read.ts:155-158` minus snooze with the legacy constant byte-unchanged. The `restore-apply.test.ts` hard-coded-chain fix is a real, correctly-identified breakage.
- **Plan 02 (populations + Birthdays).** Focus item RESOLVED. OR-union single-WHERE-with-match-reasons (not UNION) avoids discarding reasons; empty-birthday-set → constant-false fragment avoids invalid `IN ()`; Favourites in Default order, no `favourite_rank` in ORDER BY (ADR-075). D-12 snooze relocation consistent.
- **Plan 03 (filters + sort + Gravity).** Gravity as a reversible post-query TS pass (no column, no SQL WHERE) is the correct reading of the owner-bucket one-way-door; recorded as an `<assumption>`. Needs-Attention is the new home of the snooze-suppression clause (D-12). The fully-filtered (post-Gravity) id set as the search-scope + empty-state-rowCount contract is well specified. Consumes Plan 02's `now` without re-declaring it (:92).
- **Plan 04 (scoped search).** `knowledge-search-read.ts:56-59` `LIST_CONTACTS` selects only `id AS contactId, name`; migration 009 moved phone/email to `contact_methods` (`009-*:229-230`), so a separate `contact_methods` scoped read (not `SELECT phone,email FROM contacts`) is correct on v18+. LEFT-JOIN-not-INNER category-label instruction correct (INNER would drop uncategorized entries). No FTS5/index (ADR-031/D-08) with a negative grep gate. Additive scorer extension leaves existing callers untouched.
- **Plan 05 (ephemeral session store + empty-state gate).** In-memory Zustand (no persist/AsyncStorage) matches dossier §M durable/ephemeral split. ADDITIVE empty-state-gate signature change keeps `HomeScreen.tsx:308` compiling in Wave 2 — deliberate Plan-05/Plan-07 contention avoidance.
- **Plan 06 (retire ranked Favourites).** Cycle-2 HIGH fix verified necessary: `widget-quick-action-guard.ts:32-33` reads `intent.routes[1]` UNCONDITIONALLY then derefs `target.name`; `widget-linking.ts` reads `routes[1]` at `:301`/`:326`. New `index:0` Home-only `WidgetNavIntent` variant + branches are required. `favourite_rank` column KEPT (D-04 trip-wire) with picker/sun/merge/capture reads intact. Doc-comment sweep of `rewriteFavouriteRanks` refs (`ring-seq-dao.ts:4`/`.test.ts:6`) so the grep gate passes.
- **Plan 07 (banner/NeverContacted/Unbound retirements).** Implements D-13 (legacy Home term branch bound-only) and D-14 (NeverContacted retirement now, chip in Phase 26) — AUTHORITATIVE; the plan implements, does not re-escalate. `listDashboard` term Branch 1 (`dashboard-read.ts:234-238`) filters only `archived_at` and omits `DASHBOARD_BOUND_WHERE` → today Unbound leaks; the D-13 fix (add `AND ${DASHBOARD_BOUND_WHERE}` to Branch 1 only, `BASE_WHERE` byte-unchanged) is correct and minimal. `countNeverContacted` and `include_unbound_never_contacted` column + portable key KEPT (Phase 36 coordinates removal — D-05). Banner-removal coverage gap recorded (`status: flagged-unverified`) per D-06, not silently dropped.

## Concerns

- **LOW-1 — Cosmetic signature drift in Plan 02 prose.** `25-02-PLAN.md:142` writes `daysUntilBirthday(stored: string, today: Date)` where disk (`birthday-logic.ts:165`) is `stored: string | null`. No functional impact (candidates are non-null; executor reads the real file). Fix inline if any edit pass touches that line.
- **LOW-2 — N+1 in the scoped corpus read is acknowledged but only Pixel-gated.** Plan 04 (`25-04-PLAN.md:224`) notes `getValuesForContact` runs per-contact (`knowledge-search-read.ts:157`) and defers the perf verdict to an on-device Pixel gate. Correct handling for this repo (perf assessable only on the physical device), and the eligible-id scope bounds N — but a real perf risk carried into the render phases. Advisory; no Phase 25 code change owed.
- **LOW-3 — Empty-state `rowCount` seam depends on caller discipline across plans.** When Gravity is active, the count feeding `selectDashboardEmptyState` must be `rows.length` of post-Gravity survivors, not a SQL `count()` (Plans 03:91, 05:113). Well-documented cross-plan contract, but the wiring lands in the render phases (26–28), so Phase 25 cannot fully test it end-to-end. Flagging so the render-phase reviewer carries the contract forward.

No HIGH. No actionable MEDIUM.

## Suggestions

- When executing Plan 02, correct `stored: string` → `stored: string | null` prose (LOW-1) opportunistically; no separate pass needed.
- Ensure the Plan 07 SUMMARY records the D-06 birthday coverage gap and the D-14/D-13 owner-accepted transient gaps (required via `status: flagged-unverified` / SUMMARY notes) — the audit-trail obligations that keep the retirements from reading as silent drops at KB extraction.
- Render-phase reviewers should carry forward three recorded-here-wired-there contracts: the post-Gravity fully-filtered id set as the search scope AND the empty-state rowCount source, and the `orderedEligibleIds` tie-break sequence for `searchDashboard`.

## Risk Assessment

**LOW.** The one outstanding HIGH (Birthdays clock seam) is resolved with a type-correct, off-by-one-safe fix verified against the parser and Gravity signatures on disk. Remaining findings are cosmetic (LOW-1) or advisory contracts that correctly defer verification to the render phases / on-device gate (LOW-2, LOW-3). Owner decisions D-12/D-13/D-14 are implemented as authoritative, not re-litigated. No change deletes, weakens, or inverts a recorded ADR/HANDOFF/CONTEXT decision. No owner escalation required.
