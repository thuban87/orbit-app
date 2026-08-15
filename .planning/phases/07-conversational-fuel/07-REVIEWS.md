---
phase: 7
reviewers: [codex, claude]
reviewed_at: 2026-08-15
cycle: 1
plans_reviewed: [07-01-PLAN.md, 07-02-PLAN.md, 07-03-PLAN.md, 07-04-PLAN.md]
---

# Cross-AI Plan Review — Phase 7 (Conversational Fuel), Cycle 1

Two reviewers (codex CLI + claude read-only subagent) verified all 4 plans against the
actual spine on disk. Findings are labelled by reviewer and severity, most-severe first.
Locked items were NOT raised: confirm=flip-source-to-manual (no migration), minimal
FuelSearch now / dashboard box deferred to Phase 8, FTS5 deferred to v2, per-item immediate
writes (not diff-on-save).

---

## Findings (merged, most-severe first)

### HIGH-1 — `searchFuel` does not exclude unconfirmed `source='ai'` (privacy/posture inconsistency)
**Reviewers: codex + claude** · **07-04-PLAN.md:80-87** (contrast getRankedFuel **07-02-PLAN.md:118**)

`getRankedFuel` excludes both `off_limits` AND `source='ai'` by SQL WHERE (07-02-PLAN.md:118),
but `searchFuel`'s behaviour + SQL (07-04-PLAN.md:80-87) exclude only `kind != 'off_limits'` —
its snippet subquery and `EXISTS` predicate never filter `source`, and `FuelSearchResult` carries
no `source`. An unconfirmed AI suggestion's text therefore surfaces as an ordinary cross-contact
search snippet with NO "Suggested by AI" treatment (that badge lives only in the editor per
07-03-PLAN.md:105), reading as a user-authored note. This is internally inconsistent with the
shared-choke-point invariant ("exclude off_limits AND unconfirmed source='ai'") and with FUEL-06.
Note the ambiguity: the task's *search* bullet and 07-PATTERNS.md:88-95 scope search to
`off_limits + archived` only, while 07-PATTERNS.md:86 says the glanceable read should ALSO exclude
`source='ai'` — the plans resolve this conflict silently by omission. Because it is a
disclosure/privacy-posture question (owner's bucket), it should be decided explicitly, not left
to omission.

**Fix:** Either (preferred, consistent with the choke-point) add `AND f.source != 'ai'` to BOTH
the snippet subquery and the `EXISTS` predicate in `searchFuel`, plus an AI-only search test
proving no match and no snippet; OR, if search is intentionally allowed to surface unconfirmed AI,
state that decision and rationale in 07-04-PLAN.md and reconcile it against 07-PATTERNS.md:86.

### HIGH-2 — `LIKE` wildcard escaping is missing; the plan's own literal-`%` test cannot pass
**Reviewers: codex + claude** · **07-04-PLAN.md:83, :87, :89** · **07-PATTERNS.md:95**

07-04-PLAN.md:83/87 claims `?`-binding makes `%` and `_` literal — that is false. Binding prevents
SQL *injection*; it does NOT stop SQLite's `LIKE` from interpreting `%`/`_` *inside the bound
value* as wildcards. With `like = '%' + term + '%'`, a search for `50%` binds `%50%%` and matches
any row starting `50…`. Yet the acceptance test at 07-04-PLAN.md:89 asserts "a term with a literal
'%' matches only rows actually containing '%'" — which plain binding cannot deliver, so an executor
following the plan literally either ships an over-matching search or (worse) weakens the test.
07-04-PLAN.md:87 marks `ESCAPE` "optional"; 07-PATTERNS.md:95 says to consider it.

**Fix:** Make `ESCAPE` mandatory: in JS escape `\`, `%`, `_` in `term`, then use `LIKE ? ESCAPE '\'`
in all predicates (name, snippet subquery, EXISTS). Test literal `%`, `_`, and `\`. Flip
07-04-PLAN.md:87 from "optional" to required so it agrees with the test at :89.

### MEDIUM-3 — a blank/NULL-text high-priority row wins ranking and erases the promoted line
**Reviewer: codex** (claude concurs) · **07-02-PLAN.md:112, :148** · schema **001-initial.ts:173-176**

`fuel.text` is nullable (001-initial.ts:173-176) and Plan 01 stores it NULL when blank
(07-01-PLAN.md:91-94). `getRankedFuel` ranks purely by kind/date (07-02-PLAN.md:112) and
`RankedFuelLine` renders `rankedFuel[0]?.text` (07-02-PLAN.md:148), rendering nothing when empty.
So a newer high-priority row with NULL/blank text becomes `rows[0]` and blanks out the promoted
line even though lower-priority rows carry real text.

**Fix:** Exclude blank text from the ranked projection — add `AND NULLIF(TRIM(text), '') IS NOT NULL`
to `getRankedFuel` (or require non-blank text before persistence). Add a test that a blank
high-priority row cannot suppress a usable line.

### MEDIUM-4 — the FuelEditor draft/commit contract is underspecified for new/unsaved rows
**Reviewer: codex** (claude concurs) · **07-01-PLAN.md:156-158** · cf. **07-02-PLAN.md:146**

Plan 01 specifies FuelEditor as CONTROLLED with only persisted `FuelItem[]` + id-based callbacks,
and requires every mutation to write then `await load()` (07-01-PLAN.md:156-158). But it also says
"+ Add fuel appends a new row" and 07-02-PLAN.md:146 says a brand-new unsaved row omits age (no
`created_at` yet) — implying a not-yet-persisted draft row with editable fields. A "controlled, no
DB, renders persisted rows only" component has no owner for that draft state or for per-keystroke
typing. This is not the locked immediate-write-vs-diff decision; it is an unspecified commit
boundary. It also interacts with MEDIUM-3: if "+ Add" instead persists a blank row immediately, that
blank row tops the ranking.

**Fix (does not reopen the locked immediate-write decision):** Specify the draft owner and commit
boundary for a new/unsaved row explicitly — e.g. the parent owns a single optimistic draft row,
`addFuel` fires on first non-blank commit (blur), edits persist per-item on blur, and `load()` runs
after each committed add/edit/delete/confirm (not per keystroke).

### MEDIUM-5 — the SQL/comparator parity test is underspecified and can false-fail
**Reviewers: codex + claude** · **07-02-PLAN.md:120** (cf. compareFuel **:85**, getRankedFuel **:118**)

`compareFuel` knows only kind/date/id (07-02-PLAN.md:85); `getRankedFuel` removes `off_limits` and
`source='ai'` before ordering (07-02-PLAN.md:118). The parity test (07-02-PLAN.md:120) sorts a copy
of the "mixed fixture" with `compareFuel` and compares id order to `getRankedFuel` output — but if
the fixture contains excluded rows, the two produce different-length id lists and disagree
(spurious red), tempting the executor to weaken the assertion.

**Fix:** Compare `getRankedFuel` output to an `eligibleFixture` (the fixture with `off_limits` and
`source='ai'` removed in test setup) sorted by `compareFuel`. Keep the SQL-only exclusion sweeps
(off_limits absence, ai absence) as separate tests.

### LOW-6 — the "only place fuel is read" module header is factually too broad (conflicts with purge)
**Reviewers: codex + claude** · **07-01-PLAN.md:131, :139** · **purge-dao.ts:105, :188**

Plan 01 wants a fuel-read.ts header asserting it is "the ONLY place fuel is read" and that no
`getAllAsync` over fuel exists elsewhere. `purge-dao` already reads fuel for its impact count
(purge-dao.ts:105) and deletes it in the established fan-out (purge-dao.ts:188). The claim as
written is false and could invite someone to "consolidate" purge's read into fuel-read (a duplicate
purge path).

**Fix:** Scope the header to "the only user-facing fuel-item / projection read path," explicitly
exempting purge/maintenance reads.

### LOW-7 (optional / not blocking) — stale `Contact.fuel?: string[]` remains in `src/types.ts`
**Reviewer: claude** · **src/types.ts:87-88**

`src/types.ts:88` still declares `fuel?: string[]` ("Conversational fuel content (cached)") — a
plugin-era model that contradicts the new structured `FuelItem` (kind/label/text/url) rows. It is
dead (no reader; `impact.fuel` in purge-dao is a different type). The plans correctly do NOT wire
to it (codex confirmed under "Verified sound"), so the "avoid dead surfaces" invariant is satisfied
and this is not a required plan change. Optional cleanup: Plan 01 (owner of the fuel data model)
could delete the stale field to prevent future drift.

---

## Verified sound (both reviewers agree)

- **No new migration.** The full fuel schema shipped in migration 1 (001-initial.ts:167-179); all
  4 plans correctly leave it untouched. Confirm-flip is a plain `UPDATE source='manual'`.
- **Writer split is correct.** `*Core` (non-mutexed) + one public `inWriteTransaction` wrapper
  mirrors events-dao.ts:62-93 / transaction.ts:11-29; cores compose inside one outer transaction,
  never nesting the non-reentrant mutex. assertOneChange scoped by (id, contact_id) matches
  contact-links-dao.ts:62-74/116-146.
- **Rank order is deterministic:** kind CASE (from the single FUEL_KIND_PRIORITY tunable) →
  `created_at DESC` → `id DESC`; priority `recent>gift>topic>fact` matches dossier 03-fuel.md:240.
  RANK_CASE built only from a closed code constant (no injection surface); contact_id sole bound value.
- **off_limits exclusion** holds on getRankedFuel (SQL WHERE) and searchFuel; listFuelForEditor is
  the single intended off_limits-surfacing read (the editor).
- **Wave 3 has no files_modified overlap:** 07-03 owns fuel-dao/FuelEditor/ContactProfileScreen;
  07-04 owns fuel-read/search/navigation/settings. Dependencies (W1→W2→W3) are correct.
- **Local wall-clock** throughout: fuel-age copies gravity-logic.ts:82-98 parseLocalMs;
  ContactProfileScreen already uses `localDateTime()` (never toISOString).
- **Zero net-new theme tokens** needed: surface/surfaceElevated/accent/textPrimary/textSecondary/
  border/borderStrong all exist in theme-types.ts.
- **Purge not duplicated:** no plan touches purge-dao (fuel deletion already at :188).
- **Plans avoid the stale `Contact.fuel?: string[]` and the old AiService `{{Conversational Fuel}}`
  template** (neither is wired).

---

## Consensus Summary

Both reviewers independently reached "revise before execution," and both flagged the two HIGH items
against Plan 04 (the LIKE-escaping false claim and the searchFuel exclusion gap). The correctness
core (no-migration, writer split, ranking parity intent, off_limits exclusion, wave isolation,
local wall-clock) is sound and verified against the spine. The actionable gaps cluster in the
search plan (07-04) and the ranking/editor plan (07-02): search must escape LIKE wildcards and
decide its `source='ai'` posture; ranking must not let a blank-text row erase the promoted line and
must fix the parity fixture; the editor's new-row draft/commit boundary needs to be pinned down.

### Agreed concerns (2+ reviewers)
- HIGH-1 searchFuel `source='ai'` exclusion gap.
- HIGH-2 LIKE wildcard escaping missing / test cannot pass.
- MEDIUM-5 parity test fixture must exclude off_limits + ai.
- LOW-6 "only place fuel is read" header conflicts with purge.

### Divergent views
- Severity of the searchFuel `source='ai'` gap: codex rates HIGH outright; claude concurs it is
  actionable-HIGH but frames it as an owner privacy-posture decision (the plans + 07-PATTERNS are
  internally inconsistent on whether search is an "ai-hiding" surface), so it should be resolved by
  explicit decision, not silently.
