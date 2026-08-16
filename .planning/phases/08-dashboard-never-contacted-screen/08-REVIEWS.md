---
phase: 8
reviewers: [codex, claude]
reviewed_at: 2026-08-15
cycle: 1
plans_reviewed: [08-01-PLAN.md, 08-02-PLAN.md, 08-03-PLAN.md, 08-04-PLAN.md, 08-05-PLAN.md, 08-06-PLAN.md, 08-07-PLAN.md, 08-08-PLAN.md, 08-09-PLAN.md, 08-10-PLAN.md]
---

# Cross-AI Plan Review — Phase 8 (Dashboard & Never-Contacted Screen), Cycle 1

Two reviewers (codex CLI, model gpt-5.6-terra @ high effort · claude read-only subagent) reviewed all
10 plans against the actual source on disk. Both verified the reused fuel exclusions, the status
engine, the single-writer/transaction contracts, migration-001 (no migration needed), and the
nav/screen/component analogs. Findings are merged, deduplicated, most-severe first. Owner-bucket
deferrals (status-ring band tokens, favourite/category tokens, the reorder dependency gate, the
search-scope decision, snooze-count-0-until-Phase-11) were correctly NOT raised as defects.

The intentional decisions were NOT re-litigated. Two independent findings escalate one real
correctness defect to HIGH.

---

## Findings (merged, most-severe first)

### HIGH-1 — Never-contacted rows are labelled `status='stable'`, not `null`, wherever `STATUS_SQL` is selected over them
**Reviewers: codex + claude (claude escalated the blast radius)** · **08-01-PLAN.md:129,138** vs **src/db/status.ts:53-73**, **src/db/contact-status-read.ts:70-80**

`STATUS_SQL` has no NULL branch: a `last_contact IS NULL` row falls through to `ELSE 'stable'`
(`status.ts:67-73`), which is exactly why `getContactStatus` carries an explicit guard
(`contact-status-read.ts:70-80`) — documented at `status.ts:54-57`. Plan 08-01 Task 2's action text is
factually wrong: *"status/progress will be null via STATUS_SQL over NULL"* (`08-01-PLAN.md:129`) — only
`progress` is NULL; `status` is the literal `'stable'`. The defect spans **three** query paths that all
select `(${STATUS_SQL}) AS status` over never-contacted rows:
1. `listNeverContacted` — every never-contacted contact renders "Stable" on the Not-yet-contacted screen (and 08-05 passes `status null` to the card assuming the DAO delivers null, `08-05-PLAN.md:78`).
2. The favourites filter relaxed to archived-only — a never-contacted favourite gets `'stable'`.
3. The widened search — never-contacted matches get `'stable'`.
`ContactCard` handles `status: null` with a neutral a11y label (`08-04-PLAN.md:81`), so the null branch is simply never reached — never-contacted people are announced "Stable", semantically backwards.

**Fix:** In `listDashboard`, wrap the projection: `CASE WHEN c.last_contact IS NULL THEN NULL ELSE (${STATUS_SQL}) END AS status` (and the same for progress). In `listNeverContacted`, select literal `NULL AS status, NULL AS progress`. The parity/behaviour tests MUST assert `status === null` for a never-contacted row. Correct 08-01's action text so it stops misdirecting the executor toward shipping the bug.

### HIGH-2 — First-run empty state hides the never-contacted / snoozed cause-aware pointer (DASH-07 intent miss)
**Reviewers: codex (HIGH) + claude (MEDIUM) + internal plan-checker (WARNING) — CONFIRMED by all three** · **08-07-PLAN.md:80,84**, semantics gap at **08-01-PLAN.md:130**

First-run is written as `no live contacts AND no archived` (`08-07-PLAN.md:84`). A user with 0
live-contacted, 0 archived, N never-contacted (people onboarded via capture without a logged contact)
satisfies it and sees "Add your first contact" instead of DASH-07's cause-aware "{N} not yet contacted →"
(`dashboard-empty-hidden`). Correctness hinges on the **unspecified** `countLiveContacts` predicate:
`08-01-PLAN.md:130` gives an explicit predicate for `countSnoozed` but leaves `countLiveContacts`
undefined; the natural "{N} contacts"-header reading (live-contacted, excluding the separate
"Not yet contacted (N)") makes the bug fire.

**Fix:** Gate first-run on `countLiveContacts === 0 && countNeverContacted === 0 && countSnoozed === 0 && countArchived === 0` (robust regardless of the header semantic), and pin down `countLiveContacts`'s exact predicate in 08-01. Add empty-state tests for the never-contacted-only and snoozed-only combinations.

### MEDIUM-1 — Birthday parser has no strict calendar validation despite promising malformed input → null
**Reviewer: codex** · **08-02-PLAN.md:70-79** vs **src/db/migrations/001-initial.ts:68-81**

The parser distinguishes strings by length then constructs `new Date(y, month, day)`. JS silently
normalizes impossible dates (`02-30` → Mar 2), and the schema imposes no birthday format/calendar
constraint. Without a strict guard, malformed stored values do not return null as promised.

**Fix:** Strict regex + explicit month/day range validation BEFORE constructing a Date; tests for `02-30`, `13-01`, and non-leap `YYYY-02-29`. (The Feb-29 observation policy itself is sound.)

### MEDIUM-2 — `rewriteFavouriteRanks` cannot meet its own "mismatched id count" guarantee
**Reviewer: codex** · **08-03-PLAN.md:73,77-82** vs **src/db/migrations/001-initial.ts** (no rank uniqueness/favourite-only constraint)

As specified — a loop of `UPDATE ... WHERE id = ?` with no expected count and no favourite predicate — a
partial or duplicate `orderedIds` list succeeds, leaves omitted favourites at stale ranks, and can even
assign a rank to a non-favourite (or an archived contact).

**Fix:** Inside the one transaction: verify unique IDs; verify the supplied count equals the current
non-archived favourite count; update with `WHERE id = ? AND favourite_rank IS NOT NULL AND archived_at IS NULL`. Test partial, duplicate, and stale lists. (The non-reentrant-mutex handling is already correct — keep it.)

### MEDIUM-3 — Plan 08-06 edits `src/db/contact-read.ts` but does not declare it in `files_modified`
**Reviewers: codex (LOW) + claude (MEDIUM)** · **08-06-PLAN.md:8-9,98-103** vs **src/db/contact-read.ts:65-94**

Task 2 extends `getContactHeader` to SELECT + return `favourite_rank` (it currently does not,
`contact-read.ts:65-94`), but `files_modified` lists only `BirthdayBanner.tsx` + `ContactProfileScreen.tsx`.
This undermines the wave conflict-detection the workflow relies on. Blast radius is low here (no same-wave
collision; the change is additive/TS-safe), so it is a declaration/hygiene gap, not a live collision.

**Fix:** Add `src/db/contact-read.ts` to 08-06 `files_modified`; per "read every consumer," verify no other `getContactHeader` caller breaks on the widened return type.

### LOW-1 — Ambiguous bare `name` in the dashboard `ORDER BY` tiebreak
**Reviewer: claude** · **08-01-PLAN.md:136**

`listDashboard` runs `FROM contacts c LEFT JOIN categories cat` — both tables have a `name` column. The
tiebreak `name COLLATE NOCASE, c.id` resolves correctly only because `c.name` is the unaliased output
column; if the executor aliases it or selects `cat.name AS name`, the sort silently binds to the wrong
column.

**Fix:** Qualify the tiebreak as `c.name COLLATE NOCASE, c.id`.

### LOW-2 — `filter='favourites'` + a present search `term` — precedence unspecified
**Reviewer: claude** · **08-01-PLAN.md:123,128,136**

Both the favourites filter and a present term independently relax exclusions to archived-only and impose
different `ORDER BY` overrides (`favourite_rank ASC` vs the sort map); the plan never says which wins when
both are active.

**Fix:** Define an explicit precedence (recommend: an active search term wins the ordering + population, favourite-marking still shown) and add a test for the combined case.

---

## Verified sound (both reviewers agree, against source)

- **Private-data exclusion is structural, in-query, not cosmetic** — the card fuel subquery, the search snippet subquery, and the search `EXISTS` all reuse the extracted `RANKED_FUEL_EXCLUSIONS` (`off_limits` + `source!='ai'` + non-blank) and `escapeLike` + `LIKE ? ESCAPE '\'` (`fuel-read.ts:109-115,176-196`); the parity test guards drift; fuel-line parity with `getRankedFuel` holds.
- **Single-writer + non-reentrant mutex intact** — `favourites-dao` mirrors `setContactPhoto`/`clearContactPhoto` (`contacts-dao.ts:518-563`), never touches `last_contact` (the sole writer stays `recency-dao.ts:143-172`), and issues N raw UPDATEs inside one `inWriteTransaction` (`transaction.ts:11-29`).
- **Timezone rule correct** — bare `date(snooze_until)` / `date(stored)`, only `date('now','localtime')` converts now.
- **Freshness** — focus + AppState→active + pull-to-refresh + cancelled-flag guard + async-only; no `addDatabaseChangeListener` (analog `FuelSearch.tsx:50-64`).
- **`recyclingKey`** already derived from contact identity + cache-bust (`Avatar.tsx:64-80`).
- **Wave/dependency graph sound and conflict-free** — the 3 shared files (`HomeScreen.tsx`, `navigation/types.ts`, `RootNavigator.tsx`) are edited only in sequential waves; FuelSearch retired (10) only after the dashboard box ships (09).
- **The reorder dependency is correctly gated** behind the blocking-human checkpoint with a zero-dep fallback (`08-08-PLAN.md:64-74`).

---

## Consensus Summary (Cycle 1)

**Overall risk: MEDIUM–HIGH** until HIGH-1 and HIGH-2 are fixed. The architecture is right and the
privacy/transaction/timezone invariants are carefully preserved; the failures are localized correctness
gaps in SQL projection and predicate text, each fixable with small edits before execution.

- **Agreed HIGH:** the never-contacted `'stable'` mislabel (HIGH-1) and the first-run empty-state edge (HIGH-2).
- **Agreed MEDIUM/LOW:** the 08-06 `files_modified` declaration gap (MEDIUM-3).
- **Codex-unique:** birthday calendar validation (MEDIUM-1), favourite-rank-rewrite guard (MEDIUM-2).
- **Claude-unique:** ambiguous `ORDER BY name` (LOW-1), favourites+search precedence (LOW-2).

**Unresolved this cycle: 2 HIGH + 5 actionable (3 MEDIUM + 2 LOW).** → replan with `--reviews` to
incorporate all seven into the PLAN.md files, then re-review.

**CYCLE_SUMMARY: current_high=2 current_actionable=5**

---

# Cross-AI Plan Review — Phase 8, Cycle 2 (re-review after fixes)

Both reviewers re-verified the 6 revised plans against source. **All 7 Cycle-1 findings are RESOLVED**
(HIGH-1 CASE-wrap + literal-null across all three never-contacted paths; HIGH-2 four-count first-run
gate + pinned `countLiveContacts`; MEDIUM-1 strict leap-aware calendar validation; MEDIUM-2 unique +
count-equality + scoped-UPDATE favourite-rank guard, no deadlock/TOCTOU; MEDIUM-3 `contact-read.ts`
declared + all three `getContactHeader` callers verified additive-safe; LOW-1 qualified tiebreak; LOW-2
term-wins precedence consistent across 08-01/08-09). Claude rated overall risk LOW; codex found three
new second-order gaps the fixes exposed. Divergence is real reviewer value — the three below are
codex-unique and legitimate.

## New findings (Cycle 2)

### MEDIUM-4 — Empty-state precedence is undefined once Plan 09 layers in filters/search
**Reviewer: codex** · **08-07-PLAN.md:73** + **08-09-PLAN.md:76,101** vs **08-UI-SPEC.md:233**

`selectDashboardEmptyState` (08-07) decides first-run / hidden / none from the aggregate population
counts + `rowCount` only. But Plan 09 adds a category/favourites/battery filter and a live search term,
each of which can legitimately yield zero rows while the populations are non-empty. With no precedence
rule, a zero-result *filter* or *search* would fall through to the default hidden-population copy
("Everyone's tucked away" / "{N} not yet contacted →") instead of the filter/search-specific empty state
the UI-SPEC intends. **Fix:** define an explicit empty-state precedence — an active search term's empty
state, then an active filter's empty state, then (only for the unfiltered default list) the
population-count helper. Thread the active filter/term into the empty-state decision (08-07 helper input
or a 08-09 wrapper) and test a zero-result category filter with a non-empty population.

### MEDIUM-5 — `DashboardRow.status` type contradicts the HIGH-1 fix
**Reviewer: codex** · **08-01-PLAN.md:127,132** vs **src/db/contact-status-read.ts:19** and **08-04-PLAN.md:78**

The HIGH-1 fix makes `status`/`progress` NULL for never-contacted rows, but the `DashboardRow` type is
described as `status (ProfileStatus)` — and `ProfileStatus` excludes null. The card already expects
`ProfileStatus | null` (08-04-PLAN.md:78). Leaving the row type non-null forces a cast or a `tsc`
failure. **Fix:** specify `DashboardRow.status: ProfileStatus | null` and `progress: number | null` in
08-01.

### MEDIUM-6 — A dual name-AND-fuel match renders a fuel snippet against the stated contract
**Reviewer: codex** · **08-01-PLAN.md:129,140** vs **src/db/fuel-read.ts:176**

The card contract says a *name* match has `snippet = null`, but the prescribed snippet subquery mirrors
`searchFuel`, whose snippet runs whenever the fuel matches — so a contact matching BOTH name and fuel
gets a snippet, contradicting the stated contract. **Fix:** either add a name-match guard so a
name-only intent shows no snippet, OR update the contract to "snippet renders whenever the fuel text
matches, regardless of a concurrent name match" and state it explicitly. Add a test for a both-fields
match. (Low user impact; resolve the contract inconsistency.)

## Advisory (Cycle 2, LOW — claude; noted, not blocking)
- **A-1** — the `sort='status'` ORDER BY expression for now-NULL-status rows is left implicit; correct
  iff the executor models `STATUS_SCAN`'s `ORDER BY progress DESC` (NULLs last), which the plan cites.
  Pin it at execution/code-review, not a plan defect.
- **A-2** — an empty `orderedIds` in `rewriteFavouriteRanks` is a silent no-op (0===0 passes both
  guards, zero UPDATEs commit). Harmless and unreachable from the drag UI; acceptable as-is.

## Consensus Summary (Cycle 2)
**Overall risk: LOW–MEDIUM.** The seven Cycle-1 issues are genuinely and completely corrected against
verified source; no fix introduced a HIGH regression. Three codex-unique second-order gaps remain
(MEDIUM-4 empty-state precedence is the substantive one; MEDIUM-5 type consistency and MEDIUM-6 snippet
contract are cheap consistency fixes). → one more `--reviews` pass to incorporate MEDIUM-4/5/6 (and pin
A-1/A-2), then a final re-review.

**CYCLE_SUMMARY: current_high=0 current_actionable=3**
