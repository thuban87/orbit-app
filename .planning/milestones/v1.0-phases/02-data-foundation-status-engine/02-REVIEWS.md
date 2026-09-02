---
phase: 2
cycle: 2
reviewers: [codex, claude]
reviewed_at: 2026-08-14T22:20:00Z
plans_reviewed: [02-01-PLAN.md, 02-02-PLAN.md, 02-03-PLAN.md, 02-04-PLAN.md, 02-05-PLAN.md, 02-06-PLAN.md]
re_review_of: b4b1488
---

# Cross-AI Plan Review — Phase 2 (Data Foundation & Status Engine) — CYCLE 2

> **Cycle 2 re-review.** Cycle 1 (commit b84bdb0) raised 3 HIGH + 3 MEDIUM + 2 LOW; the revision
> (commit b4b1488) incorporated all eight. This pass verifies the fixes HELD without regression and
> reports ONLY findings that REMAIN unresolved in the CURRENT plan text.
>
> Reviewer independence note: this session runs inside Claude Code, so per the review workflow the
> external `claude -p` CLI is skipped for independence. The **Codex** review below is a fully
> independent external CLI pass (grounded, ran in the repo working tree). The **Claude** review is a
> grounded in-session read of the actual plans + source (`src/types.ts`, `src/utils/dates.ts`,
> `src/utils/logger.ts`, the RESEARCH DDL/SQL, `HANDOFF.md`, `CLAUDE.md`) plus empirical node:sqlite
> verification of the two load-bearing technical claims — not a paraphrase of plan text.

## Cycle-1 fix verification (both reviewers)

| Cycle-1 finding | Status in current plans | Evidence |
|---|---|---|
| HIGH-1 status SQL timezone double-conversion | **FULLY RESOLVED** (read path) | Plan 04 `PROGRESS_SQL = CAST(julianday(date('now','localtime')) - julianday(date(last_contact)) AS REAL) / interval_days` — stored column gets NO `'localtime'` modifier (02-04-PLAN.md:108-113); near-midnight regression test present (02-04-PLAN.md:90-91,126); verified empirically: `date('2026-08-14 00:30:00')`→`2026-08-14` (no shift), `date(...,'localtime')`→`2026-08-13` (old bug). See residual write-path concern below. |
| HIGH-2 benchmark writes live orbit.db / second writer | **FULLY RESOLVED** | Plan 06 opens throwaway `orbit-bench.db`, migrates/seeds/deletes it, never `getDb()` (02-06-PLAN.md:160-181); threat T-02-14; `src/db/` confirmed empty (.gitkeep only) so no pre-existing second writer. |
| HIGH-3 Logger off → evidence can't emit | **FULLY RESOLVED** | Plan 06 sets `Logger.setLevel('debug')` before runBenchmark (02-06-PLAN.md:164-166); confirmed logger.ts default `level="off"`, debug prints only at `"debug"` (src/utils/logger.ts:11,38-41). |
| MED runMigrations signature | **PARTIALLY RESOLVED** | Canonical `(exec, migrations, targetVersion, deps)` pinned in Plan 01 (02-01-PLAN.md:136-139) and Plan 02 key_link (02-02-PLAN.md:40); but two stale 3-arg call sites remain in Plan 02 Task 2 (see residual). |
| MED ccv index test re-scoped to VALUE columns | **RESOLVED w/ a new inaccuracy** | Plan 02 no longer asserts the `uid` autoindex absent and scopes the ban to VALUE columns (02-02-PLAN.md:118-123,152); but the revised text introduces a false "implicit PK index" expectation (see residual). |
| MED launch-sweep gating (background→active; after migration) | **FULLY RESOLVED** | Plan 05 tracks previous AppState, fires only on background→active (02-05-PLAN.md:96-102), installs only after `openAndMigrate()` resolves via ready-gated effect (02-05-PLAN.md:129-135). |
| LOW threshold-constant drift | **RESOLVED (documented mitigation)** | Plan 04 key_link rewritten to "documented convention — no exported constant exists to import" (02-04-PLAN.md:34-37,104-106). |
| LOW STATUS_SQL buckets NULL as stable | **RESOLVED (documented)** | Plan 04 adds the required comment + notes STATUS_SCAN pre-filters NULL (02-04-PLAN.md:116-120). |

**No decision reversals.** fuel EMPTY in migration 1, `allowBackup=false`, `uid ... UNIQUE`,
single-writer DAO, and no-ORM are all intact in the revised plans.

## Codex Review (external CLI, independent)

### Summary
The explicit SQL double-conversion fix, temporary benchmark DB isolation, debug logging, and AppState
gating are present. Four actionable gaps remain: the stored-local write convention is not enforced,
the benchmark does not actually compare live-DB counts, one migration-test call still has the old
signature, and the custom-values index test expects a nonexistent PK index.

### Concerns
- **HIGH — Local wall-clock storage remains an assumption, not an enforced write-path contract.**
  Plan 04 correctly reads `date(last_contact)` without a modifier, but Plan 03 accepts arbitrary
  `input` timestamps and writes/recomputes `occurred_at`/`last_contact` without requiring or testing
  local-wall-clock serialization; `formatLocalDate()` only produces `YYYY-MM-DD`, not a local datetime.
  An ISO/UTC timestamp from a caller would reintroduce an off-by-one at the SQL read path.
  Evidence: 02-04-PLAN.md:95-110, 02-03-PLAN.md:121-137, src/utils/dates.ts:9-21, 02-RESEARCH.md:334-335,361.
- **HIGH — Plan 06 claims unchanged live-DB row counts but never directs a before/after count
  assertion.** It correctly uses `orbit-bench.db` and avoids `getDb()`, yet Task 3 only asks for a
  narrative confirmation; no baseline/post-run counts or equality assertion is specified.
  Evidence: 02-06-PLAN.md:156-181,189-191,217.
- **MEDIUM — Plan 02 still contains a stale three-argument `runMigrations` invocation.** The canonical
  signature requires `(exec, migrations, targetVersion, deps)`, but both the stated behavior and the
  test action omit the executor. Evidence: 02-01-PLAN.md:135-139, 02-02-PLAN.md:148,157-159.
- **MEDIUM — The re-scoped custom-values index test still assumes an implicit PK index that the
  authoritative DDL does not create.** `contact_id INTEGER PRIMARY KEY` is a rowid alias, while
  `uid UNIQUE` is the sole `PRAGMA index_list` entry; requiring/allowing an "implicit PK index" risks a
  failing or misleading test. The value-column scope itself is correct.
  Evidence: 02-02-PLAN.md:152,160-163, 02-RESEARCH.md:401-405.

### Risk Assessment
**HIGH** — the timestamp contract and live-DB non-mutation proof remain incomplete.

---

## Claude Review (in-session, grounded + empirically verified)

### Summary
All three cycle-1 HIGH findings are fully resolved and none were regressed. The status read SQL no
longer double-converts (verified empirically: the no-modifier form does not day-shift a `00:30:00`
row; the old `'localtime'` form does), the benchmark is isolated to a throwaway DB, and Logger is
raised to debug so DATA-07 evidence prints. No recorded decision was reversed. What remains are three
localized, non-blocking residuals in plan text/tests — one that Codex and I both flag (stale
`runMigrations` call), one technical inaccuracy the revision newly introduced (the "implicit PK index"
claim), and one genuine forward-looking gap (the write-path local-storage contract on which Plan 04's
correctness depends). I do NOT concur that any of these are HIGH for Phase 2's shipped deliverables.

### Concerns (residual only)
- **MEDIUM — Plan 02 Task 2 retains two stale 3-arg `runMigrations` references** contradicting the
  signature pinned in the same plan. 02-02-PLAN.md:148 ("After runMigrations([migration001],1)…") and
  :159 ("call `runMigrations([migration001], 1, { now, newUid })`") omit the executor, while the
  pinned 4-arg form appears at 02-02-PLAN.md:40 and :191 and 02-01-PLAN.md:136-139. Taken literally the
  Task-2 test call fails typecheck against the pinned signature (self-correcting at tsc, but a real
  contradiction the revision's "pin across all plans" goal did not finish). **Fix:** rewrite both to
  `runMigrations(exec, [migration001], 1, { now, newUid })`.
- **MEDIUM — Plan 02's `contact_custom_values` index-list assertion is technically wrong about SQLite.**
  02-02-PLAN.md:152 and :160-163 tell the executor to expect/"allow" an "implicit PK index" alongside
  the `uid` autoindex. Verified empirically with node:sqlite: `PRAGMA index_list(contact_custom_values)`
  returns ONLY `sqlite_autoindex_..._1` (origin `u`, the `uid` UNIQUE) — `contact_id INTEGER PRIMARY
  KEY` is a rowid alias and produces NO index_list entry. An assertion demanding a PK index will fail
  or mislead. The VALUE-column scoping is correct; only the "PK index present" expectation is wrong.
  **Fix:** assert index_list shows ONLY the `uid` UNIQUE autoindex (no PK-index entry) and that no
  index/UNIQUE exists on any VALUE column.
- **MEDIUM — Plan 03 does not pin (or test) the local-wall-clock write contract that Plan 04's
  day-granular status correctness depends on.** Plan 04's fix is correct *only if* `occurred_at` /
  `last_contact` are stored as local wall-clock (DDL comments 02-RESEARCH.md:334-335,361 assert this),
  but Plan 03 (02-03-PLAN.md:121-138) writes `occurred_at` straight from caller `input` with no
  format contract or test, and `database.ts`'s `now` is only a `formatLocalDate()`-derived value
  (date-only, src/utils/dates.ts:17-22). No Phase-2 deliverable ships a UTC-producing caller (there is
  no CRUD/log UI this phase), so this is a **latent** gap, not a shipped Phase-2 bug — hence MEDIUM,
  not HIGH. **Fix:** state in recency-dao.ts that `occurred_at`/`last_contact` are persisted as local
  wall-clock (produced without UTC conversion), and add a note/assertion that DATA-05 status
  correctness depends on it, so later phases (CRUD/log) inherit the contract.

### On Codex's two HIGH ratings (divergence)
- Codex's "write-path contract not enforced" is the same gap as my third MEDIUM. I downgrade it to
  MEDIUM because Phase 2 ships no caller that would feed a UTC timestamp, and Plan 04's near-midnight
  test already exercises the read path against a locally-formatted stored value. It is a real
  forward-looking hardening, not a Phase-2 shipped defect.
- Codex's "no explicit before/after live-DB count assertion" I treat as effectively resolved by
  construction: the benchmark opens a *separate named DB file* and never calls `getDb()`
  (02-06-PLAN.md:160-181), and the verification already directs "row counts unchanged" (02-06-PLAN.md:217).
  A before/after count would strengthen the evidence but the isolation is structural, so I do not count
  it as a required actionable fix.

### Risk Assessment
**MEDIUM.** All three cycle-1 HIGH correctness defects are fixed and verified; no decision reversed.
The remaining residuals are localized plan-text/test corrections (a stale call signature, a
SQLite-behavior inaccuracy in an assertion, and a forward-looking write-path contract note). None
block execution on correctness grounds, though all three are worth a quick pass to keep the
irreversible-schema phase's tests truthful.

---

## Consensus Summary

Both reviewers agree the three cycle-1 HIGH findings are **fully resolved without regression** and no
recorded decision was reversed. The disagreement is on severity of the residuals, not their existence.

### Agreed (both reviewers)
- **Stale 3-arg `runMigrations` in Plan 02 Task 2** (02-02-PLAN.md:148,159) — contradicts the pinned
  4-arg signature. MEDIUM, actionable.
- **`contact_custom_values` index-list test expects a nonexistent "implicit PK index"**
  (02-02-PLAN.md:152,160-163) — the rowid-alias PK creates no index_list entry (empirically confirmed).
  MEDIUM, actionable.
- **Write-path local-wall-clock storage is assumed, not enforced/tested** (Plan 03) — Plan 04's status
  correctness rests on it. Raised HIGH by Codex, MEDIUM by Claude; actionable either way.

### Divergent Views
- **Benchmark live-DB proof:** Codex HIGH (no explicit before/after count assertion); Claude treats it
  as resolved-by-construction (separate DB file, never `getDb()`, "row counts unchanged" already in the
  verification). Not counted as a required fix by Claude.
- **Write-contract severity:** Codex HIGH, Claude MEDIUM (no Phase-2 caller emits UTC; latent for
  later phases).

### Net actionable for /gsd-plan-phase 2 --reviews
Three localized MEDIUM residuals — all plan-text/test edits, none reversing a decision, none requiring
DDL change: (1) fix the two stale `runMigrations` calls in Plan 02; (2) correct the index-list
assertion to expect only the `uid` autoindex (no PK index); (3) pin the local-wall-clock write contract
in Plan 03 with a note that DATA-05 depends on it.
