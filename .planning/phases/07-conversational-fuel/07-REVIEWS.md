---
phase: 7
reviewers: [codex, claude]
reviewed_at: 2026-08-15
cycle: 3
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

---

# Cross-AI Plan Review — Phase 7, Cycle 2

`cycle: 2` · `reviewed_at: 2026-08-15` · reviewers: **codex** (external CLI) + **claude** (read-only).
Revision addressing cycle-1's 2 HIGH + 3 MEDIUM + 1 LOW re-reviewed against the actual spine on
disk (`001-initial.ts`, `events-dao.ts`, `contact-links-dao.ts`, `transaction.ts`, `purge-dao.ts`,
`gravity-logic.ts`, `queries.ts`, `LinksEditor.tsx`, `ContactProfileScreen.tsx`).

## Cycle-1 items — disposition (both reviewers concur)

| # | Cycle-1 finding | Status | Evidence |
|---|-----------------|--------|----------|
| HIGH-1 | searchFuel must exclude unconfirmed `source='ai'` | **RESOLVED** | 07-04-PLAN.md:80,82,88,90 — `source != 'ai'` in the snippet subquery AND the `EXISTS` predicate; ai-never-matches test (manual/user/share DO match); threat T-07-02 (:147) restated. Coherence decision recorded in the header (:88). |
| HIGH-2 | `LIKE` wildcard escaping missing; test can't pass | **RESOLVED** | 07-04-PLAN.md:84 — JS-escape `\`→`\\`, `%`→`\%`, `_`→`\_` (backslash first); mandatory `LIKE ? ESCAPE '\'` on all three predicates (:88); literal-`%`/`_` tests (:90); the false "?-binding makes %/_ literal" claim is gone (:84,:146 now say binding does NOT make them literal). |
| MED-3 | blank/NULL-text row wins ranking, blanks the strip | **RESOLVED** | 07-02-PLAN.md:112,119 — `AND NULLIF(TRIM(text),'') IS NOT NULL` on the ranked projection ONLY; blank-text-skip test (:121d); `listFuelForEditor` still returns all rows. Matches nullable schema 001-initial.ts:173-176. |
| MED-4 | FuelEditor draft/commit boundary underspecified | **RESOLVED (new-row half)** | 07-01-PLAN.md:158 — single transient draft; `onAdd` only on explicit Add with non-blank text; no blank-row insert; immediate-write decision not reopened. *(The existing-ROW edit half is now surfaced as a new C2 finding below.)* |
| MED-5 | parity test fixture can false-fail | **RESOLVED** | 07-02-PLAN.md:121e — parity compares `getRankedFuel` vs `compareFuel` over an ELIGIBLE-only fixture (off_limits/ai/blank removed in setup); exclusion sweeps kept as separate tests. |
| LOW-6 | "only place fuel is read" header conflicts with purge | **RESOLVED** | 07-01-PLAN.md:131,139 — reworded to "the ONLY user-facing / projection fuel read path"; purge-dao maintenance read/delete explicitly EXEMPT. Verified against real purge-dao.ts:103-106 (count) and :184-188 (delete fan-out). |

All six cycle-1 findings — including both HIGHs — are genuinely resolved in the plan text and
verified against source. No cycle-1 item is STILL-OPEN.

## New findings (Cycle 2)

### MEDIUM (codex; claude concurs) — existing-row edit has no viable state owner
**07-01-PLAN.md:156-159** · analog **LinksEditor.tsx:132-149**

The cycle-1 MED-4 fix pinned the NEW-row draft but left the EXISTING-row edit path
self-contradictory: 07-01:156-158 calls the editor "controlled … fully controlled from the loaded
list (no per-row local mirror)" AND commits existing-row edits "on blur/save via onEdit(id, patch)".
The controlled analog LinksEditor (`value={link.url}` + `onChangeText → onUpdate(index,…)`,
LinksEditor.tsx:132-149) works only because the parent mutates a per-row draft array **every
keystroke** and defers the DB write to one Save (diff-on-save). Fuel's locked model is the opposite
— per-item **immediate** writes — so `value={row.text}` bound to the loaded list with commit-on-blur
and no per-row mirror is not implementable: the input freezes at `row.text` until `load()` runs, so
keystrokes never appear (or the executor silently reverts to per-keystroke writes). This is NOT the
locked immediate-write decision and NOT the new-row draft — it is the transient edit-text owner
during typing. **Fix:** specify existing-row inputs as uncontrolled (`defaultValue={row.text}` +
`onEndEditing/onBlur → onEdit(id, patch) → immediate write → load()`), OR explicitly permit a
per-row edit-draft that commits on blur — either satisfies immediate-write; the current
"controlled + no mirror + blur" wording cannot. A wording clarification in 07-01 Task 3, not a
design change.

### MEDIUM (codex; claude concurs, leaning LOW) — blank/whitespace optional fields aren't normalized to NULL at any boundary
**07-01-PLAN.md:20, :92-94, :102, :160**

07-01's must_have promises optional label/text/url are "stored NULL when blank", but `addFuelCore`
only coalesces `null`/`undefined` (:92-94, :102) and the `TextInput` fields (:160) emit `""`. So a
blank label/url/text entered in the UI is stored `""`, not NULL — violating the stated contract
(and the DAO test only proves the null-in→null-stored path, which the UI never exercises). Ranking
is still safe (getRankedFuel's `NULLIF(TRIM(text),'')` catches `""` text), so impact is low, but the
contract gap is real. **Fix:** normalize `value.trim().length === 0 ? null : value` at ONE boundary
(UI `onAdd`/`onEdit` or the DAO) + a DAO/UI test for empty and whitespace-only optionals. This same
JS `.trim()` boundary also closes the LOW below.

### LOW (codex) — `NULLIF(TRIM(text),'')` doesn't catch tabs/newlines; fuel text is multiline
**07-02-PLAN.md:112-113** · multiline input **07-01-PLAN.md:160**

SQLite one-arg `TRIM()` strips only ASCII space (0x20), not `\t`/`\r`/`\n`. Because fuel text is a
multiline input (07-01:160), a newline-only row (`"\n"`) survives `NULLIF(TRIM(text),'')`, becomes
eligible, can top the ranking, and renders an effectively blank promoted strip. **Fix:** normalize
whitespace-to-NULL at the input boundary with JS `.trim()` (the MEDIUM above — a single fix covers
both) and/or widen the predicate to `TRIM(text, ' \t\r\n')`; add a newline-only ranked-projection
test. Subsumed by the blank→NULL normalization fix.

### LOW (codex) — literal-backslash search case is untested
**07-04-PLAN.md:84 vs :90**

Escaping does `\`→`\\` FIRST (:84), but the planned ESCAPE tests (:90) cover only `%` and `_`. The
backslash is the escape char itself and the first transform, so a literal-`\` search test protects
the correctness of the `%`/`_` escaping that follows. **Fix:** add a literal-`\` search case to
fuel-read.test.ts. Cheap test-completeness; optional.

## Verified sound (both reviewers, against source)

- **No new migration.** Full fuel schema shipped migration 1 (001-initial.ts:167-179); all 4 plans
  leave it untouched. Confirm-flip is a plain `UPDATE source='manual'` (07-03).
- **Writer split correct.** `*Core` (non-mutexed) + mutexed wrapper mirrors events-dao.ts:62-93 and
  contact-links-dao.ts:83-146 inside the non-reentrant `inWriteTransaction` (transaction.ts:11-57,
  42-57); cores compose, never nest; assertOneChange scoped by (id, contact_id) matches
  contact-links-dao.ts:63-74,116-146.
- **Determinism:** kind CASE (from the single FUEL_KIND_PRIORITY tunable) → `created_at DESC` →
  `id DESC`; parity over eligible fixture. RANK_CASE built only from a closed code constant;
  contact_id sole bound value.
- **Single choke point:** listFuelForEditor is the only off_limits-surfacing read; getRankedFuel and
  searchFuel both exclude off_limits AND `source='ai'` in-query.
- **Search columns real:** contacts.name (NOT NULL) + contacts.archived_at exist (001-initial.ts:
  61-82); `archived_at IS NULL` matches the queries.ts:23-28 convention.
- **Local wall-clock:** fuel-age copies gravity-logic.ts:82-98 parseLocalMs; ContactProfileScreen
  load() (:134-161) uses localDateTime() (imported :47), never toISOString.
- **Purge not duplicated:** no plan touches purge-dao (fuel count :105, delete :188 left intact).
- **Wave 3 isolation:** 07-03 (fuel-dao/FuelEditor/ContactProfileScreen) and 07-04
  (fuel-read/search/navigation/settings) share no files_modified; 07-02 also touches FuelEditor/
  ContactProfileScreen but is Wave 2 (sequential, not concurrent with Wave 3).
- **FUEL-01..06** all mapped: 01→P1, 02→P1+P2, 03→P2, 04→P2, 05→P4, 06→P2+P3. Zero net-new theme
  tokens.

## Consensus Summary (Cycle 2)

Both reviewers independently confirm all six cycle-1 findings RESOLVED, including both prior HIGHs,
and find **no new HIGH**. The correctness core (no-migration, writer split, ranking parity +
determinism, off_limits/ai exclusion, wave isolation, local wall-clock) is verified against the
actual spine. The remaining gaps are two MEDIUM plan-wording items on the FuelEditor — the
existing-row edit-state owner (implementation-blocking as literally worded) and blank/whitespace →
NULL normalization at the input boundary — plus two LOW test/normalization completeness notes (the
whitespace-TRIM edge folds into the same normalization fix; a literal-`\` search test). None reverse
a locked decision; all are 07-01/07-04 clarifications.

### Agreed concerns (2+ reviewers)
- MEDIUM existing-row edit-state owner (07-01 Task 3 wording is self-contradictory vs the immediate-
  write model).
- MEDIUM blank/whitespace optional fields not normalized to NULL at any boundary (07-01).

### Divergent views
- Severity of blank→NULL: codex MEDIUM; claude concurs it is actionable but leans LOW (ranking stays
  safe via `NULLIF(TRIM(text),'')`; the breach is the stated NULL-when-blank contract, not behavior).

---

# Cross-AI Plan Review — Phase 7, Cycle 3 (final)

`cycle: 3` · `reviewed_at: 2026-08-15` · reviewers: **codex** (external CLI, codex-cli 0.144.1) +
**claude** (read-only). The cycle-2 revision addressed all 3 actionable items (uncontrolled
existing-row inputs + blank→NULL normalization; multi-char `TRIM` in the ranked projection;
literal-`\` search ESCAPE test). Both reviewers re-verified against the actual spine on disk
(`001-initial.ts`, `events-dao.ts`, `contact-links-dao.ts`, `transaction.ts`, `purge-dao.ts`,
`queries.ts`, `gravity-logic.ts`, `ContactProfileScreen.tsx`, `LinksEditor.tsx`).

## Cycle-2 items — disposition (both reviewers concur)

| # | Cycle-2 finding | Status | Evidence |
|---|-----------------|--------|----------|
| C2-MED (edit owner) | existing-row edit had no viable state owner | **RESOLVED** | 07-01-PLAN.md:158 — existing rows use UNCONTROLLED inputs (`defaultValue={row.text/label/url}` keyed by row id; commit on `onEndEditing`/blur → onEdit → immediate write → `load()`); acceptance :171 restates it. New-item draft is the ONLY persistent local state. Verified against the controlled-links contrast LinksEditor.tsx:132-148 (which only works via per-keystroke `onUpdate` + diff-on-save `applyLinkDiff`, contact-links-dao.ts:198 — the opposite of fuel's immediate-write model). |
| C2-MED (blank→NULL) | blank/whitespace optionals not normalized to NULL | **RESOLVED** | 07-01-PLAN.md:160 — `const v = raw.trim(); return v.length===0 ? null : v;` at the single onAdd/onEdit commit boundary; acceptance :172 adds an empty + whitespace-only optional → NULL test. Removes reliance on SQL `TRIM()` catching `\t\r\n`. |
| C2-LOW (multi-char TRIM) | one-arg `TRIM` doesn't strip tabs/newlines | **RESOLVED (residual wording)** | 07-02-PLAN.md:112 behavior + :127 acceptance both carry `NULLIF(TRIM(text, char(9)||char(10)||char(13)||' '),'')`. **But** the inline SQL sketch at 07-02-PLAN.md:119 still shows the stale one-arg `NULLIF(TRIM(text), '')` immediately before restating the widened form — an internal contradiction (the single C3 actionable below). |
| C2-LOW (literal-`\` test) | literal-backslash search case untested | **RESOLVED** | 07-04-PLAN.md:90 — seed `path\to`, search `\`, assert it matches (proves the `\`→`\\` escape-first step); acceptance :97 lists literal-`%`/`_`/`\` ESCAPE cases. |

## New / residual finding (Cycle 3) — the ONLY open actionable

### MEDIUM (codex) / LOW (claude, leaning) — stale one-arg `TRIM` SQL sketch contradicts the widened guard
**07-02-PLAN.md:119** (vs the correct form at **:112** and acceptance **:127**)

The action prose at 07-02-PLAN.md:119 writes the getRankedFuel SQL inline as
`… AND NULLIF(TRIM(text), '') IS NOT NULL, ORDER BY …` (one-arg `TRIM`, strips ASCII space only)
and then, in the very next sentence, describes the predicate as
`NULLIF(TRIM(text, char(9)||char(10)||char(13)||' '),'') IS NOT NULL` (the widened, tab/newline-safe
form that behavior :112 and acceptance :127 mandate). The two are contradictory within one paragraph.
An executor copying the first inline sketch literally would ship the weaker predicate.

**Impact is bounded** (why claude leans LOW): the cycle-2 input-boundary normalization
(07-01-PLAN.md:160) already stores any whitespace/newline-only optional as NULL, so a UI-entered
`"\n"` never reaches the row; and acceptance criterion :127 carries the correct widened form, which
governs the executor. The residual exposure is a directly-seeded/AI-written (Phase 14) whitespace-only
row bypassing the UI — exactly the defense-in-depth case the widened predicate exists for.

**Fix (one-line plan edit, no design change):** in 07-02-PLAN.md:119 replace the inline
`NULLIF(TRIM(text), '')` sketch with `NULLIF(TRIM(text, char(9)||char(10)||char(13)||' '), '') IS NOT NULL`
so the action, behavior (:112), and acceptance (:127) all read identically. Both reviewers agree this
is the sole remaining plan-text change; it does not reverse any locked decision.

## Verified sound (both reviewers, against source)

- **No new migration.** Full fuel schema shipped migration 1 (001-initial.ts:167-179); all 4 plans
  leave it untouched. Confirm-flip is a plain `UPDATE source='manual'` (07-03).
- **Writer split correct.** `*Core` (non-mutexed) + mutexed wrapper mirrors events-dao.ts:62-93 and
  contact-links-dao.ts:83-146 inside the non-reentrant `inWriteTransaction` (transaction.ts:42-57);
  cores compose, never nest; assertOneChange scoped by (id, contact_id) matches contact-links-dao.ts:
  62-74,116-146.
- **Single choke point / exclusions:** listFuelForEditor is the only off_limits-surfacing read;
  getRankedFuel AND searchFuel both exclude off_limits AND `source='ai'` in-query (07-02:119 /
  07-04:88), never a UI filter.
- **Determinism + parity:** kind CASE from the single FUEL_KIND_PRIORITY tunable → `created_at DESC`
  → `id DESC`; precedence recent>gift>topic>fact matches dossier 03-fuel.md:240-242 (and its
  explicitly-REJECTED "newest regardless of kind"); parity test over an eligible-only fixture;
  RANK_CASE built from a closed code constant, contact_id the sole bound value.
- **Search escaping:** `?`-bound + mandatory `LIKE ? ESCAPE '\'` on all three predicates (name,
  snippet subquery, EXISTS); `\`→`\\`→`%`→`\%`→`_`→`\_` (backslash first); archived excluded via
  `archived_at IS NULL` (queries.ts:26 convention; contacts.name NOT NULL + archived_at at
  001-initial.ts:65,76).
- **Local wall-clock:** fuel-age copies gravity-logic.ts:82 parseLocalMs; ContactProfileScreen
  load() (:134) uses localDateTime() (imported :47), never toISOString.
- **Age never hides/destroys:** display + rank only; no launch sweep, no age-keyed DELETE/UPDATE.
- **Purge not duplicated:** no plan touches purge-dao (fuel count :105, delete fan-out :188 intact).
- **Wave-3 isolation:** 07-03 (fuel-dao/FuelEditor/ContactProfileScreen) and 07-04
  (fuel-read/search/navigation/settings) share no files_modified.
- **FUEL-01..06 mapped:** 01→P1, 02→P1+P2, 03→P2, 04→P2, 05→P4, 06→P2+P3 (REQUIREMENTS.md:69-74).
  Zero net-new theme tokens.

## Consensus Summary (Cycle 3)

Both reviewers independently confirm all cycle-2 findings RESOLVED and find **no new HIGH**. Both
also independently surfaced the SAME single residual: the stale one-arg `TRIM(text)` SQL sketch at
07-02-PLAN.md:119 contradicting the widened tab/newline-safe guard now in the behavior (:112) and
acceptance (:127). codex rates it MEDIUM (an executor could implement the weaker predicate); claude
concurs it is actionable but leans LOW (input-boundary normalization + the governing acceptance
criterion already carry the correct form; the residual exposure is only a directly-seeded/AI-written
whitespace-only row). The correctness core (no-migration, writer split, ranking parity + determinism,
off_limits/ai exclusion, search escaping, wave isolation, local wall-clock, purge untouched) is
verified against the actual spine. The single fix is a one-line reconciliation of 07-02:119; it
reverses no locked decision.

### Agreed concerns (2+ reviewers)
- The 07-02:119 stale one-arg `TRIM` inline SQL sketch (reconcile to the widened multi-char form).

### Divergent views
- Severity of the 07-02:119 residual: codex MEDIUM; claude LOW-leaning (bounded by the input-boundary
  normalization and the governing acceptance criterion :127).
